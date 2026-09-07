import { Controller, Get } from '@nestjs/common';
import { CashService } from './cash.service';

@Controller('cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get()
  summary() {
    return this.cash.summary();
  }
}
