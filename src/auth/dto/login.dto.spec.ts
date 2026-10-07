import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { LoginDto } from './login.dto.js';

const toDto = (body: Record<string, unknown>) =>
  plainToInstance(LoginDto, body);

const failedProperties = async (body: Record<string, unknown>) =>
  (await validate(toDto(body))).map((error) => error.property);

describe('LoginDto', () => {
  it('trims and lowercases the email when the body is valid', async () => {
    const dto = toDto({ email: '  Camila@ReNest.TEST ', password: 'secret' });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto).toEqual({ email: 'camila@renest.test', password: 'secret' });
  });

  it('keeps the password exactly as sent', async () => {
    const dto = toDto({ email: 'a@b.test', password: '  Pass word  ' });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.password).toBe('  Pass word  ');
  });

  it.each([
    ['not an email', 'not-an-email'],
    ['empty after trimming', '   '],
    ['not a string', 42],
    ['longer than 255 characters', `${'a'.repeat(60)}@${'b'.repeat(200)}.test`],
  ])('rejects an email that is %s', async (_case, email) => {
    await expect(
      failedProperties({ email, password: 'secret' }),
    ).resolves.toEqual(['email']);
  });

  it.each([
    ['empty', ''],
    ['not a string', 12345678],
    ['longer than 128 characters', 'x'.repeat(129)],
  ])('rejects a password that is %s', async (_case, password) => {
    await expect(
      failedProperties({ email: 'a@b.test', password }),
    ).resolves.toEqual(['password']);
  });

  it('accepts a password of exactly 128 characters', async () => {
    await expect(
      failedProperties({ email: 'a@b.test', password: 'x'.repeat(128) }),
    ).resolves.toEqual([]);
  });
});
