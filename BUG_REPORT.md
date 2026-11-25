# Báo Cáo Kiểm Toán Mã Nguồn (Code Audit Report) — Dự Án VnStarL (`d:\KHTT`)

## 0. Nghi ngờ là bug — Cần xác nhận trước khi sửa (Rà soát 26/11)

> [!IMPORTANT]
> Các lỗi **chắc chắn là bug** (lệch thụt lề `dia_json.py`, `KeyError` trong `so_loi.py`, thiếu `hang.js` ở `subjects.html`, XSS ở `auth.js`/`subjects.js`/`daily-checkin.js`/`qua.js`, open-redirect `sw.js`, phá DOM `.profile-card` khi offline ở `profile.js`, `catO` tràn biên ở `tkb-ocr.js`, lỗi `ngayVN`/`kb_da_xem` ở `khoa-bang.js`, lỗi chia 0 & xuống dòng ở `qua.js`, lỗi guard `#quay-lai`/sort/lỗi inline ở `lesson.js`, tắt giọng web + AI voice và thêm `Coming soon` ở `profile.html`) **đã được sửa trực tiếp**.
>
> Các mục dưới đây **nghi ngờ là bug hoặc là chủ ý demo/thiết kế tạm thời**, giữ nguyên để bạn xem xét trước khi quyết định sửa:

1. **Lệch tên hành động & thiếu sprite Saoladou góc phải màn hình (`Frontend/pet.js`, `Frontend/bai-tap.js`, `Frontend/img/pet/manifest.json`)**
   - `pet.js` và `bai-tap.js` gọi các hành động `"vui"`, `"noi"`, `"hoc"`, `"khoc"`, nhưng `manifest.json` và thư mục `Frontend/img/pet/than/mac_dinh/` hiện chỉ có `choi_vui.webp`, `idle.webp`, `ngu.webp`, `an_la.webp`, `di_bo.webp`, `focus_combo.webp`, `hoan_thanh_chang.webp`, `khich_le_co_len.webp`, `nghi_ngoi.webp`, `ngoi_ghe.webp`, `om_met.webp`, `tam_song.webp`, `vuon_idle.webp`.
   - Khi gọi `"vui"`, `pet.js` rơi về `idle`; khi gọi `"noi"`, `"hoc"`, `"khoc"`, hệ thống bỏ qua hoặc fallback nếu không tìm thấy file trong `manifest.json`.
   - *Cần xác nhận*: Bạn muốn bổ sung 4 file sprite `vui.webp`, `noi.webp`, `hoc.webp`, `khoc.webp` theo format mới hay ánh xạ `"vui"` sang `"choi_vui"` có sẵn?

2. **Cơ chế xác thực / demo nội bộ ở Backend (`Backend/script/app.py`, `pet.py`, `qua_tang.py`)**
   - Nhiều API nhận `user_id` trực tiếp từ request chưa đối chiếu session/token (rủi ro IDOR nếu đưa lên môi trường công khai).
   - Route `/api/forgot-password/google-verify` (`app.py`) giải mã phần payload JWT để lấy email khi demo thay vì xác thực chữ ký RS256 với Google.
   - `CHO_PHEP_DEV = True` (`pet.py:L44`) và `app.run(debug=True)` (`app.py:L971`) đang bật sẵn; `smtp_config.json` lưu cấu hình gửi mail ngay trong repo nếu không cẩn thận khi commit.
   - *Cần xác nhận*: Nếu chỉ demo local/offline ban giám khảo thì giữ nguyên để tiện test; nếu deploy thật cần khóa auth/tắt debug.

3. **Dữ liệu bài tập placeholder ở các bài Vật lý khác (`Frontend/file_de/vat_ly/`, `Backend/Dap_an/vat_ly/`, `AppsScript/DapAnData.gs`)**
   - Ngoài `vat_ly/chuong-1/bai-02` vừa chuyển đổi xong từ file Lý 9 Bài 1 của bạn, các bài khác như `chuong-1/bai-03`, `bai-04`, `chuong-2/bai-05..10`, `chuong-3/bai-11..13` vẫn đang dùng dữ liệu placeholder hoặc đáp án mẫu khúc xạ ánh sáng trong `DapAnData.gs` / `Backend/Dap_an`.

4. **Hardcode URL `http://127.0.0.1:5000` & cấu hình Google GSI (`Frontend/script.js`, `auth.js`, `thong-bao.js`, `gate.js`, `khaosat.js`, `login.html`)**
   - Nếu chạy qua `localhost` hoặc LAN/Netlify kết hợp Backend Flask riêng, hardcode `127.0.0.1:5000` có thể làm thiết bị khác không gọi được API (trừ khi bạn đang dùng chế độ Apps Script / dữ liệu tĩnh).
   - Nút `"Chọn Gmail trong máy"` ở `login.html` / `register.html` hiện đọc lịch sử email trong `localStorage` thay vì chạy Google Identity Services thực thụ.

5. **XSS ở phần nội dung bài tập/lý thuyết có nhúng HTML/KaTeX (`Frontend/bai-tap.js`, `Frontend/quiz-tung-cau.js`, `Frontend/so-loi.js`, `Frontend/contest.js`)**
   - Các chuỗi từ API người dùng/quản trị đã được escape ở các file mới sửa (`auth.js`, `subjects.js`, `daily-checkin.js`, `qua.js`), nhưng phần render `de_bai` / `ly_thuyet` / `loi_giai` ở `bai-tap.js`, `quiz-tung-cau.js`, `so-loi.js`, `contest.js` cố ý dùng `innerHTML` để hiển thị thẻ `<br>`, `<b>`, `<table>`, SVG và công thức `$...$` nên chưa tự tước HTML ở đó (cần thư viện sanitize chuẩn như DOMPurify nếu mở cho người lạ nhập đề).

6. **Các khung UI chưa nối hết tính năng (`tkb-ocr.js`, `subjects.js`, `khoa-bang.js`, `personal.js`)**
   - Xem chi tiết ở **Mục 3, 4, 5** bên dưới (thống kê tuần ở `subjects.js`, thẻ `#kb-the`, dọn `worker.terminate()` và `URL.revokeObjectURL()` trong `tkb-ocr.js`, trang phục `ao_dai`...).

---

## 1. Tổng quan Audit & Phạm vi kiểm tra

Báo cáo này tổng hợp kết quả kiểm toán mã nguồn toàn dự án (Read-Only) trên 5 phân hệ, đối chiếu chéo giữa Frontend, Backend, cơ sở dữ liệu và tài nguyên tĩnh (`img/`, `audio/`, `file_de/`, `Dap_an/`):

1. **Backend Core & Database**: `Backend/Database/init_db.py`, `kb_secret.key`, `edumate.db`, `Backend/script/app.py`, `db_ops.py`, `smtp_config.json`, `test_khoa_bang.py`, `.gitignore`, `.vscode/settings.json`, `.vscode/tasks.json`.
2. **Backend Modules & Scripts**: `cham_ngu_nghia.py`, `cham_tu_luan.py`, `chot_ky.py`, `khoa_bang.py`, `nhiem_vu.py`, `pet.py`, `qua_tang.py`, `so_loi.py`, `tien_do.py`, `cat_anh_pet.py`, `dia_json.py`, `docx_to_md.py`, `md_to_json.py`, `md_to_json_all.py`, `md_to_lythuyet.py`, `de.json`.
3. **Frontend Core & Auth**: `index.html`, `script.js`, `style.css`, `style2.css`, `style3.css`, `login.html`, `register.html`, `auth.js`, `auth.css`, `gate.js`, `gate.css`, `notched-nav.js`, `notched-nav.css`, `sw.js`, `am-thanh.js`, `thong-bao.js`, `form.html`, `form.css`, `khaosat.html`, `khaosat.js`, `diem_chuan_2026.json`, `tkb-ocr.js`, `ky-thi.js`.
4. **Frontend Study**: `subjects.*`, `subject-orbit.css`, `lesson.*`, `problems.html`, `bai-tap.js`, `quiz-tung-cau.*`, `contest.*`, `so-loi*`, `tien-do.css`, đối chiếu `file_de/` và `Dap_an/`.
5. **Frontend Gamification**: `pet.js`, `pet.css`, `pet-ho-so.js`, `qua.*`, `nhiem-vu.*`, `daily-checkin.*`, `ranking.*`, `hang.js`, `khoa-bang.*`, `profile.*`, `personal.*`, đối chiếu `img/pet/`, `audio/pet/`.

### Bảng thống kê số lượng lỗi (đã gộp/khử trùng lặp liên phân hệ)

| Phân hệ (Module) | Nghiêm trọng (Critical) | Trung bình (Warning) | Tối ưu (Minor) | Chưa có code mà giao diện đã nói (Unimplemented / Stub) | Tổng cộng |
| --- | ---: | ---: | ---: | ---: | ---: |
| **Backend Core & Database** | 8 | 12 | 8 | 4 | **32** |
| **Backend Modules & Scripts** | 8 | 19 | 10 | 1 | **38** |
| **Frontend Core & Auth** | 7 | 11 | 12 | 4 | **34** |
| **Frontend Study** | 6 | 5 | 5 | 3 | **19** |
| **Frontend Gamification** | 5 | 14 | 8 | 5 | **32** |
| **Tổng cộng** | **34** | **61** | **43** | **17** | **155** |

> **Lưu ý về môi trường kiểm chứng & gộp lỗi:**
> - **Môi trường kiểm chứng (Backend Core)**: Không chạy được `python -m py_compile` do môi trường sandbox không có `python`/`py` khả dụng; file `.vscode/launch.json` không đọc được do hết thời gian chờ quyền truy cập (60s).
> - **Khử trùng lặp liên phân hệ**: Các lỗi xuất hiện ở cả Frontend và Backend (hoặc giữa nhiều module Frontend) như thiếu xóa `kbToken` trong `dangXuat()`, `notched-nav.js` kiểm tra sai key `localStorage`, lệch trường `demo_otp` giữa Backend–Frontend, lỗ hổng IDOR thiếu token xác thực từ cả client và server, và giá bán skin `ao_dai` chưa có API mua đã được gộp thành mục duy nhất và giữ đầy đủ đường dẫn + số dòng ở các phía liên quan.

---

## 2. Nghiêm trọng (Critical)

### 2.1. Backend Core & Database (8 lỗi)

1. **Chiếm đoạt mọi tài khoản qua API Google Verify**
   - **Vị trí**: `Backend/script/app.py:L461-L513` (`L464`, `L468-L484`, `L498-L512`)
   - **Nguyên nhân & Tác động**: `/api/forgot-password/google-verify` tự giải mã base64 phần payload JWT (`L470-L480`) mà **không xác thực chữ ký, `aud`, `iss` hay `exp`**, đồng thời cho phép truyền thẳng `{"email": "..."}` trong JSON (`L464`) nếu không gửi `credential`. Bất kỳ ai cũng có thể lấy `reset_token` hợp lệ để đổi mật khẩu mọi tài khoản qua `/api/forgot-password/reset-password`.

2. **Thiếu xác thực token & lỗ hổng IDOR trên các API người dùng và nộp bài**
   - **Vị trí**: `Backend/script/app.py:L586-L589`, `L715-L724`, `L735-L759`, `L785-L791`, `L846-L894` (đối chiếu client gửi `user_id` từ `localStorage` không kèm token tại `Frontend/profile.js:L177,L244,L321`)
   - **Nguyên nhân & Tác động**: Dù `login` có cấp token (`L185`), các route `PUT /api/users/<id>/mon-chuyen`, `PUT /api/users/<id>`, `PUT /api/users/<id>/avatar`, `POST /api/users/<id>/avatar-upload`, `POST /api/submit` và `POST /api/contests/<cid>/submit` đều **không kiểm tra `Authorization` token**, tin hoàn toàn `user_id` từ URL/body. Kẻ tấn công có thể sửa hồ sơ/avatar người khác hoặc nộp bài thi 0 điểm hộ nạn nhân để khóa lượt thi vĩnh viễn (`INSERT OR IGNORE` ở `L816`).

3. **Lộ khóa ký token & cơ sở dữ liệu thật trong Git**
   - **Vị trí**: `Backend/Database/kb_secret.key:L1`, `Backend/Database/edumate.db`, `.gitignore` (đối chiếu `Backend/script/khoa_bang.py:L405`)
   - **Nguyên nhân & Tác động**: Cả file khóa bí mật (`kb_secret.key`) lẫn database thật (`edumate.db`) đều đang được track trong Git và không nằm trong `.gitignore` (trái với chú thích `(KHÔNG commit)` ở `khoa_bang.py:L405`). Ai có quyền truy cập repo đều giả mạo được Bearer token cho mọi `user_id`.

4. **API cấu hình SMTP mở công khai & lưu plaintext App Password**
   - **Vị trí**: `Backend/script/app.py:L223-L224`, `L236-L288` (`L260-L271`), `Backend/script/smtp_config.json:L1-L6`, `.gitignore`; đối chiếu `Frontend/login.html:L281-L295`, `Frontend/auth.js:L556-L601`
   - **Nguyên nhân & Tác động**: `GET/POST /api/forgot-password/smtp-config` không yêu cầu đăng nhập/admin, cho phép đọc `smtp_email` và ghi đè cấu hình SMTP toàn server (modal Quên mật khẩu ở Frontend cũng cho phép người chưa đăng nhập gửi `smtp_email`/`smtp_password` lên endpoint này). Mật khẩu ứng dụng Gmail bị lưu plaintext vào `smtp_config.json` và file này chưa có trong `.gitignore`.

5. **Tự động tạo tài khoản mật khẩu yếu `"123456"` khi gửi OTP**
   - **Vị trí**: `Backend/script/app.py:L366-L376` (`L370`)
   - **Nguyên nhân & Tác động**: `POST /api/forgot-password/send-otp` tự động tạo user mới với mật khẩu mặc định `"123456"` nếu email chưa tồn tại trong DB mà không kiểm tra định dạng email hay xác minh quyền sở hữu trước.

6. **Chuỗi lỗ hổng OTP (PRNG yếu, không vô hiệu hóa OTP cũ, không rate-limit, bypass hết hạn)**
   - **Vị trí**: `Backend/script/app.py:L269`, `L379`, `L384-L387`, `L407-L458`, `L533-L549`
   - **Nguyên nhân & Tác động**: OTP sinh bằng `random.randint` (`L379`, `L269`) thay vì `secrets`; gửi OTP mới không vô hiệu hóa OTP cũ (`L418-L422` match theo `email` + `otp` nên mọi OTP còn hạn trước đó vẫn dùng được); không giới hạn số lần đoán sai OTP 6 số; `L432-L438` và `L543-L549` dùng `try...except: pass` quanh `datetime.strptime`, bỏ qua luôn kiểm tra hết hạn nếu `expires_at` lỗi định dạng.

7. **[DONE] Crash 500 trên `POST /api/contests/<cid>/submit` & `PUT /api/users/<id>/mon-chuyen`**
   - **Vị trí**: `Backend/script/app.py:L717-L718`, `L806-L813`
   - **Nguyên nhân & Tác động**: `contest_submit` mở `contest/<cid>.json` (`L807`) không kiểm tra tồn tại/`try/except` dễ gây `FileNotFoundError`/`JSONDecodeError` (500), không kiểm tra `isinstance(answers, dict)` (`AttributeError`), và truy cập thẳng `info['dap_an_dung']` gây `KeyError` với câu `tu-luan`. `save_mon_chuyen` dùng `request.get_json()` (`L717`) không `silent=True`/`or {}`, gây `AttributeError` 500 khi body rỗng hoặc `null`.

8. **Bật Flask `debug=True` ở entrypoint**
   - **Vị trí**: `Backend/script/app.py:L913`
   - **Nguyên nhân & Tác động**: Kích hoạt Werkzeug interactive debugger khi chạy `app.py`, tiềm ẩn rủi ro RCE nếu expose ra mạng.

---

### 2.2. Backend Modules & Scripts (8 lỗi)

1. **[DONE] Lỗi thụt lề làm mất câu hỏi đúng chuẩn & crash `ValueError`**
   - **Vị trí**: `Backend/script/dia_json.py:L112-L116`, `L119-L122`
   - **Nguyên nhân & Tác động**: `cau_hoi.append(...)` (`L114`) và `dap_an[cid] = ...` (`L115-L116`) bị thụt vào bên trong nhánh `if hong:`. Nếu `dap_an_mau` khớp đủ từ khóa (`hong` rỗng — trường hợp đúng), câu hỏi bị bỏ qua; nếu tất cả câu đều chuẩn, hàm văng `ValueError("Không có câu hỏi nào.")`.

2. **Route dev tự cấp mọi skin miễn phí vẫn bật (`CHO_PHEP_DEV = True`)**
   - **Vị trí**: `Backend/script/pet.py:L44`, `L295-L313`
   - **Nguyên nhân & Tác động**: `POST /api/dev/pet-cap-do` vẫn bật và chỉ kiểm tra `remote_addr in ('127.0.0.1', '::1')`. Khi triển khai sau reverse proxy trên localhost, bất kỳ ai cũng có thể tự cấp toàn bộ skin miễn phí.

3. **Thiếu xác thực token & IDOR trên API điểm danh / quay thưởng**
   - **Vị trí**: `Backend/script/qua_tang.py:L147-L152,L169-L173,L217-L221` (đối chiếu client gửi `user_id` không kèm token tại `Frontend/qua.js:L188-L190,L219-L221`, `Frontend/daily-checkin.js:L301`)
   - **Nguyên nhân & Tác động**: `POST /api/diem-danh` và `POST /api/quay-thuong` không gọi `uid_tu_token()`, tin hoàn toàn `user_id` trong JSON body, cho phép kẻ tấn công điểm danh hoặc tiêu lượt quay hộ tài khoản khác.

4. **Thiếu xác thực token & IDOR trên API nhiệm vụ**
   - **Vị trí**: `Backend/script/nhiem_vu.py:L108-L112,L266-L272,L315-L320` (đối chiếu client tại `Frontend/nhiem-vu.js:L69`)
   - **Nguyên nhân & Tác động**: `POST /api/nhiem-vu/nhan` và `POST /api/nhiem-vu/su-kien` không xác thực token, tin `user_id` từ JSON body -> ai cũng có thể tự giả sự kiện `ly_thuyet` và nhận thưởng cho bất kỳ user nào.

5. **Thiếu xác thực token & IDOR trên toàn bộ 5 API Sổ lỗi**
   - **Vị trí**: `Backend/script/so_loi.py:L239-L243,L368-L563`
   - **Nguyên nhân & Tác động**: Cả 5 route (`/api/so-loi/<user_id>/ky-nang`, `/chan-doan`, `/the`, `/goi-y`, `/tra-loi`) đều không kiểm tra token, cho phép xem và thao túng tiến độ kỹ năng/lỗi sai của người dùng khác.

6. **[DONE] Crash `KeyError` (500) trong `goi_y()` khi thiếu `cau_id`**
   - **Vị trí**: `Backend/script/so_loi.py:L508-L513`
   - **Nguyên nhân & Tác động**: `goi_y()` chỉ kiểm tra `if not cau:` rồi truy cập trực tiếp `tai["dap_an"][the["cau_id"]]` (`L513`) thay vì `.get()` như `tra_loi()` (`L540`), gây crash `KeyError` nếu `cau_id` thiếu trong file đáp án.

7. **[DONE] Crash 500 dây chuyền `/api/submit` khi ghi sự kiện nhiệm vụ lỗi**
   - **Vị trí**: `Backend/script/nhiem_vu.py:L149-L164` (được `Backend/script/app.py:L685` gọi trực tiếp)
   - **Nguyên nhân & Tác động**: `ghi_su_kien_nop_bai()` không có `try/except`, không `timeout`, không `try/finally: conn.close()`, nên bất kỳ lỗi SQLite/lock nào đều làm sập 500 toàn bộ request `/api/submit`.

8. **Crash `sqlite3.InterfaceError` (500) do không ép kiểu `int` tham số SQLite**
   - **Vị trí**: `Backend/script/khoa_bang.py:L899`, `Backend/script/so_loi.py:L406`
   - **Nguyên nhân & Tác động**: Truyền trực tiếp `data.get("ky_id")` / `data.get('the_id')` vào truy vấn SQLite không ép kiểu `int`; nếu client gửi JSON list hoặc dict sẽ văng `sqlite3.InterfaceError` (500).

---

### 2.3. Frontend Core & Auth (7 lỗi)

1. **[DONE] `notched-nav.js` kiểm tra sai key `localStorage` làm hỏng điều hướng mobile** *(gộp liên phân hệ)*
   - **Vị trí**: `Frontend/notched-nav.js:L5,L45,L235` vs `Frontend/script.js:L120-L126`, `Frontend/auth.js:L826-L832`
   - **Nguyên nhân & Tác động**: `daDangNhap` kiểm tra `localStorage.getItem("user") || localStorage.getItem("token")`, trong khi toàn hệ thống lưu `isLoggedIn`, `userId`, `username`, `kbToken`. Kết quả `daDangNhap` luôn `false`: trên mobile (`<= 640px`), tab đầu tiên của notched bar luôn hiện `"Giới thiệu"` (`index.html`) thay vì `"Cá nhân"` (`personal.html`), và sai trạng thái khớp tab khi ở `personal.html`.

2. **[DONE] Stored/DOM XSS trong danh sách gợi ý Gmail**
   - **Vị trí**: `Frontend/auth.js:L171-L195,L259`
   - **Nguyên nhân & Tác động**: `taoHtmlDanhSachGmail()` và datalist `#list-goi-y-gmail` nội suy trực tiếp `acc.name` và `acc.email` (lấy từ `username` hoặc `localStorage.getItem("vnstarl_known_accounts")`) vào `innerHTML` mà không escape HTML.

3. **[DONE] `dangXuat()` quên xóa `kbToken` khỏi `localStorage`** *(gộp liên phân hệ)*

4. **[DONE] Lệch trường `demo_otp` giữa Frontend & Backend làm ẩn vĩnh viễn modal cài đặt SMTP và nút điền nhanh OTP** *(gộp liên phân hệ)*
   - **Vị trí**: `Frontend/auth.js:L476-L499`, `Frontend/login.html:L268-L296` vs `Backend/script/app.py:L395-L404`
   - **Nguyên nhân & Tác động**: Frontend chỉ mở `#qmk-demo-box` khi `res.demo_otp` có giá trị và hiển thị thông báo hướng dẫn người dùng bấm nút `"Điền nhanh mã này"` (`auth.js:L498`), nhưng `/api/forgot-password/send-otp` ở Backend không trả `demo_otp`. Vì `#btn-mo-cai-smtp` và `#qmk-smtp-form` nằm bên trong `#qmk-demo-box` (`login.html:L268-L296`), cả nút điền nhanh lẫn toàn bộ giao diện cấu hình Gmail SMTP bị ẩn vĩnh viễn không thể truy cập.

5. **[DONE] `subjects.html` không nạp `hang.js` khiến trang chủ môn ở chế độ khách bị rỗng**
   - **Vị trí**: `Frontend/gate.js:L13-L14,L69,L81-L85,L155-L156` vs `Frontend/subjects.html:L205-L207`
   - **Nguyên nhân & Tác động**: `gate.js` đọc `window.HANG` và `window.iconHang` (từ `hang.js`), nhưng `subjects.html` không nạp `hang.js`. Khi khách chưa đăng nhập truy cập `subjects.html`, khu vực `"5 hạng thành tích cho mỗi bài tập"` (`.chu-giai`) và biểu tượng hạng trên các bài học mẫu (`.bh-icons`) rỗng hoàn toàn.

6. **`sw.js` lỗi unhandled Promise rejection khi offline/lỗi mạng**
   - **Vị trí**: `Frontend/sw.js:L65-L76`
   - **Nguyên nhân & Tác động**: `uuTienCache()` gọi `await fetch(e.request)` không bọc `try/catch` và không có fallback. Khi offline hoặc lỗi mạng với sprite/audio chưa cache, Promise reject chưa bắt khiến yêu cầu tài nguyên lỗi thẳng.

7. **[DONE] `khaosat.js` chặn cứng nộp khảo sát khi thiếu tọa độ GPS**
   - **Vị trí**: `Frontend/khaosat.js:L239-L240,L515-L529`
   - **Nguyên nhân & Tác động**: Chặn cứng việc nộp khảo sát nếu `viTri.lat === null` (trình duyệt desktop không GPS, từ chối định vị, hoặc chạy HTTP không an toàn) mà không có lựa chọn khu vực/tọa độ thủ công thay thế.

---

### 2.4. Frontend Study (6 lỗi)

1. **[DONE (một phần)] XSS qua `innerHTML` không sanitize từ JSON đề bài/lý thuyết & API** *(đã escape nhiệm vụ/thông báo lỗi/thưởng ở `lesson.js`, `subjects.js`, `daily-checkin.js`, `qua.js`; phần render HTML+KaTeX đề bài giữ nguyên để kiểm tra thêm)*
   - **Vị trí**: `Frontend/lesson.js:L170-L176,L369`, `Frontend/bai-tap.js:L458,L464-L472,L498,L508,L1084,L1091,L1101`, `Frontend/quiz-tung-cau.js:L434,L468-L471,L479-L480,L488,L497,L1143`, `Frontend/so-loi.js:L337,L346,L365,L449-L450,L500-L501`, `Frontend/subjects.js:L432,L440-L441,L450`, `Frontend/contest.js:L119`
   - **Nguyên nhân & Tác động**: Gán trực tiếp `data.ly_thuyet`, `err.message`, `bai.ten`, `tp.*`, `cau.de_bai`, `r.loi_giai`, `cau.goi_y`, `g.html`, và dữ liệu nhiệm vụ từ `/api/nhiem-vu/${userId}` vào `innerHTML` không qua escape/sanitize (dù `subjects.js:L249` có sẵn hàm `esc()`).

2. **[DONE] Mất toàn bộ giao diện (trang trắng) ở khoảng `641px–768px`**
   - **Vị trí**: `Frontend/subject-orbit.css:L580-L587` vs `L1893-L1898`
   - **Nguyên nhân & Tác động**: `@media (min-width: 641px)` ẩn `.mobile-subject-wrapper, .mobile-head-only, .orbit` (`display: none !important`), đồng thời `@media (max-width: 768px)` lại ẩn `.hub-container-3col` (`display: none !important`). Trong khoảng `641px–768px`, cả hai giao diện đều bị ẩn hoàn toàn.

3. **[DONE] Xóa sạch nháp bài làm ngay trước khi nộp & rò rỉ/trộn nháp giữa tài khoản/chế độ xem**
   - **Vị trí**: `Frontend/quiz-tung-cau.js:L74-L79,L168,L198-L207,L1071`, `Frontend/script.js:L90`
   - **Nguyên nhân & Tác động**: `luuTrangThaiDoDang` chỉ lưu khi `0 < daLamSo < tongSo`; ngay khi điền đáp án câu cuối cùng (`daLamSo >= tongSo`) trước khi bấm nộp, nhánh `else if` gọi `xoaTrangThaiDoDang()` xóa sạch `quiz_draft_*` và `baiDangLamBai_*` (reload trang làm mất hết đáp án); ngược lại xóa hết về `0` thì nháp cũ bị kẹt. Ngoài ra `quiz_draft_*` không gắn `userId` và không bị xóa khi đăng xuất (`script.js:L90`), còn khi mở 1 bài (`?q=...`), `L78` fallback đọc `KHOA_LUU_TIEN_TRINH_PHU` (nháp cả bài) và `L207` xóa luôn key này khi xong.

4. **[DONE] Lỗi nghiêm trọng chế độ Contest (khóa lượt thi sau bài đầu, hardcode thời gian & mất đáp án khi reload)**
   - **Vị trí**: `Frontend/contest.js:L118` vs `Backend/script/app.py:L785-L824`; `Frontend/bai-tap.js:L570-L590,L618-L639`
   - **Nguyên nhân & Tác động**: `contest.js` dẫn link từng bài (`?subject=contest&chapter=${c.id}&article=${c.id}&q=${bai.id}`), nhưng `/api/contests/<cid>/submit` dùng `INSERT OR IGNORE` theo `(cid, user_id)` và chấm theo `Dap_an/contest/{cid}.json` -> nộp bài đầu tiên trong contest có >1 `bai_tap` sẽ khóa vĩnh viễn các bài sau (HTTP 409). Đồng thời `bai-tap.js` hardcode thời gian (`1->30p`, `2->45p`, `3->60p`, khác `->45p`) thay vì đọc `bat_dau`/`ket_thuc` từ API, lưu mốc thời gian trong `sessionStorage` (`kb_start_*`, mở tab mới reset đồng hồ) và không lưu draft nên reload làm mất hết đáp án.

5. **[DONE] Dữ liệu `tong-hop.json` hỏng / thiếu hàng loạt file đề gây 404 & link `bai-undefined`**
   - **Vị trí**: `Frontend/file_de/ngu_van/tong-hop.json:L15`, `Frontend/bai-tap.js:L256,L263,L267`, `Frontend/file_de/chuyen_toan/tong-hop.json`, `Frontend/file_de/chuyen_dia/tong-hop.json`
   - **Nguyên nhân & Tác động**: `ngu_van/tong-hop.json` chứa object rỗng `{}` trong `chuong-2` tạo tên `"undefined"` và link `article=bai-undefined`; `chuyen_toan` khai báo 32 bài nhưng thiếu 29/32 file JSON; `chuyen_dia` khai báo 14 bài nhưng thiếu 13/14 file JSON trên đĩa.

6. **[DONE] Crash `TypeError` trong Sổ lỗi (`so-loi.js`)**
   - **Vị trí**: `Frontend/so-loi.js:L45,L325,L485-L486,L496`
   - **Nguyên nhân & Tác động**: `ngayVN(s)` gọi `s.split("-")` không kiểm tra null/rỗng (dễ crash nếu `ngay_on_ke` thiếu hoặc `null`); truy cập `MUC[kn.muc]` và `MUC[tt.muc_sau].ten` thiếu fallback `|| MUC[0]` (khác với `L215`).

---

### 2.5. Frontend Gamification (5 lỗi)

1. **[DONE] Lỗi `ReferenceError` làm gãy toàn bộ khởi tạo trang Cá nhân (`personal.js`)**
   - **Vị trí**: `Frontend/personal.js:L432-L434`
   - **Nguyên nhân & Tác động**: `DOMContentLoaded` gọi hàm `capNhatThoiGianTuHoc()` chưa từng được định nghĩa ở bất kỳ file nào trong `Frontend/`, ném `ReferenceError` và chặn luôn phần khởi tạo phía sau (`veKeHoach()` ở `L432` và `chonTab(...)` ở `L433-L434`), khiến lịch tự học và điều hướng tab ban đầu hỏng hoàn toàn.

2. **[DONE] Ẩn toàn bộ thông báo trạng thái bảng xếp hạng do CSS đè `nth-child(1..3)`**
   - **Vị trí**: `Frontend/ranking.css:L815-L819` vs `Frontend/ranking.js:L24,L85-L88`
   - **Nguyên nhân & Tác động**: `ranking.css` ẩn 3 dòng đầu bằng `.rk-table tbody tr:nth-child(1..3) { display: none !important; }` để đưa lên podium, nhưng `ranking.js` dùng `baoDong(...)` chèn 1 dòng `<tr><td colspan="4" class="rk-trong">...</td></tr>` (chính là `tr:nth-child(1)`) cho các trạng thái `"Đang tải..."`, `"Chưa có ai..."`, `"Không kết nối được server..."`, khiến mọi thông báo tải/rỗng/lỗi bị ẩn hoàn toàn.

3. **[DONE] Hiển thị nhầm dữ liệu mẫu cứng (`"vô mae"`, `#2`) trong card "Thứ hạng của bạn"**
   - **Vị trí**: `Frontend/ranking.html:L113-L121` vs `Frontend/ranking.js:L29-L39,L85-L88,L171-L199`
   - **Nguyên nhân & Tác động**: HTML hardcode sẵn dữ liệu mẫu (`#2`, `vô mae`, `638 điểm`, `Cách Top 1: 420 điểm`, `width: 60%`). Khi chưa đăng nhập (`!userId`), API lỗi, `kq.data` rỗng hoặc `!myData`, `ranking.js` không reset các node `#my-standing-rank`, `#my-pts-val`, `#my-gap-val`, `#my-gap-fill`, làm hiển thị nhầm thông số giả.

4. **DOM XSS qua `innerHTML` và thuộc tính `title` trong Quà tặng, Điểm danh & Khoa bảng**
   - **Vị trí**: `Frontend/qua.js:L147`, `Frontend/daily-checkin.js:L260`, `Frontend/khoa-bang.js:L112,L207`
   - **Nguyên nhân & Tác động**: Nội suy trực tiếp dữ liệu từ API (`o.ten`, `item.ten`, `reward.tag`, `ct.bat_dau`) vào `innerHTML` và thuộc tính `title` không qua `esc()`.

5. **[DONE] Phá hủy DOM `.profile-card` và mất toàn bộ listener khi API hồ sơ lỗi**
   - **Vị trí**: `Frontend/profile.js:L53-L54` vs `L350-L447`
   - **Nguyên nhân & Tác động**: Khi `GET /api/users/${userId}` lỗi, `L53` ghi đè `document.querySelector(".profile-card").textContent = ...` phá hủy toàn bộ DOM con và `return` sớm tại `L54`, khiến các listener cài đặt thông báo (`L350-L428`) và tab mobile (`L433-L447`) phía sau không bao giờ được gắn.

---

## 3. Trung bình (Warning)

### 3.1. Backend Core & Database (12 lỗi)

1. **CORS wildcard `*` mở toàn bộ origin**
   - **Vị trí**: `Backend/script/app.py:L30`
   - **Nguyên nhân & Tác động**: `CORS(app)` cho phép mọi domain gọi vào các API ghi dữ liệu và xác thực.

2. **HTML Injection trong email OTP & thiếu validate email**
   - **Vị trí**: `Backend/script/app.py:L307-L318`, `L358`
   - **Nguyên nhân & Tác động**: `username` được chèn trực tiếp vào HTML email (`L318`) không qua `html.escape`; `to_email` không kiểm tra regex/ký tự xuống dòng.

3. **[DONE] Crash `TypeError` khi `users.streak` hoặc `users.score` là `NULL`**
   - **Vị trí**: `Backend/Database/init_db.py:L20-L21`, `Backend/script/db_ops.py:L100,L131,L145-L147`, `Backend/script/app.py:L672,L677`
   - **Nguyên nhân & Tác động**: Schema thiếu `NOT NULL` cho `streak`/`score`; `update_streak` (`current_streak += 1`) và `app.py:L677` (`streak // 3`) văng `TypeError` nếu giá trị là `NULL`. `update_user_score` (`score = score + ?`) giữ nguyên `NULL` và không kiểm tra `user_id` tồn tại trước khi cộng `diem_thang` (`L101`).

4. **Tách transaction & mở quá nhiều connection SQLite trong `/api/submit`**
   - **Vị trí**: `Backend/script/app.py:L651-L686`
   - **Nguyên nhân & Tác động**: Mở/đóng tới 7 kết nối SQLite rời rạc (không `timeout`, không WAL) gây nguy cơ `database is locked` và sai lệch trạng thái khi lỗi giữa chừng. Khi `diem_dat == 0` (`L651`), `da_lam` và `update_streak` bị bỏ qua nhưng `ghi_ket_qua_nop_bai`, `ghi_su_kien_nop_bai`, `ghi_hoat_dong` (`L682-L686`) vẫn chạy.

5. **Rò rỉ connection SQLite khi có exception**
   - **Vị trí**: `Backend/script/db_ops.py:L25-L35`, `L65-L248` (trừ `add_user` `L49-L62`), `Backend/Database/init_db.py:L9-L120`
   - **Nguyên nhân & Tác động**: Không bọc `conn.close()` trong `try...finally` hoặc `with`.

6. **Ghi DB thật ngay khi `import` module & test chạm DB thật**
   - **Vị trí**: `Backend/script/db_ops.py:L46`, `Backend/script/test_khoa_bang.py:L3,L13-L16`, `Backend/script/khoa_bang.py:L188`
   - **Nguyên nhân & Tác động**: `db_ops` gọi `dam_bao_bang_thang()` ngay lúc import; `test_khoa_bang.py` chạy `import khoa_bang` (`L13`, kích hoạt `dam_bao_bang()` ở `khoa_bang.py:L188`) trước khi gán `kb.DB_PATH = ...test.db` (`L16`), làm ghi vào `edumate.db` thật trái với docstring (`L3`). Ngoài ra `TMP = tempfile.mkdtemp()` (`L15`) không được dọn (`shutil.rmtree` thiếu).

7. **Khảo sát đầu tiên bị khóa ngay lúc login**
   - **Vị trí**: `Backend/script/app.py:L169-L172`
   - **Nguyên nhân & Tác động**: Đặt `da_khao_sat = 1` ngay khi `POST /api/login`; nếu user đóng trang trước khi hoàn tất khảo sát thì mất vĩnh viễn cơ hội làm lại.

8. **Lưu cấu hình SMTP trước khi xác thực thành công & lỗi parse `SMTP_PORT`**
   - **Vị trí**: `Backend/script/app.py:L197`, `L203-L210`, `L257`, `L271-L283`
   - **Nguyên nhân & Tác động**: `luu_cau_hinh_smtp` ghi đè `smtp_config.json` trước khi thử `gui_email_otp`; nếu mật khẩu sai thì file config vẫn bị ghi hỏng. `doc_cau_hinh_smtp` (`L197`) ép `int(os.environ.get('SMTP_PORT', 587))` ngoài `try/except`, và `L203-L210` cho file JSON ghi đè cả biến môi trường.

9. **Phân mảnh schema DB & thiếu ràng buộc/index**
   - **Vị trí**: `Backend/Database/init_db.py:L13-L110`
   - **Nguyên nhân & Tác động**: Thiếu `FOREIGN KEY`, thiếu migration cho các cột quà tặng (`dd_tong`..`x15_den`), `da_lam.best_pct`, và các bảng `diem_thang`, `kb_*`, `so_loi*`, `nv_tien_do` (bị tạo rải rác ở các module khác).

10. **[DONE] Không nhất quán phân biệt hoa/thường email**
    - **Vị trí**: `Backend/script/app.py:L161` (`WHERE email = ?`) vs `L365,L418,L553` (`WHERE LOWER(email) = ?`)
    - **Nguyên nhân & Tác động**: Đăng nhập phân biệt hoa/thường trong khi quên mật khẩu/OTP lại chuẩn hóa chữ thường.

11. **`KeyError` & fallback ngầm ở `db_ops.py`**
    - **Vị trí**: `Backend/script/db_ops.py:L39`, `L163`, `L166-L176`, `L182`, `L185-L210`
    - **Nguyên nhân & Tác động**: `BANG_XEP_HANG[bang][1]` văng `KeyError` nếu truyền sai `bang`; `ky` lạ âm thầm rơi về `"tong"`; `cong_diem_thang` (`L39`) bỏ qua `diem <= 0` làm lệch `users.score` nếu có điểm âm.

12. **Cấu hình `.vscode/tasks.json` lỗi đường dẫn & race condition**
    - **Vị trí**: `.vscode/tasks.json:L32`, `L53`, `L65-L75`
    - **Nguyên nhân & Tác động**: `cwd` dùng `${workspaceFolder}/frontend` (chữ thường, sai với `Frontend` trên hệ thống phân biệt hoa/thường); task `Mở trình duyệt` chạy song song (`dependsOn` thiếu `dependsOrder: "sequence"`) và dùng lệnh PowerShell-only `Start-Sleep 3; Start-Process`; `runOn: "folderOpen"` (`L71-L73`) tự động bật Flask `debug=True`.

---

### 3.2. Backend Modules & Scripts (19 lỗi)

1. **Thiếu guard khi JSON chấm tự luận/ngữ nghĩa có giá trị `null`**
   - **Vị trí**: `Backend/script/cham_tu_luan.py:L38`, `Backend/script/cham_ngu_nghia.py:L122,L140`
   - **Nguyên nhân & Tác động**: Nếu JSON chứa `"nhom_tu_khoa": null`, `"loai_tru": null` hoặc `"y": null`, `.get(..., [])` trả về `None` gây `TypeError`.

2. **Đếm trùng từ khóa khi không khử trùng sau `chuan_hoa()`**
   - **Vị trí**: `Backend/script/cham_tu_luan.py:L39-L41`
   - **Nguyên nhân & Tác động**: Khi `len(ds_k) == 1` và `can_dat > 1`, code đếm trực tiếp theo list `ds_k[0]` không khử trùng sau chuẩn hóa; 2 biến thể giống nhau (vd `"76,5 triệu"` và `"76.5 triệu"`) bị tính thành 2 từ khóa trúng dù bài chỉ viết 1 lần.

3. **`cham_hon_hop` có thể loại oan câu đúng do `_cat_doan` ghép 2 câu liên tiếp**
   - **Vị trí**: `Backend/script/cham_ngu_nghia.py:L86-L90,L136-L143`
   - **Nguyên nhân & Tác động**: `_cat_doan` tạo đoạn ghép 2 câu liên tiếp (`cap`), sau đó `cham_hon_hop` kiểm tra `_co_tu_loai_tru` trên `doan[j]` (argmax). Nếu câu kề cạnh chứa từ trong `loai_tru`, cặp ghép có thể đạt max similarity và bị loại oan.

4. **`_khoa_bi_mat()` ghi `kb_secret.key` không lock/atomic**
   - **Vị trí**: `Backend/script/khoa_bang.py:L428-L441`
   - **Nguyên nhân & Tác động**: Nhiều worker khởi động đồng thời khi chưa có file khóa có thể sinh 2 khóa khác nhau ghi đè nhau, làm hỏng token.

5. **Lỗi thứ tự kiểm tra `cid` và `NULL` trong `_ket_qua_cuoc_thi()`**
   - **Vị trí**: `Backend/script/khoa_bang.py:L504-L513`
   - **Nguyên nhân & Tác động**: Gọi `_tong_diem_cuoc_thi(cid)` trước `if not cid` (`L504-L505`); phép tính `100.0 * r[1] / tong` (`L513`) sẽ lỗi `TypeError` nếu `contest_ket_qua.diem` là `NULL`.

6. **`chot_ky.py cau-hinh` ghi đè JSON cấu hình không validate schema**
   - **Vị trí**: `Backend/script/khoa_bang.py:L314,L345,L752-L770`, `Backend/script/chot_ky.py:L76-L80`
   - **Nguyên nhân & Tác động**: Tổng `trong_so == 0` gây `ZeroDivisionError`, hoặc thiếu/sai mã danh hiệu gây `KeyError` ở `quy_che` (`L769`).

7. **Đếm ngược thời gian kỳ thi lệch với `han_chot` của kỳ `hoi`/`dinh`**
   - **Vị trí**: `Backend/script/khoa_bang.py:L702-L708` vs `L473-L476`
   - **Nguyên nhân & Tác động**: `_ky_info` tính `con_lai_giay` theo `kt`, trong khi kỳ `hoi`/`dinh` chỉ chốt sau `han_chot(cap, kt)` (có thể trễ tới 6 ngày sau `kt`), làm UI đếm về `0` khi kỳ vẫn đang mở/tạm tính.

8. **Thiếu `UNIQUE(ky_id, user_id)` trên bảng `kb_phuc_khao`**
   - **Vị trí**: `Backend/script/khoa_bang.py:L142-L146,L898-L915`
   - **Nguyên nhân & Tác động**: Kiểm tra `SELECT` trước `INSERT` ở `api_phuc_khao` không chống được race condition double-submit tạo đơn trùng.

9. **`phuc-khao xu-ly` không kiểm tra thiếu `a.id`**
   - **Vị trí**: `Backend/script/chot_ky.py:L63-L65` (khác với `vi-pham` ở `L55`)
   - **Nguyên nhân & Tác động**: Truyền `id=None` vào `UPDATE ... WHERE id = ?` và vẫn báo đã xử lý.

10. **Race condition trong `_ds_hom_nay()` vượt quá 3 nhiệm vụ/ngày**
    - **Vị trí**: `Backend/script/nhiem_vu.py:L204-L213`
    - **Nguyên nhân & Tác động**: Kiểm tra `len(ids) < 3` rồi `INSERT OR IGNORE`; nếu 2 request song song chạy đúng lúc `_du_dieu_kien()` thay đổi giữa chừng, user có thể bị chèn > 3 nhiệm vụ trong ngày.

11. **Cộng điểm thưởng nhiệm vụ/sổ lỗi vào `users.score` nhưng bỏ qua `cong_diem_thang()`**
    - **Vị trí**: `Backend/script/nhiem_vu.py:L295`, `Backend/script/so_loi.py:L346` (lệch chuẩn với `qua_tang.py:L145` và `db_ops.py:L101`)
    - **Nguyên nhân & Tác động**: Làm bảng xếp hạng tháng (`diem_thang`) thiếu điểm thưởng từ nhiệm vụ và sổ lỗi.

12. **[DONE] Cộng dồn `the_bao_ho + 1` và `dd_tong + 1` thiếu `COALESCE(..., 0)`**
    - **Vị trí**: `Backend/script/qua_tang.py:L139,L179`
    - **Nguyên nhân & Tác động**: Nếu cột đang `NULL`, phép `+ 1` trong SQLite trả về `NULL`, làm `_cong_bao_ho` (`L139`) và đếm ngày không hoạt động.

13. **Kết nối SQLite trên các module thiếu `timeout` và `try/finally: conn.close()`**
    - **Vị trí**: `Backend/script/qua_tang.py:L74-L77,L89-L94,L159-L256`, `Backend/script/nhiem_vu.py:L97-L100,L257-L328`, `Backend/script/so_loi.py:L231-L234,L293-L561`, `Backend/script/tien_do.py:L26-L33,L77-L81`, `Backend/script/khoa_bang.py:L97,L248,L792-L882`
    - **Nguyên nhân & Tác động**: Nguy cơ rò rỉ connection và lỗi `database is locked` khi có nhiều request đồng thời hoặc exception.

14. **`RE_TOAN` cho phép xuống dòng trong `$...$`**
    - **Vị trí**: `Backend/script/md_to_json.py:L98,L156-L158`
    - **Nguyên nhân & Tác động**: Một dấu `$` quên đóng (vd `$5`) sẽ nuốt hết tới dấu `$` ở dòng sau và làm `_che()` xóa mất marker `A. B. C. D.`.

15. **`xu_ly_chu()` đổi `**...**` thành `<b>...</b>` trước khi bảo vệ công thức `$...$`**
    - **Vị trí**: `Backend/script/md_to_json.py:L135-L140`
    - **Nguyên nhân & Tác động**: Có thể làm hỏng cú pháp LaTeX chứa dấu `*` bên trong `$...$`.

16. **`tach_lua_chon` và `tach_y` khớp `B.`, `b)` ở giữa câu**
    - **Vị trí**: `Backend/script/md_to_json.py:L218-L223,L246-L251`
    - **Nguyên nhân & Tác động**: Nếu nội dung phương án A chứa `"B."` hoặc `"b)"` sẽ bị cắt nhầm sang phương án/ý tiếp theo.

17. **Nhiều trường hợp biên gây `IndexError` trong `docx_to_md.py`**
    - **Vị trí**: `Backend/script/docx_to_md.py:L509-L518,L546-L557,L585`
    - **Nguyên nhân & Tác động**: Bảng rỗng gây `IndexError` ở `rows[0]` (`L510`); bảng NỐI không có hàng dữ liệu khiến `all(giua)` (`L518`) trả `True`; bảng NỐI > 10 hàng lỗi `CHU_CAI[i]` (`L515`); câu điền chỗ trống > 6 phương án lỗi `"ABCDEF"[k]` (`L585`).

18. **Crash `ValueError` ở `cat_anh_pet.py` với ảnh quá nhỏ**
    - **Vị trí**: `Backend/script/cat_anh_pet.py:L61-L66,L74-L79`
    - **Nguyên nhân & Tác động**: Khi `vung_lo >= vung_hi`, `doan` rỗng khiến `doan.min()` (`L65`) văng `ValueError`.

19. **Bộ từ khóa mẫu trong `de.json` không khớp chính `dap_an_mau` của chính nó**
    - **Vị trí**: `Backend/script/de.json:L9,L15-L31,L126-L152,L160-L185,L416-L522`
    - **Nguyên nhân & Tác động**: Nhiều ý (`1.1, 1.5, 2.1, 4.2, 4.4, 4.5`) có từ khóa kiểm tra không khớp chính `dap_an_mau` đi kèm.

---

### 3.3. Frontend Core & Auth (11 lỗi)

1. **Kiểm tra đăng nhập không nhất quán ở `index.html` & thiếu kiểm tra ở `khaosat.html`**
   - **Vị trí**: `Frontend/index.html:L8-L10`, `Frontend/khaosat.html`, `Frontend/khaosat.js:L135-L138`, `Frontend/ky-thi.js:L24`
   - **Nguyên nhân & Tác động**: `index.html` chỉ kiểm tra `isLoggedIn === "true"` mà không kiểm tra `userId` (gây lệch trạng thái khi chuyển sang `personal.html`); `khaosat.html` không có kiểm tra đăng nhập dù `khaosat.js` gọi API cập nhật môn chuyên theo `userId` và `ky-thi.js` lưu điểm theo `userId`.

2. **Lỗi logic lưu & chuyển hướng ở `khaosat.js` và dùng chung `localStorage` giữa các tài khoản**
   - **Vị trí**: `Frontend/khaosat.js:L137-L147,L150-L169,L507-L513`
   - **Nguyên nhân & Tác động**: `chot()` đặt `out.dataset.dangLuu = "1"` rồi chuyển hướng về `index.html` (gây double-redirect sang `personal.html`) kể cả khi `luuMonChuyen()` trả về `"loi"`, khiến người dùng không thể thử lại; `nguyenVong` và `truongChuyen` lưu không gắn `userId` nên bị ghi đè giữa các tài khoản; `luuMonChuyen()` và `taiDuLieu()` không kiểm tra `res.ok` trước khi `.json()`.

3. **[DONE] Thiếu ảnh trường `id: 34` & trùng lặp/null dữ liệu trong `diem_chuan_2026.json`**
   - **Vị trí**: `Frontend/diem_chuan_2026.json:L212-L218,L268-L274,L317,L341,L372-L378,L477,L493`, `Frontend/khaosat.js:L326`
   - **Nguyên nhân & Tác động**: Trường `id: 34` ("THPT thành phố Hồng Ngự") thiếu file ảnh `Frontend/img/school/34.webp` (trên đĩa có `1..33`, `35..69` và `aaa.webp`), làm `khaosat.js:L326` hiện chữ `"null"` thô khi ảnh lỗi. `id: 27` và `id: 47` có cả 4 trường `vi_do`, `kinh_do`, `diem_2026`, `diem_2025` là `null` và trùng tên với `id: 38`, `id: 44`; cặp `id: 40`/`43` và `id: 60`/`62` trùng hệt tọa độ.

4. **Lỗi xử lý HTTP 4xx, double-submit OTP & popup che ô nhập liệu ở `auth.js`/`auth.css`**
   - **Vị trí**: `Frontend/auth.js:L78-L96,L285-L293,L683-L688`, `Frontend/auth.css:L722`
   - **Nguyên nhân & Tác động**: `goiApi()` chỉ chặn `res.status >= 500`, không kiểm tra `res.ok` cho mã `4xx` (dễ văng `SyntaxError` nếu nhận trang HTML/text); ô `#qmk-otp` tự gọi `xacNhanOtp()` khi đủ 6 ký tự không có cờ chống gọi trùng nếu bấm Enter/nút cùng lúc; focus/click `#login-email`/`#reg-email` bật ngay `#login-google-popup`/`#reg-google-popup` (`position: absolute`) che khuất ô mật khẩu bên dưới.

5. **Lỗi kiểm tra `res.ok`, đánh dấu đã gửi sai thời điểm & lock đa tab không nguyên tử ở `thong-bao.js`**
   - **Vị trí**: `Frontend/thong-bao.js:L108-L137,L156-L159,L172-L180,L190-L194`
   - **Nguyên nhân & Tác động**: `nhacChuoi()` và `nhacThi()` gọi `.json()` không check `res.ok`; `danhDau(key)` gọi trước `gui(...)` trong `nhacThi` và `nhacLich` (không `await` trong `forEach`), nên gửi thất bại vẫn đánh dấu đã gửi cả ngày; khóa `saola_tb_lock_` đọc-kiểm-tra-ghi không nguyên tử khiến 2 tab vẫn có thể chạy trùng.

6. **`catO(b)` ở `tkb-ocr.js` không chặn biên ảnh làm sai lệch `otsu()`**
   - **Vị trí**: `Frontend/tkb-ocr.js:L199-L205,L271,L330`
   - **Nguyên nhân & Tác động**: Khi `rong(b, 2)` mở rộng hộp 2px ở mép ảnh hoặc `docTieuDe` (`L330`) truyền `HL[0].c - pitch` (< 0), `gray[(y0 + y) * W + x0 + x]` truy cập ngoài mảng (`undefined`), làm `hist[undefined]` cộng dồn sai vào `hist[0]`.

7. **[DONE] Rủi ro open redirect khi click thông báo ở `sw.js`**
   - **Vị trí**: `Frontend/sw.js:L109-L123`
   - **Nguyên nhân & Tác động**: `notificationclick` tạo `new URL(data.url || "index.html", self.location.href)` mà không kiểm tra `url.origin === self.location.origin`.

8. **Thiếu guard null & kiểm tra `res.ok` ở `gate.js`**
   - **Vị trí**: `Frontend/gate.js:L463-L466,L588-L594`
   - **Nguyên nhân & Tác động**: `dinhDangGio(s)` gọi `s.split(" ")` không kiểm tra null/định dạng; `taiLichThi()` không kiểm tra `res.ok`.

9. **Thanh `.u041` có `z-index: 99999 !important` đè lên modal & thiếu khoảng đệm đáy**
   - **Vị trí**: `Frontend/notched-nav.css:L53` vs `Frontend/style3.css:L81`, `Frontend/auth.css:L452`, `Frontend/style.css:L712`
   - **Nguyên nhân & Tác động**: `.u041` (`z-index: 99999 !important`) đè lên các modal `.modal-nen` (`z-index: 1000`) trên mobile; `style.css:L712` chỉ chừa `padding-bottom: 74px` trong khi `.u041` cao `76px`.

10. **Bảng điểm môn chuyên tràn ngang trên điện thoại (`style2.css`)**
    - **Vị trí**: `Frontend/style2.css:L566-L616`
    - **Nguyên nhân & Tác động**: `.ky-hang` dùng `minmax(130px, 1.6fr) repeat(var(--cot), minmax(60px, 1fr))`; khi có môn chuyên (`--cot: 3`), tổng min-width vượt ~422px gây tràn ngang trên màn hình 360px–390px.

11. **Thanh tiến độ bị đồng hồ Khoa bảng che trên mobile (`form.css`)**
    - **Vị trí**: `Frontend/form.css:L753-L757`
    - **Nguyên nhân & Tác động**: `.kb-dong-ho-sticky + .tien-do-lam` hardcode `top: 52px`; trên mobile (`<= 640px`), đồng hồ Khoa bảng xuống 2 dòng cao hơn 52px nên che một phần thanh tiến độ bên dưới.

---

### 3.4. Frontend Study (5 lỗi)

1. **Fetch JSON/API thiếu kiểm tra `res.ok` trên diện rộng**
   - **Vị trí**: `Frontend/subjects.js:L119-L120,L412-L413,L467-L472`, `Frontend/lesson.js:L135-L136,L150`, `Frontend/bai-tap.js:L138-L139,L353-L354,L1002-L1007,L1039-L1048`, `Frontend/quiz-tung-cau.js:L987-L995`, `Frontend/contest.js:L136-L137,L237-L238`, `Frontend/so-loi.js:L25-L30,L134-L135`, `Frontend/so-loi-chung.js:L28`
   - **Nguyên nhân & Tác động**: Gọi `.json()` trực tiếp không kiểm tra `res.ok` (`so-loi-chung.js:L28` bỏ qua cả `res.ok` lẫn `kq.success`), dễ văng `SyntaxError` hoặc xử lý sai khi server trả lỗi HTTP.

2. **Nộp nhiều bài tuần tự thiếu tính toàn vẹn dữ liệu**
   - **Vị trí**: `Frontend/bai-tap.js:L1038-L1105`, `Frontend/quiz-tung-cau.js:L984-L1012`
   - **Nguyên nhân & Tác động**: Gửi `POST /api/submit` từng bài nối tiếp; nếu lỗi từ bài thứ 2 trở đi, bài trước đã được ghi vào DB nhưng UI báo lỗi và giữ lại nháp.

3. **Thiếu guard cho hàm global từ script khác**
   - **Vị trí**: `Frontend/lesson.js:L274-L275` (`hangCua`, `hangTren`), `Frontend/bai-tap.js:L269` (`iconHang`), `Frontend/contest.js:L176` (`datAvatar`)
   - **Nguyên nhân & Tác động**: Gọi trực tiếp hàm từ `hang.js`/`script.js` không kiểm tra tồn tại -> văng `ReferenceError` nếu script phụ chưa tải hoặc lỗi.

4. **Lỗi null, sort `NaN`, URL encoding & kẹt thông báo đang tải**
   - **Vị trí**: `Frontend/lesson.js:L48,L157,L200,L369`, `Frontend/contest.js:L38-L49`, `Frontend/bai-tap.js:L438`
   - **Nguyên nhân & Tác động**: `#quay-lai` tạo `?subject=null&chuong=null` nếu thiếu query param; `doKho(undefined)` trả `"Khó"`; `sort((a, b) => a.do_kho - b.do_kho)` cho `NaN` khi thiếu `do_kho`; nhánh `catch` ở `lesson.js:L369` để nguyên `#ly-thuyet-inline` kẹt thông báo đang tải; `contest.js:L38-L49` gọi `.split(" ")`/`.split("-")` trên `bat_dau`/`ket_thuc` không kiểm tra null; `duongDanHinh` không dùng `encodeURIComponent`.

5. **[DONE] Lỗi tràn KaTeX, chiều cao panel lý thuyết, responsive & z-index CSS**
   - **Vị trí**: `Frontend/quiz-tung-cau.css:L28-L48,L664,L1589-L1596`, `Frontend/style3.css:L127`, `Frontend/tien-do.css:L1544,L1562-L1566`, `Frontend/subject-orbit.css:L1120,L1882-L1891`, `Frontend/pet.css:L17`, `Frontend/notched-nav.css:L53`
   - **Nguyên nhân & Tác động**: `.qz-cau { overflow: hidden }` cắt công thức KaTeX tràn ngang; `.modal-hop .noi-dung-ly-thuyet` thiếu `overflow-x: auto`; `.ls-theory-panel` (`position: absolute; inset: 0`) bị lùn theo `.ls-col-left`; khoảng `769px–1024px` co `.hub-container-3col` nhưng `.subject-grid-v2` vẫn giữ `repeat(3, 1fr) !important` gây chật thẻ; `#sao-la` (`pet.css:L17`, `z-index: 900`) và `.u041` (`notched-nav.css:L53`, `z-index: 99999 !important`) đè lên `#qz-app` (`z-index: 60`) và `.qz-modal` (`z-index: 8`).

---

### 3.5. Frontend Gamification (14 lỗi)

1. **Thiếu asset `vui.webp` cho skin `mac_dinh` gây lỗi 404 lặp lại mỗi lần click**
   - **Vị trí**: `Frontend/img/pet/manifest.json:L5`, `Frontend/img/pet/than/mac_dinh/`, `Frontend/pet.js:L120`
   - **Nguyên nhân & Tác động**: `manifest.json` khai báo `"hanh_dong": ["idle", "vui"]`, nhưng trên đĩa chỉ có `idle.webp` và `_xem_truoc.webp`. Mỗi lần bấm Sao La đều gửi request `vui.webp` bị 404 (cache không lưu trạng thái thiếu) rồi fallback về `idle`.

2. **Thiếu toàn bộ file âm thanh MP3 thoại pet**
   - **Vị trí**: `Frontend/pet.js:L372`, `Frontend/audio/pet/manifest.json`
   - **Nguyên nhân & Tác động**: Code tải `audio/pet/${gioiTinh}/${ma}.mp3`, nhưng `Frontend/audio/pet/` không có thư mục `nam/`, `nu/` hay bất kỳ file `.mp3` nào (chỉ có `manifest.json`), làm toàn bộ thoại MP3 404.

3. **Lỗi menu dropdown Khoa bảng trên mobile lặp tab `Hồ sơ` & thiếu `Vinh danh`**
   - **Vị trí**: `Frontend/khoa-bang.html:L74-L93`
   - **Nguyên nhân & Tác động**: `#kb-tab-dropdown-menu` (`L80-L86`) thiếu mục `Vinh danh` (`#vinh-danh`), còn tab `Hồ sơ` (`L93`) không gắn `.kb-tab-desktop-only` nên bị hiện lặp 2 lần trên mobile.

4. **Lỗi cắt ô điểm danh trên mobile & xung đột tên class CSS giữa `daily-checkin.css` và `qua.css`**
   - **Vị trí**: `Frontend/daily-checkin.css:L42,L234-L339,L540-L562`, `Frontend/qua.css:L172-L258`
   - **Nguyên nhân & Tác động**: Trên `<= 640px`, `.daily-day-cell` giữ `width: 68px !important` (7 ô = `476px` > viewport) kết hợp `overflow-x: hidden` (`L42`) làm Ngày 1 và Ngày 7 bị cắt mất. Đồng thời 2 file CSS dùng trùng hàng loạt tên class (`.station-node`, `.journey-line-bg`, `.journey-line-fill`, `.station-circle`, `.btn-checkin-3d`...) với rule `!important` khác nhau, gây vỡ giao diện khi mở modal check-in trên `qua.html`.

5. **Tràn chữ phần thưởng & lệch đường nối trên mobile ở `qua.css`**
   - **Vị trí**: `Frontend/qua.css:L251,L435-L438`
   - **Nguyên nhân & Tác động**: Ở `<= 480px`, `.station-node` thu còn `44px` nhưng `.station-reward-val` vẫn giữ `white-space: nowrap` làm chữ tràn đè sang ô kế bên; `.journey-line-bg` vẫn giữ `top: 32px; left: 24px; right: 24px` lệch với vòng tròn `38px`.

6. **Pet `#sao-la` che thanh thứ hạng `#rk-my-sticky` & thiếu khoảng đệm cho `.u041`**
   - **Vị trí**: `Frontend/ranking.css:L968-L983`, `Frontend/notched-nav.css:L35-L37,L50,L53`, `Frontend/pet.css:L17`, `Frontend/personal.css:L646`, `Frontend/khoa-bang.css:L47`
   - **Nguyên nhân & Tác động**: Trên `<= 640px`, `#sao-la` (`bottom: 82px !important; z-index: 900`) đè lên phần bên phải của `#rk-my-sticky` (`bottom: 78px; z-index: 100`). `personal.css:L646` và `khoa-bang.css:L47` chưa chừa `padding-bottom` cho `.u041` (`height: 76px; z-index: 99999`), dễ che nội dung cuối trang.

7. **[DONE] `JSON.parse` không `try/catch` trong `veVinhDanh()`** *(cũng đã bọc kiểm tra định dạng cho `ngayVN()`)*
   - **Vị trí**: `Frontend/khoa-bang.js:L295`
   - **Nguyên nhân & Tác động**: `JSON.parse(localStorage.getItem("kb_da_xem") || "[]")` sẽ crash hàm `veVinhDanh()` nếu giá trị trong `localStorage` bị hỏng.

8. **Thiếu kiểm tra `null/undefined` ở `ranking.js` & `khoa-bang.js`**
   - **Vị trí**: `Frontend/ranking.js:L67-L68,L219`, `Frontend/khoa-bang.js:L45,L410`
   - **Nguyên nhân & Tác động**: Chưa guard `cauHinh.bang.find(...)`, `cauHinh.thang.split("-")`, `cauHinh.bang[0]` và `ngayVN(s)` (`s.split("-")`), dễ văng `TypeError` khi dữ liệu cấu hình hoặc ngày thi thiếu/rỗng.

9. **Thiếu kiểm tra tồn tại phần tử & module phụ thuộc trong `personal.js`**
   - **Vị trí**: `Frontend/personal.js:L285,L357`
   - **Nguyên nhân & Tác động**: Truy cập ngay `x.d` sau `kh.ngay.find(...)` mà không kiểm tra `if (!x)`; gọi `KT.capNhatKy()` không kiểm tra `if (KT)` nếu `ky-thi.js` chưa tải.

10. **[DONE] Chia cho 0 (`Infinity`) khi vẽ vòng quay may mắn rỗng** *(cũng đã escape tên phần thưởng trong `qua.js`)*
    - **Vị trí**: `Frontend/qua.js:L46,L168-L169`
    - **Nguyên nhân & Tác động**: `veVongQuay()` chia `360 / dsMui.length` khi không kiểm tra `dsMui.length > 0`.

11. **Không đồng bộ DOM header/profile/`localStorage` sau khi nhận thưởng**
    - **Vị trí**: `Frontend/qua.js:L106`, `Frontend/nhiem-vu.js:L73`
    - **Nguyên nhân & Tác động**: Điểm danh trên `qua.html` chỉ ghi `localStorage.streak` mà không cập nhật DOM `.streak-box span`; nhận thưởng nhiệm vụ chỉ vẽ lại thẻ mà không đồng bộ điểm mới lên header/profile/`localStorage`.

12. **Race condition trên `visibilitychange` & tính % nhiệm vụ không chặn biên**
    - **Vị trí**: `Frontend/nhiem-vu.js:L24,L88-L89`
    - **Nguyên nhân & Tác động**: `tai()` gọi mỗi lần `visibilitychange` không debounce/hủy request cũ; `Math.round((n.tien_do / n.muc_tieu) * 100)` không giới hạn `Math.min(100, ...)` và không chặn `muc_tieu <= 0`.

13. **[DONE] Lệch danh sách môn chuyên giữa Frontend và Backend**
    - **Vị trí**: `Frontend/profile.js:L12`, `Frontend/personal.js:L354`, `Backend/script/db_ops.py:L10-L15` (xem thêm `Frontend/khaosat.html:L74-L79`, `Frontend/diem_chuan_2026.json:L609-L634`)
    - **Nguyên nhân & Tác động**: `personal.js` có `hoa: "Chuyên Hóa học"` trong `TEN_CHUYEN`, trong khi `profile.js` (`TEN_MON`) và `db_ops.py` (`BANG_XEP_HANG`) chỉ hỗ trợ `toan, ly, dia` (còn dữ liệu khảo sát lại có `"Su"`).

14. **[DONE] Bảng "Quy tắc tính điểm" hiển thị sai logic thực tế của Backend**
    - **Vị trí**: `Frontend/ranking.html:L359-L364` vs `Backend/script/app.py:L676-L678`, `Backend/script/qua_tang.py`, `Backend/script/khoa_bang.py`
    - **Nguyên nhân & Tác động**: UI ghi `"Giữ chuỗi Streak 7 ngày: +50 điểm"` (Backend chỉ nhân hệ số streak khi làm bài), `"Tham gia thi Hương: +100 điểm"` (`khoa_bang.py` chỉ cộng 10/5/2 điểm khoa bảng, không cộng `users.score`), và `"Điểm danh hàng ngày: +20~60đ"` không ghi rõ chỉ áp dụng trong 7 ngày đầu (`tuan_dau`).

---

## 4. Tối ưu (Minor)

### 4.1. Backend Core & Database (8 mục)

1. **Blocking I/O khi gửi mail SMTP** — `Backend/script/app.py:L330-L335`: `smtplib.SMTP(..., timeout=12)` chạy đồng bộ trong request thread, có thể treo worker tới 12 giây.
2. **Nạp model AI chỉ chạy khi bật Werkzeug reloader** — `Backend/script/app.py:L911-L912`: `if os.environ.get("WERKZEUG_RUN_MAIN") == "true": nap_san()` khiến môi trường production/no-reload không nạp sẵn model, làm request chấm tự luận đầu tiên bị chậm.
3. **Truy vấn xếp hạng chưa tối ưu index** — `Backend/script/db_ops.py:L167-L210`: `COALESCE(u.mon_chuyen, '') = ?` ngăn dùng index; thiếu index trên `users(mon_chuyen, score)`, `diem_thang(thang, diem)` và `password_resets(email, token)`.
4. **Đọc danh sách file avatar trên đĩa mỗi request** — `Backend/script/app.py:L91-L99`: `os.listdir` chạy lặp lại ở mỗi lần gọi `/api/avatars` hoặc đổi avatar.
5. **Biến thừa & phụ thuộc múi giờ server** — `Backend/script/app.py:L175-L176` (`hom_nay`, `hom_qua` không dùng); `Backend/script/db_ops.py:L23,L111,L126,L140,L238` dùng `date.today()` theo giờ máy chủ (dễ lệch nếu server chạy UTC).
6. **Ngày kỳ thi mẫu hardcode trong `init_db.py`** — `Backend/Database/init_db.py:L112-L117`: 3 kỳ thi mẫu gắn cứng ngày tháng 11–12/2026.
7. **Assertion lỏng & không khôi phục biến toàn cục trong test** — `Backend/script/test_khoa_bang.py:L92,L154-L159`: Điều kiện `2 not in dh or ...` và `in (403, 409)` quá lỏng; thay đổi `kb.HAN_PHUC_KHAO_NGAY` không có `try...finally`.
8. **`contest_submit` INSERT không chỉ định tên cột** — `Backend/script/app.py:L816`: `INSERT OR IGNORE INTO contest_ket_qua VALUES (?, ?, ?)` phụ thuộc thứ tự cột bảng và không kiểm tra `user_id` tồn tại trong `users`.

### 4.2. Backend Modules & Scripts (10 mục)

1. **Không cache file đáp án trong `tien_do.py`** — `Backend/script/tien_do.py:L84-L106`: `GET /api/tien-do/<subject>` đọc và `json.load()` lại toàn bộ file đáp án trên đĩa mỗi request, thiếu cache theo `mtime`.
2. **`_chot_luoi()` chạy đồng bộ trong HTTP GET** — `Backend/script/khoa_bang.py:L535-L551,L675-L690`: Gọi `tao_ky_con_thieu()` duyệt từng kỳ từ `d0`, dễ làm chậm request đầu tiên.
3. **N+1 query trong `xep_hang_huong()`** — `Backend/script/khoa_bang.py:L330-L334`: Thực hiện 2 query `kb_hoat_dong` cho mỗi user.
4. **N+1 query & thiếu giới hạn/lock cho `_CACHE` trong `so_loi.py`** — `Backend/script/so_loi.py:L96,L376-L389`: `ky_nang()` query và đọc JSON cho từng kỹ năng; `_CACHE` toàn cục không giới hạn kích thước và thiếu thread lock.
5. **Quét thư mục skin và hiệu ứng mỗi request ở `pet.py`** — `Backend/script/pet.py:L156-L163,L193`: `GET /api/pet` gọi `os.scandir()` cho toàn bộ thư mục skin và `hieu_ung` trên mỗi request.
6. **Thiếu tên môn trong `TEN_MON`** — `Backend/script/so_loi.py:L49-L50`: Thiếu các môn như `chuyen_dia`, `chuyen_ly`.
7. **Làm hỏng viết hoa danh từ riêng/từ viết tắt trong tên đề** — `Backend/script/md_to_json.py:L404`, `Backend/script/docx_to_md.py:L598`: Dùng `.lower().capitalize()`.
8. **Đọc file 2 lần & thiếu kiểm tra kiểu dict ở `doc_json()`** — `Backend/script/md_to_json.py:L473-L477`, `Backend/script/md_to_lythuyet.py:L535-L539`: Đọc file 2 lần và không kiểm tra `isinstance(..., dict)`.
9. **Dead code & ghi đè log `_can_xu_ly.txt`** — `Backend/script/docx_to_md.py:L704,L722`: Biến `tong` (`L704`) không sử dụng; `L722` ghi đè `_can_xu_ly.txt` qua từng file khi xử lý nhiều file cùng chương.
10. **Backup `pet_goc` phụ thuộc CWD** — `Backend/script/cat_anh_pet.py:L173-L175`: Tạo thư mục backup theo CWD thay vì gốc dự án.

### 4.3. Frontend Core & Auth (12 mục)

1. **Rò rỉ Blob URL & lỗi `IndexSizeError` ở `tkb-ocr.js`** — `Frontend/tkb-ocr.js:L98-L114`: `URL.createObjectURL(blob)` không gọi `URL.revokeObjectURL()`; nếu `img.width === 0`, `getImageData(0, 0, 0, 0)` văng `IndexSizeError`.
2. **Encode PNG base64 dư thừa & rò rỉ Tesseract worker** — `Frontend/tkb-ocr.js:L242-L267` (đối chiếu `Frontend/personal.js:L73-L80`): `gallery.push({ ..., url: c.toDataURL() })` encode PNG dù `personal.js` không dùng `kq.gallery`; mảng `oDaDoc` chỉ push không đọc; Tesseract `worker` tạo xong không gọi `terminate()`.
3. **Hardcode `http://127.0.0.1:5000` ở nhiều file Frontend** — `Frontend/script.js:L105,L158`, `Frontend/auth.js:L3`, `Frontend/thong-bao.js:L7`, `Frontend/gate.js:L10`, `Frontend/khaosat.js:L138`: Lỗi khi truy cập từ thiết bị khác trong LAN hoặc deploy domain khác.
4. **Chèn trùng thẻ `<script src="thong-bao.js">`** — `Frontend/script.js:L244`: Kiểm tra `document.querySelector('script[src^="thong-bao.js"]')` khi `script.js` chạy trước thẻ `<script>` cuối `body` (ở `profile.html`, `personal.html`), dẫn đến chèn thừa vào `<head>`.
5. **Dọn key cũ không lưu lại `localStorage` & chưa hủy `setInterval` ở `thong-bao.js`** — `Frontend/thong-bao.js:L52,L202-L212`: `docDaGui()` xóa key ngày cũ trên object nhớ nhưng không ghi lại `localStorage` nếu chỉ gọi `daGui()`; `setInterval` không dọn khi đăng xuất ở tab khác hoặc `pagehide`.
6. **CSS trùng lặp & selector chết ở `style2.css` / `style3.css`** — `Frontend/style2.css:L135-L142,L472-L492,L650,L817-L844`, `Frontend/style3.css:L304-L306`: Trùng 2 block `@media (hover: hover) and (min-width: 861px)`; `style3.css` đặt `cursor: pointer` cho `.truong-card` dù chỉ nút `"Đổi/Ghim"` bấm được; `#diem-chuyen-wrap` không tồn tại.
7. **Thuộc tính CSS không hợp lệ `-webkit-text-wrap`** — `Frontend/gate.css:L1287,L1306,L1319,L1411,L1484,L1502,L1510,L1561,L1568`: Chỉ có chuẩn `text-wrap: balance/pretty`.
8. **Selector focus sai thứ tự DOM & thiếu fallback `color-mix`** — `Frontend/auth.css:L191,L602`: `.input-wrap input:focus~i.ico` không khớp vì `<i class="ico">` đứng trước `<input>` trong HTML; `color-mix(...)` chưa có fallback cho trình duyệt cũ.
9. **CSS tách rời & sai tên selector ở `form.css`** — `Frontend/form.css:L440-L453,L866-L868,L1080`: Định nghĩa `#btn-nop-bai` tách làm 2 nơi; `.kb-anti-copy .quiz-container` dùng class `.quiz-container` thay vì `#quiz-container`.
10. **Interval tự xoay thẻ không tạm dừng khi ẩn tab** — `Frontend/gate.js:L387-L429`: `startAutoRotate` không lắng nghe `visibilitychange`.
11. **`ctx.resume()` không bắt lỗi Promise** — `Frontend/am-thanh.js:L19`: Thiếu `.catch(() => {})`.
12. **Khai báo trùng tên biến `const moi` khác scope** — `Frontend/sw.js:L43,L50`: Dễ gây nhầm lẫn khi bảo trì.

### 4.4. Frontend Study (5 mục)

1. **Render công thức trùng lặp & ghi `localStorage` không debounce** — `Frontend/lesson.js:L171-L175`, `Frontend/quiz-tung-cau.js:L282`: `veCongThuc` chạy 2 lần cho cả modal ẩn và inline; `quiz-tung-cau.js` ghi `localStorage` đồng bộ mỗi lần chọn/gõ phím.
2. **`background-attachment: fixed !important` gây giật cuộn trên mobile/iOS** — `Frontend/subject-orbit.css:L25`, `Frontend/tien-do.css:L375`, `Frontend/so-loi.css:L11`.
3. **Listener `Escape` gọi `dongModalContest()` cả khi modal đóng** — `Frontend/contest.js:L231-L233`.
4. **Bộ đếm 20 giây đọc lý thuyết không tạm dừng theo `visibilitychange`** — `Frontend/lesson.js:L186-L194`.
5. **Chuỗi tên fallback gõ lỗi `"vô mae"`** — `Frontend/subjects.html:L88`, `Frontend/subjects.js:L23`.

### 4.5. Frontend Gamification (8 mục)

1. **rAF loop của pet chạy vĩnh viễn kể cả khi ẩn tab hoặc bật giảm chuyển động** — `Frontend/pet.js:L196-L205`: `requestAnimationFrame(lap)` đặt lịch frame kế tiếp ở `L198` trước khi kiểm tra `if (document.hidden || giamChuyenDong) return;`.
2. **Thiếu `willReadFrequently: true` & làm tròn chiều rộng khung sprite** — `Frontend/pet.js:L154,L160`: `canvas.getContext("2d")` thiếu `{ willReadFrequently: true }` khi dùng `getImageData`; `Math.floor(W / soKhung)` dễ lệch nhẹ nếu bề rộng sprite sheet không chia hết cho số frame.
3. **Comment vị trí trong `pet.css` lệch với CSS thực tế** — `Frontend/pet.css:L5-L14`: Comment mô tả đặt pet ở góc phải-trên (`--sl-dat-y`), nhưng rule đặt `bottom: 26px; top: auto`.
4. **[DONE] Template string xuống dòng làm hiển thị sai dấu phẩy thập phân** — `Frontend/qua.js:L82-L85`: `` `⚡ Đang x1,\n            5 điểm...` `` render thành `"x1, 5 điểm"` thay vì `"x1,5 điểm"`.
5. **Cắt bớt mô tả nhiệm vụ quá hẹp trên màn hình nhỏ** — `Frontend/nhiem-vu.css:L248`: Trên `<= 560px`, `.nv-giua small` bị giới hạn `max-width: 140px`.
6. **Đảo thứ tự nhúng `profile.js` / `qua.js` trước `script.js`** — `Frontend/profile.html:L396-L400`, `Frontend/qua.html:L143-L144`: Thứ tự phụ thuộc `API_SERVER`, `dangXuat`, `datAvatar` bị ngược (hiện tạm chạy nhờ chờ event/`DOMContentLoaded`).
7. **Còn tiền tố lưu trữ cũ `"edumate_*"` & không dọn `localStorage` theo ngày** — `Frontend/personal.js:L27`, `Frontend/personal.html:L204`: Vẫn dùng `"edumate_hoctap_"`, `"edumate_diem_"`, `"Edumate"`; key `S.daXong` theo ngày tích lũy không tự dọn.
8. **Không hủy `setTimeout` hiệu ứng xướng danh khi rời tab `#vinh-danh`** — `Frontend/khoa-bang.js:L282,L358-L386`: `ve()` không clear các timer tạo bởi `xuongDanh()`.

---

## 5. Chưa có code mà giao diện đã nói (Unimplemented UI / Stub)

*(Lưu ý: Lệch trường `demo_otp` giữa `Backend/script/app.py:L395-L404` và `Frontend/auth.js:L476-L499`, `Frontend/login.html:L268-L296` đã được ghi nhận và gộp tại mục **2.3.4** do gây ẩn vĩnh viễn giao diện cài đặt SMTP.)*

### 5.1. Backend Core & Database (4 mục)

1. **`GET /api/accounts-hint` là stub rỗng**
   - **Vị trí**: `Backend/script/app.py:L228-L233` vs `Frontend/auth.js:L149`
   - **Giải thích**: Luôn trả `accounts: []` trong khi Frontend vẫn gọi để đồng bộ danh sách tài khoản gợi ý.

2. **Các route quản lý user bị comment bỏ & hàm chết trong `db_ops.py`**
   - **Vị trí**: `Backend/script/app.py:L12,L563-L583`, `Backend/script/db_ops.py:L65-L72,L88-L94`
   - **Giải thích**: `GET /api/users` và `DELETE /api/users/<id>` bị comment (dù `app.py:L12` vẫn import `get_all_users`, `delete_user`); `delete_user` cũng chưa xóa dữ liệu ở các bảng con.

3. **Stub `/api/dev/buff-diem` & hằng số chết**
   - **Vị trí**: `Backend/script/app.py:L26-L27,L905-L907`
   - **Giải thích**: `CHO_PHEP_BUFF`, `DIEM_BUFF` không còn dùng, route trả 403 cố định (trong khi `pet.py` vẫn còn route dev).

4. **`/api/contests/<cid>/submit` chưa hỗ trợ câu tự luận (`tu-luan`)**
   - **Vị trí**: `Backend/script/app.py:L811-L813` vs `L630-L635`
   - **Giải thích**: Khác với `/api/submit`, route nộp bài thi chỉ gọi `cham(info['dap_an_dung'], ...)` nên không chấm được đề thi có câu tự luận.

### 5.2. Backend Modules & Scripts (1 mục)

1. **Nhánh tự động chuyển chủ đề từ Phần II sang Phần I mới chỉ để `pass`**
   - **Vị trí**: `Backend/script/docx_to_md.py:L396-L397` vs `goi_y()` (`L360-L361`)
   - **Giải thích**: Khi thiếu tiêu đề chủ đề giữa Phần II và Phần I, luồng parse đề chỉ để `pass` trong khi `goi_y()` đã xử lý, gây lệch mã chủ đề giữa câu hỏi và gợi ý.

### 5.3. Frontend Core & Auth (4 mục)

1. **4 thẻ `.step-card` hướng dẫn chế độ khách ở `contest.html` không có xử lý click/keydown**
   - **Vị trí**: `Frontend/gate.js:L28-L38,L544-L549`, `Frontend/gate.css:L409-L528`
   - **Giải thích**: Giao diện render 4 `.step-card` có hiệu ứng mời bấm và `cursor: pointer`, nhưng `gate.js` không gắn listener nào nên `.step-detail` (`max-height: 0; opacity: 0`) không bao giờ mở được.

2. **Nạp thư viện Google Identity Services (GSI) nhưng không khởi tạo hay nối API**
   - **Vị trí**: `Frontend/login.html:L14,L99-L133`, `Frontend/register.html:L97-L131`, `Frontend/auth.js:L147-L165` (đối chiếu `Backend/script/app.py:L461`)
   - **Giải thích**: Trang đăng nhập/đăng ký tải `https://accounts.google.com/gsi/client` và hiển thị tính năng `"Chọn Gmail trong máy"`, nhưng `auth.js` không khởi tạo GSI hay gọi `/api/forgot-password/google-verify` mà chỉ đọc lịch sử email tự lưu ở `localStorage`.

3. **Dropdown `#mon-chuyen` thiếu `"Chuyên Sử"` dù JSON điểm chuẩn đã có dữ liệu `"Su"`**
   - **Vị trí**: `Frontend/khaosat.html:L74-L79`, `Frontend/khaosat.js:L16-L17` vs `Frontend/diem_chuan_2026.json:L609-L634` (đối chiếu `Frontend/personal.js:L354`)
   - **Giải thích**: Dropdown chỉ có Toán, Vật Lý, Địa Lí, bỏ sót `"Chuyên Sử"` có sẵn trong dữ liệu điểm chuẩn (trong khi `personal.js` lại liệt kê `"hoa"` không có trong dữ liệu).

4. **Nút `#menu-btn` bị ẩn trên mọi màn hình & hàm/selector legacy chưa dọn**
   - **Vị trí**: `Frontend/index.html:L27`, `Frontend/script.js:L29-L43,L98-L174,L197-L208`, `Frontend/style.css:L454,L715`
   - **Giải thích**: HTML có `#menu-btn` và `script.js` có listener mở `.nav.open`, nhưng CSS ẩn `#menu-btn` ở mọi kích thước; `script.js` cũng còn các hàm/selector cũ (`handleLoginSubmit`, `handleRegisterSubmit`, `#login-modal`, `.btn-login`, `.btn-close`) không còn trong HTML.

### 5.4. Frontend Study (3 mục)

1. **Mục tiêu tuần & Biểu đồ 7 ngày dùng số liệu tĩnh/key chưa từng được ghi**
   - **Vị trí**: `Frontend/subjects.html:L160-L198`, `Frontend/subjects.js:L493-L547`
   - **Giải thích**: Hiển thị cứng `36%`, `18/50` bài và biểu đồ cột 7 ngày (`T2: 12 bài`..`T5: 18 bài`), đọc `localStorage.weekly_study_stats` nhưng không có bất kỳ file JS hay API nào ghi key này.

2. **Số liệu tổng số bài & tiến độ ở trang chủ môn hardcode lệch thực tế**
   - **Vị trí**: `Frontend/subjects.js:L39-L40,L53-L54,L70-L71,L84-L85,L98-L99,L145,L152-L157`
   - **Giải thích**: Hardcode tổng số bài (Toán 420, Ngữ Văn 350, Chuyên Toán 280, Chuyên Lý 220, Chuyên Địa 180 — lệch file JSON thật), luôn active mặc định `"toan"`, và đọc `edumate_tiendo_*`/`tienDo_*` chưa có code ghi rồi fallback về `tienDoMacDinh`.

3. **Danh sách 3 nhiệm vụ mẫu hardcode cho khách chưa đăng nhập**
   - **Vị trí**: `Frontend/subjects.js:L382-L409`a
   - **Giải thích**: Render 3 nhiệm vụ giả cố định thay vì dữ liệu thật từ hệ thống khi chưa đăng nhập.

### 5.5. Frontend Gamification (5 mục)

1. **Khu vực "Chiến Tích Khoa Bảng" hardcode tĩnh toàn bộ HTML**
   - **Vị trí**: `Frontend/profile.html:L148-L194`
   - **Giải thích**: Gắn cứng `2/4 Đã mở` (`Tân Khoa`, `Chăm Chỉ` mở sẵn; `Bất Diệt`, `Hội Nguyên` bị khóa), không có JS hay API đọc trạng thái thật của user.

2. **Khung `#kb-the` / `#kb-the-nd` ("Khoa bảng kỳ thi") luôn ẩn**
   - **Vị trí**: `Frontend/profile.html:L213-L220`
   - **Giải thích**: Thẻ đang gắn thuộc tính `hidden` và không có bất kỳ JS nào (`profile.js`, `khoa-bang.js`) đổ dữ liệu hay mở hiển thị.

3. **Giao diện hiển thị giá bán skin `ao_dai` nhưng chưa có API mua hay luồng tặng** *(gộp liên phân hệ)*
   - **Vị trí**: `Frontend/pet-ho-so.js:L93,L103-L105`, `Frontend/img/pet/manifest.json:L6` vs `Backend/script/pet.py:L11,L213-L226,L312`
   - **Giải thích**: UI và `manifest.json` đã có giá `"gia": 100` (`"🔒 100 điểm"`) và docstring `cap_do()` ở Backend ghi dùng cho `"cửa hàng / quà tặng / nhiệm vụ"`, nhưng bấm vào chỉ báo chưa sở hữu; chưa có API mua skin và chưa tích hợp trong `qua_tang.py` hay `nhiem_vu.py` (`cap_do()` hiện mới chỉ nối với route dev `/api/dev/pet-cap-do` ở `L312`).

4. **25 key thoại nhiệm vụ `"nv01"`–`"nv25"` đều rỗng và chưa được gọi**
   - **Vị trí**: `Frontend/audio/pet/manifest.json:L7-L31`, `Frontend/pet.js:L451,L534`
   - **Giải thích**: Khai báo sẵn 25 key với giá trị `""`, chưa được `nhiem-vu.js` hay file nào gọi phát (chỉ có ví dụ trong comment ở `pet.js`).

5. **Huy hiệu "Cấp bậc danh vọng" chỉ là trang trí tĩnh**
   - **Vị trí**: `Frontend/ranking.html:L373-L378`
   - **Giải thích**: Hiển thị các mốc điểm (`Trạng Nguyên (>1000đ)`, `Bảng Nhãn (>800đ)`, `Thám Hoa (>600đ)`, `Cử Nhân (>300đ)`) nhưng không có logic phân hạng theo các mốc này ở JS hay Backend (và trùng tên nhưng khác cơ chế với danh hiệu thi cử thật của `khoa_bang.py`).
