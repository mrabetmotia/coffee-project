import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService, PrismaModule } from '../src/prisma/prisma.module';
import { StockService } from '../src/stock/stock.service';
import { StockEntriesService, computeWeightedAverageCost } from '../src/stock-entries/stock-entries.service';
import { SalesService } from '../src/sales/sales.service';
import { PaymentsService } from '../src/payments/payments.service';
import { InventoryService } from '../src/stock/inventory.service';
import { ProductsService } from '../src/products/products.service';
import { toNumber } from '../src/common/decimal';
import { BusinessException } from '../src/common/business.exception';

const dbDir = join(__dirname, '.tmp');
const dbFile = join(dbDir, 'test.db');

describe('Critical business logic', () => {
  let prisma: PrismaService;
  let products: ProductsService;
  let entries: StockEntriesService;
  let sales: SalesService;
  let payments: PaymentsService;
  let inventory: InventoryService;
  let categoryId: string;
  let productId: string;

  beforeAll(async () => {
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
    if (existsSync(dbFile)) unlinkSync(dbFile);
    process.env.DATABASE_URL = `file:${dbFile}`;
    execSync('npx prisma migrate deploy', { cwd: join(__dirname, '..'), env: process.env, stdio: 'inherit' });
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
      providers: [StockService, StockEntriesService, SalesService, PaymentsService, InventoryService, ProductsService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    products = moduleRef.get(ProductsService);
    entries = moduleRef.get(StockEntriesService);
    sales = moduleRef.get(SalesService);
    payments = moduleRef.get(PaymentsService);
    inventory = moduleRef.get(InventoryService);
    await prisma.$connect();
    const cat = await prisma.category.create({ data: { name: 'Gobelets' } });
    categoryId = cat.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('computes weighted average cost', () => {
    expect(computeWeightedAverageCost(100, 0.8, 50, 1)).toBeCloseTo(0.867, 3);
    expect(computeWeightedAverageCost(0, 0, 50, 0.8)).toBe(0.8);
  });

  it('creates a product', async () => {
    const p = await products.create({
      name: 'Gobelets 18cl',
      sku: 'GOB-18',
      categoryId,
      purchasePrice: 0.08,
      salePrice: 0.12,
      currentStock: 0,
      minimumStock: 50,
      image: 'https://example.com/gobelet.png',
    });
    productId = p!.id;
    expect(p!.sku).toBe('GOB-18');
    expect(p!.image).toBe('https://example.com/gobelet.png');
  });

  it('updates a product image and price', async () => {
    const updated = await products.update(productId, {
      salePrice: 0.15,
      image: 'https://example.com/gobelet-updated.png',
    });
    expect(updated.image).toBe('https://example.com/gobelet-updated.png');
    expect(updated.salePrice.toNumber()).toBeCloseTo(0.15);
  });

  it('stock entry increases stock and updates CMP', async () => {
    await entries.create({
      items: [{ productId, quantity: 100, unitPurchasePrice: 0.08 }],
    });
    const p = await prisma.product.findUnique({ where: { id: productId } });
    expect(toNumber(p!.currentStock)).toBe(100);
    expect(toNumber(p!.purchasePrice)).toBeCloseTo(0.08);
    await entries.create({
      items: [{ productId, quantity: 50, unitPurchasePrice: 0.1 }],
    });
    const p2 = await prisma.product.findUnique({ where: { id: productId } });
    expect(toNumber(p2!.currentStock)).toBe(150);
    expect(toNumber(p2!.purchasePrice)).toBeCloseTo(computeWeightedAverageCost(100, 0.08, 50, 0.1));
  });

  it('sale decreases stock, snapshots cost, computes profit', async () => {
    const before = await prisma.product.findUnique({ where: { id: productId } });
    const cmp = toNumber(before!.purchasePrice);
    const sale = await sales.create({
      items: [{ productId, quantity: 50, unitPrice: 0.12 }],
      paidAmount: 6,
      paymentMethod: 'CASH',
    });
    expect(sale!.invoiceNumber).toMatch(/^FAC-/);
    expect(toNumber(sale!.total)).toBeCloseTo(6);
    expect(toNumber(sale!.costAmount)).toBeCloseTo(round3(50 * cmp));
    expect(toNumber(sale!.profitAmount)).toBeCloseTo(round3(6 - 50 * cmp));
    expect(toNumber(sale!.remainingAmount)).toBe(0);
    const after = await prisma.product.findUnique({ where: { id: productId } });
    expect(toNumber(after!.currentStock)).toBe(100);
    const movements = await prisma.stockMovement.findMany({ where: { type: 'SALE' } });
    expect(movements.length).toBeGreaterThan(0);
  });

  it('rejects insufficient stock and rolls back', async () => {
    const before = await prisma.product.findUnique({ where: { id: productId } });
    const stock = toNumber(before!.currentStock);
    const countBefore = await prisma.sale.count();
    await expect(
      sales.create({ items: [{ productId, quantity: stock + 10 }] }),
    ).rejects.toBeInstanceOf(BusinessException);
    const after = await prisma.product.findUnique({ where: { id: productId } });
    expect(toNumber(after!.currentStock)).toBe(stock);
    expect(await prisma.sale.count()).toBe(countBefore);
  });

  it('return restores stock and adjusts profit using historical cost', async () => {
    const sale = await prisma.sale.findFirst({ include: { items: true }, orderBy: { createdAt: 'desc' } });
    const item = sale!.items[0];
    const stockBefore = toNumber((await prisma.product.findUnique({ where: { id: productId } }))!.currentStock);
    const ret = await sales.createReturn(sale!.id, {
      items: [{ saleItemId: item.id, quantity: 5 }],
    });
    expect(ret).toBeTruthy();
    const stockAfter = toNumber((await prisma.product.findUnique({ where: { id: productId } }))!.currentStock);
    expect(stockAfter).toBe(stockBefore + 5);
    const updated = await prisma.sale.findUnique({ where: { id: sale!.id } });
    expect(toNumber(updated!.total)).toBeLessThan(toNumber(sale!.total));
  });

  it('payment updates remaining balance', async () => {
    const sale = await sales.create({
      items: [{ productId, quantity: 10, unitPrice: 0.12 }],
      paidAmount: 0.5,
      paymentMethod: 'CASH',
    });
    expect(toNumber(sale!.remainingAmount)).toBeCloseTo(0.7);
    await payments.add({ saleId: sale!.id, amount: 0.7, method: 'CASH' });
    const paid = await prisma.sale.findUnique({ where: { id: sale!.id } });
    expect(toNumber(paid!.remainingAmount)).toBe(0);
    expect(paid!.paymentStatus).toBe('PAID');
  });

  it('inventory creates ADJUSTMENT movement', async () => {
    const p = await prisma.product.findUnique({ where: { id: productId } });
    const system = toNumber(p!.currentStock);
    await inventory.adjust({
      notes: 'Inventaire test',
      items: [{ productId, physicalStock: system - 5 }],
    });
    const after = await prisma.product.findUnique({ where: { id: productId } });
    expect(toNumber(after!.currentStock)).toBe(system - 5);
    const adj = await prisma.stockMovement.findFirst({ where: { type: 'ADJUSTMENT', productId }, orderBy: { createdAt: 'desc' } });
    expect(adj).toBeTruthy();
  });

  it('supports a client account and a pending customer order', async () => {
    const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
    expect(admin).toBeTruthy();

    const user = await prisma.user.create({
      data: {
        username: 'client-demo',
        passwordHash: 'hash',
        name: 'Client Demo',
        email: 'client-demo@example.com',
        role: 'CLIENT',
        isActive: true,
      },
    });

    const client = await prisma.client.create({
      data: {
        name: 'Client Demo',
        email: 'client-demo@example.com',
        phone: '12345678',
        userId: user.id,
      },
    });

    const order = await prisma.customerOrder.create({
      data: {
        clientId: client.id,
        userId: user.id,
        status: 'PENDING',
        totalAmount: 1.2,
        note: 'Coffee refill',
        items: {
          create: [{
            productId,
            quantity: 2,
            unitPrice: 0.6,
            totalPrice: 1.2,
          }],
        },
      },
      include: { items: true },
    });

    expect(order.status).toBe('PENDING');
    expect(order.items[0].quantity.toNumber()).toBe(2);
  });
});

function round3(n: number) {
  return Number(n.toFixed(3));
}
