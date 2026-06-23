const SHEET_NAME = "신청내역";

const HEADERS = [
  "접수시각",
  "이름",
  "연락처",
  "수량",
  "사이즈",
  "수령방법",
  "수령주소",
  "기타메시지",
  "상품단가",
  "배송비",
  "총액",
];

function doPost(e) {
  const sheet = getSheet();
  const data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    new Date(),
    data.name || "",
    data.phone || "",
    data.quantity || "",
    data.size || "",
    data.delivery || "",
    data.address || "",
    data.message || "",
    data.itemPrice || "",
    data.shippingFee || "",
    data.totalPrice || "",
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
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
