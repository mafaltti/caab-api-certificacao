import { z } from "zod";

const createOrderSchema = z.object({
  nome_completo: z.string().min(1),
  numero_oab: z.string().optional().default(""),
  subsecao: z.string().optional().default(""),
  anotacoes: z.string().optional().default(""),
});

const updateOrderSchema = createOrderSchema
  .extend({
    ticket: z.string().min(1),
    data_solicitacao: z.string(),
    data_liberacao: z.string(),
    status: z.string(),
  })
  .partial();

const orderFiltersSchema = z.object({
  status: z.string().optional(),
  ticket: z.string().optional(),
  oab: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const uuidParamSchema = z.object({
  uuid: z.string().uuid(),
});

export { createOrderSchema, updateOrderSchema, orderFiltersSchema, uuidParamSchema };
