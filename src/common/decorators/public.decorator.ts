import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route (or controller) out of the global JWT guard. Every other route needs a token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
