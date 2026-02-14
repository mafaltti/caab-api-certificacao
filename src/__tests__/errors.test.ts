import { describe, it, expect } from "vitest";
import {
  AppError,
  NotFoundError,
  ConflictError,
  ValidationError,
  NoTicketsError,
} from "../utils/errors.js";

describe("AppError", () => {
  it("stores message and statusCode", () => {
    const err = new AppError("test error", 418);
    expect(err.message).toBe("test error");
    expect(err.statusCode).toBe(418);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("NotFoundError", () => {
  it("creates 404 with resource name", () => {
    const err = new NotFoundError("Order");
    expect(err.message).toBe("Order not found");
    expect(err.statusCode).toBe(404);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe("ConflictError", () => {
  it("creates 409 with message", () => {
    const err = new ConflictError("Already exists");
    expect(err.message).toBe("Already exists");
    expect(err.statusCode).toBe(409);
  });

  it("accepts optional details", () => {
    const err = new ConflictError("Duplicate", { key: "value" });
    expect(err.details).toEqual({ key: "value" });
  });
});

describe("ValidationError", () => {
  it("creates 400 with message", () => {
    const err = new ValidationError("Invalid input");
    expect(err.message).toBe("Invalid input");
    expect(err.statusCode).toBe(400);
  });
});

describe("NoTicketsError", () => {
  it("creates 422 with default message", () => {
    const err = new NoTicketsError();
    expect(err.message).toBe("No available tickets");
    expect(err.statusCode).toBe(422);
  });
});
