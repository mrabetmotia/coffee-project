import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [StockController, InventoryController],
  providers: [StockService, InventoryService],
  exports: [StockService],
})
export class StockModule {}
