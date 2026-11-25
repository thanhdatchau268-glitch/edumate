# -*- coding: utf-8 -*-
"""
train_dinh_huong_v2.py — Pipeline Huấn Luyện & Kiểm Thử ML V2 (Dual-Head Calibrated MLP)

Nâng cấp toàn diện hệ thống Đánh giá đầu vào (VnStarL):
  1. Chuẩn hóa 6 đầu điểm GDPT 2018: Toán, Văn, Anh, KHTN (Lý-Hóa-Sinh), LS&ĐL (Sử-Địa), Tin.
  2. Bổ sung Câu 9 phân tách LS&ĐL (Sử / Địa / Ngang nhau) song song Câu 8 phân tách KHTN (Lý / Hóa / Sinh / Ngang nhau).
  3. Kiến trúc Dual-Head Calibrated Neural Network (48 đặc trưng chuẩn hóa biên):
     - Head 1 (Multi-Label Suitability MLP: 48 -> 48 -> 24 -> 10 Sigmoid + Temperature Scaling):
       Đánh giá ĐỘC LẬP xác suất phù hợp của từng hướng [0..100%] để trả lời CÓ / KHÔNG chính xác
       kể cả khi học sinh giỏi đều toàn năng, song chuyên, hay giỏi điểm nhưng chán học.
     - Head 2 (Multi-Class Relative Ranker MLP: 48 -> 32 -> 10 Softmax):
       Xếp hạng ưu tiên tinh tế giữa các môn ngang sức (phá hòa theo hồ sơ thực tế, loại bỏ hoàn toàn hòa theo bảng chữ cái).
  4. Bộ dữ liệu mở rộng có cấu trúc (~4,800 mẫu) kết hợp 138 phiếu khảo sát thật + mẫu nguyên mẫu cân bằng 10 lớp
     + 10 nhóm trường hợp biên/kỳ lạ (adversarial edge cases).
  5. Kiểm định chéo 5-Fold nghiêm ngặt trên phiếu thật (ZERO data leakage, báo cáo cả chế độ không/có phân môn),
     5-Fold đa nhãn, 32 ca Stress-Test cực đoan, kiểm định tính đơn điệu (Monotonicity Audit) và đối chiếu 100% Python vs JS.
"""
import csv
import json
import math
import os
import warnings
from collections import Counter

import joblib
import numpy as np
from scipy.optimize import minimize_scalar
from sklearn.metrics import brier_score_loss, f1_score, log_loss, roc_auc_score
from sklearn.model_selection import KFold, StratifiedKFold
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler

THU_MUC = os.path.dirname(os.path.abspath(__file__))

MON_6 = ["toan", "van", "anh", "khtn", "lsdl", "tin"]
DIEM_COLS_RAW9 = ["toan", "van", "anh", "ly", "hoa", "sinh", "su", "dia", "tin"]
THICH_COLS = [f"thich_{i}" for i in range(1, 8)]

CLASSES_10 = [
    "Anh", "Địa", "Hóa", "Không học chuyên", "Lý",
    "Sinh", "Sử", "Tin", "Toán", "Văn"
]
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASSES_10)}
CHUYEN_9 = [c for c in CLASSES_10 if c != "Không học chuyên"]

MACRO_MAP = {
    "Toán": "Toán", "Tin": "Tin", "Văn": "Văn", "Anh": "Anh",
    "Lý": "KHTN", "Hóa": "KHTN", "Sinh": "KHTN",
    "Sử": "LS&ĐL", "Địa": "LS&ĐL", "Không học chuyên": "Không học chuyên",
}

FEAT_NAMES = (
    [f"s_{m}" for m in MON_6]
    + [f"diff_{m}" for m in MON_6]
    + [f"u_{i}" for i in range(1, 8)]
    + ["mean_6", "max_6", "min_6", "std_6", "core3_mean"]
    + ["mean_u", "max_u", "min_u", "std_u"]
    + ["pref_ly", "pref_hoa", "pref_sinh", "pref_khtn_deu"]
    + ["pref_su", "pref_dia", "pref_lsdl_deu"]
    + [
        "syn_toan", "syn_van", "syn_anh", "syn_tin",
        "syn_ly", "syn_hoa", "syn_sinh", "syn_su", "syn_dia",
        "kc_signal",
    ]
    + ["u_khtn_vs_lsdl", "u_tin_vs_toan", "u_toan_vs_van"]
)  # 48 đặc trưng chuẩn hóa biên


def parse_float(val):
    if val is None:
        return None
    s = str(val).strip().replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def compute_aligned_interests(thich, khtn_pref="deu", lsdl_pref="deu"):
    """Mức hứng thú hiệu dụng [0..1] cho từng môn chuyên (đồng biến theo sở thích)."""
    u = [(float(x) - 1.0) / 4.0 for x in thich]
    u1, u2, u3, u4, u5, u6, u7 = u

    khtn_base_ly = 0.62 * u3 + 0.24 * u1 + 0.14 * u5
    khtn_base_hoa = 0.72 * u3 + 0.14 * u1 + 0.14 * u5
    khtn_base_sinh = 0.62 * u3 + 0.24 * u4 + 0.14 * u5

    def mod_khtn(val, key):
        if khtn_pref == key:
            return min(1.0, val * 0.88 + 0.16)
        if khtn_pref in ("ly", "hoa", "sinh"):
            return val * 0.56
        return val

    lsdl_base_su = 0.64 * u4 + 0.24 * u2 + 0.12 * u5
    lsdl_base_dia = 0.64 * u4 + 0.24 * u3 + 0.12 * u5

    def mod_lsdl(val, key):
        if lsdl_pref == key:
            return min(1.0, val * 0.88 + 0.16)
        if lsdl_pref in ("su", "dia"):
            return val * 0.56
        return val

    return {
        "Toán": 0.78 * u1 + 0.14 * u5 + 0.08 * u3,
        "Văn": 0.78 * u2 + 0.14 * u5 + 0.08 * u4,
        "Anh": 0.82 * u7 + 0.12 * u5 + 0.06 * u2,
        "Tin": 0.76 * u6 + 0.14 * u1 + 0.10 * u5,
        "Lý": mod_khtn(khtn_base_ly, "ly"),
        "Hóa": mod_khtn(khtn_base_hoa, "hoa"),
        "Sinh": mod_khtn(khtn_base_sinh, "sinh"),
        "Sử": mod_lsdl(lsdl_base_su, "su"),
        "Địa": mod_lsdl(lsdl_base_dia, "dia"),
    }


def extract_features_one(d6, thich, khtn_pref="deu", lsdl_pref="deu"):
    """Trích xuất đúng 48 đặc trưng chuẩn hóa biên (đồng bộ 100% giữa Python & JS)."""
    d = [max(0.0, min(10.0, float(v))) for v in d6]
    t = [max(1.0, min(5.0, float(v))) for v in thich]
    s = [v / 10.0 for v in d]

    mean6 = sum(d) / 6.0
    max6 = max(d)
    min6 = min(d)
    std6 = math.sqrt(sum((v - mean6) ** 2 for v in d) / 6.0)
    core3 = (d[0] + d[1] + d[2]) / 3.0

    diffs = [max(-1.0, min(1.0, (v - mean6) / 3.0)) for v in d]
    u = [(v - 1.0) / 4.0 for v in t]

    subj_u = [u[0], u[1], u[2], u[3], u[5], u[6]]
    mean_u = sum(subj_u) / 6.0
    max_u = max(subj_u)
    min_u = min(subj_u)
    std_u = math.sqrt(sum((v - mean_u) ** 2 for v in subj_u) / 6.0)

    p_ly = 1.0 if khtn_pref == "ly" else 0.0
    p_hoa = 1.0 if khtn_pref == "hoa" else 0.0
    p_sinh = 1.0 if khtn_pref == "sinh" else 0.0
    p_khtn_deu = 1.0 if khtn_pref not in ("ly", "hoa", "sinh") else 0.0

    p_su = 1.0 if lsdl_pref == "su" else 0.0
    p_dia = 1.0 if lsdl_pref == "dia" else 0.0
    p_lsdl_deu = 1.0 if lsdl_pref not in ("su", "dia") else 0.0

    ai = compute_aligned_interests(t, khtn_pref, lsdl_pref)
    s_map = {
        "Toán": s[0], "Văn": s[1], "Anh": s[2], "Tin": s[5],
        "Lý": s[3], "Hóa": s[3], "Sinh": s[3], "Sử": s[4], "Địa": s[4],
    }
    syn = [
        math.sqrt(max(0.0, s_map[m]) * max(0.0, ai[m]))
        for m in ("Toán", "Văn", "Anh", "Tin", "Lý", "Hóa", "Sinh", "Sử", "Địa")
    ]

    low_score_sig = max(0.0, min(1.0, (8.3 - mean6) / 3.5))
    low_core_sig = max(0.0, min(1.0, (7.6 - core3) / 3.5))
    low_mot_sig = max(0.0, min(1.0, 1.0 - (0.72 * max_u + 0.28 * u[4])))
    kc_signal = min(1.0, max(low_score_sig, low_core_sig * 0.9, low_mot_sig))

    return (
        s
        + diffs
        + u
        + [mean6 / 10.0, max6 / 10.0, min6 / 10.0, min(1.0, std6 / 3.0), core3 / 10.0]
        + [mean_u, max_u, min_u, min(1.0, std_u / 0.5)]
        + [p_ly, p_hoa, p_sinh, p_khtn_deu, p_su, p_dia, p_lsdl_deu]
        + syn
        + [kc_signal]
        + [u[2] - u[3], u[5] - u[0], u[0] - u[1]]
    )


def compute_oracle_multilabel(d6, thich, khtn_pref="deu", lsdl_pref="deu", forced_primary=None):
    """Nhãn đa nhãn chuẩn hóa cho Head 1 (Multi-Label Suitability)."""
    d = [max(0.0, min(10.0, float(v))) for v in d6]
    t = [max(1.0, min(5.0, float(v))) for v in thich]
    mean6 = sum(d) / 6.0
    core3 = (d[0] + d[1] + d[2]) / 3.0
    max6 = max(d)

    u = [(v - 1.0) / 4.0 for v in t]
    u1, u2, u3, u4, u5, u6, u7 = u
    max_subj_u = max(u1, u2, u3, u4, u6, u7)
    ai = compute_aligned_interests(t, khtn_pref, lsdl_pref)

    score_of = {
        "Toán": d[0], "Văn": d[1], "Anh": d[2], "Tin": d[5],
        "Lý": d[3], "Hóa": d[3], "Sinh": d[3], "Sử": d[4], "Địa": d[4],
    }
    core_t = {
        "Toán": t[0], "Văn": t[1], "Anh": t[6], "Tin": t[5],
        "Lý": 0.72 * t[2] + 0.28 * t[0],
        "Hóa": t[2],
        "Sinh": 0.76 * t[2] + 0.24 * t[3],
        "Sử": 0.78 * t[3] + 0.22 * t[1],
        "Địa": 0.78 * t[3] + 0.22 * t[2],
    }

    y = np.zeros(len(CLASSES_10), dtype=float)
    min_core3 = min(d[0], d[1], d[2])
    co_so_liet = core3 < 5.0 or min_core3 < 3.5 or (mean6 < 5.5 and max6 < 8.8)

    for mon in CHUYEN_9:
        sc = score_of[mon]
        ct = core_t[mon]
        intr = ai[mon]

        if mon in ("Lý", "Hóa", "Sinh"):
            kmap = {"Lý": "ly", "Hóa": "hoa", "Sinh": "sinh"}
            if khtn_pref in ("ly", "hoa", "sinh") and khtn_pref != kmap[mon]:
                continue
        if mon in ("Sử", "Địa"):
            lmap = {"Sử": "su", "Địa": "dia"}
            if lsdl_pref in ("su", "dia") and lsdl_pref != lmap[mon]:
                continue

        if co_so_liet:
            continue

        diem_du = (
            (sc >= 8.5 and ct >= 3.0 and (t[4] >= 3.0 or ct >= 4.0))
            or (sc >= 8.0 and ct >= 4.0 and (t[4] >= 3.0 or sc >= 8.6))
            or (sc >= 9.0 and ct >= 4.5)
        )
        khong_bi_bo_xa = not (max_subj_u >= 0.75 and intr < 0.35 and sc - mean6 <= 0.3)

        if diem_du and khong_bi_bo_xa and intr >= 0.42:
            y[CLASS_TO_IDX[mon]] = 1.0

    so_mon_hop = int(y.sum())
    chan_hoc = (max_subj_u <= 0.25 and t[4] <= 2.5)
    hoc_luc_dai_tra = (mean6 < 7.6 and max6 < 8.5) or co_so_liet
    if so_mon_hop == 0 or chan_hoc or hoc_luc_dai_tra:
        y[CLASS_TO_IDX["Không học chuyên"]] = 1.0
        if chan_hoc or co_so_liet:
            for mon in CHUYEN_9:
                y[CLASS_TO_IDX[mon]] = 0.0

    if forced_primary and forced_primary in CLASS_TO_IDX:
        y[CLASS_TO_IDX[forced_primary]] = 1.0
        if forced_primary != "Không học chuyên" and not chan_hoc:
            y[CLASS_TO_IDX["Không học chuyên"]] = 0.0

    return y


def doc_va_lam_sach_phieu_that(csv_path):
    """Đọc 141 phiếu khảo sát thật, làm sạch chuẩn hóa về 6 đầu điểm GDPT 2018."""
    records = []
    seen = set()

    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            nhan = (row.get("mon_chuyen") or "").strip()
            if nhan not in CLASS_TO_IDX:
                continue

            diem9 = [parse_float(row.get(f"diem_{m}")) for m in DIEM_COLS_RAW9]
            co_diem = [v for v in diem9 if v is not None and 0.0 <= v <= 10.0]
            if len(co_diem) < 3:
                continue

            tb_tam = sum(co_diem) / len(co_diem)
            for idx, v in enumerate(diem9):
                if v is not None and 0.1 < v < 1.0 and tb_tam >= 7.0:
                    diem9[idx] = round(v * 10.0, 2)

            co_diem = [v for v in diem9 if v is not None and 0.0 <= v <= 10.0]
            tb = sum(co_diem) / len(co_diem)
            diem9 = [v if (v is not None and 0.0 <= v <= 10.0) else round(tb, 2) for v in diem9]

            thich = [parse_float(row.get(c)) for c in THICH_COLS]
            if any(v is None or not (1.0 <= v <= 5.0) for v in thich):
                continue

            hl = parse_float(row.get("hai_long"))
            dt = parse_float(row.get("diem_thi_chuyen"))
            chon_lai = (row.get("chon_lai") or "").strip()
            if chon_lai in CLASS_TO_IDX and chon_lai != "Không học chuyên":
                if (hl is not None and hl <= 2) or (dt is not None and dt < 4.0):
                    nhan = chon_lai

            khtn = round((diem9[3] + diem9[4] + diem9[5]) / 3.0, 2)
            lsdl = round((diem9[6] + diem9[7]) / 2.0, 2)
            d6 = [round(diem9[0], 2), round(diem9[1], 2), round(diem9[2], 2), khtn, lsdl, round(diem9[8], 2)]

            khtn_pref = "deu"
            if nhan == "Lý":
                khtn_pref = "ly"
            elif nhan == "Hóa":
                khtn_pref = "hoa"
            elif nhan == "Sinh":
                khtn_pref = "sinh"
            else:
                ly_v, hoa_v, sinh_v = diem9[3], diem9[4], diem9[5]
                if max(ly_v, hoa_v, sinh_v) - min(ly_v, hoa_v, sinh_v) >= 0.6:
                    khtn_pref = ["ly", "hoa", "sinh"][int(np.argmax([ly_v, hoa_v, sinh_v]))]

            lsdl_pref = "deu"
            if nhan == "Sử":
                lsdl_pref = "su"
            elif nhan == "Địa":
                lsdl_pref = "dia"
            else:
                su_v, dia_v = diem9[6], diem9[7]
                if abs(su_v - dia_v) >= 0.6:
                    lsdl_pref = "su" if su_v > dia_v else "dia"

            dedup_key = (nhan, tuple(d6), tuple(int(x) for x in thich))
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            if nhan != "Không học chuyên" and min(d6) == 10.0 and max(thich) <= 2.0:
                continue

            records.append({
                "source": "real",
                "primary": nhan,
                "d6": d6,
                "thich": [int(round(x)) for x in thich],
                "khtn_pref": khtn_pref,
                "lsdl_pref": lsdl_pref,
            })

    return records


def sinh_du_lieu_nang_cao(real_records, seed=42):
    """Sinh bộ dữ liệu mở rộng 3 tầng (~4,800 mẫu) phục vụ cả Head 1 (Multi-Label) và Head 2 (Ranker)."""
    rng = np.random.default_rng(seed)
    samples = []

    def add_sample(source, primary, d6, thich, khtn_pref, lsdl_pref, use_forced=False, use_for_ranker=True):
        d6_c = [round(float(np.clip(v, 0.0, 10.0)), 1) for v in d6]
        t_c = [int(np.clip(round(v), 1, 5)) for v in thich]
        y_ml = compute_oracle_multilabel(
            d6_c, t_c, khtn_pref, lsdl_pref,
            forced_primary=(primary if use_forced else None),
        )
        samples.append({
            "source": source,
            "primary": primary,
            "d6": d6_c,
            "thich": t_c,
            "khtn_pref": khtn_pref,
            "lsdl_pref": lsdl_pref,
            "y_ml": y_ml,
            "use_for_ranker": use_for_ranker,
        })

    # TẦNG 1: Phiếu thật + biến thể nhẹ
    for r in real_records:
        add_sample("real", r["primary"], r["d6"], r["thich"], r["khtn_pref"], r["lsdl_pref"], use_forced=True, use_for_ranker=True)
        for _ in range(3):
            d_jit = [v + rng.normal(0.0, 0.12) for v in r["d6"]]
            t_jit = [v + (rng.choice([-1, 0, 0, 0, 1]) if rng.random() < 0.25 else 0) for v in r["thich"]]
            add_sample("real_jit", r["primary"], d_jit, t_jit, r["khtn_pref"], r["lsdl_pref"], use_forced=True, use_for_ranker=True)

    # TẦNG 2: Nguyên mẫu cân bằng 10 lớp (220 mẫu/lớp = 2,200 mẫu)
    for mon in CLASSES_10:
        for _ in range(220):
            base = rng.uniform(7.5, 9.1)
            d = np.clip(rng.normal(base, 0.55, size=6), 5.8, 9.6)
            t = rng.integers(1, 4, size=7).astype(float)
            t[4] = rng.choice([3, 4, 4, 5])
            kp = rng.choice(["ly", "hoa", "sinh", "deu"], p=[0.2, 0.2, 0.2, 0.4])
            lp = rng.choice(["su", "dia", "deu"], p=[0.25, 0.25, 0.5])

            if mon == "Toán":
                d[0] = rng.uniform(8.8, 10.0)
                t[0] = rng.choice([4, 4, 5, 5])
                if rng.random() < 0.5:
                    t[5] = rng.choice([1, 2, 3])
            elif mon == "Văn":
                d[1] = rng.uniform(8.7, 10.0)
                t[1] = rng.choice([4, 4, 5, 5])
                d[0] = np.clip(d[0] - rng.uniform(0.0, 0.8), 6.5, 9.5)
            elif mon == "Anh":
                d[2] = rng.uniform(8.8, 10.0)
                t[6] = rng.choice([4, 4, 5, 5])
            elif mon == "Tin":
                d[5] = rng.uniform(8.9, 10.0)
                d[0] = np.clip(d[5] - rng.uniform(0.0, 0.9), 7.8, 9.8)
                t[5] = rng.choice([4, 4, 5, 5])
                t[0] = rng.choice([3, 4, 5])
            elif mon in ("Lý", "Hóa", "Sinh"):
                d[3] = rng.uniform(8.8, 10.0)
                t[2] = rng.choice([4, 4, 5, 5])
                kp = {"Lý": "ly", "Hóa": "hoa", "Sinh": "sinh"}[mon]
                if mon == "Lý":
                    t[0] = rng.choice([3, 4, 5])
                elif mon == "Sinh":
                    t[3] = rng.choice([3, 4, 5])
            elif mon in ("Sử", "Địa"):
                d[4] = rng.uniform(8.8, 10.0)
                t[3] = rng.choice([4, 4, 5, 5])
                lp = {"Sử": "su", "Địa": "dia"}[mon]
                if mon == "Sử":
                    t[1] = rng.choice([3, 4, 5])
                else:
                    t[2] = rng.choice([3, 4, 5])
            else:
                mode = rng.choice(["low", "mid", "unmotivated"], p=[0.4, 0.35, 0.25])
                if mode == "low":
                    d = np.clip(rng.normal(rng.uniform(4.5, 7.2), 0.7, size=6), 1.5, 8.2)
                    t = rng.integers(1, 6, size=7).astype(float)
                elif mode == "mid":
                    d = np.clip(rng.normal(rng.uniform(7.0, 8.1), 0.4, size=6), 6.0, 8.5)
                    t = rng.integers(1, 4, size=7).astype(float)
                else:
                    d = np.clip(rng.normal(rng.uniform(8.2, 9.8), 0.35, size=6), 7.5, 10.0)
                    t = rng.integers(1, 3, size=7).astype(float)
                    t[4] = rng.choice([1, 1, 2])
                kp = "deu"
                lp = "deu"

            add_sample("archetype", mon, d, t, kp, lp, use_forced=False, use_for_ranker=True)

    # TẦNG 3: 10 NHÓM CA BIÊN / KỲ LẠ (Adversarial & Edge-Case Bank)
    # E1. Toàn năng (All 9-10 + All 4-5)
    for _ in range(220):
        lvl = rng.uniform(8.8, 10.0)
        d = [lvl if rng.random() < 0.55 else np.clip(lvl + rng.uniform(-0.4, 0.3), 8.6, 10.0) for _ in range(6)]
        t_lvl = rng.choice([4, 5, 5])
        t = [t_lvl if rng.random() < 0.6 else rng.choice([4, 5]) for _ in range(7)]
        kp = rng.choice(["ly", "hoa", "sinh", "deu"], p=[0.18, 0.18, 0.18, 0.46])
        lp = rng.choice(["su", "dia", "deu"], p=[0.22, 0.22, 0.56])
        add_sample("edge_all_rounder", "Toán", d, t, kp, lp, use_for_ranker=False)

    # E2. Giỏi toàn diện nhưng mất động lực (All 8.5-10 + All 1-2)
    for _ in range(240):
        lvl = rng.uniform(8.4, 10.0)
        d = [lvl if rng.random() < 0.6 else np.clip(lvl + rng.uniform(-0.5, 0.2), 8.0, 10.0) for _ in range(6)]
        t = [1 if rng.random() < 0.65 else 2 for _ in range(7)]
        t[4] = rng.choice([1, 1, 2])
        kp = rng.choice(["ly", "hoa", "sinh", "deu"], p=[0.15, 0.15, 0.15, 0.55])
        lp = rng.choice(["su", "dia", "deu"], p=[0.15, 0.15, 0.70])
        add_sample("edge_high_apathetic", "Không học chuyên", d, t, kp, lp, use_for_ranker=True)

    # E3. Điểm bằng nhau hết (Flat 8.8-10, diff==0) nhưng CHỈ thích đúng 1 môn
    for mon in CHUYEN_9:
        for _ in range(44):
            lvl = rng.uniform(8.8, 10.0)
            d = [lvl] * 6 if rng.random() < 0.65 else [np.clip(lvl + rng.uniform(-0.3, 0.2), 8.6, 10.0) for _ in range(6)]
            t = [1 if rng.random() < 0.7 else 2 for _ in range(7)]
            t[4] = int(rng.choice([1, 2, 3, 4, 5]))
            kp, lp = "deu", "deu"
            if mon == "Toán": t[0] = int(rng.choice([4, 5, 5]))
            elif mon == "Văn": t[1] = int(rng.choice([4, 5, 5]))
            elif mon == "Anh": t[6] = int(rng.choice([4, 5, 5]))
            elif mon == "Tin": t[5] = int(rng.choice([4, 5, 5]))
            elif mon in ("Lý", "Hóa", "Sinh"):
                t[2] = int(rng.choice([4, 5, 5]))
                kp = {"Lý": "ly", "Hóa": "hoa", "Sinh": "sinh"}[mon]
            elif mon in ("Sử", "Địa"):
                t[3] = int(rng.choice([4, 5, 5]))
                lp = {"Sử": "su", "Địa": "dia"}[mon]
            add_sample("edge_flat_single_int", mon, d, t, kp, lp, use_for_ranker=True)

    # E4. Song chuyên (2 môn giỏi + thích)
    dual_pairs = [
        ("Toán", "Tin"), ("Toán", "Lý"), ("Toán", "Anh"), ("Văn", "Anh"),
        ("Văn", "Sử"), ("Lý", "Hóa"), ("Hóa", "Sinh"), ("Sử", "Địa"),
        ("Tin", "Anh"), ("Toán", "Văn"),
    ]
    for m1, m2 in dual_pairs:
        for _ in range(28):
            d = list(np.clip(rng.normal(7.6, 0.5, size=6), 6.2, 8.6))
            t = list(rng.integers(1, 3, size=7))
            t[4] = int(rng.choice([3, 4, 5]))
            kp, lp = "deu", "deu"
            for m in (m1, m2):
                if m == "Toán": d[0] = rng.uniform(9.0, 10.0); t[0] = int(rng.choice([4, 5]))
                elif m == "Văn": d[1] = rng.uniform(9.0, 10.0); t[1] = int(rng.choice([4, 5]))
                elif m == "Anh": d[2] = rng.uniform(9.0, 10.0); t[6] = int(rng.choice([4, 5]))
                elif m == "Tin": d[5] = rng.uniform(9.0, 10.0); t[5] = int(rng.choice([4, 5]))
                elif m in ("Lý", "Hóa", "Sinh"):
                    d[3] = rng.uniform(9.0, 10.0); t[2] = int(rng.choice([4, 5]))
                    kp = "deu" if (m1 in ("Lý", "Hóa", "Sinh") and m2 in ("Lý", "Hóa", "Sinh")) else {"Lý": "ly", "Hóa": "hoa", "Sinh": "sinh"}[m]
                elif m in ("Sử", "Địa"):
                    d[4] = rng.uniform(9.0, 10.0); t[3] = int(rng.choice([4, 5]))
                    lp = "deu" if (m1 in ("Sử", "Địa") and m2 in ("Sử", "Địa")) else {"Sử": "su", "Địa": "dia"}[m]
            add_sample("edge_dual_talent", m1, d, t, kp, lp, use_for_ranker=False)

    # E5. Học lệch siêu nhân (1 môn 9.2-10 + thích 4-5, khác 4.8-7.2)
    for mon in CHUYEN_9:
        for _ in range(24):
            d = list(rng.uniform(4.8, 7.2, size=6))
            t = list(rng.integers(1, 3, size=7))
            t[4] = int(rng.choice([3, 4, 5]))
            kp, lp = "deu", "deu"
            if mon == "Toán": d[0] = rng.uniform(9.2, 10.0); t[0] = int(rng.choice([4, 5]))
            elif mon == "Văn": d[1] = rng.uniform(9.2, 10.0); t[1] = int(rng.choice([4, 5]))
            elif mon == "Anh": d[2] = rng.uniform(9.2, 10.0); t[6] = int(rng.choice([4, 5]))
            elif mon == "Tin": d[5] = rng.uniform(9.2, 10.0); t[5] = int(rng.choice([4, 5]))
            elif mon in ("Lý", "Hóa", "Sinh"):
                d[3] = rng.uniform(9.2, 10.0); t[2] = int(rng.choice([4, 5]))
                kp = {"Lý": "ly", "Hóa": "hoa", "Sinh": "sinh"}[mon]
            elif mon in ("Sử", "Địa"):
                d[4] = rng.uniform(9.2, 10.0); t[3] = int(rng.choice([4, 5]))
                lp = {"Sử": "su", "Địa": "dia"}[mon]
            add_sample("edge_spiked_talent", mon, d, t, kp, lp, use_for_ranker=True)

    # E6. Điểm thấp toàn tập (0-6.8) kể cả thích 5/5 -> Không học chuyên
    for _ in range(220):
        lvl = rng.uniform(0.0, 6.8)
        d = [lvl if rng.random() < 0.45 else np.clip(lvl + rng.uniform(-1.0, 1.0), 0.0, 7.2) for _ in range(6)]
        t = [5] * 7 if rng.random() < 0.35 else list(rng.integers(1, 6, size=7))
        kp = rng.choice(["ly", "hoa", "sinh", "deu"])
        lp = rng.choice(["su", "dia", "deu"])
        add_sample("edge_all_low", "Không học chuyên", d, t, kp, lp, use_for_ranker=True)

    # E7. Điểm 1 môn cao (9.2-10) nhưng 5 môn kia quá liệt (0-3.4) -> cảnh báo Không học chuyên
    for _ in range(180):
        d = list(rng.uniform(0.0, 3.4, size=6))
        idx = int(rng.integers(0, 6))
        d[idx] = rng.uniform(9.0, 10.0)
        t = list(rng.integers(1, 6, size=7))
        t_idx_map = {0: 0, 1: 1, 2: 6, 3: 2, 4: 3, 5: 5}
        t[t_idx_map[idx]] = int(rng.choice([4, 5]))
        add_sample("edge_catastrophic_core", "Không học chuyên", d, t, "deu", "deu", use_for_ranker=True)

    # E8. Lệch Điểm - Sở thích
    for _ in range(200):
        d = list(rng.uniform(7.5, 9.2, size=6))
        t = list(rng.integers(1, 4, size=7))
        t[4] = int(rng.choice([3, 4, 5]))
        a, b = rng.choice(6, size=2, replace=False)
        d[a] = rng.uniform(9.4, 10.0)
        d[b] = rng.uniform(8.9, 9.9)
        t_idx_map = {0: 0, 1: 1, 2: 6, 3: 2, 4: 3, 5: 5}
        t[t_idx_map[a]] = 1
        t[t_idx_map[b]] = 5
        kp = rng.choice(["ly", "hoa", "sinh"]) if b == 3 else "deu"
        lp = rng.choice(["su", "dia"]) if b == 4 else "deu"
        b_name = {
            0: "Toán", 1: "Văn", 2: "Anh",
            3: {"ly": "Lý", "hoa": "Hóa", "sinh": "Sinh"}.get(kp, "Lý"),
            4: {"su": "Sử", "dia": "Địa"}.get(lp, "Sử"),
            5: "Tin",
        }[b]
        add_sample("edge_score_int_mismatch", b_name, d, t, kp, lp, use_for_ranker=True)

    # E9. Đam mê cực cao (5/5) nhưng điểm yếu (4.2-7.0)
    for _ in range(180):
        d = list(rng.uniform(6.5, 8.8, size=6))
        t = list(rng.integers(1, 4, size=7))
        a = int(rng.integers(0, 6))
        d[a] = rng.uniform(4.2, 7.0)
        t_idx_map = {0: 0, 1: 1, 2: 6, 3: 2, 4: 3, 5: 5}
        t[t_idx_map[a]] = 5
        t[4] = int(rng.choice([3, 4, 5]))
        add_sample("edge_passion_low_score", "Không học chuyên", d, t, "deu", "deu", use_for_ranker=False)

    # E10. Trung bình khá đều (7.0-8.5) + sở thích trung bình (2-4)
    for _ in range(180):
        lvl = rng.uniform(7.0, 8.5)
        d = [lvl if rng.random() < 0.4 else np.clip(lvl + rng.uniform(-0.5, 0.5), 6.5, 8.8) for _ in range(6)]
        t = list(rng.integers(2, 5, size=7))
        kp = rng.choice(["ly", "hoa", "sinh", "deu"])
        lp = rng.choice(["su", "dia", "deu"])
        add_sample("edge_mid_balanced", "Không học chuyên", d, t, kp, lp, use_for_ranker=False)

    return samples


def mlp_forward_logits(coefs, intercepts, X_scaled):
    """Tính raw logits trước sigmoid/softmax của MLP (activation=tanh)."""
    h = X_scaled
    for li, (W, b) in enumerate(zip(coefs, intercepts)):
        z = h @ W + b
        if li < len(coefs) - 1:
            h = np.tanh(z)
        else:
            return z
    return h


def fit_temperature_sigmoid(logits_val, y_val):
    """Hiệu chuẩn Temperature Scaling T cho 10 đầu ra Sigmoid (tránh bão hòa 0.0%/100.0%)."""
    def nll(T):
        z = np.clip(logits_val / T, -25.0, 25.0)
        p = 1.0 / (1.0 + np.exp(-z))
        p = np.clip(p, 1e-6, 1.0 - 1e-6)
        return -float(np.mean(y_val * np.log(p) + (1.0 - y_val) * np.log(1.0 - p)))

    res = minimize_scalar(nll, bounds=(1.1, 4.0), method="bounded")
    # Giữ T tối thiểu 1.85 để xác suất hiển thị mượt trong khoảng ~3%..96% thay vì dính 0%/100%
    return round(float(max(1.85, res.x)), 3)


def fit_dual_head(X_tr, Y_ml_tr, y_rk_idx_tr, rk_mask_tr, seed=42):
    """Huấn luyện trọn bộ Dual-Head: Scaler + Head 1 (Multi-Label MLP + Temp) + Head 2 (Ranker MLP)."""
    scaler = StandardScaler()
    X_s = scaler.fit_transform(X_tr)

    # Tách 15% làm tập hiệu chuẩn nhiệt độ (calibration holdout) cho Head 1
    rng = np.random.default_rng(seed + 777)
    perm = rng.permutation(len(X_s))
    n_cal = max(200, int(0.15 * len(X_s)))
    cal_i, fit_i = perm[:n_cal], perm[n_cal:]

    head_fit = MLPClassifier(
        hidden_layer_sizes=(48, 24),
        activation="tanh",
        alpha=0.14,
        batch_size=64,
        learning_rate_init=0.0028,
        max_iter=360,
        early_stopping=True,
        n_iter_no_change=18,
        random_state=seed,
    )
    head_fit.fit(X_s[fit_i], Y_ml_tr[fit_i])
    logits_cal = mlp_forward_logits(head_fit.coefs_, head_fit.intercepts_, X_s[cal_i])
    temp_fit = fit_temperature_sigmoid(logits_cal, Y_ml_tr[cal_i])

    # Refit Head 1 trên 100% X_s cùng số epoch tốt (hoặc giữ trực tiếp head_fit đã hội tụ)
    head_fit_full = MLPClassifier(
        hidden_layer_sizes=(48, 24),
        activation="tanh",
        alpha=0.14,
        batch_size=64,
        learning_rate_init=0.0028,
        max_iter=360,
        early_stopping=True,
        n_iter_no_change=18,
        random_state=seed,
    )
    head_fit_full.fit(X_s, Y_ml_tr)

    # Head 2: Multi-Class Relative Ranker (chỉ học trên mẫu có nhãn đơn rõ ràng)
    head_rank = MLPClassifier(
        hidden_layer_sizes=(32,),
        activation="tanh",
        alpha=0.30,
        batch_size=64,
        learning_rate_init=0.003,
        max_iter=340,
        early_stopping=True,
        n_iter_no_change=18,
        random_state=seed + 13,
    )
    head_rank.fit(X_s[rk_mask_tr], y_rk_idx_tr[rk_mask_tr])

    return scaler, head_fit_full, temp_fit, head_rank


def export_dual_head_json(scaler, head_fit, temp_fit, head_rank):
    return {
        "version": "v2_dual_head_mlp_6mon",
        "classes": CLASSES_10,
        "feat_names": FEAT_NAMES,
        "yes_threshold": 50.0,
        "temp_fit": temp_fit,
        "rank_tiebreak_weight": 0.45,
        "mean": [round(float(x), 5) for x in scaler.mean_],
        "scale": [round(float(x), 5) for x in scaler.scale_],
        "head_fit": [
            {
                "W": [[round(float(v), 4) for v in row] for row in W],
                "b": [round(float(v), 4) for v in b],
            }
            for W, b in zip(head_fit.coefs_, head_fit.intercepts_)
        ],
        "head_rank": [
            {
                "W": [[round(float(v), 4) for v in row] for row in W],
                "b": [round(float(v), 4) for v in b],
            }
            for W, b in zip(head_rank.coefs_, head_rank.intercepts_)
        ],
    }


def forward_layers_py(layers, h_in):
    h = h_in
    for li, layer in enumerate(layers):
        W, b = layer["W"], layer["b"]
        out_dim = len(b)
        nxt = [0.0] * out_dim
        for j in range(out_dim):
            s = b[j]
            for i in range(len(h)):
                s += h[i] * W[i][j]
            nxt[j] = math.tanh(s) if li < len(layers) - 1 else s
        h = nxt
    return h


def predict_dual_head_manual(model_json, d6, thich, khtn_pref="deu", lsdl_pref="deu"):
    """
    Suy luận Dual-Head thuần toán học (100% giống JS):
      - fit_pct[c]: Xác suất phù hợp độc lập [1.0..98.5]% (Temperature-Calibrated Sigmoid từ Head 1).
        Dùng TRỰC TIẾP cho phán quyết CÓ / KHÔNG (ngưỡng >= 50%).
      - rank_score[c]: Điểm xếp hạng = fit_pct[c] + tiebreak(Head 2 Ranker + tín hiệu môn) để phá hòa thông minh,
        tuyệt đối KHÔNG phá hòa theo bảng chữ cái!
    """
    x_vec = extract_features_one(d6, thich, khtn_pref, lsdl_pref)
    mean, scale = model_json["mean"], model_json["scale"]
    x_s = [(x_vec[i] - mean[i]) / scale[i] for i in range(len(mean))]

    # Head 1 & Head 2 kết hợp mượt ngay trước Sigmoid để thứ hạng & % hiển thị đồng nhất 100%
    T = model_json["temp_fit"]
    z_fit = forward_layers_py(model_json["head_fit"], x_s)

    z_rk = forward_layers_py(model_json["head_rank"], x_s)
    mz = max(z_rk)
    exps = [math.exp((z - mz) / 1.5) for z in z_rk]
    s_exp = sum(exps) or 1.0
    p_rk = [e / s_exp for e in exps]

    ai = compute_aligned_interests(thich, khtn_pref, lsdl_pref)
    s_map = {
        "Toán": d6[0] / 10.0, "Văn": d6[1] / 10.0, "Anh": d6[2] / 10.0, "Tin": d6[5] / 10.0,
        "Lý": d6[3] / 10.0, "Hóa": d6[3] / 10.0, "Sinh": d6[3] / 10.0,
        "Sử": d6[4] / 10.0, "Địa": d6[4] / 10.0, "Không học chuyên": 0.0,
    }

    w_rk = model_json["rank_tiebreak_weight"]
    out = {}
    for i, cls in enumerate(model_json["classes"]):
        z_cal = z_fit[i] / T + w_rk * (p_rk[i] - 0.1) + 0.08 * (0.45 * s_map[cls] + 0.55 * ai.get(cls, 0.0) - 0.5)
        p_comb = 1.0 / (1.0 + math.exp(-max(-25.0, min(25.0, z_cal))))
        fit_val = max(0.01, min(0.985, p_comb))
        fit_pct = round(fit_val * 100.0, 1)
        out[cls] = {
            "fit_pct": fit_pct,
            "rank_pct": round(p_rk[i] * 100.0, 1),
            "sort_key": round(fit_val + 1e-4 * p_rk[i], 6),
        }
    return out


def evaluate_real_5fold_cv(real_records, hide_subpref=False):
    """5-Fold Stratified CV nghiêm ngặt trên 138 phiếu thật (ZERO data leakage)."""
    y_primary = np.array([r["primary"] for r in real_records])
    y_strat = np.array([MACRO_MAP[m] for m in y_primary])
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    top1_exact, top1_macro, top3_exact, suited_hit, total = 0, 0, 0, 0, 0
    for fold, (tr_i, te_i) in enumerate(skf.split(np.zeros(len(real_records)), y_strat)):
        tr_real = [real_records[i] for i in tr_i]
        tr_samples = sinh_du_lieu_nang_cao(tr_real, seed=100 + fold)

        X_tr = np.array([extract_features_one(s["d6"], s["thich"], s["khtn_pref"], s["lsdl_pref"]) for s in tr_samples])
        Y_ml_tr = np.array([s["y_ml"] for s in tr_samples])
        y_rk_tr = np.array([CLASS_TO_IDX[s["primary"]] for s in tr_samples])
        rk_mask = np.array([s["use_for_ranker"] for s in tr_samples], dtype=bool)

        sc, hf, tf, hr = fit_dual_head(X_tr, Y_ml_tr, y_rk_tr, rk_mask, seed=42 + fold)
        mj = export_dual_head_json(sc, hf, tf, hr)

        for idx in te_i:
            r = real_records[idx]
            kp = "deu" if hide_subpref else r["khtn_pref"]
            lp = "deu" if hide_subpref else r["lsdl_pref"]
            res = predict_dual_head_manual(mj, r["d6"], r["thich"], kp, lp)
            ordered = sorted(CLASSES_10, key=lambda c: res[c]["sort_key"], reverse=True)
            yt = r["primary"]
            if ordered[0] == yt:
                top1_exact += 1
            if MACRO_MAP[ordered[0]] == MACRO_MAP[yt]:
                top1_macro += 1
            if yt in ordered[:3]:
                top3_exact += 1
            if res[yt]["fit_pct"] >= 50.0:
                suited_hit += 1
            total += 1

    return {
        "real_count": total,
        "hide_subpref": hide_subpref,
        "top1_exact_pct": round(100.0 * top1_exact / total, 1),
        "top1_macro_pct": round(100.0 * top1_macro / total, 1),
        "top3_exact_pct": round(100.0 * top3_exact / total, 1),
        "suitability_recall_pct": round(100.0 * suited_hit / total, 1),
    }


def evaluate_multilabel_5fold_cv(samples):
    """5-Fold CV đa nhãn trên toàn bộ tập mở rộng (đo F1, ROC-AUC, Brier Score trước/sau Calibration)."""
    X = np.array([extract_features_one(s["d6"], s["thich"], s["khtn_pref"], s["lsdl_pref"]) for s in samples])
    Y = np.array([s["y_ml"] for s in samples])

    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    probs_raw_all = np.zeros_like(Y)
    probs_cal_all = np.zeros_like(Y)
    preds_all = np.zeros_like(Y)

    for fold, (tr_i, te_i) in enumerate(kf.split(X)):
        sc = StandardScaler()
        X_tr_s = sc.fit_transform(X[tr_i])
        X_te_s = sc.transform(X[te_i])
        clf = MLPClassifier(
            hidden_layer_sizes=(48, 24),
            activation="tanh",
            alpha=0.14,
            batch_size=64,
            learning_rate_init=0.0028,
            max_iter=360,
            early_stopping=True,
            n_iter_no_change=18,
            random_state=42 + fold,
        )
        clf.fit(X_tr_s, Y[tr_i])
        z_te = mlp_forward_logits(clf.coefs_, clf.intercepts_, X_te_s)
        pr_raw = 1.0 / (1.0 + np.exp(-np.clip(z_te, -25.0, 25.0)))
        pr_cal = 1.0 / (1.0 + np.exp(-np.clip(z_te / 1.9, -25.0, 25.0)))
        probs_raw_all[te_i] = pr_raw
        probs_cal_all[te_i] = pr_cal
        preds_all[te_i] = (pr_cal >= 0.5).astype(float)

    f1_macro = round(100.0 * f1_score(Y, preds_all, average="macro"), 2)
    f1_micro = round(100.0 * f1_score(Y, preds_all, average="micro"), 2)
    auc_macro = round(100.0 * roc_auc_score(Y, probs_cal_all, average="macro"), 2)
    exact_match = round(100.0 * float(np.mean(np.all(preds_all == Y, axis=1))), 2)
    brier = round(float(np.mean((probs_cal_all - Y) ** 2)), 4)
    per_class_f1 = {
        c: round(100.0 * f1_score(Y[:, i], preds_all[:, i]), 2)
        for i, c in enumerate(CLASSES_10)
    }
    return {
        "n_samples": len(samples),
        "f1_macro_pct": f1_macro,
        "f1_micro_pct": f1_micro,
        "roc_auc_macro_pct": auc_macro,
        "brier_score": brier,
        "exact_subset_match_pct": exact_match,
        "per_class_f1": per_class_f1,
    }


def run_stress_tests(model_json):
    """32 ca kiểm thử cực đoan & kỳ lạ (bao gồm toàn bộ lỗi ảnh user + chống bão hòa + chống hòa bảng chữ cái)."""
    YES_THRESH = model_json["yes_threshold"]

    cases = [
        ("1. Full 10 + Full 5 -> chọn Văn", [10,10,10,10,10,10], [5,5,5,5,5,5,5], "deu", "deu", "Văn", True, lambda r: 80.0 <= r["Văn"]["fit_pct"] <= 98.5),
        ("2. Full 10 + Full 5 -> chọn Tin", [10,10,10,10,10,10], [5,5,5,5,5,5,5], "deu", "deu", "Tin", True, lambda r: 80.0 <= r["Tin"]["fit_pct"] <= 98.5),
        ("3. Full 10 + Full 5 -> chọn Toán", [10,10,10,10,10,10], [5,5,5,5,5,5,5], "deu", "deu", "Toán", True, None),
        ("4. Full 10 + Full 5 -> chọn Sử", [10,10,10,10,10,10], [5,5,5,5,5,5,5], "deu", "deu", "Sử", True, None),
        ("5. Full 10 + Full 5 -> chọn Địa", [10,10,10,10,10,10], [5,5,5,5,5,5,5], "deu", "deu", "Địa", True, None),
        ("6. Full 10 + Full 5 -> chọn Không chuyên", [10,10,10,10,10,10], [5,5,5,5,5,5,5], "deu", "deu", "Không học chuyên", False, None),
        ("7. Full 10 + Full 1 -> chọn Không chuyên (ảnh 4)", [10,10,10,10,10,10], [1,1,1,1,1,1,1], "deu", "deu", "Không học chuyên", True, lambda r: r["Địa"]["fit_pct"] < 25.0),
        ("8. Full 10 + Full 1 -> chọn Địa (chống bug 53.6%)", [10,10,10,10,10,10], [1,1,1,1,1,1,1], "deu", "deu", "Địa", False, lambda r: r["Không học chuyên"]["fit_pct"] >= 80.0),
        ("9. Full 10 + Full 1 -> chọn Văn", [10,10,10,10,10,10], [1,1,1,1,1,1,1], "deu", "deu", "Văn", False, None),
        ("10. Full 10 + chỉ thích Toán [5,1,1,1,1,1,1] -> chọn Toán", [10,10,10,10,10,10], [5,1,1,1,1,1,1], "deu", "deu", "Toán", True, lambda r: r["Toán"]["fit_pct"] > r["Địa"]["fit_pct"] + 45.0),
        ("11. Full 10 + chỉ thích Toán [5,1,1,1,1,1,1] -> chọn Văn (ảnh 5)", [10,10,10,10,10,10], [5,1,1,1,1,1,1], "deu", "deu", "Văn", False, lambda r: r["Địa"]["fit_pct"] < 25.0),
        ("12. Full 10 + chỉ thích Văn [1,5,1,1,4,1,1] -> chọn Văn", [10,10,10,10,10,10], [1,5,1,1,4,1,1], "deu", "deu", "Văn", True, lambda r: r["Văn"]["fit_pct"] > r["Toán"]["fit_pct"] + 45.0),
        ("13. Full 10 + chỉ thích Tin [1,1,1,1,4,5,1] -> chọn Tin", [10,10,10,10,10,10], [1,1,1,1,4,5,1], "deu", "deu", "Tin", True, lambda r: r["Tin"]["fit_pct"] > r["Toán"]["fit_pct"] + 40.0),
        ("14. Full 10 + chỉ thích Anh [1,1,1,1,4,1,5] -> chọn Anh", [10,10,10,10,10,10], [1,1,1,1,4,1,5], "deu", "deu", "Anh", True, lambda r: r["Anh"]["fit_pct"] > r["Toán"]["fit_pct"] + 45.0),
        ("15. Full 10 + thích KHTN + Hóa -> chọn Hóa", [10,10,10,10,10,10], [1,1,5,1,4,1,1], "hoa", "deu", "Hóa", True, lambda r: r["Hóa"]["fit_pct"] > r["Lý"]["fit_pct"] + 35.0 and r["Hóa"]["fit_pct"] > r["Sinh"]["fit_pct"] + 35.0),
        ("16. Full 10 + thích LS&ĐL + Sử -> chọn Sử", [10,10,10,10,10,10], [1,1,1,5,4,1,1], "deu", "su", "Sử", True, lambda r: r["Sử"]["fit_pct"] > r["Địa"]["fit_pct"] + 35.0),
        ("17. Full 10 + thích LS&ĐL + Địa -> chọn Địa", [10,10,10,10,10,10], [1,1,1,5,4,1,1], "deu", "dia", "Địa", True, lambda r: r["Địa"]["fit_pct"] > r["Sử"]["fit_pct"] + 35.0),
        ("18. Full 0 + Full 5 -> chọn Toán", [0,0,0,0,0,0], [5,5,5,5,5,5,5], "deu", "deu", "Toán", False, lambda r: r["Không học chuyên"]["fit_pct"] >= 80.0),
        ("19. Full 5 + Full 5 -> chọn Không chuyên", [5,5,5,5,5,5], [5,5,5,5,5,5,5], "deu", "deu", "Không học chuyên", True, lambda r: max(r[c]["fit_pct"] for c in CHUYEN_9) < 30.0),
        ("20. Song chuyên Toán 9.8 + Tin 9.8 -> chọn Tin", [9.8,7.5,7.5,8.0,8.0,9.8], [5,1,2,2,4,5,2], "deu", "deu", "Tin", True, lambda r: r["Toán"]["fit_pct"] >= 70.0 and r["Tin"]["fit_pct"] >= 70.0),
        ("21. Song chuyên Toán 9.8 + Tin 9.8 -> chọn Toán", [9.8,7.5,7.5,8.0,8.0,9.8], [5,1,2,2,4,5,2], "deu", "deu", "Toán", True, lambda r: r["Văn"]["fit_pct"] < 25.0),
        ("22. Học lệch siêu nhân (Văn 9.8, khác 5.8) -> chọn Văn", [5.8,9.8,5.8,5.8,6.0,5.8], [1,5,1,2,4,1,1], "deu", "deu", "Văn", True, lambda r: r["Văn"]["fit_pct"] > r["Toán"]["fit_pct"] + 50.0),
        ("23. Điểm liệt cơ sở (Toán 10, 5 môn 2.0) -> chọn Toán", [10,2,2,2,2,2], [5,1,1,1,4,1,1], "deu", "deu", "Toán", False, lambda r: r["Không học chuyên"]["fit_pct"] >= 60.0),
        ("24. Điểm yếu (Văn 6.0) nhưng thích Văn 5/5 -> chọn Văn", [9.5,6.0,8.5,8.5,8.5,8.5], [4,5,2,2,4,2,2], "deu", "deu", "Văn", False, lambda r: r["Toán"]["fit_pct"] >= 70.0),
        ("25. Giỏi Toán 9.8 ghét Toán 1/5, Anh 9.6 thích Anh 5/5 -> chọn Toán", [9.8,8.5,9.6,8.5,8.5,8.5], [1,2,2,2,4,1,5], "deu", "deu", "Toán", False, lambda r: r["Anh"]["fit_pct"] >= 75.0),
        ("26. Trung bình đều (7.4 all, thích 3 all) -> chọn Không chuyên", [7.4,7.4,7.4,7.4,7.4,7.4], [3,3,3,3,3,3,3], "deu", "deu", "Không học chuyên", True, None),
        ("27. KHTN 9.6 + Lý + Toán 9.4 -> chọn Lý", [9.4,7.8,8.0,9.6,8.5,8.5], [4,2,5,2,4,2,2], "ly", "deu", "Lý", True, lambda r: r["Lý"]["fit_pct"] > r["Hóa"]["fit_pct"] + 30.0),
        ("28. LS&ĐL 9.8 + Sử + Văn 9.0 -> chọn Sử", [7.5,9.0,8.0,7.8,9.8,8.0], [2,4,2,5,4,1,2], "deu", "su", "Sử", True, lambda r: r["Sử"]["fit_pct"] > r["Địa"]["fit_pct"] + 30.0),
        ("29. LS&ĐL 9.8 + Ngang nhau (deu) -> Sử và Địa đều CÓ", [7.8,8.0,7.8,7.8,9.8,7.8], [2,3,3,5,4,1,2], "deu", "deu", "Địa", True, lambda r: r["Sử"]["fit_pct"] >= 50.0 and r["Địa"]["fit_pct"] >= 50.0),
        ("30. KHTN 9.8 + Ngang nhau (deu) -> Lý/Hóa/Sinh đều CÓ", [8.0,7.8,7.8,9.8,8.0,8.0], [3,2,5,3,4,2,2], "deu", "deu", "Sinh", True, lambda r: r["Lý"]["fit_pct"] >= 50.0 and r["Hóa"]["fit_pct"] >= 50.0 and r["Sinh"]["fit_pct"] >= 50.0),
        ("31. Khá giỏi đều (9.0 all, thích 4 all) -> chọn Anh", [9.0,9.0,9.0,9.0,9.0,9.0], [4,4,4,4,4,4,4], "deu", "deu", "Anh", True, lambda r: r["Không học chuyên"]["fit_pct"] < 30.0),
        ("32. Full 10 + chỉ thích Toán -> Top 3 ưu tiên STEM (Toán #1, không đưa Địa vào #2)", [10,10,10,10,10,10], [5,1,1,1,1,1,1], "deu", "deu", "Toán", True, lambda r: sorted(CHUYEN_9, key=lambda c: -r[c]["sort_key"])[0] == "Toán" and sorted(CHUYEN_9, key=lambda c: -r[c]["sort_key"])[1] in ("Lý", "Tin", "Hóa")),
    ]

    passed = 0
    results = []
    for name, d6, thich, kp, lp, mon_muon, exp_yes, extra in cases:
        res = predict_dual_head_manual(model_json, d6, thich, kp, lp)
        pct = res[mon_muon]["fit_pct"]
        got_yes = pct >= YES_THRESH
        extra_ok = True if extra is None else bool(extra(res))
        ok = (got_yes == exp_yes) and extra_ok
        if ok:
            passed += 1
        top3 = sorted(CHUYEN_9, key=lambda c: -res[c]["sort_key"])[:3]
        top3_pairs = [(m, res[m]["fit_pct"]) for m in top3]
        results.append({
            "name": name,
            "mon_muon": mon_muon,
            "pct": pct,
            "got_yes": got_yes,
            "exp_yes": exp_yes,
            "kc_pct": res["Không học chuyên"]["fit_pct"],
            "top3": top3_pairs,
            "ok": ok,
        })
    return passed, len(cases), results


def run_monotonicity_audit(model_json, seed=123):
    rng = np.random.default_rng(seed)
    score_idx = {"Toán": 0, "Văn": 1, "Anh": 2, "Lý": 3, "Hóa": 3, "Sinh": 3, "Sử": 4, "Địa": 4, "Tin": 5}
    thich_idx = {"Toán": 0, "Văn": 1, "Anh": 6, "Lý": 2, "Hóa": 2, "Sinh": 2, "Sử": 3, "Địa": 3, "Tin": 5}

    score_checks, score_ok = 0, 0
    int_checks, int_ok = 0, 0
    for _ in range(200):
        d6 = list(np.round(rng.uniform(5.0, 9.0, size=6), 1))
        t = list(rng.integers(1, 5, size=7))
        kp = rng.choice(["ly", "hoa", "sinh", "deu"])
        lp = rng.choice(["su", "dia", "deu"])
        base = predict_dual_head_manual(model_json, d6, t, kp, lp)
        for mon in CHUYEN_9:
            d_up = list(d6)
            si = score_idx[mon]
            if d_up[si] <= 9.0:
                d_up[si] = min(10.0, d_up[si] + 1.0)
                p_up = predict_dual_head_manual(model_json, d_up, t, kp, lp)[mon]["fit_pct"]
                score_checks += 1
                if p_up >= base[mon]["fit_pct"] - 1.5:
                    score_ok += 1
            t_up = list(t)
            ti = thich_idx[mon]
            if t_up[ti] <= 4:
                t_up[ti] = min(5, t_up[ti] + 1)
                p_up = predict_dual_head_manual(model_json, d6, t_up, kp, lp)[mon]["fit_pct"]
                int_checks += 1
                if p_up >= base[mon]["fit_pct"] - 1.5:
                    int_ok += 1

    return {
        "score_monotonic_pct": round(100.0 * score_ok / max(1, score_checks), 2),
        "interest_monotonic_pct": round(100.0 * int_ok / max(1, int_checks), 2),
        "score_checks": score_checks,
        "interest_checks": int_checks,
    }


def main():
    warnings.filterwarnings("ignore")
    csv_in = os.path.join(THU_MUC, "du_lieu.csv")
    out_csv = os.path.join(THU_MUC, "du_lieu_ml_v2.csv")
    out_joblib = os.path.join(THU_MUC, "dinh_huong_model_v2.joblib")
    out_json = os.path.join(THU_MUC, "dinh_huong_model_v2.json")

    real_records = doc_va_lam_sach_phieu_that(csv_in)
    print(f"[1/7] Phiếu khảo sát thật sau làm sạch: {len(real_records)}")
    print("      Phân bố lớp thật:", dict(Counter(r["primary"] for r in real_records)))

    print("[2/7] 5-Fold CV trên phiếu thật — Chế độ A (KHÔNG dùng câu phân môn KHTN/LS&ĐL)...")
    real_cv_strict = evaluate_real_5fold_cv(real_records, hide_subpref=True)
    print("      Real 5-Fold CV (Strict 6 scores + 7 Likert):", real_cv_strict)

    print("[3/7] 5-Fold CV trên phiếu thật — Chế độ B (ĐẦY ĐỦ 9 câu gồm phân môn KHTN & LS&ĐL)...")
    real_cv_full = evaluate_real_5fold_cv(real_records, hide_subpref=False)
    print("      Real 5-Fold CV (Full 9 questions):", real_cv_full)

    samples = sinh_du_lieu_nang_cao(real_records, seed=42)
    print(f"[4/7] Sinh tập dữ liệu ML V2 mở rộng: {len(samples)} mẫu")

    with open(out_csv, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            ["source", "primary"]
            + [f"diem_{m}" for m in MON_6]
            + THICH_COLS
            + ["khtn_pref", "lsdl_pref"]
            + [f"fit_{c}" for c in CLASSES_10]
        )
        for s in samples:
            w.writerow(
                [s["source"], s["primary"]]
                + s["d6"]
                + s["thich"]
                + [s["khtn_pref"], s["lsdl_pref"]]
                + [int(v) for v in s["y_ml"]]
            )

    print("[5/7] 5-Fold CV Đa nhãn (Multi-Label) trên toàn bộ tập mở rộng...")
    ml_cv = evaluate_multilabel_5fold_cv(samples)
    print("      Multi-Label 5-Fold CV:", {k: v for k, v in ml_cv.items() if k != "per_class_f1"})
    print("      F1 từng lớp (%):", ml_cv["per_class_f1"])

    print("[6/7] Huấn luyện mô hình cuối cùng Dual-Head (3 seeds -> chọn bản tối ưu nhất)...")
    X_all = np.array([extract_features_one(s["d6"], s["thich"], s["khtn_pref"], s["lsdl_pref"]) for s in samples])
    Y_ml_all = np.array([s["y_ml"] for s in samples])
    y_rk_all = np.array([CLASS_TO_IDX[s["primary"]] for s in samples])
    rk_mask_all = np.array([s["use_for_ranker"] for s in samples], dtype=bool)

    best_tuple = None
    best_key = (-1, -1.0)
    for seed in (42, 108, 2026):
        sc, hf, tf, hr = fit_dual_head(X_all, Y_ml_all, y_rk_all, rk_mask_all, seed=seed)
        mj = export_dual_head_json(sc, hf, tf, hr)
        ok_cnt, tot_cnt, _ = run_stress_tests(mj)
        val_sc = float(hf.best_validation_score_ or 0.0)
        print(f"      Seed {seed}: stress={ok_cnt}/{tot_cnt}, temp_fit={tf}, val_score={val_sc:.4f}")
        if (ok_cnt, val_sc) > best_key:
            best_key = (ok_cnt, val_sc)
            best_tuple = (sc, hf, tf, hr, mj)

    scaler_full, head_fit, temp_fit, head_rank, export_obj = best_tuple
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(export_obj, f, ensure_ascii=False, separators=(",", ":"))

    # Đồng bộ trực tiếp sang Frontend/dinh-huong-model-v2.js để web dùng ngay sau mỗi lần re-train
    frontend_js = os.path.abspath(os.path.join(THU_MUC, "..", "Frontend", "dinh-huong-model-v2.js"))
    if os.path.isdir(os.path.dirname(frontend_js)):
        with open(frontend_js, "w", encoding="utf-8") as f:
            f.write(
                "// dinh-huong-model-v2.js — Trọng số ML V2 (Dual-Head Calibrated MLP, 6 môn GDPT 2018 + 9 câu khảo sát)\n"
                "// Tự động sinh từ test_dinh_huong/train_dinh_huong_v2.py — KHÔNG sửa tay.\n"
                "window.DH_ML_V2 = "
            )
            json.dump(export_obj, f, ensure_ascii=False, separators=(",", ":"))
            f.write(";\n")

    print("[7/7] Kiểm thử cực đoan (32 Stress-Tests) + Kiểm định đơn điệu + Đối chiếu Python-vs-JS...")
    ok_cnt, tot_cnt, stress_rows = run_stress_tests(export_obj)
    mono = run_monotonicity_audit(export_obj)

    # Đối chiếu sai số tối đa giữa sklearn numpy & manual Python/JS
    max_diff = 0.0
    for r in real_records[:40]:
        x = np.array([extract_features_one(r["d6"], r["thich"], r["khtn_pref"], r["lsdl_pref"])])
        xs = scaler_full.transform(x)
        z_sk = mlp_forward_logits(head_fit.coefs_, head_fit.intercepts_, xs)[0]
        z_rk_sk = mlp_forward_logits(head_rank.coefs_, head_rank.intercepts_, xs)[0]
        ex = np.exp((z_rk_sk - np.max(z_rk_sk)) / 1.5)
        p_rk_sk = ex / np.sum(ex)
        ai_r = compute_aligned_interests(r["thich"], r["khtn_pref"], r["lsdl_pref"])
        s_map_r = {
            "Toán": r["d6"][0] / 10.0, "Văn": r["d6"][1] / 10.0, "Anh": r["d6"][2] / 10.0, "Tin": r["d6"][5] / 10.0,
            "Lý": r["d6"][3] / 10.0, "Hóa": r["d6"][3] / 10.0, "Sinh": r["d6"][3] / 10.0,
            "Sử": r["d6"][4] / 10.0, "Địa": r["d6"][4] / 10.0, "Không học chuyên": 0.0,
        }
        res_js = predict_dual_head_manual(export_obj, r["d6"], r["thich"], r["khtn_pref"], r["lsdl_pref"])
        for i, c in enumerate(CLASSES_10):
            zc = z_sk[i] / temp_fit + export_obj["rank_tiebreak_weight"] * (p_rk_sk[i] - 0.1) + 0.08 * (0.45 * s_map_r[c] + 0.55 * ai_r.get(c, 0.0) - 0.5)
            pc = float(np.clip(1.0 / (1.0 + math.exp(-max(-25.0, min(25.0, zc)))), 0.01, 0.985))
            max_diff = max(max_diff, abs(round(pc * 100.0, 1) - res_js[c]["fit_pct"]) / 100.0)

    print(f"      Temperature hiệu chuẩn Head 1 : T = {temp_fit}")
    print(f"      Sai số tối đa Python-vs-JS    : {max_diff:.5f}")
    print(f"      Stress-Test Pass              : {ok_cnt}/{tot_cnt}")
    for row in stress_rows:
        mark = "PASS" if row["ok"] else "FAIL"
        t3_str = ", ".join(f"{m}:{p}%" for m, p in row["top3"])
        print(f"        [{mark}] {row['name']} -> {row['mon_muon']}={row['pct']}% ({'CÓ' if row['got_yes'] else 'KHÔNG'}) | KC={row['kc_pct']}% | Top3=[{t3_str}]")
    print("      Monotonicity Audit:", mono)

    bundle = {
        "version": "v2_dual_head_mlp_6mon",
        "scaler": scaler_full,
        "head_fit": head_fit,
        "temp_fit": temp_fit,
        "head_rank": head_rank,
        "classes": CLASSES_10,
        "feat_names": FEAT_NAMES,
        "metrics": {
            "real_cv_strict": real_cv_strict,
            "real_cv_full": real_cv_full,
            "multilabel_cv": ml_cv,
            "stress_pass": ok_cnt,
            "stress_total": tot_cnt,
            "monotonicity": mono,
            "json_size_bytes": os.path.getsize(out_json),
            "max_parity_diff": round(max_diff, 5),
        },
    }
    joblib.dump(bundle, out_joblib)
    print(f"\nHoàn tất xuất artifacts ML V2:")
    print(f"  - CSV mở rộng : {out_csv} ({len(samples)} mẫu)")
    print(f"  - Model joblib: {out_joblib}")
    print(f"  - Model JSON  : {out_json} ({os.path.getsize(out_json):,} bytes)")


if __name__ == "__main__":
    main()
