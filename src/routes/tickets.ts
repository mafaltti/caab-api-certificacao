import { Router, Request, Response, NextFunction } from "express";
import { success, successList, error } from "../utils/response.js";
import { ticketSchema, ticketParamSchema } from "../schemas/ticket.js";
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
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tickets = await ticketsService.getAllTickets();
    res.json(successList(tickets));
  } catch (err) {
    next(err);
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
router.get("/:ticket", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramsParsed = ticketParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json(error("Invalid ticket parameter"));
    }
    const result = await ticketsService.getTicket(paramsParsed.data.ticket);
    if (!result) {
      return res.status(404).json(error("Ticket not found"));
    }
    res.json(success(result));
  } catch (err) {
    next(err);
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
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  const parsed = ticketSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(error(parsed.error.errors[0].message));
  }

  try {
    const result = await ticketsService.createTicket(parsed.data.ticket);
    res.status(201).json(success(result));
  } catch (err) {
    next(err);
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
router.put("/:ticket", async (req: Request, res: Response, next: NextFunction) => {
  const paramsParsed = ticketParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(error("Invalid ticket parameter"));
  }

  const parsed = ticketSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(error(parsed.error.errors[0].message));
  }

  try {
    const result = await ticketsService.updateTicket(
      paramsParsed.data.ticket,
      parsed.data.ticket,
    );
    res.json(success(result));
  } catch (err) {
    next(err);
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
 *       204:
 *         description: Ticket deleted
 *       404:
 *         description: Ticket not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:ticket", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramsParsed = ticketParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json(error("Invalid ticket parameter"));
    }
    await ticketsService.deleteTicket(paramsParsed.data.ticket);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
