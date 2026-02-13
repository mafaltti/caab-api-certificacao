import crypto from "crypto";
import { getSheetsClient, getSpreadsheetId } from "../config/sheets";
import { withWriteLock } from "../utils/writeLock";

const SHEET_NAME = "pedidos";
const RANGE = `${SHEET_NAME}!A:I`;
const CACHE_TTL = 5 * 60 * 1000;

interface Pedido {
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

let cache: Pedido[] | null = null;
let cacheTime = 0;

function invalidateCache() {
  cache = null;
  cacheTime = 0;
}

function rowToPedido(row: string[]): Pedido {
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

function pedidoToRow(pedido: Pedido): string[] {
  return [
    pedido.uuid,
    pedido.ticket,
    pedido.numero_oab,
    pedido.nome_completo,
    pedido.subsecao,
    pedido.data_solicitacao,
    pedido.data_liberacao,
    pedido.status,
    pedido.anotacoes,
  ];
}

async function readAllPedidos(): Promise<Pedido[]> {
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
  const pedidos = rows.slice(1).map((row) => rowToPedido(row));

  cache = pedidos;
  cacheTime = Date.now();
  return pedidos;
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

interface PedidoFilters {
  status?: string;
  ticket?: string;
  oab?: string;
}

async function getAllPedidos(filters?: PedidoFilters): Promise<Pedido[]> {
  let pedidos = await readAllPedidos();

  if (filters) {
    if (filters.status) {
      pedidos = pedidos.filter(
        (p) => p.status.toLowerCase() === filters.status!.toLowerCase()
      );
    }
    if (filters.ticket) {
      pedidos = pedidos.filter((p) => p.ticket === filters.ticket);
    }
    if (filters.oab) {
      pedidos = pedidos.filter((p) => p.numero_oab === filters.oab);
    }
  }

  return pedidos;
}

async function getPedidoById(uuid: string): Promise<Pedido | null> {
  const pedidos = await readAllPedidos();
  return pedidos.find((p) => p.uuid === uuid) || null;
}

type CreatePedidoData = Omit<Pedido, "uuid">;

async function createPedido(data: CreatePedidoData): Promise<Pedido> {
  return withWriteLock(async () => {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const pedido: Pedido = {
      uuid: crypto.randomUUID(),
      ticket: data.ticket,
      numero_oab: data.numero_oab || "",
      nome_completo: data.nome_completo,
      subsecao: data.subsecao || "",
      data_solicitacao: data.data_solicitacao || "",
      data_liberacao: data.data_liberacao || "",
      status: data.status || "",
      anotacoes: data.anotacoes || "",
    };

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: RANGE,
      valueInputOption: "RAW",
      requestBody: {
        values: [pedidoToRow(pedido)],
      },
    });

    invalidateCache();
    return pedido;
  });
}

type UpdatePedidoData = Partial<Omit<Pedido, "uuid">>;

async function updatePedido(
  uuid: string,
  data: UpdatePedidoData
): Promise<Pedido> {
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
      throw new Error("Pedido not found");
    }

    const existing = rowToPedido(rows[rowIndex]);
    const updated: Pedido = {
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
        values: [pedidoToRow(updated)],
      },
    });

    invalidateCache();
    return updated;
  });
}

async function deletePedido(uuid: string): Promise<void> {
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
      throw new Error("Pedido not found");
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
  getAllPedidos,
  getPedidoById,
  createPedido,
  updatePedido,
  deletePedido,
  Pedido,
};
