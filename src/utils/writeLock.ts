import { AppError } from "./errors.js";

const LOCK_TIMEOUT_MS = 30_000;

interface WriteLock {
  withWriteLock<T>(fn: () => Promise<T>): Promise<T>;
}

function createWriteLock(): WriteLock {
  let chain = Promise.resolve();

  return {
    withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
      let resolve!: (value: T) => void;
      let reject!: (reason: unknown) => void;

      const result = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      chain = chain.then(async () => {
        const timeout = setTimeout(() => {
          reject(new AppError("Write operation timed out", 503));
        }, LOCK_TIMEOUT_MS);

        try {
          resolve(await fn());
        } catch (err) {
          reject(err);
        } finally {
          clearTimeout(timeout);
        }
      });

      return result;
    },
  };
}

// Per-resource lock instances
const ordersWriteLock = createWriteLock();
const ticketsWriteLock = createWriteLock();

export { createWriteLock, ordersWriteLock, ticketsWriteLock };
