import { describe, it, expect } from "vitest";
import {
  createOrderSchema,
  updateOrderSchema,
  orderFiltersSchema,
  uuidParamSchema,
} from "../schemas/order.js";
import { ticketSchema, ticketParamSchema } from "../schemas/ticket.js";

describe("createOrderSchema", () => {
  it("accepts valid order data", () => {
    const result = createOrderSchema.safeParse({
      nome_completo: "João da Silva",
      numero_oab: "123456",
      subsecao: "São Paulo",
      anotacoes: "Test",
    });
    expect(result.success).toBe(true);
  });

  it("requires nome_completo", () => {
    const result = createOrderSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("defaults optional fields", () => {
    const result = createOrderSchema.safeParse({ nome_completo: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.numero_oab).toBe("");
      expect(result.data.subsecao).toBe("");
      expect(result.data.anotacoes).toBe("");
    }
  });
});

describe("updateOrderSchema", () => {
  it("accepts partial data", () => {
    const result = updateOrderSchema.safeParse({ status: "Aprovado" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateOrderSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("orderFiltersSchema", () => {
  it("accepts valid filters", () => {
    const result = orderFiltersSchema.safeParse({
      status: "Aprovado",
      limit: "10",
      offset: "0",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.offset).toBe(0);
    }
  });

  it("rejects limit above 100", () => {
    const result = orderFiltersSchema.safeParse({ limit: "200" });
    expect(result.success).toBe(false);
  });

  it("rejects negative offset", () => {
    const result = orderFiltersSchema.safeParse({ offset: "-1" });
    expect(result.success).toBe(false);
  });
});

describe("uuidParamSchema", () => {
  it("accepts valid UUID", () => {
    const result = uuidParamSchema.safeParse({
      uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    const result = uuidParamSchema.safeParse({ uuid: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

describe("ticketSchema", () => {
  it("accepts valid ticket", () => {
    const result = ticketSchema.safeParse({ ticket: "12345678900" });
    expect(result.success).toBe(true);
  });

  it("rejects empty ticket", () => {
    const result = ticketSchema.safeParse({ ticket: "" });
    expect(result.success).toBe(false);
  });
});

describe("ticketParamSchema", () => {
  it("accepts valid ticket param", () => {
    const result = ticketParamSchema.safeParse({ ticket: "ABC123" });
    expect(result.success).toBe(true);
  });
});
