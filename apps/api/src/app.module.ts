import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { ClientsModule } from './clients/clients.module';
import { SalesModule } from './sales/sales.module';
import { PaymentsModule } from './payments/payments.module';
import { StockModule } from './stock/stock.module';
import { StockEntriesModule } from './stock-entries/stock-entries.module';
import { InvoicesModule } from './invoices/invoices.module';
import { CashModule } from './cash/cash.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { BackupModule } from './backup/backup.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProductsModule,
    CategoriesModule,
    ClientsModule,
    SalesModule,
    PaymentsModule,
    StockModule,
    StockEntriesModule,
    InvoicesModule,
    CashModule,
    ReportsModule,
    SettingsModule,
    BackupModule,
    DashboardModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
