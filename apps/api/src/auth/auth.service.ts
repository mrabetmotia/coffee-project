import { HttpStatus, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { BusinessException } from '../common/business.exception';
import { LoginDto, UpdateProfileDto } from './auth.dto';

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

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        client: { select: { id: true, name: true, email: true, phone: true, address: true } },
      },
    });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable.');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { client: true } });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable.');

    const name = dto.name?.trim();
    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone === undefined ? undefined : dto.phone.trim() || null;
    const address = dto.address === undefined ? undefined : dto.address.trim() || null;

    if (email && email !== user.email) {
      const duplicate = await this.prisma.user.findFirst({
        where: { email, NOT: { id: userId } },
        select: { id: true },
      });
      const duplicateClient = await this.prisma.client.findFirst({
        where: { email, ...(user.client ? { NOT: { id: user.client.id } } : {}) },
        select: { id: true },
      });
      if (duplicate || duplicateClient) {
        throw new BusinessException('Cette adresse email est déjà utilisée.', HttpStatus.CONFLICT, 'DUPLICATE_EMAIL');
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: userId }, data: { ...(name !== undefined ? { name } : {}), ...(email !== undefined ? { email } : {}) } });
        if (user.client) {
          await tx.client.update({
            where: { id: user.client.id },
            data: {
              ...(name !== undefined ? { name } : {}),
              ...(email !== undefined ? { email } : {}),
              ...(phone !== undefined ? { phone } : {}),
              ...(address !== undefined ? { address } : {}),
            },
          });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BusinessException('Cette adresse email est déjà utilisée.', HttpStatus.CONFLICT, 'DUPLICATE_EMAIL');
      }
      throw error;
    }

    return this.getProfile(userId);
  }
}
