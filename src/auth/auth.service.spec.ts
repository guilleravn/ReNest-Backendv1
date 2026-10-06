import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';

import { EmailAlreadyRegisteredException } from '../users/exceptions/email-already-registered.exception.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { InvalidCredentialsException } from './exceptions/invalid-credentials.exception.js';

const JWT_SECRET = 'unit-test-secret-at-least-32-characters-long';
const USER_ID = '0199b2a4-7c4e-7000-8000-000000000001';
const PASSWORD = 'correct-horse-battery';
const NOW = new Date('2026-10-06T12:00:00.000Z');
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const INVALID_CREDENTIALS_BODY = {
  statusCode: 401,
  message: 'Invalid email or password',
  error: 'Unauthorized',
};

// Real argon2, with `verify` wrapped in a spy so the unknown-email path can be observed (ESM
// namespaces cannot be spied on directly).
vi.mock('argon2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('argon2')>();
  return { ...actual, verify: vi.fn(actual.verify) };
});

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let passwordHash: string;
  const usersService = {
    findCredentialsByEmail: vi.fn<UsersService['findCredentialsByEmail']>(),
    findProfileById: vi.fn<UsersService['findProfileById']>(),
    create: vi.fn<UsersService['create']>(),
  };

  beforeAll(async () => {
    passwordHash = await argon2.hash(PASSWORD);
  });

  beforeEach(async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    vi.resetAllMocks();
    const actual = await vi.importActual<typeof import('argon2')>('argon2');
    vi.mocked(argon2.verify).mockImplementation(actual.verify);
    jwtService = new JwtService({
      secret: JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();
    authService = moduleRef.get(AuthService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('login', () => {
    it('returns a token for the user and its expiry when the password is correct', async () => {
      usersService.findCredentialsByEmail.mockResolvedValue({
        id: USER_ID,
        passwordHash,
      });

      const result = await authService.login({
        email: 'camila@renest.test',
        password: PASSWORD,
      });

      expect(usersService.findCredentialsByEmail).toHaveBeenCalledWith(
        'camila@renest.test',
      );
      expect(result.expiresAt).toBe(
        new Date(NOW.getTime() + SEVEN_DAYS_MS).toISOString(),
      );
      await expect(
        jwtService.verifyAsync(result.accessToken),
      ).resolves.toMatchObject({ sub: USER_ID });
    });

    it('throws InvalidCredentialsException when the password is wrong', async () => {
      usersService.findCredentialsByEmail.mockResolvedValue({
        id: USER_ID,
        passwordHash,
      });

      const error = await authService
        .login({ email: 'camila@renest.test', password: 'wrong-password' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(InvalidCredentialsException);
      expect((error as InvalidCredentialsException).getResponse()).toEqual(
        INVALID_CREDENTIALS_BODY,
      );
    });

    it('throws the same error as a wrong password when the email is unknown', async () => {
      usersService.findCredentialsByEmail.mockResolvedValue(null);

      const error = await authService
        .login({ email: 'nobody@renest.test', password: PASSWORD })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(InvalidCredentialsException);
      expect((error as InvalidCredentialsException).getResponse()).toEqual(
        INVALID_CREDENTIALS_BODY,
      );
      // Still verifies against an argon2id hash, so an unknown email takes as long as a wrong
      // password.
      expect(argon2.verify).toHaveBeenCalledTimes(1);
      expect(argon2.verify).toHaveBeenCalledWith(
        expect.stringMatching(/^\$argon2id\$/),
        PASSWORD,
      );
    });
  });

  describe('register', () => {
    const dto = (): RegisterDto =>
      Object.assign(new RegisterDto(), {
        fullName: 'Lucía Méndez',
        email: 'lucia@renest.test',
        city: 'Condesa, CDMX',
        phoneE164: undefined,
        password: PASSWORD,
        acceptedTerms: true,
      });

    it('creates the user with an argon2id hash and returns a token for it', async () => {
      usersService.create.mockResolvedValue({ id: USER_ID });

      const result = await authService.register(dto());

      expect(usersService.create).toHaveBeenCalledWith({
        email: 'lucia@renest.test',
        passwordHash: expect.stringMatching(/^\$argon2id\$/),
        fullName: 'Lucía Méndez',
        city: 'Condesa, CDMX',
        phoneE164: null,
        termsAcceptedAt: NOW,
      });
      const { passwordHash: storedHash } = usersService.create.mock.calls[0][0];
      await expect(argon2.verify(storedHash, PASSWORD)).resolves.toBe(true);
      await expect(
        jwtService.verifyAsync(result.accessToken),
      ).resolves.toMatchObject({ sub: USER_ID });
      expect(result.expiresAt).toBe(
        new Date(NOW.getTime() + SEVEN_DAYS_MS).toISOString(),
      );
    });

    it('stores the phone when one is given', async () => {
      usersService.create.mockResolvedValue({ id: USER_ID });

      await authService.register(
        Object.assign(dto(), { phoneE164: '+5215512345678' }),
      );

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ phoneE164: '+5215512345678' }),
      );
    });

    it('propagates EmailAlreadyRegisteredException when the email is taken', async () => {
      usersService.create.mockRejectedValue(
        new EmailAlreadyRegisteredException(),
      );

      await expect(authService.register(dto())).rejects.toThrow(
        EmailAlreadyRegisteredException,
      );
    });
  });

  describe('me', () => {
    it('returns the profile of the current user', async () => {
      const profile = {
        id: USER_ID,
        email: 'camila@renest.test',
        fullName: 'Camila Torres',
        city: 'Roma Norte, CDMX',
        phoneE164: null,
        isVerified: false,
      };
      usersService.findProfileById.mockResolvedValue(profile);

      await expect(authService.me(USER_ID)).resolves.toEqual(profile);
      expect(usersService.findProfileById).toHaveBeenCalledWith(USER_ID);
    });

    it('throws UnauthorizedException when the user no longer exists', async () => {
      usersService.findProfileById.mockResolvedValue(null);

      await expect(authService.me(USER_ID)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
