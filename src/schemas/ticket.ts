import { z } from "zod";

const ticketSchema = z.object({ ticket: z.string().min(1) });

const ticketParamSchema = z.object({ ticket: z.string().min(1) });

export { ticketSchema, ticketParamSchema };
