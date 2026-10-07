export class AccessTokenResponseDto {
  accessToken: string;
  /** ISO 8601 UTC, taken from the token's `exp` claim. */
  expiresAt: string;
}
