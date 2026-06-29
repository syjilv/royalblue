const SHEET_NAME = "구매신청";
const COLORS = ["화이트", "블랙"];
const SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const HEADERS = [
  "접수시각", "이름",
  "화이트 S", "화이트 M", "화이트 L", "화이트 XL", "화이트 2XL", "화이트 3XL",
  "블랙 S", "블랙 M", "블랙 L", "블랙 XL", "블랙 2XL", "블랙 3XL",
  "총수량", "수령방법", "배송주소", "상품금액", "배송비", "총입금액"
];

function doPost(e) {
  const sheet = getSheet();
  const data = JSON.parse(e.postData.contents);
  const colorCounts = data.colorCounts || {};
  const quantityCells = COLORS.flatMap(function(color) {
    return SIZES.map(function(size) { return Number((colorCounts[color] || {})[size]) || 0; });
  });
  sheet.appendRow([
    new Date(), data.name || ""
  ].concat(quantityCells, [
    Number(data.totalQuantity) || 0,
    data.delivery || "현장수령",
    data.address || "",
    Number(data.productAmount) || 0,
    Number(data.shippingFee) || 0,
    Number(data.totalAmount) || 0
  ]));
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const callback = e.parameter.callback || "callback";
  return ContentService.createTextOutput(callback + "(" + JSON.stringify(getSummary()) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getSummary() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const rows = getSheet().getDataRange().getValues().slice(1);
  const entries = rows.filter(function(row) { return row[1]; }).map(function(row) {
    const colorCounts = {};
    COLORS.forEach(function(color, colorIndex) {
      colorCounts[color] = {};
      SIZES.forEach(function(size, sizeIndex) {
        colorCounts[color][size] = Number(row[2 + colorIndex * SIZES.length + sizeIndex]) || 0;
      });
    });
    return {
      submittedAt: row[0] instanceof Date ? row[0].toISOString() : row[0],
      name: row[1], colorCounts: colorCounts,
      totalQuantity: Number(row[14]) || 0,
      delivery: row[15] || "현장수령"
    };
  });
  return { ok: true, spreadsheetUrl: spreadsheet.getUrl(), entries: entries.slice(-10).reverse() };
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}
