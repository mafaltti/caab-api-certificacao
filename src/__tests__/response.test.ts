import { describe, it, expect } from "vitest";
import { success, successList, error } from "../utils/response.js";

describe("success", () => {
  it("wraps data with success flag", () => {
    const result = success({ id: 1 });
    expect(result).toEqual({ success: true, data: { id: 1 } });
  });
});

describe("successList", () => {
  it("wraps array with success flag and count", () => {
    const items = [{ a: 1 }, { a: 2 }];
    const result = successList(items);
    expect(result).toEqual({ success: true, count: 2, data: items });
  });

  it("returns count 0 for empty array", () => {
    const result = successList([]);
    expect(result).toEqual({ success: true, count: 0, data: [] });
  });
});

describe("error", () => {
  it("wraps message with failure flag", () => {
    const result = error("Something broke");
    expect(result).toEqual({ success: false, error: "Something broke" });
  });
});
