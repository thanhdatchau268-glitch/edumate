# Hướng dẫn đưa VnStarL lên Netlify + Google Sheets (Apps Script)

Mọi mã nguồn đã được chuẩn bị sẵn trong `Frontend/`, `AppsScript/` và `netlify.toml`. Bạn chỉ cần làm đúng **3 bước** sau:

---

## Bước 1: Dán Backend lên Google Apps Script (gắn trực tiếp vào Google Sheet)

1. Mở Google Sheet dữ liệu của bạn:  
   https://docs.google.com/spreadsheets/d/1ucNytz6Pcz9UhHeBkwAWDRyppDsiLrmw18vCmleDIWo/edit
2. Trên thanh menu chọn **Tiện ích mở rộng (Extensions) → Apps Script**.
3. Trong trình soạn thảo Apps Script:
   - Mở file `Mã.gs` (hoặc `Code.gs`) mặc định, xóa sạch nội dung cũ và dán toàn bộ nội dung file `AppsScript/Code.gs`.
   - Bấm nút **+** bên cạnh mục *Tệp (Files)* → chọn **Tập lệnh (Script)** để tạo lần lượt các file sau (tên không cần `.gs`) rồi dán nội dung tương ứng từ thư mục `AppsScript/`:
     1. `StaticData` (`AppsScript/StaticData.gs`)
     2. `CryptoHelper` (`AppsScript/CryptoHelper.gs`)
     3. `SheetDB` (`AppsScript/SheetDB.gs`)
     4. `GradingAndModules` (`AppsScript/GradingAndModules.gs`)
     5. `LuyenTapMucTieu` (`AppsScript/LuyenTapMucTieu.gs`) *(chấm từng câu tức thì, đo độ sẵn sàng mục tiêu & nhịp/tương tác Vườn Saoladou V28)*
     6. `DapAnData` (`AppsScript/DapAnData.gs`) *(file đáp án bí mật — chỉ nằm trên Apps Script, không đẩy lên GitHub)*
     7. `DeData1` (`AppsScript/DeData1.gs`)
     8. `DeData2` (`AppsScript/DeData2.gs`)
     9. `DeData3` (`AppsScript/DeData3.gs`)
   - *(Khuyên làm 1 lần)*: Ở thanh chọn hàm phía trên, chọn **`testCryptoSelfCheck`** → bấm **Chạy (Run)** và cấp quyền cho Google Sheet / Drive / Gmail khi hiện hộp thoại xác nhận (*Nâng cao → Đi tới dự án... → Cho phép*). Kiểm tra *Nhật ký thực thi* thấy `scrypt RFC7914 vec1 ok=true, pbkdf2 ok=true` là chuẩn 100%.

---

## Bước 2: Triển khai (Deploy) Apps Script thành Web App

1. Bấm nút **Triển khai (Deploy) → Tùy chọn triển khai mới (New deployment)** ở góc trên bên phải.
2. Bấm biểu tượng bánh răng chọn loại **Ứng dụng web (Web app)**:
   - **Thực thi dưới tư cách (Execute as):** **Tôi (Me — thanhdatchau268@gmail.com)**
   - **Ai có quyền truy cập (Who has access):** **Bất kỳ ai (Anyone)**
3. Bấm **Triển khai (Deploy)** → Sao chép đường link **Ứng dụng web (Web app URL)** có dạng:  
   `https://script.google.com/macros/s/AKfycb.../exec`

> **Lưu ý khi chỉnh sửa Apps Script sau này:** Mỗi lần sửa code `.gs` trên Google Apps Script, nhớ chọn **Triển khai → Quản lý các lần triển khai → biểu tượng bút chì → Phiên bản mới (New version)** thì bản chạy web mới cập nhật.

---

## Bước 3: Nối Frontend vào Apps Script & Đẩy lên Netlify

1. Mở file `Frontend/api-config.js` và dán link Web App vừa copy vào dòng:
   ```js
   global.VNSTARL_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycb.../exec";
   ```
2. Đưa web lên **Netlify** theo 1 trong 2 cách:
   - **Cách A — Netlify Drop (nhanh nhất, 10 giây):** Truy cập https://app.netlify.com/drop và kéo-thả thẳng thư mục `Frontend/` vào.
   - **Cách B — Qua GitHub (tự động cập nhật khi push):**
     - Chạy `git add . && git commit -m "Cau hinh Netlify + Apps Script" && git push`
     - Vào Netlify → **Add new site → Import an existing project** → chọn repo GitHub `edumate`.
     - File `netlify.toml` đã khai báo sẵn `publish = "Frontend"` nên chỉ cần bấm **Deploy site**.

---

## Ghi chú về các tính năng sau khi lên Netlify
- **Đáp án (`DapAnData.gs`):** Đã tách hoàn toàn lên Apps Script, không tồn tại trong `Frontend/` nên học sinh không xem trộm được qua DevTools.
- **Tài khoản cũ (`scrypt:32768:8:1`):** Tất cả tài khoản đã chuyển từ `edumate.db` vẫn đăng nhập bình thường; lần đăng nhập đầu tiên sẽ tự nâng cấp mật khẩu sang `pbkdf2:sha256` để các lần sau đăng nhập nhanh tức thì.
- **Quên mật khẩu & Avatar riêng:** Tự động gửi OTP thật qua Gmail của bạn (`MailApp.sendEmail`) và lưu avatar tải lên vào thư mục `VnStarL_Avatars` trên Google Drive.
- **Chấm tự luận hiện tại:** Đang dùng chấm từ khóa (`chamTuLuan`) chạy trực tiếp trên Apps Script; phần chấm ngữ nghĩa AI ONNX có thể nối thêm API ngoài sau này.
