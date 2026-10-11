// Biểu tượng tương ứng cho từng danh mục
const CATEGORY_ICONS = {
  "Ăn uống": "🍜",
  "Di chuyển": "🛵",
  "Mua sắm": "🛍️",
  "Giải trí": "🎬",
  "Điện nước": "💡",
  "Bố Mẹ": "👨‍👩‍👦",
  "Cá nhân": "👤",
  "Tiền trọ": "🏠",
  "Hiếu/ Hỉ": "💌"
};

const STORAGE_KEYS = {
  API_URL: "qly_expense_api_url",
  SHEET_URL: "qly_expense_sheet_url",
  EMAIL: "qly_expense_user_email",
  LAST_YEAR: "qly_expense_selected_year",
  LAST_MONTH: "qly_expense_selected_month"
};

// State toàn cục của ứng dụng
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1; // 1 - 12
let monthTransactions = []; // Danh sách chi tiêu lấy từ Google Sheets
let categoryTotals = [];    // Tổng theo từng danh mục
let activeCatFilter = "ALL";
let searchKeyword = "";
let isSyncing = false;

// DOM Elements
const btnPrevMonth = document.getElementById("btnPrevMonth");
const btnNextMonth = document.getElementById("btnNextMonth");
const currentMonthText = document.getElementById("currentMonthText");
const totalMonthAmount = document.getElementById("totalMonthAmount");
const entryCountText = document.getElementById("entryCountText");
const listTotalHeader = document.getElementById("listTotalHeader");
const listTitleMonth = document.getElementById("listTitleMonth");
const btnSyncServer = document.getElementById("btnSyncServer");
const syncText = document.getElementById("syncText");

const btnOpenSheet = document.getElementById("btnOpenSheet");
const linkOpenSheet = document.getElementById("linkOpenSheet");
const lastSyncTimeText = document.getElementById("lastSyncTimeText");
const connectedEmailText = document.getElementById("connectedEmailText");

const connectionStatus = document.getElementById("connectionStatus");
const statusText = document.getElementById("statusText");

// Form Elements
const expenseForm = document.getElementById("expenseForm");
const expenseDate = document.getElementById("expenseDate");
const expenseAmount = document.getElementById("expenseAmount");
const categoryGrid = document.getElementById("categoryGrid");
const selectedCategoryInput = document.getElementById("selectedCategory");
const expenseNote = document.getElementById("expenseNote");
const btnSubmit = document.getElementById("btnSubmit");
const btnSubmitText = document.getElementById("btnSubmitText");
const btnSpinner = document.getElementById("btnSpinner");
const chipButtons = document.querySelectorAll(".chip-btn[data-add]");
const btnClearAmount = document.getElementById("btnClearAmount");

// List & Filter Elements
const searchTransactionInput = document.getElementById("searchTransactionInput");
const categoryFilterPills = document.getElementById("categoryFilterPills");
const transactionsContainer = document.getElementById("transactionsContainer");
const categoryBreakdownContainer = document.getElementById("categoryBreakdownContainer");

// Modal Elements
const btnSettings = document.getElementById("btnSettings");
const settingsModal = document.getElementById("settingsModal");
const btnCloseSettings = document.getElementById("btnCloseSettings");
const btnSaveSettings = document.getElementById("btnSaveSettings");
const btnTestConnection = document.getElementById("btnTestConnection");
const apiUrlInput = document.getElementById("apiUrlInput");
const diagResultBox = document.getElementById("diagResultBox");

// Toast
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const toastIcon = document.getElementById("toastIcon");

/**
 * Lấy danh sách 8 danh mục theo tháng:
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

// --- 1. KHỞI CHẠY ỨNG DỤNG ---
function initApp() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  expenseDate.value = `${yyyy}-${mm}-${dd}`;

  currentYear = yyyy;
  currentMonth = today.getMonth() + 1;

  // Cập nhật danh mục theo tháng hiện tại
  renderCategoryGrid(currentMonth, currentYear);
  renderFilterPills(currentMonth, currentYear);
  updateMonthDisplay();

  // Đọc URL Google Apps Script đã lưu
  const savedUrl = (localStorage.getItem(STORAGE_KEYS.API_URL) || "").trim();
  apiUrlInput.value = savedUrl;
  updateConnectionUI(Boolean(savedUrl));

  // Đọc URL Google Sheets đã lưu
  const savedSheetUrl = localStorage.getItem(STORAGE_KEYS.SHEET_URL);
  if (savedSheetUrl) {
    updateSpreadsheetLinks(savedSheetUrl);
  }

  // Đọc Email đã lưu
  const savedEmail = localStorage.getItem(STORAGE_KEYS.EMAIL);
  if (savedEmail) {
    updateConnectedEmail(savedEmail);
  }

  // Tải dữ liệu từ cache local trước để hiển thị tức thì
  loadMonthCache();

  // Tự động đồng bộ ngay lập tức từ Google Sheets khi mở web
  if (savedUrl) {
    if (lastSyncTimeText) {
      lastSyncTimeText.innerText = "⏳ Đang tự động cập nhật Drive...";
    }
    syncMonthDataFromServer(false);
  } else {
    if (lastSyncTimeText) {
      lastSyncTimeText.innerText = "Chưa kết nối Google Apps Script";
    }
  }
}

// Render lưới danh mục chi tiêu theo tháng
function renderCategoryGrid(month, year) {
  if (!categoryGrid) return;
  const cats = getCategoriesForMonth(month, year);
  const currentSelected = selectedCategoryInput.value;
  const newSelected = cats.includes(currentSelected) ? currentSelected : cats[0];
  selectedCategoryInput.value = newSelected;

  categoryGrid.innerHTML = cats.map((cat) => {
    const isSel = cat === newSelected;
    const icon = CATEGORY_ICONS[cat] || "💸";
    return `
      <div class="category-option ${isSel ? "selected" : ""}" data-category="${cat}">
        <span class="cat-icon">${icon}</span>
        <span class="cat-name">${cat}</span>
      </div>
    `;
  }).join("");

  // Gán sự kiện click cho các ô danh mục
  categoryGrid.querySelectorAll(".category-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      categoryGrid.querySelectorAll(".category-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      selectedCategoryInput.value = opt.getAttribute("data-category");
    });
  });
}

// Render các nút lọc danh mục
function renderFilterPills(month, year) {
  if (!categoryFilterPills) return;
  const cats = getCategoriesForMonth(month, year);
  
  categoryFilterPills.innerHTML = `
    <button class="filter-pill ${activeCatFilter === "ALL" ? "active" : ""}" data-cat="ALL">Tất cả</button>
  ` + cats.map((cat) => {
    const icon = CATEGORY_ICONS[cat] || "💸";
    return `
      <button class="filter-pill ${activeCatFilter === cat ? "active" : ""}" data-cat="${cat}">${icon} ${cat}</button>
    `;
  }).join("");

  categoryFilterPills.querySelectorAll(".filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      categoryFilterPills.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      activeCatFilter = pill.getAttribute("data-cat");
      renderTransactionsList();
    });
  });
}

// Khi người dùng chọn ngày khác trên form, tự động cập nhật danh mục nếu chuyển qua tháng khác
expenseDate.addEventListener("change", (e) => {
  const val = e.target.value;
  if (val) {
    const parts = val.split("-");
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    renderCategoryGrid(m, y);
  }
});

// Cập nhật nhãn tháng trên giao diện
function updateMonthDisplay() {
  const mmStr = String(currentMonth).padStart(2, "0");
  const text = `Tháng ${mmStr}-${currentYear}`;
  currentMonthText.innerText = text;
  listTitleMonth.innerText = `Các khoản chi ${text}`;
}

// Chuyển tháng trước
btnPrevMonth.addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 1) {
    currentMonth = 12;
    currentYear--;
  }
  updateMonthDisplay();
  renderCategoryGrid(currentMonth, currentYear);
  renderFilterPills(currentMonth, currentYear);
  loadMonthCache();
  syncMonthDataFromServer();
});

// Chuyển tháng sau
btnNextMonth.addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 12) {
    currentMonth = 1;
    currentYear++;
  }
  updateMonthDisplay();
  renderCategoryGrid(currentMonth, currentYear);
  renderFilterPills(currentMonth, currentYear);
  loadMonthCache();
  syncMonthDataFromServer();
});

function updateSpreadsheetLinks(url) {
  if (linkOpenSheet) {
    linkOpenSheet.href = url || "https://docs.google.com/spreadsheets/u/0/";
  }
}

function updateConnectedEmail(email) {
  if (connectedEmailText) {
    connectedEmailText.innerText = email || "Chưa xác định";
  }
}

function openGoogleSheet() {
  const url = localStorage.getItem(STORAGE_KEYS.SHEET_URL) || "https://docs.google.com/spreadsheets/u/0/";
  window.open(url, "_blank");
}

if (btnOpenSheet) {
  btnOpenSheet.addEventListener("click", openGoogleSheet);
}

// --- 2. FORMAT TIỀN TỆ & CÁC NÚT BẤM NHANH ---
function formatCurrencyNumber(value) {
  if (value === undefined || value === null) return "0";
  const num = Number(value.toString().replace(/\D/g, "")) || 0;
  return num.toLocaleString("vi-VN");
}

function parseCurrencyNumber(formattedString) {
  if (!formattedString) return 0;
  return Number(formattedString.toString().replace(/\D/g, "")) || 0;
}

expenseAmount.addEventListener("input", (e) => {
  const cursorPosition = e.target.selectionStart;
  const originalLength = e.target.value.length;
  const formatted = formatCurrencyNumber(e.target.value);
  e.target.value = formatted;
  const newLength = formatted.length;
  e.target.setSelectionRange(cursorPosition + (newLength - originalLength), cursorPosition + (newLength - originalLength));
});

chipButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const addVal = Number(btn.getAttribute("data-add")) || 0;
    const currentVal = parseCurrencyNumber(expenseAmount.value);
    expenseAmount.value = formatCurrencyNumber(currentVal + addVal);
  });
});

btnClearAmount.addEventListener("click", () => {
  expenseAmount.value = "";
  expenseAmount.focus();
});

// --- 3. ĐỒNG BỘ DỮ LIỆU TỪ GOOGLE SHEETS ---
async function syncMonthDataFromServer(isSilent = false) {
  const apiUrl = (localStorage.getItem(STORAGE_KEYS.API_URL) || "").trim();
  if (!apiUrl) {
    updateConnectionUI(false);
    return;
  }

  if (isSyncing) return;
  setSyncingState(true);

  try {
    const targetUrl = `${apiUrl}?action=getMonthData&year=${currentYear}&month=${currentMonth}`;
    const res = await fetch(targetUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data && data.success) {
      monthTransactions = data.transactions || [];
      categoryTotals = data.categories || [];

      // Lưu URL Google Sheets
      if (data.spreadsheetUrl) {
        localStorage.setItem(STORAGE_KEYS.SHEET_URL, data.spreadsheetUrl);
        updateSpreadsheetLinks(data.spreadsheetUrl);
      }

      // Lưu Email liên kết
      if (data.email) {
        localStorage.setItem(STORAGE_KEYS.EMAIL, data.email);
        updateConnectedEmail(data.email);
      }

      // Cập nhật cache local
      saveMonthCache(data);

      // Render lại giao diện
      renderAllViews(data.total);
      updateConnectionUI(true);

      const timeStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      if (lastSyncTimeText) {
        lastSyncTimeText.innerText = `✅ Đã đồng bộ Drive (${timeStr})`;
      }
      if (statusText) {
        statusText.innerText = `Đã đồng bộ (${timeStr})`;
      }
    } else {
      throw new Error(data.error || "Google Apps Script phản hồi lỗi hoặc đang chạy phiên bản cũ.");
    }
  } catch (err) {
    console.warn("Lỗi đồng bộ từ server:", err);
    if (!isSilent) {
      showToast("Không thể tải dữ liệu từ Google Sheets: " + err.message, "error");
    }
    if (lastSyncTimeText) {
      lastSyncTimeText.innerText = "⚠️ Lỗi đồng bộ dữ liệu";
    }
  } finally {
    setSyncingState(false);
  }
}

btnSyncServer.addEventListener("click", () => {
  syncMonthDataFromServer();
});

function setSyncingState(syncing) {
  isSyncing = syncing;
  if (syncing) {
    btnSyncServer.classList.add("spinning");
    syncText.innerText = "Đang tải...";
  } else {
    btnSyncServer.classList.remove("spinning");
    syncText.innerText = "Đồng bộ";
  }
}

// Quản lý bộ nhớ đệm (Cache) theo tháng
function getCacheKey() {
  return `qly_cache_${currentYear}_${currentMonth}`;
}

function saveMonthCache(data) {
  try {
    localStorage.setItem(getCacheKey(), JSON.stringify(data));
  } catch (e) {}
}

function loadMonthCache() {
  try {
    const raw = localStorage.getItem(getCacheKey());
    if (raw) {
      const data = JSON.parse(raw);
      monthTransactions = data.transactions || [];
      categoryTotals = data.categories || [];
      renderAllViews(data.total);
      return;
    }
  } catch (e) {}

  monthTransactions = [];
  categoryTotals = [];
  renderAllViews(0);
}

// --- 4. HIỂN THỊ DỮ LIỆU LÊN GIAO DIỆN ---
function renderAllViews(totalAmount) {
  const computedTotal = totalAmount !== undefined ? totalAmount : monthTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const formattedTotal = `${formatCurrencyNumber(computedTotal)} ₫`;

  totalMonthAmount.innerText = formattedTotal;
  listTotalHeader.innerText = formattedTotal;
  entryCountText.innerText = `${monthTransactions.length} khoản chi trên Drive`;

  renderTransactionsList();
  renderCategoryBreakdown(computedTotal);
}

// Render danh sách chi tiêu trong tháng
function renderTransactionsList() {
  if (!transactionsContainer) return;

  let filtered = monthTransactions.filter((item) => {
    const matchCategory = activeCatFilter === "ALL" || item.category === activeCatFilter;
    const query = searchKeyword.toLowerCase();
    const matchSearch = !query || 
      (item.note && item.note.toLowerCase().includes(query)) ||
      (item.category && item.category.toLowerCase().includes(query)) ||
      (item.date && item.date.includes(query)) ||
      (item.amount && item.amount.toString().includes(query));
    return matchCategory && matchSearch;
  });

  if (filtered.length === 0) {
    if (monthTransactions.length === 0) {
      transactionsContainer.innerHTML = `
        <div class="empty-state">
          <p>Chưa có khoản chi nào trong Tháng ${String(currentMonth).padStart(2, "0")}-${currentYear}.</p>
          <p style="margin-top: 6px; font-size: 0.75rem;">Hãy nhập khoản chi ở <strong>cột bên trái</strong> để ghi lại chi tiêu đầu tiên!</p>
        </div>
      `;
    } else {
      transactionsContainer.innerHTML = `<div class="empty-state">Không tìm thấy khoản chi nào phù hợp với bộ lọc.</div>`;
    }
    return;
  }

  // Sắp xếp mới nhất lên đầu
  filtered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  transactionsContainer.innerHTML = filtered.map((item) => {
    const icon = CATEGORY_ICONS[item.category] || "💸";
    const noteDisplay = item.note ? escapeHtml(item.note) : "(Không ghi chú)";
    return `
      <div class="transaction-card">
        <div class="trans-left">
          <div class="trans-icon-box">${icon}</div>
          <div class="trans-info">
            <div class="trans-info-top">
              <span class="trans-category">${escapeHtml(item.category)}</span>
              <span class="trans-date">${item.date || ""}</span>
            </div>
            <div class="trans-note" title="${noteDisplay}">${noteDisplay}</div>
          </div>
        </div>
        <div class="trans-right">
          <span class="trans-amount">-${formatCurrencyNumber(item.amount)} ₫</span>
          <button class="btn-delete-trans" title="Xóa khoản chi này trên Google Sheets" onclick="handleDeleteTransaction(${item.row})">🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

// Render cơ cấu chi tiêu danh mục
function renderCategoryBreakdown(totalMonth) {
  if (!categoryBreakdownContainer) return;

  const validTotal = totalMonth > 0 ? totalMonth : 1;
  const currentCats = getCategoriesForMonth(currentMonth, currentYear);

  const catSums = {};
  currentCats.forEach(c => catSums[c] = 0);
  monthTransactions.forEach(t => {
    if (catSums[t.category] !== undefined) {
      catSums[t.category] += Number(t.amount) || 0;
    } else {
      catSums[t.category] = (catSums[t.category] || 0) + (Number(t.amount) || 0);
    }
  });

  const sortedCats = Object.keys(catSums).map(name => ({
    name: name,
    total: catSums[name],
    percent: Math.round((catSums[name] / validTotal) * 100)
  })).sort((a, b) => b.total - a.total);

  if (totalMonth === 0) {
    categoryBreakdownContainer.innerHTML = `<div class="empty-state">Chưa có chi tiêu nào trong tháng để phân tích.</div>`;
    return;
  }

  categoryBreakdownContainer.innerHTML = sortedCats.map(cat => {
    const icon = CATEGORY_ICONS[cat.name] || "💸";
    return `
      <div class="breakdown-item">
        <div class="breakdown-header">
          <span>${icon} ${cat.name} (${cat.percent}%)</span>
          <span style="font-weight: 700; color: #1e40af;">${formatCurrencyNumber(cat.total)} ₫</span>
        </div>
        <div class="breakdown-bar-bg">
          <div class="breakdown-bar-fill" style="width: ${cat.percent}%;"></div>
        </div>
      </div>
    `;
  }).join("");
}

// Xử lý tìm kiếm
searchTransactionInput.addEventListener("input", (e) => {
  searchKeyword = e.target.value.trim();
  renderTransactionsList();
});

// Xử lý xóa khoản chi
window.handleDeleteTransaction = async function(row) {
  if (!confirm(`Bạn có chắc chắn muốn xóa dòng chi tiêu này khỏi Google Sheets không?`)) {
    return;
  }

  const apiUrl = (localStorage.getItem(STORAGE_KEYS.API_URL) || "").trim();
  if (!apiUrl) {
    showToast("Chưa cấu hình URL Google Apps Script!", "error");
    return;
  }

  showToast("Đang xóa trên Google Sheets...", "success");

  try {
    const deleteUrl = `${apiUrl}?action=delete&year=${currentYear}&month=${currentMonth}&row=${row}`;
    const res = await fetch(deleteUrl);
    const result = await res.json();
    if (result && result.success) {
      showToast("Đã xóa chi tiêu thành công!", "success");
      syncMonthDataFromServer();
    } else {
      throw new Error(result.error || "Không thể xóa dòng");
    }
  } catch (e) {
    showToast("Lỗi khi xóa: " + e.message, "error");
  }
};

// --- 5. GỬI CHI TIÊU MỚI LÊN GOOGLE SHEETS ---
expenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const dateVal = expenseDate.value;
  const amountVal = parseCurrencyNumber(expenseAmount.value);
  const categoryVal = selectedCategoryInput.value;
  const noteVal = expenseNote.value.trim();

  if (!amountVal || amountVal <= 0) {
    showToast("Vui lòng nhập số tiền hợp lệ!", "error");
    expenseAmount.focus();
    return;
  }

  const payload = {
    date: dateVal,
    category: categoryVal,
    amount: amountVal,
    note: noteVal
  };

  const apiUrl = (localStorage.getItem(STORAGE_KEYS.API_URL) || "").trim();
  setLoadingState(true);

  try {
    if (apiUrl) {
      await fetch(apiUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      showToast("Đã lưu & đồng bộ thành công vào Google Sheet!", "success");
    } else {
      showToast("Chưa có URL Google Apps Script để đồng bộ!", "error");
      openSettings();
    }

    expenseAmount.value = "";
    expenseNote.value = "";
    expenseAmount.focus();

    const inputYear = parseInt(dateVal.split("-")[0]);
    const inputMonth = parseInt(dateVal.split("-")[1]);
    if (inputYear === currentYear && inputMonth === currentMonth) {
      setTimeout(() => syncMonthDataFromServer(), 1200);
    }
  } catch (err) {
    console.error("Lỗi gửi dữ liệu:", err);
    showToast("Lỗi gửi dữ liệu: " + err.message, "error");
  } finally {
    setLoadingState(false);
  }
});

function setLoadingState(isLoading) {
  btnSubmit.disabled = isLoading;
  if (isLoading) {
    btnSubmitText.innerText = "Đang lưu lên Drive...";
    btnSpinner.style.display = "block";
  } else {
    btnSubmitText.innerText = "💾 Lưu & Đồng bộ lên Drive";
    btnSpinner.style.display = "none";
  }
}

// --- 6. CÀI ĐẶT & CHẨN ĐOÁN LỖI KẾT NỐI ---
function openSettings() {
  settingsModal.classList.add("active");
  apiUrlInput.value = localStorage.getItem(STORAGE_KEYS.API_URL) || "";
  diagResultBox.className = "diag-box";
  diagResultBox.innerHTML = "";
}

function closeSettings() {
  settingsModal.classList.remove("active");
}

btnSettings.addEventListener("click", openSettings);
btnCloseSettings.addEventListener("click", closeSettings);

settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) closeSettings();
});

btnSaveSettings.addEventListener("click", () => {
  const url = apiUrlInput.value.trim();
  if (url) {
    localStorage.setItem(STORAGE_KEYS.API_URL, url);
    updateConnectionUI(true);
    showToast("Đã lưu URL kết nối thành công!", "success");
    syncMonthDataFromServer();
  } else {
    localStorage.removeItem(STORAGE_KEYS.API_URL);
    updateConnectionUI(false);
    showToast("Đã xóa URL kết nối.", "error");
  }
  closeSettings();
});

btnTestConnection.addEventListener("click", async () => {
  const url = apiUrlInput.value.trim();
  if (!url) {
    showToast("Vui lòng nhập Web App URL trước!", "error");
    return;
  }

  btnTestConnection.innerText = "Đang kiểm tra...";
  btnTestConnection.disabled = true;
  diagResultBox.className = "diag-box show";
  diagResultBox.innerHTML = "⏳ Đang bắt đầu kiểm tra kết nối...";

  let logs = [];

  // Bước 1: Kiểm tra URL
  if (!url.includes("script.google.com") || !url.includes("/exec")) {
    logs.push("⚠️ Cảnh báo: URL chưa có đuôi /exec (Đảm bảo là URL Web App, không phải URL chỉnh sửa code)");
  } else {
    logs.push("✓ Định dạng URL hợp lệ");
  }

  // Bước 2: Kiểm tra Ping
  try {
    const pingRes = await fetch(`${url}?action=ping`);
    if (pingRes.ok) {
      const pingData = await pingRes.json();
      logs.push(`✓ Kết nối máy chủ thành công (HTTP ${pingRes.status})`);
      if (pingData.email) {
        logs.push(`📧 Tài khoản Google liên kết: ${pingData.email}`);
        localStorage.setItem(STORAGE_KEYS.EMAIL, pingData.email);
        updateConnectedEmail(pingData.email);
      }
      if (pingData.spreadsheetUrl) {
        localStorage.setItem(STORAGE_KEYS.SHEET_URL, pingData.spreadsheetUrl);
        updateSpreadsheetLinks(pingData.spreadsheetUrl);
      }
    } else {
      logs.push(`❌ Máy chủ trả về mã lỗi: HTTP ${pingRes.status}`);
    }
  } catch (e) {
    logs.push(`❌ Lỗi kết nối / CORS: ${e.message}`);
    logs.push("👉 Hướng dẫn khắc phục:");
    logs.push("1. Vào Apps Script -> Triển khai (Deploy) -> Quản lý các bản triển khai.");
    logs.push("2. Bấm cây bút ✏️ Chỉnh sửa -> Đảm bảo mục 'Ai có quyền truy cập' là 'Bất kỳ ai' (Anyone).");
    logs.push("3. Chọn 'Phiên bản mới' (New version) rồi bấm Triển khai.");
  }

  // Bước 3: Kiểm tra đọc dữ liệu getMonthData
  try {
    const dataRes = await fetch(`${url}?action=getMonthData&year=${currentYear}&month=${currentMonth}`);
    if (dataRes.ok) {
      const monthData = await dataRes.json();
      if (monthData && monthData.success) {
        logs.push(`✓ Đọc dữ liệu thành công (${monthData.sheetName || 'Google Sheets'}, ${monthData.count || 0} khoản chi)`);
      } else {
        logs.push(`⚠️ Máy chủ phản hồi nhưng chưa có hàm getMonthData (Vui lòng tạo 'Phiên bản mới' trong Apps Script)`);
      }
    }
  } catch (e) {}

  diagResultBox.innerHTML = logs.join("<br>");
  btnTestConnection.innerText = "Kiểm tra kết nối";
  btnTestConnection.disabled = false;
});

function updateConnectionUI(isConnected) {
  if (isConnected) {
    connectionStatus.className = "status-pill status-connected";
    statusText.innerText = "Đã kết nối";
  } else {
    connectionStatus.className = "status-pill status-disconnected";
    statusText.innerText = "Chưa kết nối";
  }
}

// --- 7. TOAST NOTIFICATION ---
let toastTimeout = null;
function showToast(message, type = "success") {
  if (toastTimeout) clearTimeout(toastTimeout);
  toastMessage.innerText = message;
  toast.className = `toast ${type === "success" ? "toast-success" : "toast-error"} show`;
  toastIcon.innerText = type === "success" ? "✓" : "⚠️";
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Khởi chạy khi tài liệu sẵn sàng
initApp();

// --- 8. TỰ ĐỘNG CẬP NHẬT DỮ LIỆU TỪ GOOGLE DRIVE ---
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    syncMonthDataFromServer(true);
  }
});

window.addEventListener("focus", () => {
  syncMonthDataFromServer(true);
});

setInterval(() => {
  if (document.visibilityState === "visible") {
    syncMonthDataFromServer(true);
  }
}, 60000);
