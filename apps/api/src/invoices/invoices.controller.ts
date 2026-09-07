import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.invoices.list(skip ? Number(skip) : 0, take ? Number(take) : 50);
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.invoices.findOne(id);
  }

  @Post(':id/pdf')
  async pdf(@Param('id') id: string) {
    const path = await this.invoices.generatePdf(id);
    return { path };
  }
}
