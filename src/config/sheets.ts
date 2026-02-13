import { google, sheets_v4 } from "googleapis";
import path from "path";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let cachedSheetsClient: sheets_v4.Sheets | null = null;

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  if (cachedSheetsClient) {
    return cachedSheetsClient;
  }

  let auth: InstanceType<typeof google.auth.GoogleAuth>;

  // Vercel: credentials from env var (JSON string)
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });
  } else {
    // Docker/VPS: credentials from file
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath) {
      throw new Error(
        "GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CREDENTIALS_JSON must be set"
      );
    }
    auth = new google.auth.GoogleAuth({
      keyFile: path.resolve(credentialsPath),
      scopes: SCOPES,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- googleapis type mismatch between GoogleAuth generic params
  cachedSheetsClient = google.sheets({ version: "v4", auth: auth as any });
  return cachedSheetsClient;
}

function getSpreadsheetId(): string {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID environment variable is not set");
  }
  return spreadsheetId;
}

export { getSheetsClient, getSpreadsheetId };
