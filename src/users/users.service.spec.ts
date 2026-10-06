import { Test } from '@nestjs/testing';

import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailAlreadyRegisteredException } from './exceptions/email-already-registered.exception.js';
import { UsersService } from './users.service.js';

const INPUT = {
  email: 'lucia@renest.test',
  passwordHash: '$argon2id$v=19$m=65536,p=4,t=3$c2FsdA$aGFzaA',
  fullName: 'Lucía Méndez',
  city: 'Condesa, CDMX',
  phoneE164: null,
};

// The real unique constraint is covered by test/auth.e2e-spec.ts against the real database.
describe('UsersService', () => {
  let usersService: UsersService;
  const prisma = { user: { create: vi.fn(), findUnique: vi.fn() } };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    usersService = moduleRef.get(UsersService);
  });

  describe('findCredentialsByEmail', () => {
    it('selects only the id and password hash of the user with that email', async () => {
      const credentials = { id: 'user-id', passwordHash: INPUT.passwordHash };
      prisma.user.findUnique.mockResolvedValue(credentials);

      await expect(
        usersService.findCredentialsByEmail('lucia@renest.test'),
      ).resolves.toEqual(credentials);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'lucia@renest.test' },
        select: { id: true, passwordHash: true },
      });
    });

    it('returns null when no user has that email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        usersService.findCredentialsByEmail('nobody@renest.test'),
      ).resolves.toBeNull();
    });
  });

  describe('findProfileById', () => {
    it('selects the public profile fields and never the password hash', async () => {
      const profile = {
        id: 'user-id',
        email: 'lucia@renest.test',
        fullName: 'Lucía Méndez',
        city: 'Condesa, CDMX',
        phoneE164: null,
        isVerified: false,
      };
      prisma.user.findUnique.mockResolvedValue(profile);

      await expect(usersService.findProfileById('user-id')).resolves.toEqual(
        profile,
      );
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        select: {
          id: true,
          email: true,
          fullName: true,
          city: true,
          phoneE164: true,
          isVerified: true,
        },
      });
    });

    it('returns null when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(usersService.findProfileById('user-id')).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('creates the user and returns only its id', async () => {
      prisma.user.create.mockResolvedValue({ id: 'user-id' });

      await expect(usersService.create(INPUT)).resolves.toEqual({
        id: 'user-id',
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: INPUT,
        select: { id: true },
      });
    });

    it('throws EmailAlreadyRegisteredException when the email is already taken (P2002)', async () => {
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: Prisma.prismaVersion.client,
        }),
      );

      await expect(usersService.create(INPUT)).rejects.toThrow(
        EmailAlreadyRegisteredException,
      );
    });

    it('rethrows any other error unchanged', async () => {
      const error = new Error('connection lost');
      prisma.user.create.mockRejectedValue(error);

      await expect(usersService.create(INPUT)).rejects.toBe(error);
    });
  });
});
