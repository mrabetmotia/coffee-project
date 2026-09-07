import { Controller, Get, Query } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { StockService } from './stock.service';

@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('movements')
  movements(
    @Query('productId') productId?: string,
    @Query('type') type?: StockMovementType,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.stock.list({
      productId,
      type,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 50,
    });
  }

  @Get('low')
  low() {
    return this.stock.lowStock();
  }
}
