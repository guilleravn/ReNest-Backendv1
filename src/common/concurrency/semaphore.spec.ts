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

// Lets queued microtasks (acquire/release hand-offs) settle.
const flush = () => new Promise<void>((done) => setImmediate(done));

describe('Semaphore', () => {
  describe('run', () => {
    it('runs at most maxConcurrent tasks at once and queues the rest', async () => {
      const semaphore = new Semaphore(2);
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
      const semaphore = new Semaphore(1);
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
      const semaphore = new Semaphore(1);
      const error = new Error('boom');

      await expect(semaphore.run(() => Promise.reject(error))).rejects.toBe(
        error,
      );
      await expect(semaphore.run(() => Promise.resolve('next'))).resolves.toBe(
        'next',
      );
    });

    it('never exceeds the limit under a burst of tasks', async () => {
      const semaphore = new Semaphore(3);
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

  it.each([0, -1, 1.5, Number.NaN])(
    'throws RangeError when maxConcurrent is %s',
    (value) => {
      expect(() => new Semaphore(value)).toThrow(RangeError);
    },
  );
});
