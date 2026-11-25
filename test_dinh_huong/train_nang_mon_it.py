# -*- coding: utf-8 -*-
"""
train_nang_mon_it.py - Làm sạch du_lieu.csv + Chuẩn hóa 6 đầu điểm GDPT 2018
(Toán, Văn, Anh, KHTN, KHXH, Tin) + Mở rộng cân bằng 10 lớp để kết hợp cùng
bài khảo sát rẽ nhánh 15 câu.

Xuất ra:
  1. du_lieu_mo_rong.csv    (bộ 6 môn chuẩn GDPT 2018 sau làm sạch + mở rộng)
  2. dinh_huong_model.joblib (mô hình VotingClassifier LR + RF + ExtraTrees nạp vào server.py)
"""
import csv
import os
import sys
import warnings

import joblib
import numpy as np
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler

THU_MUC = os.path.dirname(os.path.abspath(__file__))

MON_6 = ["toan", "van", "anh", "khtn", "khxh", "tin"]
DIEM_COLS_6 = [f"diem_{m}" for m in MON_6]
DIEM_COLS_RAW9 = ["toan", "van", "anh", "ly", "hoa", "sinh", "su", "dia", "tin"]
THICH_COLS = [f"thich_{i}" for i in range(1, 8)]

DANH_SACH_10_LOP = [
    "Anh", "Địa", "Hóa", "Không học chuyên", "Lý", "Sinh", "Sử", "Tin", "Toán", "Văn"
]

FEAT_COLS = (
    DIEM_COLS_6
    + [f"diff_{c}" for c in DIEM_COLS_6]
    + [
        "mean_6",
        "max_6",
        "min_6",
        "chenh_khtn_khxh",
        "toan_vs_khtn",
        "tin_vs_toan",
    ]
)


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


def doc_va_lam_sach_csv_6_mon(csv_path):
    """
    Đọc du_lieu.csv, sửa lỗi nhập phẩy thập phân, lọc spam, áp dụng chon_lai Bước 4,
    và quy đổi về đúng 6 đầu điểm GDPT 2018:
      diem_khtn = TB(Lý, Hóa, Sinh), diem_khxh = TB(Sử, Địa)
    """
    X_raw, y = [], []
    seen = set()

    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            nhan = (row.get("mon_chuyen") or "").strip()
            if not nhan:
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

            # Lọc dòng spam (toàn 10 điểm và sở thích <= 2)
            if min(diem9) == 10.0 and max(thich) <= 2.0:
                continue

            hl = parse_float(row.get("hai_long"))
            dt = parse_float(row.get("diem_thi_chuyen"))
            chon_lai = (row.get("chon_lai") or "").strip()
            if chon_lai in DANH_SACH_10_LOP and chon_lai != "Không học chuyên":
                if (hl is not None and hl <= 2) or (dt is not None and dt < 4.0):
                    nhan = chon_lai

            # Quy đổi sang 6 đầu điểm GDPT 2018: Toán, Văn, Anh, KHTN, KHXH, Tin
            khtn = round((diem9[3] + diem9[4] + diem9[5]) / 3.0, 2)
            khxh = round((diem9[6] + diem9[7]) / 2.0, 2)
            diem6 = [diem9[0], diem9[1], diem9[2], khtn, khxh, diem9[8]]

            key = (nhan, tuple(round(v, 2) for v in diem6))
            if key in seen:
                continue
            seen.add(key)

            X_raw.append(diem6)
            y.append(nhan)

    return np.array(X_raw, dtype=float), np.array(y)


def tao_dac_trung_6_mon(X_diem6):
    """Từ (N, 6) gồm [toan, van, anh, khtn, khxh, tin] -> (N, 18) đặc trưng."""
    mean_6 = X_diem6.mean(axis=1, keepdims=True)
    max_6 = X_diem6.max(axis=1, keepdims=True)
    min_6 = X_diem6.min(axis=1, keepdims=True)
    diff = X_diem6 - mean_6
    chenh_khtn_khxh = X_diem6[:, 3:4] - X_diem6[:, 4:5]
    toan_vs_khtn = X_diem6[:, 0:1] - X_diem6[:, 3:4]
    tin_vs_toan = X_diem6[:, 5:6] - X_diem6[:, 0:1]

    return np.hstack([
        X_diem6,
        diff,
        mean_6,
        max_6,
        min_6,
        chenh_khtn_khxh,
        toan_vs_khtn,
        tin_vs_toan,
    ])


def sinh_mau_6_mon_theo_lop(mon: str, so_luong: int, rng: np.random.Generator) -> np.ndarray:
    """Sinh hồ sơ 6 đầu điểm GDPT 2018 sát thực tế cho từng môn."""
    mau_list = []
    for _ in range(so_luong):
        base = rng.uniform(7.8, 9.0)
        d = np.clip(rng.normal(base, 0.42, size=6), 6.6, 9.6)
        # d: 0=toan, 1=van, 2=anh, 3=khtn, 4=khxh, 5=tin
        d[4] = np.clip(d[4] + rng.uniform(0.2, 0.5), 7.2, 9.8)
        d[5] = np.clip(d[5] + rng.uniform(0.1, 0.4), 7.2, 9.7)

        if mon == "Toán":
            d[0] = rng.uniform(9.2, 10.0)
            d[3] = np.clip(d[0] - rng.uniform(0.1, 0.6), 8.2, 9.7)
            d[5] = np.clip(d[0] - rng.uniform(0.1, 0.7), 8.2, 9.6)
        elif mon == "Tin":
            d[5] = rng.uniform(9.3, 10.0)
            d[0] = np.clip(d[5] - rng.uniform(0.0, 0.5), 8.5, 9.7)
            d[1] = np.clip(d[1] - rng.uniform(0.2, 0.8), 6.8, 8.7)
        elif mon == "Anh":
            d[2] = rng.uniform(9.2, 10.0)
            d[1] = np.clip(d[2] - rng.uniform(0.2, 0.8), 7.8, 9.4)
        elif mon == "Văn":
            d[1] = rng.uniform(9.0, 9.8)
            d[4] = np.clip(d[1] + rng.uniform(0.0, 0.6), 8.6, 9.9)
            d[0] = np.clip(d[1] - rng.uniform(0.2, 1.0), 7.3, 9.2)
        elif mon == "Lý":
            d[3] = rng.uniform(9.0, 9.9)
            d[0] = np.clip(d[3] - rng.uniform(0.0, 0.5), 8.5, 9.7)
        elif mon == "Hóa":
            d[3] = rng.uniform(9.0, 9.9)
            d[0] = np.clip(d[3] - rng.uniform(0.2, 0.7), 8.2, 9.5)
        elif mon == "Sinh":
            d[3] = rng.uniform(8.9, 9.8)
            d[0] = np.clip(d[3] - rng.uniform(0.3, 0.9), 7.9, 9.3)
        elif mon == "Sử":
            d[4] = rng.uniform(9.2, 10.0)
            d[1] = np.clip(d[4] - rng.uniform(0.3, 0.9), 8.1, 9.4)
            d[0] = np.clip(d[0] - rng.uniform(0.2, 0.8), 7.0, 8.9)
        elif mon == "Địa":
            d[4] = rng.uniform(9.2, 10.0)
            d[0] = np.clip(d[0] - rng.uniform(0.1, 0.6), 7.5, 9.1)
        elif mon == "Không học chuyên":
            base_kc = rng.uniform(6.6, 8.3)
            d = np.clip(rng.normal(base_kc, 0.42, size=6), 5.5, 8.7)
            d[4] = np.clip(d[4] + 0.25, 6.2, 9.0)

        mau_list.append(np.round(d, 1))
    return np.array(mau_list, dtype=float)


def mo_rong_du_lieu_can_bang(X_raw, y_str, muc_moi_lop=90, seed=42):
    rng = np.random.default_rng(seed)
    X_all, y_all = [X_raw], [y_str]

    for mon in DANH_SACH_10_LOP:
        idx = np.where(y_str == mon)[0]
        cnt = len(idx)
        if cnt >= muc_moi_lop:
            continue

        can_them = muc_moi_lop - cnt
        so_smote = int(can_them * 0.40) if cnt >= 2 else 0
        so_chuan = can_them - so_smote

        if so_smote > 0:
            X_cls = X_raw[idx]
            smote_arr = np.zeros((so_smote, X_raw.shape[1]), dtype=float)
            for i in range(so_smote):
                a = X_cls[rng.integers(0, cnt)]
                dists = np.linalg.norm(X_cls - a, axis=1)
                nn_idx = np.argsort(dists)[1 : min(4, cnt)]
                b = X_cls[rng.choice(nn_idx)] if len(nn_idx) > 0 else a
                mau = a + rng.uniform(0.2, 0.8) * (b - a)
                mau = np.round(np.clip(mau + rng.normal(0.0, 0.12, size=6), 0.0, 10.0), 1)
                smote_arr[i] = mau
            X_all.append(smote_arr)
            y_all.append(np.full(so_smote, mon, dtype=object))

        if so_chuan > 0:
            chuan_arr = sinh_mau_6_mon_theo_lop(mon, so_chuan, rng)
            X_all.append(chuan_arr)
            y_all.append(np.full(so_chuan, mon, dtype=object))

    return np.vstack(X_all), np.concatenate(y_all)


def luu_csv_mo_rong(X_raw, y_str, out_csv):
    with open(out_csv, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["mon_chuyen"] + DIEM_COLS_6)
        for row, mon in zip(X_raw, y_str):
            writer.writerow([mon] + [f"{v:.1f}".replace(".", ",") for v in row])


def tao_model():
    lr = LogisticRegression(
        C=0.45, max_iter=1000, class_weight="balanced", random_state=42
    )
    rf = RandomForestClassifier(
        n_estimators=220, max_depth=8, min_samples_leaf=2,
        class_weight="balanced_subsample", random_state=42
    )
    et = ExtraTreesClassifier(
        n_estimators=220, max_depth=8, min_samples_leaf=2,
        class_weight="balanced", random_state=42
    )
    return VotingClassifier(
        estimators=[("lr", lr), ("rf", rf), ("et", et)],
        voting="soft",
    )


def danh_gia_va_train(
    csv_path,
    out_joblib="dinh_huong_model.joblib",
    out_csv_mo_rong="du_lieu_mo_rong.csv",
    muc_moi_lop=90,
):
    X_real, y_real = doc_va_lam_sach_csv_6_mon(csv_path)
    X_exp, y_exp_str = mo_rong_du_lieu_can_bang(X_real, y_real, muc_moi_lop=muc_moi_lop, seed=42)
    luu_csv_mo_rong(X_exp, y_exp_str, out_csv_mo_rong)

    le = LabelEncoder()
    y_exp = le.fit_transform(y_exp_str)
    classes = le.classes_.tolist()

    # Đánh giá trên 10 lớp và trên 7 nhóm độc lập (do Lý/Hóa/Sinh chung KHTN, Sử/Địa chung KHXH)
    MACRO_MAP = {
        "Toán": "Toán", "Tin": "Tin", "Văn": "Văn", "Anh": "Anh",
        "Lý": "KHTN", "Hóa": "KHTN", "Sinh": "KHTN",
        "Sử": "KHXH", "Địa": "KHXH", "Không học chuyên": "Không học chuyên",
    }

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    top1_nhom_ok, top3_ok, tong = 0, 0, 0
    X_feat_all = tao_dac_trung_6_mon(X_exp)

    for tr_i, te_i in skf.split(X_feat_all, y_exp):
        scaler = StandardScaler()
        X_tr_s = scaler.fit_transform(X_feat_all[tr_i])
        X_te_s = scaler.transform(X_feat_all[te_i])

        clf = tao_model()
        clf.fit(X_tr_s, y_exp[tr_i])
        probs = clf.predict_proba(X_te_s)

        top1 = np.argmax(probs, axis=1)
        top3 = np.argsort(probs, axis=1)[:, -3:]
        for p1, t3, yt in zip(top1, top3, y_exp[te_i]):
            if MACRO_MAP[classes[p1]] == MACRO_MAP[classes[yt]]:
                top1_nhom_ok += 1
            if yt in t3:
                top3_ok += 1
            tong += 1

    top1_nhom_acc = round(100.0 * top1_nhom_ok / tong, 1)
    top3_acc = round(100.0 * top3_ok / tong, 1)

    print(f"Số phiếu gốc sau làm sạch (6 môn): {len(y_real)} -> Mở rộng cân bằng: {len(y_exp)} mẫu")
    print(f"5-Fold CV Model ML 6 môn -> Đúng nhóm (Toán/Tin/Văn/Anh/KHTN/KHXH/ĐTrà): {top1_nhom_acc}% | Top-3: {top3_acc}%")

    scaler_full = StandardScaler()
    X_full_s = scaler_full.fit_transform(X_feat_all)
    model_full = tao_model()
    model_full.fit(X_full_s, y_exp)

    bundle = {
        "model": model_full,
        "scaler": scaler_full,
        "feat_cols": FEAT_COLS,
        "classes": classes,
        "mode": "6mon_gdpt2018",
        "metrics": {
            "so_phieu": int(len(y_real)),
            "so_mau_sau_nang": int(len(y_exp)),
            "top1_nhom": top1_nhom_acc,
            "top3": top3_acc,
        },
    }
    joblib.dump(bundle, out_joblib)
    print(f"Đã lưu model 6 môn: {out_joblib}")
    print(f"Đã lưu CSV 6 môn  : {out_csv_mo_rong}")


if __name__ == "__main__":
    warnings.filterwarnings("ignore")
    csv_in = sys.argv[1] if len(sys.argv) > 1 else os.path.join(THU_MUC, "du_lieu.csv")
    out_file = sys.argv[2] if len(sys.argv) > 2 else os.path.join(THU_MUC, "dinh_huong_model.joblib")
    out_csv = os.path.join(THU_MUC, "du_lieu_mo_rong.csv")
    danh_gia_va_train(csv_in, out_file, out_csv, muc_moi_lop=90)
