import { getSheetsClient, getSpreadsheetId } from "../config/sheets.js";
import { ticketsWriteLock } from "../utils/writeLock.js";
import { NotFoundError, ConflictError, NoTicketsError } from "../utils/errors.js";

const SHEET_NAME = "tickets";
const RANGE = `${SHEET_NAME}!A:B`;
const CACHE_TTL = 5 * 60 * 1000;

interface Ticket {
  ticket: string;
  status: string;
}

let cache: Ticket[] | null = null;
let cacheTime = 0;
let cachedSheetId: number | null = null;

function invalidateCache() {
  cache = null;
  cacheTime = 0;
}

async function readAllTickets(): Promise<Ticket[]> {
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
  // Skip header row, filter out empty ticket names
  const tickets = rows
    .slice(1)
    .filter((row) => row[0])
    .map((row) => ({
      ticket: row[0] || "",
      status: row[1] || "",
    }));

  cache = tickets;
  cacheTime = Date.now();
  return tickets;
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

async function getAllTickets(): Promise<Ticket[]> {
  return readAllTickets();
}

async function getTicket(ticket: string): Promise<Ticket | null> {
  const tickets = await readAllTickets();
  return tickets.find((t) => t.ticket === ticket) || null;
}

async function createTicket(ticket: string): Promise<Ticket> {
  return ticketsWriteLock.withWriteLock(async () => {
    // Check if already exists (fresh read)
    invalidateCache();
    const existing = await readAllTickets();
    if (existing.some((t) => t.ticket === ticket)) {
      throw new ConflictError("Ticket already exists");
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: RANGE,
      valueInputOption: "RAW",
      requestBody: {
        values: [[ticket, ""]],
      },
    });

    invalidateCache();
    return { ticket, status: "" };
  });
}

async function updateTicket(
  oldTicket: string,
  newTicket: string,
): Promise<Ticket> {
  return ticketsWriteLock.withWriteLock(async () => {
    invalidateCache();
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // Fresh read to resolve row
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: RANGE,
    });

    const rows = res.data.values || [];
    const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === oldTicket);

    if (rowIndex === -1) {
      throw new NotFoundError("Ticket");
    }

    const currentStatus = rows[rowIndex][1] || "";

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A${rowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[newTicket]],
      },
    });

    invalidateCache();
    return { ticket: newTicket, status: currentStatus };
  });
}

async function deleteTicket(ticket: string): Promise<void> {
  return ticketsWriteLock.withWriteLock(async () => {
    invalidateCache();
    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // Fresh read to resolve row
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: RANGE,
    });

    const rows = res.data.values || [];
    const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === ticket);

    if (rowIndex === -1) {
      throw new NotFoundError("Ticket");
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

/**
 * Finds the first available ticket (empty status) and marks it as "Atribuído".
 * IMPORTANT: Must be called within a withWriteLock() to prevent race conditions.
 */
async function assignAvailableTicket(): Promise<string> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  // Fresh read to find available ticket
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: RANGE,
  });

  const rows = res.data.values || [];
  // Skip header, find first row with a ticket name and empty status
  const rowIndex = rows.findIndex(
    (row, i) => i > 0 && row[0] && !row[1],
  );

  if (rowIndex === -1) {
    throw new NoTicketsError();
  }

  const ticket = rows[rowIndex][0];

  // Update status to "Atribuído"
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!B${rowIndex + 1}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [["Atribuído"]],
    },
  });

  invalidateCache();
  return ticket;
}

export {
  getAllTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  assignAvailableTicket,
  Ticket,
};
