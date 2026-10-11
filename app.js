// Biểu tượng tương ứng cho từng danh mục
const CATEGORY_ICONS = {
  "Tiền lương": "💰",
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
let monthTransactions = []; // Danh sách giao dịch lấy từ Google Sheets
let categoryTotals = [];    // Tổng theo từng danh mục
let activeCatFilter = "ALL";
let searchKeyword = "";
let isSyncing = false;
let currentEntryType = "expense"; // "expense" (-) hoặc "income" (+)
let syncBannerTimer = null;

// DOM Elements: Header & Status
const connectionStatus = document.getElementById("connectionStatus");
const statusText = document.getElementById("statusText");
const btnOpenSheet = document.getElementById("btnOpenSheet");
const linkOpenSheet = document.getElementById("linkOpenSheet");
const btnSettings = document.getElementById("btnSettings");
const lastSyncTimeText = document.getElementById("lastSyncTimeText");

// DOM Elements: Thanh thông báo đồng bộ
const syncNotificationBanner = document.getElementById("syncNotificationBanner");
const syncBannerText = document.getElementById("syncBannerText");
const btnCloseSyncBanner = document.getElementById("btnCloseSyncBanner");

// DOM Elements: Thẻ tài chính tháng & Tiết kiệm cộng dồn
const btnPrevMonth = document.getElementById("btnPrevMonth");
const btnNextMonth = document.getElementById("btnNextMonth");
const currentMonthText = document.getElementById("currentMonthText");
const btnSyncServer = document.getElementById("btnSyncServer");
const syncText = document.getElementById("syncText");
const totalIncomeAmount = document.getElementById("totalIncomeAmount");
const totalExpenseAmount = document.getElementById("totalExpenseAmount");
const monthSavingsAmount = document.getElementById("monthSavingsAmount");
const cumulativeSavingsAmount = document.getElementById("cumulativeSavingsAmount");
const entryCountText = document.getElementById("entryCountText");
const connectedEmailText = document.getElementById("connectedEmailText");
const btnQuickEditEmail = document.getElementById("btnQuickEditEmail");

// DOM Elements: Form nhập liệu
const btnTypeExpense = document.getElementById("btnTypeExpense");
const btnTypeIncome = document.getElementById("btnTypeIncome");
const expenseForm = document.getElementById("expenseForm");
const expenseDate = document.getElementById("expenseDate");
const amountLabel = document.getElementById("amountLabel");
const amountSignBadge = document.getElementById("amountSignBadge");
const expenseAmount = document.getElementById("expenseAmount");
const quickChipsContainer = document.getElementById("quickChipsContainer");
const categoryGroup = document.getElementById("categoryGroup");
const categoryLabel = document.getElementById("categoryLabel");
const categoryGrid = document.getElementById("categoryGrid");
const selectedCategoryInput = document.getElementById("selectedCategory");
const expenseNote = document.getElementById("expenseNote");
const btnSubmit = document.getElementById("btnSubmit");
const btnSubmitText = document.getElementById("btnSubmitText");
const btnSpinner = document.getElementById("btnSpinner");

// DOM Elements: Danh sách & Bộ lọc
const listTitleMonth = document.getElementById("listTitleMonth");
const listTotalHeader = document.getElementById("listTotalHeader");
const searchTransactionInput = document.getElementById("searchTransactionInput");
const categoryFilterPills = document.getElementById("categoryFilterPills");
const transactionsContainer = document.getElementById("transactionsContainer");
const categoryBreakdownContainer = document.getElementById("categoryBreakdownContainer");

// DOM Elements: Modal Cài đặt
const settingsModal = document.getElementById("settingsModal");
const btnCloseSettings = document.getElementById("btnCloseSettings");
const btnSaveSettings = document.getElementById("btnSaveSettings");
const btnTestConnection = document.getElementById("btnTestConnection");
const apiUrlInput = document.getElementById("apiUrlInput");
const gmailAccountInput = document.getElementById("gmailAccountInput");
const diagResultBox = document.getElementById("diagResultBox");

// Toast Elements
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const toastIcon = document.getElementById("toastIcon");

/**
 * Lấy danh sách 8 danh mục chi tiêu theo tháng:
 * - Từ tháng 10-2026 trở đi: Chuyển "Điện nước" thành "Bố Mẹ"
 * - Các tháng trước tháng 10: Giữ nguyên "Điện nước"
 */
function getExpenseCategoriesForMonth(month, year) {
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

// ================= 1. HỖ TRỢ KẾT NỐI: JSONP & FETCH ĐA TẦNG (BYPASS CORS) =================

/**
 * Gọi Google Apps Script bằng JSONP (miễn nhiễm 100% với lỗi CORS / Failed to fetch)
 */
function fetchGasJsonp(url, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = "gas_cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    const query = new URLSearchParams(params);
    query.set("prefix", callbackName);

    const separator = url.includes("?") ? "&" : "?";
    const scriptSrc = url + separator + query.toString();

    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;

    let timer = setTimeout(() => {
      cleanup();
      reject(new Error("Quá thời gian kết nối (Timeout sau 15s)"));
    }, 15000);

    function cleanup() {
      clearTimeout(timer);
      if (window[callbackName]) {
        try { delete window[callbackName]; } catch (e) { window[callbackName] = undefined; }
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    window[callbackName] = function(data) {
      cleanup();
      resolve(data);
    };

    script.onerror = function() {
      cleanup();
      reject(new Error("Lỗi mạng khi tải script từ Google Apps Script"));
    };

    document.body.appendChild(script);
  });
}

/**
 * Gọi API Google Apps Script thông minh:
 * Thử fetch() trước, nếu gặp CORS Failed to fetch thì tự động fallback sang JSONP!
 */
async function callGasApi(url, params = {}) {
  try {
    const query = new URLSearchParams(params);
    const separator = url.includes("?") ? "&" : "?";
    const fetchUrl = url + separator + query.toString();

    const res = await fetch(fetchUrl);
    if (res.ok) {
      const json = await res.json();
      return json;
    }
  } catch (err) {
    console.warn("Fetch không khả dụng hoặc bị chặn CORS, tự động chuyển sang JSONP...", err.message);
  }

  // Tự động fallback sang JSONP
  return await fetchGasJsonp(url, params);
}

// ================= 2. KHỞI CHẠY ỨNG DỤNG =================

function initApp() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  expenseDate.value = `${yyyy}-${mm}-${dd}`;

  currentYear = yyyy;
  currentMonth = today.getMonth() + 1;

  // Render các thành phần giao diện
  setEntryType("expense");
  renderCategoryGrid(currentMonth, currentYear);
  renderFilterPills(currentMonth, currentYear);
  updateMonthDisplay();

  // Đọc cấu hình lưu trữ
  const savedUrl = (localStorage.getItem(STORAGE_KEYS.API_URL) || "").trim();
  apiUrlInput.value = savedUrl;
  updateConnectionUI(Boolean(savedUrl));

  const savedSheetUrl = localStorage.getItem(STORAGE_KEYS.SHEET_URL);
  if (savedSheetUrl) {
    updateSpreadsheetLinks(savedSheetUrl);
  }

  const savedEmail = localStorage.getItem(STORAGE_KEYS.EMAIL);
  if (savedEmail) {
    updateConnectedEmail(savedEmail);
    if (gmailAccountInput) gmailAccountInput.value = savedEmail;
  }

  // Tải cache hiển thị tức thì
  loadMonthCache();

  // Tự động đồng bộ từ Google Sheets nếu đã có URL
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

// ================= 3. QUẢN LÝ LOẠI GIAO DỊCH: CHI TIÊU (-) / TIỀN LƯƠNG (+) =================

function setEntryType(type) {
  currentEntryType = type;

  if (type === "expense") {
    btnTypeExpense.classList.add("active");
    btnTypeIncome.classList.remove("active");

    amountSignBadge.innerText = "-";
    amountSignBadge.className = "amount-sign-badge sign-minus";
    amountLabel.innerText = "Số tiền chi tiêu (VNĐ)";
    btnSubmitText.innerText = "💾 Lưu khoản chi tiêu (-)";

    categoryGroup.style.display = "block";
    categoryLabel.innerText = "Danh mục chi tiêu";

    renderCategoryGrid(currentMonth, currentYear);
    renderQuickChips("expense");
  } else {
    btnTypeIncome.classList.add("active");
    btnTypeExpense.classList.remove("active");

    amountSignBadge.innerText = "+";
    amountSignBadge.className = "amount-sign-badge sign-plus";
    amountLabel.innerText = "Số tiền lương / thu nhập (VNĐ)";
    btnSubmitText.innerText = "💰 Lưu tiền lương (+)";

    categoryGroup.style.display = "block";
    categoryLabel.innerText = "Hạng mục thu nhập";

    // Danh mục thu nhập là "Tiền lương"
    selectedCategoryInput.value = "Tiền lương";
    categoryGrid.innerHTML = `
      <div class="category-option selected" data-category="Tiền lương" style="grid-column: span 4;">
        <span class="cat-icon">💰</span>
        <span class="cat-name">Tiền lương / Thu nhập chính</span>
      </div>
    `;

    renderQuickChips("income");
  }
}

btnTypeExpense.addEventListener("click", () => setEntryType("expense"));
btnTypeIncome.addEventListener("click", () => setEntryType("income"));

// Render các chip bấm nhanh số tiền
function renderQuickChips(type) {
  if (!quickChipsContainer) return;

  if (type === "expense") {
    quickChipsContainer.innerHTML = `
      <button type="button" class="chip-btn" data-add="10000">+10k</button>
      <button type="button" class="chip-btn" data-add="20000">+20k</button>
      <button type="button" class="chip-btn" data-add="50000">+50k</button>
      <button type="button" class="chip-btn" data-add="100000">+100k</button>
      <button type="button" class="chip-btn" data-add="200000">+200k</button>
      <button type="button" class="chip-btn" data-add="500000">+500k</button>
      <button type="button" class="chip-btn" id="btnClearAmount" style="color: #ef4444;">Xóa</button>
    `;
  } else {
    quickChipsContainer.innerHTML = `
      <button type="button" class="chip-btn" data-add="1000000">+1Tr</button>
      <button type="button" class="chip-btn" data-add="2000000">+2Tr</button>
      <button type="button" class="chip-btn" data-add="5000000">+5Tr</button>
      <button type="button" class="chip-btn" data-add="10000000">+10Tr</button>
      <button type="button" class="chip-btn" data-add="20000000">+20Tr</button>
      <button type="button" class="chip-btn" id="btnClearAmount" style="color: #ef4444;">Xóa</button>
    `;
  }

  // Gán sự kiện click chip
  quickChipsContainer.querySelectorAll(".chip-btn[data-add]").forEach(btn => {
    btn.addEventListener("click", () => {
      const addVal = Number(btn.getAttribute("data-add")) || 0;
      const currentVal = parseCurrencyNumber(expenseAmount.value);
      expenseAmount.value = formatCurrencyNumber(currentVal + addVal);
    });
  });

  const clearBtn = quickChipsContainer.querySelector("#btnClearAmount");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      expenseAmount.value = "";
      expenseAmount.focus();
    });
  }
}

// Render lưới danh mục chi tiêu theo tháng
function renderCategoryGrid(month, year) {
  if (!categoryGrid || currentEntryType !== "expense") return;

  const cats = getExpenseCategoriesForMonth(month, year);
  const currentSelected = selectedCategoryInput.value;
  const newSelected = cats.includes(currentSelected) ? currentSelected : cats[0];
  selectedCategoryInput.value = newSelected;

  categoryGrid.innerHTML = cats.map(cat => {
    const isSel = cat === newSelected;
    const icon = CATEGORY_ICONS[cat] || "💸";
    return `
      <div class="category-option ${isSel ? "selected" : ""}" data-category="${cat}">
        <span class="cat-icon">${icon}</span>
        <span class="cat-name">${cat}</span>
      </div>
    `;
  }).join("");

  categoryGrid.querySelectorAll(".category-option").forEach(opt => {
    opt.addEventListener("click", () => {
      categoryGrid.querySelectorAll(".category-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      selectedCategoryInput.value = opt.getAttribute("data-category");
    });
  });
}

// Render các nút lọc danh mục
function renderFilterPills(month, year) {
  if (!categoryFilterPills) return;

  const cats = getExpenseCategoriesForMonth(month, year);
  categoryFilterPills.innerHTML = `
    <button class="filter-pill ${activeCatFilter === "ALL" ? "active" : ""}" data-cat="ALL">Tất cả</button>
    <button class="filter-pill ${activeCatFilter === "Tiền lương" ? "active" : ""}" data-cat="Tiền lương">💰 Tiền lương</button>
  ` + cats.map(cat => {
    const icon = CATEGORY_ICONS[cat] || "💸";
    return `
      <button class="filter-pill ${activeCatFilter === cat ? "active" : ""}" data-cat="${cat}">${icon} ${cat}</button>
    `;
  }).join("");

  categoryFilterPills.querySelectorAll(".filter-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      categoryFilterPills.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      activeCatFilter = pill.getAttribute("data-cat");
      renderTransactionsList();
    });
  });
}

// Khi người dùng chọn ngày khác trên form
expenseDate.addEventListener("change", (e) => {
  const val = e.target.value;
  if (val) {
    const parts = val.split("-");
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    if (currentEntryType === "expense") {
      renderCategoryGrid(m, y);
    }
  }
});

// Cập nhật nhãn tháng trên giao diện
function updateMonthDisplay() {
  const mmStr = String(currentMonth).padStart(2, "0");
  const text = `Tháng ${mmStr}-${currentYear}`;
  currentMonthText.innerText = text;
  listTitleMonth.innerText = `Các khoản thu chi ${text}`;
}

// Chuyển tháng trước
btnPrevMonth.addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 1) {
    currentMonth = 12;
    currentYear--;
  }
  updateMonthDisplay();
  if (currentEntryType === "expense") {
    renderCategoryGrid(currentMonth, currentYear);
  }
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
  if (currentEntryType === "expense") {
    renderCategoryGrid(currentMonth, currentYear);
  }
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
  const displayEmail = email && email.trim() ? email.trim() : "Chưa kết nối";
  if (connectedEmailText) {
    connectedEmailText.innerText = displayEmail;
    connectedEmailText.title = displayEmail;
  }
  if (gmailAccountInput && email && email.trim()) {
    gmailAccountInput.value = email.trim();
  }
}

function openGoogleSheet() {
  const url = localStorage.getItem(STORAGE_KEYS.SHEET_URL) || "https://docs.google.com/spreadsheets/u/0/";
  window.open(url, "_blank");
}

if (btnOpenSheet) {
  btnOpenSheet.addEventListener("click", openGoogleSheet);
}

// ================= 4. ĐỊNH DẠNG TIỀN TỆ =================

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
  e.target.setSelectionRange(
    cursorPosition + (newLength - originalLength),
    cursorPosition + (newLength - originalLength)
  );
});

// ================= 5. THANH THÔNG BÁO ĐỒNG BỘ =================

function showSyncNotificationBanner(count, income, expense, savings) {
  if (!syncNotificationBanner || !syncBannerText) return;

  const timeStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const savingsSign = savings >= 0 ? "+" : "-";
  const savingsFormatted = savingsSign + " " + formatCurrencyNumber(Math.abs(savings)) + " ₫";

  syncBannerText.innerText = `Đã đồng bộ Google Sheets lúc ${timeStr} (${count} giao dịch | Tiết kiệm: ${savingsFormatted})`;
  syncNotificationBanner.style.display = "flex";

  if (syncBannerTimer) clearTimeout(syncBannerTimer);
  syncBannerTimer = setTimeout(() => {
    syncNotificationBanner.style.display = "none";
  }, 9000);
}

if (btnCloseSyncBanner) {
  btnCloseSyncBanner.addEventListener("click", () => {
    if (syncNotificationBanner) syncNotificationBanner.style.display = "none";
  });
}

// ================= 6. ĐỒNG BỘ DỮ LIỆU TỪ GOOGLE SHEETS =================

async function syncMonthDataFromServer(isSilent = false) {
  const apiUrl = (localStorage.getItem(STORAGE_KEYS.API_URL) || "").trim();
  if (!apiUrl) {
    updateConnectionUI(false);
    return;
  }

  if (isSyncing) return;
  setSyncingState(true);

  try {
    const data = await callGasApi(apiUrl, {
      action: "getMonthData",
      year: currentYear,
      month: currentMonth
    });

    if (data && data.success) {
      monthTransactions = data.transactions || [];
      categoryTotals = data.categories || [];

      // Cập nhật Google Spreadsheet URL
      if (data.spreadsheetUrl) {
        localStorage.setItem(STORAGE_KEYS.SHEET_URL, data.spreadsheetUrl);
        updateSpreadsheetLinks(data.spreadsheetUrl);
      }

      // Cập nhật Email Drive nếu máy chủ phản hồi
      if (data.email && data.email.trim() !== "") {
        localStorage.setItem(STORAGE_KEYS.EMAIL, data.email);
        updateConnectedEmail(data.email);
      } else {
        const storedEmail = localStorage.getItem(STORAGE_KEYS.EMAIL);
        if (storedEmail) updateConnectedEmail(storedEmail);
      }

      // Cập nhật cache local
      saveMonthCache(data);

      // Render toàn bộ giao diện tài chính
      renderFinancialViews(data);
      updateConnectionUI(true);

      const timeStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      if (lastSyncTimeText) {
        lastSyncTimeText.innerText = `✅ Đã đồng bộ Drive (${timeStr})`;
      }
      if (statusText) {
        statusText.innerText = `Đã đồng bộ (${timeStr})`;
      }

      // Hiển thị thanh thông báo đã đồng bộ
      showSyncNotificationBanner(
        monthTransactions.length,
        data.totalIncome || 0,
        data.total || 0,
        data.monthSavings !== undefined ? data.monthSavings : ((data.totalIncome || 0) - (data.total || 0))
      );
    } else {
      throw new Error(data && data.error ? data.error : "Phản hồi không hợp lệ từ máy chủ");
    }
  } catch (err) {
    console.warn("Lỗi đồng bộ từ server:", err);
    if (!isSilent) {
      showToast("Không thể tải dữ liệu: " + err.message, "error");
    }
    if (lastSyncTimeText) {
      lastSyncTimeText.innerText = "⚠️ Lỗi đồng bộ dữ liệu";
    }
  } finally {
    setSyncingState(false);
  }
}

btnSyncServer.addEventListener("click", () => {
  syncMonthDataFromServer(false);
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
function getCacheKey(year = currentYear, month = currentMonth) {
  return `qly_cache_${year}_${month}`;
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
      renderFinancialViews(data);
      return;
    }
  } catch (e) {}

  monthTransactions = [];
  categoryTotals = [];
  renderFinancialViews({ total: 0, totalIncome: 0, monthSavings: 0, cumulativeSavings: 0 });
}

/**
 * Tính toán tiền tiết kiệm cộng dồn từ các tháng trong cache local (nếu server chưa trả về)
 */
function computeCumulativeSavingsLocally() {
  let cumulative = 0;
  for (let m = 1; m <= currentMonth; m++) {
    const raw = localStorage.getItem(getCacheKey(currentYear, m));
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.monthSavings !== undefined) {
          cumulative += d.monthSavings;
        } else {
          const inc = d.totalIncome || 0;
          const exp = d.total || 0;
          cumulative += (inc - exp);
        }
      } catch (e) {}
    }
  }
  return cumulative;
}

// ================= 7. HIỂN THỊ DỮ LIỆU TÀI CHÍNH & DANH SÁCH =================

function renderFinancialViews(data = {}) {
  // 1. Phân loại giao dịch thu nhập và chi tiêu
  let incomeSum = 0;
  let expenseSum = 0;

  monthTransactions.forEach(t => {
    const isIncome = t.type === "income" || t.category === "Tiền lương" || t.category === "Lương" || t.category === "Thu nhập";
    if (isIncome) {
      incomeSum += (t.amount || 0);
    } else {
      expenseSum += (t.amount || 0);
    }
  });

  // Nếu server có giá trị trả về thì ưu tiên
  if (data.totalIncome !== undefined && data.totalIncome > 0) incomeSum = data.totalIncome;
  if (data.total !== undefined && data.total > 0) expenseSum = data.total;

  const monthSavings = incomeSum - expenseSum;

  let cumulativeSavings = data.cumulativeSavings !== undefined && data.cumulativeSavings !== 0
    ? data.cumulativeSavings
    : computeCumulativeSavingsLocally();

  // 2. Hiển thị Lưới 3 chỉ số tài chính
  totalIncomeAmount.innerText = `+ ${formatCurrencyNumber(incomeSum)} ₫`;
  totalExpenseAmount.innerText = `- ${formatCurrencyNumber(expenseSum)} ₫`;

  // Hiển thị Tiết kiệm tháng
  if (monthSavings >= 0) {
    monthSavingsAmount.innerText = `+ ${formatCurrencyNumber(monthSavings)} ₫`;
    monthSavingsAmount.className = "stat-value is-positive";
  } else {
    monthSavingsAmount.innerText = `- ${formatCurrencyNumber(Math.abs(monthSavings))} ₫`;
    monthSavingsAmount.className = "stat-value is-negative";
  }

  // 3. Hiển thị Tiền tiết kiệm cộng dồn tích lũy
  if (cumulativeSavings >= 0) {
    cumulativeSavingsAmount.innerText = `+ ${formatCurrencyNumber(cumulativeSavings)} ₫`;
    cumulativeSavingsAmount.className = "cum-amount";
  } else {
    cumulativeSavingsAmount.innerText = `- ${formatCurrencyNumber(Math.abs(cumulativeSavings))} ₫`;
    cumulativeSavingsAmount.className = "cum-amount is-negative";
  }

  listTotalHeader.innerText = `- ${formatCurrencyNumber(expenseSum)} ₫`;
  entryCountText.innerText = `${monthTransactions.length} giao dịch trên Drive`;

  // 4. Render danh sách và phân tích chi tiêu
  renderTransactionsList();
  renderCategoryBreakdown(expenseSum);
}

// Render danh sách giao dịch trong tháng
function renderTransactionsList() {
  if (!transactionsContainer) return;

  const filtered = monthTransactions.filter(item => {
    const isIncome = item.type === "income" || item.category === "Tiền lương" || item.category === "Lương";
    const itemCat = isIncome ? "Tiền lương" : item.category;

    const matchCategory = activeCatFilter === "ALL" || itemCat === activeCatFilter;
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
          <p>Chưa có khoản thu chi nào trong Tháng ${String(currentMonth).padStart(2, "0")}-${currentYear}.</p>
          <p style="margin-top: 6px; font-size: 0.75rem;">Hãy thêm <strong>Tiền lương (+)</strong> hoặc <strong>Khoản chi (-)</strong> ở cột bên trái để bắt đầu ghi nhận!</p>
        </div>
      `;
    } else {
      transactionsContainer.innerHTML = `<div class="empty-state">Không tìm thấy giao dịch nào phù hợp với bộ lọc.</div>`;
    }
    return;
  }

  // Hiển thị giao dịch mới nhất lên trên
  const sorted = [...filtered].reverse();

  transactionsContainer.innerHTML = sorted.map(item => {
    const isIncome = item.type === "income" || item.category === "Tiền lương" || item.category === "Lương";
    const icon = CATEGORY_ICONS[item.category] || (isIncome ? "💰" : "💸");
    const amountSign = isIncome ? "+" : "-";
    const amountClass = isIncome ? "transaction-amount is-income" : "transaction-amount";

    return `
      <div class="transaction-item" data-row="${item.row || ''}">
        <div class="transaction-info">
          <div class="transaction-cat">
            <span class="cat-icon-badge">${icon}</span>
            <span class="cat-title">${escapeHtml(item.category)}</span>
            ${isIncome ? '<span class="badge-income">+ Lương</span>' : ''}
          </div>
          <div class="transaction-meta">
            <span>📅 ${escapeHtml(item.date)}</span>
            ${item.note ? `<span>• 📝 ${escapeHtml(item.note)}</span>` : ""}
          </div>
        </div>
        <div class="transaction-actions">
          <span class="${amountClass}">${amountSign} ${formatCurrencyNumber(item.amount)} ₫</span>
          ${item.row ? `
            <button type="button" class="btn-del-item" title="Xóa giao dịch này" onclick="handleDeleteTransaction(${item.row})">🗑️</button>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");
}

// Render cơ cấu chi tiêu theo 8 danh mục (không bao gồm tiền lương)
function renderCategoryBreakdown(totalExpense) {
  if (!categoryBreakdownContainer) return;

  const expenseItems = monthTransactions.filter(t => 
    t.type !== "income" && t.category !== "Tiền lương" && t.category !== "Lương"
  );

  const catSums = {};
  getExpenseCategoriesForMonth(currentMonth, currentYear).forEach(c => catSums[c] = 0);

  expenseItems.forEach(t => {
    const c = t.category || "Ăn uống";
    catSums[c] = (catSums[c] || 0) + (t.amount || 0);
  });

  const validTotal = totalExpense > 0 ? totalExpense : 1;
  const sortedCats = Object.keys(catSums).map(name => ({
    name: name,
    total: catSums[name],
    percent: Math.round((catSums[name] / validTotal) * 100)
  })).sort((a, b) => b.total - a.total);

  if (totalExpense === 0) {
    categoryBreakdownContainer.innerHTML = `<div class="empty-state">Chưa có chi tiêu nào trong tháng để phân tích cơ cấu.</div>`;
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
  if (!confirm(`Bạn có chắc chắn muốn xóa dòng này khỏi Google Sheets không?`)) {
    return;
  }

  const apiUrl = (localStorage.getItem(STORAGE_KEYS.API_URL) || "").trim();
  if (!apiUrl) {
    showToast("Chưa cấu hình URL Google Apps Script!", "error");
    return;
  }

  showToast("Đang xóa trên Google Sheets...", "success");

  try {
    const result = await callGasApi(apiUrl, {
      action: "delete",
      year: currentYear,
      month: currentMonth,
      row: row
    });

    if (result && result.success) {
      showToast("Đã xóa giao dịch thành công!", "success");
      syncMonthDataFromServer();
    } else {
      throw new Error((result && result.error) || "Không thể xóa dòng");
    }
  } catch (e) {
    showToast("Lỗi khi xóa: " + e.message, "error");
  }
};

// ================= 8. GỬI GIAO DỊCH MỚI LÊN GOOGLE SHEETS =================

expenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const dateVal = expenseDate.value;
  const amountVal = parseCurrencyNumber(expenseAmount.value);
  const categoryVal = currentEntryType === "income" ? "Tiền lương" : selectedCategoryInput.value;
  const noteVal = expenseNote.value.trim();

  if (!amountVal || amountVal <= 0) {
    showToast("Vui lòng nhập số tiền hợp lệ!", "error");
    expenseAmount.focus();
    return;
  }

  const payload = {
    action: "add",
    date: dateVal,
    category: categoryVal,
    amount: amountVal,
    note: noteVal,
    type: currentEntryType
  };

  const apiUrl = (localStorage.getItem(STORAGE_KEYS.API_URL) || "").trim();
  if (!apiUrl) {
    showToast("Chưa có URL Google Apps Script để đồng bộ!", "error");
    openSettings();
    return;
  }

  setLoadingState(true);

  try {
    // 1. Thử gửi qua fetch POST (nếu không chặn)
    let sendOk = false;
    try {
      await fetch(apiUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      sendOk = true;
    } catch (postErr) {
      console.warn("POST no-cors gặp trở ngại, chuyển sang GET add qua JSONP...", postErr);
    }

    // 2. Dự phòng qua GET/JSONP nếu cần
    if (!sendOk) {
      await callGasApi(apiUrl, {
        action: "add",
        date: dateVal,
        category: categoryVal,
        amount: amountVal,
        note: noteVal
      });
    }

    const typeDesc = currentEntryType === "income" ? "tiền lương (+)" : "khoản chi (-)";
    showToast(`Đã lưu ${typeDesc} thành công vào Google Sheets!`, "success");

    expenseAmount.value = "";
    expenseNote.value = "";
    expenseAmount.focus();

    // Tự động tải lại tháng sau khi thêm
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
    btnSubmitText.innerText = currentEntryType === "income"
      ? "💰 Lưu tiền lương (+)"
      : "💾 Lưu khoản chi tiêu (-)";
    btnSpinner.style.display = "none";
  }
}

// ================= 9. CÀI ĐẶT & CHẨN ĐOÁN LỖI KẾT NỐI / TÀI KHOẢN GMAIL =================

function openSettings() {
  settingsModal.classList.add("active");
  apiUrlInput.value = localStorage.getItem(STORAGE_KEYS.API_URL) || "";
  gmailAccountInput.value = localStorage.getItem(STORAGE_KEYS.EMAIL) || "";
  diagResultBox.className = "diag-box";
  diagResultBox.innerHTML = "";
}

function closeSettings() {
  settingsModal.classList.remove("active");
}

btnSettings.addEventListener("click", openSettings);
btnCloseSettings.addEventListener("click", closeSettings);
if (btnQuickEditEmail) {
  btnQuickEditEmail.addEventListener("click", openSettings);
}

settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) closeSettings();
});

btnSaveSettings.addEventListener("click", () => {
  const url = apiUrlInput.value.trim();
  const email = (gmailAccountInput ? gmailAccountInput.value.trim() : "");

  if (url) {
    localStorage.setItem(STORAGE_KEYS.API_URL, url);
    updateConnectionUI(true);
  } else {
    localStorage.removeItem(STORAGE_KEYS.API_URL);
    updateConnectionUI(false);
  }

  if (email) {
    localStorage.setItem(STORAGE_KEYS.EMAIL, email);
    updateConnectedEmail(email);
  }

  showToast("Đã lưu cài đặt kết nối thành công!", "success");
  closeSettings();
  syncMonthDataFromServer();
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
  diagResultBox.innerHTML = "⏳ Đang bắt đầu kiểm tra kết nối với Google Apps Script...";

  const logs = [];

  // Bước 1: Kiểm tra định dạng URL
  if (!url.includes("script.google.com") || !url.includes("/exec")) {
    logs.push("⚠️ Cảnh báo: URL chưa có đuôi /exec (Đảm bảo dùng Web App URL, không phải URL trình sửa code)");
  } else {
    logs.push("✓ Định dạng URL hợp lệ");
  }

  // Bước 2: Kiểm tra Ping qua callGasApi (Tự động bypass CORS qua JSONP)
  try {
    const pingData = await callGasApi(url, { action: "ping" });
    if (pingData && pingData.status === "ok") {
      logs.push(`✓ Kết nối Google Apps Script thành công!`);

      let detectedEmail = pingData.email;
      if (detectedEmail && detectedEmail.trim() !== "") {
        logs.push(`📧 Tài khoản Google Drive: <strong>${escapeHtml(detectedEmail)}</strong>`);
        localStorage.setItem(STORAGE_KEYS.EMAIL, detectedEmail);
        updateConnectedEmail(detectedEmail);
        if (gmailAccountInput) gmailAccountInput.value = detectedEmail;
      } else {
        const manualEmail = gmailAccountInput ? gmailAccountInput.value.trim() : "";
        if (manualEmail) {
          logs.push(`📧 Tài khoản Drive đã lưu: <strong>${escapeHtml(manualEmail)}</strong>`);
          localStorage.setItem(STORAGE_KEYS.EMAIL, manualEmail);
          updateConnectedEmail(manualEmail);
        } else {
          logs.push(`ℹ️ Google Apps Script đang chạy ở chế độ ẩn danh. Bạn có thể nhập Gmail của mình vào ô bên trên để hiển thị cố định.`);
        }
      }

      if (pingData.spreadsheetUrl) {
        logs.push(`📊 Đã tìm thấy Google Sheets: <a href="${pingData.spreadsheetUrl}" target="_blank" style="color: #2563eb;">Mở bảng tính ↗</a>`);
        localStorage.setItem(STORAGE_KEYS.SHEET_URL, pingData.spreadsheetUrl);
        updateSpreadsheetLinks(pingData.spreadsheetUrl);
      }
    } else {
      logs.push(`❌ Máy chủ phản hồi nhưng trạng thái không phải OK`);
    }
  } catch (err) {
    logs.push(`❌ Không thể kết nối: ${err.message}`);
    logs.push("👉 Hướng dẫn khắc phục:");
    logs.push("1. Vào Google Sheets -> Tiện ích mở rộng -> Apps Script -> Dán code mới nhất từ <code>web/Code.gs</code>.");
    logs.push("2. Bấm Triển khai (Deploy) -> Quản lý các bản triển khai -> Cây bút ✏️ Chỉnh sửa.");
    logs.push("3. Chọn <strong>Phiên bản mới (New version)</strong> -> Đảm bảo quyền truy cập là <strong>Bất kỳ ai (Anyone)</strong>.");
  }

  // Bước 3: Thử đọc dữ liệu getMonthData
  try {
    const monthData = await callGasApi(url, {
      action: "getMonthData",
      year: currentYear,
      month: currentMonth
    });

    if (monthData && monthData.success) {
      const inc = monthData.totalIncome || 0;
      const exp = monthData.total || 0;
      logs.push(`✓ Đọc dữ liệu thành công (${monthData.sheetName || 'Google Sheets'}: ${monthData.count || 0} giao dịch, Lương: ${formatCurrencyNumber(inc)} ₫, Chi: ${formatCurrencyNumber(exp)} ₫)`);
    }
  } catch (err) {
    // Không cần log thêm nếu bước 2 đã ghi lỗi
  }

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

// ================= 10. TOAST NOTIFICATION & TIỆN ÍCH =================

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
  return (str || "").toString().replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Khởi chạy khi tài liệu sẵn sàng
initApp();

// ================= 11. TỰ ĐỘNG ĐỒNG BỘ KHI MỞ LẠI TAB HOẶC FOCUS =================

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
