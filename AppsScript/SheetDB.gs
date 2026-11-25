// SheetDB.gs - Lớp đọc/ghi Google Sheets thay thế SQLite (giữ nguyên cấu trúc 24+ bảng từ edumate.db)

var TABLE_SCHEMAS = {
  users: ["id", "username", "email", "mk", "bio", "score", "educoin", "streak", "last_active_date", "mon_chuyen", "da_khao_sat", "avatar", "dd_tong", "dd_last", "the_bao_ho", "luot_quay", "muc_tieu_tuan", "x15_den", "huy_hieu"],
  user_huy_hieu: ["user_id", "badge_id", "unlocked_at", "diem_thuong"],
  da_lam: ["user_id", "bai_key", "best_pct"],
  ruong_chuong: ["id", "user_id", "subject", "chuong", "diem_thuong", "ngay_mo"],
  vuon_trang_thai: ["user_id", "cap", "exp", "no_bung", "vui_ve", "sach_se", "lan_cham", "lan_vuot_ve", "vuot_ve_ngay", "vuot_ve_dem"],
  vuon_tui_do: ["user_id", "item_id", "so_luong", "lan_dung_cuoi"],
  vuon_trang_tri: ["user_id", "item_id", "dang_bat"],
  diem_thang: ["user_id", "thang", "diem"],
  contests: ["id", "ten", "bat_dau", "ket_thuc", "noi_dung", "loai"],
  contest_ket_qua: ["user_id", "contest_id", "diem"],
  pet: ["user_id", "skin_dang_mac", "gioi_tinh"],
  pet_do: ["user_id", "skin_id", "ngay_nhan"],
  password_resets: ["id", "email", "otp", "token", "expires_at", "used", "created_at"],
  nv_tien_do: ["user_id", "ngay", "khoa", "gia_tri"],
  nv_ngay: ["user_id", "ngay", "nv_id", "da_nhan"],
  so_loi: ["user_id", "bai_key", "cau_id", "nguyen_nhan", "so_lan_sai", "lan_cuoi", "da_hieu"],
  ky_nang_user: ["user_id", "bai_key", "muc", "ngay_on_ke", "so_lan_dat", "so_lan_chua_dat", "lan_on_cuoi"],
  on_tap_the: ["id", "user_id", "bai_key", "cau_id", "loai", "tang_goi_y", "so_lan_sai", "nguyen_nhan", "ket_qua", "tao_luc"],
  kb_hoat_dong: ["id", "user_id", "bai_key", "thoi_diem", "ngay", "so_cau", "so_tra_loi", "so_dung", "pct"],
  kb_cau_hinh: ["khoa", "gia_tri"],
  kb_danh_hieu: ["ma", "ten", "cap", "giap", "thu_tu", "diem_tich_luy"],
  kb_ky: ["id", "cap", "ma", "bat_dau", "ket_thuc", "bang", "trang_thai", "contest_id", "khao_hach_id"],
  kb_tham_gia: ["ky_id", "user_id", "tao_luc"],
  kb_ket_qua: ["ky_id", "user_id", "diem_tong", "hang", "chi_tiet"],
  kb_user_danh_hieu: ["user_id", "ky_id", "ma_danh_hieu", "hang", "trao_luc"],
  kb_diem_tich_luy: ["id", "user_id", "ky_id", "diem", "ly_do", "tao_luc"],
  kb_phuc_khao: ["id", "ky_id", "user_id", "noi_dung", "trang_thai", "ghi_chu_admin", "tao_luc"],
  kb_vi_pham: ["id", "user_id", "ky_id", "ly_do", "bai_key", "trang_thai", "tao_luc"],
  kb_nhat_ky: ["id", "thoi_diem", "hanh_dong", "ky_id", "ghi_chu"]
};

var NUM_COLS = {
  id: true, user_id: true, score: true, educoin: true, streak: true, da_khao_sat: true,
  dd_tong: true, the_bao_ho: true, luot_quay: true, muc_tieu_tuan: true, diem_thuong: true,
  best_pct: true, diem: true, contest_id: true, used: true, gia_tri_num: true,
  da_nhan: true, so_lan_sai: true, da_hieu: true, muc: true, so_lan_dat: true,
  so_lan_chua_dat: true, tang_goi_y: true, so_cau: true, so_tra_loi: true,
  so_dung: true, pct: true, thu_tu: true, diem_tich_luy: true, khao_hach_id: true,
  ky_id: true, diem_tong: true, hang: true,
  cap: true, exp: true, no_bung: true, vui_ve: true, sach_se: true,
  vuot_ve_dem: true, so_luong: true, dang_bat: true
};

var NULLABLE_NUM_COLS = { contest_id: true, khao_hach_id: true, ky_id: true };

var _SS_CACHE = null;
var _MEM = {};
var _MEM_HEADERS = {};
var _DIRTY = {};

function getSpreadsheet() {
  if (_SS_CACHE) return _SS_CACHE;
  try {
    _SS_CACHE = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {}
  if (!_SS_CACHE && SPREADSHEET_ID) {
    _SS_CACHE = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return _SS_CACHE;
}

function resetDbMemCache() {
  _MEM = {};
  _MEM_HEADERS = {};
  _DIRTY = {};
}

function _isNumCol(tableName, col) {
  if (tableName === "nv_tien_do" && col === "gia_tri") return true;
  return !!NUM_COLS[col];
}

function _coerceReadVal(tableName, col, rawStr) {
  var s = rawStr == null ? "" : String(rawStr);
  if (_isNumCol(tableName, col)) {
    if (s === "") return NULLABLE_NUM_COLS[col] ? null : 0;
    var n = Number(s);
    return isNaN(n) ? (NULLABLE_NUM_COLS[col] ? null : 0) : n;
  }
  return s;
}

function dbGetHeaders(tableName) {
  dbReadTable(tableName);
  return _MEM_HEADERS[tableName] || TABLE_SCHEMAS[tableName] || [];
}

function dbReadTable(tableName) {
  if (_MEM[tableName]) return _MEM[tableName];
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(tableName);
  if (!sheet) {
    var defHeaders = TABLE_SCHEMAS[tableName];
    if (!defHeaders) {
      _MEM_HEADERS[tableName] = [];
      _MEM[tableName] = [];
      return _MEM[tableName];
    }
    sheet = ss.insertSheet(tableName);
    var hdrRange = sheet.getRange(1, 1, 1, defHeaders.length);
    hdrRange.setNumberFormat("@");
    hdrRange.setValues([defHeaders]);
    _MEM_HEADERS[tableName] = defHeaders.slice();
    _MEM[tableName] = [];
    return _MEM[tableName];
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) {
    var dh = TABLE_SCHEMAS[tableName] || [];
    if (dh.length) {
      sheet.getRange(1, 1, 1, dh.length).setValues([dh]);
    }
    _MEM_HEADERS[tableName] = dh.slice();
    _MEM[tableName] = [];
    return _MEM[tableName];
  }

  var display = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  var headers = display[0].map(function (h) { return String(h).trim(); });
  // Bổ sung cột mới nếu schema có thêm (vd khao_hach_id, loai, huy_hieu...)
  var schema = TABLE_SCHEMAS[tableName];
  var addedCol = false;
  if (schema) {
    for (var si = 0; si < schema.length; si++) {
      if (headers.indexOf(schema[si]) === -1) {
        headers.push(schema[si]);
        addedCol = true;
      }
    }
  }
  if (addedCol) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  var rows = [];
  for (var r = 1; r < display.length; r++) {
    var line = display[r];
    var allEmpty = true;
    for (var c0 = 0; c0 < line.length; c0++) {
      if (line[c0] !== "") { allEmpty = false; break; }
    }
    if (allEmpty) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var col = headers[c];
      if (!col) continue;
      obj[col] = _coerceReadVal(tableName, col, c < line.length ? line[c] : "");
    }
    rows.push(obj);
  }

  _MEM_HEADERS[tableName] = headers;
  _MEM[tableName] = rows;
  return rows;
}

function dbMarkDirty(tableName) {
  _DIRTY[tableName] = true;
}

function dbNextId(tableName) {
  var rows = dbReadTable(tableName);
  var maxId = 0;
  for (var i = 0; i < rows.length; i++) {
    var v = Number(rows[i].id) || 0;
    if (v > maxId) maxId = v;
  }
  return maxId + 1;
}

function dbInsert(tableName, obj, withAutoId) {
  var rows = dbReadTable(tableName);
  var headers = dbGetHeaders(tableName);
  var rec = {};
  for (var i = 0; i < headers.length; i++) {
    var col = headers[i];
    if (obj[col] !== undefined) {
      rec[col] = obj[col];
    } else {
      rec[col] = _isNumCol(tableName, col) ? (NULLABLE_NUM_COLS[col] ? null : 0) : "";
    }
  }
  if (withAutoId && (!rec.id || Number(rec.id) <= 0)) {
    rec.id = dbNextId(tableName);
  }
  rows.push(rec);
  dbMarkDirty(tableName);
  return rec;
}

function dbFlushDirty() {
  var names = Object.keys(_DIRTY);
  if (!names.length) return;
  var ss = getSpreadsheet();
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    if (!_DIRTY[name]) continue;
    var sheet = ss.getSheetByName(name);
    if (!sheet) continue;
    var headers = _MEM_HEADERS[name] || TABLE_SCHEMAS[name] || [];
    var rows = _MEM[name] || [];
    if (!headers.length) continue;

    var grid = [headers];
    for (var r = 0; r < rows.length; r++) {
      var rowObj = rows[r];
      var line = [];
      for (var c = 0; c < headers.length; c++) {
        var col = headers[c];
        var v = rowObj[col];
        if (v === null || v === undefined) v = "";
        line.push(v);
      }
      grid.push(line);
    }

    var oldRows = sheet.getLastRow();
    var oldCols = sheet.getLastColumn();
    if (oldRows > grid.length && oldCols > 0) {
      sheet.getRange(grid.length + 1, 1, oldRows - grid.length, oldCols).clearContent();
    }

    // Đặt Plain Text (@) cho các cột không phải số để Sheet không biến '2026-11' thành Date
    for (var c2 = 0; c2 < headers.length; c2++) {
      var colName = headers[c2];
      var rangeCol = sheet.getRange(1, c2 + 1, grid.length, 1);
      if (!_isNumCol(name, colName)) {
        rangeCol.setNumberFormat("@");
      }
    }
    sheet.getRange(1, 1, grid.length, headers.length).setValues(grid);
    delete _DIRTY[name];
  }
  SpreadsheetApp.flush();
}

// ====================== Date / Time Helpers (VN Timezone) ======================
function vnNow() {
  return new Date();
}

function vnTodayStr(d) {
  return Utilities.formatDate(d || new Date(), TZ_VN, "yyyy-MM-dd");
}

function vnNowStr(d) {
  return Utilities.formatDate(d || new Date(), TZ_VN, "yyyy-MM-dd HH:mm:ss");
}

function vnNowHmStr(d) {
  return Utilities.formatDate(d || new Date(), TZ_VN, "yyyy-MM-dd HH:mm");
}

function vnThangHienTai(d) {
  return Utilities.formatDate(d || new Date(), TZ_VN, "yyyy-MM");
}

function parseYmd(ymd) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ""));
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
}

function fmtYmdUtc(dt) {
  var y = dt.getUTCFullYear();
  var m = String(dt.getUTCMonth() + 1);
  var d = String(dt.getUTCDate());
  return y + "-" + (m.length < 2 ? "0" + m : m) + "-" + (d.length < 2 ? "0" + d : d);
}

function addDaysYmd(ymd, delta) {
  var dt = parseYmd(ymd);
  if (!dt) return "";
  dt.setUTCDate(dt.getUTCDate() + delta);
  return fmtYmdUtc(dt);
}

function diffDaysYmd(ymdNew, ymdOld) {
  var a = parseYmd(ymdNew);
  var b = parseYmd(ymdOld);
  if (!a || !b) return null;
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function parseYmdHmsMs(str) {
  var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(str || ""));
  if (!m) return null;
  // Tính UTC+7 cố định cho giờ VN
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]) - 7, Number(m[5]), Number(m[6] || 0));
}

function vnNowUtcMs() {
  return Date.now();
}
