import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterDto } from './register.dto.js';

const validBody = () => ({
  fullName: '  Lucía Méndez ',
  email: ' Lucia@ReNest.TEST ',
  city: 'Condesa, CDMX',
  phoneE164: '+52 (55) 1234-5678',
  password: 'correct-horse',
});

const toDto = (body: Record<string, unknown>) =>
  plainToInstance(RegisterDto, body);

const failedProperties = async (body: Record<string, unknown>) =>
  (await validate(toDto(body))).map((error) => error.property);

describe('RegisterDto', () => {
  it('normalizes name, email and phone when the body is valid', async () => {
    const dto = toDto(validBody());

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto).toMatchObject({
      fullName: 'Lucía Méndez',
      email: 'lucia@renest.test',
      phoneE164: '+525512345678',
    });
  });

  it.each([undefined, null, ''])(
    'accepts no phone when phoneE164 is %j',
    async (phoneE164) => {
      const body: Record<string, unknown> = { ...validBody(), phoneE164 };
      if (phoneE164 === undefined) {
        delete body['phoneE164'];
      }
      const dto = toDto(body);

      await expect(validate(dto)).resolves.toEqual([]);
      expect(dto.phoneE164 ?? null).toBeNull();
    },
  );

  it('rejects a phone that is not E.164 after normalization', async () => {
    await expect(
      failedProperties({ ...validBody(), phoneE164: '55 1234 5678' }),
    ).resolves.toEqual(['phoneE164']);
  });

  it('rejects a city outside the zones list', async () => {
    await expect(
      failedProperties({ ...validBody(), city: 'Ciudad de México' }),
    ).resolves.toEqual(['city']);
  });

  it('rejects a password shorter than 8 characters', async () => {
    await expect(
      failedProperties({ ...validBody(), password: 'short' }),
    ).resolves.toEqual(['password']);
  });

  it('rejects a full name shorter than 2 characters after trimming', async () => {
    await expect(
      failedProperties({ ...validBody(), fullName: ' A ' }),
    ).resolves.toEqual(['fullName']);
  });
});
