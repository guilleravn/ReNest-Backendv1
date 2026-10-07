import { Semaphore } from './semaphore.js';

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

const deferred = (): Deferred => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

class QueueFullError extends Error {}
const fullError = () => new QueueFullError('full');

// Lets queued microtasks (acquire/release hand-offs) settle.
const flush = () => new Promise<void>((done) => setImmediate(done));

describe('Semaphore', () => {
  describe('run', () => {
    it('runs at most maxConcurrent tasks at once and queues the rest', async () => {
      const semaphore = new Semaphore(2, 100, fullError);
      const gates = [deferred(), deferred(), deferred(), deferred()];
      const started: number[] = [];

      const runs = gates.map((gate, index) =>
        semaphore.run(async () => {
          started.push(index);
          await gate.promise;
          return index;
        }),
      );
      await flush();
      expect(started).toEqual([0, 1]);

      gates[1].resolve();
      await flush();
      expect(started).toEqual([0, 1, 2]);

      gates[0].resolve();
      gates[2].resolve();
      gates[3].resolve();
      await expect(Promise.all(runs)).resolves.toEqual([0, 1, 2, 3]);
      expect(started).toEqual([0, 1, 2, 3]);
    });

    it('starts queued tasks in FIFO order', async () => {
      const semaphore = new Semaphore(1, 100, fullError);
      const gate = deferred();
      const order: string[] = [];

      const first = semaphore.run(() => gate.promise);
      const queued = ['a', 'b', 'c'].map((name) =>
        semaphore.run(async () => {
          order.push(name);
        }),
      );
      gate.resolve();
      await Promise.all([first, ...queued]);

      expect(order).toEqual(['a', 'b', 'c']);
    });

    it('frees the slot when a task rejects and propagates the error', async () => {
      const semaphore = new Semaphore(1, 100, fullError);
      const error = new Error('boom');

      await expect(semaphore.run(() => Promise.reject(error))).rejects.toBe(
        error,
      );
      await expect(semaphore.run(() => Promise.resolve('next'))).resolves.toBe(
        'next',
      );
    });

    it('never exceeds the limit under a burst of tasks', async () => {
      const semaphore = new Semaphore(3, 100, fullError);
      let active = 0;
      let maxActive = 0;

      await Promise.all(
        Array.from({ length: 20 }, () =>
          semaphore.run(async () => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            await flush();
            active -= 1;
          }),
        ),
      );

      expect(maxActive).toBe(3);
    });
  });

  describe('bounded queue', () => {
    it('rejects immediately with the given error when the queue is full', async () => {
      const semaphore = new Semaphore(1, 2, fullError);
      const gate = deferred();
      const task = vi.fn(() => gate.promise);

      const running = semaphore.run(task);
      const queued = [semaphore.run(task), semaphore.run(task)];
      await flush();
      expect(task).toHaveBeenCalledTimes(1);

      await expect(semaphore.run(task)).rejects.toBeInstanceOf(QueueFullError);
      expect(task).toHaveBeenCalledTimes(1);

      gate.resolve();
      await Promise.all([running, ...queued]);
      expect(task).toHaveBeenCalledTimes(3);
    });

    it('rejects every caller that cannot run at once when maxQueue is 0', async () => {
      const semaphore = new Semaphore(1, 0, fullError);
      const gate = deferred();

      const running = semaphore.run(() => gate.promise);

      await expect(
        semaphore.run(() => Promise.resolve()),
      ).rejects.toBeInstanceOf(QueueFullError);
      gate.resolve();
      await running;
    });

    it('does not leak permits or queue slots after rejections', async () => {
      const semaphore = new Semaphore(1, 1, fullError);
      const gate = deferred();

      const running = semaphore.run(() => gate.promise);
      const queued = semaphore.run(() => Promise.resolve('queued'));
      for (let i = 0; i < 5; i += 1) {
        await expect(
          semaphore.run(() => Promise.resolve()),
        ).rejects.toBeInstanceOf(QueueFullError);
      }
      gate.resolve();
      await running;
      await expect(queued).resolves.toBe('queued');

      // Fully drained: the permit and the single queue slot are both available again.
      const gate2 = deferred();
      const again = semaphore.run(() => gate2.promise);
      const againQueued = semaphore.run(() => Promise.resolve('ok'));
      await expect(
        semaphore.run(() => Promise.resolve()),
      ).rejects.toBeInstanceOf(QueueFullError);
      gate2.resolve();
      await again;
      await expect(againQueued).resolves.toBe('ok');
    });

    it('frees queue slots as waiters start, so new callers can queue again', async () => {
      const semaphore = new Semaphore(1, 1, fullError);
      const gate = deferred();

      const running = semaphore.run(() => gate.promise);
      const first = semaphore.run(() => Promise.resolve(1));
      gate.resolve();
      await Promise.all([running, first]);

      await expect(semaphore.run(() => Promise.resolve(2))).resolves.toBe(2);
    });
  });

  it.each([-1, 1.5, Number.NaN])(
    'throws RangeError when maxQueue is %s',
    (value) => {
      expect(() => new Semaphore(1, value, fullError)).toThrow(RangeError);
    },
  );

  it.each([0, -1, 1.5, Number.NaN])(
    'throws RangeError when maxConcurrent is %s',
    (value) => {
      expect(() => new Semaphore(value, 1, fullError)).toThrow(RangeError);
    },
  );
});
