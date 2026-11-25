# -*- coding: utf-8 -*-
"""
muc_tieu.py — API Đo Độ Sẵn Sàng Mục Tiêu Trường & Năng Lực Môn Chuyên Tự Động (V30)

Tự tổng hợp trực tiếp từ 3 nguồn dữ liệu thật trong SQLite:
  1. Tiến độ Bài tập (da_lam + Backend/Dap_an/<mon>/)
  2. Sổ lỗi sai (ky_nang_user + so_loi)
  3. Kết quả Khoa cử (kb_ket_qua + kb_ky)

Endpoint:
  GET /api/muc-tieu/san-sang/<int:user_id>[?mon_chuyen=ly]
"""
import json
import os
import sqlite3
from datetime import date

from flask import Blueprint, jsonify, request

from db_ops import DB_PATH

muc_tieu_bp = Blueprint("muc_tieu", __name__)

GOC = os.path.dirname(os.path.abspath(__file__))
THU_MUC_DAP_AN = os.path.join(GOC, "..", "Dap_an")

# Ánh xạ mã môn chuyên -> thư mục bài tập tương ứng trong Backend/Dap_an/
MON_CHUYEN_TO_SLUG = {
    "ly": "vat_ly",
    "toan": "chuyen_toan",
    "dia": "chuyen_dia",
}

TEN_CHUYEN_MAP = {
    "toan": "Chuyên Toán",
    "ly": "Chuyên Vật Lý",
    "hoa": "Chuyên Hóa Học",
    "sinh": "Chuyên Sinh Học",
    "van": "Chuyên Ngữ Văn",
    "anh": "Chuyên Tiếng Anh",
    "su": "Chuyên Lịch Sử",
    "dia": "Chuyên Địa Lí",
    "tin": "Chuyên Tin Học",
}

TEN_SLUG_MAP = {
    "toan": "Toán",
    "ngu_van": "Ngữ văn",
    "vat_ly": "Vật lí",
    "chuyen_toan": "Chuyên Toán",
    "chuyen_dia": "Chuyên Địa lí",
}

_TONG_BAI_CACHE = {}


def _dem_tong_bai(slug):
    """Đếm tổng số bài tập nhỏ (bai_id) trong Backend/Dap_an/<slug>/ (có cache)."""
    if not slug:
        return 0
    if slug in _TONG_BAI_CACHE:
        return _TONG_BAI_CACHE[slug]

    thu_muc = os.path.join(THU_MUC_DAP_AN, slug)
    if not os.path.isdir(thu_muc):
        _TONG_BAI_CACHE[slug] = 0
        return 0

    tong = 0
    for chuong in os.listdir(thu_muc):
        p_chuong = os.path.join(thu_muc, chuong)
        if not os.path.isdir(p_chuong):
            continue
        for ten_file in os.listdir(p_chuong):
            if not ten_file.endswith(".json"):
                continue
            try:
                with open(os.path.join(p_chuong, ten_file), encoding="utf-8") as f:
                    dap_an = json.load(f)
                if isinstance(dap_an, dict):
                    tong += len(dap_an)
            except (OSError, ValueError):
                continue

    _TONG_BAI_CACHE[slug] = tong
    return tong


def _bang_ton_tai(conn, ten_bang):
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?", (ten_bang,)
    ).fetchone()
    return row is not None


def _rut_ten_ngan(bai_key):
    """Lấy tên bài dễ đọc từ so_loi._ten_ky_nang (fallback an toàn nếu lỗi import)."""
    try:
        from so_loi import _ten_ky_nang
        info = _ten_ky_nang(bai_key)
        ten = info.get("ten") or bai_key
        if len(ten) > 30:
            ten = ten[:29].rstrip() + "…"
        return ten
    except Exception:
        parts = str(bai_key).split("/")
        return parts[-1] if parts else str(bai_key)


def _thong_ke_bai_tap(rows_da_lam, slug):
    """Thống kê độ phủ & điểm trung bình (thang 10) cho 1 môn slug."""
    tong_bai = _dem_tong_bai(slug)
    prefix = f"{slug}/"
    matched = [max(0, min(100, int(pct or 0))) for key, pct in rows_da_lam if str(key).startswith(prefix)]
    bai_da_lam = len(matched)
    bai_dat = sum(1 for p in matched if p >= 70)
    do_phu = round(min(1.0, bai_dat / max(1, tong_bai)), 4) if tong_bai > 0 else 0.0
    diem_bt_10 = round((sum(matched) / bai_da_lam) / 10.0, 2) if bai_da_lam > 0 else None
    return {
        "slug": slug,
        "ten": TEN_SLUG_MAP.get(slug, slug),
        "tong_bai": tong_bai,
        "bai_da_lam": bai_da_lam,
        "bai_dat": bai_dat,
        "do_phu": do_phu,
        "diem_bt_10": diem_bt_10,
    }


def _thong_ke_so_loi(kn_rows, sl_rows, hom_nay, slug_loc=None, bai_da_lam_cua_nhom=0):
    """Tổng hợp Sổ lỗi sai toàn cục hoặc lọc riêng theo 1 môn slug."""
    prefix = f"{slug_loc}/" if slug_loc else None

    kn_list = [r for r in kn_rows if (not prefix or str(r["bai_key"]).startswith(prefix))]
    sl_list = [r for r in sl_rows if (not prefix or str(r["bai_key"]).startswith(prefix))]

    tong_kn = len(kn_list)
    kn_thong_thao = sum(1 for r in kn_list if int(r["muc"] or 0) >= 3)
    the_den_han = sum(1 for r in kn_list if r["ngay_on_ke"] and str(r["ngay_on_ke"]) <= hom_nay)
    tong_loi = len(sl_list)
    loi_chua_hieu = sum(1 for r in sl_list if int(r["da_hieu"] or 0) == 0)

    # Tìm kỹ năng ưu tiên nhất để gợi ý hành động
    loi_theo_key = {}
    for r in sl_list:
        if int(r["da_hieu"] or 0) == 0:
            loi_theo_key[r["bai_key"]] = loi_theo_key.get(r["bai_key"], 0) + 1

    bai_goi_y = None
    if kn_list:
        kn_sorted = sorted(
            kn_list,
            key=lambda r: (
                not (r["ngay_on_ke"] and str(r["ngay_on_ke"]) <= hom_nay),
                -(loi_theo_key.get(r["bai_key"], 0)),
                int(r["muc"] or 0),
                str(r["bai_key"]),
            ),
        )
        top = kn_sorted[0]
        if (top["ngay_on_ke"] and str(top["ngay_on_ke"]) <= hom_nay) or loi_theo_key.get(top["bai_key"], 0) > 0:
            bai_goi_y = {
                "bai_key": top["bai_key"],
                "ten_ngan": _rut_ten_ngan(top["bai_key"]),
                "loi_chua_hieu": loi_theo_key.get(top["bai_key"], 0),
            }

    if tong_loi == 0 and tong_kn == 0:
        # Chưa có lỗi sai nào: chỉ cho 1.0 nếu đã thực sự làm >= 3 bài, ngược lại giữ mức khởi động 0.50
        ty_le_sach_loi = 1.0 if bai_da_lam_cua_nhom >= 3 else 0.50
    else:
        phan_loi = max(0.0, 1.0 - loi_chua_hieu / max(1, tong_loi + 2))
        phan_kn = kn_thong_thao / max(1, tong_kn)
        ty_le_sach_loi = round(max(0.0, min(1.0, 0.6 * phan_loi + 0.4 * phan_kn)), 4)

    return {
        "tong_kn": tong_kn,
        "kn_thong_thao": kn_thong_thao,
        "the_den_han": the_den_han,
        "tong_loi": tong_loi,
        "loi_chua_hieu": loi_chua_hieu,
        "ty_le_sach_loi": ty_le_sach_loi,
        "bai_goi_y": bai_goi_y,
    }


def _tao_goi_y(so_loi_stat, bt_target, so_ky_da_thi, la_chuyen=False):
    """Tạo đúng 1 dòng gợi ý hành động bấm được (Ý 3 V30)."""
    can_va = max(so_loi_stat["the_den_han"], so_loi_stat["loi_chua_hieu"])
    if can_va > 0 and so_loi_stat["bai_goi_y"]:
        g = so_loi_stat["bai_goi_y"]
        return {
            "loai": "so_loi",
            "text": f"⚡ Vá {can_va} thẻ Sổ lỗi ({g['ten_ngan']}) (+2%)",
            "href": f"so-loi.html?key={g['bai_key']}",
        }

    if bt_target and bt_target["tong_bai"] > 0 and bt_target["do_phu"] < 0.75:
        slug_url = bt_target["slug"].replace("_", "-")
        return {
            "loai": "bai_tap",
            "text": f"📘 Luyện thêm 2 bài {bt_target['ten']} mở trần (+3%)",
            "href": f"problems.html?subject={slug_url}",
        }

    if so_ky_da_thi == 0:
        return {
            "loai": "khoa_cu",
            "text": "🏆 Thi 1 kỳ Thi Hương để mở trần (+5%)",
            "href": "khoa-bang.html",
        }

    if la_chuyen and (not bt_target or bt_target["tong_bai"] == 0):
        return {
            "loai": "khoa_cu",
            "text": "🏆 Tham gia Khoa cử bảng chuyên (+4%)",
            "href": "khoa-bang.html",
        }

    return {
        "loai": "duy_tri",
        "text": "✨ Giữ phong độ luyện tập mỗi ngày",
        "href": "subjects.html",
    }


@muc_tieu_bp.route("/api/muc-tieu/san-sang/<int:user_id>", methods=["GET"])
def api_muc_tieu_san_sang(user_id):
    if user_id <= 0:
        return jsonify({"success": False, "message": "ID người dùng không hợp lệ!"}), 400

    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.row_factory = sqlite3.Row
    try:
        user = conn.execute(
            "SELECT id, username, mon_chuyen FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not user:
            return jsonify({"success": False, "message": "Không tìm thấy người dùng!"}), 404

        mon_chuyen = (request.args.get("mon_chuyen") or user["mon_chuyen"] or "").strip().lower()
        chuyen_slug = MON_CHUYEN_TO_SLUG.get(mon_chuyen, "")

        # 1. Đọc tiến độ bài tập (da_lam)
        rows_da_lam = []
        if _bang_ton_tai(conn, "da_lam"):
            rows_da_lam = conn.execute(
                "SELECT bai_key, COALESCE(best_pct, 0) FROM da_lam WHERE user_id = ?", (user_id,)
            ).fetchall()

        bt_toan = _thong_ke_bai_tap(rows_da_lam, "toan")
        bt_van = _thong_ke_bai_tap(rows_da_lam, "ngu_van")
        bt_chuyen = _thong_ke_bai_tap(rows_da_lam, chuyen_slug) if chuyen_slug else None

        tong_co_so = bt_toan["tong_bai"] + bt_van["tong_bai"]
        dat_co_so = bt_toan["bai_dat"] + bt_van["bai_dat"]
        da_lam_co_so = bt_toan["bai_da_lam"] + bt_van["bai_da_lam"]
        do_phu_co_so = round(min(1.0, dat_co_so / max(1, tong_co_so)), 4)

        if bt_chuyen and bt_chuyen["tong_bai"] > 0:
            do_phu_chuyen = bt_chuyen["do_phu"]
            do_phu_chung = round(0.55 * do_phu_co_so + 0.45 * do_phu_chuyen, 4)
            da_lam_chuyen = bt_chuyen["bai_da_lam"]
        else:
            do_phu_chuyen = do_phu_co_so
            do_phu_chung = do_phu_co_so
            da_lam_chuyen = 0

        # 2. Đọc Sổ lỗi sai (ky_nang_user + so_loi)
        hom_nay = date.today().isoformat()
        kn_rows = []
        sl_rows = []
        if _bang_ton_tai(conn, "ky_nang_user"):
            kn_rows = conn.execute(
                "SELECT bai_key, muc, ngay_on_ke FROM ky_nang_user WHERE user_id = ?", (user_id,)
            ).fetchall()
        if _bang_ton_tai(conn, "so_loi"):
            sl_rows = conn.execute(
                "SELECT bai_key, da_hieu FROM so_loi WHERE user_id = ?", (user_id,)
            ).fetchall()

        sl_chung = _thong_ke_so_loi(kn_rows, sl_rows, hom_nay, None, da_lam_co_so + da_lam_chuyen)
        sl_chuyen = (
            _thong_ke_so_loi(kn_rows, sl_rows, hom_nay, chuyen_slug, da_lam_chuyen)
            if chuyen_slug
            else sl_chung
        )

        # 3. Đọc Khoa cử (kb_ket_qua + kb_ky)
        kc_rows = []
        if _bang_ton_tai(conn, "kb_ket_qua") and _bang_ton_tai(conn, "kb_ky"):
            kc_rows = conn.execute(
                """
                SELECT q.diem_tong, k.cap, k.bang
                FROM kb_ket_qua q
                LEFT JOIN kb_ky k ON k.id = q.ky_id
                WHERE q.user_id = ?
                ORDER BY q.ky_id DESC
                """,
                (user_id,),
            ).fetchall()

        def _norm_kc_10(raw_val):
            v = float(raw_val or 0.0)
            if v > 10.0:
                v = v / 10.0
            return round(max(0.0, min(10.0, v)), 2)

        so_ky_da_thi = len(kc_rows)
        diem_kc_all = [_norm_kc_10(r["diem_tong"]) for r in kc_rows if r["diem_tong"] is not None]
        diem_kc_chuyen_list = [
            _norm_kc_10(r["diem_tong"])
            for r in kc_rows
            if r["diem_tong"] is not None and str(r["bang"] or "").lower() not in ("", "chung")
        ]

        diem_khoa_cu_10 = round(max(diem_kc_all), 2) if diem_kc_all else None
        diem_kc_chuyen_10 = (
            round(max(diem_kc_chuyen_list), 2)
            if diem_kc_chuyen_list
            else diem_khoa_cu_10
        )

        # 4. Điểm Môn Chuyên tự động (thang 10) = 35% Khoa cử + 35% Bài tập chuyên + 30% Sổ lỗi sai
        bt_chuyen_10 = bt_chuyen["diem_bt_10"] if bt_chuyen else None
        co_sl_chuyen = (sl_chuyen["tong_kn"] > 0) or (da_lam_chuyen >= 3)
        sl_chuyen_10 = round(sl_chuyen["ty_le_sach_loi"] * 10.0, 2) if co_sl_chuyen else None

        co_du_lieu_chuyen = any(x is not None for x in (diem_kc_chuyen_10, bt_chuyen_10, sl_chuyen_10))
        if co_du_lieu_chuyen:
            # Dùng đúng trọng số 0.35 / 0.35 / 0.30 trên các thành phần đã có dữ liệu (nhân hệ số phủ nhẹ nếu mới có 1 nguồn)
            parts = [
                (0.35, diem_kc_chuyen_10),
                (0.35, bt_chuyen_10),
                (0.30, sl_chuyen_10),
            ]
            w_co = sum(w for w, v in parts if v is not None)
            diem_chuyen_tho = sum(w * v for w, v in parts if v is not None) / max(0.01, w_co)
            # Khi mới có 1/3 nguồn (w_co <= 0.35), nhân 0.90 để không thổi phồng 10.0 quá sớm
            he_so_du = 1.0 if w_co >= 0.65 else 0.90
            diem_chuyen_auto = round(max(0.0, min(10.0, diem_chuyen_tho * he_so_du)), 1)
        else:
            diem_chuyen_auto = None

        # 5. Khóa "Trần sẵn sàng theo giai đoạn" (Ý 2 V30 — chống ảo giác 100% sớm)
        if do_phu_chung < 0.35:
            tran_toi_da = 65
            giai_doan = "Khởi động"
        elif do_phu_chung >= 0.75 and sl_chung["loi_chua_hieu"] == 0 and so_ky_da_thi >= 1:
            tran_toi_da = 100
            giai_doan = "Về đích"
        else:
            tran_raw = round(65 + 25 * (0.6 * do_phu_chung + 0.4 * sl_chung["ty_le_sach_loi"]))
            tran_toi_da = max(70, min(89, tran_raw))
            giai_doan = "Tăng tốc"

        # 6. Điểm thực chiến VnStarL (55% trọng số Độ sẵn sàng)
        chi_so_kc = min(1.0, diem_khoa_cu_10 / 10.0) if diem_khoa_cu_10 is not None else 0.0
        chi_so_kc_chuyen = min(1.0, diem_kc_chuyen_10 / 10.0) if diem_kc_chuyen_10 is not None else 0.0

        diem_thuc_chien_co_so = round(
            45 * do_phu_co_so + 30 * sl_chung["ty_le_sach_loi"] + 25 * chi_so_kc
        )
        diem_thuc_chien_chuyen = round(
            45 * do_phu_chuyen + 30 * sl_chuyen["ty_le_sach_loi"] + 25 * chi_so_kc_chuyen
        )

        # 7. Gợi ý hành động bấm được cho trường thường & trường chuyên (Ý 3 V30)
        bt_co_so_thap = bt_toan if bt_toan["do_phu"] <= bt_van["do_phu"] else bt_van
        goi_y_co_so = _tao_goi_y(sl_chung, bt_co_so_thap, so_ky_da_thi, la_chuyen=False)
        goi_y_chuyen = _tao_goi_y(
            sl_chuyen if sl_chuyen["bai_goi_y"] else sl_chung,
            bt_chuyen if (bt_chuyen and bt_chuyen["tong_bai"] > 0) else bt_co_so_thap,
            so_ky_da_thi,
            la_chuyen=True,
        )

        return jsonify({
            "success": True,
            "data": {
                "user_id": user_id,
                "mon_chuyen": mon_chuyen,
                "ten_mon_chuyen": TEN_CHUYEN_MAP.get(mon_chuyen, ""),
                "chuyen_slug": chuyen_slug,
                "diem_chuyen_auto": diem_chuyen_auto,
                "co_du_lieu_chuyen": co_du_lieu_chuyen,
                "thanh_phan_chuyen": {
                    "khoa_cu_10": diem_kc_chuyen_10,
                    "bai_tap_10": bt_chuyen_10,
                    "so_loi_10": sl_chuyen_10,
                    "so_ky_da_thi": so_ky_da_thi,
                    "bai_dat_chuyen": bt_chuyen["bai_dat"] if bt_chuyen else 0,
                    "tong_bai_chuyen": bt_chuyen["tong_bai"] if bt_chuyen else 0,
                    "loi_chua_hieu_chuyen": sl_chuyen["loi_chua_hieu"],
                    "kn_thong_thao_chuyen": sl_chuyen["kn_thong_thao"],
                    "tong_kn_chuyen": sl_chuyen["tong_kn"],
                },
                "do_phu": {
                    "toan": bt_toan,
                    "ngu_van": bt_van,
                    "chuyen": bt_chuyen,
                    "co_so": do_phu_co_so,
                    "chuyen_ratio": do_phu_chuyen,
                    "chung": do_phu_chung,
                },
                "so_loi": sl_chung,
                "khoa_cu": {
                    "so_ky_da_thi": so_ky_da_thi,
                    "diem_10": diem_khoa_cu_10,
                },
                "tran_toi_da": tran_toi_da,
                "giai_doan": giai_doan,
                "diem_thuc_chien_co_so": diem_thuc_chien_co_so,
                "diem_thuc_chien_chuyen": diem_thuc_chien_chuyen,
                "goi_y_co_so": goi_y_co_so,
                "goi_y_chuyen": goi_y_chuyen,
            },
        }), 200
    finally:
        conn.close()
