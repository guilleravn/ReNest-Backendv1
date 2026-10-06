import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { UsersService } from '../users/users.service.js';
import { AccessTokenResponseDto } from './dto/access-token-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UserProfileResponseDto } from './dto/user-profile-response.dto.js';
import { InvalidCredentialsException } from './exceptions/invalid-credentials.exception.js';

export interface AccessTokenPayload {
  sub: string;
  exp: number;
}

const MS_PER_SECOND = 1000;

// argon2id hash of a random string nobody knows, made with the same parameters as real hashes.
// Verified against when the email is unknown, so the response time does not reveal which emails
// have an account.
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$lTkX9nc8QUgZV60A9eNmyw$2t1cWD2Lib/FLJxQD0HaHXDwu/gtTPQodzOG+2akF6c';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login({ email, password }: LoginDto): Promise<AccessTokenResponseDto> {
    const credentials = await this.usersService.findCredentialsByEmail(email);
    if (!credentials) {
      await argon2.verify(DUMMY_PASSWORD_HASH, password);
      throw new InvalidCredentialsException();
    }

    const isPasswordValid = await argon2.verify(
      credentials.passwordHash,
      password,
    );
    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    return this.issueToken(credentials.id);
  }

  async register(dto: RegisterDto): Promise<AccessTokenResponseDto> {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const { id } = await this.usersService.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      city: dto.city,
      phoneE164: dto.phoneE164 ?? null,
      termsAcceptedAt: new Date(),
    });
    this.logger.log(`User ${id} registered`);

    return this.issueToken(id);
  }

  async issueToken(userId: string): Promise<AccessTokenResponseDto> {
    const accessToken = await this.jwtService.signAsync({ sub: userId });
    const { exp } = this.jwtService.decode<AccessTokenPayload>(accessToken);

    return {
      accessToken,
      expiresAt: new Date(exp * MS_PER_SECOND).toISOString(),
    };
  }

  async me(userId: string): Promise<UserProfileResponseDto> {
    const profile = await this.usersService.findProfileById(userId);
    if (!profile) {
      // A still-valid token for an account that no longer exists.
      throw new UnauthorizedException();
    }
    return profile;
  }
}
