# BỘ PROMPT TẠO HÌNH & SPRITE SAOLADOU CHO GAME HÓA BÀI TẬP (BẢN V31 MỚI HOÀN TOÀN)

> **Lưu ý:** Toàn bộ các prompt cũ của phần Vườn đã được xóa sạch theo yêu cầu. Bộ prompt dưới đây thiết kế **dành riêng cho hệ thống Game hóa Bài tập V31** (Màn hình Tổng kết Chặng 5 câu Trắc nghiệm / Trọn phần & Các biểu tượng Độ tự tin).

---

## 1. QUY CHUẨN KỸ THUẬT CHO SPRITE 6 KHUNG (`6×1`)

1. **Sprite hành động (Mục 2):** **1 tấm ảnh ngang duy nhất gồm đúng 6 khung hình (`6×1`)** xếp thẳng hàng từ trái sang phải (khuyên dùng **1536×256 px** hoặc **1200×200 px**), nền trắng tinh `#FFFFFF` (hoặc PNG/WebP nền trong suốt RGBA), chân nhân vật chạm cùng 1 đường thẳng đáy.
2. **Hình minh họa giao diện tĩnh (Mục 3):** Ảnh vuông **1:1** (`512×512 px`), nền trắng tinh `#FFFFFF` hoặc trong suốt, phong cách vector chibi đồng bộ.
3. **Mẹo giữ đồng nhất 100% nhân vật:** Khi tạo ảnh bằng AI, luôn đính kèm file mẫu **`Frontend/img/pet/than/mac_dinh/_xem_truoc.webp`** làm ảnh tham chiếu (*Reference Image*).
4. **Đặc tả nhân vật gốc (Saoladuo):**
   - Cute chibi 2D vector cartoon **blue Vietnamese Saola mascot ("Saoladuo")**, deep navy-indigo body fur (`#0f3872`), sky-blue muzzle/belly/inner-ears/horn-bands (`#38bdf8`), two short straight striped horns, two small white teardrop cheek markings, clean bold dark-navy outlines (`#0a2540`), cel-shaded flat 2D game art style.

---

## 2. SPRITE SHEET 6 KHUNG CHO MÀN TỔNG KẾT CHẶNG (XUẤT HIỆN MỖI 5 CÂU TRẮC NGHIỆM HOẶC CUỐI PHẦN)

### 2.1. `hoan_thanh_chang.webp` — Saoladuo Chúc Mừng Hoàn Thành Chặng / Phần
- **Khi nào hiện:** Kết thúc chặng 5 câu trắc nghiệm (hoặc kết thúc trọn phần Đúng-Sai / Trả lời ngắn / Tự luận) với tỷ lệ đúng khá/tốt (`60%–100%`).
- **Prompt (Copy):**
```text
Create a 2D game horizontal sprite sheet of EXACTLY 6 equally-spaced animation frames arranged in a single 6x1 row from left to right, pure solid white background (#FFFFFF), NO grid lines, NO borders, NO text, NO numbers.
Character (must match reference image 100%): cute chibi 2D vector blue Vietnamese Saola mascot ("Saoladuo"), deep navy-blue fur, sky-blue muzzle, chest patch, inner ears and striped short straight horns, white teardrop cheek spots, bold dark-navy outlines, cel-shaded flat 2D cartoon game style.
Action — 6-frame joyful checkpoint celebration & cheering loop:
Frame 1: standing upright proudly, gentle happy crouch getting ready to cheer, wide beaming smile.
Frame 2: hopping slightly upward throwing both paws cheerfully into the air, bright sparkling eyes.
Frame 3: peak celebration jump with paws clapping together happily and 2 tiny golden sparkle stars popping beside its head.
Frame 4: landing lightly with a big proud wink and fist-pump cheer, tail wagging happily behind.
Frame 5: clapping both paws joyfully with closed happy crescent eyes (^ ^) and cute celebratory golden-blue sparkle confetti around.
Frame 6: settling back proudly onto both feet with warm cheering smile matching Frame 1 baseline.
Keep exact same character scale, horizontal centering inside each of the 6 equal square slots, and shared invisible ground line at the bottom.
```

---

### 2.2. `khich_le_co_len.webp` — Saoladuo Động Viên & Nhắc Ôn Sổ Lỗi Sai
- **Khi nào hiện:** Kết thúc chặng/phần khi học sinh có nhiều câu sai hoặc đoán thử (`< 60%`), Saoladuo vỗ về khích lệ ôn lại các câu bị gắn cờ trong Sổ lỗi sai.
- **Prompt (Copy):**
```text
Create a 2D game horizontal sprite sheet of EXACTLY 6 equally-spaced animation frames arranged in a single 6x1 row from left to right, pure solid white background (#FFFFFF), NO grid lines, NO borders, NO text, NO numbers.
Character (must match reference image 100%): cute chibi 2D vector blue Vietnamese Saola mascot ("Saoladuo"), deep navy-blue fur, sky-blue muzzle, belly and striped horns, white teardrop cheek spots, bold dark-navy outlines, flat 2D vector cartoon style.
Action — 6-frame warm encouraging & motivating "don't give up, let's review errors" loop:
Frame 1: standing kindly holding a small cute sky-blue notebook tucked gently in left paw, soft empathetic encouraging smile.
Frame 2: raising right paw gently into a comforting thumbs-up / "you can do it" fist-pump gesture, warm hopeful eyes.
Frame 3: nodding head warmly forward in gentle encouragement, soft rosy cheeks, notebook held steady.
Frame 4: lifting the small blue notebook slightly forward toward the viewer as if inviting to review mistakes together, gentle smile.
Frame 5: patting chest warmly with right paw while nodding calmly, tiny soft glowing blue heart/sparkle floating near ear.
Frame 6: returning smoothly to friendly encouraging posture holding notebook at side matching Frame 1 baseline.
Keep identical character proportions, scale, and floor baseline across all 6 equal square slots.
```

---

### 2.3. `focus_combo.webp` — Saoladuo Đạt Chuỗi Tập Trung Cao Độ (Focus Combo)
- **Khi nào hiện:** Kết thúc chặng/phần khi học sinh đạt chuỗi đúng liên tiếp `Focus Combo >= 3` (trả lời chắc chắn `>= 5 giây/câu`).
- **Prompt (Copy):**
```text
Create a 2D game horizontal sprite sheet of EXACTLY 6 equally-spaced animation frames arranged in a single 6x1 row from left to right, pure solid white background (#FFFFFF), NO grid lines, NO borders, NO text, NO numbers.
Character (must match reference image 100%): cute chibi 2D vector blue Vietnamese Saola mascot ("Saoladuo"), deep navy-blue fur, sky-blue muzzle, belly and striped horns, white teardrop cheek spots, bold dark-navy outlines, cel-shaded 2D cartoon art.
Action — 6-frame super-focus genius mode loop (cool & sharp aura, no cluttered background):
Frame 1: standing confidently in cool scholar stance with cute rounded sky-blue glasses perched neatly on nose, calm confident smirk.
Frame 2: gently adjusting/pushing the glasses bridge with one finger while a crisp white lens shine gleams across the glass.
Frame 3: glowing bright cyan-and-gold electric focus aura sparks softly pulsing around its horns and shoulders, determined sparkling eyes.
Frame 4: pointing one paw confidently upward in a "eureka / mastered it" pose, cyan focus sparks swirling smoothly.
Frame 5: crossing arms proudly with a triumphant grin while golden star-sparks twinkle near horns.
Frame 6: lowering paw smoothly back to confident scholar stance matching Frame 1 baseline cleanly.
Keep character scale, glasses design, and ground baseline identical across all 6 equal square slots.
```

---

## 3. HÌNH MINH HỌA GIAO DIỆN TĨNH BỔ SUNG (`1:1` UI BADGES & REWARD CHEST)

*(Dùng làm biểu tượng sắc nét cho 3 nút Độ tự tin và thẻ thưởng cuối chặng — xuất file `.webp` hoặc `.png` vào `Frontend/img/bai-tap/`)*

### 3.1. Bộ 3 Icon Nút Độ Tự Tin (`icon_doan_thu.png`, `icon_kha_chac.png`, `icon_rat_chac.png`)
- **Prompt tạo cùng 1 tấm hoặc tách 3 ảnh (`512×512`):**
```text
Create a clean 2D game UI badge icon set arranged neatly in 3 equal horizontal columns on pure white background (#FFFFFF), NO text, NO labels, glossy rounded vector mobile-game icon style matching modern blue educational UI:
Left icon (Guess / Đoán thử): a cute soft purple-blue stylized question-mark bubble combined with a tiny sparkling crystal dice, gentle dreamy look.
Center icon (Fairly Sure / Khá chắc): a bright sky-blue glowing shield with a crisp white thumbs-up / upward chevron inside, confident clean sheen.
Right icon (Very Sure / Rất chắc): a vibrant royal-blue and golden blazing star medal with a crisp emerald-gold checkmark flare in the center, triumphant shiny finish.
Bold clean dark-navy outlines, high contrast, crisp silhouette readable at 32px icon size.
```

### 3.2. `tui_thuong_chang.png` — Biểu tượng Phần Thưởng Kép (`EduCoin` + `Điểm Tích Lũy`) Cuối Chặng
- **Dùng khi:** Hiển thị cạnh bảng thưởng ở Màn hình Tổng kết Chặng/Phần.
- **Prompt (Copy):**
```text
Create a single centered 2D vector cartoon game icon on pure solid white background (#FFFFFF), NO text, NO numbers: a cute sky-blue & royal-blue drawstring reward pouch overflowing with shiny golden star coins and sparkling royal-blue star gems, tied with a golden ribbon, subtle joyful sparkle stars around it. Bold clean dark-navy outlines, crisp cel-shaded flat-gradient game art style matching educational mascot Saoladuo.
```

---

## 4. HẬU KỲ NHANH: TÁCH NỀN & CĂN KHÍT `1536×256` `.webp`

Chạy script Pillow ngắn dưới đây để tự tách nền trắng `#FFFFFF` và căn 6 frame thành **1 file `.webp` chuẩn `1536×256 px`**:

```python
# Luu thanh cat_sprite.py va chay: python cat_sprite.py input.png out.webp
import sys
from PIL import Image

im = Image.open(sys.argv[1]).convert("RGBA")
px = im.load()
w, h = im.size
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if r > 242 and g > 242 and b > 242:
            px[x, y] = (r, g, b, 0)

out = Image.new("RGBA", (256 * 6, 256), (0, 0, 0, 0))
cell_w = w / 6
for i in range(6):
    crop = im.crop((int(i * cell_w), 0, int((i + 1) * cell_w), h))
    bbox = crop.getbbox()
    if not bbox:
        continue
    obj = crop.crop(bbox)
    ratio = min(228 / obj.width, 228 / obj.height)
    nw, nh = max(1, int(obj.width * ratio)), max(1, int(obj.height * ratio))
    obj = obj.resize((nw, nh), Image.Resampling.LANCZOS)
    ox = i * 256 + (256 - nw) // 2
    oy = 244 - nh
    out.paste(obj, (ox, oy), obj)

out.save(sys.argv[2], "WEBP", quality=92, method=6)
print("Da xuat sprite 6 khung chuan:", sys.argv[2])
```

## 5. KHAI BÁO VÀO `Frontend/img/pet/manifest.json`

Sau khi đặt 3 file `hoan_thanh_chang.webp`, `khich_le_co_len.webp`, `focus_combo.webp` vào `d:\KHTT\Frontend\img\pet\than\mac_dinh\`, cập nhật mảng `"hanh_dong"` trong `manifest.json`:
```json
"hanh_dong": ["idle", "vui", "hoan_thanh_chang", "khich_le_co_len", "focus_combo"]
```
*(Nếu vẫn giữ thêm các file khác trong thư mục thì giữ tên tương ứng trong mảng để không bị thiếu.)*
