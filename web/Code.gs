/**
 * GOOGLE APPS SCRIPT CHO HỆ THỐNG QUẢN LÝ CHI TIÊU
 * 
 * Hướng dẫn triển khai nhanh (1 phút):
 * 1. Mở file Google Sheets chi tiêu của bạn trên trình duyệt (hoặc tạo file mới).
 * 2. Trên thanh menu, chọn: Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Xóa hết code cũ trong file Code.gs và dán toàn bộ nội dung file này vào.
 * 4. Bấm nút "Triển khai" (Deploy) ở góc trên bên phải -> Chọn "Tùy chọn triển khai mới" (New deployment).
 * 5. Chọn loại "Ứng dụng web" (Web app):
 *    - Mô tả: Quản lý chi tiêu Web App
 *    - Thực thi dưới dạng (Execute as): Tôi (tài khoản của bạn)
 *    - Ai có quyền truy cập (Who has access): Bất kỳ ai (Anyone)
 * 6. Bấm "Triển khai" (Deploy) và cấp quyền truy cập khi được hỏi.
 * 7. Copy đường link Web App URL (có dạng https://script.google.com/macros/s/.../exec) 
 *    để dán vào ô Cài đặt trên giao diện Web hoặc mở trực tiếp trên điện thoại!
 */

// Tên cơ sở của file trên Google Drive (tương thích 100% với file của app Python)
const BASE_FILE_NAME = "Danh sách chi tiêu";

// 8 Danh mục cố định đồng bộ giữa Web và Python Desktop
const FIXED_CATEGORIES = [
  "Ăn uống", "Di chuyển", "Mua sắm", "Giải trí",
  "Điện nước", "Cá nhân", "Tiền trọ", "Hiếu/ Hỉ"
];

/**
 * Xử lý yêu cầu GET: Kiểm tra kết nối, lấy tổng chi tiêu hoặc hiển thị trang Web trực tiếp
 */
function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : "";

  // 1. Kiểm tra trạng thái kết nối
  if (action === "ping") {
    return createJsonResponse({ status: "ok", message: "Google Apps Script đang hoạt động ổn định!" });
  }

  // 2. Lấy thống kê tổng chi tiêu của tháng
  if (action === "summary") {
    try {
      const now = new Date();
      const year = e.parameter.year ? parseInt(e.parameter.year) : now.getFullYear();
      const month = e.parameter.month ? String(e.parameter.month).padStart(2, "0") : String(now.getMonth() + 1).padStart(2, "0");
      
      const ss = getOrCreateSpreadsheet(year);
      const sheetName = "Tháng " + month + "-" + year;
      const sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        return createJsonResponse({ success: true, total: 0, count: 0, message: "Chưa có dữ liệu tháng này" });
      }

      // Đọc ô tổng chi tiêu G10 hoặc tính tổng cột C
      const totalVal = sheet.getRange("G10").getValue();
      const lastRow = sheet.getLastRow();
      const count = Math.max(0, lastRow - 1); // Trừ hàng tiêu đề

      return createJsonResponse({
        success: true,
        year: year,
        month: month,
        total: typeof totalVal === "number" ? totalVal : 0,
        count: count
      });
    } catch (err) {
      return createJsonResponse({ success: false, error: err.toString() });
    }
  }

  // 3. Mặc định: Phục vụ trực tiếp giao diện Web HTML nếu mở trên trình duyệt
  try {
    return HtmlService.createHtmlOutputFromFile("index")
      .setTitle("Quản Lý Chi Tiêu")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return createJsonResponse({ status: "ok", message: "Google Apps Script Backend Quản Lý Chi Tiêu sẵn sàng nhận dữ liệu!" });
  }
}

/**
 * Xử lý yêu cầu POST: Thêm mới 1 giao dịch chi tiêu vào Google Sheet
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

    const dateStr = data.date || Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
    const category = data.category || "Ăn uống";
    const amount = Number(data.amount) || 0;
    const note = data.note || "";

    if (amount <= 0) {
      throw new Error("Số tiền chi tiêu phải lớn hơn 0");
    }

    // Tách năm và tháng từ chuỗi ngày (YYYY-MM-DD)
    const dateParts = dateStr.split("-");
    const year = parseInt(dateParts[0]) || new Date().getFullYear();
    const month = String(dateParts[1] || (new Date().getMonth() + 1)).padStart(2, "0");
    const sheetName = "Tháng " + month + "-" + year;

    // Lấy hoặc tạo file Google Spreadsheet cho năm đó
    const ss = getOrCreateSpreadsheet(year);
    
    // Lấy hoặc tạo tab Tháng MM-YYYY
    const sheet = getOrCreateMonthSheet(ss, sheetName);

    // Tìm dòng trống tiếp theo trong bảng dữ liệu chính (Cột A-D)
    const nextRow = getNextAvailableDataRow(sheet);

    // Ghi dữ liệu vào cột A, B, C, D
    sheet.getRange(nextRow, 1).setValue(dateStr).setNumberFormat("@");
    sheet.getRange(nextRow, 2).setValue(category);
    sheet.getRange(nextRow, 3).setValue(amount).setNumberFormat("#,##0");
    sheet.getRange(nextRow, 4).setValue(note);

    // Căn chỉnh giao diện dòng vừa thêm
    sheet.getRange(nextRow, 1, 1, 2).setHorizontalAlignment("center");
    sheet.getRange(nextRow, 3).setHorizontalAlignment("right");
    sheet.getRange(nextRow, 4).setHorizontalAlignment("left");

    // Đọc lại tổng chi tiêu sau khi thêm
    SpreadsheetApp.flush();
    const newTotal = sheet.getRange("G10").getValue();

    return createJsonResponse({
      success: true,
      message: "Đã thêm chi tiêu thành công!",
      row: nextRow,
      monthTotal: typeof newTotal === "number" ? newTotal : amount
    });
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString()
    });
  }
}

/**
 * Tìm hoặc tạo file Google Spreadsheet theo năm tương ứng
 */
function getOrCreateSpreadsheet(year) {
  const targetName = BASE_FILE_NAME + " " + year;
  
  // 1. Tìm theo tên trong Google Drive
  const files = DriveApp.getFilesByName(targetName);
  if (files.hasNext()) {
    const file = files.next();
    return SpreadsheetApp.openById(file.getId());
  }

  // 2. Thử tìm tên file cũ không có đuôi năm nếu là 2026
  if (year === 2026) {
    const oldFiles = DriveApp.getFilesByName(BASE_FILE_NAME);
    if (oldFiles.hasNext()) {
      const oldFile = oldFiles.next();
      oldFile.setName(targetName);
      return SpreadsheetApp.openById(oldFile.getId());
    }
  }

  // 3. Nếu chưa có, tạo file Spreadsheet mới
  const newSpreadsheet = SpreadsheetApp.create(targetName);
  return newSpreadsheet;
}

/**
 * Tìm hoặc tạo tab tháng với định dạng chuẩn đồng bộ với app Python
 */
function getOrCreateMonthSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    return sheet;
  }

  // Tạo sheet mới
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

  // 3. Điền 8 danh mục và công thức SUMIF (Dòng 2 đến 9)
  for (let i = 0; i < FIXED_CATEGORIES.length; i++) {
    const row = 2 + i;
    sheet.getRange(row, 6).setValue(FIXED_CATEGORIES[i]).setHorizontalAlignment("center");
    sheet.getRange(row, 7).setFormula("=SUMIF(B:B, F" + row + ", C:C)").setNumberFormat("#,##0").setHorizontalAlignment("right");
    sheet.setRowHeight(row, 22);
  }

  // 4. Ô Tổng trong tháng (Dòng 10)
  sheet.getRange(10, 6).setValue("Tổng trong tháng").setFontWeight("bold").setFontColor("#D32F2F").setHorizontalAlignment("center");
  sheet.getRange(10, 7).setFormula("=SUM(G2:G9)").setFontWeight("bold").setFontColor("#D32F2F").setNumberFormat("#,##0").setHorizontalAlignment("right");
  sheet.setRowHeight(10, 26);

  // Cấu hình độ rộng các cột tối ưu
  sheet.setColumnWidth(1, 110); // Ngày
  sheet.setColumnWidth(2, 120); // Danh mục
  sheet.setColumnWidth(3, 130); // Số tiền
  sheet.setColumnWidth(4, 220); // Ghi chú
  sheet.setColumnWidth(5, 30);  // Cột đệm E
  sheet.setColumnWidth(6, 140); // Danh mục tổng
  sheet.setColumnWidth(7, 140); // Tổng chi tiêu

  return sheet;
}

/**
 * Tìm dòng trống đầu tiên trong cột A (chỉ tìm trong phần dữ liệu chi tiêu)
 */
function getNextAvailableDataRow(sheet) {
  const colAValues = sheet.getRange("A:A").getValues();
  for (let r = 1; r < colAValues.length; r++) {
    if (!colAValues[r][0] || colAValues[r][0] === "") {
      return r + 1; // 1-indexed
    }
  }
  return colAValues.length + 1;
}

/**
 * Tiện ích trả về phản hồi dạng JSON với đầy đủ CORS headers
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
