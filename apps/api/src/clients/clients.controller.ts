import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './clients.dto';
import { Roles } from '../auth/roles.decorator';

@Controller('admin')
@Roles(UserRole.ADMIN)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get('clients')
  list(@Query('q') q?: string) {
    return this.clients.list(q);
  }

  @Get('clients/:id')
  one(@Param('id') id: string) {
    return this.clients.findOne(id);
  }

  @Post('clients')
  create(@Body() dto: CreateClientDto) {
    return this.clients.create(dto);
  }

  @Patch('clients/:id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(id, dto);
  }

  @Patch('clients/:id/status')
  setStatus(@Param('id') id: string, @Body() body: { isActive: boolean }, @Req() req: { user: { id: string } }) {
    return this.clients.setStatus(id, body.isActive, req.user.id);
  }
}
