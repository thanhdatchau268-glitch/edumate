# -*- coding: utf-8 -*-
"""
test_khoa_bang.py - kiểm thử Bảng vàng khoa bảng trên DATABASE TẠM (không đụng edumate.db, không đụng Dap_an thật).
Chạy (ở Backend/script):  py test_khoa_bang.py
Dữ liệu trong bài test chỉ tồn tại trong file tạm và bị xóa khi chạy xong.
"""
import json
import os
import sqlite3
import tempfile
from datetime import date

import khoa_bang as kb

TMP = tempfile.mkdtemp()
kb.DB_PATH = os.path.join(TMP, "test.db")            # chuyển sang DB tạm TRƯỚC khi làm gì
kb.THU_MUC_DAP_AN = os.path.join(TMP, "Dap_an")      # đáp án cuộc thi giả cũng nằm trong thư mục tạm
os.makedirs(os.path.join(kb.THU_MUC_DAP_AN, "contest"))

conn = sqlite3.connect(kb.DB_PATH)
conn.executescript('''
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, avatar TEXT DEFAULT '', bio TEXT DEFAULT '', mon_chuyen TEXT DEFAULT '');
    CREATE TABLE contests (id INTEGER PRIMARY KEY, ten TEXT, bat_dau TEXT, ket_thuc TEXT, noi_dung TEXT DEFAULT '');
    CREATE TABLE contest_ket_qua (user_id INTEGER, contest_id INTEGER, diem INTEGER, PRIMARY KEY (user_id, contest_id));
''')
conn.commit()
conn.close()
kb.dam_bao_bang()          # tạo bảng kb_* trong DB tạm (+ cột contests.loai)

c = kb._ket_noi()
ok = 0
def kiem(dieu_kien, nhan):
    global ok
    assert dieu_kien, "SAI: " + nhan
    ok += 1
    print("  ✔", nhan)

# ---------- dữ liệu: 6 học sinh không chuyên (id 1-6) + 1 học sinh chuyên Toán (id 7) ----------
for i in range(1, 8):
    c.execute("INSERT INTO users (id, username, mon_chuyen) VALUES (?, ?, ?)", (i, f"hs{i}", "toan" if i == 7 else ""))

def hd(uid, ngay, bai, pct, so_cau=10, tl=10):
    dung = round(so_cau * pct / 100)
    c.execute("INSERT INTO kb_hoat_dong (user_id, bai_key, thoi_diem, ngay, so_cau, so_tra_loi, so_dung, pct) VALUES (?,?,?,?,?,?,?,?)",
              (uid, bai, f"{ngay} 20:00:{uid:02d}", ngay, so_cau, tl, dung, pct))

# Tuần 14-20/9/2026 (thứ Hai-Chủ Nhật). hs1..hs5 làm 4 bài với mức điểm khác nhau; hs6 chỉ 2 bài (không đủ tối thiểu)
muc = {1: 95, 2: 85, 3: 75, 4: 65, 5: 55}
for uid, pct in muc.items():
    for k in range(4):
        hd(uid, f"2026-09-{14 + k}", f"toan/chuong-1/bai-01/1.{k}", pct)
hd(6, "2026-09-14", "toan/chuong-1/bai-01/1.0", 100); hd(6, "2026-09-15", "toan/chuong-1/bai-01/1.1", 100)
for k in range(4):
    hd(7, f"2026-09-{14 + k}", f"chuyen_toan/chuong-1/bai-01/1.{k}", 90)
# Đồng điểm: hs8 y hệt hs5 (nhưng nộp sau) -> hs5 phải đứng trước
c.execute("INSERT INTO users (id, username) VALUES (8, 'hs8')")
for k in range(4):
    c.execute("INSERT INTO kb_hoat_dong (user_id, bai_key, thoi_diem, ngay, so_cau, so_tra_loi, so_dung, pct) VALUES (8,?,?,?,10,10,6,55)",
              (f"toan/chuong-1/bai-01/1.{k}", f"2026-09-{14 + k} 23:00:00", f"2026-09-{14 + k}"))
c.commit()

print("\n[1] Thi Hương")
r = kb.xep_hang_huong(c, date(2026, 9, 16))
ids = [d["user_id"] for d in r["ds"]]
kiem(r["ma"] == "2026-W38", "mã kỳ tuần đúng (2026-W38)")
kiem(6 not in ids, "hs6 làm 2 bài (dưới ngưỡng 3) không được xếp hạng")
kiem(7 not in ids, "học sinh chuyên không lẫn vào bảng Không chuyên")
kiem(ids[:5] == [1, 2, 3, 4, 5] and ids[5] == 8, "thứ tự theo điểm, hs8 đồng điểm hs5 nhưng nộp sau nên đứng sau")
x6 = kb.lam_muot(100 * 2, 2, 3, 50)
kiem(x6 < kb.lam_muot(95 * 4, 4, 3, 50), "làm ít bài 100% không vượt người làm đều bài 95%")

print("\n[2] Cuộc thi Hội (tháng 9) và Đình (quý 3) dùng lại bảng contests")
def cuoc_thi(cid, loai, bat_dau, tong, ket_qua):
    c.execute("INSERT INTO contests (id, ten, bat_dau, ket_thuc, loai) VALUES (?,?,?,?,?)", (cid, f"CT{cid}", bat_dau + " 19:00", bat_dau + " 20:00", loai))
    with open(os.path.join(kb.THU_MUC_DAP_AN, "contest", f"{cid}.json"), "w") as f:
        json.dump({"1": {"dap_an_dung": "a", "diem": tong}}, f)
    for uid, diem in ket_qua.items():
        c.execute("INSERT INTO contest_ket_qua VALUES (?,?,?)", (uid, cid, diem))
cuoc_thi(101, "hoi", "2026-08-20", 100, {1: 90, 2: 80, 3: 70, 4: 60})                    # Hội tháng 8
cuoc_thi(102, "hoi", "2026-09-20", 100, {1: 85, 2: 95, 3: 70, 4: 65, 5: 30})              # Hội tháng 9 (hs5 điểm thấp)
cuoc_thi(103, "khao_hach", "2026-09-05", 100, {1: 90, 2: 90, 3: 90, 4: 90, 5: 10})        # Khảo hạch tháng 9 (hs5 trượt)
cuoc_thi(104, "dinh", "2026-09-28", 100, {1: 88, 2: 92, 3: 60, 4: 45, 5: 99})             # Đình quý 3
c.commit()

print("\n[3] Chốt kỳ tự động")
da = kb.chot_tat_ca(c)
kiem(len(da) > 0, f"chốt được {len(da)} kỳ đã hết hạn")
tuan = c.execute("SELECT * FROM kb_ky WHERE cap='huong' AND ma='2026-W38' AND bang='khong-chuyen'").fetchone()
kiem(tuan["trang_thai"] == "da_khoa", "kỳ tuần W38 đã khóa")
dh = {r[0]: r[1] for r in c.execute("SELECT user_id, ma_danh_hieu FROM kb_user_danh_hieu WHERE ky_id=?", (tuan["id"],))}
kiem(dh.get(1) == "giai_nguyen", "hs1 nhận Giải nguyên")
kiem(2 not in dh or dh[2] in ("huong_cong", "sinh_do"), "hạng 2 nhận Hương cống/Sinh đồ")
dem_truoc = [c.execute(f"SELECT COUNT(*) FROM {b}").fetchone()[0] for b in ("kb_ket_qua", "kb_user_danh_hieu", "kb_diem_tich_luy", "kb_tham_gia")]
kb.chot_tat_ca(c); kb.chot_tat_ca(c)
dem_sau = [c.execute(f"SELECT COUNT(*) FROM {b}").fetchone()[0] for b in ("kb_ket_qua", "kb_user_danh_hieu", "kb_diem_tich_luy", "kb_tham_gia")]
kiem(dem_truoc == dem_sau, "chốt lại nhiều lần không sinh thêm kết quả / danh hiệu / điểm (idempotent)")
kiem(not kb.chot_ky(c, tuan["id"]), "chốt lại kỳ đã khóa trả về False")
nhom_chuyen = c.execute("SELECT COUNT(*) FROM kb_ket_qua r JOIN kb_ky k ON k.id=r.ky_id WHERE k.bang='toan' AND r.user_id=7").fetchone()[0]
kiem(nhom_chuyen >= 1, "học sinh chuyên Toán được xếp ở nhóm riêng")

hoi = c.execute("SELECT * FROM kb_ky WHERE cap='hoi' AND ma='2026-09' AND bang='khong-chuyen'").fetchone()
kq_hoi = {r[0]: r[1] for r in c.execute("SELECT user_id, hang FROM kb_ket_qua WHERE ky_id=?", (hoi["id"],))}
kiem(hoi["khao_hach_id"] == 103 and hoi["contest_id"] == 102, "kỳ Hội tự gắn đúng cuộc thi chính và Khảo hạch")
kiem(5 not in kq_hoi, "hs5 trượt Khảo hạch nên không vào Thi chính")
kiem(kq_hoi.get(2) == 1, "hs2 (95% bài thi Hội) là Hội nguyên")

dinh = c.execute("SELECT * FROM kb_ky WHERE cap='dinh' AND ma='2026-Q3' AND bang='khong-chuyen'").fetchone()
kq_dinh = {r[0]: r[1] for r in c.execute("SELECT user_id, hang FROM kb_ket_qua WHERE ky_id=?", (dinh["id"],))}
kiem(5 not in kq_dinh, "hs5 chỉ có 1 kỳ Hội (dưới 2) nên không đủ điều kiện Thi Đình")
kiem(4 not in kq_dinh, "hs4 điểm Đình 45% (dưới sàn 50) bị loại")
kiem(set(kq_dinh) == {1, 2, 3}, "Thi Đình chỉ còn 3 người đủ điều kiện")
td = {r[0]: r[1] for r in c.execute("SELECT user_id, ma_danh_hieu FROM kb_user_danh_hieu WHERE ky_id=?", (dinh["id"],))}
kiem(td == {2: "trang_nguyen", 1: "bang_nhan", 3: "tham_hoa"}, "Tam khôi: Trạng nguyên hs2, Bảng nhãn hs1, Thám hoa hs3")
diem_hs2 = c.execute("SELECT SUM(diem) FROM kb_diem_tich_luy WHERE user_id=2").fetchone()[0]
kiem(diem_hs2 >= 150, f"điểm tích lũy khoa bảng của hs2 = {diem_hs2} (đã gồm Trạng nguyên 150)")

print("\n[4] Chống gian lận + kỳ rỗng + mở lại")
c.execute("INSERT INTO kb_vi_pham (user_id, ky_id, ly_do, bai_key, trang_thai, tao_luc) VALUES (1, NULL, 'thử', 'x', 'xac_nhan', '2026-09-16 10:00:00')")
c.commit()
kb.mo_lai_ky(c, tuan["id"], "kiểm thử xác nhận vi phạm hs1")
kb.chot_ky(c, tuan["id"])
ids2 = [r[0] for r in c.execute("SELECT user_id FROM kb_ket_qua WHERE ky_id=? ORDER BY hang", (tuan["id"],))]
kiem(1 not in ids2 and ids2[0] == 2, "hs1 bị xác nhận vi phạm: bị loại, hs2 lên đầu sau khi mở lại và chốt lại")
kiem(c.execute("SELECT COUNT(*) FROM kb_nhat_ky WHERE hanh_dong='mo_lai'").fetchone()[0] == 1, "việc mở lại kỳ được ghi nhật ký")
rong = c.execute("SELECT * FROM kb_ky WHERE cap='huong' AND ma='2026-W35' AND bang='khong-chuyen'").fetchone()
kiem(rong["trang_thai"] == "da_khoa" and c.execute("SELECT COUNT(*) FROM kb_ket_qua WHERE ky_id=?", (rong["id"],)).fetchone()[0] == 0,
     "kỳ không ai tham gia vẫn chốt được, không có danh hiệu")

print("\n[5] API")
from flask import Flask
app = Flask(__name__)
app.register_blueprint(kb.kb_bp)
t = app.test_client()
kb._LAN_CHOT[0] = 0
j = t.get("/api/khoa-bang/tong-quan?bang=khong-chuyen").get_json()
kiem(j["success"] and [x["cap"] for x in j["cap"]] == ["huong", "hoi", "dinh"], "tong-quan trả đủ 3 cấp")
kiem(any(n["cap"] == "dinh" and n["ds"][0]["ten"] == "Trạng nguyên" for n in j["noi_bat"]), "danh hiệu nổi bật có Trạng nguyên quý 3")
j = t.get("/api/khoa-bang/ky/huong?bang=khong-chuyen&ma=2026-W38").get_json()
kiem(j["success"] and not j["tam_tinh"] and j["ds"][0]["username"] == "hs2", "chi tiết kỳ đã chốt đọc bản khóa")
kiem(len(j["quy_che"]["danh_hieu"]) == 3 and sum(x["ty_trong"] for x in j["quy_che"]["cach_tinh"]) == 100, "quy chế sinh từ cấu hình, tỷ trọng cộng đủ 100%")
kiem(t.get("/api/khoa-bang/ky/abc?bang=khong-chuyen").status_code == 404, "cấp lạ trả 404")
kiem(t.get("/api/khoa-bang/tong-quan?bang=../x").status_code == 400, "nhóm lạ bị từ chối")
j = t.get("/api/khoa-bang/vinh-danh?bang=khong-chuyen").get_json()
kiem(j["ds"] and j["ds"][0]["ma"] == "2026-Q3", "trang vinh danh có quý 3")
j = t.get("/api/khoa-bang/ho-so/2").get_json()["data"]
kiem(j["cao_nhat"]["ma"] == "trang_nguyen" and j["tong_danh_hieu"] >= 2 and j["hang_tich_luy"] == 1, "hồ sơ hs2: cao nhất Trạng nguyên, đứng đầu điểm tích lũy")
kiem(t.get("/api/khoa-bang/ho-so/999").status_code == 404, "hồ sơ không tồn tại trả 404")

ky_id = tuan["id"]
kiem(t.post("/api/khoa-bang/phuc-khao", json={"ky_id": ky_id, "noi_dung": "điểm của em bị sai ạ"}).status_code == 401, "phúc khảo không token bị từ chối")
tk = {"Authorization": "Bearer " + kb.tao_token(2)}
kiem(t.post("/api/khoa-bang/phuc-khao", json={"ky_id": ky_id, "noi_dung": "điểm của em bị sai ạ"}, headers={"Authorization": "Bearer giả"}).status_code == 401, "token giả bị từ chối")
kiem(t.post("/api/khoa-bang/phuc-khao", json={"ky_id": ky_id, "noi_dung": "điểm của em bị sai ạ"}, headers=tk).status_code == 409, "quá hạn phúc khảo bị từ chối")
han_cu, kb.HAN_PHUC_KHAO_NGAY = kb.HAN_PHUC_KHAO_NGAY, 100000
kiem(t.post("/api/khoa-bang/phuc-khao", json={"ky_id": ky_id, "noi_dung": "điểm của em bị sai ạ"}, headers=tk).status_code == 200, "trong hạn: gửi phúc khảo thành công")
kiem(t.post("/api/khoa-bang/phuc-khao", json={"ky_id": ky_id, "noi_dung": "điểm của em bị sai ạ"}, headers=tk).status_code == 409, "gửi lần 2 bị chặn")
kb.HAN_PHUC_KHAO_NGAY = han_cu
tk3 = {"Authorization": "Bearer " + kb.tao_token(6)}
kiem(t.post("/api/khoa-bang/phuc-khao", json={"ky_id": ky_id, "noi_dung": "em muốn phúc khảo ạ"}, headers=tk3).status_code in (403, 409), "người không tham gia không phúc khảo được")

c.close()
print(f"\nTẤT CẢ {ok} KIỂM TRA ĐỀU ĐẠT")