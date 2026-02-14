import { Router, Request, Response, NextFunction } from "express";
import { success, error } from "../utils/response.js";
import { createOrderSchema, updateOrderSchema, orderFiltersSchema, uuidParamSchema } from "../schemas/order.js";
import * as ordersService from "../services/ordersService.js";

const router = Router();

/**
 * @openapi
 * /api/orders:
 *   get:
 *     summary: List all orders
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: ticket
 *         schema:
 *           type: string
 *         description: Filter by ticket
 *       - in: query
 *         name: oab
 *         schema:
 *           type: string
 *         description: Filter by OAB number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of results per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: List of orders
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedListResponse'
 *                 - properties:
 *                     data:
 *                       items:
 *                         $ref: '#/components/schemas/Order'
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = orderFiltersSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(error(parsed.error.errors[0].message));
    }
    const { orders, total } = await ordersService.getAllOrders(parsed.data);
    res.json({
      success: true,
      count: orders.length,
      total,
      limit: parsed.data.limit ?? 50,
      offset: parsed.data.offset ?? 0,
      data: orders,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/orders/{uuid}:
 *   get:
 *     summary: Get order by UUID
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Order UUID
 *     responses:
 *       200:
 *         description: Order found
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - properties:
 *                     data:
 *                       $ref: '#/components/schemas/Order'
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:uuid", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramsParsed = uuidParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json(error("Invalid UUID format"));
    }
    const order = await ordersService.getOrderById(paramsParsed.data.uuid);
    if (!order) {
      return res.status(404).json(error("Order not found"));
    }
    res.json(success(order));
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/orders:
 *   post:
 *     summary: Create a new order (ticket auto-assigned)
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrder'
 *     responses:
 *       201:
 *         description: Order created (UUID and ticket auto-assigned by API)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - properties:
 *                     data:
 *                       $ref: '#/components/schemas/Order'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: OAB number already has an order
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConflictResponse'
 *       422:
 *         description: No available tickets
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(error(parsed.error.errors[0].message));
  }

  try {
    const result = await ordersService.createOrder(parsed.data);

    if (result.conflict) {
      return res.status(409).json({
        success: false,
        error: "OAB number already has an order",
        data: result.order,
        existing_ticket: result.conflict.existing_ticket,
        existing_date: result.conflict.existing_date,
      });
    }

    res.status(201).json(success(result.order));
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/orders/{uuid}:
 *   patch:
 *     summary: Update an order (partial)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Order UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateOrder'
 *     responses:
 *       200:
 *         description: Order updated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - properties:
 *                     data:
 *                       $ref: '#/components/schemas/Order'
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/:uuid", async (req: Request, res: Response, next: NextFunction) => {
  const paramsParsed = uuidParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json(error("Invalid UUID format"));
  }

  const parsed = updateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(error(parsed.error.errors[0].message));
  }

  try {
    const order = await ordersService.updateOrder(
      paramsParsed.data.uuid,
      parsed.data,
    );
    res.json(success(order));
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/orders/{uuid}:
 *   delete:
 *     summary: Remove an order
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Order UUID
 *     responses:
 *       204:
 *         description: Order deleted
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:uuid", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramsParsed = uuidParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json(error("Invalid UUID format"));
    }
    await ordersService.deleteOrder(paramsParsed.data.uuid);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
