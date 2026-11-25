// GradingAndModules.gs - Chấm bài, Streak, Xếp hạng, Quà tặng, Huy hiệu, Nhiệm vụ, Sổ lỗi sai, Khoa bảng, Pet

function _toInt(v, defVal) {
  if (typeof v === "boolean" || v === null || v === undefined || v === "") return defVal;
  var n = Number(v);
  return isNaN(n) || Math.floor(n) !== n ? defVal : n;
}

function _escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function _seededRng(seedStr) {
  var h = 2166136261 >>> 0;
  var s = String(seedStr || "");
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += 0x6d2b79f5;
    var t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ====================== CHẤM BÀI (app.py & cham_tu_luan.py) ======================
function cham(dapAnDung, traLoi) {
  return String(traLoi == null ? "" : traLoi).trim().toLowerCase() ===
         String(dapAnDung == null ? "" : dapAnDung).trim().toLowerCase();
}

function chuanHoaTuLuan(str) {
  var s = String(str == null ? "" : str)
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/(\d),(\d)/g, "$1.$2");
  s = s.replace(/(^|[^\d])\.+/g, "$1 ").replace(/\.+([^\d]|$)/g, " $1");
  s = s.replace(/[^a-z0-9.%/]+/g, " ").replace(/\s+/g, " ").trim();
  return " " + s + " ";
}

function chamTuLuan(info, traLoi) {
  var TOI_DA_KY_TU = 6000;
  var TU_MOI_Y = 6;
  var raw = String(traLoi == null ? "" : traLoi).slice(0, TOI_DA_KY_TU);
  var text = chuanHoaTuLuan(raw);
  var words = text.trim() ? text.trim().split(/\s+/) : [];
  var soTu = words.length;

  var yList = info && Array.isArray(info.y) ? info.y : [];
  var ketQua = [];
  for (var i = 0; i < yList.length; i++) {
    var y = yList[i];
    var nhoms = Array.isArray(y.nhom_tu_khoa) ? y.nhom_tu_khoa : [];
    var dsK = [];
    for (var ni = 0; ni < nhoms.length; ni++) {
      var n = Array.isArray(nhoms[ni]) ? nhoms[ni] : [];
      var clean = [];
      for (var ki = 0; ki < n.length; ki++) {
        if (typeof n[ki] === "string" && n[ki].trim()) clean.push(n[ki]);
      }
      dsK.push(clean);
    }
    var canDat = y.can_dat != null ? Number(y.can_dat) : 1;
    var nhomTrung = 0;
    if (dsK.length === 1 && canDat > 1) {
      for (var j = 0; j < dsK[0].length; j++) {
        if (text.indexOf(chuanHoaTuLuan(dsK[0][j])) !== -1) nhomTrung++;
      }
    } else {
      for (var j2 = 0; j2 < dsK.length; j2++) {
        var matched = false;
        for (var k2 = 0; k2 < dsK[j2].length; k2++) {
          if (text.indexOf(chuanHoaTuLuan(dsK[j2][k2])) !== -1) {
            matched = true;
            break;
          }
        }
        if (matched) nhomTrung++;
      }
    }
    ketQua.push({
      id: y.id,
      diem: Number(y.diem || 0),
      noi_dung: y.noi_dung || "",
      dat: nhomTrung >= canDat
    });
  }

  var toiDa = Math.floor(soTu / TU_MOI_Y);
  var dem = 0;
  for (var idx = 0; idx < ketQua.length; idx++) {
    if (ketQua[idx].dat) {
      dem++;
      if (dem > toiDa) {
        ketQua[idx].dat = false;
        ketQua[idx].qua_ngan = true;
      }
    }
  }
  var sum = 0;
  for (var m = 0; m < ketQua.length; m++) {
    if (ketQua[m].dat) sum += ketQua[m].diem;
  }
  return { diem: Math.round(sum * 100) / 100, chi_tiet: ketQua };
}

// ====================== USERS / SCORE / STREAK / RANKING (db_ops.py) ======================
function findUserRow(userId) {
  var uid = Number(userId);
  var users = dbReadTable("users");
  for (var i = 0; i < users.length; i++) {
    if (Number(users[i].id) === uid) return users[i];
  }
  return null;
}

function findUserByEmail(email) {
  var em = String(email || "").trim().toLowerCase();
  var users = dbReadTable("users");
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email || "").trim().toLowerCase() === em) return users[i];
  }
  return null;
}

function streakHienThi(streak, lastDate, baoHo) {
  streak = Number(streak || 0);
  baoHo = Number(baoHo || 0);
  if (!lastDate) return 0;
  var cach = diffDaysYmd(vnTodayStr(), lastDate);
  if (cach === null) return 0;
  if (cach <= 1) return streak;
  if (cach === 2 && baoHo > 0) return streak;
  return 0;
}

function congDiemThang(userId, diem) {
  if (diem <= 0) return;
  var uid = Number(userId);
  var thang = vnThangHienTai();
  var rows = dbReadTable("diem_thang");
  for (var i = 0; i < rows.length; i++) {
    if (Number(rows[i].user_id) === uid && String(rows[i].thang) === thang) {
      rows[i].diem = Number(rows[i].diem || 0) + diem;
      dbMarkDirty("diem_thang");
      return;
    }
  }
  dbInsert("diem_thang", { user_id: uid, thang: thang, diem: diem }, false);
}

function congDiemVaEduCoin(userId, points, coCongThang) {
  points = Number(points || 0);
  if (points <= 0) return;
  var u = findUserRow(userId);
  if (!u) return;
  u.score = Number(u.score || 0) + points;
  u.educoin = Number(u.educoin || 0) + points;
  dbMarkDirty("users");
  if (coCongThang !== false) congDiemThang(userId, points);
}

function updateUserScore(userId, points) {
  congDiemVaEduCoin(userId, points, true);
}

function updateStreak(userId) {
  var u = findUserRow(userId);
  if (!u) return;
  var today = vnTodayStr();
  var currentStreak = Number(u.streak || 0);
  var lastDate = String(u.last_active_date || "");
  var baoHo = Number(u.the_bao_ho || 0);
  if (lastDate === today) return;
  var cach = lastDate ? diffDaysYmd(today, lastDate) : null;
  if (cach === 1) {
    currentStreak += 1;
  } else if (cach === 2 && baoHo > 0) {
    currentStreak += 1;
    baoHo -= 1;
  } else {
    currentStreak = 1;
  }
  u.streak = currentStreak;
  u.last_active_date = today;
  u.the_bao_ho = baoHo;
  dbMarkDirty("users");
}

function getUserPublic(userId) {
  var u = findUserRow(userId);
  if (!u) return null;
  var today = vnTodayStr();
  return {
    id: Number(u.id),
    username: u.username || "",
    bio: u.bio || "",
    score: Number(u.score || 0),
    educoin: Number(u.educoin || 0),
    muc_tieu_tuan: Number(u.muc_tieu_tuan || 20),
    mon_chuyen: u.mon_chuyen || "",
    avatar: u.avatar || "",
    huy_hieu: u.huy_hieu || "",
    hoc_hom_nay: String(u.last_active_date || "") === today,
    the_bao_ho: Number(u.the_bao_ho || 0),
    streak: streakHienThi(u.streak, u.last_active_date, u.the_bao_ho)
  };
}

function getRanking(bang, ky, limit) {
  limit = limit || 20;
  var mon = BANG_XEP_HANG[bang][1];
  var users = dbReadTable("users");
  var out = [];
  if (ky === "thang") {
    var thang = vnThangHienTai();
    var dtRows = dbReadTable("diem_thang");
    var dtMap = {};
    for (var i = 0; i < dtRows.length; i++) {
      if (String(dtRows[i].thang) === thang && Number(dtRows[i].diem || 0) > 0) {
        dtMap[Number(dtRows[i].user_id)] = Number(dtRows[i].diem || 0);
      }
    }
    for (var j = 0; j < users.length; j++) {
      var u = users[j];
      if (String(u.mon_chuyen || "") === mon && dtMap[Number(u.id)] > 0) {
        out.push({
          id: Number(u.id), username: u.username || "", bio: u.bio || "",
          avatar: u.avatar || "", huy_hieu: u.huy_hieu || "",
          streak: Number(u.streak || 0), score: dtMap[Number(u.id)]
        });
      }
    }
  } else {
    for (var k = 0; k < users.length; k++) {
      var u2 = users[k];
      if (String(u2.mon_chuyen || "") === mon) {
        out.push({
          id: Number(u2.id), username: u2.username || "", bio: u2.bio || "",
          avatar: u2.avatar || "", huy_hieu: u2.huy_hieu || "",
          streak: Number(u2.streak || 0), score: Number(u2.score || 0)
        });
      }
    }
  }
  out.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.id - b.id;
  });
  return out.slice(0, limit);
}

function getMyRank(userId, bang, ky) {
  var uid = Number(userId);
  var all = getRanking(bang, ky, 100000);
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === uid) {
      return {
        id: all[i].id,
        username: all[i].username,
        bio: all[i].bio,
        avatar: all[i].avatar,
        huy_hieu: all[i].huy_hieu,
        score: all[i].score,
        hang: i + 1
      };
    }
  }
  return null;
}

// ====================== TIẾN ĐỘ (tien_do.py) ======================
function _khoaIdTuple(s) {
  return String(s).split(".").map(function (x) { return /^\d+$/.test(x) ? Number(x) : 0; });
}

function _cmpKhoaId(a, b) {
  var ta = _khoaIdTuple(a), tb = _khoaIdTuple(b);
  var n = Math.max(ta.length, tb.length);
  for (var i = 0; i < n; i++) {
    var va = i < ta.length ? ta[i] : 0;
    var vb = i < tb.length ? tb[i] : 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

function ghiDiemCaoNhat(userId, baiKey, pct) {
  var uid = Number(userId);
  var rows = dbReadTable("da_lam");
  for (var i = 0; i < rows.length; i++) {
    if (Number(rows[i].user_id) === uid && String(rows[i].bai_key) === baiKey) {
      if (Number(rows[i].best_pct || 0) < pct) {
        rows[i].best_pct = pct;
        dbMarkDirty("da_lam");
      }
      return Number(rows[i].best_pct || 0);
    }
  }
  return pct;
}

function getTienDo(subject, chuongLoc, baiLoc, userId) {
  var best = {};
  if (userId) {
    var uid = Number(userId);
    var dl = dbReadTable("da_lam");
    for (var i = 0; i < dl.length; i++) {
      if (Number(dl[i].user_id) === uid) {
        best[String(dl[i].bai_key)] = Number(dl[i].best_pct || 0);
      }
    }
  }
  var prefix = subject + "/";
  var keys = typeof DAP_AN_BUNDLE !== "undefined" ? Object.keys(DAP_AN_BUNDLE).sort() : [];
  var data = {};
  for (var k = 0; k < keys.length; k++) {
    var rel = keys[k];
    if (rel.indexOf(prefix) !== 0) continue;
    var parts = rel.split("/");
    if (parts.length !== 3) continue;
    var chuong = parts[1];
    var article = parts[2];
    if (chuongLoc && chuong !== chuongLoc) continue;
    if (baiLoc && article !== baiLoc) continue;
    var dapAn = DAP_AN_BUNDLE[rel];
    if (!dapAn || typeof dapAn !== "object") continue;
    var baiIds = Object.keys(dapAn).sort(_cmpKhoaId);
    var ds = {};
    for (var b = 0; b < baiIds.length; b++) {
      var bid = baiIds[b];
      ds[bid] = best[subject + "/" + chuong + "/" + article + "/" + bid] || 0;
    }
    if (!data[chuong]) data[chuong] = {};
    data[chuong][article] = ds;
  }
  return data;
}

// ====================== QUÀ TẶNG & X1.5 (qua_tang.py) ======================
function x15ConLai(x15Den) {
  if (!x15Den) return 0;
  var ms = parseYmdHmsMs(x15Den);
  if (ms === null) return 0;
  return Math.max(0, Math.floor((ms - vnNowUtcMs()) / 1000));
}

function heSoX15(userId) {
  var u = findUserRow(userId);
  return u && x15ConLai(u.x15_den) > 0 ? THUONG_X15 : 0;
}

function _tenQua(q) {
  if (q.loai === "diem") return "+" + q.gia_tri + " điểm";
  if (q.loai === "bao_ho") return "Thẻ bảo hộ streak";
  return "Vòng quay";
}

function quaTrangThai(userId) {
  var u = findUserRow(userId);
  if (!u) return null;
  var tong = Number(u.dd_tong || 0);
  var tienDo = tong > 0 ? ((tong - 1) % QUA_CHU_KY) + 1 : 0;
  var tuanDau = tong <= QUA_CHU_KY;
  var lich = [];
  for (var i = 0; i < QUA_TUAN_DAU.length; i++) {
    var q = QUA_TUAN_DAU[i];
    var ten = tuanDau ? _tenQua(q) : (q.ngay === QUA_CHU_KY ? "Vòng quay" : "Điểm danh");
    lich.push({ ngay: q.ngay, ten: ten, da_nhan: q.ngay <= tienDo });
  }
  return {
    da_diem_danh_hom_nay: String(u.dd_last || "") === vnTodayStr(),
    tong_ngay: tong,
    tien_do: tienDo,
    tuan_dau: tuanDau,
    lich: lich,
    luot_quay: Number(u.luot_quay || 0),
    the_bao_ho: Number(u.the_bao_ho || 0),
    toi_da_bao_ho: TOI_DA_BAO_HO,
    x15_con_lai: x15ConLai(u.x15_den),
    score: Number(u.score || 0),
    streak: streakHienThi(u.streak, u.last_active_date, u.the_bao_ho)
  };
}

function _congBaoHo(u) {
  var cur = Number(u.the_bao_ho || 0);
  if (cur < TOI_DA_BAO_HO) {
    u.the_bao_ho = cur + 1;
    dbMarkDirty("users");
    return true;
  }
  return false;
}

// ====================== HUY HIỆU (huy_hieu.py) ======================
function _tienDoKetHop(a, ma, b, mb) {
  if (a >= ma) return [ma, ma];
  if (b >= mb) return [mb, mb];
  return (a / ma) >= (b / mb) ? [a, ma] : [b, mb];
}

function _tienDoHaiDieuKien(a, ma, b, mb) {
  return (a / ma) <= (b / mb) ? [Math.min(a, ma), ma] : [Math.min(b, mb), mb];
}

function _danhGiaHuyHieu(u) {
  var uid = Number(u.id);
  var score = Number(u.score || 0);
  var mon = String(u.mon_chuyen || "");
  var dd = Number(u.dd_tong || 0);
  var st = streakHienThi(u.streak, u.last_active_date, u.the_bao_ho);

  var daLam = dbReadTable("da_lam");
  var cntBai = 0, cnt80 = 0, cnt100 = 0;
  for (var i = 0; i < daLam.length; i++) {
    if (Number(daLam[i].user_id) === uid) {
      cntBai++;
      var bp = Number(daLam[i].best_pct || 0);
      if (bp >= 80) cnt80++;
      if (bp >= 100) cnt100++;
    }
  }

  var nvNgay = dbReadTable("nv_ngay");
  var byDay = {};
  for (var j = 0; j < nvNgay.length; j++) {
    var nr = nvNgay[j];
    if (Number(nr.user_id) === uid && Number(nr.da_nhan) === 1) {
      var dKey = String(nr.ngay);
      if (!byDay[dKey]) byDay[dKey] = { du3: false, cnt: 0 };
      if (String(nr.nv_id) === "_du3") byDay[dKey].du3 = true;
      else byDay[dKey].cnt++;
    }
  }
  var nvDays = 0;
  var dayKeys = Object.keys(byDay);
  for (var dk = 0; dk < dayKeys.length; dk++) {
    var info = byDay[dayKeys[dk]];
    if (info.du3 || info.cnt >= 3) nvDays++;
  }

  var soLoi = dbReadTable("so_loi");
  var loiDaSua = 0;
  for (var sl = 0; sl < soLoi.length; sl++) {
    if (Number(soLoi[sl].user_id) === uid && Number(soLoi[sl].da_hieu) === 1) loiDaSua++;
  }

  // Khoa bảng titles
  var kbUdh = dbReadTable("kb_user_danh_hieu");
  var kbTitles = {};
  var hasHang1 = false;
  for (var kh = 0; kh < kbUdh.length; kh++) {
    if (Number(kbUdh[kh].user_id) === uid) {
      if (kbUdh[kh].ma_danh_hieu) kbTitles[String(kbUdh[kh].ma_danh_hieu)] = true;
      if (Number(kbUdh[kh].hang) === 1) hasHang1 = true;
    }
  }

  var datGn = !!(kbTitles.giai_nguyen || kbTitles.hoi_nguyen || kbTitles.trang_nguyen || kbTitles.bang_nhan || kbTitles.tham_hoa || hasHang1);
  if (!datGn) {
    var kbKq = dbReadTable("kb_ket_qua");
    var kbKy = dbReadTable("kb_ky");
    var kyLocked = {};
    for (var kyi = 0; kyi < kbKy.length; kyi++) {
      if (String(kbKy[kyi].trang_thai) === "da_khoa") kyLocked[Number(kbKy[kyi].id)] = true;
    }
    for (var kqi = 0; kqi < kbKq.length; kqi++) {
      if (Number(kbKq[kqi].user_id) === uid && kyLocked[Number(kbKq[kqi].ky_id)] && Number(kbKq[kqi].hang) <= 3) {
        datGn = true; break;
      }
    }
  }
  if (!datGn) {
    var contests = dbReadTable("contests");
    var ckq = dbReadTable("contest_ket_qua");
    var nowHm = vnNowHmStr();
    var endedC = {};
    for (var ci = 0; ci < contests.length; ci++) {
      if (String(contests[ci].ket_thuc || "") <= nowHm) endedC[Number(contests[ci].id)] = true;
    }
    for (var cki = 0; cki < ckq.length; cki++) {
      if (Number(ckq[cki].user_id) === uid && Number(ckq[cki].diem) > 0 && endedC[Number(ckq[cki].contest_id)]) {
        var cid = Number(ckq[cki].contest_id);
        var myD = Number(ckq[cki].diem);
        var higher = 0;
        for (var ckj = 0; ckj < ckq.length; ckj++) {
          if (Number(ckq[ckj].contest_id) === cid && Number(ckq[ckj].diem) > myD) higher++;
        }
        if (higher < 3) { datGn = true; break; }
      }
    }
  }
  if (!datGn) {
    var dtRows = dbReadTable("diem_thang");
    var allUsers = dbReadTable("users");
    var uMon = {};
    for (var ui = 0; ui < allUsers.length; ui++) uMon[Number(allUsers[ui].id)] = String(allUsers[ui].mon_chuyen || "");
    for (var dti = 0; dti < dtRows.length; dti++) {
      if (Number(dtRows[dti].user_id) === uid && Number(dtRows[dti].diem || 0) >= 300) {
        var myT = String(dtRows[dti].thang);
        var myPt = Number(dtRows[dti].diem || 0);
        var higherT = 0;
        for (var dtj = 0; dtj < dtRows.length; dtj++) {
          var oUid = Number(dtRows[dtj].user_id);
          if (String(dtRows[dtj].thang) === myT && uMon[oUid] === mon) {
            var oPt = Number(dtRows[dtj].diem || 0);
            if (oPt > myPt || (oPt === myPt && oUid < uid)) higherT++;
          }
        }
        if (higherT < 3) { datGn = true; break; }
      }
    }
  }

  var datHn = !!(kbTitles.hoi_nguyen || kbTitles.trang_nguyen) || (score >= 1500 && cnt80 >= 15);
  var allU = dbReadTable("users");
  var truocTop1 = 0;
  for (var ui2 = 0; ui2 < allU.length; ui2++) {
    var ou = allU[ui2];
    if (String(ou.mon_chuyen || "") === mon) {
      var os = Number(ou.score || 0);
      var oid = Number(ou.id);
      if (os > score || (os === score && oid < uid)) truocTop1++;
    }
  }
  var top1Tong = truocTop1 === 0;
  var datTn = !!kbTitles.trang_nguyen || (score >= 3000 && cnt100 >= 30 && top1Tong);

  var cc = _tienDoKetHop(st, 5, dd, 7);
  var tt = _tienDoKetHop(nvDays, 3, loiDaSua, 10);
  var hn = datHn ? [15, 15] : _tienDoHaiDieuKien(Math.max(0, score), 1500, cnt80, 15);
  var tn = datTn ? [30, 30] : (score >= 3000 && cnt100 >= 30 ? [0, 1] : _tienDoHaiDieuKien(Math.max(0, score), 3000, cnt100, 30));

  return {
    "buoc-chan-dau-tien": [cntBai >= 1, Math.min(cntBai, 1), 1],
    "chuyen-can": [(dd >= 7 || st >= 5), cc[0], cc[1]],
    "tich-tieu-thanh-dai": [(nvDays >= 3 || loiDaSua >= 10), tt[0], tt[1]],
    "bach-phat-bach-trung": [cnt100 >= 5, Math.min(cnt100, 5), 5],
    "giai-nguyen": [datGn, datGn ? 1 : 0, 1],
    "hoi-nguyen": [datHn, hn[0], hn[1]],
    "trang-nguyen": [datTn, tn[0], tn[1]]
  };
}

function kiemTraHuyHieu(userId) {
  var uid = Number(userId);
  if (!uid) return [];
  var moiMo = [];
  var uhRows = dbReadTable("user_huy_hieu");
  for (var round = 0; round < DS_HUY_HIEU.length; round++) {
    var u = findUserRow(uid);
    if (!u) break;
    var daMo = {};
    for (var i = 0; i < uhRows.length; i++) {
      if (Number(uhRows[i].user_id) === uid) daMo[String(uhRows[i].badge_id)] = true;
    }
    var kq = _danhGiaHuyHieu(u);
    var moTrongLuot = false;
    var bayGio = vnNowStr();
    for (var b = 0; b < DS_HUY_HIEU.length; b++) {
      var badge = DS_HUY_HIEU[b];
      var bid = badge.id;
      if (daMo[bid] || !kq[bid][0]) continue;
      var thuong = badge.diem_thuong;
      dbInsert("user_huy_hieu", {
        user_id: uid, badge_id: bid, unlocked_at: bayGio, diem_thuong: thuong
      }, false);
      moTrongLuot = true;
      if (thuong > 0) {
        updateUserScore(uid, thuong);
      }
      moiMo.push({ id: bid, ten: badge.ten, diem_thuong: thuong, anh: badge.anh });
    }
    if (!moTrongLuot) break;
  }
  return moiMo;
}

function layDuLieuHuyHieu(userId) {
  var uid = Number(userId);
  var moiMo = kiemTraHuyHieu(uid);
  var u = findUserRow(uid);
  if (!u) return null;
  var uhRows = dbReadTable("user_huy_hieu");
  var unlocked = {};
  for (var i = 0; i < uhRows.length; i++) {
    if (Number(uhRows[i].user_id) === uid) unlocked[String(uhRows[i].badge_id)] = String(uhRows[i].unlocked_at || "");
  }
  var dangDeo = unlocked[String(u.huy_hieu || "")] !== undefined ? String(u.huy_hieu) : "";
  if (u.huy_hieu && !dangDeo) {
    u.huy_hieu = "";
    dbMarkDirty("users");
  }
  var kq = _danhGiaHuyHieu(u);
  var ds = [];
  for (var b = 0; b < DS_HUY_HIEU.length; b++) {
    var item = DS_HUY_HIEU[b];
    var daMo = unlocked[item.id] !== undefined;
    var td = kq[item.id][1], mt = kq[item.id][2];
    ds.push({
      id: item.id, ten: item.ten, mo_ta: item.mo_ta, anh: item.anh, diem_thuong: item.diem_thuong,
      da_mo: daMo, dang_deo: daMo && dangDeo === item.id,
      tien_do: daMo ? mt : td, muc_tieu: mt, unlocked_at: unlocked[item.id] || ""
    });
  }
  return { ds: ds, dang_deo: dangDeo, moi_mo: moiMo, score: Number(u.score || 0) };
}

// ====================== NHIỆM VỤ (nhiem_vu.py) ======================
function _nvMap() {
  var m = {};
  for (var i = 0; i < DS_NV.length; i++) m[DS_NV[i].id] = DS_NV[i];
  return m;
}

function nvGhiSuKien(userId, khoa, them) {
  them = them == null ? 1 : them;
  var uid = Number(userId);
  var ngay = vnTodayStr();
  var rows = dbReadTable("nv_tien_do");
  for (var i = 0; i < rows.length; i++) {
    if (Number(rows[i].user_id) === uid && String(rows[i].ngay) === ngay && String(rows[i].khoa) === khoa) {
      rows[i].gia_tri = Number(rows[i].gia_tri || 0) + them;
      dbMarkDirty("nv_tien_do");
      return;
    }
  }
  dbInsert("nv_tien_do", { user_id: uid, ngay: ngay, khoa: khoa, gia_tri: them }, false);
}

function _nvDanhDauMoi(userId, khoa) {
  var uid = Number(userId);
  var ngay = vnTodayStr();
  var rows = dbReadTable("nv_tien_do");
  for (var i = 0; i < rows.length; i++) {
    if (Number(rows[i].user_id) === uid && String(rows[i].ngay) === ngay && String(rows[i].khoa) === khoa) {
      return false;
    }
  }
  dbInsert("nv_tien_do", { user_id: uid, ngay: ngay, khoa: khoa, gia_tri: 1 }, false);
  return true;
}

function nvGhiSuKienNopBai(userId, subject, baiKey, ketQua, pct, bestCu) {
  var uid = _toInt(userId, null);
  if (!uid || !ketQua || typeof ketQua !== "object") return;
  if (!findUserRow(uid)) return;
  var keys = Object.keys(ketQua);
  var soCau = keys.length;
  var daTraLoi = 0, soDung = 0;
  for (var i = 0; i < keys.length; i++) {
    var r = ketQua[keys[i]];
    if (r && typeof r === "object" && r.dung !== null && r.dung !== undefined) {
      daTraLoi++;
      if (r.dung) soDung++;
    }
  }
  if (!soCau || daTraLoi * 2 < soCau) return;
  var lanDau = _nvDanhDauMoi(uid, "bai:" + baiKey);
  _nvDanhDauMoi(uid, "mon:" + subject);
  if (lanDau) nvGhiSuKien(uid, "cau_dung", soDung);
  if (pct >= 80) nvGhiSuKien(uid, "bai_80", 1);
  if (pct >= 100) nvGhiSuKien(uid, "bai_100", 1);
  if (bestCu !== null && bestCu !== undefined && pct > bestCu) nvGhiSuKien(uid, "nang_hang", 1);
}

function _nvDuDieuKien(uid, nv) {
  var can = nv.can;
  if (!can) return true;
  if (can === "co_ky_nang") {
    var kn = dbReadTable("ky_nang_user");
    for (var i = 0; i < kn.length; i++) if (Number(kn[i].user_id) === uid) return true;
    return false;
  }
  if (can === "den_han_2") {
    var homNay = vnTodayStr();
    var kn2 = dbReadTable("ky_nang_user"), cnt = 0;
    for (var j = 0; j < kn2.length; j++) {
      if (Number(kn2[j].user_id) === uid && kn2[j].ngay_on_ke && String(kn2[j].ngay_on_ke) <= homNay) cnt++;
    }
    return cnt >= 2;
  }
  if (can === "bai_chua_max") {
    var dl = dbReadTable("da_lam");
    for (var k = 0; k < dl.length; k++) {
      if (Number(dl[k].user_id) === uid && Number(dl[k].best_pct || 0) < 100) return true;
    }
    return false;
  }
  return true;
}

function _nvDocDs(uid, ngay) {
  var map = _nvMap();
  var rows = dbReadTable("nv_ngay");
  var ids = {};
  for (var i = 0; i < rows.length; i++) {
    if (Number(rows[i].user_id) === uid && String(rows[i].ngay) === ngay && map[String(rows[i].nv_id)]) {
      ids[String(rows[i].nv_id)] = true;
    }
  }
  return Object.keys(ids).sort(function (a, b) {
    return NV_THU_TU_KHO.indexOf(map[a].kho) - NV_THU_TU_KHO.indexOf(map[b].kho);
  });
}

function _nvDsHomNay(uid, ngay) {
  var ids = _nvDocDs(uid, ngay);
  if (ids.length < 3) {
    var homQua = addDaysYmd(ngay, -1);
    var daRa = {};
    var hqIds = _nvDocDs(uid, homQua);
    for (var h = 0; h < hqIds.length; h++) daRa[hqIds[h]] = true;
    var rng = _seededRng(uid + "|" + ngay);
    var existing = dbReadTable("nv_ngay");
    for (var k = 0; k < NV_THU_TU_KHO.length; k++) {
      var kho = NV_THU_TU_KHO[k];
      var cungKho = DS_NV.filter(function (n) { return n.kho === kho; });
      var pool = cungKho.filter(function (n) { return !daRa[n.id] && _nvDuDieuKien(uid, n); });
      if (!pool.length) pool = cungKho.filter(function (n) { return _nvDuDieuKien(uid, n); });
      if (!pool.length) pool = cungKho;
      var pick = pool[Math.floor(rng() * pool.length)];
      var hasIt = false;
      for (var e = 0; e < existing.length; e++) {
        if (Number(existing[e].user_id) === uid && String(existing[e].ngay) === ngay && String(existing[e].nv_id) === pick.id) {
          hasIt = true; break;
        }
      }
      if (!hasIt) dbInsert("nv_ngay", { user_id: uid, ngay: ngay, nv_id: pick.id, da_nhan: 0 }, false);
    }
    ids = _nvDocDs(uid, ngay);
  }
  return ids;
}

function _nvTienDo(uid, ngay, nv) {
  var v = 0;
  if (nv.do_type === "dd") {
    var u = findUserRow(uid);
    v = u && String(u.dd_last || "") === ngay ? 1 : 0;
  } else if (nv.do_type === "khoa") {
    var rows = dbReadTable("nv_tien_do");
    for (var i = 0; i < rows.length; i++) {
      if (Number(rows[i].user_id) === uid && String(rows[i].ngay) === ngay && String(rows[i].khoa) === nv.do_key) {
        v = Number(rows[i].gia_tri || 0); break;
      }
    }
  } else {
    var rows2 = dbReadTable("nv_tien_do");
    for (var j = 0; j < rows2.length; j++) {
      if (Number(rows2[j].user_id) === uid && String(rows2[j].ngay) === ngay && String(rows2[j].khoa || "").indexOf(nv.do_key) === 0) {
        v++;
      }
    }
  }
  return Math.min(v, nv.muc_tieu);
}

function nvTrangThai(userId) {
  var uid = Number(userId);
  var ngay = vnTodayStr();
  var ids = _nvDsHomNay(uid, ngay);
  var map = _nvMap();
  var nvRows = dbReadTable("nv_ngay");
  var nhan = {};
  for (var i = 0; i < nvRows.length; i++) {
    if (Number(nvRows[i].user_id) === uid && String(nvRows[i].ngay) === ngay) {
      nhan[String(nvRows[i].nv_id)] = Number(nvRows[i].da_nhan || 0);
    }
  }
  var ds = [], soDaNhan = 0;
  for (var k = 0; k < ids.length; k++) {
    var nv = map[ids[k]];
    var td = _nvTienDo(uid, ngay, nv);
    var dn = !!nhan[nv.id];
    if (dn) soDaNhan++;
    ds.push({
      id: nv.id, ten: nv.ten, mo_ta: nv.mo_ta, icon: nv.icon, link: nv.link,
      kho: nv.kho, ten_kho: NV_THUONG[nv.kho].ten, thuong_diem: NV_THUONG[nv.kho].diem,
      muc_tieu: nv.muc_tieu, tien_do: td, xong: td >= nv.muc_tieu, da_nhan: dn
    });
  }
  return {
    ngay: ngay, ds: ds, so_da_nhan: soDaNhan,
    da_nhan_du_3: !!nhan["_du3"], thuong_du_3: { luot_quay: NV_LUOT_QUAY_DU_3 }
  };
}

// ====================== SỔ LỖI SAI (so_loi.py) ======================
var SL_KEY_RE = /^([a-z0-9_-]+)\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/([0-9.]+)$/;

function _slDsBai(de) {
  if (Array.isArray(de.bai_tap)) return de.bai_tap;
  var ch = Array.isArray(de.cau_hoi) ? de.cau_hoi : [];
  return ch.map(function (c) {
    return { id: c.id, ten: "", tac_pham: de.tac_pham, cau_hoi: [c] };
  });
}

function _slTaiBai(baiKey) {
  var m = SL_KEY_RE.exec(baiKey || "");
  if (!m) return null;
  var rel = m[1] + "/" + m[2] + "/" + m[3];
  var baiId = m[4];
  var de = getDeData(rel);
  var da = getDapAnData(rel);
  if (!de || !da || typeof da !== "object") return null;
  var dapAn = da[baiId];
  var baiList = _slDsBai(de);
  var bai = null;
  for (var i = 0; i < baiList.length; i++) {
    if (String(baiList[i].id) === baiId) { bai = baiList[i]; break; }
  }
  if (!bai || !dapAn || typeof dapAn !== "object") return null;
  return { de: de, bai: bai, dap_an: dapAn };
}

function _slTimCau(tai, cauId) {
  var ds = tai && tai.bai && Array.isArray(tai.bai.cau_hoi) ? tai.bai.cau_hoi : [];
  for (var i = 0; i < ds.length; i++) {
    if (String(ds[i].id) === String(cauId)) return ds[i];
  }
  return null;
}

function _slDeDayDu(bai, cau) {
  var de = cau.de_bai || "";
  var m = /^(\d+)([b-h])$/.exec(String(cau.id || ""));
  if (cau.type === "dung-sai" && m) {
    var ds = bai.cau_hoi || [];
    for (var i = 0; i < ds.length; i++) {
      if (String(ds[i].id) === m[1] + "a") {
        return String(ds[i].de_bai || "").split("<br><b>a)</b>")[0] + "<br>" + de;
      }
    }
  }
  return de;
}

function _slCauChoClient(bai, cau) {
  var hinh = Array.isArray(cau.hinh) ? cau.hinh : (cau.hinh ? [cau.hinh] : []);
  return {
    id: String(cau.id), type: cau.type, de_bai: _slDeDayDu(bai, cau),
    dap_an: cau.type === "trac-nghiem" ? cau.dap_an : null,
    hinh: hinh, diem: cau.diem
  };
}

function _slTenKyNang(baiKey) {
  var m = SL_KEY_RE.exec(baiKey);
  var subject = m[1], chapter = m[2], article = m[3], baiId = m[4];
  var tong = getDeData(subject + "/tong-hop") || {};
  var baiHoc = "";
  var chuongList = Array.isArray(tong.chuong_list) ? tong.chuong_list : [];
  for (var i = 0; i < chuongList.length; i++) {
    if (chuongList[i].id_chuong === chapter) {
      var dsBai = chuongList[i].danh_sach_bai || [];
      for (var j = 0; j < dsBai.length; j++) {
        if ("bai-" + dsBai[j].id === article) baiHoc = dsBai[j].ten_bai || "";
      }
    }
  }
  var de = getDeData(subject + "/" + chapter + "/" + article) || {};
  var ten = "";
  var baiList = _slDsBai(de);
  for (var k = 0; k < baiList.length; k++) {
    if (String(baiList[k].id) === baiId) { ten = baiList[k].ten || ""; break; }
  }
  return {
    mon: subject, bai_hoc: baiHoc,
    mon_ten: tong.mon || SL_TEN_MON[subject] || subject.replace(/_/g, " "),
    ten: "Bài " + baiId + (ten ? ": " + ten : "")
  };
}

function _slCham(dapAnDung, traLoi) {
  var a = String(dapAnDung == null ? "" : dapAnDung).trim().toLowerCase().replace(/,/g, ".").replace(/ /g, "");
  var b = String(traLoi == null ? "" : traLoi).trim().toLowerCase().replace(/,/g, ".").replace(/ /g, "");
  if (a === b) return true;
  var fa = Number(a), fb = Number(b);
  if (a !== "" && b !== "" && !isNaN(fa) && !isNaN(fb)) {
    return Math.abs(fa - fb) < 1e-9;
  }
  return false;
}

function _slDapAnHien(cau, dap) {
  var d = dap ? dap.dap_an_dung : "";
  if (cau.type === "trac-nghiem") {
    var i = parseInt(d, 10);
    if (!isNaN(i) && Array.isArray(cau.dap_an) && i >= 0 && i < cau.dap_an.length) {
      return "ABCDEF".charAt(i) + ". " + cau.dap_an[i];
    }
    return _escHtml(d);
  }
  if (cau.type === "dung-sai") {
    return String(d).trim().toLowerCase() === "true" ? "Đúng" : "Sai";
  }
  return _escHtml(d);
}

function _slNoiDungGoiY(tang, tai, cau, dap, theId) {
  if (tang === 1) {
    return {
      kieu: "ly_thuyet", tieu_de: "Nhắc lại khái niệm",
      html: (tai.de && tai.de.ly_thuyet) || "<p>Bài này chưa có lý thuyết. Hãy đọc kỹ đề và các dữ kiện đã cho.</p>"
    };
  }
  if (tang === 2) {
    if (cau.goi_y) return { kieu: "huong", tieu_de: "Gợi ý hướng làm", html: cau.goi_y };
    if (cau.type === "trac-nghiem") {
      var dung = parseInt(dap && dap.dap_an_dung, 10);
      if (isNaN(dung)) dung = -1;
      var sai = [];
      var opts = cau.dap_an || [];
      for (var i = 0; i < opts.length; i++) if (i !== dung) sai.push(i);
      var rng = _seededRng(String(theId));
      for (var s = sai.length - 1; s > 0; s--) {
        var r = Math.floor(rng() * (s + 1));
        var tmp = sai[s]; sai[s] = sai[r]; sai[r] = tmp;
      }
      var loaiBo = sai.slice(0, Math.max(0, Math.min(2, sai.length - 1)));
      return {
        kieu: "huong", tieu_de: "Gợi ý hướng làm", loai_bo: loaiBo,
        html: "Mình đã loại bớt " + loaiBo.length + " đáp án sai. Hãy cân nhắc các đáp án còn lại."
      };
    }
    if (cau.type === "tra-loi-ngan") {
      return {
        kieu: "huong", tieu_de: "Gợi ý hướng làm",
        html: "Đáp án gồm <b>" + String((dap && dap.dap_an_dung) || "").length + "</b> ký tự. Hãy kiểm tra lại từng bước tính."
      };
    }
    return {
      kieu: "huong", tieu_de: "Gợi ý hướng làm",
      html: "Hãy tách đề thành từng vế, đối chiếu từng vế với định nghĩa hoặc công thức trong phần lý thuyết."
    };
  }
  return {
    kieu: "loi_giai", tieu_de: "Lời giải",
    html: (dap && dap.loi_giai) || "<p>Câu này chưa có lời giải chi tiết.</p>",
    dap_an_hien: _slDapAnHien(cau, dap)
  };
}

function _slGhiLoi(uid, baiKey, cauId, homNay, themLan) {
  var rows = dbReadTable("so_loi");
  for (var i = 0; i < rows.length; i++) {
    if (Number(rows[i].user_id) === uid && String(rows[i].bai_key) === baiKey && String(rows[i].cau_id) === String(cauId)) {
      if (themLan) rows[i].so_lan_sai = Number(rows[i].so_lan_sai || 0) + 1;
      rows[i].lan_cuoi = homNay;
      rows[i].da_hieu = 0;
      dbMarkDirty("so_loi");
      return;
    }
  }
  dbInsert("so_loi", {
    user_id: uid, bai_key: baiKey, cau_id: String(cauId),
    nguyen_nhan: "", so_lan_sai: 1, lan_cuoi: homNay, da_hieu: 0
  }, false);
}

function _slMoLaiKyNang(uid, baiKey, homNay) {
  var rows = dbReadTable("ky_nang_user");
  for (var i = 0; i < rows.length; i++) {
    if (Number(rows[i].user_id) === uid && String(rows[i].bai_key) === baiKey) {
      var hen = String(rows[i].ngay_on_ke || "");
      if (!hen || hen > homNay) {
        rows[i].muc = Math.max(Number(rows[i].muc || 0) - 1, 0);
        rows[i].ngay_on_ke = homNay;
        dbMarkDirty("ky_nang_user");
      }
      return;
    }
  }
  dbInsert("ky_nang_user", {
    user_id: uid, bai_key: baiKey, muc: 0, ngay_on_ke: homNay,
    so_lan_dat: 0, so_lan_chua_dat: 0, lan_on_cuoi: ""
  }, false);
}

function soLoiGhiKetQuaNopBai(userId, baiKey, ketQua) {
  var uid = _toInt(userId, null);
  if (!uid || !findUserRow(uid)) return [];
  var sai = [], dung = [];
  var keys = Object.keys(ketQua);
  for (var i = 0; i < keys.length; i++) {
    var cid = keys[i];
    var r = ketQua[cid];
    if (r && r.tu_luan === undefined) {
      if (r.dung === false) sai.push(cid);
      else if (r.dung === true) dung.push(cid);
    }
  }
  var homNay = vnTodayStr();
  for (var s = 0; s < sai.length; s++) {
    _slGhiLoi(uid, baiKey, sai[s], homNay, true);
    if (GIAU_LOI_GIAI_KHI_SAI) ketQua[sai[s]].loi_giai = "";
  }
  if (dung.length) {
    var slRows = dbReadTable("so_loi");
    var dungSet = {};
    for (var d = 0; d < dung.length; d++) dungSet[String(dung[d])] = true;
    for (var j = 0; j < slRows.length; j++) {
      if (Number(slRows[j].user_id) === uid && String(slRows[j].bai_key) === baiKey && dungSet[String(slRows[j].cau_id)]) {
        slRows[j].da_hieu = 1;
        dbMarkDirty("so_loi");
      }
    }
  }
  if (sai.length) _slMoLaiKyNang(uid, baiKey, homNay);
  kiemTraHuyHieu(uid);
  return sai.map(String);
}

function _slCapNhatMuc(uid, baiKey, ketQua, homNay) {
  var knRows = dbReadTable("ky_nang_user");
  var kn = null;
  for (var i = 0; i < knRows.length; i++) {
    if (Number(knRows[i].user_id) === uid && String(knRows[i].bai_key) === baiKey) { kn = knRows[i]; break; }
  }
  var tt = { tinh: false, muc_truoc: 0, muc_sau: 0, ngay_on_ke: "", thuong_diem: 0 };
  if (!kn) return tt;
  var muc = Number(kn.muc || 0), hen = String(kn.ngay_on_ke || "");
  tt.muc_truoc = muc; tt.muc_sau = muc; tt.ngay_on_ke = hen;
  if (!(hen && hen <= homNay)) return tt;
  tt.tinh = true;
  var moi = muc, henMoi = hen, diem = 0;
  if (ketQua === "dat") {
    if (muc < 3) {
      moi = muc + 1;
      henMoi = addDaysYmd(homNay, SL_LICH_ON[moi]);
      diem = SL_THUONG_LEN_MUC[moi];
    } else {
      henMoi = "";
      diem = SL_THUONG_GHI_NHO_LAU;
    }
  } else if (ketQua === "chua_dat" && muc > 0) {
    moi = muc - 1;
    henMoi = addDaysYmd(homNay, 1);
  }
  kn.muc = moi;
  kn.ngay_on_ke = henMoi;
  kn.lan_on_cuoi = homNay;
  if (ketQua === "dat") kn.so_lan_dat = Number(kn.so_lan_dat || 0) + 1;
  if (ketQua === "chua_dat") kn.so_lan_chua_dat = Number(kn.so_lan_chua_dat || 0) + 1;
  dbMarkDirty("ky_nang_user");
  if (diem) {
    congDiemVaEduCoin(uid, diem, false);
  }
  tt.muc_sau = moi; tt.ngay_on_ke = henMoi; tt.thuong_diem = diem;
  return tt;
}

function _slKetThucThe(uid, the, ketQua) {
  var homNay = vnTodayStr();
  the.ket_qua = ketQua;
  dbMarkDirty("on_tap_the");
  var tt;
  if (the.loai === "sua") {
    var sl = dbReadTable("so_loi");
    for (var i = 0; i < sl.length; i++) {
      if (Number(sl[i].user_id) === uid && String(sl[i].bai_key) === String(the.bai_key) && String(sl[i].cau_id) === String(the.cau_id)) {
        sl[i].da_hieu = 1; dbMarkDirty("so_loi");
      }
    }
    tt = { tinh: false };
  } else {
    tt = _slCapNhatMuc(uid, String(the.bai_key), ketQua, homNay);
    if (ketQua === "dat" && tt.tinh) nvGhiSuKien(uid, "chung_minh", 1);
  }
  nvGhiSuKien(uid, "on_the", 1);
  kiemTraHuyHieu(uid);
  return tt;
}

// ====================== KHOA BẢNG (khoa_bang.py) ======================
function kbDocCauHinh(cap) {
  var cfg = JSON.parse(JSON.stringify(KB_CAU_HINH_MAC_DINH[cap]));
  var rows = dbReadTable("kb_cau_hinh");
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].khoa) === cap) {
      try {
        var custom = JSON.parse(rows[i].gia_tri);
        var ks = Object.keys(custom);
        for (var k = 0; k < ks.length; k++) cfg[ks[k]] = custom[ks[k]];
      } catch (e) {}
      break;
    }
  }
  return cfg;
}

function kbKhoangKy(cap, ngayYmd) {
  var ymd = ngayYmd || vnTodayStr();
  var dt = parseYmd(ymd);
  var y = dt.getUTCFullYear();
  var m = dt.getUTCMonth(); // 0..11
  if (cap === "huong") {
    var wd = (dt.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
    var bd = new Date(dt.getTime() - wd * 86400000);
    var kt = new Date(bd.getTime() + 6 * 86400000);
    // ISO week number
    var thu = new Date(bd.getTime() + 3 * 86400000);
    var isoYear = thu.getUTCFullYear();
    var jan4 = new Date(Date.UTC(isoYear, 0, 4, 12, 0, 0));
    var jan4Wd = (jan4.getUTCDay() + 6) % 7;
    var week1Mon = new Date(jan4.getTime() - jan4Wd * 86400000);
    var tuan = Math.round((bd.getTime() - week1Mon.getTime()) / (7 * 86400000)) + 1;
    return [isoYear + "-W" + (tuan < 10 ? "0" + tuan : tuan), fmtYmdUtc(bd), fmtYmdUtc(kt)];
  }
  if (cap === "hoi") {
    var bd2 = new Date(Date.UTC(y, m, 1, 12, 0, 0));
    var kt2 = new Date(Date.UTC(y, m + 1, 0, 12, 0, 0));
    var mm = m + 1;
    return [y + "-" + (mm < 10 ? "0" + mm : mm), fmtYmdUtc(bd2), fmtYmdUtc(kt2)];
  }
  var q = Math.floor(m / 3);
  var bd3 = new Date(Date.UTC(y, q * 3, 1, 12, 0, 0));
  var kt3 = new Date(Date.UTC(y, q * 3 + 3, 0, 12, 0, 0));
  return [y + "-Q" + (q + 1), fmtYmdUtc(bd3), fmtYmdUtc(kt3)];
}

function kbHanChot(cap, kt) {
  return cap === "huong" ? kt : kbKhoangKy("huong", kt)[2];
}

function kbGhiHoatDong(userId, baiKey, ketQua, pct) {
  try {
    var uid = _toInt(userId, null);
    if (!uid || !findUserRow(uid)) return;
    var keys = Object.keys(ketQua);
    var soCau = keys.length, soTraLoi = 0, soDung = 0;
    for (var i = 0; i < keys.length; i++) {
      var r = ketQua[keys[i]];
      if (r && r.dung !== null && r.dung !== undefined) {
        soTraLoi++;
        if (r.dung) soDung++;
      }
    }
    if (!soCau || !soTraLoi) return;
    var hdRows = dbReadTable("kb_hoat_dong");
    var lastTd = null;
    for (var j = hdRows.length - 1; j >= 0; j--) {
      if (Number(hdRows[j].user_id) === uid) { lastTd = hdRows[j].thoi_diem; break; }
    }
    var nowMs = vnNowUtcMs();
    var thoiDiem = vnNowStr();
    var ngay = vnTodayStr();
    if (lastTd && soCau >= 5) {
      var prevMs = parseYmdHmsMs(lastTd);
      if (prevMs !== null) {
        var khoang = (nowMs - prevMs) / 1000;
        if (khoang < KB_GIAY_NOP_NHANH) {
          dbInsert("kb_vi_pham", {
            user_id: uid, ky_id: null, ly_do: "Nộp 2 bài cách nhau " + khoang.toFixed(1) + " giây",
            bai_key: baiKey, trang_thai: "cho_duyet", tao_luc: thoiDiem
          }, true);
        }
      }
    }
    dbInsert("kb_hoat_dong", {
      user_id: uid, bai_key: baiKey, thoi_diem: thoiDiem, ngay: ngay,
      so_cau: soCau, so_tra_loi: soTraLoi, so_dung: soDung, pct: Math.round(pct)
    }, true);
  } catch (e) {}
}

function _kbLamMuot(tongPct, n, k, prior) {
  return (n + k) ? (tongPct + k * prior) / (n + k) : prior;
}

function _kbThongKeHuong(uid, bd, kt, cfg) {
  var rows = dbReadTable("kb_hoat_dong").filter(function (r) {
    return Number(r.user_id) === uid && String(r.ngay) >= bd && String(r.ngay) <= kt && Number(r.so_tra_loi) > 0;
  }).sort(function (a, b) { return Number(a.id) - Number(b.id); });
  var dau = {}, tot = {}, ngaySet = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!dau[r.bai_key]) dau[r.bai_key] = r;
    tot[r.bai_key] = Math.max(tot[r.bai_key] || 0, Number(r.pct || 0));
    ngaySet[r.ngay] = true;
  }
  var totKeys = Object.keys(tot);
  var n = totKeys.length, sumTot = 0;
  for (var j = 0; j < n; j++) sumTot += tot[totKeys[j]];
  var luyenDe = _kbLamMuot(sumTot, n, cfg.prior_k, cfg.prior_pct);
  var traLoi = 0, soCau = 0, soDung = 0;
  var dauKeys = Object.keys(dau);
  for (var d = 0; d < dauKeys.length; d++) {
    var dr = dau[dauKeys[d]];
    traLoi += Number(dr.so_tra_loi || 0);
    soCau += Number(dr.so_cau || 0);
    soDung += Number(dr.so_dung || 0);
  }
  var soNgay = Object.keys(ngaySet).length;
  var soNgayKy = diffDaysYmd(kt, bd) + 1;
  return {
    n_bai: n, luyen_de: luyenDe,
    chinh_xac: traLoi ? (100 * soDung / traLoi) : 0,
    hoan_thanh: soCau ? (100 * traLoi / soCau) : 0,
    chuyen_can: Math.min(100, 100 * soNgay / soNgayKy),
    lan_cuoi: rows.length ? String(rows[rows.length - 1].thoi_diem) : "9999"
  };
}

function _kbCoTrongSo(w, tp) {
  var sumW = 0, sumV = 0;
  var ks = Object.keys(w);
  for (var i = 0; i < ks.length; i++) {
    sumW += w[ks[i]];
    sumV += w[ks[i]] * tp[ks[i]];
  }
  return Math.round((sumV / sumW) * 10000) / 10000;
}

function _kbTinhDiemHuong(uid, bd, kt, cfg) {
  var tk = _kbThongKeHuong(uid, bd, kt, cfg);
  var prev = kbKhoangKy("huong", addDaysYmd(bd, -1));
  var cu = _kbThongKeHuong(uid, prev[1], prev[2], cfg);
  var tienBo = cu.n_bai === 0 ? 50.0 : Math.max(0.0, Math.min(100.0, 50 + 2 * (tk.luyen_de - cu.luyen_de)));
  var cxHt = (tk.chinh_xac + tk.hoan_thanh) / 2;
  var tp = { luyen_de: tk.luyen_de, chinh_xac: cxHt, chuyen_can: tk.chuyen_can, tien_bo: tienBo };
  var tong = _kbCoTrongSo(cfg.trong_so, tp);
  var tpRound = {};
  Object.keys(tp).forEach(function (k) { tpRound[k] = Math.round(tp[k] * 100) / 100; });
  return {
    diem_tong: tong, thanh_phan: tpRound, n_bai: tk.n_bai,
    chinh_xac: Math.round(tk.chinh_xac * 100) / 100, lan_cuoi: tk.lan_cuoi
  };
}

function _kbBiLoai(bd, kt) {
  var vp = dbReadTable("kb_vi_pham");
  var set = {};
  for (var i = 0; i < vp.length; i++) {
    var d10 = String(vp[i].tao_luc || "").slice(0, 10);
    if (String(vp[i].trang_thai) === "xac_nhan" && d10 >= bd && d10 <= kt) {
      set[Number(vp[i].user_id)] = true;
    }
  }
  return set;
}

function _kbTimCuocThi(loai, bd, kt) {
  var ct = dbReadTable("contests").filter(function (c) {
    var d10 = String(c.bat_dau || "").slice(0, 10);
    return String(c.loai || "") === loai && d10 >= bd && d10 <= kt;
  }).sort(function (a, b) { return String(b.bat_dau).localeCompare(String(a.bat_dau)); });
  return ct.length ? Number(ct[0].id) : null;
}

function _kbMonBang(bang) {
  if (BANG_XEP_HANG[bang]) return BANG_XEP_HANG[bang][1];
  return bang === "khong-chuyen" ? "" : String(bang || "");
}

function _kbKetQuaCuocThi(cid, bang) {
  if (!cid) return {};
  var dap = getDapAnData("contest/" + cid);
  if (!dap) return {};
  var tong = 0;
  Object.keys(dap).forEach(function (k) { tong += Number(dap[k].diem != null ? dap[k].diem : 10); });
  if (!tong) return {};
  var mon = _kbMonBang(bang);
  var uMap = {};
  dbReadTable("users").forEach(function (u) { uMap[Number(u.id)] = String(u.mon_chuyen || ""); });
  var out = {};
  dbReadTable("contest_ket_qua").forEach(function (r) {
    if (Number(r.contest_id) === Number(cid) && uMap[Number(r.user_id)] === mon) {
      out[Number(r.user_id)] = Math.min(100.0, 100.0 * Number(r.diem || 0) / tong);
    }
  });
  return out;
}

function kbLayHoacTaoKy(cap, bang, ngayYmd) {
  var kInfo = kbKhoangKy(cap, ngayYmd);
  var ma = kInfo[0], bd = kInfo[1], kt = kInfo[2];
  var kys = dbReadTable("kb_ky");
  var ky = null;
  for (var i = 0; i < kys.length; i++) {
    if (String(kys[i].cap) === cap && String(kys[i].ma) === ma && String(kys[i].bang) === bang) {
      ky = kys[i]; break;
    }
  }
  if (!ky) {
    ky = dbInsert("kb_ky", {
      cap: cap, ma: ma, bat_dau: bd, ket_thuc: kt, bang: bang,
      trang_thai: "mo", contest_id: null, khao_hach_id: null
    }, true);
  }
  if (String(ky.trang_thai) === "mo" && (cap === "hoi" || cap === "dinh")) {
    if (ky.contest_id === null || ky.contest_id === "") {
      var cid = _kbTimCuocThi(cap, bd, kt);
      if (cid) { ky.contest_id = cid; dbMarkDirty("kb_ky"); }
    }
    if (cap === "hoi" && (ky.khao_hach_id === null || ky.khao_hach_id === "")) {
      var kid = _kbTimCuocThi("khao_hach", bd, kt);
      if (kid) { ky.khao_hach_id = kid; dbMarkDirty("kb_ky"); }
    }
  }
  return ky;
}

function _kbTbCacKy(capCon, bang, bd, kt) {
  var kys = dbReadTable("kb_ky").filter(function (k) {
    return String(k.cap) === capCon && String(k.bang) === bang && String(k.trang_thai) === "da_khoa" && String(k.bat_dau) >= bd && String(k.bat_dau) <= kt;
  });
  var kyIds = {};
  kys.forEach(function (k) { kyIds[Number(k.id)] = true; });
  var tong = {}, dem = {};
  dbReadTable("kb_ket_qua").forEach(function (r) {
    if (kyIds[Number(r.ky_id)]) {
      var uid = Number(r.user_id);
      tong[uid] = (tong[uid] || 0) + Number(r.diem_tong || 0);
      dem[uid] = (dem[uid] || 0) + 1;
    }
  });
  var n = kys.length, tb = {};
  if (n > 0) Object.keys(tong).forEach(function (u) { tb[u] = tong[u] / n; });
  return { tb: tb, n: n, dem: dem };
}

function kbTinhKetQuaKy(ky) {
  var cap = String(ky.cap), bang = String(ky.bang), bd = String(ky.bat_dau), kt = String(ky.ket_thuc);
  var cfg = kbDocCauHinh(cap);
  var ds = [];
  if (cap === "huong") {
    var mon = _kbMonBang(bang);
    var uMap = {};
    dbReadTable("users").forEach(function (u) { uMap[Number(u.id)] = String(u.mon_chuyen || ""); });
    var uidSet = {};
    dbReadTable("kb_hoat_dong").forEach(function (h) {
      if (String(h.ngay) >= bd && String(h.ngay) <= kt && uMap[Number(h.user_id)] === mon) {
        uidSet[Number(h.user_id)] = true;
      }
    });
    Object.keys(uidSet).forEach(function (uStr) {
      var uid = Number(uStr);
      var d = _kbTinhDiemHuong(uid, bd, kt, cfg);
      if (d.n_bai >= cfg.toi_thieu_bai) {
        ds.push({
          user_id: uid, diem_tong: d.diem_tong,
          chi_tiet: Object.assign({}, d.thanh_phan, { n_bai: d.n_bai }),
          _cx: d.chinh_xac, _lc: d.lan_cuoi
        });
      }
    });
    ds.sort(function (a, b) {
      return (b.diem_tong - a.diem_tong) || (b.chi_tiet.luyen_de - a.chi_tiet.luyen_de) ||
             (b._cx - a._cx) || (b.chi_tiet.chuyen_can - a.chi_tiet.chuyen_can) ||
             a._lc.localeCompare(b._lc) || (a.user_id - b.user_id);
    });
  } else if (cap === "hoi") {
    var kq = _kbKetQuaCuocThi(ky.contest_id, bang);
    var kh = ky.khao_hach_id ? _kbKetQuaCuocThi(ky.khao_hach_id, bang) : null;
    var huongTb = _kbTbCacKy("huong", bang, bd, kt).tb;
    var maTruoc = kbKhoangKy("hoi", addDaysYmd(bd, -1))[0];
    var kyTruoc = dbReadTable("kb_ky").filter(function (k) {
      return String(k.cap) === "hoi" && String(k.ma) === maTruoc && String(k.bang) === bang;
    })[0];
    var pctTruoc = {};
    if (kyTruoc) {
      dbReadTable("kb_ket_qua").forEach(function (r) {
        if (Number(r.ky_id) === Number(kyTruoc.id)) {
          try { pctTruoc[Number(r.user_id)] = JSON.parse(r.chi_tiet || "{}").thi_hoi; } catch (e) {}
        }
      });
    }
    Object.keys(kq).forEach(function (uStr) {
      var uid = Number(uStr), pct = kq[uid];
      if (kh !== null && (kh[uid] || 0) < cfg.khao_hach_san) return;
      var cu = pctTruoc[uid];
      var tb = cu == null ? 50.0 : Math.max(0.0, Math.min(100.0, 50 + (pct - cu)));
      var tp = { thi_hoi: pct, thi_huong: huongTb[uid] || 0.0, tien_bo: tb };
      var ct = {};
      Object.keys(tp).forEach(function (k) { ct[k] = Math.round(tp[k] * 100) / 100; });
      ds.push({ user_id: uid, diem_tong: _kbCoTrongSo(cfg.trong_so, tp), chi_tiet: ct });
    });
    ds.sort(function (a, b) {
      return (b.diem_tong - a.diem_tong) || (b.chi_tiet.thi_hoi - a.chi_tiet.thi_hoi) || (a.user_id - b.user_id);
    });
  } else {
    var kqD = _kbKetQuaCuocThi(ky.contest_id, bang);
    var hoiData = _kbTbCacKy("hoi", bang, bd, kt);
    var huongTbD = _kbTbCacKy("huong", bang, bd, kt).tb;
    var vp = _kbBiLoai(bd, kt);
    Object.keys(kqD).forEach(function (uStr) {
      var uid = Number(uStr), pct = kqD[uid];
      if ((hoiData.dem[uid] || 0) < cfg.toi_thieu_ky_hoi || pct < cfg.diem_san || vp[uid]) return;
      var tp = { thi_dinh: pct, thi_hoi: hoiData.tb[uid] || 0.0, thi_huong: huongTbD[uid] || 0.0 };
      var ct = {};
      Object.keys(tp).forEach(function (k) { ct[k] = Math.round(tp[k] * 100) / 100; });
      ds.push({ user_id: uid, diem_tong: _kbCoTrongSo(cfg.trong_so, tp), chi_tiet: ct });
    });
    ds.sort(function (a, b) {
      return (b.diem_tong - a.diem_tong) || (b.chi_tiet.thi_dinh - a.chi_tiet.thi_dinh) || (a.user_id - b.user_id);
    });
  }
  var loai = _kbBiLoai(bd, kt);
  var filtered = ds.filter(function (d) { return !loai[d.user_id]; });
  for (var i = 0; i < filtered.length; i++) {
    delete filtered[i]._cx;
    delete filtered[i]._lc;
    filtered[i].hang = i + 1;
  }
  return filtered;
}

function _kbTraoDanhHieu(bxh, cfg) {
  var du = bxh.filter(function (d) { return d.diem_tong >= cfg.diem_san; });
  if (du.length < cfg.toi_thieu_thi_sinh) return [];
  var kq = [], viTri = 0;
  for (var i = 0; i < cfg.danh_hieu.length; i++) {
    var bac = cfg.danh_hieu[i];
    var suat = bac.so_luong != null ? bac.so_luong : (bac.con_lai ? Math.max(0, du.length - viTri) : Math.max(1, Math.floor(bac.ty_le * du.length + 0.5)));
    var slice = du.slice(viTri, viTri + suat);
    for (var j = 0; j < slice.length; j++) kq.push([slice[j].user_id, bac.ma, slice[j].hang]);
    viTri += suat;
    if (viTri >= du.length) break;
  }
  return kq;
}

function _kbChotKy(ky) {
  if (!ky || String(ky.trang_thai) !== "mo") return false;
  if (vnTodayStr() <= kbHanChot(String(ky.cap), String(ky.ket_thuc))) return false;
  ky.trang_thai = "da_khoa";
  dbMarkDirty("kb_ky");
  var cfg = kbDocCauHinh(String(ky.cap));
  var ds = kbTinhKetQuaKy(ky);
  var bayGio = vnNowStr();
  var heSo = { huong: 1.0, hoi: 1.2, dinh: 1.5 }[ky.cap] || 1.0;
  for (var i = 0; i < ds.length; i++) {
    var d = ds[i];
    dbInsert("kb_ket_qua", {
      ky_id: Number(ky.id), user_id: d.user_id, diem_tong: d.diem_tong,
      hang: d.hang, chi_tiet: JSON.stringify(d.chi_tiet)
    }, false);
    dbInsert("kb_tham_gia", { ky_id: Number(ky.id), user_id: d.user_id, tao_luc: bayGio }, false);
    var diemBxh = Math.round((d.diem_tong || 0) * heSo);
    if (diemBxh > 0) updateUserScore(d.user_id, diemBxh);
  }
  var dhMap = {};
  dbReadTable("kb_danh_hieu").forEach(function (r) { dhMap[String(r.ma)] = Number(r.diem_tich_luy || 0); });
  var trao = _kbTraoDanhHieu(ds, cfg);
  for (var t = 0; t < trao.length; t++) {
    var uid = trao[t][0], ma = trao[t][1], hang = trao[t][2];
    dbInsert("kb_user_danh_hieu", { user_id: uid, ky_id: Number(ky.id), ma_danh_hieu: ma, hang: hang, trao_luc: bayGio }, false);
    dbInsert("kb_diem_tich_luy", { user_id: uid, ky_id: Number(ky.id), diem: dhMap[ma] || 0, ly_do: ma, tao_luc: bayGio }, true);
  }
  for (var j = 0; j < ds.length; j++) kiemTraHuyHieu(ds[j].user_id);
  return true;
}

function kbChotLuoi() {
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty("KB_LAST_CHOT_MS") || 0);
  if (Date.now() - last < 60000) return;
  props.setProperty("KB_LAST_CHOT_MS", String(Date.now()));
  var homNay = vnTodayStr();
  var hd = dbReadTable("kb_hoat_dong");
  var dau = null;
  for (var i = 0; i < hd.length; i++) {
    if (hd[i].ngay && (!dau || String(hd[i].ngay) < dau)) dau = String(hd[i].ngay);
  }
  dbReadTable("contests").forEach(function (c) {
    if (c.loai && c.bat_dau) {
      var d10 = String(c.bat_dau).slice(0, 10);
      if (!dau || d10 < dau) dau = d10;
    }
  });
  var d0 = dau || homNay;
  var bangs = Object.keys(BANG_XEP_HANG);
  for (var ci = 0; ci < KB_CAP.length; ci++) {
    var cap = KB_CAP[ci];
    var d = d0;
    while (d <= homNay) {
      for (var bi = 0; bi < bangs.length; bi++) kbLayHoacTaoKy(cap, bangs[bi], d);
      d = addDaysYmd(kbKhoangKy(cap, d)[2], 1);
    }
  }
  var lockedAny = false;
  for (var ci2 = 0; ci2 < KB_CAP.length; ci2++) {
    var cap2 = KB_CAP[ci2];
    var kys = dbReadTable("kb_ky").filter(function (k) {
      return String(k.cap) === cap2 && String(k.trang_thai) === "mo";
    }).sort(function (a, b) { return String(a.bat_dau).localeCompare(String(b.bat_dau)); });
    for (var ki = 0; ki < kys.length; ki++) {
      if (_kbChotKy(kys[ki])) lockedAny = true;
    }
  }
  if (lockedAny) dbFlushDirty();
}

function _kbKyInfo(ky) {
  var mo = String(ky.trang_thai) === "mo";
  var hetMs = parseYmdHmsMs(String(ky.ket_thuc) + " 23:59:59");
  var conLai = mo && hetMs !== null ? Math.max(0, Math.floor((hetMs - vnNowUtcMs()) / 1000)) : 0;
  return {
    id: Number(ky.id), cap: ky.cap, ten: KB_TEN_CAP[ky.cap], ma: ky.ma, bang: ky.bang,
    bat_dau: ky.bat_dau, ket_thuc: ky.ket_thuc, trang_thai: ky.trang_thai,
    co_cuoc_thi: ky.contest_id !== null && ky.contest_id !== "",
    con_lai_giay: conLai
  };
}

function _kbGanTen(ds) {
  if (!ds.length) return;
  var uMap = {};
  dbReadTable("users").forEach(function (u) { uMap[Number(u.id)] = u; });
  ds.forEach(function (d) {
    var u = uMap[d.user_id];
    if (u) { d.username = u.username || ""; d.avatar = u.avatar || ""; d.huy_hieu = u.huy_hieu || ""; }
    else { d.username = "(đã xóa)"; d.avatar = ""; d.huy_hieu = ""; }
  });
}

function kbBangCuaKy(ky, gioiHan) {
  gioiHan = gioiHan || 50;
  var cfg = kbDocCauHinh(String(ky.cap));
  var tenDh = {};
  dbReadTable("kb_danh_hieu").forEach(function (r) { tenDh[String(r.ma)] = String(r.ten); });
  var ds, dh = {}, tamTinh;
  if (String(ky.trang_thai) === "da_khoa") {
    ds = dbReadTable("kb_ket_qua").filter(function (r) { return Number(r.ky_id) === Number(ky.id); })
      .sort(function (a, b) { return Number(a.hang) - Number(b.hang); })
      .map(function (r) {
        var ct = {};
        try { ct = JSON.parse(r.chi_tiet || "{}"); } catch (e) {}
        return { user_id: Number(r.user_id), diem_tong: Number(r.diem_tong), hang: Number(r.hang), chi_tiet: ct };
      });
    dbReadTable("kb_user_danh_hieu").forEach(function (r) {
      if (Number(r.ky_id) === Number(ky.id)) dh[Number(r.user_id)] = String(r.ma_danh_hieu);
    });
    tamTinh = false;
  } else {
    ds = kbTinhKetQuaKy(ky);
    _kbTraoDanhHieu(ds, cfg).forEach(function (t) { dh[t[0]] = t[1]; });
    tamTinh = true;
  }
  var tong = ds.length;
  ds = ds.slice(0, gioiHan);
  _kbGanTen(ds);
  ds.forEach(function (d) {
    var ma = dh[d.user_id];
    d.danh_hieu = ma ? { ma: ma, ten: tenDh[ma] || ma } : null;
    d.tam_tinh = tamTinh;
  });
  return { ds: ds, tong: tong, tam_tinh: tamTinh };
}

function _kbDanhHieuKy(kyId) {
  var dhMap = {}, uMap = {}, kqMap = {};
  dbReadTable("kb_danh_hieu").forEach(function (r) { dhMap[String(r.ma)] = r; });
  dbReadTable("users").forEach(function (u) { uMap[Number(u.id)] = u; });
  dbReadTable("kb_ket_qua").forEach(function (r) {
    if (Number(r.ky_id) === Number(kyId)) kqMap[Number(r.user_id)] = Number(r.diem_tong);
  });
  return dbReadTable("kb_user_danh_hieu").filter(function (t) { return Number(t.ky_id) === Number(kyId); })
    .map(function (t) {
      var d = dhMap[String(t.ma_danh_hieu)] || {};
      var u = uMap[Number(t.user_id)] || {};
      return {
        user_id: Number(t.user_id), ma: t.ma_danh_hieu, hang: Number(t.hang),
        ten: d.ten || t.ma_danh_hieu, giap: d.giap || "", thu_tu: Number(d.thu_tu || 99),
        username: u.username || "", avatar: u.avatar || "", huy_hieu: u.huy_hieu || "",
        diem: kqMap[Number(t.user_id)] != null ? kqMap[Number(t.user_id)] : null
      };
    }).sort(function (a, b) { return (a.thu_tu - b.thu_tu) || (a.hang - b.hang); });
}

function kbQuyChe(cap) {
  var cfg = kbDocCauHinh(cap);
  var dh = {};
  dbReadTable("kb_danh_hieu").forEach(function (r) { dh[String(r.ma)] = r; });
  var tong = 0;
  Object.keys(cfg.trong_so).forEach(function (k) { tong += cfg.trong_so[k]; });
  var cach = Object.keys(cfg.trong_so).map(function (k) {
    return {
      ma: k, nhan: KB_NHAN_TP[cap][k][0], ngan: KB_NHAN_TP[cap][k][1],
      ty_trong: Math.round(100 * cfg.trong_so[k] / tong)
    };
  });
  var dk;
  if (cap === "huong") {
    dk = [
      "Mọi học sinh có tài khoản đều được tham gia.",
      "Cần hoàn thành ít nhất " + cfg.toi_thieu_bai + " bài trong tuần để được xếp hạng.",
      "Điểm chỉ tính từ kết quả hệ thống tự chấm; độ chính xác tính theo lần nộp đầu tiên của mỗi bài trong tuần.",
      "Làm 1 bài điểm cao không đủ để dẫn đầu: kết quả luyện đề được làm mượt theo số bài đã làm."
    ];
  } else if (cap === "hoi") {
    dk = [
      "Thi chính là một cuộc thi riêng trong tháng (xem mục Tranh tài), nộp trong khung giờ quy định.",
      "Nếu tháng có vòng Khảo hạch, cần đạt từ " + cfg.khao_hach_san + "% để vào Thi chính.",
      "Phúc khảo: gửi trong " + KB_HAN_PHUC_KHAO_NGAY + " ngày sau khi kỳ thi kết thúc."
    ];
  } else {
    dk = [
      "Đã tham gia ít nhất " + cfg.toi_thieu_ky_hoi + " kỳ Thi Hội trong quý.",
      "Điểm bài thi Đình từ " + cfg.diem_san + "% trở lên.",
      "Không vi phạm quy chế thi."
    ];
  }
  var thuong = cfg.danh_hieu.map(function (bac) {
    var r = dh[bac.ma] || { ma: bac.ma, ten: bac.ma, giap: "", diem_tich_luy: 0 };
    var suat = bac.so_luong === 1 ? "1 người" : (bac.so_luong != null ? bac.so_luong + " người" : (bac.con_lai ? "Tất cả thí sinh còn lại đủ điều kiện" : Math.round(bac.ty_le * 100) + "% thí sinh đủ điều kiện (tối thiểu 1)"));
    return { ma: r.ma, ten: r.ten, giap: r.giap || "", suat: suat, diem_tich_luy: Number(r.diem_tich_luy || 0) };
  });
  return {
    chu_ky: KB_CHU_KY[cap], cach_tinh: cach, dieu_kien: dk, danh_hieu: thuong,
    luu_y: "Kỳ chỉ trao danh hiệu khi có ít nhất " + cfg.toi_thieu_thi_sinh + " thí sinh đủ điều kiện và đạt từ " + cfg.diem_san + " điểm."
  };
}

// ====================== VƯỜN SAOLADOU & CỬA HÀNG EDUCOIN (vuon.py) ======================
var VUON_VUOT_VE_CD = 60;
var VUON_VUOT_VE_MAX_NGAY = 5;
var VUON_CATALOG = [
  { id: "duong_xi", nhom: "thuc_an", ten: "Dương xỉ tổ chim (Asplenium)", gia: 15, mo_ta: "Lá dương xỉ non mọc trên thân cây ẩm rừng Trường Sơn, món ăn nhẹ khoái khẩu của Sao La.", hieu_qua: { no_bung: 20, exp: 10 }, tieu_hao: true, mua_1_lan: false, cooldown_giay: 0, pos: null, icon: "🌿" },
  { id: "la_sung", nhom: "thuc_an", ten: "Lá sung ven suối (Ficus)", gia: 25, mo_ta: "Lá sung rừng xanh mướt dọc khe suối, giàu chất xơ giúp Sao La khỏe khoắn và vui vẻ.", hieu_qua: { no_bung: 30, vui_ve: 8, exp: 16 }, tieu_hao: true, mua_1_lan: false, cooldown_giay: 0, pos: null, icon: "🍃" },
  { id: "mon_thuc", nhom: "thuc_an", ten: "Thiên niên kiện / Môn thục (Homalomena)", gia: 40, mo_ta: "Loài thảo mộc đặc trưng dưới tán rừng kín thường xanh, bổ sung nhiều dinh dưỡng tự nhiên.", hieu_qua: { no_bung: 42, vui_ve: 12, exp: 24 }, tieu_hao: true, mua_1_lan: false, cooldown_giay: 0, pos: null, icon: "🌱" },
  { id: "ray_rung", nhom: "thuc_an", ten: "Cây chi Ráy rừng (Schismatoglottis)", gia: 55, mo_ta: "Cụm lá ráy rừng mọng nước vùng núi cao, giúp Sao La no lâu và tràn đầy năng lượng.", hieu_qua: { no_bung: 55, vui_ve: 16, exp: 32 }, tieu_hao: true, mua_1_lan: false, cooldown_giay: 0, pos: null, icon: "🪴" },
  { id: "ho_trom", nhom: "thuc_an", ten: "Lá cây họ Trôm (Sterculiaceae)", gia: 80, mo_ta: "Thực phẩm thượng hạng của Sao La ngoài tự nhiên, hồi phục độ no và tăng nhiều EXP.", hieu_qua: { no_bung: 75, vui_ve: 25, exp: 48 }, tieu_hao: true, mua_1_lan: false, cooldown_giay: 0, pos: null, icon: "🍀" },
  { id: "nuoc_suoi", nhom: "cham_soc", ten: "Nước suối mát Trường Sơn", gia: 15, mo_ta: "Dòng nước suối đầu nguồn trong vắt giúp tắm mát, làm sạch lông và giải khát nhẹ.", hieu_qua: { sach_se: 32, no_bung: 10, exp: 12 }, tieu_hao: true, mua_1_lan: false, cooldown_giay: 0, pos: null, icon: "💧" },
  { id: "thao_duoc", nhom: "cham_soc", ten: "Thảo dược hồi sức", gia: 60, mo_ta: "Bài thuốc quý từ rừng già, nâng mọi chỉ số (No, Vui, Sạch) lên tối thiểu 70 khi Sao La bị ốm.", hieu_qua: { min_all: 70, exp: 35 }, tieu_hao: true, mua_1_lan: false, cooldown_giay: 0, pos: null, icon: "🧪" },
  { id: "ban_chai", nhom: "cham_soc", ten: "Bàn chải gỗ mộc", gia: 180, mo_ta: "Bàn chải chải lông thủ công từ gỗ rừng. Mua 1 lần dùng mãi (hồi chiêu 3 giờ).", hieu_qua: { sach_se: 28, vui_ve: 12, exp: 18 }, tieu_hao: false, mua_1_lan: true, cooldown_giay: 10800, pos: null, icon: "🪥" },
  { id: "bong_may", nhom: "do_choi", ten: "Bóng đan mây tre", gia: 220, mo_ta: "Quả bóng đan từ sợi mây rừng cho Sao La nô đùa trên bãi cỏ (hồi chiêu 2 giờ, hơi lấm bẩn).", hieu_qua: { vui_ve: 30, sach_se: -8, exp: 20 }, tieu_hao: false, mua_1_lan: true, cooldown_giay: 7200, pos: null, icon: "🧶" },
  { id: "sao_truc", nhom: "do_choi", ten: "Sáo trúc ngân vang", gia: 320, mo_ta: "Tiếng sáo trúc du dương giữa núi rừng giúp Sao La thư giãn tuyệt đối (hồi chiêu 3 giờ).", hieu_qua: { vui_ve: 45, exp: 28 }, tieu_hao: false, mua_1_lan: true, cooldown_giay: 10800, pos: null, icon: "🪈" },
  { id: "lan_rung", nhom: "trang_tri", ten: "Khóm hoa lan rừng", gia: 250, mo_ta: "Khóm phong lan nở rộ bên gốc cây, thu hút bướm rừng ghé thăm khu vườn.", hieu_qua: {}, tieu_hao: false, mua_1_lan: true, cooldown_giay: 0, pos: { left: "16%", bottom: "18%" }, icon: "🌸" },
  { id: "den_dom_dom", nhom: "trang_tri", ten: "Đèn lồng đom đóm", gia: 350, mo_ta: "Chiếc đèn lồng mộc treo trên tán cây tỏa ánh sáng ấm áp cùng đom đóm lung linh.", hieu_qua: {}, tieu_hao: false, mua_1_lan: true, cooldown_giay: 0, pos: { left: "23%", top: "24%" }, icon: "🏮" },
  { id: "ghe_da", nhom: "trang_tri", ten: "Ghế đá nghỉ chân", gia: 300, mo_ta: "Băng ghế đá phủ rêu xanh bên bờ suối để bạn ngồi ngắm Sao La dạo chơi.", hieu_qua: {}, tieu_hao: false, mua_1_lan: true, cooldown_giay: 0, pos: { left: "78%", bottom: "22%" }, icon: "🪑" },
  { id: "bang_ten", nhom: "trang_tri", ten: "Bảng gỗ chủ vườn", gia: 400, mo_ta: "Tấm bảng gỗ khắc tên khu vườn riêng của bạn đặt ngay lối vào thảm cỏ.", hieu_qua: {}, tieu_hao: false, mua_1_lan: true, cooldown_giay: 0, pos: { left: "69%", bottom: "32%" }, icon: "🪵" }
];

function _vuonCatalogMap() {
  var m = {};
  for (var i = 0; i < VUON_CATALOG.length; i++) m[VUON_CATALOG[i].id] = VUON_CATALOG[i];
  return m;
}
function _vuonCanExp(cap) { return 80 + Math.max(0, Number(cap || 1) - 1) * 40; }
function _vuonGiaiDoan(cap) {
  cap = Number(cap || 1);
  if (cap <= 2) return "Bé SaoLa Nhỏ";
  if (cap <= 5) return "SaoLa Thiếu Niên";
  if (cap <= 9) return "Kỳ Lân Trường Sơn";
  return "Thần Thú Rừng Nguyên Sinh";
}
function _vuonSucKhoe(noBung, vuiVe, sachSe) {
  if (noBung < 20 || vuiVe < 20 || sachSe < 20) return "om";
  if (noBung < 50 || vuiVe < 50 || sachSe < 50) return "can_cham";
  return "khoe_vui";
}
function _vuonGetOrInit(uid) {
  var rows = dbReadTable("vuon_trang_thai");
  for (var i = 0; i < rows.length; i++) {
    if (Number(rows[i].user_id) === uid) return rows[i];
  }
  return dbInsert("vuon_trang_thai", {
    user_id: uid, cap: 1, exp: 0, no_bung: 80, vui_ve: 80, sach_se: 80,
    lan_cham: vnNowStr(), lan_vuot_ve: "", vuot_ve_ngay: "", vuot_ve_dem: 0
  }, false);
}
function _vuonApplyDecay(vt) {
  var nowMs = vnNowUtcMs();
  var lastMs = parseYmdHmsMs(vt.lan_cham);
  if (lastMs === null) {
    vt.lan_cham = vnNowStr();
    dbMarkDirty("vuon_trang_thai");
    return vt;
  }
  var gio = Math.min(168, Math.max(0, (nowMs - lastMs) / 3600000));
  if (gio >= 0.25) {
    var noBung = Math.max(0, Math.min(100, Number(vt.no_bung || 0) - Math.floor(gio * 2.5)));
    var sachSe = Math.max(0, Math.min(100, Number(vt.sach_se || 0) - Math.floor(gio * 2.0)));
    var rateVui = (noBung < 25 || sachSe < 25) ? 3.5 : 2.0;
    var vuiVe = Math.max(0, Math.min(100, Number(vt.vui_ve || 0) - Math.floor(gio * rateVui)));
    vt.no_bung = noBung;
    vt.sach_se = sachSe;
    vt.vui_ve = vuiVe;
    vt.lan_cham = vnNowStr();
    dbMarkDirty("vuon_trang_thai");
  }
  return vt;
}
function _vuonCongExp(vt, congExp) {
  if (congExp <= 0) return false;
  var cap = Math.max(1, Number(vt.cap || 1));
  var exp = Math.max(0, Number(vt.exp || 0)) + congExp;
  var capCu = cap;
  while (exp >= _vuonCanExp(cap)) {
    exp -= _vuonCanExp(cap);
    cap++;
  }
  vt.cap = cap;
  vt.exp = exp;
  dbMarkDirty("vuon_trang_thai");
  return cap > capCu;
}
function vuonBuildState(uid) {
  var u = findUserRow(uid);
  if (!u) return null;
  var vt = _vuonApplyDecay(_vuonGetOrInit(uid));
  var nowMs = vnNowUtcMs();
  var homNay = vnTodayStr();
  var vvNgay = String(vt.vuot_ve_ngay || "");
  var vvDem = vvNgay === homNay ? Number(vt.vuot_ve_dem || 0) : 0;
  var vvConLai = Math.max(0, VUON_VUOT_VE_MAX_NGAY - vvDem);
  var vvLastMs = parseYmdHmsMs(vt.lan_vuot_ve);
  var vvHoiCon = vvLastMs !== null ? Math.max(0, Math.ceil(VUON_VUOT_VE_CD - (nowMs - vvLastMs) / 1000)) : 0;
  var cap = Math.max(1, Number(vt.cap || 1));
  var noBung = Number(vt.no_bung || 0), vuiVe = Number(vt.vui_ve || 0), sachSe = Number(vt.sach_se || 0);
  var sucKhoe = _vuonSucKhoe(noBung, vuiVe, sachSe);
  var canExp = _vuonCanExp(cap);

  var catMap = _vuonCatalogMap();
  var tuiDo = [];
  dbReadTable("vuon_tui_do").forEach(function (r) {
    if (Number(r.user_id) !== uid) return;
    var meta = catMap[String(r.item_id)];
    if (!meta || Number(r.so_luong || 0) <= 0) return;
    var cdCon = 0;
    if (!meta.tieu_hao && meta.cooldown_giay > 0 && r.lan_dung_cuoi) {
      var lMs = parseYmdHmsMs(r.lan_dung_cuoi);
      if (lMs !== null) cdCon = Math.max(0, Math.ceil(meta.cooldown_giay - (nowMs - lMs) / 1000));
    }
    tuiDo.push({
      item_id: meta.id, nhom: meta.nhom, ten: meta.ten, mo_ta: meta.mo_ta, hieu_qua: meta.hieu_qua,
      tieu_hao: meta.tieu_hao, mua_1_lan: meta.mua_1_lan, cooldown_giay: meta.cooldown_giay,
      icon: meta.icon, so_luong: Number(r.so_luong || 0), hoi_chieu_con: cdCon
    });
  });

  var trangTri = [];
  dbReadTable("vuon_trang_tri").forEach(function (r) {
    if (Number(r.user_id) !== uid) return;
    var meta = catMap[String(r.item_id)];
    if (!meta) return;
    trangTri.push({
      item_id: meta.id, ten: meta.ten, mo_ta: meta.mo_ta, pos: meta.pos,
      icon: meta.icon, dang_bat: Boolean(Number(r.dang_bat || 0))
    });
  });

  var petTt = _petTrangThai(uid);
  var skinShop = petTt.skin.filter(function (s) { return Number(s.gia || 0) > 0; }).map(function (s) {
    return Object.assign({}, s, { dang_mac: s.id === petTt.skin_dang_mac });
  });

  return {
    trang_thai: {
      cap: cap, exp: Number(vt.exp || 0), can_exp: canExp, giai_doan: _vuonGiaiDoan(cap),
      no_bung: noBung, vui_ve: vuiVe, sach_se: sachSe, suc_khoe: sucKhoe,
      vuot_ve_con_lai: vvConLai, vuot_ve_hoi_con: vvHoiCon
    },
    suc_khoe: sucKhoe, can_exp: canExp,
    educoin: Number(u.educoin || 0), score: Number(u.score || 0), username: u.username || "",
    tui_do: tuiDo, trang_tri: trangTri,
    skin_shop: skinShop, skin: petTt.skin, skin_dang_mac: petTt.skin_dang_mac,
    skin_hien_tai: petTt.skin_hien_tai, so_khung: petTt.so_khung, fps: petTt.fps, hieu_ung: petTt.hieu_ung,
    catalog: VUON_CATALOG
  };
}
