import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** The authenticated user, as attached to the request by the global JWT guard. */
export interface CurrentUserPayload {
  id: string;
}

export interface AuthenticatedRequest {
  user: CurrentUserPayload;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserPayload =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
