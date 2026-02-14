import { Router, Request, Response } from "express";
import { success, successList, error } from "../utils/response.js";
import { createPedidoSchema, updatePedidoSchema } from "../schemas/pedido.js";
import * as pedidosService from "../services/pedidosService.js";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const filters = {
      status: req.query.status as string | undefined,
      ticket: req.query.ticket as string | undefined,
      oab: req.query.oab as string | undefined,
    };
    const pedidos = await pedidosService.getAllPedidos(filters);
    res.json(successList(pedidos));
  } catch (err) {
    console.error("Error fetching pedidos:", err);
    res.status(500).json(error("Failed to fetch pedidos"));
  }
});

router.get("/:uuid", async (req: Request, res: Response) => {
  try {
    const pedido = await pedidosService.getPedidoById(req.params.uuid);
    if (!pedido) {
      return res.status(404).json(error("Pedido not found"));
    }
    res.json(success(pedido));
  } catch (err) {
    console.error("Error fetching pedido:", err);
    res.status(500).json(error("Failed to fetch pedido"));
  }
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = createPedidoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(error(parsed.error.errors[0].message));
  }

  try {
    const pedido = await pedidosService.createPedido(parsed.data);
    res.status(201).json(success(pedido));
  } catch (err) {
    console.error("Error creating pedido:", err);
    res.status(500).json(error("Failed to create pedido"));
  }
});

router.put("/:uuid", async (req: Request, res: Response) => {
  const parsed = updatePedidoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(error(parsed.error.errors[0].message));
  }

  try {
    const pedido = await pedidosService.updatePedido(
      req.params.uuid,
      parsed.data
    );
    res.json(success(pedido));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update pedido";
    const status = message === "Pedido not found" ? 404 : 500;
    console.error("Error updating pedido:", err);
    res.status(status).json(error(message));
  }
});

router.delete("/:uuid", async (req: Request, res: Response) => {
  try {
    await pedidosService.deletePedido(req.params.uuid);
    res.json(success({ message: "Pedido deleted" }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete pedido";
    const status = message === "Pedido not found" ? 404 : 500;
    console.error("Error deleting pedido:", err);
    res.status(status).json(error(message));
  }
});

export default router;
