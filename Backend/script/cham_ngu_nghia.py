# -*- coding: utf-8 -*-
"""
cham_ngu_nghia.py - CHẤM TỰ LUẬN CHÍNH THỨC (môn Địa): từ khóa là nền, so nghĩa chỉ để "cứu" ý bị trượt từ khóa.
Đặt cạnh app.py: Backend/script/cham_ngu_nghia.py

Cài:  pip install fastembed numpy
      (không cần torch. Chưa cài được fastembed thì tự lùi về sentence-transformers nếu máy có)

Model: paraphrase-multilingual-MiniLM-L12-v2 chạy bằng ONNX (fastembed). Cùng trọng số với web test nên
ngưỡng đã chỉnh ở web test vẫn dùng được, nhưng RAM và dung lượng cài nhẹ hơn hẳn bản torch.

Một ý chỉ được "cứu" bằng so nghĩa khi TẤT CẢ điều kiện sau đúng:
  1. ý đó trượt từ khóa (và không phải do luật bài quá ngắn)
  2. ý không đánh dấu "chi_tu_khoa": true  (tên riêng, năm, thuật ngữ cố định -> bắt buộc khớp từ khóa)
  3. noi_dung của ý không chứa chữ số      (số liệu -> bắt buộc khớp từ khóa)
  4. độ giống của câu gần nhất >= ngưỡng    (mặc định NGUONG_MAC_DINH, ý nào cần riêng thì ghi "nguong")
  5. câu gần nhất không chứa từ trong "loai_tru" (chặn nói ngược: thuận lợi <-> khó khăn)
Cuối cùng vẫn áp luật chống nhồi: bài quá ngắn không thể đúng hết các ý.

Hàm cham_hon_hop() trả về đúng định dạng của cham_tu_luan() nên thay vào app.py là chạy.
"""
import os
import re
import threading

import numpy as np

from cham_tu_luan import cham_tu_luan, chuan_hoa, TU_MOI_Y, TOI_DA_KY_TU

# ====================== CẤU HÌNH ======================
TEN_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
NGUONG_MAC_DINH = 0.72    # chỉnh bằng web test với bài làm thật, đừng tin con số này
TU_TOI_THIEU_CAU = 4      # câu ngắn hơn số từ này bỏ qua (câu cụt dễ giống ngẫu nhiên)
TOI_DA_DOAN = 80          # chặn bài quá dài làm chậm server

GOC = os.path.dirname(os.path.abspath(__file__))
THU_MUC_MODEL = os.path.join(GOC, "..", "model_cache")   # lưu model ở đây để khỏi tải lại (nhớ thêm vào .gitignore)

# ====================== NẠP MODEL (1 lần, an toàn khi nhiều luồng) ======================
_MA_HOA = None            # hàm: list chữ -> mảng vector
_LOI_NAP = False          # nạp hỏng 1 lần thì thôi, khỏi thử lại mỗi request
_KHOA = threading.Lock()


def _nap():
    global _MA_HOA, _LOI_NAP
    if _MA_HOA is not None:
        return _MA_HOA
    with _KHOA:
        if _MA_HOA is not None:
            return _MA_HOA
        if _LOI_NAP:
            raise RuntimeError("model so nghĩa đã nạp lỗi trước đó")
        try:
            try:
                from fastembed import TextEmbedding
                m = TextEmbedding(model_name=TEN_MODEL, cache_dir=THU_MUC_MODEL)
                _MA_HOA = lambda ds: np.array(list(m.embed(ds)))
                print("[cham_ngu_nghia] dùng fastembed (ONNX)")
            except Exception as e:       # chưa cài fastembed, hoặc bản fastembed chưa có model này
                print("[cham_ngu_nghia] không dùng được fastembed:", e)
                from sentence_transformers import SentenceTransformer
                m2 = SentenceTransformer(TEN_MODEL)
                _MA_HOA = lambda ds: m2.encode(ds)
                print("[cham_ngu_nghia] dùng sentence-transformers")
        except Exception:
            _LOI_NAP = True
            raise
    return _MA_HOA


def nap_san():
    """Gọi lúc khởi động server để học sinh đầu tiên không phải chờ nạp model. Lỗi thì chỉ báo, không làm sập server."""
    try:
        _nap()
    except Exception as e:
        print("[cham_ngu_nghia] KHÔNG nạp được model, sẽ chấm bằng từ khóa thuần:", e)


def _ma_hoa(ds):
    v = np.asarray(_nap()(ds), dtype="float32")
    return v / np.maximum(np.linalg.norm(v, axis=1, keepdims=True), 1e-9)   # chuẩn hóa để nhân ma trận ra cosine


# ====================== HÀM PHỤ ======================
def _cat_doan(text):
    """Cắt bài làm thành câu, rồi thêm các cặp 2 câu liền nhau (1 ý hay trải dài 2 câu). Không cắt ở dấu thập phân."""
    cau = [c.strip() for c in re.split(r"(?<!\d)\.(?!\d)|[;!?\n]+", text) if len(c.split()) >= TU_TOI_THIEU_CAU]
    cap = [cau[i] + ". " + cau[i + 1] for i in range(len(cau) - 1)]
    return (cau + cap)[:TOI_DA_DOAN]


def _co_so(s):
    return re.search(r"\d", str(s)) is not None


def _co_tu_loai_tru(cau, ds):
    c = chuan_hoa(cau)
    return any(t.strip() and chuan_hoa(t) in c for t in ds if isinstance(t, str))


def _ap_luat_ngan(kq, tra_loi):
    """Bài quá ngắn thì giữ các ý đạt đầu tiên, phần dư không tính (cùng luật với cham_tu_luan)."""
    toi_da = len(chuan_hoa(tra_loi).split()) // TU_MOI_Y
    dem = 0
    for r in kq:
        if r["dat"]:
            dem += 1
            if dem > toi_da:
                r["dat"], r["qua_ngan"] = False, True
                r.pop("ngu_nghia", None)


# ====================== CHẤM ======================
def cham_hon_hop(info, tra_loi):
    """Giống cham_tu_luan: trả về (điểm đạt, [kết quả từng ý]).
    Ý được cứu bằng so nghĩa có thêm 'ngu_nghia': True và 'do_giong'."""
    tra_loi = str(tra_loi)[:TOI_DA_KY_TU]
    diem, kq = cham_tu_luan(info, tra_loi)             # bước 1: từ khóa (nền)

    # cham_tu_luan giữ nguyên thứ tự ý nên ghép đôi theo vị trí
    can_thu = [(y, r) for y, r in zip(info.get("y", []), kq)
               if not r["dat"] and not r.get("qua_ngan")
               and not y.get("chi_tu_khoa")
               and str(y.get("noi_dung", "")).strip() and not _co_so(y["noi_dung"])]
    doan = _cat_doan(tra_loi)
    if not can_thu or not doan:
        return diem, kq

    try:                                               # bước 2: so nghĩa
        sim = _ma_hoa([y["noi_dung"] for y, _ in can_thu]) @ _ma_hoa(doan).T   # [số ý] x [số đoạn]
    except Exception as e:                             # model hỏng thì lùi về từ khóa thuần, không làm hỏng việc nộp bài
        print("[cham_ngu_nghia] bỏ qua so nghĩa:", e)
        return diem, kq

    for i, (y, r) in enumerate(can_thu):
        j = int(sim[i].argmax())
        giong = float(sim[i][j])
        r["do_giong"] = round(giong, 3)
        if _co_tu_loai_tru(doan[j], y.get("loai_tru", [])):
            continue                                   # câu giống nhất đang nói điều đối lập với ý này
        if giong >= float(y.get("nguong", NGUONG_MAC_DINH)):
            r["dat"], r["ngu_nghia"] = True, True

    _ap_luat_ngan(kq, tra_loi)                         # bước 3: chống nhồi
    return round(sum(r["diem"] for r in kq if r["dat"]), 2), kq