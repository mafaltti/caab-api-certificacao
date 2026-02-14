import { Router, Request, Response } from "express";
import { success, successList, error } from "../utils/response.js";
import { createOrderSchema, updateOrderSchema } from "../schemas/order.js";
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
 *     responses:
 *       200:
 *         description: List of orders
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ListResponse'
 *                 - properties:
 *                     data:
 *                       items:
 *                         $ref: '#/components/schemas/Order'
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const filters = {
      status: req.query.status as string | undefined,
      ticket: req.query.ticket as string | undefined,
      oab: req.query.oab as string | undefined,
    };
    const orders = await ordersService.getAllOrders(filters);
    res.json(successList(orders));
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json(error("Failed to fetch orders"));
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
router.get("/:uuid", async (req: Request, res: Response) => {
  try {
    const order = await ordersService.getOrderById(req.params.uuid);
    if (!order) {
      return res.status(404).json(error("Order not found"));
    }
    res.json(success(order));
  } catch (err) {
    console.error("Error fetching order:", err);
    res.status(500).json(error("Failed to fetch order"));
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
 *       422:
 *         description: No available tickets
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", async (req: Request, res: Response) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(error(parsed.error.errors[0].message));
  }

  try {
    const order = await ordersService.createOrder(parsed.data);
    res.status(201).json(success(order));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create order";
    const status = message === "No available tickets" ? 422
      : message === "OAB number already has a request" ? 409 : 500;
    console.error("Error creating order:", err);
    res.status(status).json(error(message));
  }
});

/**
 * @openapi
 * /api/orders/{uuid}:
 *   put:
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
 *             $ref: '#/components/schemas/CreateOrder'
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
router.put("/:uuid", async (req: Request, res: Response) => {
  const parsed = updateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(error(parsed.error.errors[0].message));
  }

  try {
    const order = await ordersService.updateOrder(
      req.params.uuid,
      parsed.data
    );
    res.json(success(order));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update order";
    const status = message === "Order not found" ? 404 : 500;
    console.error("Error updating order:", err);
    res.status(status).json(error(message));
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
 *       200:
 *         description: Order deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:uuid", async (req: Request, res: Response) => {
  try {
    await ordersService.deleteOrder(req.params.uuid);
    res.json(success({ message: "Order deleted" }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete order";
    const status = message === "Order not found" ? 404 : 500;
    console.error("Error deleting order:", err);
    res.status(status).json(error(message));
  }
});

export default router;
