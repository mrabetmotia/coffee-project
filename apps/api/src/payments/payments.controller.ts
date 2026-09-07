import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './payments.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.payments.list(skip ? Number(skip) : 0, take ? Number(take) : 50);
  }

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.payments.add(dto);
  }
}
