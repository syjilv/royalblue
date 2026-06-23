const SHEET_NAME = "수요조사";
const SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const HEADERS = [
  "접수시각",
  "이름",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "총수량",
  "수령방법",
  "적용단가",
  "배송비",
  "큰사이즈 추가금",
  "예상금액",
];

function doPost(e) {
  const sheet = getSheet();
  const data = JSON.parse(e.postData.contents);
  const counts = data.counts || {};
  const totalQuantity = SIZES.reduce((sum, size) => sum + (Number(counts[size]) || 0), 0);

  sheet.appendRow([
    new Date(),
    data.name || "",
    Number(counts.S) || 0,
    Number(counts.M) || 0,
    Number(counts.L) || 0,
    Number(counts.XL) || 0,
    Number(counts["2XL"]) || 0,
    Number(counts["3XL"]) || 0,
    totalQuantity,
    data.delivery || "현장수령",
    Number(data.unitPrice) || 0,
    Number(data.shippingFee) || 0,
    Number(data.plusSizeSurcharge) || 0,
    Number(data.estimatedTotal) || 0,
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const callback = e.parameter.callback || "callback";
  const data = getSummary();
  const output = `${callback}(${JSON.stringify(data)});`;

  return ContentService
    .createTextOutput(output)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getSummary() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1);
  const entries = rows
    .filter((row) => row[1])
    .map((row) => ({
      submittedAt: row[0] instanceof Date ? row[0].toISOString() : row[0],
      name: row[1],
      counts: {
        S: Number(row[2]) || 0,
        M: Number(row[3]) || 0,
        L: Number(row[4]) || 0,
        XL: Number(row[5]) || 0,
        "2XL": Number(row[6]) || 0,
        "3XL": Number(row[7]) || 0,
      },
      totalQuantity: Number(row[8]) || 0,
      delivery: row[9] || "현장수령",
    }));

  return {
    ok: true,
    spreadsheetUrl: spreadsheet.getUrl(),
    totalQuantity: entries.reduce((sum, entry) => sum + entry.totalQuantity, 0),
    entries: entries.slice(-10).reverse(),
  };
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }

  return sheet;
}
