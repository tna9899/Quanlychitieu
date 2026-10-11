// Biểu tượng tương ứng cho từng danh mục
const CATEGORY_ICONS = {
  "Ăn uống": "🍜",
  "Di chuyển": "🛵",
  "Mua sắm": "🛍️",
  "Giải trí": "🎬",
  "Điện nước": "💡",
  "Cá nhân": "👤",
  "Tiền trọ": "🏠",
  "Hiếu/ Hỉ": "💌"
};

const STORAGE_KEYS = {
  API_URL: "qly_expense_api_url",
  RECENT_ITEMS: "qly_expense_recent_items",
  MONTH_TOTAL: "qly_expense_month_total"
};

// DOM Elements
const expenseForm = document.getElementById("expenseForm");
const expenseDate = document.getElementById("expenseDate");
const expenseAmount = document.getElementById("expenseAmount");
const selectedCategoryInput = document.getElementById("selectedCategory");
const expenseNote = document.getElementById("expenseNote");
const btnSubmit = document.getElementById("btnSubmit");
const btnSubmitText = document.getElementById("btnSubmitText");
const btnSpinner = document.getElementById("btnSpinner");
const categoryOptions = document.querySelectorAll(".category-option");
const chipButtons = document.querySelectorAll(".chip-btn[data-add]");
const btnClearAmount = document.getElementById("btnClearAmount");
const recentList = document.getElementById("recentList");
const btnClearHistory = document.getElementById("btnClearHistory");
const totalMonthAmount = document.getElementById("totalMonthAmount");
const entryCountText = document.getElementById("entryCountText");
const currentMonthText = document.getElementById("currentMonthText");
const refreshSummary = document.getElementById("refreshSummary");
const connectionStatus = document.getElementById("connectionStatus");
const statusText = document.getElementById("statusText");

// Modal elements
const btnSettings = document.getElementById("btnSettings");
const settingsModal = document.getElementById("settingsModal");
const btnCloseSettings = document.getElementById("btnCloseSettings");
const btnSaveSettings = document.getElementById("btnSaveSettings");
const btnTestConnection = document.getElementById("btnTestConnection");
const apiUrlInput = document.getElementById("apiUrlInput");

// Toast
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const toastIcon = document.getElementById("toastIcon");

// --- 1. KHỞI TẠO MẶC ĐỊNH ---
function initApp() {
  // Đặt ngày hôm nay theo giờ địa phương YYYY-MM-DD
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  expenseDate.value = `${yyyy}-${mm}-${dd}`;
  currentMonthText.innerText = `Tháng ${mm}-${yyyy}`;

  // Tải cấu hình API
  const savedUrl = localStorage.getItem(STORAGE_KEYS.API_URL) || "";
  apiUrlInput.value = savedUrl;
  updateConnectionUI(Boolean(savedUrl));

  // Tải danh sách giao dịch gần đây
  renderRecentItems();
  updateMonthSummary();

  // Thử đồng bộ tổng chi tiêu từ server nếu đã có URL
  if (savedUrl) {
    fetchMonthSummaryFromServer(savedUrl);
  }
}

// Format số tiền có dấu phẩy ngăn cách hàng nghìn (ví dụ: 50,000)
function formatCurrencyNumber(value) {
  if (!value) return "";
  const cleanNumber = value.toString().replace(/\D/g, "");
  if (!cleanNumber) return "";
  return Number(cleanNumber).toLocaleString("vi-VN");
}

function parseCurrencyNumber(formattedString) {
  if (!formattedString) return 0;
  return Number(formattedString.toString().replace(/\D/g, "")) || 0;
}

// Xử lý khi người dùng gõ vào ô số tiền
expenseAmount.addEventListener("input", (e) => {
  const cursorPosition = e.target.selectionStart;
  const originalLength = e.target.value.length;
  const formatted = formatCurrencyNumber(e.target.value);
  e.target.value = formatted;
  
  // Giữ vị trí con trỏ hợp lý
  const newLength = formatted.length;
  e.target.setSelectionRange(cursorPosition + (newLength - originalLength), cursorPosition + (newLength - originalLength));
});

// Xử lý các nút bấm nhanh tiền (+10k, +20k,...)
chipButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const addVal = Number(btn.getAttribute("data-add")) || 0;
    const currentVal = parseCurrencyNumber(expenseAmount.value);
    const newVal = currentVal + addVal;
    expenseAmount.value = formatCurrencyNumber(newVal);
  });
});

btnClearAmount.addEventListener("click", () => {
  expenseAmount.value = "";
  expenseAmount.focus();
});

// Xử lý chọn danh mục
categoryOptions.forEach((opt) => {
  opt.addEventListener("click", () => {
    categoryOptions.forEach((o) => o.classList.remove("selected"));
    opt.classList.add("selected");
    selectedCategoryInput.value = opt.getAttribute("data-category");
  });
});

// --- 2. XỬ LÝ LƯU GIAO DỊCH GẦN ĐÂY ---
function getRecentItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT_ITEMS)) || [];
  } catch {
    return [];
  }
}

function saveRecentItem(item) {
  const list = getRecentItems();
  list.unshift(item); // Thêm lên đầu
  if (list.length > 20) list.pop(); // Giữ tối đa 20 mục
  localStorage.setItem(STORAGE_KEYS.RECENT_ITEMS, JSON.stringify(list));
  renderRecentItems();
  updateMonthSummary();
}

function renderRecentItems() {
  const list = getRecentItems();
  if (!list.length) {
    recentList.innerHTML = `<div class="empty-state">Chưa có khoản chi nào được thêm gần đây.</div>`;
    return;
  }

  recentList.innerHTML = list.map((item) => {
    const icon = CATEGORY_ICONS[item.category] || "💸";
    const noteText = item.note ? ` • ${escapeHtml(item.note)}` : "";
    return `
      <div class="recent-item">
        <div class="recent-item-left">
          <div class="recent-icon">${icon}</div>
          <div class="recent-details">
            <h4>${escapeHtml(item.category)}</h4>
            <p>${item.date}${noteText}</p>
          </div>
        </div>
        <div class="recent-amount">-${formatCurrencyNumber(item.amount)} ₫</div>
      </div>
    `;
  }).join("");
}

function updateMonthSummary() {
  const list = getRecentItems();
  const currentMonth = expenseDate.value ? expenseDate.value.substring(0, 7) : new Date().toISOString().substring(0, 7);
  
  // Tính tổng các mục thuộc tháng hiện tại trong bộ nhớ tạm
  const monthItems = list.filter((i) => i.date && i.date.startsWith(currentMonth));
  const localTotal = monthItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  
  const savedServerTotal = Number(localStorage.getItem(STORAGE_KEYS.MONTH_TOTAL)) || 0;
  const displayTotal = Math.max(localTotal, savedServerTotal);

  totalMonthAmount.innerText = `${formatCurrencyNumber(displayTotal)} ₫`;
  entryCountText.innerText = `${monthItems.length} khoản chi gần đây`;
}

btnClearHistory.addEventListener("click", () => {
  if (confirm("Bạn có chắc chắn muốn xóa danh sách hiển thị gần đây trên thiết bị này không? (Dữ liệu trên Google Sheet vẫn giữ nguyên)")) {
    localStorage.removeItem(STORAGE_KEYS.RECENT_ITEMS);
    localStorage.removeItem(STORAGE_KEYS.MONTH_TOTAL);
    renderRecentItems();
    updateMonthSummary();
    showToast("Đã làm sạch lịch sử hiển thị!", "success");
  }
});

// --- 3. GỬI DỮ LIỆU ĐẾN GOOGLE APPS SCRIPT ---
expenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const dateVal = expenseDate.value;
  const amountVal = parseCurrencyNumber(expenseAmount.value);
  const categoryVal = selectedCategoryInput.value;
  const noteVal = expenseNote.value.trim();

  if (!amountVal || amountVal <= 0) {
    showToast("Vui lòng nhập số tiền hợp lệ lớn hơn 0!", "error");
    expenseAmount.focus();
    return;
  }

  const payload = {
    date: dateVal,
    category: categoryVal,
    amount: amountVal,
    note: noteVal,
    device: navigator.userAgent
  };

  const apiUrl = (localStorage.getItem(STORAGE_KEYS.API_URL) || "").trim();

  // Bật trạng thái Loading
  setLoadingState(true);

  try {
    if (apiUrl) {
      // Gửi POST tới Google Apps Script Web App
      // Lưu ý: Dùng text/plain để tránh preflight CORS block của Google
      await fetch(apiUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      });
      showToast("Đã lưu thành công vào Google Sheet!", "success");
    } else {
      showToast("Đã lưu cục bộ! (Chưa cài đặt URL Google Apps Script)", "error");
      openSettings();
    }

    // Lưu vào lịch sử hiển thị
    saveRecentItem(payload);

    // Reset lại form nhưng giữ nguyên ngày đã chọn
    expenseAmount.value = "";
    expenseNote.value = "";
    expenseAmount.focus();

    // Làm mới số liệu tổng
    if (apiUrl) {
      setTimeout(() => fetchMonthSummaryFromServer(apiUrl), 1500);
    }
  } catch (err) {
    console.error("Lỗi gửi dữ liệu:", err);
    showToast("Lỗi kết nối khi gửi dữ liệu: " + err.message, "error");
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
    btnSubmitText.innerText = "💾 Lưu chi tiêu";
    btnSpinner.style.display = "none";
  }
}

// --- 4. KẾT NỐI VÀ ĐỒNG BỘ GOOGLE APPS SCRIPT ---
async function fetchMonthSummaryFromServer(url) {
  try {
    const today = new Date();
    const targetUrl = `${url}?action=summary&year=${today.getFullYear()}&month=${today.getMonth() + 1}`;
    const res = await fetch(targetUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.total === "number") {
        localStorage.setItem(STORAGE_KEYS.MONTH_TOTAL, data.total);
        totalMonthAmount.innerText = `${formatCurrencyNumber(data.total)} ₫`;
        if (data.count) {
          entryCountText.innerText = `${data.count} khoản chi trên Drive`;
        }
        updateConnectionUI(true);
      }
    }
  } catch (e) {
    console.warn("Chưa lấy được tổng tự động từ server:", e);
  }
}

refreshSummary.addEventListener("click", () => {
  const url = localStorage.getItem(STORAGE_KEYS.API_URL);
  if (url) {
    showToast("Đang đồng bộ số liệu...", "success");
    fetchMonthSummaryFromServer(url);
  } else {
    updateMonthSummary();
  }
});

// --- 5. CÀI ĐẶT MODAL & TEST KẾT NỐI ---
function openSettings() {
  settingsModal.classList.add("active");
  apiUrlInput.value = localStorage.getItem(STORAGE_KEYS.API_URL) || "";
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
    fetchMonthSummaryFromServer(url);
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

  try {
    const testUrl = `${url}?action=ping`;
    const res = await fetch(testUrl);
    const data = await res.json();
    if (data && data.status === "ok") {
      showToast("Kết nối Google Apps Script thành công! ✓", "success");
      updateConnectionUI(true);
    } else {
      showToast("Đã kết nối được tới script!", "success");
    }
  } catch (e) {
    // Nếu bị CORS hoặc gọi được nhưng dạng get
    showToast("URL phản hồi. Bạn có thể bấm Lưu cài đặt để sử dụng!", "success");
  } finally {
    btnTestConnection.innerText = "Thử kết nối";
    btnTestConnection.disabled = false;
  }
});

function updateConnectionUI(isConnected) {
  if (isConnected) {
    connectionStatus.className = "status-pill status-connected";
    statusText.innerText = "Đã kết nối Drive";
  } else {
    connectionStatus.className = "status-pill status-disconnected";
    statusText.innerText = "Chưa kết nối";
  }
}

// --- 6. TOAST NOTIFICATION ---
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

// Khởi chạy
initApp();
