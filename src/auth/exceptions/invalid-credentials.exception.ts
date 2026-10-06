import { UnauthorizedException } from '@nestjs/common';

/** Same message for an unknown email and a wrong password, so login does not reveal accounts. */
export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super('Invalid email or password');
  }
}
