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
    const eff = Session.getEffectiveUser().getEmail();
    if (eff && eff.trim() !== "") return eff;
  } catch (e) {}
  try {
    const act = Session.getActiveUser().getEmail();
    if (act && act.trim() !== "") return act;
  } catch (e) {}
  try {
    const now = new Date();
    const ss = getOrCreateSpreadsheet(now.getFullYear());
    if (ss) {
      const owner = ss.getOwner();
      if (owner && owner.getEmail()) return owner.getEmail();
      const editors = ss.getEditors();
      if (editors && editors.length > 0 && editors[0].getEmail()) {
        return editors[0].getEmail();
      }
    }
  } catch (e) {}
  try {
    const root = DriveApp.getRootFolder();
    const owner = root.getOwner();
    if (owner && owner.getEmail()) return owner.getEmail();
  } catch (e) {}
  return "";
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
  const prefix = e && e.parameter ? (e.parameter.prefix || e.parameter.callback || "") : "";
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
      }, prefix);
    } catch (err) {
      return createJsonResponse({
        status: "ok",
        message: "Google Apps Script đang hoạt động!",
        email: userEmail,
        error: err.toString()
      }, prefix);
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
      return createJsonResponse(data, prefix);
    } catch (err) {
      return createJsonResponse({ success: false, error: err.toString(), email: userEmail }, prefix);
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
      }, prefix);
    } catch (err) {
      return createJsonResponse({ success: false, error: err.toString(), email: userEmail }, prefix);
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
      return createJsonResponse(result, prefix);
    } catch (err) {
      return createJsonResponse({ success: false, error: err.toString(), email: userEmail }, prefix);
    }
  }

  // 5. Thêm giao dịch qua GET (dự phòng khi POST gặp trở ngại mạng)
  if (action === "add") {
    try {
      const dateStr = e.parameter.date || Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
      const category = e.parameter.category || "Ăn uống";
      const amount = Number(e.parameter.amount) || 0;
      const note = e.parameter.note || "";
      const addRes = addNewTransactionRecord(dateStr, category, amount, note);
      addRes.email = userEmail;
      return createJsonResponse(addRes, prefix);
    } catch (err) {
      return createJsonResponse({ success: false, error: err.toString(), email: userEmail }, prefix);
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

    const addRes = addNewTransactionRecord(dateStr, category, amount, note);
    addRes.email = userEmail;
    return createJsonResponse(addRes);
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString(),
      email: userEmail
    });
  }
}

/**
 * Hàm thêm một dòng giao dịch mới vào sheet tháng tương ứng
 */
function addNewTransactionRecord(dateStr, category, amount, note) {
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

  // Ghi nhanh dữ liệu cả dòng trong một thao tác duy nhất (tối ưu hóa tốc độ)
  sheet.getRange(nextRow, 1, 1, 4).setValues([[dateStr, category, amount, note]]);
  sheet.getRange(nextRow, 3).setNumberFormat("#,##0");

  return {
    success: true,
    message: "Đã thêm chi tiêu thành công!",
    row: nextRow,
    monthTotal: amount,
    spreadsheetUrl: ss.getUrl()
  };
}

/**
 * Tính toán tiền tiết kiệm cộng dồn từ Tháng 06 đến tháng hiện tại
 */
function calculateCumulativeSavings(ss, year, currentMonthNum) {
  const START_MONTH = 6; // Bắt đầu tính lũy kế từ Tháng 6

  // Nếu tháng hiện tại trước Tháng 6, chưa tính lũy kế
  if (currentMonthNum < START_MONTH) {
    return {
      cumulativeSavings: 0,
      savingsStartMonth: START_MONTH
    };
  }

  let cumulative = 0;

  for (let m = START_MONTH; m <= currentMonthNum; m++) {
    const sName = "Tháng " + String(m).padStart(2, "0") + "-" + year;
    const s = ss.getSheetByName(sName);
    if (!s) continue;
    const lRow = s.getLastRow();
    if (lRow < 2) continue;
    
    // Cột B (Danh mục), Cột C (Số tiền)
    const vals = s.getRange(2, 2, lRow - 1, 2).getValues();
    let mIncome = 0;
    let mExpense = 0;

    for (let r = 0; r < vals.length; r++) {
      const cat = String(vals[r][0] || "").trim();
      const amt = Number(vals[r][1]) || 0;
      if (amt <= 0) continue;
      if (cat === "Tiền lương" || cat === "Lương" || cat === "Thu nhập") {
        mIncome += amt;
      } else {
        mExpense += amt;
      }
    }

    cumulative += (mIncome - mExpense);
  }

  return {
    cumulativeSavings: cumulative,
    savingsStartMonth: START_MONTH
  };
}

/**
 * Đọc toàn bộ dữ liệu chi tiêu trong tháng từ Google Sheets
 */
function getMonthData(year, month) {
  const ss = getOrCreateSpreadsheet(year);
  if (!ss) {
    throw new Error("Không thể kết nối đến file Google Sheets của năm " + year);
  }

  const numMonth = parseInt(month) || 10;
  const monthStr = String(numMonth).padStart(2, "0");
  const sheetName = "Tháng " + monthStr + "-" + year;
  const monthCategories = getCategoriesForMonth(numMonth, year);

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
    const cumData = calculateCumulativeSavings(ss, year, numMonth);
    return {
      success: true,
      year: year,
      month: monthStr,
      sheetName: sheetName,
      spreadsheetUrl: ss.getUrl(),
      spreadsheetId: ss.getId(),
      total: 0,
      totalIncome: 0,
      monthSavings: 0,
      cumulativeSavings: cumData.cumulativeSavings,
      savingsStartMonth: cumData.savingsStartMonth,
      count: 0,
      categories: monthCategories.map(c => ({ name: c, total: 0 })),
      transactions: [],
      availableMonths: availableMonths
    };
  }

  const lastRow = sheet.getLastRow();
  const transactions = [];
  let totalIncome = 0;
  let totalExpense = 0;

  if (lastRow >= 2) {
    const rangeData = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    for (let i = 0; i < rangeData.length; i++) {
      const row = rangeData[i];
      let dateVal = row[0];
      const catVal = String(row[1] || "").trim();
      const amountVal = Number(row[2]) || 0;
      const noteVal = row[3] ? String(row[3]) : "";

      if (amountVal > 0 || catVal !== "") {
        if (dateVal instanceof Date) {
          dateVal = Utilities.formatDate(dateVal, "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
        } else {
          dateVal = String(dateVal || "").trim();
        }

        const isSalary = (catVal === "Tiền lương" || catVal === "Lương" || catVal === "Thu nhập");
        if (isSalary) {
          totalIncome += amountVal;
        } else {
          totalExpense += amountVal;
        }

        transactions.push({
          row: i + 2,
          date: dateVal,
          category: catVal || "Ăn uống",
          amount: amountVal,
          note: noteVal,
          type: isSalary ? "income" : "expense"
        });
      }
    }
  }

  // Đọc danh mục tổng hợp chi tiêu từ F2:G9
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
      const sum = transactions.filter(t => t.category === c && t.type !== "income").reduce((acc, t) => acc + t.amount, 0);
      catSummary.push({ name: c, total: sum });
    });
  }

  // Đọc ô tổng chi tiêu G10
  let g10Total = sheet.getRange("G10").getValue();
  if (typeof g10Total === "number" && !isNaN(g10Total) && g10Total > 0) {
    totalExpense = g10Total;
  }

  // Tính số tiền dư trong tháng (tiết kiệm tháng) = Lương (+) - Chi tiêu (-)
  const monthSavings = totalIncome - totalExpense;

  // Tính số tiền tiết kiệm cộng dồn từ tháng đầu tiên có giao dịch đến tháng hiện tại
  const cumData = calculateCumulativeSavings(ss, year, numMonth);

  return {
    success: true,
    year: year,
    month: monthStr,
    sheetName: sheetName,
    spreadsheetUrl: ss.getUrl(),
    spreadsheetId: ss.getId(),
    total: totalExpense,                         // Tổng chi tiêu (-)
    totalIncome: totalIncome,                   // Tiền lương / Thu nhập (+)
    monthSavings: monthSavings,                 // Số tiền dư trong tháng (tiết kiệm tháng)
    cumulativeSavings: cumData.cumulativeSavings, // Tiền tiết kiệm cộng dồn
    savingsStartMonth: cumData.savingsStartMonth, // Tháng bắt đầu có giao dịch
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

  // 4. Ô Tổng chi tiêu trong tháng
  sheet.getRange(10, 6).setValue("Tổng chi tiêu (-)").setFontWeight("bold").setFontColor("#D32F2F").setHorizontalAlignment("center");
  sheet.getRange(10, 7).setFormula("=SUM(G2:G9)").setFontWeight("bold").setFontColor("#D32F2F").setNumberFormat("#,##0").setHorizontalAlignment("right");
  sheet.setRowHeight(10, 26);

  // 5. Khối tài chính: Tiền lương (+) và Tiết kiệm
  sheet.getRange(12, 6).setValue("Tiền lương (+)").setFontWeight("bold").setFontColor("#16A34A").setHorizontalAlignment("center");
  sheet.getRange(12, 7).setFormula("=SUMIF(B:B, \"Tiền lương\", C:C)").setFontWeight("bold").setFontColor("#16A34A").setNumberFormat("#,##0").setHorizontalAlignment("right");
  sheet.setRowHeight(12, 24);

  sheet.getRange(13, 6).setValue("Tiết kiệm tháng").setFontWeight("bold").setFontColor("#0D9488").setHorizontalAlignment("center");
  sheet.getRange(13, 7).setFormula("=G12-G10").setFontWeight("bold").setFontColor("#0D9488").setNumberFormat("#,##0").setHorizontalAlignment("right");
  sheet.setRowHeight(13, 24);

  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 130);
  sheet.setColumnWidth(4, 220);
  sheet.setColumnWidth(5, 30);
  sheet.setColumnWidth(6, 150);
  sheet.setColumnWidth(7, 150);

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
 * Tiện ích trả về JSON hoặc JSONP (nếu có prefix / callback)
 */
function createJsonResponse(data, prefix) {
  const jsonStr = JSON.stringify(data);
  if (prefix && typeof prefix === "string" && prefix.trim() !== "") {
    return ContentService.createTextOutput(prefix + "(" + jsonStr + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}
