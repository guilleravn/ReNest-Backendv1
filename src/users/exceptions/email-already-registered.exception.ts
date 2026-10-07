import { ConflictException } from '@nestjs/common';

export class EmailAlreadyRegisteredException extends ConflictException {
  constructor() {
    super('An account with this email already exists');
  }
}
