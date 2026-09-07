import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { StockEntriesService } from './stock-entries.service';
import { CreateStockEntryDto } from './stock-entries.dto';

@Controller('stock-entries')
export class StockEntriesController {
  constructor(private readonly entries: StockEntriesService) {}

  @Get()
  list(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.entries.list(skip ? Number(skip) : 0, take ? Number(take) : 50);
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.entries.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateStockEntryDto) {
    return this.entries.create(dto);
  }
}
