import { Prisma } from '@prisma/client';

export class CreateNotificationDto {
  type!: string;
  title!: string;
  message!: string;
  actionLabel?: string;
  actionUrl?: string;
  metadata?: Prisma.InputJsonValue;
  persistent?: boolean;
}
