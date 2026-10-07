/**
 * Limits how many async tasks run at once; extra callers wait in FIFO order, up to `maxQueue` of
 * them. A caller arriving when the queue is full is rejected at once with the error from
 * `createFullError`, without taking a permit or a queue slot. In-process only (one API instance),
 * which is all the MVP runs.
 */
export class Semaphore {
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueue: number,
    private readonly createFullError: () => Error,
  ) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new RangeError('maxConcurrent must be a positive integer');
    }
    if (!Number.isInteger(maxQueue) || maxQueue < 0) {
      throw new RangeError('maxQueue must be a non-negative integer');
    }
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running += 1;
      return;
    }
    if (this.waiting.length >= this.maxQueue) {
      throw this.createFullError();
    }
    // The releasing task hands its slot over directly, so `running` stays the same.
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
      return;
    }
    this.running -= 1;
  }
}
