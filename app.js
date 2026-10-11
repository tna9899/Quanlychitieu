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
let syncCountdownInterval = null;
let syncCountdownSeconds = 3;

// DOM Elements: Header & Status
const connectionStatus = document.getElementById("connectionStatus");
const statusText = document.getElementById("statusText");
const linkOpenSheet = document.getElementById("linkOpenSheet");
const btnSettings = document.getElementById("btnSettings");
const lastSyncTimeText = document.getElementById("lastSyncTimeText");

// DOM Elements: Thanh thông báo đồng bộ (có bộ đếm 3s)
const syncNotificationBanner = document.getElementById("syncNotificationBanner");
const syncBannerText = document.getElementById("syncBannerText");
const syncCountdownBadge = document.getElementById("syncCountdownBadge");
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

// DOM Elements: Cơ Cấu Tiền Lương & Tiết Kiệm (Tách riêng thành 1 cơ cấu độc lập)
const savingsRateBadge = document.getElementById("savingsRateBadge");
const ratioBarExpense = document.getElementById("ratioBarExpense");
const ratioBarSavings = document.getElementById("ratioBarSavings");
const ratioExpensePercent = document.getElementById("ratioExpensePercent");
const ratioSavingsPercent = document.getElementById("ratioSavingsPercent");
const salarySavingsBreakdownContainer = document.getElementById("salarySavingsBreakdownContainer");

// DOM Elements: Modal Cài đặt & Đồng bộ đa thiết bị
const settingsModal = document.getElementById("settingsModal");
const btnCloseSettings = document.getElementById("btnCloseSettings");
const btnSaveSettings = document.getElementById("btnSaveSettings");
const btnTestConnection = document.getElementById("btnTestConnection");
const apiUrlInput = document.getElementById("apiUrlInput");
const gmailAccountInput = document.getElementById("gmailAccountInput");
const diagResultBox = document.getElementById("diagResultBox");
const btnCopyShareLink = document.getElementById("btnCopyShareLink");
const btnToggleQrCode = document.getElementById("btnToggleQrCode");
const qrCodeContainer = document.getElementById("qrCodeContainer");
const qrCodeImg = document.getElementById("qrCodeImg");

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

async function initApp() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  expenseDate.value = `${yyyy}-${mm}-${dd}`;

  currentYear = yyyy;
  currentMonth = today.getMonth() + 1;

  // Render các thành phần giao diện ban đầu
  setEntryType("expense");
  renderCategoryGrid(currentMonth, currentYear);
  renderFilterPills(currentMonth, currentYear);
  updateMonthDisplay();

  // 1. Tự động đồng bộ cấu hình nếu mở qua link chia sẻ (?api=... hoặc ?apiUrl=...)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const paramApiUrl = urlParams.get("api") || urlParams.get("apiUrl");
    const paramEmail = urlParams.get("email");
    if (paramApiUrl && paramApiUrl.trim()) {
      localStorage.setItem(STORAGE_KEYS.API_URL, paramApiUrl.trim());
      if (paramEmail && paramEmail.trim()) {
        localStorage.setItem(STORAGE_KEYS.EMAIL, paramEmail.trim());
      }
      // Dọn dẹp URL trên thanh địa chỉ để giao diện sạch sẽ
      window.history.replaceState({}, document.title, window.location.pathname);
      showToast("Đã tự động nhận diện và đồng bộ cấu hình từ thiết bị!", "success");
    }
  } catch (e) {}

  // 2. Nếu thiết bị chưa có Web App URL, thử nạp từ file config.json của kho lưu trữ
  let savedUrl = (localStorage.getItem(STORAGE_KEYS.API_URL) || "").trim();
  if (!savedUrl) {
    try {
      const cfgRes = await fetch("config.json?v=" + Date.now());
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        if (cfg && cfg.apiUrl && cfg.apiUrl.trim()) {
          savedUrl = cfg.apiUrl.trim();
          localStorage.setItem(STORAGE_KEYS.API_URL, savedUrl);
          if (cfg.email && !localStorage.getItem(STORAGE_KEYS.EMAIL)) {
            localStorage.setItem(STORAGE_KEYS.EMAIL, cfg.email.trim());
          }
        }
      }
    } catch (e) {}
  }

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
    categoryLabel.innerText = "Danh mục tiền lương & thu nhập";

    renderCategoryGrid(currentMonth, currentYear);
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

// Render lưới danh mục:
// 1. Khi ở mục Tiền lương: CHỈ HIỂN THỊ DANH MỤC TIỀN LƯƠNG
// 2. Khi ở mục Chi tiêu: CHỈ HIỂN THỊ CÁC DANH MỤC CHI TIÊU
function renderCategoryGrid(month, year) {
  if (!categoryGrid) return;

  if (currentEntryType === "income") {
    selectedCategoryInput.value = "Tiền lương";
    categoryGrid.innerHTML = `
      <div class="category-option selected" data-category="Tiền lương" style="grid-column: span 4; border-color: #86efac; background: #f0fdf4;">
        <span class="cat-icon">💰</span>
        <span class="cat-name">Tiền lương (Thu nhập hàng tháng)</span>
      </div>
    `;
    return;
  }

  // Chỉ hiển thị 8 danh mục chi tiêu theo tháng (từ tháng 10 là Bố Mẹ)
  const expenseCats = getExpenseCategoriesForMonth(month, year);
  let currentSelected = selectedCategoryInput.value;
  if (!currentSelected || currentSelected === "Tiền lương" || !expenseCats.includes(currentSelected)) {
    currentSelected = expenseCats[0];
  }
  selectedCategoryInput.value = currentSelected;

  categoryGrid.innerHTML = expenseCats.map(cat => {
    const isSel = cat === currentSelected;
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

// ================= 5. THANH THÔNG BÁO ĐỒNG BỘ (BỘ ĐẾM 3S TỰ TẮT) =================

function showSyncNotificationBanner(count, income, expense, savings) {
  if (!syncNotificationBanner || !syncBannerText) return;

  const timeStr = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const savingsSign = savings >= 0 ? "+" : "-";
  const savingsFormatted = savingsSign + " " + formatCurrencyNumber(Math.abs(savings)) + " ₫";

  syncBannerText.innerText = `Đã đồng bộ Google Sheets lúc ${timeStr} (${count} giao dịch | Tiết kiệm: ${savingsFormatted})`;

  if (syncCountdownInterval) {
    clearInterval(syncCountdownInterval);
    syncCountdownInterval = null;
  }

  syncCountdownSeconds = 3;
  if (syncCountdownBadge) {
    syncCountdownBadge.innerText = `${syncCountdownSeconds}s`;
  }

  syncNotificationBanner.style.display = "flex";

  syncCountdownInterval = setInterval(() => {
    syncCountdownSeconds--;
    if (syncCountdownSeconds > 0) {
      if (syncCountdownBadge) {
        syncCountdownBadge.innerText = `${syncCountdownSeconds}s`;
      }
    } else {
      clearInterval(syncCountdownInterval);
      syncCountdownInterval = null;
      syncNotificationBanner.style.display = "none";
    }
  }, 1000);
}

if (btnCloseSyncBanner) {
  btnCloseSyncBanner.addEventListener("click", () => {
    if (syncCountdownInterval) {
      clearInterval(syncCountdownInterval);
      syncCountdownInterval = null;
    }
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
 * Tính toán tiền tiết kiệm cộng dồn từ các tháng trong cache local (bắt đầu từ tháng đầu tiên có giao dịch)
 */
function computeCumulativeSavingsLocally() {
  let cumulative = 0;
  let firstMonth = null;

  for (let m = 1; m <= currentMonth; m++) {
    const raw = localStorage.getItem(getCacheKey(currentYear, m));
    let mSavings = 0;
    let hasData = false;

    if (raw) {
      try {
        const d = JSON.parse(raw);
        const inc = d.totalIncome || 0;
        const exp = d.total || 0;
        const count = (d.transactions && d.transactions.length) || 0;
        if (count > 0 || inc > 0 || exp > 0) {
          hasData = true;
          mSavings = d.monthSavings !== undefined ? d.monthSavings : (inc - exp);
        }
      } catch (e) {}
    } else if (m === currentMonth && monthTransactions.length > 0) {
      let inc = 0;
      let exp = 0;
      monthTransactions.forEach(t => {
        const isInc = t.type === "income" || t.category === "Tiền lương" || t.category === "Lương" || t.category === "Thu nhập";
        if (isInc) inc += (t.amount || 0);
        else exp += (t.amount || 0);
      });
      if (monthTransactions.length > 0 || inc > 0 || exp > 0) {
        hasData = true;
        mSavings = inc - exp;
      }
    }

    if (hasData) {
      if (firstMonth === null) firstMonth = m;
      cumulative += mSavings;
    }
  }

  return {
    cumulativeSavings: cumulative,
    savingsStartMonth: firstMonth
  };
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

  // Tính tiền tiết kiệm cộng dồn bắt đầu từ tháng có giao dịch
  let cumulativeSavings = 0;
  let savingsStartMonth = null;

  if (data.cumulativeSavings !== undefined) {
    cumulativeSavings = data.cumulativeSavings;
    savingsStartMonth = data.savingsStartMonth !== undefined ? data.savingsStartMonth : null;
  } else {
    const localCum = computeCumulativeSavingsLocally();
    cumulativeSavings = localCum.cumulativeSavings;
    savingsStartMonth = localCum.savingsStartMonth;
  }

  // Nếu chưa xác định được savingsStartMonth nhưng tháng hiện tại hoặc cache có giao dịch
  if (savingsStartMonth === null && (monthTransactions.length > 0 || incomeSum > 0 || expenseSum > 0)) {
    savingsStartMonth = currentMonth;
  }
  if (savingsStartMonth === null) {
    const localCum = computeCumulativeSavingsLocally();
    if (localCum.savingsStartMonth !== null) {
      savingsStartMonth = localCum.savingsStartMonth;
      if (data.cumulativeSavings === undefined) {
        cumulativeSavings = localCum.cumulativeSavings;
      }
    }
  }

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

  // 3. Hiển thị Tiền tiết kiệm cộng dồn tích lũy (tính từ tháng có giao dịch)
  const cumSign = cumulativeSavings >= 0 ? "+" : "-";
  const cumClass = cumulativeSavings >= 0 ? "cum-amount" : "cum-amount is-negative";

  if (savingsStartMonth === null) {
    cumulativeSavingsAmount.innerText = "0 ₫";
    cumulativeSavingsAmount.className = "cum-amount";
  } else {
    cumulativeSavingsAmount.innerText = `${cumSign} ${formatCurrencyNumber(Math.abs(cumulativeSavings))} ₫`;
    cumulativeSavingsAmount.className = cumClass;
  }

  // Cập nhật nhãn phụ của khối cộng dồn
  const cumSubtitleEl = document.getElementById("cumSubtitleText");
  if (cumSubtitleEl) {
    if (savingsStartMonth === null) {
      cumSubtitleEl.innerText = "Tích lũy từ tháng có giao dịch";
    } else if (currentMonth === savingsStartMonth) {
      cumSubtitleEl.innerText = `Tích lũy Tháng ${String(savingsStartMonth).padStart(2, "0")}`;
    } else {
      cumSubtitleEl.innerText = `Tích lũy từ Tháng ${String(savingsStartMonth).padStart(2, "0")} đến hết Tháng ${String(currentMonth).padStart(2, "0")}`;
    }
  }

  listTotalHeader.innerText = `- ${formatCurrencyNumber(expenseSum)} ₫`;
  entryCountText.innerText = `${monthTransactions.length} giao dịch trên Drive`;

  // 4. Render danh sách và phân tích chi tiêu
  renderTransactionsList();
  renderCategoryBreakdown(expenseSum);
  renderSalarySavingsBreakdown(incomeSum, expenseSum, monthSavings, cumulativeSavings, savingsStartMonth);
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
    const amountClass = isIncome ? "trans-pill-amount is-income" : "trans-pill-amount is-expense";

    // Format ngày ngắn gọn (MM-dd)
    let dateDisplay = item.date || "";
    if (dateDisplay.length >= 10) {
      dateDisplay = dateDisplay.substring(5); // Lấy MM-dd
    }

    return `
      <div class="transaction-row-single" data-row="${item.row || ''}">
        <div class="trans-single-left">
          <span class="trans-pill-date">${escapeHtml(dateDisplay)}</span>
          <span class="trans-pill-cat">${icon} ${escapeHtml(item.category)}</span>
          ${item.note ? `<span class="trans-pill-note" title="${escapeHtml(item.note)}">📝 ${escapeHtml(item.note)}</span>` : ""}
        </div>
        <div class="trans-single-right">
          <span class="${amountClass}">${amountSign} ${formatCurrencyNumber(item.amount)} ₫</span>
          ${item.row ? `
            <button type="button" class="trans-pill-del" title="Xóa giao dịch này" onclick="handleDeleteTransaction(${item.row})">🗑️</button>
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

// Render phân tích Cơ cấu Tiền lương & Tiết kiệm (Tách riêng 2 khoản này thành 1 cơ cấu độc lập)
function renderSalarySavingsBreakdown(income, expense, savings, cumulative, startMonth = null) {
  if (!salarySavingsBreakdownContainer) return;

  let expensePercent = 0;
  let savingsPercent = 0;

  if (income > 0) {
    expensePercent = Math.round((expense / income) * 100);
    savingsPercent = Math.round((savings / income) * 100);

    if (savingsRateBadge) {
      if (savings >= 0) {
        savingsRateBadge.innerText = `${savingsPercent}% tiết kiệm`;
        savingsRateBadge.className = "savings-rate-badge";
      } else {
        savingsRateBadge.innerText = `${Math.abs(savingsPercent)}% thâm hụt`;
        savingsRateBadge.className = "savings-rate-badge is-negative";
      }
    }

    const barExpenseWidth = Math.min(100, Math.max(0, expensePercent));
    const barSavingsWidth = Math.min(100, Math.max(0, savingsPercent));

    if (ratioBarExpense) ratioBarExpense.style.width = `${barExpenseWidth}%`;
    if (ratioBarSavings) ratioBarSavings.style.width = `${barSavingsWidth}%`;
    if (ratioExpensePercent) ratioExpensePercent.innerText = `${expensePercent}%`;
    if (ratioSavingsPercent) ratioSavingsPercent.innerText = `${savingsPercent}%`;
  } else {
    if (savingsRateBadge) {
      savingsRateBadge.innerText = "Chưa có lương";
      savingsRateBadge.className = "savings-rate-badge is-negative";
    }
    if (ratioBarExpense) ratioBarExpense.style.width = expense > 0 ? "100%" : "0%";
    if (ratioBarSavings) ratioBarSavings.style.width = "0%";
    if (ratioExpensePercent) ratioExpensePercent.innerText = expense > 0 ? "100%" : "0%";
    if (ratioSavingsPercent) ratioSavingsPercent.innerText = "0%";
  }

  const savingsSign = savings >= 0 ? "+" : "-";
  const savingsClass = savings >= 0 ? "text-savings" : "text-danger";

  const cumSign = cumulative >= 0 ? "+" : "-";
  const cumClass = cumulative >= 0 ? "text-savings" : "text-danger";

  salarySavingsBreakdownContainer.innerHTML = `
    <div class="salary-savings-card">
      <div class="ss-header">
        <span class="ss-title">💰 Tiền lương (Thu nhập)</span>
        <span class="ss-amount text-income">+ ${formatCurrencyNumber(income)} ₫</span>
      </div>
      <div class="breakdown-bar-bg">
        <div class="breakdown-bar-fill" style="width: ${income > 0 ? '100%' : '0%'}; background: #16a34a;"></div>
      </div>
      <div class="ss-desc">Mốc thu nhập nhận trong tháng (100% làm chuẩn phân bổ chi tiêu & tích lũy).</div>
    </div>

    <div class="salary-savings-card">
      <div class="ss-header">
        <span class="ss-title">🏦 Tiền tiết kiệm (= Lương - Chi)</span>
        <span class="ss-amount ${savingsClass}">${savingsSign} ${formatCurrencyNumber(Math.abs(savings))} ₫</span>
      </div>
      <div class="breakdown-bar-bg">
        <div class="breakdown-bar-fill" style="width: ${Math.min(100, Math.max(0, savingsPercent))}%; background: ${savings >= 0 ? '#0d9488' : '#ef4444'};"></div>
      </div>
      <div class="ss-desc">
        ${savings >= 0 
          ? `Thặng dư ${savingsPercent}% tiền lương để tích lũy sau khi đã chi trả ${expensePercent}% sinh hoạt.`
          : `Chi vượt mức thu nhập ${Math.abs(savingsPercent)}%, cần cân đối lại các khoản chi tiêu.`}
      </div>
    </div>

    <div class="salary-savings-card">
      <div class="ss-header">
        <span class="ss-title">⭐ Tiết kiệm cộng dồn</span>
        <span class="ss-amount ${startMonth === null ? 'text-savings' : cumClass}">
          ${startMonth === null ? '0 ₫' : (cumSign + ' ' + formatCurrencyNumber(Math.abs(cumulative)) + ' ₫')}
        </span>
      </div>
      <div class="breakdown-bar-bg">
        <div class="breakdown-bar-fill" style="width: ${startMonth === null ? '0%' : '100%'}; background: #2563eb;"></div>
      </div>
      <div class="ss-desc">
        ${startMonth === null 
          ? 'Chưa có giao dịch tích lũy nào.' 
          : (currentMonth === startMonth 
              ? `Số tiền tiết kiệm tích lũy trong Tháng ${String(startMonth).padStart(2, '0')}.` 
              : `Tổng số tiền tiết kiệm tích lũy từ Tháng ${String(startMonth).padStart(2, '0')} đến hết Tháng ${String(currentMonth).padStart(2, '0')}.`)}
      </div>
    </div>
  `;
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
  if (qrCodeContainer) qrCodeContainer.style.display = "none";
}

function closeSettings() {
  settingsModal.classList.remove("active");
  if (qrCodeContainer) qrCodeContainer.style.display = "none";
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

// Sao chép link cài đặt kèm cấu hình URL để gửi sang điện thoại
if (btnCopyShareLink) {
  btnCopyShareLink.addEventListener("click", () => {
    const url = apiUrlInput.value.trim() || (localStorage.getItem(STORAGE_KEYS.API_URL) || "").trim();
    if (!url) {
      showToast("Vui lòng nhập Web App URL trước khi sao chép!", "error");
      return;
    }
    const email = (gmailAccountInput ? gmailAccountInput.value.trim() : "") || (localStorage.getItem(STORAGE_KEYS.EMAIL) || "").trim();
    let shareUrl = window.location.origin + window.location.pathname;
    if (!shareUrl.endsWith("/")) shareUrl += "/";
    shareUrl += `?api=${encodeURIComponent(url)}`;
    if (email) shareUrl += `&email=${encodeURIComponent(email)}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Đã sao chép link! Hãy gửi link này sang điện thoại để tự động đồng bộ.", "success");
      }).catch(() => {
        prompt("Sao chép link này và mở trên điện thoại:", shareUrl);
      });
    } else {
      prompt("Sao chép link này và mở trên điện thoại:", shareUrl);
    }
  });
}

// Bật/tắt hiển thị mã QR để quét bằng camera điện thoại
if (btnToggleQrCode) {
  btnToggleQrCode.addEventListener("click", () => {
    const url = apiUrlInput.value.trim() || (localStorage.getItem(STORAGE_KEYS.API_URL) || "").trim();
    if (!url) {
      showToast("Vui lòng nhập Web App URL trước khi tạo mã QR!", "error");
      return;
    }
    const email = (gmailAccountInput ? gmailAccountInput.value.trim() : "") || (localStorage.getItem(STORAGE_KEYS.EMAIL) || "").trim();
    let shareUrl = window.location.origin + window.location.pathname;
    if (!shareUrl.endsWith("/")) shareUrl += "/";
    shareUrl += `?api=${encodeURIComponent(url)}`;
    if (email) shareUrl += `&email=${encodeURIComponent(email)}`;

    if (!qrCodeContainer || !qrCodeImg) return;

    if (qrCodeContainer.style.display === "none" || !qrCodeContainer.style.display) {
      qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`;
      qrCodeContainer.style.display = "block";
    } else {
      qrCodeContainer.style.display = "none";
    }
  });
}

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

// ================= 12. THANH ĐIỀU HƯỚNG TAB TRÊN ĐIỆN THOẠI =================
const mobileNavBar = document.getElementById("mobileNavBar");
if (mobileNavBar) {
  const tabBtns = mobileNavBar.querySelectorAll(".mobile-nav-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.getAttribute("data-tab") || "all";
      document.body.classList.remove("tab-all", "tab-entry", "tab-list", "tab-stats");
      document.body.classList.add(`tab-${tab}`);
    });
  });
}
