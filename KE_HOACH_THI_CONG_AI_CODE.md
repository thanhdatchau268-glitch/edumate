# KẾ HOẠCH THI CÔNG CHI TIẾT — V31 MASTER (GAME HÓA BÀI TẬP)

> **Phạm vi & Chế độ áp dụng:**
> - **CHỈ áp dụng ở Phòng Luyện tập theo bài học** (`subject !== "contest"` trên [form.html](file:///d:/KHTT/Frontend/form.html) / [quiz-tung-cau.js](file:///d:/KHTT/Frontend/quiz-tung-cau.js)).
> - **Phòng thi Khoa cử (`subject === "contest"`)** giữ nguyên chế độ làm hết bài rồi mới nộp 1 lần như cũ để đảm bảo nghiêm túc phòng thi.

---

## PHẦN 1 — QUY TẮC CHIA CHẶNG THÔNG MINH & NHỊP TẬP TRUNG

### 1.1. Quy tắc tách câu thành từng Chặng (`buildSegments(items)`)
Trong `Frontend/quiz-tung-cau.js`, sau khi gom `items` từ `dsBai` (ưu tiên sắp câu mức `do_kho = 1` / Nhận biết lên câu đầu chặng 1 nếu có thể để tạo *Quick Win*):
1. **Với dạng `trac-nghiem` (Trắc nghiệm nhiều lựa chọn):**
   - Cứ **mỗi 5 câu `trac-nghiem` liên tiếp** gom thành **1 chặng** (VD bài có 13 câu trắc nghiệm ➔ Chặng 1: Câu 1–5, Chặng 2: Câu 6–10, Chặng 3: Câu 11–13).
   - **Cứ hoàn thành xong mỗi chặng 5 câu trắc nghiệm này** mới mở Màn hình Tổng kết chặng và **hiện nhân vật Saoladuo** chúc mừng/động viên!
2. **Với các dạng còn lại (`dung-sai`, `tra-loi-ngan`, `tu-luan`):**
   - **KHÔNG cắt nhỏ mỗi 5 câu**, mà gom **trọn bộ các câu liên tiếp của cả phần/dạng đó** thành **1 chặng** (hoặc theo từng phần bài tập `bai.id` nếu đổi dạng bài).
   - Chỉ khi học sinh hoàn thành xong toàn bộ phần đó mới chuyển sang Màn hình Tổng kết phần & hiện Saoladuo!

### 1.2. Giữ nhịp tập trung trong suốt chặng (*Flow State* — từ câu 1 đến câu cuối chặng)
- **KHÔNG bật cửa sổ Saoladuo hay pháo hoa che màn hình** giữa chừng trong lúc đang làm câu hỏi.
- Thay vào đó, ở thanh tiến độ đốt từng câu phía trên (`.qz-tien-segments`):
  - Mỗi đốt hiển thị rõ trạng thái câu: `Chưa làm` / `Đang làm` / `Đúng` (xanh lá) / `Sai` (cam hồng).
  - **Focus Combo Aura:** Khi học sinh trả lời **đúng liên tiếp >= 2 câu** và thời gian suy nghĩ mỗi câu **`>= 5 giây`** (`elapsedMs >= 5000` — chống bấm bừa cực nhanh để farm!), viền thanh tiến độ phát ánh sáng xanh-vàng dịu (`is-combo`) kèm badge nhỏ `🔥 Focus x3` ngay cạnh bộ đếm `Câu 3/5`.

---

## PHẦN 2 — CƠ CHẾ CHỐT 1 CHẠM THEO ĐỘ TỰ TIN & CÂN BẰNG THƯỞNG (EDUCOIN + ĐIỂM TÍCH LŨY)

### 2.1. Thanh Chốt 1 Chạm ở đáy câu hỏi (`quiz-tung-cau.js` & `.css`)
- Ở chế độ Luyện tập (`subject !== "contest"`), thay nút `Kiểm tra / Tiếp tục` đơn lẻ bằng **3 nút ngang Chốt 1 chạm theo Độ tự tin** (mặc định mờ cho tới khi học sinh chọn đáp án / nhập chữ; hỗ trợ phím tắt `1`, `2`, `3`):
  1. **`🤔 Đoán thử`** (`confidence = "doan_thu"`, sắc tím-xám dịu)
  2. **`👍 Khá chắc`** (`confidence = "kha_chac"`, sắc xanh dương nhạt)
  3. **`🔥 Rất chắc`** (`confidence = "rat_chac"`, gradient xanh VnStarL nổi bật)

### 2.2. Bảng Phản hồi Tức thì, Định tuyến Sổ Lỗi Sai & Cân bằng Phần thưởng (2 Ví)
- **Nguyên tắc cân bằng kinh tế & BXH (`Backend/script/`):**
  - Trước đây hoàn thành trọn 1 bài tập ~15–20 câu qua `/api/submit` cộng khoảng `~100 điểm` cho cả `users.score` và `users.educoin` (làm lại lần 2 giảm còn `50%`).
  - Khi chuyển sang thưởng theo từng câu ở phòng Luyện tập, cần **cân bằng tổng lượng điểm mỗi bài không bị lạm phát** VÀ **chống cày đúp 1 câu nhiều lần**:
    1. **Lưu dấu câu đã nhận thưởng lần đầu** trong bảng SQLite mới `cham_cau_log (user_id, bai_key, cau_id, lan_thuong_ngay, da_thuong_lan_dau, PRIMARY KEY(user_id, bai_key, cau_id))`:
       - **Lần đầu làm đúng câu này:** nhận **100% thưởng Độ tự tin** bên dưới (cộng đồng thời vào **CẢ `users.score` + `diem_thang` VÀ `users.educoin`** qua `cong_diem_va_educoin`).
       - **Ôn lại câu đã từng làm đúng trong ngày:** thưởng **`0`** điểm để chống cày vô hạn (học sinh vẫn xem được phản hồi Đúng/Sai); qua ngày hôm sau ôn lại chỉ nhận tối đa `+1` (nếu thuộc dạng ôn tập) hoặc chờ thưởng hoàn tất bài `0.3x` ở cuối bài.
    2. **Thưởng hoàn tất toàn bài (`/api/submit` điều chỉnh khi có log chấm từng câu):**
       - Khi làm xong toàn bộ các chặng của bài tập (`bai_id`) và chốt nộp bài ghi `da_lam` (`best_pct`):
       - **Bonus Hoàn Thành Bài** = `round(pct * 0.45 * he_so_lan_lam * he_so)` cộng thêm cho **CẢ `users.score` VÀ `users.educoin`**, **TRỪ/GIẢM hợp lý** phần đã ứng trước theo câu (hoặc tách rõ công thức: `20 câu × 3 = 60` + `~45 bonus hoàn thành bài` = `~105 điểm` cho học sinh `Rất chắc` 100%, giữ **xấp xỉ đúng mức 100 điểm/bài như cũ**!).

| Mức Độ Tự Tin | Kết Quả | Thưởng **`EduCoin` + `Điểm Tích Lũy`** *(lần đầu đúng câu)* | Xử lý **Sổ Lỗi Sai (`so_loi.py`)** | Phản hồi ngắn hiện ngay dưới câu hỏi |
| :--- | :---: | :---: | :--- | :--- |
| **🔥 Rất chắc** | **Đúng** | **`+3 EduCoin` & `+3 Điểm`** | Không lưu (tăng điểm thành thạo `kn`) | *"Chính xác! Năng lực rất vững."* |
| **👍 Khá chắc** | **Đúng** | **`+2 EduCoin` & `+2 Điểm`** | Không lưu | *"Đúng rồi! Tiếp tục giữ nhịp nhé."* |
| **🤔 Đoán thử** | **Đúng** | **`+1 EduCoin` & `+1 Điểm`** | Gắn cờ **"Đúng do may mắn"** + hiện nút bấm **`📌 Lưu vào Sổ lỗi sai`** | *"Trùng khớp, nhưng bạn đang đoán thử — lưu lại để ôn cho chắc nhé!"* |
| **🔥 Rất chắc** | **Sai** | **`0` & `0`** *(không phạt)* | Tự động lưu — **Ưu tiên CAO (`uu_tien_cao = 2`: "Lỗ hổng ẩn")**, đưa lên đầu Sổ lỗi sai | *"Chưa đúng! Đây là lỗ hổng ẩn dễ mất điểm khi thi, đã đưa lên đầu Sổ lỗi sai."* |
| **👍 Khá chắc** | **Sai** | **`0` & `0`** *(không phạt)* | Tự động lưu — **Ưu tiên Trung bình (`uu_tien_cao = 1`)** | *"Gần đúng rồi! Đã lưu vào Sổ lỗi sai để bạn tự kiểm tra lại ở cuối chặng."* |
| **🤔 Đoán thử** | **Sai** | **`0` & `0`** *(không phạt)* | Tự động lưu — **Ưu tiên Cơ bản (`uu_tien_cao = 0`)** | *"Chưa chính xác. Đã lưu lại kèm gợi ý lý thuyết Tầng 1 trong Sổ lỗi sai."* |

- **Bonus Chuỗi Tập Trung Cuối Chặng (`Focus Combo`):** Nếu cả chặng đạt tối thiểu `3` câu đúng liên tiếp và **không có câu nào bấm dưới 5 giây**, cộng thêm cuối chặng **`+2 EduCoin` & `+2 Điểm tích lũy`** (hiển thị đẹp trên màn Tổng kết chặng!).
- **QUY TẮC BẮT BUỘC KHI SAI (`GIAU_LOI_GIAI_KHI_SAI = True`):**
  - Ngay cả khi chấm tức thì từng câu bị **Sai**, hệ thống **TUYỆT ĐỐI KHÔNG gửi & KHÔNG mở lời giải chi tiết** ngay lúc đó (chỉ báo Đúng/Sai + dòng chẩn đoán + nếu `Đoán thử + Sai` có thể hiện gợi ý lý thuyết ngắn `cau.goi_y` Tầng 1), đồng thời đẩy câu sai đó vào hàng đợi **"Vá lỗi cuối chặng"**.

---

## PHẦN 3 — THIẾT KẾ GIAO DIỆN TRỰC QUAN (`quiz-tung-cau.js` & `.css`)

### 3.1. Trong lúc làm câu hỏi (Clean Focus Workspace)
1. **Thanh tiến độ trên cùng (`.qz-top`):**
   - Hiển thị cụm đốt chặng (`Segment Pills`), ví dụ Chặng 1 gồm 5 đốt dài bo tròn `[ ✓ ] [ ✓ ] [ ● ] [   ] [   ]`, bên cạnh ghi `Chặng 1/3 · Câu 3/5`.
   - Khi Focus Combo hoạt động (`combo >= 2` và thời gian suy nghĩ `>= 5s`), thanh đốt phát ánh hào quang xanh-vàng nhẹ (`.is-combo`), hiện huy hiệu `⚡ Tập trung x3`.
2. **Thẻ câu hỏi trung tâm (`.qz-card`):**
   - Nền trắng sáng bo tròn `20px`, viền `#dbeafe`, hiển thị tag nhỏ loại câu & độ khó (`Nhận biết`, `Thông hiểu`...), đề bài + công thức KaTeX.
   - Đáy thẻ câu là **Thanh Chốt 1 Chạm 3 nút Độ tự tin** (`Đoán thử` · `Khá chắc` · `Rất chắc`) thiết kế rõ sắc độ tăng dần, có icon minh họa (hoặc dùng 3 badge tạo từ prompt ở `PROMPT_SPRITE_SAOLADOU_6_KHUNG.md`).
3. **Banner Phản hồi Tức thì (`.qz-instant-fb` — trượt lên mượt ngay dưới đáp án sau khi bấm):**
   - Hiện kết quả **Đúng / Sai** (tô viền đáp án đúng màu xanh lá nếu Đúng, hoặc đánh dấu phương án vừa chọn màu đỏ nhạt nếu Sai — **không lộ đáp án đúng khi Sai nếu chưa làm lại cuối chặng** để giữ hiệu ứng tự sửa *Hypercorrection*!).
   - Hiện chip thưởng **`+3 Điểm · +3 EduCoin`** (hoặc `0 xu · Lỗ hổng ẩn`), câu chẩn đoán từ Bảng 2, nút **`📌 Lưu Sổ lỗi sai`** (nếu là `Đoán thử + Đúng`), và nút **`Câu tiếp ➔`**.

### 3.2. Màn hình Tổng kết Cuối Chặng / Cuối Phần (`#qz-stage-summary`)
Chỉ xuất hiện **sau khi xong mỗi 5 câu trắc nghiệm** hoặc **xong cả phần của dạng khác** (`dung-sai`, `tra-loi-ngan`, `tu-luan`):
1. **Khu vực Linh vật Saoladuo Xuất Hiện (Top Card):**
   - Hiển thị **Sprite 6 khung hình của Saoladuo** (`Frontend/img/pet/than/mac_dinh/`):
     - Nếu tỉ lệ đúng của chặng `>= 80%` hoặc có `Focus Combo`: chạy hoạt ảnh **`focus_combo.webp`** (hoặc **`hoan_thanh_chang.webp`**).
     - Nếu `60% – 79%`: chạy **`hoan_thanh_chang.webp`**.
     - Nếu `< 60%`: chạy **`khich_le_co_len.webp`**.
   - Kèm bong bóng thoại khích lệ cá nhân hóa (VD: *"Tuyệt đỉnh! Cậu làm chuẩn 5/5 câu trắc nghiệm rồi, rinh về +17 Điểm & +17 EduCoin nhé!"*).
2. **Nếu trong chặng có câu Sai ➔ Thẻ "Vá nóng 1 lượt trước khi đi tiếp" (tùy chọn nhanh ngay trong tổng kết hoặc làm trước khi hiện thưởng):**
   - Liệt kê các câu sai / câu `Đoán thử` bị gắn cờ trong chặng với nút **`Làm lại nhanh câu sai`** (kích hoạt Hiệu ứng tự sửa *Hypercorrection*, không hiện lời giải sẵn) hoặc nút **`📚 Mở Sổ lỗi sai`** (`so-loi.html`).
3. **3 Ô Thống kê Trực quan:**
   - `Chính xác`: `4 / 5 câu`
   - `Phần thưởng nhận được`: **`+14 Điểm tích lũy` · `+14 EduCoin`** *(kèm chi tiết `+2 Focus Combo` nếu đạt)*
   - `Lưu ý Sổ lỗi sai`: `1 câu Lỗ hổng ẩn` (hoặc `Sạch lỗi ✔`)
4. **Nút Điều hướng rõ ràng:**
   - **`Tiếp tục Chặng 2 (Câu 6–10) ➔`** *(nếu còn chặng sau)*
   - **`Hoàn thành bài & Nhận thưởng Rương ➔`** *(nếu vừa xong chặng cuối cùng của bài tập)*

---

## PHẦN 4 — KIẾN TRÚC BACKEND (`Backend/script/luyen_tap.py` + `so_loi.py` + `app.py`)

Tạo blueprint tự chứa mới **`d:\KHTT\Backend\script\luyen_tap.py`** (`luyen_tap_bp`) và đăng ký vào `app.py`:

### 4.1. Bảng SQLite chống spam & cập nhật `so_loi`
1. **Bảng mới `cham_cau_log` (trong `luyen_tap.py`):**
   - `(user_id INTEGER, bai_key TEXT, cau_id TEXT, ngay_thuong TEXT, PRIMARY KEY(user_id, bai_key, cau_id))`
   - Đảm bảo phần thưởng tự tin (`+1/+2/+3`) **chỉ cấp tối đa 1 lần trọn vẹn cho mỗi câu đúng lần đầu** (lần làm lại cùng câu trả `da_thuong_truoc = True, thuong = 0`, ngăn chặn 100% lỗi farm điểm bằng cách lặp lại 1 câu!).
2. **Nâng cấp nhẹ bảng `so_loi` (trong `so_loi.py` — `ALTER TABLE` an toàn):**
   - Thêm 2 cột `do_tu_tin TEXT DEFAULT ''` (`rat_chac | kha_chac | doan_thu | may_man`) và `uu_tien_cao INTEGER DEFAULT 0` (`2`: Lỗ hổng ẩn, `1`: Trung bình, `0`: Cơ bản).
   - Trong `GET /api/so-loi/<uid>/ky-nang`: ưu tiên đẩy các bài có `uu_tien_cao = 2` (Lỗ hổng ẩn) lên đầu kèm badge `"🔥 Lỗ hổng ẩn"`.

### 4.2. Các Endpoint Mới cho Game hóa Luyện tập
1. **`POST /api/luyen-tap/cham-cau`:**
   - Input: `{ user_id, subject, chapter, article, bai_id, cau_id, answer, confidence, elapsed_ms }`.
   - Kiểm tra hợp lệ `subject !== "contest"`, đọc đáp án từ `Backend/Dap_an/<subject>/<chapter>/<article>.json`.
   - Chấm Đúng/Sai trên Server (hỗ trợ cả `trac-nghiem`, `dung-sai`, `tra-loi-ngan`, `tu-luan`). **Nếu Sai & `GIAU_LOI_GIAI_KHI_SAI` ➔ TUYỆT ĐỐI không trả `loi_giai`**.
   - Kiểm tra `cham_cau_log`:
     - Nếu Đúng & chưa từng thưởng câu này: tính `thuong = {"rat_chac": 3, "kha_chac": 2, "doan_thu": 1}[confidence]`; ghi vào `cham_cau_log`; gọi `cong_diem_va_educoin(conn, user_id, thuong, cong_thang=True)`.
     - Nếu Sai: ghi ngay vào `so_loi` kèm `do_tu_tin` và `uu_tien_cao` (`2 / 1 / 0`), mở/cập nhật `ky_nang_user`.
   - Trả JSON: `{ success: True, dung, diem_cong, educoin_cong, thong_diep, goi_y_tang_1, da_luu_so_loi, uu_tien }`.
2. **`POST /api/luyen-tap/luu-may-man`:**
   - Dùng khi học sinh bấm nút **`📌 Lưu vào Sổ lỗi sai`** ở câu **`Đoán thử + Đúng`**: ghi câu đó vào `so_loi` với `do_tu_tin = "may_man"`, `uu_tien_cao = 1`.
3. **`POST /api/luyen-tap/hoan-thanh-chang`:**
   - Input: `{ user_id, so_cau_dung, tong_cau, focus_combo_dat, co_câu_nhanh_duoi_5s }`.
   - Server xác thực cooldown chống gọi liên tục (`>= 10s`), nếu đạt Focus Combo hợp lệ (`focus_combo_dat >= 3` và không bấm nhanh `< 5s/câu`) ➔ cộng `+2 Điểm tích lũy` & `+2 EduCoin` qua `cong_diem_va_educoin`.
4. **Cân bằng lại `/api/submit` khi nộp cuối bài từ chế độ Luyện tập (`che_do_tung_cau = True`):**
   - Trong `Backend/script/app.py` (dòng 690–695): nhận thêm cờ tùy chọn `da_thuong_theo_cau: true`. Khi cờ này bật, nhân hệ số phần thưởng tổng kết cuối bài với **`0.45`** để tổng điểm 1 bài (`thưởng từng câu + bonus cuối bài`) cân bằng ở mức **`~100–110 điểm & EduCoin`**, không bị cộng đúp lên ~`160+` gây mất cân bằng Bảng Xếp Hạng!

---

## PHẦN 5 — BỘ PROMPT HÌNH ẢNH & SPRITE MỚI (`PROMPT_SPRITE_SAOLADOU_6_KHUNG.md`)

Toàn bộ bộ prompt cũ đã được **xóa và viết mới 100%** trong **[PROMPT_SPRITE_SAOLADOU_6_KHUNG.md](file:///d:/KHTT/PROMPT_SPRITE_SAOLADOU_6_KHUNG.md)** phục vụ riêng cho Game hóa Bài tập:
- **3 Sprite Sheet 6 khung (`6×1`) cho màn Tổng kết Chặng/Phần:**
  1. `hoan_thanh_chang.webp`: Saoladuo reo hò, tung ruy-băng & ngôi sao chúc mừng hoàn thành chặng.
  2. `khich_le_co_len.webp`: Saoladuo ôm cuốn Sổ lỗi sai, vỗ ngực khích lệ ấm áp khi tỉ lệ đúng chưa cao.
  3. `focus_combo.webp`: Saoladuo đeo kính tập trung phát sáng tia sét xanh khi đạt chuỗi Focus Combo.
- **4 Hình tĩnh UI trực quan (`1:1` SVG/Icon Asset):**
  - Bộ 3 icon nút Độ tự tin (`icon_doan_thu.png`, `icon_kha_chac.png`, `icon_rat_chac.png`) và minh họa rương thưởng tổng kết chặng (`chest_stage_reward.png`).

---

## PHẦN 6 — CHECKLIST KIỂM THỬ (VERIFICATION)

1. **Test tách chặng đúng quy tắc:**
   - Mở bài tập có nhiều câu trắc nghiệm (`file_de/toan/chuong-1/bai-01.json`): kiểm tra chia đúng mỗi **5 câu trắc nghiệm = 1 chặng**; trong câu 1–4 tuyệt đối không hiện Saoladuo hay pháo hoa; xong câu 5 mới hiện Màn hình Tổng kết Chặng có Saoladuo.
   - Mở bài `ngữ văn` / `đúng sai` / `trả lời ngắn`: xác nhận gom **trọn cả phần** thành 1 chặng rồi mới hiện Saoladuo khi xong hết phần đó.
   - Mở bài thi `subject=contest`: giữ nguyên giao diện thi truyền thống, không có 3 nút Độ tự tin hay chấm từng câu.
2. **Test 3 nút Độ tự tin & Sổ lỗi sai:**
   - Làm đúng với `Rất chắc` ➔ `+3 Điểm` & `+3 EduCoin`; kiểm tra DB cả `users.score` và `users.educoin` đều tăng `3`. Làm lại đúng câu đó lần 2 ➔ không được cộng đúp `3`.
   - Làm đúng với `Đoán thử` ➔ `+1 Điểm` & `+1 EduCoin`, hiện nút **`📌 Lưu vào Sổ lỗi sai`**; bấm nút xong sang Sổ lỗi sai thấy đã lưu cờ may mắn.
   - Làm sai với `Rất chắc` ➔ `0` thưởng, **KHÔNG lộ lời giải**, kiểm tra `so_loi` có `uu_tien_cao = 2` (Lỗ hổng ẩn) xếp trên đầu danh sách Sổ lỗi sai.
3. **Test Focus Combo & Cân bằng cuối bài:**
   - Bấm trả lời đúng 3 câu liên tiếp mỗi câu `< 5 giây`: thanh tiến độ KHÔNG kích hoạt Focus Combo; giữ `>= 5 giây/câu` đúng liên tiếp ➔ viền thanh tiến độ sáng glow & cuối chặng được `+2` Focus Combo.
   - Hoàn thành trọn 1 bài tập 100%: kiểm tra tổng điểm + EduCoin nhận được (tổng từng câu + bonus `/api/submit` hệ số `0.45`) cân bằng xấp xỉ mức `100–110`.
