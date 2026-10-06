// Auth endpoints against the real app and Postgres. Every test uses its own email, so the
// per-email login/sign-up throttle (5 req / 60 s) never trips across tests.
import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const EMAIL_DOMAIN = 'auth-e2e.renest.test';
const PASSWORD = 'correct-horse-battery';
const INVALID_CREDENTIALS = {
  statusCode: 401,
  message: 'Invalid email or password',
  error: 'Unauthorized',
};

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const uniqueEmail = (): string => `user-${randomUUID()}@${EMAIL_DOMAIN}`;

  const registerBody = (email: string) => ({
    fullName: 'Lucía Méndez',
    email,
    city: 'Condesa, CDMX',
    phoneE164: '+52 55 1234 5678',
    password: PASSWORD,
    acceptedTerms: true,
  });

  const register = (email: string) =>
    request(app.getHttpServer())
      .post('/auth/register')
      .send(registerBody(email));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: `@${EMAIL_DOMAIN}` } },
    });
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('returns 201 with a token that GET /auth/me accepts', async () => {
      const email = uniqueEmail();

      const response = await register(email).expect(201);

      expect(response.body).toEqual({
        accessToken: expect.any(String),
        expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      });
      const me = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(200);
      expect(me.body).toEqual({
        id: expect.any(String),
        email,
        fullName: 'Lucía Méndez',
        city: 'Condesa, CDMX',
        phoneE164: '+525512345678',
        isVerified: false,
      });
    });

    it('stores an argon2id hash, the terms acceptance time and no verification', async () => {
      const email = uniqueEmail();

      await register(email).expect(201);

      const user = await prisma.user.findUniqueOrThrow({
        where: { email },
        select: {
          passwordHash: true,
          termsAcceptedAt: true,
          isVerified: true,
          verifiedAt: true,
        },
      });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.termsAcceptedAt).toBeInstanceOf(Date);
      expect(user).toMatchObject({ isVerified: false, verifiedAt: null });
    });

    it('returns 409 when the email is already registered, whatever its case', async () => {
      const email = uniqueEmail();
      await register(email).expect(201);

      const response = await register(` ${email.toUpperCase()} `).expect(409);

      expect(response.body).toEqual({
        statusCode: 409,
        message: 'An account with this email already exists',
        error: 'Conflict',
      });
    });

    it('returns 409 for one of two concurrent sign-ups with the same email', async () => {
      const email = uniqueEmail();

      const statuses = (
        await Promise.all([register(email), register(email)])
      ).map((response) => response.status);

      expect(statuses.sort((a, b) => a - b)).toEqual([201, 409]);
    });

    it('stores no phone when phoneE164 is an empty string', async () => {
      const email = uniqueEmail();

      const { body } = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...registerBody(email), phoneE164: '' })
        .expect(201);

      const me = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
      expect(me.body.phoneE164).toBeNull();
    });

    it('returns 400 when the city is not one of the zones', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...registerBody(uniqueEmail()), city: 'Ciudad de México' })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: [expect.stringContaining('city')],
      });
    });

    it('returns 400 when the terms are not accepted', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...registerBody(uniqueEmail()), acceptedTerms: false })
        .expect(400);
    });

    it('returns 400 when the body has an unknown field', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...registerBody(uniqueEmail()), isVerified: true })
        .expect(400);
    });

    it.each([
      ['id', randomUUID()],
      ['passwordHash', '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA'],
      ['verifiedAt', '2026-10-01T00:00:00.000Z'],
      ['termsAcceptedAt', '2020-01-01T00:00:00.000Z'],
    ])(
      'returns 400 and creates no account when the body sets %s',
      async (field, value) => {
        const email = uniqueEmail();

        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send({ ...registerBody(email), [field]: value })
          .expect(400);

        expect(response.body.message).toEqual([
          `property ${field} should not exist`,
        ]);
        await expect(prisma.user.count({ where: { email } })).resolves.toBe(0);
      },
    );

    it('stores the email trimmed and lowercased, so login with the clean email works', async () => {
      const email = uniqueEmail();

      await register(`  ${email.toUpperCase()} `).expect(201);

      await expect(prisma.user.count({ where: { email } })).resolves.toBe(1);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
    });

    it('stores the full name trimmed and no phone when phoneE164 is null', async () => {
      const email = uniqueEmail();

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...registerBody(email),
          fullName: '   Lucía Méndez  ',
          phoneE164: null,
        })
        .expect(201);

      await expect(
        prisma.user.findUniqueOrThrow({
          where: { email },
          select: { fullName: true, phoneE164: true },
        }),
      ).resolves.toEqual({ fullName: 'Lucía Méndez', phoneE164: null });
    });

    it('returns 201 when phoneE164 is omitted', async () => {
      const { phoneE164: _omitted, ...body } = registerBody(uniqueEmail());

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(body)
        .expect(201);
    });

    it.each([
      ['fullName', 'A'],
      ['fullName', '    '],
      ['fullName', 'x'.repeat(121)],
      ['email', 'not-an-email'],
      ['email', `${'a'.repeat(250)}@x.test`],
      ['phoneE164', '55 1234 5678'],
      ['phoneE164', '+52 55 abcd 5678'],
      ['password', 'short'],
      ['password', 'x'.repeat(129)],
      ['acceptedTerms', 'true'],
      ['city', 'condesa, cdmx'],
    ])('returns 400 when %s is %j', async (field, value) => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...registerBody(uniqueEmail()), [field]: value })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: expect.arrayContaining([expect.stringContaining(field)]),
      });
    });

    it.each(['fullName', 'email', 'city', 'phoneE164', 'password'])(
      'returns 400 (not 500) when %s is not a string',
      async (field) => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({ ...registerBody(uniqueEmail()), [field]: 12345678 })
          .expect(400);
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({ ...registerBody(uniqueEmail()), [field]: { $ne: '' } })
          .expect(400);
      },
    );

    it('returns 400 (not 500) when the body is a JSON array', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send([registerBody(uniqueEmail())])
        .expect(400);
    });

    it('returns 429 after 5 sign-ups for the same email within a minute', async () => {
      const email = uniqueEmail();

      await register(email).expect(201);
      for (let i = 0; i < 4; i += 1) {
        await register(email).expect(409);
      }
      await register(` ${email.toUpperCase()}`).expect(429);
    });
  });

  describe('POST /auth/login', () => {
    it('returns 200 with a token when the credentials are correct', async () => {
      const email = uniqueEmail();
      await register(email).expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ` ${email.toUpperCase()} `, password: PASSWORD })
        .expect(200);

      expect(response.body).toEqual({
        accessToken: expect.any(String),
        expiresAt: expect.any(String),
      });
      const payload = app
        .get(JwtService)
        .decode<{ sub: string; exp: number }>(response.body.accessToken);
      expect(response.body.expiresAt).toBe(
        new Date(payload.exp * 1000).toISOString(),
      );
    });

    it('returns 401 when the password is wrong', async () => {
      const email = uniqueEmail();
      await register(email).expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);

      expect(response.body).toEqual(INVALID_CREDENTIALS);
    });

    it('returns the same 401 when the email is not registered', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: uniqueEmail(), password: PASSWORD })
        .expect(401);

      expect(response.body).toEqual(INVALID_CREDENTIALS);
    });

    it('returns 400 when the email is not valid', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: PASSWORD })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: [expect.stringContaining('email')],
      });
    });

    it('returns 429 after 5 attempts for the same email within a minute', async () => {
      const email = uniqueEmail();
      const attempt = () =>
        request(app.getHttpServer())
          .post('/auth/login')
          .send({ email, password: 'wrong-password' });

      for (let i = 0; i < 5; i += 1) {
        await attempt().expect(401);
      }
      await attempt().expect(429);

      // Another email from the same IP is not affected.
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: uniqueEmail(), password: PASSWORD })
        .expect(401);
    });

    it('counts case and whitespace variants of an email as the same throttle key', async () => {
      const email = uniqueEmail();
      const variants = [
        email,
        email.toUpperCase(),
        ` ${email}`,
        `${email} `,
        `  ${email.toUpperCase()}  `,
      ];

      for (const variant of variants) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: variant, password: 'wrong-password' })
          .expect(401);
      }
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(429);
    });

    // Requests without a usable email share one per-IP throttle bucket: this table's email cases
    // plus the "missing or not an object" test below make exactly 5, the limit. Add more such
    // requests to this route and they start getting 429.
    it.each([
      ['email', 12345],
      ['email', ['a@b.test']],
      ['password', ''],
      ['password', 12345678],
      ['password', 'x'.repeat(129)],
    ])('returns 400 (not 500) when %s is %j', async (field, value) => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: uniqueEmail(), password: PASSWORD, [field]: value })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.arrayContaining([expect.stringContaining(field)]),
      });
    });

    it('returns 400 when the body has an unknown field', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: uniqueEmail(), password: PASSWORD, remember: true })
        .expect(400);
    });

    it('returns 400 (not 500) when the body is missing or not an object', async () => {
      await request(app.getHttpServer()).post('/auth/login').expect(400);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(['a@b.test', PASSWORD])
        .expect(400);
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Content-Type', 'text/plain')
        .send('email=a@b.test')
        .expect(400);
    });

    it('never returns the password hash or user fields', async () => {
      const email = uniqueEmail();
      await register(email).expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);

      expect(Object.keys(response.body).sort()).toEqual([
        'accessToken',
        'expiresAt',
      ]);
      const payload = app
        .get(JwtService)
        .decode<Record<string, unknown>>(response.body.accessToken);
      expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
    });
  });

  describe('GET /auth/me', () => {
    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('returns 401 with a malformed token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
    });

    it('returns 401 with a token signed with another secret', async () => {
      const forged = new JwtService({
        secret: 'another-secret-that-is-at-least-32-chars',
      }).sign({ sub: randomUUID() });

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });

    it('returns 401 with an expired token', async () => {
      const expired = await app
        .get(JwtService)
        .signAsync({ sub: randomUUID() }, { expiresIn: '-1s' });

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
    });

    it('returns 401 when the user of a valid token no longer exists', async () => {
      const token = await app.get(JwtService).signAsync({ sub: randomUUID() });

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('returns 401 after the account behind a token is deleted', async () => {
      const email = uniqueEmail();
      const { body } = await register(email).expect(201);
      await prisma.user.delete({ where: { email } });

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(401);
    });

    it('returns 401 with an unsigned token (alg none)', async () => {
      const email = uniqueEmail();
      const { body } = await register(email).expect(201);
      const [, payload] = (body.accessToken as string).split('.');
      const header = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' }),
      ).toString('base64url');

      for (const unsigned of [
        `${header}.${payload}.`,
        `${header}.${payload}`,
      ]) {
        await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${unsigned}`)
          .expect(401);
      }
    });

    it('returns 401 with a validly signed token that has no sub', async () => {
      const token = await app.get(JwtService).signAsync({ userId: 'x' });

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('returns 401 with a validly signed token whose sub is not a user id', async () => {
      const token = await app.get(JwtService).signAsync({ sub: 'not-a-uuid' });

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('returns 401 when the scheme is not Bearer', async () => {
      const { body } = await register(uniqueEmail()).expect(201);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Basic ${body.accessToken}`)
        .expect(401);
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer ')
        .expect(401);
    });

    it('returns exactly the profile fields, without the password hash', async () => {
      const { body } = await register(uniqueEmail()).expect(201);

      const me = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);

      expect(Object.keys(me.body).sort()).toEqual([
        'city',
        'email',
        'fullName',
        'id',
        'isVerified',
        'phoneE164',
      ]);
    });
  });

  describe('Public routes', () => {
    it('serves GET / without a token', async () => {
      await request(app.getHttpServer()).get('/').expect(200);
    });
  });
});
