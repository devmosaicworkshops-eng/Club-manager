import { google } from "googleapis";

const LEADS_SPREADSHEET_ID = "1hbO-RuEldrec5Uo_K9i7L1nGdEdU2qJmC0S8JULEDtY";
const LEADS_TAB = "Form Annual Raw";

function getSheetsClient(readonly = true) {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error("GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY must be set");
  }
  const privateKey = rawKey.replace(/\\n/g, "\n");
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: [
      readonly
        ? "https://www.googleapis.com/auth/spreadsheets.readonly"
        : "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
  return google.sheets({ version: "v4", auth });
}

export interface LeadRecord {
  nom: string;
  prenom: string;
  dateNaissance: string;
  nomParent: string;
  numeroParent: string;
  emailParent: string;
  ecole: string;
  niveau: string;
  troubleApprentissage: string;
  allergie: string;
  allergieDetail: string;
  parcours: string;
  confirme: boolean;
  _rowIndex: string;
}

function rowToLead(row: string[]): LeadRecord {
  const key = row[0] ?? "";
  return {
    _rowIndex: key,
    nomParent: row[1] ?? "",
    numeroParent: row[2] ?? "",
    emailParent: row[3] ?? "",
    nom: row[4] ?? "",
    prenom: row[5] ?? "",
    dateNaissance: row[6] ?? "",
    ecole: row[7] ?? "",
    niveau: row[8] ?? "",
    troubleApprentissage: row[9] ?? "",
    allergie: row[10] ?? "",
    allergieDetail: row[11] ?? "",
    parcours: row[12] ?? "",
    confirme: false,
  };
}

export async function getAllLeads(): Promise<LeadRecord[]> {
  const sheets = getSheetsClient(true);
  const sheetRes = await sheets.spreadsheets.values.get({
    spreadsheetId: LEADS_SPREADSHEET_ID,
    range: `${LEADS_TAB}!A:T`,
  });

  const rows = sheetRes.data.values ?? [];
  return rows
    .slice(1)
    .filter((row) => row[0])
    .map((row) => rowToLead(row.map(String)));
}

/**
 * Delete the row whose column-A value matches `rowKey`.
 * Uses a service-account with spreadsheets (read-write) scope.
 */
export async function deleteLeadByKey(rowKey: string): Promise<void> {
  const sheets = getSheetsClient(false); // write scope

  // 1. Get the sheetId for LEADS_TAB
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: LEADS_SPREADSHEET_ID,
    fields: "sheets.properties",
  });
  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === LEADS_TAB
  );
  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
    throw new Error(`Sheet tab "${LEADS_TAB}" not found`);
  }
  const sheetId = sheet.properties!.sheetId!;

  // 2. Find the 0-based row index whose column A matches rowKey
  const colA = await sheets.spreadsheets.values.get({
    spreadsheetId: LEADS_SPREADSHEET_ID,
    range: `${LEADS_TAB}!A:A`,
  });
  const values = colA.data.values ?? [];
  // values[0] = header row (row 1), values[1] = first data row (row 2), etc.
  const rowIndex = values.findIndex((r) => r[0] === rowKey);
  if (rowIndex === -1) {
    throw new Error(`Row with key "${rowKey}" not found in sheet`);
  }

  // 3. Delete that row (0-based startIndex / endIndex in batchUpdate)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: LEADS_SPREADSHEET_ID,
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
}
