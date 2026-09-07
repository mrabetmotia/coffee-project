import { Body, Controller, Get, Post } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryDto } from './inventory.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list() {
    return this.inventory.list();
  }

  @Post()
  create(@Body() dto: InventoryDto) {
    return this.inventory.adjust(dto);
  }
}
