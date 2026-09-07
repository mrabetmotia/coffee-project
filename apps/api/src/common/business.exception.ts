import { HttpStatus } from '@nestjs/common';

export class BusinessException extends Error {
  constructor(
    public readonly frenchMessage: string,
    public readonly status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly code = 'BUSINESS_ERROR',
  ) {
    super(frenchMessage);
  }
}
