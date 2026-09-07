import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { UpdateSettingsDto } from './settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  get() {
    return this.prisma.companySettings.findUnique({ where: { id: 'default' } });
  }

  update(dto: UpdateSettingsDto) {
    return this.prisma.companySettings.update({ where: { id: 'default' }, data: dto });
  }
}
