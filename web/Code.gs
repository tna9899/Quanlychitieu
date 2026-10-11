/**
 * GOOGLE APPS SCRIPT CHO HỆ THỐNG QUẢN LÝ CHI TIÊU
 * Hỗ trợ hiển thị, đồng bộ 2 chiều các khoản chi tiêu trong tháng lên Web
 * 
 * Hướng dẫn triển khai (1 phút):
 * 1. Mở file Google Sheets chi tiêu của bạn trên Google Drive.
 * 2. Trên menu, chọn: Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Dán toàn bộ nội dung file này vào file Code.gs.
 * 4. Bấm 💾 Lưu -> Bấm Triển khai (Deploy) -> Quản lý các bản triển khai (Manage deployments).
 * 5. Bấm biểu tượng cây bút ✏️ Chỉnh sửa -> Chọn "Phiên bản mới" (New version).
 *    (Đảm bảo: "Thực thi dưới dạng: Tôi" và "Ai có quyền truy cập: Bất kỳ ai / Anyone")
 * 6. Bấm Triển khai (Deploy) và copy URL Web App dán vào Cài đặt trên Web.
 */

// Tên cơ sở của file trên Google Drive (tương thích 100% với app Python)
const BASE_FILE_NAME = "Danh sách chi tiêu";

/**
 * Lấy danh mục chuẩn theo tháng:
 * - Từ tháng 10-2026 trở đi: Chuyển "Điện nước" thành "Bố Mẹ"
 * - Các tháng trước tháng 10: Giữ nguyên "Điện nước"
 */
function getCategoriesForMonth(month, year) {
  const m = parseInt(month) || 10;
  const y = parseInt(year) || 2026;
  if (y > 2026 || (y === 2026 && m >= 10)) {
    return [
      "Ăn uống", "Di chuyển", "Mua sắm", "Giải trí",
      "Bố Mẹ", "Cá nhân", "Tiền trọ", "Hiếu/ Hỉ"
    ];
  }
  return [
    "Ăn uống", "Di chuyển", "Mua sắm", "Giải trí",
    "Điện nước", "Cá nhân", "Tiền trọ", "Hiếu/ Hỉ"
  ];
}

/**
 * Lấy email của tài khoản Google sở hữu bảng tính
 */
function getConnectedEmail() {
  try {
    return Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || "";
  } catch (e) {
    return "";
  }
}

/**
 * Xử lý yêu cầu GET:
 * - action=ping: Kiểm tra kết nối & lấy email
 * - action=getMonthData: Lấy toàn bộ danh sách chi tiêu và thống kê của tháng
 * - action=summary: Lấy tổng chi tiêu nhanh
 * - action=delete: Xóa khoản chi theo số dòng
 */
function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : "";
  const userEmail = getConnectedEmail();

  // 1. Kiểm tra kết nối
  if (action === "ping") {
    try {
      const now = new Date();
      const ss = getOrCreateSpreadsheet(now.getFullYear());
      return createJsonResponse({
        status: "ok",
        message: "Google Apps Script đang hoạt động ổn định!",
        email: userEmail,
        spreadsheetUrl: ss ? ss.getUrl() : "",
        spreadsheetId: ss ? ss.getId() : ""
      });
    } catch (err) {
      return createJsonResponse({
        status: "ok",
        message: "Google Apps Script đang hoạt động!",
        email: userEmail,
        error: err.toString()
      });
    }
  }

  // 2. Lấy toàn bộ danh sách chi tiêu và thống kê trong tháng
  if (action === "getMonthData" || action === "getTransactions") {
    try {
      const now = new Date();
      const year = e.parameter.year ? parseInt(e.parameter.year) : now.getFullYear();
      const month = e.parameter.month ? String(e.parameter.month).padStart(2, "0") : String(now.getMonth() + 1).padStart(2, "0");
      
      const data = getMonthData(year, month);
      data.email = userEmail;
      return createJsonResponse(data);
    } catch (err) {
      return createJsonResponse({ success: false, error: err.toString(), email: userEmail });
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
        categories: data.categories,
        email: userEmail,
        spreadsheetUrl: data.spreadsheetUrl
      });
    } catch (err) {
      return createJsonResponse({ success: false, error: err.toString(), email: userEmail });
    }
  }

  // 4. Xóa một giao dịch theo dòng
  if (action === "delete") {
    try {
      const year = parseInt(e.parameter.year) || new Date().getFullYear();
      const month = String(e.parameter.month || (new Date().getMonth() + 1)).padStart(2, "0");
      const row = parseInt(e.parameter.row);

      const result = deleteTransactionRow(year, month, row);
      result.email = userEmail;
      return createJsonResponse(result);
    } catch (err) {
      return createJsonResponse({ success: false, error: err.toString(), email: userEmail });
    }
  }

  // 5. Mặc định: Phục vụ trực tiếp giao diện Web HTML nếu mở qua browser
  try {
    return HtmlService.createHtmlOutputFromFile("index")
      .setTitle("Quản Lý Chi Tiêu")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return createJsonResponse({
      status: "ok",
      message: "Google Apps Script Quản Lý Chi Tiêu sẵn sàng!",
      email: userEmail
    });
  }
}

/**
 * Xử lý yêu cầu POST: Thêm mới hoặc xóa giao dịch
 */
function doPost(e) {
  const userEmail = getConnectedEmail();
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
      const res = deleteTransactionRow(year, month, row);
      res.email = userEmail;
      return createJsonResponse(res);
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
    if (!ss) {
      throw new Error("Không thể mở hoặc tìm thấy Google Spreadsheet cho năm " + year);
    }

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
      spreadsheetUrl: ss.getUrl(),
      email: userEmail
    });
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString(),
      email: userEmail
    });
  }
}

/**
 * Đọc toàn bộ dữ liệu chi tiêu trong tháng từ Google Sheets
 */
function getMonthData(year, month) {
  const ss = getOrCreateSpreadsheet(year);
  if (!ss) {
    throw new Error("Không thể kết nối đến file Google Sheets của năm " + year);
  }

  const sheetName = "Tháng " + String(month).padStart(2, "0") + "-" + year;
  const monthCategories = getCategoriesForMonth(month, year);

  // Lấy danh sách các sheet tháng sẵn có
  const availableMonths = [];
  try {
    const allSheets = ss.getSheets();
    for (let s = 0; s < allSheets.length; s++) {
      const sName = allSheets[s].getName();
      if (sName.toLowerCase().indexOf("tháng") !== -1) {
        availableMonths.push(sName);
      }
    }
  } catch (e) {}

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
      categories: monthCategories.map(c => ({ name: c, total: 0 })),
      transactions: [],
      availableMonths: availableMonths
    };
  }

  const lastRow = sheet.getLastRow();
  const transactions = [];

  if (lastRow >= 2) {
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

  // Đọc danh mục tổng hợp từ F2:G9 (hoặc dùng danh mục theo tháng)
  const catSummary = [];
  try {
    const catRange = sheet.getRange("F2:G9").getValues();
    for (let c = 0; c < catRange.length; c++) {
      const cName = String(catRange[c][0] || monthCategories[c] || "");
      const cTotal = Number(catRange[c][1]) || 0;
      catSummary.push({ name: cName, total: cTotal });
    }
  } catch (e) {
    monthCategories.forEach(c => {
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
  if (!ss) {
    throw new Error("Không thể mở file Google Sheets");
  }

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
    newTotal: typeof newTotal === "number" ? newTotal : 0,
    spreadsheetUrl: ss.getUrl()
  };
}

/**
 * Tìm hoặc tạo file Google Spreadsheet theo năm tương ứng:
 * 1. Ưu tiên lấy trực tiếp Spreadsheet đang chứa script (Container-bound script)
 * 2. Tìm theo tên trong Drive
 * 3. Nếu chưa có, tạo mới
 */
function getOrCreateSpreadsheet(year) {
  // 1. Nếu script gắn liền với file Google Sheets (tiện ích mở rộng -> Apps Script)
  try {
    const activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) {
      return activeSs;
    }
  } catch (e) {}

  const targetName = BASE_FILE_NAME + " " + year;
  
  // 2. Tìm theo tên trên Google Drive
  try {
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
  } catch (e) {}

  // 3. Tạo mới nếu chưa có
  try {
    return SpreadsheetApp.create(targetName);
  } catch (e) {
    return null;
  }
}

/**
 * Tìm hoặc tạo tab tháng với định dạng chuẩn
 */
function getOrCreateMonthSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    return sheet;
  }

  // Tách tháng và năm từ sheetName ("Tháng MM-YYYY")
  const parts = sheetName.replace("Tháng ", "").split("-");
  const month = parts[0] || "10";
  const year = parts[1] || "2026";
  const categories = getCategoriesForMonth(month, year);

  sheet = ss.insertSheet(sheetName);

  // 1. Tiêu đề bảng chi tiết (Cột A-D)
  const headers = [["Ngày", "Danh mục", "Số tiền", "Ghi chú"]];
  const headerRange = sheet.getRange(1, 1, 1, 4);
  headerRange.setValues(headers);
  headerRange.setBackground("#1E88E5");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  sheet.setRowHeight(1, 30);

  // 2. Tiêu đề khối tổng hợp (Cột F & G)
  const summaryHeaders = [["Danh mục tổng", "Tổng chi tiêu"]];
  const summaryHeaderRange = sheet.getRange(1, 6, 1, 2);
  summaryHeaderRange.setValues(summaryHeaders);
  summaryHeaderRange.setBackground("#43A047");
  summaryHeaderRange.setFontColor("#FFFFFF");
  summaryHeaderRange.setFontWeight("bold");
  summaryHeaderRange.setHorizontalAlignment("center");

  // 3. Điền 8 danh mục và công thức SUMIF
  for (let i = 0; i < categories.length; i++) {
    const row = 2 + i;
    sheet.getRange(row, 6).setValue(categories[i]).setHorizontalAlignment("center");
    sheet.getRange(row, 7).setFormula("=SUMIF(B:B, F" + row + ", C:C)").setNumberFormat("#,##0").setHorizontalAlignment("right");
    sheet.setRowHeight(row, 22);
  }

  // 4. Ô Tổng trong tháng
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
 * Tiện ích trả về JSON
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
