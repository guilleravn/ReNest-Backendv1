// Input normalizers shared by the auth DTOs (via class-transformer `@Transform`) and the
// credentials throttler. They run before validation, so they accept `unknown` and leave values
// they cannot normalize untouched for the validators to reject.

export const PHONE_E164_PATTERN = /^\+[1-9]\d{7,14}$/;

// Separators people type in phone numbers: spaces, hyphens, dots and parentheses.
const PHONE_SEPARATORS = /[\s\-.()]/g;

export function normalizeEmail(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export function normalizeTrimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Strips separators; `null`, `undefined` and an empty result become `null` (no phone). */
export function normalizePhoneE164(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const digits = value.replace(PHONE_SEPARATORS, '');
  return digits === '' ? null : digits;
}
