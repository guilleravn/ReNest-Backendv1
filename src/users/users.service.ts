import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailAlreadyRegisteredException } from './exceptions/email-already-registered.exception.js';

export interface UserCredentials {
  id: string;
  passwordHash: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  city: string;
  phoneE164: string | null;
  isVerified: boolean;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  fullName: string;
  city: string;
  phoneE164: string | null;
}

const UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });
  }

  findProfileById(id: string): Promise<UserProfile | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        city: true,
        phoneE164: true,
        isVerified: true,
      },
    });
  }

  /**
   * Creates the account, relying on `users.email UNIQUE` rather than a prior lookup so two
   * concurrent sign-ups with the same email cannot both succeed.
   */
  async create(input: CreateUserInput): Promise<{ id: string }> {
    try {
      return await this.prisma.user.create({
        data: input,
        select: { id: true },
      });
    } catch (error) {
      // `email` is the only unique column a caller controls (`id` is generated), so any unique
      // violation here is a duplicate email.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new EmailAlreadyRegisteredException();
      }
      throw error;
    }
  }
}
