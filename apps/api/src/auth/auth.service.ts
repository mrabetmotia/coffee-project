import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.module';
import { LoginDto } from './auth.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.prisma.user.count();
    if (count === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await this.prisma.user.create({
        data: { username: 'admin', passwordHash, role: 'ADMIN' },
      });
    }
    const settings = await this.prisma.companySettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      await this.prisma.companySettings.create({
        data: {
          id: 'default',
          companyName: 'CaféStock',
          companyPhone: '',
          companyAddress: '',
          currency: 'DT',
        },
      });
    }
  }

  async login(dto: LoginDto) {
    const identifier = dto.username.trim();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
    });
    if (!user) throw new UnauthorizedException('Identifiants incorrects.');
    if (!user.isActive) throw new UnauthorizedException('Compte inactif.');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Identifiants incorrects.');
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable.');
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Mot de passe actuel incorrect.');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { ok: true };
  }
}
