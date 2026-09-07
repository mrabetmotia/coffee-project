import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('sales')
  sales(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.sales(from, to);
  }

  @Get('products')
  products(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.products(from, to);
  }

  @Get('customers')
  customers() {
    return this.reports.customers();
  }

  @Get('stock')
  stock() {
    return this.reports.stock();
  }

  @Get('export/excel')
  excel(
    @Query('kind') kind: 'sales' | 'products' | 'customers' | 'stock' = 'sales',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.exportExcel(kind, from, to);
  }

  @Get('export/pdf')
  pdf(
    @Query('kind') kind: 'sales' | 'products' | 'customers' | 'stock' = 'sales',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.exportPdf(kind, from, to);
  }
}
