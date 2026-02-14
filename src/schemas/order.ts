import { z } from "zod";

const createOrderSchema = z.object({
  nome_completo: z.string().min(1),
  numero_oab: z.string().optional().default(""),
  subsecao: z.string().optional().default(""),
  data_solicitacao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .default(""),
  data_liberacao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .default(""),
  status: z.string().optional().default(""),
  anotacoes: z.string().optional().default(""),
});

const updateOrderSchema = createOrderSchema
  .extend({
    ticket: z.string().min(1),
  })
  .partial();

export { createOrderSchema, updateOrderSchema };
