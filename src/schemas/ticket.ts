import { z } from "zod";

const createTicketSchema = z.object({ ticket: z.string().min(1) });
const updateTicketSchema = z.object({ ticket: z.string().min(1) });

export { createTicketSchema, updateTicketSchema };
