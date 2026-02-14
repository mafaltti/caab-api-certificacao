import { Router, Request, Response } from "express";
import { success, successList, error } from "../utils/response.js";
import { createTicketSchema, updateTicketSchema } from "../schemas/ticket.js";
import * as ticketsService from "../services/ticketsService.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const tickets = await ticketsService.getAllTickets();
    res.json(successList(tickets.map((t) => ({ ticket: t }))));
  } catch (err) {
    console.error("Error fetching tickets:", err);
    res.status(500).json(error("Failed to fetch tickets"));
  }
});

router.get("/:ticket", async (req: Request, res: Response) => {
  try {
    const result = await ticketsService.getTicket(req.params.ticket);
    if (!result) {
      return res.status(404).json(error("Ticket not found"));
    }
    res.json(success(result));
  } catch (err) {
    console.error("Error fetching ticket:", err);
    res.status(500).json(error("Failed to fetch ticket"));
  }
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = createTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(error(parsed.error.errors[0].message));
  }

  try {
    const result = await ticketsService.createTicket(parsed.data.ticket);
    res.status(201).json(success(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create ticket";
    const status = message === "Ticket already exists" ? 409 : 500;
    console.error("Error creating ticket:", err);
    res.status(status).json(error(message));
  }
});

router.put("/:ticket", async (req: Request, res: Response) => {
  const parsed = updateTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(error(parsed.error.errors[0].message));
  }

  try {
    const result = await ticketsService.updateTicket(
      req.params.ticket,
      parsed.data.ticket
    );
    res.json(success(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update ticket";
    const status = message === "Ticket not found" ? 404 : 500;
    console.error("Error updating ticket:", err);
    res.status(status).json(error(message));
  }
});

router.delete("/:ticket", async (req: Request, res: Response) => {
  try {
    await ticketsService.deleteTicket(req.params.ticket);
    res.json(success({ message: "Ticket deleted" }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete ticket";
    const status = message === "Ticket not found" ? 404 : 500;
    console.error("Error deleting ticket:", err);
    res.status(status).json(error(message));
  }
});

export default router;
