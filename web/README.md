# 📱 Ứng Dụng Web Quản Lý Chi Tiêu Đa Thiết Bị

Ứng dụng web giúp bạn nhập nhanh các khoản chi tiêu hàng ngày từ **điện thoại (iPhone, Android)**, máy tính bảng hoặc máy tính khác mà **không cần mở máy tính cá nhân ở nhà**. Dữ liệu được đồng bộ trực tiếp vào file Google Sheets trên Google Drive của bạn.

---

## 🚀 Hướng Dẫn Thiết Lập (Chỉ 1 Phút)

### Bước 1: Sao chép mã nguồn Backend lên Google Drive
1. Mở trình duyệt và truy cập file **Google Sheets** chi tiêu của bạn trên Google Drive (hoặc mở [script.google.com](https://script.google.com)).
2. Trên thanh menu, chọn: **Tiện ích mở rộng** (*Extensions*) -> **Apps Script**.
3. Xóa toàn bộ nội dung trong file `Code.gs` và dán toàn bộ code từ file [Code.gs](Code.gs) vào.
4. Bấm biểu tượng 💾 **Lưu** (*Save project*).

---

### Bước 2: Triển khai thành Web App
1. Ở góc trên bên phải của trang Apps Script, bấm nút **Triển khai** (*Deploy*) -> Chọn **Tùy chọn triển khai mới** (*New deployment*).
2. Bấm vào biểu tượng bánh răng ⚙️ bên cạnh "Chọn loại", chọn **Ứng dụng web** (*Web app*).
3. Điền cấu hình như sau:
   - **Mô tả** (*Description*): `Quan ly chi tieu Web`
   - **Thực thi dưới dạng** (*Execute as*): **Tôi** (*Me - your-email@gmail.com*)
   - **Ai có quyền truy cập** (*Who has access*): **Bất kỳ ai** (*Anyone*)
4. Bấm **Triển khai** (*Deploy*).
5. Khi Google hiển thị cửa sổ cấp quyền:
   - Bấm **Ủy quyền truy cập** (*Authorize access*).
   - Chọn tài khoản Google của bạn.
   - Bấm **Nâng cao** (*Advanced*) -> Bấm **Đi tới... (không an toàn)**.
   - Bấm **Cho phép** (*Allow*).
6. Google sẽ cung cấp cho bạn một **URL Ứng dụng web** (có dạng: `https://script.google.com/macros/s/AKfycb.../exec`). Hãy copy URL này.

---

### Bước 3: Sử dụng trên Điện Thoại hoặc Máy Tính Khác

#### Cách 1: Sử dụng giao diện Web cục bộ / GitHub Pages
1. Mở file [index.html](index.html) trên trình duyệt thiết bị của bạn.
2. Bấm vào biểu tượng ⚙️ (**Cài đặt**) ở góc trên bên phải.
3. Dán URL Web App vừa copy ở Bước 2 vào và bấm **Lưu cài đặt**.
4. Biểu tượng trạng thái sẽ chuyển sang màu xanh: **Đã kết nối Drive**.

#### Cách 2: Ghim thành App trên Màn hình chính Điện thoại (Khuyên dùng)
- **Trên iPhone (Safari)**:
  1. Mở đường link Web trên Safari.
  2. Bấm nút Chia sẻ (biểu tượng hình vuông có mũi tên trỏ lên ở thanh dưới cùng).
  3. Chọn **Thêm vào màn hình chính** (*Add to Home Screen*).
  4. Đặt tên "Chi Tiêu" và bấm Thêm. App sẽ xuất hiện như 1 ứng dụng thật trên màn hình iPhone!
- **Trên Android (Chrome)**:
  1. Mở đường link Web trên Google Chrome.
  2. Bấm vào dấu 3 chấm góc trên bên phải.
  3. Chọn **Cài đặt ứng dụng** hoặc **Thêm vào màn hình chính** (*Add to Home screen*).

---

## 🔄 Luồng Đồng Bộ 2 Chiều
- Khi bạn nhập một khoản chi từ điện thoại: Dòng mới sẽ được ghi ngay lập tức vào đúng tab tháng (ví dụ: `Tháng 10-2026`) trên Google Sheet, các công thức tổng kết được tự động tính toán.
- Khi bạn mở ứng dụng Desktop `quanly.py`: Ứng dụng sẽ tự động tải các dữ liệu mới này về máy để bạn theo dõi báo cáo, biểu đồ.
