import crypto from "node:crypto";
import { getSheetsClient, getSpreadsheetId } from "../config/sheets.js";
import { withWriteLock } from "../utils/writeLock.js";
import { assignAvailableTicket } from "./ticketsService.js";

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

let cache: Order[] | null = null;
let cacheTime = 0;

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
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const sheet = res.data.sheets?.find(
    (s) => s.properties?.title === SHEET_NAME
  );
  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
    throw new Error(`Sheet "${SHEET_NAME}" not found`);
  }
  return sheet.properties.sheetId;
}

interface OrderFilters {
  status?: string;
  ticket?: string;
  oab?: string;
}

async function getAllOrders(filters?: OrderFilters): Promise<Order[]> {
  let orders = await readAllOrders();

  if (filters) {
    if (filters.status) {
      orders = orders.filter(
        (o) => o.status.toLowerCase() === filters.status!.toLowerCase()
      );
    }
    if (filters.ticket) {
      orders = orders.filter((o) => o.ticket === filters.ticket);
    }
    if (filters.oab) {
      orders = orders.filter((o) => o.numero_oab === filters.oab);
    }
  }

  return orders;
}

async function getOrderById(uuid: string): Promise<Order | null> {
  const orders = await readAllOrders();
  return orders.find((o) => o.uuid === uuid) || null;
}

type CreateOrderData = Omit<Order, "uuid" | "ticket">;

async function createOrder(data: CreateOrderData): Promise<Order> {
  return withWriteLock(async () => {
    // Check for duplicate OAB number
    invalidateCache();
    const existing = await readAllOrders();
    const duplicateOab = data.numero_oab && existing.some((o) => o.numero_oab === data.numero_oab);

    // Only assign a ticket if OAB is not duplicate
    const ticket = duplicateOab ? "" : await assignAvailableTicket();

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const order: Order = {
      uuid: crypto.randomUUID(),
      ticket,
      numero_oab: data.numero_oab || "",
      nome_completo: data.nome_completo,
      subsecao: data.subsecao || "",
      data_solicitacao: data.data_solicitacao || "",
      data_liberacao: data.data_liberacao || "",
      status: duplicateOab ? "Negado" : (data.status || ""),
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

    if (duplicateOab) {
      throw new Error("OAB number already has a request");
    }

    return order;
  });
}

type UpdateOrderData = Partial<Omit<Order, "uuid">>;

async function updateOrder(
  uuid: string,
  data: UpdateOrderData
): Promise<Order> {
  return withWriteLock(async () => {
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
      throw new Error("Order not found");
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
  return withWriteLock(async () => {
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
      throw new Error("Order not found");
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
};
