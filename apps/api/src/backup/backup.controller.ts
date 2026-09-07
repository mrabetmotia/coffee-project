import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import { BackupService } from './backup.service';

class RestoreDto {
  @IsString()
  path!: string;
}

@Controller('backup')
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Get()
  list() {
    return this.backup.list();
  }

  @Post()
  create() {
    return this.backup.backupNow();
  }

  @Post('restore')
  restore(@Body() dto: RestoreDto) {
    return this.backup.restore(dto.path);
  }
}
