/**
 * GOOGLE APPS SCRIPT CHO HỆ THỐNG QUẢN LÝ CHI TIÊU
 * Hỗ trợ hiển thị, đồng bộ 2 chiều các khoản chi tiêu trong tháng lên Web
 * 
 * Hướng dẫn triển khai (1 phút):
 * 1. Mở file Google Sheets chi tiêu của bạn trên Google Drive.
 * 2. Trên menu, chọn: Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Dán toàn bộ nội dung file này vào file Code.gs.
 * 4. Bấm 💾 Lưu -> Bấm Triển khai (Deploy) -> Quản lý các bản triển khai (hoặc Triển khai mới).
 * 5. Chọn "Ứng dụng web" (Web app), thực thi dưới dạng "Tôi", quyền truy cập "Bất kỳ ai" (Anyone).
 * 6. Copy URL Web App dán vào phần Cài đặt trên giao diện Web.
 */

// Tên cơ sở của file trên Google Drive (tương thích 100% với app Python)
const BASE_FILE_NAME = "Danh sách chi tiêu";

// 8 Danh mục cố định
const FIXED_CATEGORIES = [
  "Ăn uống", "Di chuyển", "Mua sắm", "Giải trí",
  "Điện nước", "Cá nhân", "Tiền trọ", "Hiếu/ Hỉ"
];

/**
 * Xử lý yêu cầu GET:
 * - action=ping: Kiểm tra kết nối
 * - action=getMonthData: Lấy toàn bộ danh sách chi tiêu và thống kê của tháng
 * - action=summary: Lấy tổng chi tiêu nhanh
 * - action=delete: Xóa khoản chi theo số dòng
 */
function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : "";

  // 1. Kiểm tra kết nối
  if (action === "ping") {
    try {
      const now = new Date();
      const ss = getOrCreateSpreadsheet(now.getFullYear());
      return createJsonResponse({
        status: "ok",
        message: "Google Apps Script đang hoạt động ổn định!",
        spreadsheetUrl: ss.getUrl(),
        spreadsheetId: ss.getId()
      });
    } catch(err) {
      return createJsonResponse({ status: "ok", message: "Google Apps Script đang hoạt động ổn định!" });
    }
  }

  // 2. Lấy toàn bộ danh sách chi tiêu và thống kê trong tháng
  if (action === "getMonthData" || action === "getTransactions") {
    try {
      const now = new Date();
      const year = e.parameter.year ? parseInt(e.parameter.year) : now.getFullYear();
      const month = e.parameter.month ? String(e.parameter.month).padStart(2, "0") : String(now.getMonth() + 1).padStart(2, "0");
      
      const data = getMonthData(year, month);
      return createJsonResponse(data);
    } catch (err) {
      return createJsonResponse({ success: false, error: err.toString() });
    }
  }

  // 3. Lấy thống kê tóm tắt
  if (action === "summary") {
    try {
      const now = new Date();
      const year = e.parameter.year ? parseInt(e.parameter.year) : now.getFullYear();
      const month = e.parameter.month ? String(e.parameter.month).padStart(2, "0") : String(now.getMonth() + 1).padStart(2, "0");
      
      const data = getMonthData(year, month);
      return createJsonResponse({
        success: true,
        year: year,
        month: month,
        total: data.total,
        count: data.count,
        categories: data.categories
      });
    } catch (err) {
      return createJsonResponse({ success: false, error: err.toString() });
    }
  }

  // 4. Xóa một giao dịch theo dòng
  if (action === "delete") {
    try {
      const year = parseInt(e.parameter.year) || new Date().getFullYear();
      const month = String(e.parameter.month || (new Date().getMonth() + 1)).padStart(2, "0");
      const row = parseInt(e.parameter.row);

      const result = deleteTransactionRow(year, month, row);
      return createJsonResponse(result);
    } catch (err) {
      return createJsonResponse({ success: false, error: err.toString() });
    }
  }

  // 5. Mặc định: Phục vụ trực tiếp giao diện Web HTML nếu mở qua browser
  try {
    return HtmlService.createHtmlOutputFromFile("index")
      .setTitle("Quản Lý Chi Tiêu")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return createJsonResponse({ status: "ok", message: "Google Apps Script Quản Lý Chi Tiêu sẵn sàng!" });
  }
}

/**
 * Xử lý yêu cầu POST: Thêm mới hoặc xóa giao dịch
 */
function doPost(e) {
  try {
    let data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    } else {
      throw new Error("Không nhận được dữ liệu tải lên.");
    }

    // Xóa giao dịch nếu action là delete
    if (data.action === "delete") {
      const year = parseInt(data.year) || new Date().getFullYear();
      const month = String(data.month || (new Date().getMonth() + 1)).padStart(2, "0");
      const row = parseInt(data.row);
      return createJsonResponse(deleteTransactionRow(year, month, row));
    }

    // Mặc định: Thêm chi tiêu mới
    const dateStr = data.date || Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
    const category = data.category || "Ăn uống";
    const amount = Number(data.amount) || 0;
    const note = data.note || "";

    if (amount <= 0) {
      throw new Error("Số tiền chi tiêu phải lớn hơn 0");
    }

    const dateParts = dateStr.split("-");
    const year = parseInt(dateParts[0]) || new Date().getFullYear();
    const month = String(dateParts[1] || (new Date().getMonth() + 1)).padStart(2, "0");
    const sheetName = "Tháng " + month + "-" + year;

    const ss = getOrCreateSpreadsheet(year);
    const sheet = getOrCreateMonthSheet(ss, sheetName);

    const nextRow = getNextAvailableDataRow(sheet);

    sheet.getRange(nextRow, 1).setValue(dateStr).setNumberFormat("@");
    sheet.getRange(nextRow, 2).setValue(category);
    sheet.getRange(nextRow, 3).setValue(amount).setNumberFormat("#,##0");
    sheet.getRange(nextRow, 4).setValue(note);

    sheet.getRange(nextRow, 1, 1, 2).setHorizontalAlignment("center");
    sheet.getRange(nextRow, 3).setHorizontalAlignment("right");
    sheet.getRange(nextRow, 4).setHorizontalAlignment("left");

    SpreadsheetApp.flush();
    const newTotal = sheet.getRange("G10").getValue();

    return createJsonResponse({
      success: true,
      message: "Đã thêm chi tiêu thành công!",
      row: nextRow,
      monthTotal: typeof newTotal === "number" ? newTotal : amount,
      spreadsheetUrl: ss.getUrl()
    });
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString()
    });
  }
}

/**
 * Đọc toàn bộ dữ liệu chi tiêu trong tháng từ Google Sheets
 */
function getMonthData(year, month) {
  const ss = getOrCreateSpreadsheet(year);
  const sheetName = "Tháng " + String(month).padStart(2, "0") + "-" + year;

  // Lấy danh sách các sheet tháng sẵn có
  const availableMonths = [];
  const allSheets = ss.getSheets();
  for (let s = 0; s < allSheets.length; s++) {
    const sName = allSheets[s].getName();
    if (sName.toLowerCase().indexOf("tháng") !== -1) {
      availableMonths.push(sName);
    }
  }

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return {
      success: true,
      year: year,
      month: month,
      sheetName: sheetName,
      spreadsheetUrl: ss.getUrl(),
      spreadsheetId: ss.getId(),
      total: 0,
      count: 0,
      categories: FIXED_CATEGORIES.map(c => ({ name: c, total: 0 })),
      transactions: [],
      availableMonths: availableMonths
    };
  }

  const lastRow = sheet.getLastRow();
  const transactions = [];

  if (lastRow >= 2) {
    // Đọc cột A đến D từ dòng 2
    const rangeData = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    for (let i = 0; i < rangeData.length; i++) {
      const row = rangeData[i];
      let dateVal = row[0];
      const catVal = row[1];
      const amountVal = Number(row[2]) || 0;
      const noteVal = row[3] ? String(row[3]) : "";

      if (amountVal > 0 || (catVal && catVal.toString().trim() !== "")) {
        if (dateVal instanceof Date) {
          dateVal = Utilities.formatDate(dateVal, "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
        } else {
          dateVal = String(dateVal || "").trim();
        }

        transactions.push({
          row: i + 2,
          date: dateVal,
          category: String(catVal || "").trim(),
          amount: amountVal,
          note: noteVal
        });
      }
    }
  }

  // Đọc danh mục tổng hợp từ F2:G9
  const catSummary = [];
  try {
    const catRange = sheet.getRange("F2:G9").getValues();
    for (let c = 0; c < catRange.length; c++) {
      const cName = String(catRange[c][0] || FIXED_CATEGORIES[c] || "");
      const cTotal = Number(catRange[c][1]) || 0;
      catSummary.push({ name: cName, total: cTotal });
    }
  } catch (e) {
    FIXED_CATEGORIES.forEach(c => {
      const sum = transactions.filter(t => t.category === c).reduce((acc, t) => acc + t.amount, 0);
      catSummary.push({ name: c, total: sum });
    });
  }

  // Đọc ô tổng chi tiêu G10
  let totalVal = sheet.getRange("G10").getValue();
  if (typeof totalVal !== "number" || isNaN(totalVal)) {
    totalVal = transactions.reduce((acc, t) => acc + t.amount, 0);
  }

  return {
    success: true,
    year: year,
    month: month,
    sheetName: sheetName,
    spreadsheetUrl: ss.getUrl(),
    spreadsheetId: ss.getId(),
    total: totalVal,
    count: transactions.length,
    categories: catSummary,
    transactions: transactions,
    availableMonths: availableMonths
  };
}

/**
 * Xóa 1 dòng chi tiêu
 */
function deleteTransactionRow(year, month, row) {
  const ss = getOrCreateSpreadsheet(year);
  const sheetName = "Tháng " + String(month).padStart(2, "0") + "-" + year;
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error("Không tìm thấy trang tính " + sheetName);
  }

  if (row < 2 || row > sheet.getLastRow()) {
    throw new Error("Chỉ số dòng không hợp lệ: " + row);
  }

  sheet.deleteRow(row);
  SpreadsheetApp.flush();

  const newTotal = sheet.getRange("G10").getValue();
  return {
    success: true,
    message: "Đã xóa thành công dòng " + row,
    newTotal: typeof newTotal === "number" ? newTotal : 0
  };
}

/**
 * Tìm hoặc tạo file Google Spreadsheet theo năm tương ứng
 */
function getOrCreateSpreadsheet(year) {
  const targetName = BASE_FILE_NAME + " " + year;
  
  const files = DriveApp.getFilesByName(targetName);
  if (files.hasNext()) {
    const file = files.next();
    return SpreadsheetApp.openById(file.getId());
  }

  if (year === 2026) {
    const oldFiles = DriveApp.getFilesByName(BASE_FILE_NAME);
    if (oldFiles.hasNext()) {
      const oldFile = oldFiles.next();
      oldFile.setName(targetName);
      return SpreadsheetApp.openById(oldFile.getId());
    }
  }

  return SpreadsheetApp.create(targetName);
}

/**
 * Tìm hoặc tạo tab tháng với định dạng chuẩn đồng bộ với app Python
 */
function getOrCreateMonthSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    return sheet;
  }

  sheet = ss.insertSheet(sheetName);

  const headers = [["Ngày", "Danh mục", "Số tiền", "Ghi chú"]];
  const headerRange = sheet.getRange(1, 1, 1, 4);
  headerRange.setValues(headers);
  headerRange.setBackground("#1E88E5");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  sheet.setRowHeight(1, 30);

  const summaryHeaders = [["Danh mục tổng", "Tổng chi tiêu"]];
  const summaryHeaderRange = sheet.getRange(1, 6, 1, 2);
  summaryHeaderRange.setValues(summaryHeaders);
  summaryHeaderRange.setBackground("#43A047");
  summaryHeaderRange.setFontColor("#FFFFFF");
  summaryHeaderRange.setFontWeight("bold");
  summaryHeaderRange.setHorizontalAlignment("center");

  for (let i = 0; i < FIXED_CATEGORIES.length; i++) {
    const row = 2 + i;
    sheet.getRange(row, 6).setValue(FIXED_CATEGORIES[i]).setHorizontalAlignment("center");
    sheet.getRange(row, 7).setFormula("=SUMIF(B:B, F" + row + ", C:C)").setNumberFormat("#,##0").setHorizontalAlignment("right");
    sheet.setRowHeight(row, 22);
  }

  sheet.getRange(10, 6).setValue("Tổng trong tháng").setFontWeight("bold").setFontColor("#D32F2F").setHorizontalAlignment("center");
  sheet.getRange(10, 7).setFormula("=SUM(G2:G9)").setFontWeight("bold").setFontColor("#D32F2F").setNumberFormat("#,##0").setHorizontalAlignment("right");
  sheet.setRowHeight(10, 26);

  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 130);
  sheet.setColumnWidth(4, 220);
  sheet.setColumnWidth(5, 30);
  sheet.setColumnWidth(6, 140);
  sheet.setColumnWidth(7, 140);

  return sheet;
}

/**
 * Tìm dòng trống đầu tiên trong cột A
 */
function getNextAvailableDataRow(sheet) {
  const colAValues = sheet.getRange("A:A").getValues();
  for (let r = 1; r < colAValues.length; r++) {
    if (!colAValues[r][0] || colAValues[r][0] === "") {
      return r + 1;
    }
  }
  return colAValues.length + 1;
}

/**
 * Tiện ích trả về phản hồi dạng JSON
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
