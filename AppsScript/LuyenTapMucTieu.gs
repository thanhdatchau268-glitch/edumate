// LuyenTapMucTieu.gs - Port các API V28/V30/V31 cho Netlify + Apps Script:
//   - POST /api/luyen-tap/cham-cau
//   - POST /api/luyen-tap/luu-may-man
//   - POST /api/luyen-tap/hoan-thanh-chang
//   - GET  /api/muc-tieu/san-sang/<user_id>
//   - POST /api/vuon/nhip
//   - POST /api/vuon/tuong-tac

var LT_DO_TU_TIN = { doan_thu: true, kha_chac: true, rat_chac: true };
var LT_THUONG_TU_TIN = { doan_thu: 1, kha_chac: 2, rat_chac: 3 };
var LT_THUONG_FOCUS = 2;
var LT_COOLDOWN_FOCUS_SEC = 10;
var LT_BAI_ID_RE = /^[0-9.]+$/;

function _ltXayBaiKey(data) {
  var rawKey = String(data.bai_key || "").trim();
  if (rawKey) {
    var parts = rawKey.split("/");
    if (parts.length === 4) {
      var sub = parts[0].replace(/-/g, "_");
      var chap = parts[1], art = parts[2], bid = parts[3];
      if (TEN_HOP_LE.test(sub) && TEN_HOP_LE.test(chap) && TEN_HOP_LE.test(art) && LT_BAI_ID_RE.test(bid)) {
        return sub + "/" + chap + "/" + art + "/" + bid;
      }
    }
    return null;
  }
  var s = String(data.subject || "").replace(/-/g, "_").trim();
  var c = String(data.chapter || "").trim();
  var a = String(data.article || "").trim();
  var b = String(data.bai_id || "").trim();
  if (TEN_HOP_LE.test(s) && TEN_HOP_LE.test(c) && TEN_HOP_LE.test(a) && LT_BAI_ID_RE.test(b)) {
    return s + "/" + c + "/" + a + "/" + b;
  }
  return null;
}

function _ltTrichGoiYTang1(tai, cau) {
  if (cau && cau.goi_y) return String(cau.goi_y);
  var ly = String((tai && tai.de && tai.de.ly_thuyet) || "").trim();
  if (ly) {
    var cat = ly.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (cat.length > 220) cat = cat.slice(0, 217).replace(/\s+$/, "") + "...";
    if (cat) return "Nhắc lại lý thuyết: " + cat;
  }
  return "Hãy đọc lại định nghĩa và các dữ kiện chính của bài trước khi thử lại nhé!";
}

function _apiLtChamCau(data, token) {
  var baiKey = _ltXayBaiKey(data);
  var cauId = String(data.cau_id || "").trim();
  var answer = data.answer;
  var doTuTin = String(data.do_tu_tin || "kha_chac").trim();

  if (!baiKey || !cauId || !LT_DO_TU_TIN[doTuTin]) {
    return _err("Dữ liệu chấm câu không hợp lệ!", 400);
  }
  if (baiKey.indexOf("contest/") === 0) {
    return _err("Phòng thi không hỗ trợ chấm từng câu!", 403);
  }
  if (answer === null || answer === undefined || String(answer).trim() === "") {
    return _err("Hãy chọn hoặc nhập câu trả lời trước nhé!", 400);
  }
  var elapsedMs = Math.max(0, Number(data.elapsed_ms || 0) || 0);

  var tai = _slTaiBai(baiKey);
  var cau = tai ? _slTimCau(tai, cauId) : null;
  var dap = (tai && tai.dap_an) ? tai.dap_an[cauId] : null;
  if (!cau || !dap) {
    return _err("Không tìm thấy câu hỏi hoặc đáp án!", 404);
  }

  var isTuLuan = (dap.loai === "tu-luan" || cau.type === "tu-luan");
  var diem = Number(dap.diem != null ? dap.diem : (cau.diem != null ? cau.diem : 10)) || 10;
  var tuLuanChiTiet = null;
  var diemDat = 0;
  var dung = false;
  if (isTuLuan) {
    var resTl = chamTuLuan(dap, answer);
    diemDat = Number(resTl.diem || 0);
    tuLuanChiTiet = resTl.chi_tiet || null;
    dung = diemDat >= diem / 2.0;
  } else {
    dung = Boolean(_slCham(dap.dap_an_dung != null ? dap.dap_an_dung : "", answer));
    diemDat = dung ? diem : 0;
  }

  var uid = null;
  if (data.user_id !== null && data.user_id !== undefined && data.user_id !== "" &&
      data.user_id !== "null" && data.user_id !== "undefined") {
    uid = _toInt(data.user_id, null);
    if (!uid) return _err("Mã người dùng không hợp lệ!", 400);
    var auth = _authMatch(uid, token);
    if (!auth.ok) return _err(auth.msg, auth.status);
  }

  var lanDau = false, thuongCoin = 0, thuongScore = 0, daLuuSoLoi = false, uuTienCao = 0;
  var scoreMoi = null, educoinMoi = null;
  var homNay = vnTodayStr();

  if (uid && findUserRow(uid)) {
    var logs = dbReadTable("cham_cau_log");
    var daCham = false;
    for (var li = 0; li < logs.length; li++) {
      if (Number(logs[li].user_id) === uid && String(logs[li].bai_key) === baiKey && String(logs[li].cau_id) === cauId) {
        daCham = true;
        break;
      }
    }
    lanDau = !daCham;

    if (dung) {
      if (lanDau) {
        var mucThuong = LT_THUONG_TU_TIN[doTuTin];
        thuongCoin = mucThuong;
        thuongScore = mucThuong;
        congDiemVaEduCoin(uid, mucThuong, true);
      }
      var slRows = dbReadTable("so_loi");
      for (var si = 0; si < slRows.length; si++) {
        if (Number(slRows[si].user_id) === uid && String(slRows[si].bai_key) === baiKey && String(slRows[si].cau_id) === cauId) {
          slRows[si].da_hieu = 1;
          dbMarkDirty("so_loi");
        }
      }
      if (doTuTin === "rat_chac") {
        var knRows = dbReadTable("ky_nang_user");
        for (var ki = 0; ki < knRows.length; ki++) {
          if (Number(knRows[ki].user_id) === uid && String(knRows[ki].bai_key) === baiKey) {
            knRows[ki].so_lan_dat = Number(knRows[ki].so_lan_dat || 0) + 1;
            dbMarkDirty("ky_nang_user");
          }
        }
      }
    } else {
      uuTienCao = doTuTin === "rat_chac" ? 2 : (doTuTin === "kha_chac" ? 1 : 0);
      _slGhiLoi(uid, baiKey, cauId, homNay, lanDau, doTuTin, uuTienCao);
      if (doTuTin === "doan_thu") {
        var slRows2 = dbReadTable("so_loi");
        for (var s2 = 0; s2 < slRows2.length; s2++) {
          if (Number(slRows2[s2].user_id) === uid && String(slRows2[s2].bai_key) === baiKey &&
              String(slRows2[s2].cau_id) === cauId && !String(slRows2[s2].nguyen_nhan || "")) {
            slRows2[s2].nguyen_nhan = "doan_bua";
            dbMarkDirty("so_loi");
          }
        }
      }
      _slMoLaiKyNang(uid, baiKey, homNay);
      daLuuSoLoi = true;
    }

    if (lanDau) {
      dbInsert("cham_cau_log", {
        user_id: uid, bai_key: baiKey, cau_id: cauId, do_tu_tin: doTuTin,
        dung: dung ? 1 : 0, thuong_coin: thuongCoin, thuong_score: thuongScore,
        thoi_gian_ms: Math.floor(elapsedMs), lan_dau: homNay
      }, false);
    }

    kiemTraHuyHieu(uid);
    var uNow = findUserRow(uid);
    if (uNow) {
      scoreMoi = Number(uNow.score || 0);
      educoinMoi = Number(uNow.educoin || 0);
    }
  }

  var mayMan = Boolean(dung && doTuTin === "doan_thu");
  var goiYTang1 = "";
  var loiGiai = "";
  var thongDiep = "";
  if (dung) {
    if (doTuTin === "rat_chac") thongDiep = "Chính xác! Năng lực rất vững.";
    else if (doTuTin === "kha_chac") thongDiep = "Đúng rồi! Tiếp tục giữ nhịp nhé.";
    else thongDiep = "Trùng khớp, nhưng bạn đang đoán thử — lưu lại để ôn cho chắc nhé!";
    loiGiai = String(dap.loi_giai || "");
  } else {
    uuTienCao = doTuTin === "rat_chac" ? 2 : (doTuTin === "kha_chac" ? 1 : 0);
    if (doTuTin === "rat_chac") {
      thongDiep = "Chưa đúng! Đây là lỗ hổng ẩn dễ mất điểm khi thi, đã đưa lên đầu Sổ lỗi sai.";
    } else if (doTuTin === "kha_chac") {
      thongDiep = "Gần đúng rồi! Đã lưu vào Sổ lỗi sai để bạn tự kiểm tra lại ở cuối chặng.";
    } else {
      thongDiep = "Chưa chính xác. Đã lưu lại kèm gợi ý lý thuyết Tầng 1 trong Sổ lỗi sai.";
      goiYTang1 = _ltTrichGoiYTang1(tai, cau);
    }
    if (!GIAU_LOI_GIAI_KHI_SAI) loiGiai = String(dap.loi_giai || "");
  }

  var res = {
    success: true, dung: dung, do_tu_tin: doTuTin, lan_dau: lanDau,
    thuong_coin: thuongCoin, thuong_score: thuongScore,
    may_man: mayMan, co_the_luu_so_loi: mayMan, da_luu_so_loi: daLuuSoLoi,
    uu_tien_cao: uuTienCao, lo_hong_an: (!dung && doTuTin === "rat_chac"),
    thong_diep: thongDiep, goi_y: goiYTang1, loi_giai: loiGiai,
    diem: diem, diem_dat: Math.round(diemDat * 100) / 100,
    hop_le_focus: elapsedMs >= 5000
  };
  if (tuLuanChiTiet !== null) res.tu_luan = tuLuanChiTiet;
  if (scoreMoi !== null) { res.score_moi = scoreMoi; res.educoin_moi = educoinMoi; }
  return _jsonOut(200, res);
}

function _apiLtLuuMayMan(data, token) {
  var baiKey = _ltXayBaiKey(data);
  var cauId = String(data.cau_id || "").trim();
  var uid = _toInt(data.user_id, null);
  if (!uid || !baiKey || !cauId) return _err("Dữ liệu lưu câu chưa hợp lệ!", 400);
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  if (!_slTaiBai(baiKey)) return _err("Không tìm thấy bài tập!", 404);
  if (!findUserRow(uid)) return _err("Không tìm thấy người dùng!", 404);

  var homNay = vnTodayStr();
  _slGhiLoi(uid, baiKey, cauId, homNay, false, "doan_thu", 1);
  var slRows = dbReadTable("so_loi");
  for (var i = 0; i < slRows.length; i++) {
    if (Number(slRows[i].user_id) === uid && String(slRows[i].bai_key) === baiKey &&
        String(slRows[i].cau_id) === cauId && !String(slRows[i].nguyen_nhan || "")) {
      slRows[i].nguyen_nhan = "doan_bua";
      dbMarkDirty("so_loi");
    }
  }
  _slMoLaiKyNang(uid, baiKey, homNay);
  return _jsonOut(200, { success: true, message: "Đã lưu vào Sổ lỗi sai để bạn ôn chắc kiến thức này!" });
}

function _apiLtHoanThanhChang(data, token) {
  var baiKey = _ltXayBaiKey(data);
  var changId = String(data.chang_id || "").trim().slice(0, 64);
  var tatCaHopLe = Boolean(data.tat_ca_hop_le);
  var uid = _toInt(data.user_id, null);
  var streakChang = _toInt(data.streak_chang != null ? data.streak_chang : 0, null);
  if (!uid || streakChang === null) return _err("Dữ liệu không hợp lệ!", 400);
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  if (!baiKey || !changId) return _err("Thiếu thông tin chặng!", 400);

  if (!(streakChang >= 3 && tatCaHopLe)) {
    return _jsonOut(200, {
      success: true, du_dieu_kien: false, thuong_coin: 0, thuong_score: 0,
      ly_do: "Chưa đạt Focus Combo >= 3 câu liên tiếp (>= 5 giây/câu)."
    });
  }
  var u = findUserRow(uid);
  if (!u) return _err("Không tìm thấy người dùng!", 404);

  var rows = dbReadTable("chang_focus_log");
  var lastTs = 0;
  for (var i = 0; i < rows.length; i++) {
    if (Number(rows[i].user_id) === uid) {
      var ts = Number(rows[i].tao_luc || 0);
      if (ts > lastTs) lastTs = ts;
      if (String(rows[i].bai_key) === baiKey && String(rows[i].chang_id) === changId) {
        return _jsonOut(200, {
          success: true, du_dieu_kien: false, thuong_coin: 0, thuong_score: 0,
          ly_do: "Chặng này đã nhận thưởng Focus Combo trước đó.",
          score_moi: Number(u.score || 0), educoin_moi: Number(u.educoin || 0)
        });
      }
    }
  }
  var nowSec = Math.floor(Date.now() / 1000);
  if (lastTs && (nowSec - lastTs) < LT_COOLDOWN_FOCUS_SEC) {
    return _jsonOut(200, {
      success: true, du_dieu_kien: false, thuong_coin: 0, thuong_score: 0,
      ly_do: "Bạn đang thao tác quá nhanh, thưởng Focus cần thời gian tập trung thực tế.",
      score_moi: Number(u.score || 0), educoin_moi: Number(u.educoin || 0)
    });
  }

  congDiemVaEduCoin(uid, LT_THUONG_FOCUS, true);
  dbInsert("chang_focus_log", {
    user_id: uid, bai_key: baiKey, chang_id: changId, tao_luc: nowSec
  }, true);
  kiemTraHuyHieu(uid);
  var uNow = findUserRow(uid);
  return _jsonOut(200, {
    success: true, du_dieu_kien: true,
    thuong_coin: LT_THUONG_FOCUS, thuong_score: LT_THUONG_FOCUS,
    score_moi: Number(uNow.score || 0), educoin_moi: Number(uNow.educoin || 0),
    thong_diep: "Focus Combo! Thưởng thêm +" + LT_THUONG_FOCUS + " EduCoin & +" + LT_THUONG_FOCUS + " Điểm tích lũy."
  });
}

// ==================== MỤC TIÊU SẴN SÀNG (muc_tieu.py V30) ====================
var MT_MON_CHUYEN_SLUG = { ly: "vat_ly", toan: "chuyen_toan", dia: "chuyen_dia" };
var MT_TEN_CHUYEN = {
  toan: "Chuyên Toán", ly: "Chuyên Vật Lý", hoa: "Chuyên Hóa Học",
  sinh: "Chuyên Sinh Học", van: "Chuyên Ngữ Văn", anh: "Chuyên Tiếng Anh",
  su: "Chuyên Lịch Sử", dia: "Chuyên Địa Lí", tin: "Chuyên Tin Học"
};
var MT_TEN_SLUG = {
  toan: "Toán", ngu_van: "Ngữ văn", vat_ly: "Vật lí",
  chuyen_toan: "Chuyên Toán", chuyen_dia: "Chuyên Địa lí"
};

function _mtDemTongBai(slug) {
  if (!slug || typeof DAP_AN_BUNDLE === "undefined") return 0;
  var prefix = slug + "/";
  var keys = Object.keys(DAP_AN_BUNDLE);
  var tong = 0;
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k.indexOf(prefix) === 0 && k.indexOf("/tong-hop") === -1) {
      var obj = DAP_AN_BUNDLE[k];
      if (obj && typeof obj === "object") tong += Object.keys(obj).length;
    }
  }
  return tong;
}

function _mtRutTenNgan(baiKey) {
  try {
    var info = _slTenKyNang(baiKey);
    var ten = (info && info.ten) || String(baiKey);
    return ten.length > 30 ? ten.slice(0, 29).replace(/\s+$/, "") + "…" : ten;
  } catch (e) {
    var parts = String(baiKey || "").split("/");
    return parts.length ? parts[parts.length - 1] : String(baiKey || "");
  }
}

function _mtThongKeBaiTap(rowsDaLam, slug) {
  var tongBai = _mtDemTongBai(slug);
  var prefix = slug + "/";
  var matched = [];
  for (var i = 0; i < rowsDaLam.length; i++) {
    var r = rowsDaLam[i];
    if (String(r.bai_key || "").indexOf(prefix) === 0) {
      matched.push(Math.max(0, Math.min(100, Number(r.best_pct || 0))));
    }
  }
  var baiDaLam = matched.length;
  var baiDat = 0, sumPct = 0;
  for (var j = 0; j < matched.length; j++) {
    sumPct += matched[j];
    if (matched[j] >= 70) baiDat++;
  }
  var doPhu = tongBai > 0 ? Math.round(Math.min(1.0, baiDat / Math.max(1, tongBai)) * 10000) / 10000 : 0.0;
  var diemBt10 = baiDaLam > 0 ? Math.round(((sumPct / baiDaLam) / 10.0) * 100) / 100 : null;
  return {
    slug: slug, ten: MT_TEN_SLUG[slug] || slug, tong_bai: tongBai,
    bai_da_lam: baiDaLam, bai_dat: baiDat, do_phu: doPhu, diem_bt_10: diemBt10
  };
}

function _mtThongKeSoLoi(knRows, slRows, homNay, slugLoc, baiDaLamNhom) {
  var prefix = slugLoc ? (slugLoc + "/") : null;
  var knList = knRows.filter(function (r) { return !prefix || String(r.bai_key || "").indexOf(prefix) === 0; });
  var slList = slRows.filter(function (r) { return !prefix || String(r.bai_key || "").indexOf(prefix) === 0; });

  var tongKn = knList.length, knThongThao = 0, theDenHan = 0;
  for (var i = 0; i < knList.length; i++) {
    if (Number(knList[i].muc || 0) >= 3) knThongThao++;
    if (knList[i].ngay_on_ke && String(knList[i].ngay_on_ke) <= homNay) theDenHan++;
  }
  var tongLoi = slList.length, loiChuaHieu = 0;
  var loiTheoKey = {};
  for (var j = 0; j < slList.length; j++) {
    if (Number(slList[j].da_hieu || 0) === 0) {
      loiChuaHieu++;
      var bk = String(slList[j].bai_key || "");
      loiTheoKey[bk] = (loiTheoKey[bk] || 0) + 1;
    }
  }

  var baiGoiY = null;
  if (knList.length) {
    var knSorted = knList.slice().sort(function (a, b) {
      var aDue = (a.ngay_on_ke && String(a.ngay_on_ke) <= homNay) ? 0 : 1;
      var bDue = (b.ngay_on_ke && String(b.ngay_on_ke) <= homNay) ? 0 : 1;
      if (aDue !== bDue) return aDue - bDue;
      var aErr = loiTheoKey[String(a.bai_key)] || 0;
      var bErr = loiTheoKey[String(b.bai_key)] || 0;
      if (aErr !== bErr) return bErr - aErr;
      var aMuc = Number(a.muc || 0), bMuc = Number(b.muc || 0);
      if (aMuc !== bMuc) return aMuc - bMuc;
      return String(a.bai_key).localeCompare(String(b.bai_key));
    });
    var top = knSorted[0];
    var topKey = String(top.bai_key || "");
    if ((top.ngay_on_ke && String(top.ngay_on_ke) <= homNay) || (loiTheoKey[topKey] || 0) > 0) {
      baiGoiY = { bai_key: topKey, ten_ngan: _mtRutTenNgan(topKey), loi_chua_hieu: loiTheoKey[topKey] || 0 };
    }
  }

  var tyLeSachLoi;
  if (tongLoi === 0 && tongKn === 0) {
    tyLeSachLoi = baiDaLamNhom >= 3 ? 1.0 : 0.5;
  } else {
    var phanLoi = Math.max(0, 1.0 - loiChuaHieu / Math.max(1, tongLoi + 2));
    var phanKn = knThongThao / Math.max(1, tongKn);
    tyLeSachLoi = Math.round(Math.max(0, Math.min(1, 0.6 * phanLoi + 0.4 * phanKn)) * 10000) / 10000;
  }
  return {
    tong_kn: tongKn, kn_thong_thao: knThongThao, the_den_han: theDenHan,
    tong_loi: tongLoi, loi_chua_hieu: loiChuaHieu,
    ty_le_sach_loi: tyLeSachLoi, bai_goi_y: baiGoiY
  };
}

function _mtTaoGoiY(soLoiStat, btTarget, soKyDaThi, laChuyen) {
  var canVa = Math.max(soLoiStat.the_den_han, soLoiStat.loi_chua_hieu);
  if (canVa > 0 && soLoiStat.bai_goi_y) {
    var g = soLoiStat.bai_goi_y;
    return { loai: "so_loi", text: "⚡ Vá " + canVa + " thẻ Sổ lỗi (" + g.ten_ngan + ") (+2%)", href: "so-loi.html?key=" + g.bai_key };
  }
  if (btTarget && btTarget.tong_bai > 0 && btTarget.do_phu < 0.75) {
    return { loai: "bai_tap", text: "📘 Luyện thêm 2 bài " + btTarget.ten + " mở trần (+3%)", href: "problems.html?subject=" + btTarget.slug.replace(/_/g, "-") };
  }
  if (soKyDaThi === 0) {
    return { loai: "khoa_cu", text: "🏆 Thi 1 kỳ Thi Hương để mở trần (+5%)", href: "khoa-bang.html" };
  }
  if (laChuyen && (!btTarget || btTarget.tong_bai === 0)) {
    return { loai: "khoa_cu", text: "🏆 Tham gia Khoa cử bảng chuyên (+4%)", href: "khoa-bang.html" };
  }
  return { loai: "duy_tri", text: "✨ Giữ phong độ luyện tập mỗi ngày", href: "subjects.html" };
}

function _apiMucTieuSanSang(userId, query) {
  if (!userId || userId <= 0) return _err("ID người dùng không hợp lệ!", 400);
  var user = findUserRow(userId);
  if (!user) return _err("Không tìm thấy người dùng!", 404);

  var monChuyen = String((query && query.mon_chuyen) || user.mon_chuyen || "").trim().toLowerCase();
  var chuyenSlug = MT_MON_CHUYEN_SLUG[monChuyen] || "";

  var rowsDaLam = dbReadTable("da_lam").filter(function (r) { return Number(r.user_id) === userId; });
  var btToan = _mtThongKeBaiTap(rowsDaLam, "toan");
  var btVan = _mtThongKeBaiTap(rowsDaLam, "ngu_van");
  var btChuyen = chuyenSlug ? _mtThongKeBaiTap(rowsDaLam, chuyenSlug) : null;

  var tongCoSo = btToan.tong_bai + btVan.tong_bai;
  var datCoSo = btToan.bai_dat + btVan.bai_dat;
  var daLamCoSo = btToan.bai_da_lam + btVan.bai_da_lam;
  var doPhuCoSo = Math.round(Math.min(1.0, datCoSo / Math.max(1, tongCoSo)) * 10000) / 10000;

  var doPhuChuyen, doPhuChung, daLamChuyen;
  if (btChuyen && btChuyen.tong_bai > 0) {
    doPhuChuyen = btChuyen.do_phu;
    doPhuChung = Math.round((0.55 * doPhuCoSo + 0.45 * doPhuChuyen) * 10000) / 10000;
    daLamChuyen = btChuyen.bai_da_lam;
  } else {
    doPhuChuyen = doPhuCoSo;
    doPhuChung = doPhuCoSo;
    daLamChuyen = 0;
  }

  var homNay = vnTodayStr();
  var knRows = dbReadTable("ky_nang_user").filter(function (r) { return Number(r.user_id) === userId; });
  var slRows = dbReadTable("so_loi").filter(function (r) { return Number(r.user_id) === userId; });
  var slChung = _mtThongKeSoLoi(knRows, slRows, homNay, null, daLamCoSo + daLamChuyen);
  var slChuyen = chuyenSlug ? _mtThongKeSoLoi(knRows, slRows, homNay, chuyenSlug, daLamChuyen) : slChung;

  var kyMap = {};
  dbReadTable("kb_ky").forEach(function (k) { kyMap[Number(k.id)] = k; });
  var kcRows = dbReadTable("kb_ket_qua").filter(function (r) { return Number(r.user_id) === userId; });
  var normKc10 = function (rawVal) {
    var v = Number(rawVal || 0);
    if (v > 10) v = v / 10.0;
    return Math.round(Math.max(0, Math.min(10, v)) * 100) / 100;
  };
  var soKyDaThi = kcRows.length;
  var diemKcAll = [], diemKcChuyenList = [];
  for (var ki = 0; ki < kcRows.length; ki++) {
    if (kcRows[ki].diem_tong === null || kcRows[ki].diem_tong === undefined || kcRows[ki].diem_tong === "") continue;
    var val = normKc10(kcRows[ki].diem_tong);
    diemKcAll.push(val);
    var kyObj = kyMap[Number(kcRows[ki].ky_id)] || {};
    var bangStr = String(kyObj.bang || "").toLowerCase();
    if (bangStr && bangStr !== "chung") diemKcChuyenList.push(val);
  }
  var diemKhoaCu10 = diemKcAll.length ? Math.round(Math.max.apply(null, diemKcAll) * 100) / 100 : null;
  var diemKcChuyen10 = diemKcChuyenList.length ? Math.round(Math.max.apply(null, diemKcChuyenList) * 100) / 100 : diemKhoaCu10;

  var btChuyen10 = btChuyen ? btChuyen.diem_bt_10 : null;
  var coSlChuyen = (slChuyen.tong_kn > 0) || (daLamChuyen >= 3);
  var slChuyen10 = coSlChuyen ? Math.round(slChuyen.ty_le_sach_loi * 1000) / 100 : null;

  var coDuLieuChuyen = (diemKcChuyen10 !== null || btChuyen10 !== null || slChuyen10 !== null);
  var diemChuyenAuto = null;
  if (coDuLieuChuyen) {
    var parts = [[0.35, diemKcChuyen10], [0.35, btChuyen10], [0.30, slChuyen10]];
    var wCo = 0, sWv = 0;
    for (var pi = 0; pi < parts.length; pi++) {
      if (parts[pi][1] !== null) { wCo += parts[pi][0]; sWv += parts[pi][0] * parts[pi][1]; }
    }
    var tho = sWv / Math.max(0.01, wCo);
    var heSoDu = wCo >= 0.65 ? 1.0 : 0.90;
    diemChuyenAuto = Math.round(Math.max(0, Math.min(10, tho * heSoDu)) * 10) / 10;
  }

  var tranToiDa, giaiDoan;
  if (doPhuChung < 0.35) {
    tranToiDa = 65; giaiDoan = "Khởi động";
  } else if (doPhuChung >= 0.75 && slChung.loi_chua_hieu === 0 && soKyDaThi >= 1) {
    tranToiDa = 100; giaiDoan = "Về đích";
  } else {
    var tranRaw = Math.round(65 + 25 * (0.6 * doPhuChung + 0.4 * slChung.ty_le_sach_loi));
    tranToiDa = Math.max(70, Math.min(89, tranRaw));
    giaiDoan = "Tăng tốc";
  }

  var chiSoKc = diemKhoaCu10 !== null ? Math.min(1.0, diemKhoaCu10 / 10.0) : 0.0;
  var chiSoKcChuyen = diemKcChuyen10 !== null ? Math.min(1.0, diemKcChuyen10 / 10.0) : 0.0;
  var diemThucChienCoSo = Math.round(45 * doPhuCoSo + 30 * slChung.ty_le_sach_loi + 25 * chiSoKc);
  var diemThucChienChuyen = Math.round(45 * doPhuChuyen + 30 * slChuyen.ty_le_sach_loi + 25 * chiSoKcChuyen);

  var btCoSoThap = btToan.do_phu <= btVan.do_phu ? btToan : btVan;
  var goiYCoSo = _mtTaoGoiY(slChung, btCoSoThap, soKyDaThi, false);
  var goiYChuyen = _mtTaoGoiY(
    slChuyen.bai_goi_y ? slChuyen : slChung,
    (btChuyen && btChuyen.tong_bai > 0) ? btChuyen : btCoSoThap,
    soKyDaThi,
    true
  );

  return _jsonOut(200, {
    success: true,
    data: {
      user_id: userId, mon_chuyen: monChuyen,
      ten_mon_chuyen: MT_TEN_CHUYEN[monChuyen] || "", chuyen_slug: chuyenSlug,
      diem_chuyen_auto: diemChuyenAuto, co_du_lieu_chuyen: coDuLieuChuyen,
      thanh_phan_chuyen: {
        khoa_cu_10: diemKcChuyen10, bai_tap_10: btChuyen10, so_loi_10: slChuyen10,
        so_ky_da_thi: soKyDaThi,
        bai_dat_chuyen: btChuyen ? btChuyen.bai_dat : 0,
        tong_bai_chuyen: btChuyen ? btChuyen.tong_bai : 0,
        loi_chua_hieu_chuyen: slChuyen.loi_chua_hieu,
        kn_thong_thao_chuyen: slChuyen.kn_thong_thao,
        tong_kn_chuyen: slChuyen.tong_kn
      },
      do_phu: {
        toan: btToan, ngu_van: btVan, chuyen: btChuyen,
        co_so: doPhuCoSo, chuyen_ratio: doPhuChuyen, chung: doPhuChung
      },
      so_loi: slChung,
      khoa_cu: { so_ky_da_thi: soKyDaThi, diem_10: diemKhoaCu10 },
      tran_toi_da: tranToiDa, giai_doan: giaiDoan,
      diem_thuc_chien_co_so: diemThucChienCoSo,
      diem_thuc_chien_chuyen: diemThucChienChuyen,
      goi_y_co_so: goiYCoSo, goi_y_chuyen: goiYChuyen
    }
  });
}

// ==================== VƯỜN SAOLADOU V28: NHỊP & TƯƠNG TÁC ====================
var VUON_LOI_NGAM_CANH = [
  "Gió Trường Sơn mát quá! Học xong một bài mình lại ra đây ngắm suối nhé!",
  "Từ tảng đá này nhìn thấy cả khu rừng xanh rì — cảm ơn bạn đã chăm sóc mình!",
  "Nghe nói loài Sao La bọn mình được gọi là Kỳ lân châu Á đó, cố gắng học giỏi nha!",
  "Nghỉ mắt vài giây ngắm trời xanh rồi tiếp tục chinh phục mục tiêu nhé!",
  "Tiếng suối chảy róc rách nghe thật bình yên, bạn đã hoàn thành nhiệm vụ hôm nay chưa?"
];

function _apiVuonNhip(data, token) {
  var auth = _authMatch(null, token);
  if (!auth.ok) return _err("Hãy đăng xuất rồi đăng nhập lại để dùng tính năng này!", 401);
  var uid = auth.uid;
  if (!findUserRow(uid)) return _err("Không tìm thấy người dùng!", 404);

  var dangNgu = Boolean(data.dang_ngu);
  var phutNgu = _vuonPhanTichPhut(data.ngu_tu, 22 * 60);
  var phutDay = _vuonPhanTichPhut(data.ngu_den, 6 * 60);
  var nowMs = vnNowUtcMs();
  var nowStr = vnNowStr();

  var vt = _vuonApplyDecay(_vuonGetOrInit(uid), false, phutNgu, phutDay);
  var dtOnlineMs = parseYmdHmsMs(vt.lan_online) || parseYmdHmsMs(vt.lan_cham);
  if (dtOnlineMs === null) {
    vt.lan_online = nowStr;
    vt.lan_cham = nowStr;
    dbMarkDirty("vuon_trang_thai");
    return _jsonOut(200, { success: true, tick_applied: false, so_phut: 0, data: vuonBuildState(uid, false, phutNgu, phutDay) });
  }

  var deltaS = Math.max(0, (nowMs - dtOnlineMs) / 1000);
  if (deltaS < VUON_GIAY_SPAM_NHIP) {
    return _jsonOut(200, { success: true, tick_applied: false, so_phut: 0, data: vuonBuildState(uid, false, phutNgu, phutDay) });
  }
  if (deltaS >= 3600) {
    vt.lan_online = nowStr;
    dbMarkDirty("vuon_trang_thai");
    return _jsonOut(200, { success: true, tick_applied: true, so_phut: 0, offline_synced: true, data: vuonBuildState(uid, false, phutNgu, phutDay) });
  }

  var soPhut = Math.min(VUON_PHUT_ONLINE_MAX, Math.max(1, Math.floor(deltaS / 60)));
  var kq = _vuonApDungTruOnline(vt.no_bung, vt.vui_ve, vt.sach_se, soPhut, dangNgu);
  vt.no_bung = kq.no_bung;
  vt.vui_ve = kq.vui_ve;
  vt.sach_se = kq.sach_se;
  vt.lan_cham = nowStr;
  vt.lan_online = nowStr;
  dbMarkDirty("vuon_trang_thai");
  return _jsonOut(200, {
    success: true, tick_applied: true, so_phut: soPhut, dang_ngu: dangNgu,
    data: vuonBuildState(uid, false, phutNgu, phutDay)
  });
}

function _apiVuonTuongTac(data, token) {
  var auth = _authMatch(null, token);
  if (!auth.ok) return _err("Hãy đăng xuất rồi đăng nhập lại để dùng tính năng này!", 401);
  var uid = auth.uid;
  var hanhDong = String(data.hanh_dong || "").trim();
  if (hanhDong !== "tam_song" && hanhDong !== "nghi_cay" && hanhDong !== "ngam_canh") {
    return _err("Hành động tương tác không hợp lệ!", 400);
  }
  if (!findUserRow(uid)) return _err("Không tìm thấy người dùng!", 404);

  var nowMs = vnNowUtcMs();
  var nowStr = vnNowStr();
  var todayStr = vnTodayStr();
  var vt = _vuonApplyDecay(_vuonGetOrInit(uid), true);

  if (_vuonSucKhoe(vt.no_bung, vt.vui_ve, vt.sach_se) === "om") {
    return _jsonOut(200, {
      success: true, om: true, cong_diem: false, cho_giay: 0,
      message: "SaoLa đang xỉu vì kiệt sức! Hãy cho ăn lá rừng, uống nước suối hoặc dùng Thảo dược để hồi sức nhé!",
      data: vuonBuildState(uid, false)
    });
  }
  if (hanhDong === "ngam_canh") {
    var msgNgam = VUON_LOI_NGAM_CANH[Math.floor(Math.random() * VUON_LOI_NGAM_CANH.length)];
    return _jsonOut(200, {
      success: true, cong_diem: false, cho_giay: 0, message: msgNgam,
      data: vuonBuildState(uid, false)
    });
  }

  var cungNgay = String(vt.tuong_tac_ngay || "") === todayStr;
  var demTam = cungNgay ? Number(vt.tam_song_dem || 0) : 0;
  var demNghi = cungNgay ? Number(vt.nghi_cay_dem || 0) : 0;

  if (hanhDong === "tam_song") {
    if (demTam >= VUON_TAM_SONG_MAX_NGAY) {
      return _jsonOut(200, {
        success: true, cong_diem: false, het_luot: true, cho_giay: 0,
        message: "Hôm nay SaoLa đã tắm hồ đủ " + VUON_TAM_SONG_MAX_NGAY + " lượt nhận thưởng rồi, bơi thêm cho mát thôi nhé!",
        data: vuonBuildState(uid, false)
      });
    }
    var choTam = _vuonGiayHoiChieuCon(vt.tam_song_cuoi, VUON_TAM_SONG_CD, nowMs);
    if (choTam > 0) {
      var phutT = Math.max(1, Math.ceil(choTam / 60));
      return _jsonOut(200, {
        success: true, cong_diem: false, cho_giay: choTam,
        message: "Nước hồ mát quá! Đợi khoảng " + phutT + " phút nữa mới nhận thêm thưởng tắm hồ nhé.",
        data: vuonBuildState(uid, false)
      });
    }
    vt.sach_se = Math.max(0, Math.min(100, Number(vt.sach_se || 0) + VUON_TAM_SONG_SACH));
    vt.vui_ve = Math.max(0, Math.min(100, Number(vt.vui_ve || 0) + VUON_TAM_SONG_VUI));
    vt.lan_cham = nowStr;
    vt.lan_online = nowStr;
    vt.tuong_tac_ngay = todayStr;
    vt.tam_song_dem = demTam + 1;
    vt.tam_song_cuoi = nowStr;
    vt.nghi_cay_dem = demNghi;
    dbMarkDirty("vuon_trang_thai");
    return _jsonOut(200, {
      success: true, cong_diem: true, cho_giay: 0,
      sach_cong: VUON_TAM_SONG_SACH, vui_cong: VUON_TAM_SONG_VUI,
      message: "Tắm hồ thật sảng khoái! (+" + VUON_TAM_SONG_SACH + " Sạch sẽ, +" + VUON_TAM_SONG_VUI + " Vui vẻ)",
      data: vuonBuildState(uid, false)
    });
  }

  // nghi_cay
  if (demNghi >= VUON_NGHI_CAY_MAX_NGAY) {
    return _jsonOut(200, {
      success: true, cong_diem: false, het_luot: true, cho_giay: 0,
      message: "Hôm nay SaoLa đã nghỉ dưới gốc cây đủ " + VUON_NGHI_CAY_MAX_NGAY + " lượt thưởng rồi, nằm hóng mát chút nha!",
      data: vuonBuildState(uid, false)
    });
  }
  var choNghi = _vuonGiayHoiChieuCon(vt.nghi_cay_cuoi, VUON_NGHI_CAY_CD, nowMs);
  if (choNghi > 0) {
    var phutN = Math.max(1, Math.ceil(choNghi / 60));
    return _jsonOut(200, {
      success: true, cong_diem: false, cho_giay: choNghi,
      message: "Bóng cây râm mát quá! Đợi khoảng " + phutN + " phút nữa để nhận thêm thưởng nghỉ ngơi nhé.",
      data: vuonBuildState(uid, false)
    });
  }
  vt.vui_ve = Math.max(0, Math.min(100, Number(vt.vui_ve || 0) + VUON_NGHI_CAY_VUI));
  vt.lan_cham = nowStr;
  vt.lan_online = nowStr;
  vt.tuong_tac_ngay = todayStr;
  vt.tam_song_dem = demTam;
  vt.nghi_cay_dem = demNghi + 1;
  vt.nghi_cay_cuoi = nowStr;
  dbMarkDirty("vuon_trang_thai");
  return _jsonOut(200, {
    success: true, cong_diem: true, cho_giay: 0, vui_cong: VUON_NGHI_CAY_VUI,
    message: "Nghỉ dưới tán cây thật dễ chịu! (+" + VUON_NGHI_CAY_VUI + " Vui vẻ)",
    data: vuonBuildState(uid, false)
  });
}
