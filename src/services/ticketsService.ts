import { getSheetsClient, getSpreadsheetId } from "../config/sheets.js";
import { withWriteLock } from "../utils/writeLock.js";

const SHEET_NAME = "tickets";
const RANGE = `${SHEET_NAME}!A:A`;
const CACHE_TTL = 5 * 60 * 1000;

let cache: string[] | null = null;
let cacheTime = 0;

function invalidateCache() {
  cache = null;
  cacheTime = 0;
}

async function readAllTickets(): Promise<string[]> {
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
  const tickets = rows.slice(1).map((row) => row[0] || "").filter(Boolean);

  cache = tickets;
  cacheTime = Date.now();
  return tickets;
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

async function getAllTickets(): Promise<string[]> {
  return readAllTickets();
}

async function getTicket(
  ticket: string
): Promise<{ ticket: string } | null> {
  const tickets = await readAllTickets();
  const found = tickets.find((t) => t === ticket);
  return found ? { ticket: found } : null;
}

async function createTicket(ticket: string): Promise<{ ticket: string }> {
  return withWriteLock(async () => {
    // Check if already exists (fresh read)
    invalidateCache();
    const existing = await readAllTickets();
    if (existing.includes(ticket)) {
      throw new Error("Ticket already exists");
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: RANGE,
      valueInputOption: "RAW",
      requestBody: {
        values: [[ticket]],
      },
    });

    invalidateCache();
    return { ticket };
  });
}

async function updateTicket(
  oldTicket: string,
  newTicket: string
): Promise<{ ticket: string }> {
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
    const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === oldTicket);

    if (rowIndex === -1) {
      throw new Error("Ticket not found");
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A${rowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[newTicket]],
      },
    });

    invalidateCache();
    return { ticket: newTicket };
  });
}

async function deleteTicket(ticket: string): Promise<void> {
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
    const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === ticket);

    if (rowIndex === -1) {
      throw new Error("Ticket not found");
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
  getAllTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
};
