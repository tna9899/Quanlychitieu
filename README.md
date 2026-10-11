# 💰 Quản Lý Chi Tiêu Cá Nhân (Desktop & Web Mobile App)

Hệ thống quản lý chi tiêu cá nhân thông minh, hỗ trợ nhập liệu đa nền tảng từ **Máy tính để bàn (Python Tkinter)** và **Điện thoại di động (Web App / PWA)**. Toàn bộ dữ liệu được lưu trữ và đồng bộ 2 chiều tự động trên **Google Sheets / Google Drive**.

![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20iOS%20%7C%20Android-green.svg)
![Storage](https://img.shields.io/badge/Storage-Google%20Sheets-success.svg)
[![Live Web App](https://img.shields.io/badge/Web%20App-Online%20(GitHub%20Pages)-success?logo=github)](https://tna9899.github.io/Quanlychitieu/)

> 📱 **Trang Web nhập chi tiêu trực tuyến trên điện thoại / máy tính khác:**  
> 👉 [**https://tna9899.github.io/Quanlychitieu/**](https://tna9899.github.io/Quanlychitieu/)

---

## 🌟 Tính Năng Nổi Bật

- **Đồng bộ thời gian thực 2 chiều**: Dữ liệu lưu trực tiếp vào file Google Spreadsheet `Danh sách chi tiêu [Năm]` trên Google Drive.
- **Nhập liệu đa thiết bị**:
  - 🖥️ **Desktop App**: Ứng dụng Tkinter mượt mà, giao diện hiện đại, tự động vẽ biểu đồ tròn tỷ lệ chi tiêu theo tháng.
  - 📱 **Web Mobile App**: Giao diện tối ưu cho màn hình cảm ứng điện thoại, hỗ trợ ghim ra màn hình chính (Add to Home Screen như App gốc), các phím nhập tiền nhanh (`+10k`, `+50k`, `+100k`...), nhập chi tiêu mọi lúc mọi nơi kể cả khi máy tính tắt.
- **Tự động phân nhóm & Thống kê**: Tự động chia tab theo từng tháng (`Tháng 10-2026`), tính tổng tự động bằng công thức `SUMIF` cho 8 danh mục cố định.
- **Bảo mật**: Dữ liệu hoàn toàn thuộc quyền sở hữu trong tài khoản Google Drive cá nhân của bạn.

---

## 📂 Cấu Trúc Dự Án

```
quanlychitieu/
├── quanly.py                  # Mã nguồn ứng dụng Desktop Python (Tkinter)
├── logo.ico                   # Icon ứng dụng Windows
├── logo.png                   # Logo ứng dụng
├── logo_38.png                # Logo kích thước nhỏ
├── credentials.template.json  # File mẫu cấu hình Google Drive API
├── .gitignore                 # Bỏ qua file rác và token nhạy cảm
├── README.md                  # Hướng dẫn dự án
└── web/                       # Dự án Web App nhập liệu cho điện thoại / thiết bị khác
    ├── index.html             # Giao diện Web App chuẩn Mobile / PWA
    ├── style.css              # Giao diện hiện đại, responsive
    ├── app.js                 # Xử lý nhập liệu, lưu trữ và gửi API
    ├── Code.gs                # Backend Google Apps Script (chạy 24/7 trên Google)
    └── README.md              # Hướng dẫn chi tiết triển khai Web App
```

---

## 🚀 Hướng Dẫn Sử Dụng

### 1. Ứng dụng Desktop (Python)

#### Cài đặt thư viện:
```bash
pip install pandas openpyxl pillow tkcalendar google-api-python-client google-auth-httplib2 google-auth-oauthlib
```

#### Chạy ứng dụng:
```bash
python quanly.py
```

#### Đóng gói thành file `.exe` độc lập:
```bash
pyinstaller --noconsole --onefile --icon=logo.ico --add-data "logo.ico;." --add-data "logo.png;." quanly.py
```

---

### 2. Ứng dụng Web trên Điện thoại / Thiết bị khác

Xem hướng dẫn chi tiết từng bước tại [web/README.md](web/README.md).

1. Mở file Google Sheets chi tiêu của bạn trên trình duyệt -> Chọn **Tiện ích mở rộng** (*Extensions*) -> **Apps Script**.
2. Dán nội dung file [web/Code.gs](web/Code.gs) vào và bấm **Triển khai** (*Deploy*) dưới dạng **Ứng dụng web** (*Web app*).
3. Copy đường link Web App URL dán vào phần **Cài đặt** trên [web/index.html](web/index.html) hoặc ghim link trực tiếp ra màn hình chính điện thoại để sử dụng hàng ngày!

---

## 🔒 Bản Quyền & Bảo Mật
Mã nguồn phát triển bởi **tna9899**. Mọi thông tin tài khoản và chi tiêu được lưu trữ an toàn trong tài khoản Google Drive cá nhân.
