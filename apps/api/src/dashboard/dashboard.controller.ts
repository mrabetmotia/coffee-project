import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  overview(@Query('period') period?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.dashboard.overview(period, from, to);
  }
}
