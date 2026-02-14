import { Router, Request, Response } from "express";
import { success, successList, error } from "../utils/response.js";
import { createTicketSchema, updateTicketSchema } from "../schemas/ticket.js";
import * as ticketsService from "../services/ticketsService.js";

const router = Router();

/**
 * @openapi
 * /api/tickets:
 *   get:
 *     summary: List all tickets
 *     tags: [Tickets]
 *     responses:
 *       200:
 *         description: List of tickets
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ListResponse'
 *                 - properties:
 *                     data:
 *                       items:
 *                         $ref: '#/components/schemas/Ticket'
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const tickets = await ticketsService.getAllTickets();
    res.json(successList(tickets));
  } catch (err) {
    console.error("Error fetching tickets:", err);
    res.status(500).json(error("Failed to fetch tickets"));
  }
});

/**
 * @openapi
 * /api/tickets/{ticket}:
 *   get:
 *     summary: Check if a specific ticket exists
 *     tags: [Tickets]
 *     parameters:
 *       - in: path
 *         name: ticket
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket number
 *     responses:
 *       200:
 *         description: Ticket found
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - properties:
 *                     data:
 *                       $ref: '#/components/schemas/Ticket'
 *       404:
 *         description: Ticket not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @openapi
 * /api/tickets:
 *   post:
 *     summary: Add a new ticket
 *     tags: [Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Ticket'
 *     responses:
 *       201:
 *         description: Ticket created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - properties:
 *                     data:
 *                       $ref: '#/components/schemas/Ticket'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Ticket already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @openapi
 * /api/tickets/{ticket}:
 *   put:
 *     summary: Update a ticket value
 *     tags: [Tickets]
 *     parameters:
 *       - in: path
 *         name: ticket
 *         required: true
 *         schema:
 *           type: string
 *         description: Current ticket number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Ticket'
 *     responses:
 *       200:
 *         description: Ticket updated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - properties:
 *                     data:
 *                       $ref: '#/components/schemas/Ticket'
 *       404:
 *         description: Ticket not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @openapi
 * /api/tickets/{ticket}:
 *   delete:
 *     summary: Remove a ticket
 *     tags: [Tickets]
 *     parameters:
 *       - in: path
 *         name: ticket
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket number to delete
 *     responses:
 *       200:
 *         description: Ticket deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Ticket not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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
