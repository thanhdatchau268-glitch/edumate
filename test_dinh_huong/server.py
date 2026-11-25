# -*- coding: utf-8 -*-
"""
server.py - Server test độc lập (cổng 5050) cho hệ thống Định hướng môn chuyên:
  6 đầu điểm GDPT 2018 (Toán, Văn, Anh, KHTN, KHXH, Tin)
  + Khảo sát rẽ nhánh thích ứng 15 câu (Ngân hàng 34 câu / 5 tầng)
  + Phân rã Laplace KHTN/KHXH (40% Học bạ + 60% Khảo sát) kết hợp ML 137 phiếu thực tế.
"""
import os
import socket
import warnings

import joblib
import numpy as np
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from ngan_hang_cau_hoi import (
    CHUYEN_9_MON,
    MAX_POSSIBLE,
    QUESTION_BANK,
    TANG_MO_TA,
    cham_diem_re_nhanh,
)

THU_MUC = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(THU_MUC, "dinh_huong_model.joblib")

MON_6 = ["toan", "van", "anh", "khtn", "khxh", "tin"]
TEN_MON_6 = {
    "toan": "Toán",
    "van": "Văn",
    "anh": "Tiếng Anh",
    "khtn": "KHTN (Lý-Hóa-Sinh)",
    "khxh": "KHXH (Sử-Địa)",
    "tin": "Tin học",
}

app = Flask(__name__, static_folder=THU_MUC)
CORS(app)

_CACHE = {"mtime": None, "bundle": None}


def get_bundle():
    mtime = os.path.getmtime(MODEL_PATH)
    if _CACHE["bundle"] is None or _CACHE["mtime"] != mtime:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            b = joblib.load(MODEL_PATH)
        _CACHE["bundle"] = b
        _CACHE["mtime"] = mtime
    return _CACHE["bundle"]


def get_metrics(bundle):
    return {
        k: (float(v) if isinstance(v, (np.floating, float)) else int(v))
        for k, v in bundle.get("metrics", {}).items()
    }


def chuan_hoa_6_diem(diem_raw: dict) -> dict[str, float]:
    parsed = {}
    for k in MON_6:
        val = diem_raw.get(k)
        if val is None or str(val).strip() == "":
            if k == "tin":
                parsed[k] = None
            else:
                raise ValueError(f"Vui lòng nhập đầy đủ điểm 6 môn (thiếu {TEN_MON_6[k]}).")
        else:
            num = float(str(val).replace(",", "."))
            if not (0.0 <= num <= 10.0):
                raise ValueError(f"Điểm {TEN_MON_6[k]} phải nằm trong khoảng 0 đến 10.")
            parsed[k] = num

    if parsed["tin"] is None:
        parsed["tin"] = round(0.7 * parsed["toan"] + 0.3 * parsed["khtn"], 2)
    return parsed


def tao_dac_trung_ml_6(d: dict[str, float], feat_cols: list[str]) -> np.ndarray:
    vals = [d[k] for k in MON_6]
    mean_6 = sum(vals) / 6.0
    fmap = {
        "mean_6": mean_6,
        "max_6": max(vals),
        "min_6": min(vals),
        "chenh_khtn_khxh": d["khtn"] - d["khxh"],
        "toan_vs_khtn": d["toan"] - d["khtn"],
        "tin_vs_toan": d["tin"] - d["toan"],
    }
    for k in MON_6:
        fmap[f"diem_{k}"] = d[k]
        fmap[f"diff_diem_{k}"] = d[k] - mean_6
    return np.array([[fmap[c] for c in feat_cols]], dtype=float)


def tinh_academic_va_boc_tach(d: dict[str, float], raw_scores: dict[str, float]) -> tuple[dict[str, float], dict[str, float]]:
    """
    Phần 4.1 & 4.2: Quy đổi thang 100 & bóc tách KHTN (Lý-Hóa-Sinh), KHXH (Sử-Địa)
    bằng làm mượt Laplace (epsilon = 1.0), hệ số phóng đại giới hạn trong [0.4, 1.5].
    """
    eps = 1.0
    he_so = {}

    sum_khtn = raw_scores["Lý"] + raw_scores["Hóa"] + raw_scores["Sinh"] + 3.0 * eps
    sum_khxh = raw_scores["Sử"] + raw_scores["Địa"] + 2.0 * eps

    acad = {
        "Toán": min(100.0, d["toan"] * 10.0),
        "Tin": min(100.0, d["tin"] * 10.0),
        "Văn": min(100.0, d["van"] * 10.0),
        "Anh": min(100.0, d["anh"] * 10.0),
    }
    for m in ("Toán", "Tin", "Văn", "Anh"):
        he_so[m] = 1.0

    for m in ("Lý", "Hóa", "Sinh"):
        ratio = (raw_scores[m] + eps) / sum_khtn
        mult = max(0.4, min(1.5, 3.0 * ratio))
        he_so[m] = round(mult, 2)
        acad[m] = min(100.0, (d["khtn"] * 10.0) * mult)

    for m in ("Sử", "Địa"):
        ratio = (raw_scores[m] + eps) / sum_khxh
        mult = max(0.4, min(1.5, 2.0 * ratio))
        he_so[m] = round(mult, 2)
        acad[m] = min(100.0, (d["khxh"] * 10.0) * mult)

    return acad, he_so


@app.route("/")
def index():
    return send_from_directory(THU_MUC, "index.html")


@app.route("/api/info", methods=["GET"])
def info():
    bundle = get_bundle()
    return jsonify({
        "success": True,
        "classes": bundle["classes"],
        "metrics": get_metrics(bundle),
        "so_dac_trung": len(bundle["feat_cols"]),
        "chuyen_9_mon": CHUYEN_9_MON,
        "max_possible": MAX_POSSIBLE,
        "tang_mo_ta": TANG_MO_TA,
        "question_bank": QUESTION_BANK,
    })


@app.route("/api/du-doan", methods=["POST"])
def du_doan():
    data = request.get_json(silent=True) or {}
    diem_raw = data.get("diem") or {}
    answers = data.get("answers") or []

    try:
        d6 = chuan_hoa_6_diem(diem_raw)
        raw_scores, survey_norm, phase_scores, _ = cham_diem_re_nhanh(answers)
    except (ValueError, TypeError) as err:
        return jsonify({"success": False, "message": str(err)}), 400

    acad, he_so = tinh_academic_va_boc_tach(d6, raw_scores)
    score_doc = {
        m: 0.40 * acad[m] + 0.60 * survey_norm[m]
        for m in CHUYEN_9_MON
    }

    bundle = get_bundle()
    classes = bundle["classes"]
    vec = tao_dac_trung_ml_6(d6, bundle["feat_cols"])
    vec_scaled = bundle["scaler"].transform(vec)
    ml_probs_arr = bundle["model"].predict_proba(vec_scaled)[0]
    ml_map = {cls: float(ml_probs_arr[i]) for i, cls in enumerate(classes)}

    ml_9_max = max(ml_map.get(m, 0.0) for m in CHUYEN_9_MON) or 1.0
    ml_9_norm = {m: (ml_map.get(m, 0.0) / ml_9_max) * 100.0 for m in CHUYEN_9_MON}

    # Kết hợp 78% Mô hình 2 tầng rẽ nhánh (40% Học bạ bóc tách + 60% 15 câu) + 22% ML 6 môn (137 phiếu)
    ket_qua = []
    for m in CHUYEN_9_MON:
        sc_final = 0.78 * score_doc[m] + 0.22 * ml_9_norm[m]
        ly_do = []
        if m in ("Lý", "Hóa", "Sinh"):
            ly_do.append(f"Học bạ KHTN {d6['khtn']:.1f} × hệ số bóc tách {he_so[m]} → {acad[m]:.1f}/100")
        elif m in ("Sử", "Địa"):
            ly_do.append(f"Học bạ KHXH {d6['khxh']:.1f} × hệ số bóc tách {he_so[m]} → {acad[m]:.1f}/100")
        else:
            key_g = {"Toán": "toan", "Tin": "tin", "Văn": "van", "Anh": "anh"}[m]
            ly_do.append(f"Điểm học bạ {m}: {d6[key_g]:.1f}/10 → {acad[m]:.1f}/100")
        ly_do.append(f"Khảo sát 15 câu: {int(raw_scores[m])}/{MAX_POSSIBLE[m]} điểm thô ({survey_norm[m]:.1f}%)")
        ly_do.append(f"Ủng hộ từ ML (137 phiếu thực tế): {ml_map.get(m, 0.0) * 100:.1f}%")

        ket_qua.append({
            "mon": m,
            "diem_tong_hop": round(sc_final, 1),
            "xac_suat": round(sc_final, 1),
            "diem_doc": round(score_doc[m], 1),
            "academic": round(acad[m], 1),
            "survey_norm": round(survey_norm[m], 1),
            "raw_khao_sat": int(raw_scores[m]),
            "max_khao_sat": MAX_POSSIBLE[m],
            "he_so_boc_tach": he_so[m],
            "ml_pct": round(ml_map.get(m, 0.0) * 100, 1),
            "ly_do": ly_do,
        })

    # Quy tắc phá vỡ hòa điểm Phần 4.4: ưu tiên tổng hợp -> survey_norm -> academic
    ket_qua.sort(
        key=lambda x: (x["diem_tong_hop"], x["survey_norm"], x["academic"]),
        reverse=True,
    )

    mean_6 = round(sum(d6[k] for k in MON_6) / 6.0, 2)
    dai_tra_pct = round(ml_map.get("Không học chuyên", 0.0) * 100, 1)
    goi_y_dai_tra = bool(dai_tra_pct >= 35.0 or mean_6 < 7.5)

    return jsonify({
        "success": True,
        "che_do": "full-hybrid-branching",
        "top3": ket_qua[:3],
        "tat_ca": ket_qua,
        "tom_tat": {
            "mean_6": mean_6,
            "diem_6": d6,
            "dai_tra_pct": dai_tra_pct,
            "goi_y_dai_tra": goi_y_dai_tra,
            "raw_scores": raw_scores,
            "phase_scores": phase_scores,
        },
        "metrics": get_metrics(bundle),
    })


if __name__ == "__main__":
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("127.0.0.1", 5050)) == 0:
            print("LOI: Cong 5050 dang co server cu chay ngam o mot tab terminal khac!")
            print("Hay tat het cac tab terminal 'py' (hoac chay: taskkill /F /IM python.exe) roi chay lai: py server.py")
            raise SystemExit(1)
    b = get_bundle()
    m = get_metrics(b)
    print("=== Trang test định hướng môn chuyên (6 môn + Rẽ nhánh 15 câu + ML) ===")
    print(f"=== Chạy tại: http://127.0.0.1:5050 | Model: {m.get('so_phieu')} phiếu / {m.get('so_mau_sau_nang')} mẫu ===")
    app.run(host="127.0.0.1", port=5050, debug=False)
