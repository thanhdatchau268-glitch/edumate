# Báo Cáo Điều Tra Lỗi & Nâng Cấp Mô Hình ML Đánh Giá Đầu Vào (V1 ➔ V2)

> **Phạm vi:** Trang Đánh giá đầu vào ([dinh-huong.html](file:///d:/KHTT/Frontend/dinh-huong.html), [dinh-huong.js](file:///d:/KHTT/Frontend/dinh-huong.js), [dinh-huong-model-v2.js](file:///d:/KHTT/Frontend/dinh-huong-model-v2.js)) và pipeline huấn luyện ([train_dinh_huong_v2.py](file:///d:/KHTT/test_dinh_huong/train_dinh_huong_v2.py), [du_lieu.csv](file:///d:/KHTT/test_dinh_huong/du_lieu.csv), [du_lieu_ml_v2.csv](file:///d:/KHTT/test_dinh_huong/du_lieu_ml_v2.csv)).

---

## 1. Tóm tắt các lỗi thực tế đã phát hiện & tái hiện chính xác

Khi kiểm thử các trường hợp điểm/sở thích biên trên bản **ML V1** (`LR_KHTN_MODEL` — Logistic Regression 2 tầng Softmax trên 7 đầu điểm), hệ thống đã trả về 4 kết quả bất hợp lý sau (đã tái hiện khớp chính xác tới `0.1%` bằng script phân tích):

| Ca kiểm thử thực tế | Môn người dùng chọn | Kết quả ML V1 cũ (SAI) | Mong đợi hợp lý |
| --- | --- | --- | --- |
| **Full 10 điểm + Full 5/5 sở thích** | Chuyên Văn | `KHÔNG` — Văn chỉ `7.7%` (#4/10); Toán chiếm `49.3%` | **`CÓ`** — Học sinh toàn năng đủ sức cho mọi môn chuyên |
| **Full 10 điểm + Full 5/5 sở thích** | Chuyên Tin | `KHÔNG` — Tin đạt `11.0%` dù đứng Top 3 (#3/10)! | **`CÓ`** — Điểm Tin 10.0 + thích lập trình 5/5 phải là `CÓ` |
| **Full 10 điểm + Full 1/5 sở thích** | Không học chuyên | `KHÔNG` (`3.2%`, #8/10), **gợi ý #1 Chuyên Địa `53.6%`** dù nhớ số liệu `1/5`! | **`CÓ`** cho Không học chuyên; tất cả môn chuyên đều **`KHÔNG`** |
| **Full 10 điểm + chỉ thích Toán (`[5,1,1,1,1,1,1]`)** | Chuyên Văn | `KHÔNG` (đúng), nhưng **Gợi ý #2 là Chuyên Địa `33.3%`** dù `thich_4 = 1/5`! | `KHÔNG` cho Văn; gợi ý #1 **Chuyên Toán**, không đẩy Địa lên #2 |

---

## 2. Tại sao xảy ra các lỗi trên? (6 Nguyên nhân gốc rễ đã chứng minh bằng số liệu)

### Nguyên nhân #1 — Mất cân bằng cực đoan trong tập gốc `du_lieu.csv` gây **Đảo ngược dấu trọng số (Sign Inversion)**
Kiểm tra toàn bộ **141 dòng** trong [du_lieu.csv](file:///d:/KHTT/test_dinh_huong/du_lieu.csv):
- Phân bố nhãn gốc `mon_chuyen`: `Toán: 44`, `Văn: 23`, `Không học chuyên: 20`, `Anh: 19`, `Lý: 11`, `Sinh: 9`, `Hóa: 6`, `Tin: 6`, `Sử: 3`, **`Địa: 0` (KHÔNG CÓ PHIẾU GỐC NÀO!)**.
- Sau quy tắc đổi nhãn `chon_lai`, lớp **`Địa` chỉ có đúng 2 dòng** (dòng 14 và dòng 114 — thực chất đều từ học sinh thi Văn được `2.75` điểm rồi điền `chon_lai = Địa`), với mức sở thích rất thấp (`thich = [3,4,3,2,3,1,2]` và `[2,3,3,2,3,1,3]`).
- Hệ quả khi trích xuất ma trận trọng số `stage8.coef` của `LR_KHTN_MODEL` cũ:

| Lớp (Stage 8) | `intercept` | Trọng số sở thích cốt lõi | Tổng trọng số 7 câu sở thích (`SUM_t`) | Tổng trọng số điểm (`SUM_d`) | Hệ quả tai hại |
| --- | ---: | ---: | ---: | ---: | --- |
| **Địa** | `-1.192` | `thich_4 = -0.543` **(ÂM!)** | **`-1.900`** (ÂM nặng nhất!) | **`+1.022`** (DƯƠNG nhất!) | Nhập **Full 10 + Full 1/5**: $z_{\text{thích}} \approx -2.0$ nhân `-1.900` sinh **`+3.8`** cộng thêm `+1.022` ➔ **Logit(Địa) = +3.61 ➔ LR đẩy Địa lên `79.6%`, MIX = `53.6%`!** |
| **Sử** | `-1.040` | `thich_4 = -0.498` **(ÂM!)** | **`-0.946`** | `-1.263` | Càng điểm cao và càng nhớ nhanh sự kiện lại càng bị trừ điểm Sử! |
| **Không học chuyên** | `+0.880` | `thich_5 = -0.022` | **`+0.831`** **(DƯƠNG!)** | `-1.213` | Nhập **Full 10 + Full 1/5** bị phạt ở CẢ điểm lẫn sở thích ➔ `LR = 0.2%`, `MIX = 3.2%`! |
| **Toán** | `+0.352` | `thich_1 = +0.320` | **`+1.128`** | **`+0.951`** | Chiếm 46/141 phiếu (32.6%) nên khi nhập **Full 10 + Full 5**, Toán độc chiếm **`LR = 76.9%` (`MIX = 49.3%`)**! |
| **Tin** | `-0.957` | `thich_6 = +0.860` | `-0.283` | `+0.987` | Chỉ có 5 phiếu nên `intercept = -0.957` ➔ **Full 10 + Full 5** chỉ còn `LR = 0.4%`, `MIX = 11.0%`! |

### Nguyên nhân #2 — Sai mô hình bài toán: Dùng **Softmax 10 lớp độc quyền ($\sum P = 100\%$)** để phán quyết `CÓ / KHÔNG`
- Softmax bắt buộc **tổng xác suất cả 10 hướng phải đúng bằng `100%`**.
- Với một học sinh **toàn năng (10đ mọi môn, 5/5 mọi sở thích)** — tức là đủ sức học **cả 9 môn chuyên** — ngay cả một mô hình hoàn hảo nhất chia công bằng cho 9 môn thì mỗi môn cũng chỉ nhận được **`100% / 9 = 11.1%`**.
- Trong khi đó, luật phán quyết cũ ở `dinh-huong.js` dòng 624 lại kiểm tra:
  ```js
  const laPhuHop = kq.top3.some((x) => x.mon === monMuon) && itemMuon.xac_suat >= 12;
  ```
- Kết quả: **`11.1% < 12%`**! Chuyên Tin dù vào **Top 3 (`#3/10`)** vẫn chỉ đạt `11.0% < 12%` nên bị phán **`KHÔNG`**, còn Chuyên Văn bị đẩy xuống `#4/10` (`7.7%`) nên cũng bị phán **`KHÔNG`**!

### Nguyên nhân #3 — Sụp đổ đặc trưng tương đối (`diff_diem = 0`) & ngoại suy ngoài phân phối (OOD)
- Mô hình V1 dùng rất nhiều đặc trưng hiệu số `diff_diem_k = diem_k - mean_7` và tích tương tác `hop_k = diff_diem_k * thich_k`.
- Khi nhập các điểm bằng nhau (`10-10-10-10-10-10`, `8-8-8-8-8-8` hay `5-5-5-5-5-5`), toàn bộ `diff_diem_k = 0` và toàn bộ `hop_k = 0` **bị triệt tiêu hoàn toàn**.
- Trong khi đó `StandardScaler` lại trừ đi trung bình lệch của tập 141 phiếu (`diff_diem_van` có mean `-0.42`, `diff_diem_su` có mean `+0.495`), biến giá trị `0` thành độ lệch giả đẩy điểm về các lớp ưu thế.

### Nguyên nhân #4 — Lọc dữ liệu cũ xóa nhầm ca thật hợp lệ & không bao phủ ca biên
- Trong `du_lieu.csv`, dòng 24 là phiếu thật của học sinh **`Không học chuyên` có điểm 10 đều và `thich` toàn `1/5`**, nhưng bộ lọc spam cũ (`if min(diem9) == 10.0 and max(thich) <= 2.0: continue`) đã xóa luôn mẫu này, khiến mô hình không hề học được khái niệm *"điểm cao nhưng hoàn toàn không muốn/không thích học chuyên ➔ Không học chuyên"*.
- Công thức domain heuristic cũ cho `Không học chuyên` (`0.95*(8.1 - mean7) + 0.35*(3 - thich_5) - 0.55*max(0, max7 - 9.0)`) cũng chỉ nhìn vào điểm số mà bỏ qua trường hợp `max(thich) == 1`, khiến `DOM(Không học chuyên)` chỉ còn `8.1%` khi Full 10 + Full 1/5.

### Nguyên nhân #5 — Mô hình tuyến tính không học được cổng logic `AND`
- Phù hợp một môn chuyên thực chất là phép hội phi tuyến: **`(Điểm đủ tốt) AND (Có hứng thú phù hợp) AND (Nền cơ sở không liệt)`**.
- Logistic Regression tuyến tính cộng gộp `w1 * điểm + w2 * sở thích`, nên một giá trị quá cao (điểm `10`) dễ dàng "bù đắp sai" cho một giá trị cực thấp (sở thích `1/5` hoặc điểm liệt 5 môn còn lại `2.0`).

### Nguyên nhân #6 — Thiếu phân tách `LS&ĐL` khi gộp Sử & Địa
- Theo GDPT 2018 bậc THCS, **Lịch sử & Địa lí** là một môn tích hợp (`LS&ĐL`), giống như **KHTN** gộp Lý–Hóa–Sinh. Bản cũ vẫn tách 2 ô Sử và Địa và chưa có câu hỏi phân tách thiên hướng Sử/Địa.

---

## 3. Các nâng cấp đã thực hiện cho ML V2

### 3.1. Chuẩn hóa 6 đầu điểm GDPT 2018 & 9 câu khảo sát
- Gộp **Sử** và **Địa** thành 1 ô duy nhất **`LS&ĐL (Sử-Địa)`** cùng với **Toán, Văn, Anh, KHTN (Lý-Hóa-Sinh), Tin** (bỏ nút copy Sử ➔ Địa thừa; biểu đồ Radar lục giác 6 trục gọn đẹp).
- Bổ sung **Câu 9** ở Bước 2: chọn phân môn hứng thú trong **LS&ĐL** (`Lịch sử` / `Địa lí` / `Ngang nhau`), song song với **Câu 8** phân môn **KHTN** (`Vật Lý` / `Hóa học` / `Sinh học` / `Ngang nhau`).
- Khi chốt mục tiêu Chuyên Sử hoặc Chuyên Địa, tự động lưu điểm `LS&ĐL` vào `KYTHI["d-l8-chuyen"]` để đồng bộ với trang Khảo sát trường & Cá nhân hóa.

### 3.2. Thiết kế lại 48 đặc trưng chuẩn hóa biên & Cổng tương tác `AND-gate`
Trong [train_dinh_huong_v2.py](file:///d:/KHTT/test_dinh_huong/train_dinh_huong_v2.py) và [dinh-huong.js](file:///d:/KHTT/Frontend/dinh-huong.js):
- **6 điểm tuyệt đối** chuẩn hóa `[0..1]` + **6 chênh lệch tương đối bị chặn biên** `clip((d - mean6)/3, -1, 1)` (chống ngoại suy bùng nổ khi nhập `0` hay `10`).
- **7 sở thích chuẩn hóa `[0..1]`** + **5 thống kê điểm toàn cục** (`mean_6`, `max_6`, `min_6`, `std_6`, `core3_mean` của Toán–Văn–Anh) + **4 thống kê sở thích toàn cục** (`mean_u`, `max_u`, `min_u`, `std_u` giúp phát hiện lập tức hồ sơ "chán toàn tập" hay "thích đều toàn năng").
- **7 biến phân môn** (`pref_ly/hoa/sinh/khtn_deu`, `pref_su/dia/lsdl_deu`).
- **9 đặc trưng tương tác phi tuyến `AND-gate`** $\text{syn}_c = \sqrt{s_c \cdot \text{interest}_c}$ — **KHÔNG bị biến mất thành 0 khi mọi điểm bằng nhau** (`diff == 0`)!
- **1 tín hiệu tổng hợp Không chuyên (`kc_signal`)** nắm bắt đồng thời 3 lý do: điểm TB yếu, 3 môn cơ sở yếu/liệt, hoặc không có hứng thú/tự học (`max_u` và `thich_5` đều thấp).
- **3 đặc trưng tương phản sở thích** (`u_khtn_vs_lsdl`, `u_tin_vs_toan`, `u_toan_vs_van`).

### 3.3. Mở rộng & Cân bằng bộ dữ liệu huấn luyện (138 phiếu thật ➔ **5.064 mẫu** trong [du_lieu_ml_v2.csv](file:///d:/KHTT/test_dinh_huong/du_lieu_ml_v2.csv))
1. **Tầng 1 — 138 phiếu khảo sát thật đã làm sạch** (+ biến thể nhiễu nhẹ bảo toàn phân phối thực tế Đồng Tháp, **giữ lại** ca thật `Không học chuyên` 10đ + 1/5 sở thích).
2. **Tầng 2 — 2.200 mẫu nguyên mẫu cân bằng cho cả 10 lớp** (`220 mẫu/lớp`), xóa sạch hoàn toàn sự thiếu hụt của Địa, Sử, Tin, Hóa, Sinh.
3. **Tầng 3 — 10 nhóm trường hợp biên & kỳ lạ (~2.300 mẫu đa nhãn):**
   - Toàn năng (`all 8.8–10` + `all 4–5` ➔ tất cả môn chuyên đều phù hợp).
   - Giỏi điểm nhưng mất động lực (`all 8.4–10` + `all 1–2` ➔ Không học chuyên).
   - Điểm bằng nhau hết (`diff = 0`) nhưng chỉ thích 1 môn duy nhất (gồm cả `t5 = 1..5`).
   - Song chuyên (2 môn cùng giỏi & cùng thích ➔ cả 2 đều `CÓ`).
   - Học lệch siêu nhân (1 môn `9.2–10` + thích `4–5`, môn khác `4.8–7.2` ➔ vẫn `CÓ`).
   - Điểm liệt cơ sở (1 môn `9–10`, 5 môn kia `0–3.4` ➔ cảnh báo `KHÔNG`, khuyên Không học chuyên).
   - Điểm thấp toàn tập (`0–6.8` dù sở thích `5/5` ➔ Không học chuyên).
   - Lệch điểm–sở thích (điểm `9.5–10` nhưng ghét `1/5` vs môn khác giỏi & thích `5/5`).
   - Đam mê nhưng điểm yếu (`4.2–7.0` + thích `5/5` ➔ chưa đạt ngưỡng chuyên).
   - Học lực trung bình khá đều (`7.0–8.5` + thích `2–4`).

### 3.4. Kiến trúc mới: **Dual-Head Calibrated Neural Network (MLP)**
- **Head 1 — Multi-Label Suitability MLP (`48 ➔ 48 tanh ➔ 24 tanh ➔ 10 Sigmoid`, L2 `alpha = 0.14`)**:
  - Xuất ra **10 xác suất phù hợp ĐỘC LẬP** trong `[1.0% .. 98.5%]` sau khi hiệu chuẩn **Temperature Scaling (`T = 1.85`)** (loại bỏ hiện tượng bão hòa xấu `0.0% / 100.0%`).
  - Phán quyết **`CÓ / KHÔNG`** dùng trực tiếp xác suất độc lập này với ngưỡng rõ ràng **`>= 50.0%`**.
- **Head 2 — Multi-Class Relative Ranker MLP (`48 ➔ 32 tanh ➔ 10 Softmax`, L2 `alpha = 0.30`)**:
  - Trộn mượt với trọng số nhỏ (`w_rk = 0.45`) ngay trước hàm Sigmoid để phá hòa tinh tế giữa các môn ngang sức theo hồ sơ thực tế, đảm bảo bảng xếp hạng 10 môn luôn giảm dần chặt chẽ và **tuyệt đối không phá hòa theo bảng chữ cái**.
- Toàn bộ trọng số gọn chỉ **`43.9 KB`**, tự động xuất ra [dinh-huong-model-v2.js](file:///d:/KHTT/Frontend/dinh-huong-model-v2.js) để chạy offline trên trình duyệt trong `< 0.5 ms` với sai số tối đa so với Python `scikit-learn` chỉ **`0.0010`** (`<= 0.1%`).

---

## 4. Kết quả kiểm định & So sánh Trước (V1) vs Sau (V2)

### 4.1. Bảng so sánh tổng quan (đo thực nghiệm trên cùng bộ kiểm thử)

| Chỉ số đánh giá | ML V1 cũ (`LR_KHTN_MODEL`) | ML V2 mới (`Dual-Head Calibrated MLP`) | Mức cải thiện |
| --- | :---: | :---: | :---: |
| Số đầu điểm đầu vào | 7 môn (tách Sử, Địa) | **6 môn GDPT 2018 (gộp LS&ĐL)** | Chuẩn chương trình mới |
| Số mẫu huấn luyện | 141 phiếu (mất cân bằng, Địa = 0 phiếu gốc) | **5.064 mẫu** (138 phiếu thật + cân bằng 10 lớp + 10 nhóm biên) | **×35.9 lần**, cân bằng đều |
| **32 ca Stress-Test cực đoan & kỳ lạ** | **22 / 32 (68.8%)** — rớt 10/32 ca | **32 / 32 (100.0%)** | **+31.2% (tuyệt đối)** |
| **Tính đơn điệu theo Điểm** (1.800 phép thử) | 98.94% (19 lần nghịch lý) | **100.00% (1.800/1.800)** | **0 lỗi nghịch lý** |
| **Tính đơn điệu theo Sở thích** (1.800 phép thử) | 96.22% (68 lần nghịch lý) | **99.39% (1.789/1.800)** | **+3.17%** |
| **5-Fold Multi-Label CV** (5.064 mẫu) | *(Không hỗ trợ đa nhãn)* | **F1-Macro `96.09%`** · **ROC-AUC `99.78%`** · **Brier `0.0176`** | F1 mọi lớp `94.98% – 97.69%` |
| **5-Fold CV trên 138 phiếu thật** *(ZERO leakage)* | *(Bị trùng lặp & không chuẩn hóa LS&ĐL)* | **Top-3: `68.8%`** · **Đúng hướng `CÓ`: `75.4%`** (Strict không phân môn: Top-3 `60.9%`, `CÓ` `75.4%`) | Đánh giá trung thực không rò rỉ |
| Sai số đối chiếu Python vs JS | — | **`0.00100` (`<= 0.1%`)** | Đồng bộ tuyệt đối |

### 4.2. Chi tiết F1 từng lớp trên 5-Fold Multi-Label CV (V2)

| Lớp | Anh | Toán | Hóa | Tin | Văn | Lý | Sinh | Địa | Sử | Không học chuyên |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **F1-Score (%)** | `97.69%` | `96.95%` | `96.31%` | `96.24%` | `96.03%` | `95.92%` | `95.89%` | `95.52%` | `95.39%` | `94.98%` |

### 4.3. Kết quả chi tiết trên các ca cực đoan nổi bật (V1 vs V2)

| Kịch bản kiểm thử | Kết quả V1 cũ | Kết quả V2 mới | Trạng thái |
| --- | --- | --- | :---: |
| Full 10 + Full 5 ➔ chọn **Văn** | Văn `7.7%` (**KHÔNG**) | Văn **`96.0%` (CÓ)** · KC `1.0%` | ✅ PASS |
| Full 10 + Full 5 ➔ chọn **Tin** | Tin `11.0%` (**KHÔNG**) | Tin **`96.5%` (CÓ)** · KC `1.0%` | ✅ PASS |
| Full 10 + Full 5 ➔ chọn **Sử / Địa** | Sử `3.8%`, Địa `5.7%` (**KHÔNG**) | Sử **`96.2%`**, Địa **`96.6%` (CÓ)** | ✅ PASS |
| Full 10 + Full 5 ➔ chọn **Không chuyên** | KC `1.3%` (KHÔNG) | KC **`1.0%` (KHÔNG)** | ✅ PASS |
| Full 10 + Full 1 ➔ chọn **Không chuyên** | KC `3.2%` (**KHÔNG**), Địa **`53.6%`** | KC **`98.5%` (CÓ)**, Địa `1.7%` | ✅ PASS |
| Full 10 + Full 1 ➔ chọn **Địa / Văn** | Địa `53.6%` (**CÓ**!) | Địa **`1.7%`**, Văn **`1.8%` (KHÔNG)** | ✅ PASS |
| Full 10 + chỉ thích Toán `[5,1,1,1,1,1,1]` ➔ chọn **Văn** | Top 3: Toán `38.8%`, **Địa `33.3%`** | Văn `3.2%` (**KHÔNG**); Top 3: **Toán `97.1%`, Tin `4.2%`, Lý `3.6%`** | ✅ PASS |
| Full 0 + Full 5 ➔ chọn **Toán** | Toán `0.0%` (KHÔNG) | Toán **`1.0%` (KHÔNG)** · KC **`98.5%`** | ✅ PASS |
| Full 5 + Full 5 ➔ chọn **Không chuyên** | KC `80.1%` (CÓ) | KC **`98.5%` (CÓ)** · max chuyên `2.9%` | ✅ PASS |
| Song chuyên Toán 9.8 + Tin 9.8 ➔ chọn **Toán / Tin** | Phụ thuộc tỉ lệ Softmax | Toán **`97.1%` (CÓ)** & Tin **`96.3%` (CÓ)** | ✅ PASS |
| Học lệch siêu nhân (Văn 9.8, khác 5.8) ➔ chọn **Văn** | Văn CÓ | Văn **`94.9%` (CÓ)** · KC `7.0%` | ✅ PASS |
| Điểm liệt cơ sở (Toán 10, 5 môn 2.0) ➔ chọn **Toán** | Toán `60.5%` (**CÓ** dù liệt 5 môn!) | Toán **`8.4%` (KHÔNG)** · KC **`72.9%`** | ✅ PASS |
| Văn 6.0 nhưng thích Văn 5/5 (Toán 9.5) ➔ chọn **Văn** | Văn KHÔNG | Văn **`3.7%` (KHÔNG)** · Gợi ý #1 Toán `96.2%` | ✅ PASS |
| Giỏi Toán 9.8 ghét Toán 1/5, Anh 9.6 thích 5/5 ➔ chọn **Toán** | Toán KHÔNG | Toán **`7.5%` (KHÔNG)** · Gợi ý #1 Anh `96.0%` | ✅ PASS |
| LS&ĐL 9.8 + thiên **Sử** ➔ chọn **Sử** | Không phân tách tốt | Sử **`95.9%` (CÓ)** vs Địa `9.1%` | ✅ PASS |
| LS&ĐL 9.8 + **Ngang nhau** ➔ chọn **Địa / Sử** | Địa `19.0%` (**KHÔNG**) | Sử **`95.4%` (CÓ)** & Địa **`94.8%` (CÓ)** | ✅ PASS |
| KHTN 9.8 + **Ngang nhau** ➔ chọn **Sinh / Lý / Hóa** | Sinh `0.1%` (**KHÔNG**), Hóa `68.3%` | Hóa **`93.9%`**, Sinh **`93.4%`**, Lý **`91.4%`** (đều **CÓ**) | ✅ PASS |

---

## 5. Hướng dẫn tái huấn luyện khi có thêm dữ liệu thật

Khi thu thập thêm phiếu khảo sát thật từ học sinh vào [du_lieu.csv](file:///d:/KHTT/test_dinh_huong/du_lieu.csv), chỉ cần chạy 1 lệnh:

```powershell
python d:\KHTT\test_dinh_huong\train_dinh_huong_v2.py
```

Script sẽ tự động:
1. Làm sạch & hợp nhất phiếu thật mới cùng bộ cân bằng & biên.
2. Chạy đầy đủ **5-Fold CV trên phiếu thật (ZERO leakage)**, **5-Fold Multi-Label CV**, **32 Stress-Tests** và **Monotonicity Audit**.
3. Xuất ra [du_lieu_ml_v2.csv](file:///d:/KHTT/test_dinh_huong/du_lieu_ml_v2.csv), [dinh_huong_model_v2.joblib](file:///d:/KHTT/test_dinh_huong/dinh_huong_model_v2.joblib), [dinh_huong_model_v2.json](file:///d:/KHTT/test_dinh_huong/dinh_huong_model_v2.json) và **tự động cập nhật thẳng** [Frontend/dinh-huong-model-v2.js](file:///d:/KHTT/Frontend/dinh-huong-model-v2.js).

---

## 6. Kiểm toán sâu & Nâng cấp lên ML V3 Ensemble (`v3_ensemble_soft_mlp_6mon`)

Sau khi đưa kiến trúc 2 tầng (Tầng 1 ML + Tầng 2 Cây tâm lý học ẩn tên môn) vào vận hành trên 6 môn GDPT 2018 + 7 câu Likert (bỏ Q8/Q9), kiểm toán thực nghiệm trên **138 phiếu thật** và **30 ca biên** phát hiện **5 điểm nghẽn** ở bản V2 và đã xử lý triệt để trong [train_dinh_huong_v3.py](file:///d:/KHTT/test_dinh_huong/train_dinh_huong_v3.py):

### 6.1. 5 điểm nghẽn đã chứng minh ở V2 ➔ Giải pháp V3
1. **Lệch không gian Train / Inference (`48` đặc trưng có Q8/Q9 vs thực tế chỉ hỏi `6 điểm + 7 Likert`):**
   - Bản V2 phải dùng phép "biên hóa" `wK = 0.55` trên JS nên gây lệch giả tới `26%` trong cùng cụm KHTN (`Lý 68.2%` vs `Hóa 94.4%` ở hồ sơ giống hệt nhau).
   - **V3:** Huấn luyện thuần trên **47 đặc trưng quan sát 100% ở production**, bỏ hoàn toàn phép vá biên hóa JS ➔ Lý/Hóa/Sinh cân bằng hoàn hảo (`92.8%`) và nhường quyền tách phân môn chuẩn xác cho **Tầng 2 ATI**.
2. **Mâu thuẫn `Không học chuyên` (`KC = 63.7%` đồng thời với `Lý = 86.8%`, `Toán = 86.8%`):**
   - Do 19 phiếu thật `Không học chuyên` có điểm học bạ rất cao (`TB 8.84–9.43`), V2 ép `y[KC] = 1` gây nhầm lẫn trên học sinh STEM thực thụ.
   - **V3:** Định nghĩa lại `KC` là **phần bù trơn sạch** của năng lực & động lực thi chuyên (`sigmoid((0.55 - best_spec)/0.10)`), chỉ cường hóa phiếu `KC` khi thực sự thiếu nền hoặc tụt động lực ➔ ca STEM lỗi ở V2 giờ ra `Toán 84.8% | KC 3.2%`.
3. **Lạm phát điểm học bạ THCS (`LS&ĐL` TB `9.45`, `Tin` TB `9.20` vs `Văn` TB `8.70`):**
   - Ở V2, học sinh chuyên Văn/Toán có `LS&ĐL = 10.0` thường bị `Sử/Địa` cướp hạng #1.
   - **V3:** Bổ sung **6 đặc trưng khử lạm phát điểm học bạ (`norm_adv`)** theo mặt bằng thực tế 138 phiếu + **6 đặc trưng tương phản sở thích nội tại (`udiff`)** (cứu học sinh khiêm tốn đánh giá cao nhất ở mức `3/5`) + hiệu chỉnh nhẹ lạm phát điểm trong mục tiêu mềm.
4. **Nhãn cứng nhị phân `0/1` gây bão hòa xác suất:**
   - Học sinh điểm `9.5` nhưng hứng thú chỉ `3/5` bị V2 đẩy vọt `90–92%`, khó phân biệt với hồ sơ `10.0 + 5/5`.
   - **V3:** Huấn luyện **Ensemble 3 mạng MLP hồi quy trên không gian Logit** với mục tiêu mềm liên tục `[0.02..0.98]` + **Ensemble 2 mạng MLP Ranker** ➔ `Full 9.5 + [3]*7` đạt mức vừa phải `79.5%`, còn `Full 10 + [5]*7` đạt `97.7–98.4%`.
5. **Kéo tụt môn chưa đo ở Tầng 2 (`tier2-engine.js`):**
   - Thay mức tiên nghiệm cứng `0.35` (kéo tụt oan các môn ngoài nhánh Tầng 2) bằng **co mềm Bayes (`0.62·T1 + 0.38·0.35`)** khi có xác suất ML V3, đồng thời nâng trọng số Tầng 2 (`w2 = 0.54`) cho các phân môn anh em `Lý/Hóa/Sinh` và `Sử/Địa` khi ATI đã đo rõ (`>= 0.65`).

### 6.2. Kết quả kiểm định ML V3 (`train_dinh_huong_v3.py`, 5.604 mẫu, ZERO leakage)
- **30 / 30 Stress-Test cực đoan & thực tế (chế độ Strict 6 điểm + 7 Likert):** **`100.0%` PASS** (`Full 10+5`, `Full 10+1`, `Full 9.5+3`, `STEM thật`, `Học lệch`, `Điểm liệt`, `Đam mê điểm yếu`, `Giỏi nhưng ghét`, `TB 7.2`, `KHTN/LS&ĐL cân bằng`).
- **Tính đơn điệu (3.600 phép thử ngẫu nhiên):** Điểm **`100.00%`** · Sở thích **`94.94%`**.
- **5-Fold Real CV (138 phiếu thật, Strict không Q8/Q9, ZERO leakage):**
  - Xác nhận đúng `CÓ` cho học sinh chuyên (`spec_yes_recall`): **`89.9%`** (107/119 học sinh chuyên thật).
  - Top-3 trúng chính xác môn chuyên thật (`spec_top3_exact`): **`63.9%`** · Top-3 đúng nhóm lớn (`top3_macro`): **`60.9%`**.
- **Kích thước gói offline trình duyệt:** `118.7 KB` (`dinh-huong-model-v2.js`, suy luận `< 1 ms`, sai số Python vs JS `0.000000`).

