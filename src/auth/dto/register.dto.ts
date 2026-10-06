import { Transform } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  normalizeEmail,
  normalizePhoneE164,
  normalizeTrimmed,
  PHONE_E164_PATTERN,
} from '../../users/user-normalizers.js';
import { USER_ZONES } from '../../users/user-zones.js';
import { MAX_EMAIL_LENGTH, MAX_PASSWORD_LENGTH } from './login.dto.js';

const MIN_FULL_NAME_LENGTH = 2;
const MAX_FULL_NAME_LENGTH = 120;
const MIN_PASSWORD_LENGTH = 8;

export class RegisterDto {
  @Transform(({ value }) => normalizeTrimmed(value))
  @IsString()
  @Length(MIN_FULL_NAME_LENGTH, MAX_FULL_NAME_LENGTH)
  fullName: string;

  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  @MaxLength(MAX_EMAIL_LENGTH)
  email: string;

  @IsIn(USER_ZONES)
  city: string;

  // Omitted, null or "" → no phone (stored as NULL).
  @Transform(({ value }) => normalizePhoneE164(value))
  @IsOptional()
  @IsString()
  @Matches(PHONE_E164_PATTERN, {
    message:
      'phoneE164 must be a phone number in E.164 format (e.g. +5215512345678)',
  })
  phoneE164?: string | null;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH)
  password: string;

  @Equals(true)
  acceptedTerms: boolean;
}
