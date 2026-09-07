import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { SalesService } from './sales.service';
import { CreateReturnDto, CreateSaleDto } from './sales.dto';

@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('clientId') clientId?: string,
    @Query('paymentStatus') paymentStatus?: PaymentStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('minAmount') minAmount?: string,
    @Query('maxAmount') maxAmount?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.sales.list({
      q,
      clientId,
      paymentStatus,
      from,
      to,
      minAmount: minAmount ? Number(minAmount) : undefined,
      maxAmount: maxAmount ? Number(maxAmount) : undefined,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 50,
    });
  }

  @Get('returns')
  returns() {
    return this.sales.listReturns();
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.sales.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSaleDto) {
    return this.sales.create(dto);
  }

  @Post(':id/returns')
  createReturn(@Param('id') id: string, @Body() dto: CreateReturnDto) {
    return this.sales.createReturn(id, dto);
  }
}
