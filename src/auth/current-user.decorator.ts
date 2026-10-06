import { createParamDecorator } from '@nestjs/common';

/**
 * Temporary stand-in for the `@CurrentUser()` boundary defined in docs/rules/security.md, until
 * BO-39 (email + password login, JWT) lands. There is no session yet, and security.md forbids a
 * fake/switchable "current user": every request acts as this one seeded seller (see
 * prisma/seed.ts). Listed in docs/known-deviations.md.
 *
 * Consumers only use `@CurrentUser()` and `CurrentUserPayload`. BO-39 replaces the body of the
 * decorator (read the user the global JWT guard attached to the request) without any consumer
 * changing.
 */
export const SEEDED_SELLER_ID = '018f6e5c-0000-7000-8000-000000000001';

export interface CurrentUserPayload {
  id: string;
}

export const CurrentUser = createParamDecorator((): CurrentUserPayload => ({
  id: SEEDED_SELLER_ID,
}));
