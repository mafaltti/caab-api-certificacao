import { describe, it, expect } from "vitest";
import { createWriteLock } from "../utils/writeLock.js";

describe("createWriteLock", () => {
  it("serializes concurrent writes", async () => {
    const lock = createWriteLock();
    const order: number[] = [];

    const p1 = lock.withWriteLock(async () => {
      await new Promise((r) => setTimeout(r, 50));
      order.push(1);
      return "first";
    });

    const p2 = lock.withWriteLock(async () => {
      order.push(2);
      return "second";
    });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe("first");
    expect(r2).toBe("second");
    expect(order).toEqual([1, 2]);
  });

  it("propagates errors without breaking the chain", async () => {
    const lock = createWriteLock();

    const p1 = lock.withWriteLock(async () => {
      throw new Error("fail");
    });

    await expect(p1).rejects.toThrow("fail");

    // Next operation should still work
    const p2 = lock.withWriteLock(async () => "ok");
    await expect(p2).resolves.toBe("ok");
  });
});
