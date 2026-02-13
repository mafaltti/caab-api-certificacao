let chain = Promise.resolve();

async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const result = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  chain = chain.then(async () => {
    try {
      resolve(await fn());
    } catch (err) {
      reject(err);
    }
  });

  return result;
}

export { withWriteLock };
