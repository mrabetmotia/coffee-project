import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { PrismaService } from '../prisma/prisma.module';
import { BusinessException } from '../common/business.exception';

@Injectable()
export class BackupService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const settings = await this.prisma.companySettings.findUnique({ where: { id: 'default' } });
    if (settings?.autoBackup) {
      try {
        await this.backupNow();
      } catch {
        // first run may not have a db file yet
      }
    }
  }

  private dbPath(): string {
    const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
    const file = url.replace(/^file:/, '');
    return file.startsWith('/') || /^[A-Za-z]:/.test(file) ? file : join(process.cwd(), file);
  }

  private backupDir(): string {
    const dir = process.env.BACKUP_DIR ?? join(dirname(this.dbPath()), '..', 'backups');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  async backupNow() {
    try {
      await this.prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(FULL);');
    } catch {
      // non-sqlite
    }
    const src = this.dbPath();
    if (!existsSync(src)) {
      throw new BusinessException('Base de données introuvable.', HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    const dest = join(this.backupDir(), `cafestock-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
    copyFileSync(src, dest);
    return { path: dest };
  }

  list() {
    const dir = this.backupDir();
    return readdirSync(dir)
      .filter((f) => f.endsWith('.db'))
      .map((name) => {
        const path = join(dir, name);
        const st = statSync(path);
        return { name, path, size: st.size, createdAt: st.mtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async restore(filePath: string) {
    if (!existsSync(filePath) || !filePath.endsWith('.db')) {
      throw new BusinessException('Fichier de sauvegarde invalide.', HttpStatus.BAD_REQUEST, 'INVALID_BACKUP');
    }
    const safety = await this.backupNow();
    await this.prisma.$disconnect();
    copyFileSync(filePath, this.dbPath());
    await this.prisma.$connect();
    return { restored: filePath, safetyBackup: safety.path };
  }
}
