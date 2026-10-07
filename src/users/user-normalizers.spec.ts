import {
  normalizeEmail,
  normalizePhoneE164,
  normalizeTrimmed,
  PHONE_E164_PATTERN,
} from './user-normalizers.js';

describe('normalizePhoneE164', () => {
  it('removes spaces, hyphens, dots and parentheses', () => {
    expect(normalizePhoneE164(' +52 (55) 1234-56.78 ')).toBe('+525512345678');
  });

  it('returns null when the value is undefined, null or empty', () => {
    expect(normalizePhoneE164(undefined)).toBeNull();
    expect(normalizePhoneE164(null)).toBeNull();
    expect(normalizePhoneE164('')).toBeNull();
    expect(normalizePhoneE164(' - ')).toBeNull();
  });

  it('leaves non-string values untouched for the validators to reject', () => {
    expect(normalizePhoneE164(5512345678)).toBe(5512345678);
  });
});

describe('PHONE_E164_PATTERN', () => {
  it.each(['+525512345678', '+14155550123', '+12345678'])(
    'accepts %s',
    (phone) => {
      expect(PHONE_E164_PATTERN.test(phone)).toBe(true);
    },
  );

  it.each([
    '525512345678', // no plus sign
    '+05512345678', // country code starting with 0
    '+1234567', // too short
    '+1234567890123456', // too long
    '+52abc12345678',
  ])('rejects %s', (phone) => {
    expect(PHONE_E164_PATTERN.test(phone)).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases a string', () => {
    expect(normalizeEmail('  Camila@ReNest.TEST ')).toBe('camila@renest.test');
  });

  it('leaves non-string values untouched', () => {
    expect(normalizeEmail(42)).toBe(42);
  });
});

describe('normalizeTrimmed', () => {
  it('trims a string without changing its case', () => {
    expect(normalizeTrimmed('  Lucía Méndez \n')).toBe('Lucía Méndez');
  });

  it('leaves non-string values untouched', () => {
    expect(normalizeTrimmed(42)).toBe(42);
    expect(normalizeTrimmed(null)).toBeNull();
  });
});
