import crypto from "node:crypto";
import { getSheetsClient, getSpreadsheetId } from "../config/sheets.js";
import { ordersWriteLock } from "../utils/writeLock.js";
import { NotFoundError, ConflictError, NoTicketsError } from "../utils/errors.js";
import { assignAvailableTicket } from "./ticketsService.js";

function nowBR(): string {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

const SHEET_NAME = "pedidos";
const RANGE = `${SHEET_NAME}!A:I`;
const CACHE_TTL = 5 * 60 * 1000;

interface Order {
  uuid: string;
  ticket: string;
  numero_oab: string;
  nome_completo: string;
  subsecao: string;
  data_solicitacao: string;
  data_liberacao: string;
  status: string;
  anotacoes: string;
}

interface CreateOrderResult {
  order: Order;
  conflict?: { existing_ticket: string; existing_date: string };
}

let cache: Order[] | null = null;
let cacheTime = 0;
let cachedSheetId: number | null = null;

function invalidateCache() {
  cache = null;
  cacheTime = 0;
}

function rowToOrder(row: string[]): Order {
  return {
    uuid: row[0] || "",
    ticket: row[1] || "",
    numero_oab: row[2] || "",
    nome_completo: row[3] || "",
    subsecao: row[4] || "",
    data_solicitacao: row[5] || "",
    data_liberacao: row[6] || "",
    status: row[7] || "",
    anotacoes: row[8] || "",
  };
}

function orderToRow(order: Order): string[] {
  return [
    order.uuid,
    order.ticket,
    order.numero_oab,
    order.nome_completo,
    order.subsecao,
    order.data_solicitacao,
    order.data_liberacao,
    order.status,
    order.anotacoes,
  ];
}

async function readAllOrders(): Promise<Order[]> {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL) {
    return cache;
  }

  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: RANGE,
  });

  const rows = res.data.values || [];
  // Skip header row
  const orders = rows.slice(1).map((row) => rowToOrder(row));

  cache = orders;
  cacheTime = Date.now();
  return orders;
}

async function getSheetId(): Promise<number> {
  if (cachedSheetId !== null) return cachedSheetId;

  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const sheet = res.data.sheets?.find(
    (s) => s.properties?.title === SHEET_NAME,
  );
  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
    throw new Error(`Sheet "${SHEET_NAME}" not found`);
  }
  cachedSheetId = sheet.properties.sheetId;
  return cachedSheetId;
}

interface OrderFilters {
  status?: string;
  ticket?: string;
  oab?: string;
  limit?: number;
  offset?: number;
}

interface PaginatedOrders {
  orders: Order[];
  total: number;
}

async function getAllOrders(filters?: OrderFilters): Promise<PaginatedOrders> {
  let orders = await readAllOrders();

  if (filters) {
    if (filters.status) {
      orders = orders.filter(
        (o) => o.status.toLowerCase() === filters.status!.toLowerCase(),
      );
    }
    if (filters.ticket) {
      orders = orders.filter(
        (o) => o.ticket.toLowerCase() === filters.ticket!.toLowerCase(),
      );
    }
    if (filters.oab) {
      orders = orders.filter(
        (o) => o.numero_oab.trim().toLowerCase() === filters.oab!.trim().toLowerCase(),
      );
    }
  }

  const total = orders.length;
  const offset = filters?.offset ?? 0;
  const limit = filters?.limit ?? 50;
  orders = orders.slice(offset, offset + limit);

  return { orders, total };
}

async function getOrderById(uuid: string): Promise<Order | null> {
  const orders = await readAllOrders();
  return orders.find((o) => o.uuid === uuid) || null;
}

type CreateOrderData = Omit<Order, "uuid" | "ticket" | "data_solicitacao" | "data_liberacao" | "status">;

async function createOrder(data: CreateOrderData): Promise<CreateOrderResult> {
  return ordersWriteLock.withWriteLock(async () => {
    // Check for duplicate OAB number
    invalidateCache();
    const existing = await readAllOrders();
    const normalizedOab = data.numero_oab?.trim() || "";
    const existingOrder = normalizedOab
      ? existing.find((o) => o.numero_oab.trim() === normalizedOab)
      : undefined;
    const duplicateOab = !!existingOrder;

    // Only assign a ticket if OAB is not duplicate
    let ticket = "";
    if (!duplicateOab) {
      try {
        ticket = await assignAvailableTicket();
      } catch (err) {
        if (err instanceof NoTicketsError) throw err;
        throw new NoTicketsError();
      }
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const order: Order = {
      uuid: crypto.randomUUID(),
      ticket,
      numero_oab: normalizedOab,
      nome_completo: data.nome_completo,
      subsecao: data.subsecao || "",
      data_solicitacao: nowBR(),
      data_liberacao: nowBR(),
      status: duplicateOab ? "Recusado" : "Aprovado",
      anotacoes: data.anotacoes || "",
    };

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: RANGE,
      valueInputOption: "RAW",
      requestBody: {
        values: [orderToRow(order)],
      },
    });

    invalidateCache();

    if (duplicateOab && existingOrder) {
      return {
        order,
        conflict: {
          existing_ticket: existingOrder.ticket,
          existing_date: existingOrder.data_solicitacao,
        },
      };
    }

    return { order };
  });
}

type UpdateOrderData = Partial<Omit<Order, "uuid">>;

async function updateOrder(
  uuid: string,
  data: UpdateOrderData,
): Promise<Order> {
  return ordersWriteLock.withWriteLock(async () => {
    invalidateCache();
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // Fresh read to resolve row
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: RANGE,
    });

    const rows = res.data.values || [];
    const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === uuid);

    if (rowIndex === -1) {
      throw new NotFoundError("Order");
    }

    const existing = rowToOrder(rows[rowIndex]);
    const updated: Order = {
      uuid: existing.uuid,
      ticket: data.ticket ?? existing.ticket,
      numero_oab: data.numero_oab ?? existing.numero_oab,
      nome_completo: data.nome_completo ?? existing.nome_completo,
      subsecao: data.subsecao ?? existing.subsecao,
      data_solicitacao: data.data_solicitacao ?? existing.data_solicitacao,
      data_liberacao: data.data_liberacao ?? existing.data_liberacao,
      status: data.status ?? existing.status,
      anotacoes: data.anotacoes ?? existing.anotacoes,
    };

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A${rowIndex + 1}:I${rowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [orderToRow(updated)],
      },
    });

    invalidateCache();
    return updated;
  });
}

async function deleteOrder(uuid: string): Promise<void> {
  return ordersWriteLock.withWriteLock(async () => {
    invalidateCache();
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // Fresh read to resolve row
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: RANGE,
    });

    const rows = res.data.values || [];
    const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === uuid);

    if (rowIndex === -1) {
      throw new NotFoundError("Order");
    }

    const sheetId = await getSheetId();

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });

    invalidateCache();
  });
}

export {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  Order,
  CreateOrderResult,
  PaginatedOrders,
};
