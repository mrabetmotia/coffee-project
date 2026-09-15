import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './orders.dto';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CLIENT)
  @Post('client/orders')
  createClientOrder(@Req() req: { user: { id: string } }, @Body() dto: CreateOrderDto) {
    return this.orders.createForClient(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CLIENT)
  @Get('client/orders')
  listClientOrders(@Req() req: { user: { id: string } }, @Query('status') status?: string) {
    return this.orders.listForClient(req.user.id, status);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CLIENT)
  @Get('client/orders/:id')
  getClientOrder(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.orders.findClientOrder(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CLIENT)
  @Patch('client/orders/:id/cancel')
  cancelClientOrder(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.orders.cancelClientOrder(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/orders')
  listAdminOrders(@Query('status') status?: string, @Query('clientId') clientId?: string) {
    return this.orders.listForAdmin({ status, clientId });
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/orders/:id')
  getAdminOrder(@Param('id') id: string) {
    return this.orders.findAdminOrder(id);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/orders/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.updateStatus(id, dto);
  }
}
