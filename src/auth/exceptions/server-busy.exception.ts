import { ServiceUnavailableException } from '@nestjs/common';

/** Too many password hashes already running and queued; the client may retry shortly. */
export class ServerBusyException extends ServiceUnavailableException {
  constructor() {
    super('Server is busy, try again shortly');
  }
}
