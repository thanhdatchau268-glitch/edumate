// Code.gs - Entrypoint Google Apps Script Web App cho VnStarL trên Netlify

var TEN_HOP_LE = /^[a-z0-9_-]+$/;
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function _jsonOut(status, payload) {
  var out = Object.assign({ _httpStatus: status }, payload || {});
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function _err(msg, status) {
  return _jsonOut(status || 400, { success: false, message: msg });
}

function doGet(e) {
  resetDbMemCache();
  var p = (e && e.parameter) || {};
  var path = String(p.path || p._path || "/api/health");
  var token = String(p._token || "");
  return _dispatch("GET", path, p, {}, token);
}

function doPost(e) {
  resetDbMemCache();
  var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
  var body = {};
  try {
    body = JSON.parse(raw);
    if (!body || typeof body !== "object") body = {};
  } catch (err) {
    return _err("JSON không hợp lệ!", 400);
  }
  var p = (e && e.parameter) || {};
  var path = String(body._path || p.path || p._path || "/api/health");
  var method = String(body._method || "POST").toUpperCase();
  var token = String(body._token || p._token || "");
  delete body._path;
  delete body._method;
  delete body._token;

  if (method === "GET") {
    return _dispatch("GET", path, p, body, token);
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    resetDbMemCache();
    var res = _dispatch(method, path, p, body, token);
    dbFlushDirty();
    return res;
  } catch (err2) {
    return _err("Lỗi server: " + (err2 && err2.message ? err2.message : err2), 500);
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function _authMatch(reqUid, token) {
  var tUid = uidTuToken(token);
  if (!tUid) return { ok: false, status: 401, msg: "Phiên đăng nhập đã hết hạn. Hãy đăng xuất rồi đăng nhập lại nhé!" };
  if (reqUid != null && Number(reqUid) !== Number(tUid)) {
    return { ok: false, status: 403, msg: "Không có quyền thao tác trên tài khoản này!" };
  }
  return { ok: true, uid: tUid };
}

function _dispatch(method, path, query, body, token) {
  // Chuẩn hóa path (bỏ query nếu lẫn vào path)
  var qIdx = path.indexOf("?");
  if (qIdx !== -1) {
    var qs = path.slice(qIdx + 1).split("&");
    path = path.slice(0, qIdx);
    for (var qi = 0; qi < qs.length; qi++) {
      var kv = qs[qi].split("=");
      if (kv[0]) query[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || "").replace(/\+/g, " "));
    }
  }

  if (path === "/api/health") {
    return _jsonOut(200, { success: true, status: "ok", backend: "apps-script", ts: vnNowStr() });
  }

  // ==================== AUTH & FORGOT PASSWORD ====================
  if (method === "POST" && path === "/api/register") return _apiRegister(body);
  if (method === "POST" && path === "/api/login") return _apiLogin(body);
  if (method === "GET" && path === "/api/accounts-hint") return _jsonOut(200, { success: true, accounts: [] });
  if (path === "/api/forgot-password/smtp-config") return _apiSmtpConfig(method, body);
  if (method === "POST" && path === "/api/forgot-password/send-otp") return _apiSendOtp(body);
  if (method === "POST" && path === "/api/forgot-password/verify-otp") return _apiVerifyOtp(body);
  if (method === "POST" && path === "/api/forgot-password/google-verify") return _apiGoogleVerify(body);
  if (method === "POST" && path === "/api/forgot-password/reset-password") return _apiResetPassword(body);

  // ==================== SUBMIT & TIẾN ĐỘ & RANKING ====================
  if (method === "POST" && path === "/api/submit") return _apiSubmit(body, token);
  if (method === "GET" && path === "/api/ranking") return _apiRanking(query);
  if (method === "GET" && path === "/api/ranking/cau-hinh") return _apiRankingCauHinh();

  var mTienDo = /^\/api\/tien-do\/([a-z0-9_-]+)$/.exec(path);
  if (method === "GET" && mTienDo) return _apiTienDo(mTienDo[1], query);
  if (method === "POST" && path === "/api/tien-do/mo-ruong") return _apiMoRuong(body, token);

  var mMt = /^\/api\/muc-tieu-tuan\/(\d+)$/.exec(path);
  if (mMt && (method === "GET" || method === "PUT")) return _apiMucTieuTuan(method, Number(mMt[1]), body, token);

  // ==================== USERS / PROFILE / AVATARS ====================
  if (method === "GET" && path === "/api/avatars") return _jsonOut(200, { success: true, data: AVATAR_LIST });

  var mMon = /^\/api\/users\/(\d+)\/mon-chuyen$/.exec(path);
  if (method === "PUT" && mMon) return _apiSaveMonChuyen(Number(mMon[1]), body, token);

  var mAv = /^\/api\/users\/(\d+)\/avatar$/.exec(path);
  if (method === "PUT" && mAv) return _apiSaveAvatar(Number(mAv[1]), body, token);

  var mAvUp = /^\/api\/users\/(\d+)\/avatar-upload$/.exec(path);
  if (method === "POST" && mAvUp) return _apiUploadAvatar(Number(mAvUp[1]), body, token);

  var mUser = /^\/api\/users\/(\d+)$/.exec(path);
  if (mUser) {
    var uid = Number(mUser[1]);
    if (method === "GET") return _apiGetProfile(uid);
    if (method === "PUT") return _apiEditProfile(uid, body, token);
  }

  // ==================== CONTESTS ====================
  if (method === "GET" && path === "/api/contests") return _apiListContests();
  var mConSub = /^\/api\/contests\/(\d+)\/submit$/.exec(path);
  if (method === "POST" && mConSub) return _apiContestSubmit(Number(mConSub[1]), body, token);
  var mConRank = /^\/api\/contests\/(\d+)\/ranking$/.exec(path);
  if (method === "GET" && mConRank) return _apiContestRanking(Number(mConRank[1]));

  // ==================== HUY HIỆU ====================
  var mHh = /^\/api\/huy-hieu\/(\d+)$/.exec(path);
  if (method === "GET" && mHh) return _apiXemHuyHieu(Number(mHh[1]));
  if (method === "POST" && path === "/api/huy-hieu/deo") return _apiDeoHuyHieu(body, token);

  // ==================== PET (SAO LA) ====================
  if (method === "GET" && path === "/api/pet") return _apiXemPet(query);
  if (method === "POST" && path === "/api/pet") return _apiDoiGioiTinhPet(body, token);
  if (method === "POST" && path === "/api/pet/mac") return _apiMacSkinPet(body, token);

  // ==================== QUÀ TẶNG & ĐIỂM DANH ====================
  var mQua = /^\/api\/users\/(\d+)\/qua$/.exec(path);
  if (method === "GET" && mQua) return _apiXemQua(Number(mQua[1]));
  if (method === "POST" && path === "/api/diem-danh") return _apiDiemDanh(body, token);
  if (method === "POST" && path === "/api/quay-thuong") return _apiQuayThuong(body, token);
  if (method === "POST" && path === "/api/bao-ho/doi") return _apiDoiBaoHo(body, token);

  // ==================== VƯỜN SAOLADOU & SHOP EDUCOIN ====================
  if (method === "GET" && path === "/api/vuon") return _apiVuonXem(query);
  if (method === "POST" && path === "/api/vuon/mua") return _apiVuonMua(body, token);
  if (method === "POST" && path === "/api/vuon/dung") return _apiVuonDung(body, token);
  if (method === "POST" && path === "/api/vuon/vuot-ve") return _apiVuonVuotVe(body, token);
  if (method === "POST" && path === "/api/vuon/trang-tri") return _apiVuonTrangTri(body, token);

  // ==================== NHIỆM VỤ ====================
  if (method === "POST" && path === "/api/nhiem-vu/nhan") return _apiNvNhan(body, token);
  if (method === "POST" && path === "/api/nhiem-vu/su-kien") return _apiNvSuKien(body, token);
  var mNv = /^\/api\/nhiem-vu\/(\d+)$/.exec(path);
  if (method === "GET" && mNv) return _apiNvXem(Number(mNv[1]));

  // ==================== SỔ LỖI SAI ====================
  var mSlKn = /^\/api\/so-loi\/(\d+)\/ky-nang$/.exec(path);
  if (method === "GET" && mSlKn) return _apiSlKyNang(Number(mSlKn[1]));
  if (method === "POST" && path === "/api/so-loi/chan-doan") return _apiSlChanDoan(body, token);
  if (method === "POST" && path === "/api/so-loi/the") return _apiSlTaoThe(body, token);
  if (method === "POST" && path === "/api/so-loi/goi-y") return _apiSlGoiY(body, token);
  if (method === "POST" && path === "/api/so-loi/tra-loi") return _apiSlTraLoi(body, token);

  // ==================== KHOA BẢNG ====================
  if (method === "GET" && path === "/api/khoa-bang/cau-hinh") return _apiKbCauHinh();
  if (method === "GET" && path === "/api/khoa-bang/tong-quan") return _apiKbTongQuan(query);
  var mKbKy = /^\/api\/khoa-bang\/ky\/([a-z]+)$/.exec(path);
  if (method === "GET" && mKbKy) return _apiKbKy(mKbKy[1], query);
  if (method === "GET" && path === "/api/khoa-bang/vinh-danh") return _apiKbVinhDanh(query);
  var mKbHs = /^\/api\/khoa-bang\/ho-so\/(\d+)$/.exec(path);
  if (method === "GET" && mKbHs) return _apiKbHoSo(Number(mKbHs[1]));
  if (method === "POST" && path === "/api/khoa-bang/phuc-khao") return _apiKbPhucKhao(body, token);

  if (method === "POST" && path === "/api/dev/buff-diem") {
    return _err("Tính năng này đã bị vô hiệu hóa vì lý do bảo mật!", 403);
  }
  return _err("Không tìm thấy endpoint: " + method + " " + path, 404);
}

// =====================================================================
// IMPLEMENTATIONS
// =====================================================================
function _apiRegister(data) {
  var username = String(data.username || "").trim();
  var email = String(data.email || "").trim().toLowerCase();
  var mk = String(data.mk || "");
  var bio = String(data.bio || "");
  if (!username || !email || !mk) return _err("Vui lòng nhập đầy đủ thông tin!", 400);
  if (!EMAIL_RE.test(email)) return _err("Email không đúng định dạng!", 400);
  if (mk.length < 6) return _err("Mật khẩu cần ít nhất 6 ký tự!", 400);
  if (username.length > 30) return _err("Username tối đa 30 ký tự!", 400);
  if (findUserByEmail(email)) return _err("Email này đã được đăng ký!", 409);

  var u = dbInsert("users", {
    username: username, email: email, mk: hashPassword(mk), bio: bio,
    score: 0, educoin: 0, streak: 0, last_active_date: "", mon_chuyen: "", da_khao_sat: 0,
    avatar: "", dd_tong: 0, dd_last: "", the_bao_ho: 0, luot_quay: 0, muc_tieu_tuan: 20, x15_den: "", huy_hieu: ""
  }, true);

  return _jsonOut(201, {
    success: true, message: "Đăng ký thành công!",
    user: { id: u.id, username: u.username, streak: 0, mon_chuyen: "", huy_hieu: "" }
  });
}

function _apiLogin(data) {
  var email = String(data.email || "").trim().toLowerCase();
  var mk = String(data.mk || "");
  var row = findUserByEmail(email);
  if (!row || !verifyPassword(row.mk, mk)) {
    return _err("Sai email hoặc mật khẩu!", 401);
  }
  // Nâng cấp hash scrypt cũ sang pbkdf2 nhanh sau lần đăng nhập đầu tiên trên Netlify
  if (needsPasswordUpgrade(row.mk)) {
    row.mk = hashPassword(mk);
    dbMarkDirty("users");
  }
  var canKhaoSat = Number(row.da_khao_sat || 0) === 0;
  if (canKhaoSat) {
    row.da_khao_sat = 1;
    dbMarkDirty("users");
  }
  var streakNow = streakHienThi(row.streak, row.last_active_date, row.the_bao_ho);
  return _jsonOut(200, {
    success: true, message: "Đăng nhập thành công!",
    user: {
      id: Number(row.id), username: row.username, email: row.email,
      bio: row.bio || "", mon_chuyen: row.mon_chuyen || "", streak: streakNow,
      can_khao_sat: canKhaoSat, avatar: row.avatar || "", huy_hieu: row.huy_hieu || ""
    },
    token: taoToken(row.id)
  });
}

function _apiSmtpConfig(method, data) {
  var sender = "";
  try { sender = Session.getEffectiveUser().getEmail() || ""; } catch (e) {}
  if (method === "GET") {
    return _jsonOut(200, { success: true, configured: true, smtp_email: sender });
  }
  return _jsonOut(200, {
    success: true, sent: false,
    message: "Hệ thống đang dùng Google Mail trực tiếp của Apps Script, không cần mật khẩu ứng dụng SMTP!"
  });
}

function _apiSendOtp(data) {
  var email = String(data.email || "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return _err("Vui lòng nhập địa chỉ Gmail hợp lệ!", 400);
  var user = findUserByEmail(email);
  if (!user) return _err("Địa chỉ Gmail này chưa được đăng ký tài khoản trên hệ thống!", 404);

  var otp = String(Math.floor(100000 + Math.random() * 900000));
  var token = Utilities.getUuid().replace(/-/g, "");
  var expMs = Date.now() + 10 * 60 * 1000;
  var expStr = Utilities.formatDate(new Date(expMs), TZ_VN, "yyyy-MM-dd HH:mm:ss");

  // Vô hiệu hóa các OTP chưa dùng trước đó của email này
  var prRows = dbReadTable("password_resets");
  for (var i = 0; i < prRows.length; i++) {
    if (String(prRows[i].email || "").toLowerCase() === email && Number(prRows[i].used || 0) === 0) {
      prRows[i].used = 1;
      dbMarkDirty("password_resets");
    }
  }
  dbInsert("password_resets", {
    email: email, otp: otp, token: token, expires_at: expStr, used: 0, created_at: vnNowStr()
  }, true);

  var sent = false, errMsg = "";
  try {
    var htmlBody = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e1e7f0;border-radius:16px;background:#fff;">' +
      '<h2 style="color:#2457d6;margin:0 0 8px;">Vn<span style="color:#ff9800;">StarL</span></h2>' +
      '<p>Xin chào <b>' + _escHtml(user.username || email) + '</b>,</p>' +
      '<p>Mã xác thực (OTP) đặt lại mật khẩu của bạn là:</p>' +
      '<div style="font-size:32px;font-weight:800;letter-spacing:6px;color:#2457d6;padding:12px 20px;border:2px dashed #2457d6;display:inline-block;margin:10px 0;">' + otp + '</div>' +
      '<p style="color:#e07a1f;font-size:13px;">Mã có hiệu lực trong 10 phút. Không chia sẻ mã này cho bất kỳ ai.</p></div>';
    MailApp.sendEmail({
      to: email,
      subject: "VnStarL - Mã xác thực đổi mật khẩu: " + otp,
      htmlBody: htmlBody
    });
    sent = true;
  } catch (e) {
    errMsg = String(e && e.message ? e.message : e);
  }

  if (!sent) {
    return _err("Không gửi được email OTP lúc này (" + errMsg + "). Hãy dùng nút đăng nhập bằng Google hoặc thử lại sau.", 500);
  }
  return _jsonOut(200, {
    success: true,
    message: "Đã gửi email chứa mã OTP về hộp thư Gmail: " + email + "!",
    email: email, sent_via_smtp: true, smtp_email: "", smtp_error: ""
  });
}

function _apiVerifyOtp(data) {
  var email = String(data.email || "").trim().toLowerCase();
  var otp = String(data.otp || "").trim();
  if (!email || !otp) return _err("Vui lòng nhập đầy đủ email và mã OTP!", 400);
  var rows = dbReadTable("password_resets");
  var row = null;
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i].email || "").toLowerCase() === email && String(rows[i].otp || "") === otp) {
      row = rows[i]; break;
    }
  }
  if (!row) return _err("Mã xác thực OTP không chính xác!", 400);
  if (Number(row.used || 0)) return _err("Mã xác thực OTP này đã được sử dụng rồi!", 400);
  var expMs = parseYmdHmsMs(row.expires_at);
  if (!expMs || Date.now() > expMs) return _err("Mã xác thực đã hết hạn (10 phút). Vui lòng yêu cầu mã mới!", 400);

  row.used = 1;
  dbMarkDirty("password_resets");
  var resetToken = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "").slice(0, 16);
  var expStr = Utilities.formatDate(new Date(Date.now() + 15 * 60 * 1000), TZ_VN, "yyyy-MM-dd HH:mm:ss");
  dbInsert("password_resets", {
    email: email, otp: "VERIFIED", token: resetToken, expires_at: expStr, used: 0, created_at: vnNowStr()
  }, true);

  return _jsonOut(200, {
    success: true, message: "Xác thực OTP thành công! Hãy đặt mật khẩu mới.",
    reset_token: resetToken, email: email
  });
}

function _apiGoogleVerify(data) {
  var credential = data.credential;
  if (!credential || typeof credential !== "string") {
    return _err("Thiếu Google credential hợp lệ!", 400);
  }
  var email = "";
  try {
    var resp = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential), { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return _err("Xác thực Google Token thất bại!", 401);
    var info = JSON.parse(resp.getContentText());
    if (String(info.email_verified) !== "true") return _err("Email Google chưa được xác minh!", 401);
    email = String(info.email || "").trim().toLowerCase();
  } catch (e) {
    return _err("Không kiểm tra được Google Token!", 500);
  }
  if (!email) return _err("Không tìm thấy thông tin email từ Google!", 400);

  var user = findUserByEmail(email);
  if (!user) return _err("Tài khoản Gmail (" + email + ") chưa được đăng ký trên VnStarL! Vui lòng đăng ký tài khoản trước nhé.", 404);

  var resetToken = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "").slice(0, 16);
  var expStr = Utilities.formatDate(new Date(Date.now() + 15 * 60 * 1000), TZ_VN, "yyyy-MM-dd HH:mm:ss");
  dbInsert("password_resets", {
    email: email, otp: "GOOGLE_VERIFIED", token: resetToken, expires_at: expStr, used: 0, created_at: vnNowStr()
  }, true);

  return _jsonOut(200, {
    success: true,
    message: "Đã xác thực tài khoản Google (" + email + ") thành công! Bạn có thể đặt mật khẩu mới ngay.",
    email: email, username: user.username, reset_token: resetToken
  });
}

function _apiResetPassword(data) {
  var email = String(data.email || "").trim().toLowerCase();
  var resetToken = String(data.reset_token || "").trim();
  var newMk = String(data.new_mk || "");
  if (!email || !resetToken || !newMk) return _err("Vui lòng nhập đầy đủ thông tin!", 400);
  if (newMk.length < 6) return _err("Mật khẩu mới cần ít nhất 6 ký tự!", 400);

  var rows = dbReadTable("password_resets");
  var row = null;
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i].email || "").toLowerCase() === email && String(rows[i].token || "") === resetToken && Number(rows[i].used || 0) === 0) {
      row = rows[i]; break;
    }
  }
  if (!row) return _err("Phiên đặt lại mật khẩu không hợp lệ hoặc đã sử dụng!", 400);
  var expMs = parseYmdHmsMs(row.expires_at);
  if (!expMs || Date.now() > expMs) return _err("Phiên đổi mật khẩu đã hết hạn. Vui lòng thử lại!", 400);

  var user = findUserByEmail(email);
  if (!user) return _err("Không tìm thấy tài khoản!", 404);
  user.mk = hashPassword(newMk);
  dbMarkDirty("users");
  row.used = 1;
  dbMarkDirty("password_resets");

  return _jsonOut(200, {
    success: true, message: "Đổi mật khẩu thành công! Hãy đăng nhập bằng mật khẩu mới của bạn."
  });
}

// ==================== SUBMIT & GRADING ====================
function _apiSubmit(data, token) {
  var userId = data.user_id != null && data.user_id !== "" ? _toInt(data.user_id, null) : null;
  if (userId) {
    var auth = _authMatch(userId, token);
    if (!auth.ok) return _err(auth.msg, auth.status);
  }
  var subject = String(data.subject || "").replace(/-/g, "_");
  var chapter = String(data.chapter || "");
  var article = String(data.article || "");
  var baiId = String(data.bai_id || "");
  var answers = data.answers;
  if (!TEN_HOP_LE.test(subject) || !TEN_HOP_LE.test(chapter) || !TEN_HOP_LE.test(article) ||
      !/^[0-9.]+$/.test(baiId) || !answers || typeof answers !== "object" || Array.isArray(answers)) {
    return _err("Dữ liệu không hợp lệ!", 400);
  }

  var fileDapAn = getDapAnData(subject + "/" + chapter + "/" + article);
  if (!fileDapAn || !fileDapAn[baiId]) return _err("Không tìm thấy đáp án bài này!", 404);
  var dapAnBai = fileDapAn[baiId];

  var ketQua = {}, diemDat = 0, diemToiDa = 0;
  var cauIds = Object.keys(dapAnBai);
  for (var i = 0; i < cauIds.length; i++) {
    var cid = cauIds[i];
    var info = dapAnBai[cid];
    var diem = Number(info.diem != null ? info.diem : 10);
    diemToiDa += diem;
    var traLoi = answers[cid];
    if (traLoi === null || traLoi === undefined || String(traLoi).trim() === "") {
      ketQua[cid] = { dung: null, diem: diem };
      continue;
    }
    if (info.loai === "tu-luan") {
      var resTl = chamTuLuan(info, traLoi);
      diemDat += resTl.diem;
      ketQua[cid] = {
        dung: resTl.diem >= diem / 2, diem: diem, diem_dat: resTl.diem,
        tu_luan: resTl.chi_tiet, loi_giai: info.loi_giai || ""
      };
      continue;
    }
    var dung = cham(info.dap_an_dung, traLoi);
    if (dung) diemDat += diem;
    ketQua[cid] = { dung: dung, diem: diem, loi_giai: info.loi_giai || "" };
  }
  diemDat = Math.round(diemDat * 100) / 100;
  diemToiDa = Math.round(diemToiDa * 100) / 100;

  var daLuu = false, streak = null, diemCong = 0, heSo = 1.0;
  var pct = diemToiDa ? Math.floor((diemDat * 100) / diemToiDa) : 0;
  var bestPct = null, bestCu = null;
  var baiKey = subject + "/" + chapter + "/" + article + "/" + baiId;

  if (userId && diemDat > 0) {
    var u = findUserRow(userId);
    if (u) {
      var dlRows = dbReadTable("da_lam");
      var dlRow = null;
      for (var d = 0; d < dlRows.length; d++) {
        if (Number(dlRows[d].user_id) === userId && String(dlRows[d].bai_key) === baiKey) {
          dlRow = dlRows[d]; break;
        }
      }
      bestCu = dlRow ? Number(dlRow.best_pct || 0) : null;
      if (!dlRow) {
        daLuu = true;
        dbInsert("da_lam", { user_id: userId, bai_key: baiKey, best_pct: pct }, false);
        bestPct = pct;
      } else {
        bestPct = ghiDiemCaoNhat(userId, baiKey, pct);
      }

      updateStreak(userId);
      streak = Number(findUserRow(userId).streak || 0);
      heSo = Math.round((1 + Math.min(streak * 0.001, 0.05) + heSoX15(userId)) * 10000) / 10000;
      var heSoLan = daLuu ? 1.0 : 0.5;
      diemCong = Math.round(diemDat * heSoLan * heSo);
      if (diemCong > 0) updateUserScore(userId, diemCong);
    }
  }

  var soLoiGhi = [], huyHieuMoi = [];
  if (userId) {
    var kqKhongTl = {};
    Object.keys(ketQua).forEach(function (k) {
      if (ketQua[k].tu_luan === undefined) kqKhongTl[k] = ketQua[k];
    });
    soLoiGhi = soLoiGhiKetQuaNopBai(userId, baiKey, kqKhongTl);
    nvGhiSuKienNopBai(userId, subject, baiKey, ketQua, pct, bestCu);
    kbGhiHoatDong(userId, baiKey, ketQua, pct);
    huyHieuMoi = kiemTraHuyHieu(userId);
  }

  return _jsonOut(200, {
    success: true, diem_dat: diemDat, diem_toi_da: diemToiDa, ket_qua: ketQua,
    da_luu: daLuu, streak: streak, diem_cong: diemCong, he_so: heSo,
    pct: pct, best_pct: bestPct, so_loi_ghi: soLoiGhi, huy_hieu_moi: huyHieuMoi
  });
}

function _apiRanking(q) {
  var bang = String(q.bang || "khong-chuyen");
  var ky = String(q.ky || "tong");
  var userId = _toInt(q.user_id, null);
  if (!BANG_XEP_HANG[bang] || !KY_XEP_HANG[ky]) return _err("Bảng xếp hạng không hợp lệ!", 400);
  var ds = getRanking(bang, ky, 20);
  var me = null;
  if (userId && !ds.some(function (u) { return u.id === userId; })) {
    me = getMyRank(userId, bang, ky);
  }
  return _jsonOut(200, { success: true, bang: bang, ky: ky, data: ds, me: me });
}

function _apiRankingCauHinh() {
  return _jsonOut(200, {
    success: true,
    bang: Object.keys(BANG_XEP_HANG).map(function (k) { return { id: k, ten: BANG_XEP_HANG[k][0], mon: BANG_XEP_HANG[k][1] }; }),
    ky: Object.keys(KY_XEP_HANG).map(function (k) { return { id: k, ten: KY_XEP_HANG[k] }; }),
    thang: vnThangHienTai()
  });
}

function _apiTienDo(subject, q) {
  subject = subject.replace(/-/g, "_");
  var chuongLoc = String(q.chuong || "");
  var baiLoc = String(q.bai || "");
  if (!TEN_HOP_LE.test(subject) || (chuongLoc && !TEN_HOP_LE.test(chuongLoc)) || (baiLoc && !TEN_HOP_LE.test(baiLoc))) {
    return _err("Dữ liệu không hợp lệ!", 400);
  }
  var userId = _toInt(q.user_id, null);
  var ruongDaMo = [];
  if (userId) {
    dbReadTable("ruong_chuong").forEach(function (r) {
      if (Number(r.user_id) === userId && String(r.subject) === subject) ruongDaMo.push(String(r.chuong));
    });
  }
  return _jsonOut(200, { success: true, data: getTienDo(subject, chuongLoc, baiLoc, userId), ruong_da_mo: ruongDaMo });
}

function _apiMoRuong(data, token) {
  var uid = _toInt(data.user_id, null);
  var subject = String(data.subject || "").trim().replace(/-/g, "_");
  var chuong = String(data.chuong || "").trim();
  if (!subject || !chuong || !TEN_HOP_LE.test(subject) || !TEN_HOP_LE.test(chuong)) {
    return _err("Dữ liệu không hợp lệ!", 400);
  }
  if (!uid) return _err("Bạn cần đăng nhập để mở rương!", 400);
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  if (!findUserRow(uid)) return _err("Không tìm thấy người dùng!", 404);

  var daMo = dbReadTable("ruong_chuong").some(function (r) {
    return Number(r.user_id) === uid && String(r.subject) === subject && String(r.chuong) === chuong;
  });
  if (daMo) return _err("Bạn đã mở rương chương này rồi!", 409);

  var td = getTienDo(subject, chuong, "", uid)[chuong] || {};
  var articles = Object.keys(td);
  var soBaiHoc = articles.length, tongToiDa = 0, tongDat = 0;
  for (var i = 0; i < articles.length; i++) {
    var baiMap = td[articles[i]] || {};
    var bids = Object.keys(baiMap);
    tongToiDa += bids.length * 100;
    for (var j = 0; j < bids.length; j++) tongDat += Math.max(0, Math.min(100, Number(baiMap[bids[j]] || 0)));
  }
  if (soBaiHoc === 0 || tongToiDa === 0) return _err("Chương này chưa có bài tập để mở rương!", 400);
  if (tongDat < tongToiDa) return _err("Bạn cần hoàn thành 100% điểm của chương này trước khi mở rương!", 403);

  var diemThuong = Math.min(500, Math.round(tongToiDa / soBaiHoc));
  dbInsert("ruong_chuong", { user_id: uid, subject: subject, chuong: chuong, diem_thuong: diemThuong, ngay_mo: vnNowStr() }, true);
  congDiemVaEduCoin(uid, diemThuong, true);
  return _jsonOut(200, { success: true, diem_thuong: diemThuong, chuong: chuong });
}

function _apiMucTieuTuan(method, uid, data, token) {
  var u = findUserRow(uid);
  if (!u) return _err("Không tìm thấy người dùng!", 404);
  var mucTieu = Math.max(5, Math.min(200, Number(u.muc_tieu_tuan || 20)));
  if (method === "PUT") {
    var auth = _authMatch(uid, token);
    if (!auth.ok) return _err(auth.msg, auth.status);
    var mt = _toInt(data.muc_tieu, null);
    if (mt === null) return _err("Mục tiêu tuần phải là số nguyên!", 400);
    if (mt < 5 || mt > 200) return _err("Mục tiêu tuần phải từ 5 đến 200 bài!", 400);
    u.muc_tieu_tuan = mt;
    dbMarkDirty("users");
    mucTieu = mt;
  }
  var homNay = vnTodayStr();
  var dtToday = parseYmd(homNay);
  var dow = (dtToday.getUTCDay() + 6) % 7; // T2=0 .. CN=6
  var thuHai = addDaysYmd(homNay, -dow);
  var chuNhat = addDaysYmd(thuHai, 6);
  var byDay = {};
  dbReadTable("kb_hoat_dong").forEach(function (r) {
    if (Number(r.user_id) !== uid) return;
    var ng = String(r.ngay || "");
    if (ng >= thuHai && ng <= chuNhat) {
      if (!byDay[ng]) byDay[ng] = {};
      byDay[ng][String(r.bai_key)] = true;
    }
  });
  var tenThu = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  var theoNgay = [], daLamTuan = 0;
  for (var i = 0; i < 7; i++) {
    var ngStr = addDaysYmd(thuHai, i);
    var sb = byDay[ngStr] ? Object.keys(byDay[ngStr]).length : 0;
    daLamTuan += sb;
    theoNgay.push({ thu: tenThu[i], ngay: ngStr, so_bai: sb, is_today: ngStr === homNay });
  }
  return _jsonOut(200, {
    success: true,
    data: {
      muc_tieu: mucTieu, da_lam_tuan: daLamTuan, theo_ngay: theoNgay,
      streak: streakHienThi(u.streak, u.last_active_date, u.the_bao_ho),
      da_hoc_hom_nay: String(u.last_active_date || "") === homNay
    }
  });
}

// ==================== USERS / AVATARS ====================
function _apiGetProfile(uid) {
  var u = getUserPublic(uid);
  if (!u) return _err("Không tìm thấy người dùng!", 404);
  return _jsonOut(200, { success: true, data: u });
}

function _apiSaveMonChuyen(uid, data, token) {
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  var mon = data.mon_chuyen != null ? data.mon_chuyen : "";
  if (typeof mon !== "string" || !MON_CHUYEN_HOP_LE[mon]) return _err("Môn chuyên không hợp lệ!", 400);
  var u = findUserRow(uid);
  if (!u) return _err("Không tìm thấy người dùng!", 404);
  u.mon_chuyen = mon;
  dbMarkDirty("users");
  return _jsonOut(200, { success: true, message: "Đã lưu môn chuyên!" });
}

function _apiEditProfile(uid, data, token) {
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  var u = findUserRow(uid);
  if (!u) return _err("Không tìm thấy người dùng!", 404);
  if (Number(u.score || 0) < DIEM_MO_KHOA_SUA) {
    return _err("Bạn phải đủ " + DIEM_MO_KHOA_SUA + " điểm mới mở khóa tính năng này!", 403);
  }
  var username = String(data.username || "").trim();
  var bio = String(data.bio || "").trim();
  if (!username) return _err("Tên không được để trống!", 400);
  if (username.length > 30) return _err("Tên tối đa 30 ký tự!", 400);
  if (bio.length > 150) return _err("Giới thiệu tối đa 150 ký tự!", 400);
  u.username = username;
  u.bio = bio;
  dbMarkDirty("users");
  return _jsonOut(200, { success: true, username: username, bio: bio });
}

function _xoaAnhDriveCu(avatarVal) {
  if (avatarVal && String(avatarVal).indexOf("drv_") === 0) {
    var fid = String(avatarVal).slice(4);
    try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) {}
  }
}

function _apiSaveAvatar(uid, data, token) {
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  var u = findUserRow(uid);
  if (!u) return _err("Không tìm thấy người dùng!", 404);
  var avatar = String(data.avatar || "").trim();
  if (avatar !== "" && AVATAR_LIST.indexOf(avatar) === -1) return _err("Avatar không tồn tại!", 400);
  _xoaAnhDriveCu(u.avatar);
  u.avatar = avatar;
  dbMarkDirty("users");
  return _jsonOut(200, { success: true, avatar: avatar });
}

function _apiUploadAvatar(uid, data, token) {
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  var u = findUserRow(uid);
  if (!u) return _err("Không tìm thấy người dùng!", 404);
  if (Number(u.score || 0) < DIEM_MO_KHOA_AVATAR) {
    return _err("Bạn phải đủ " + DIEM_MO_KHOA_AVATAR + " điểm mới tải được avatar riêng!", 403);
  }
  var b64 = String(data.file_base64 || "");
  if (!b64) return _err("Chưa chọn ảnh!", 400);
  var m = /^data:(image\/(?:webp|png|jpeg|gif));base64,(.+)$/i.exec(b64);
  if (!m) return _err("File không phải ảnh hợp lệ (chỉ nhận JPG, PNG, WEBP, GIF)!", 400);
  var bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 2.5 * 1024 * 1024) return _err("Ảnh quá lớn (tối đa 2.5MB)!", 413);

  var folders = DriveApp.getFoldersByName(DRIVE_AVATAR_FOLDER);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_AVATAR_FOLDER);
  var ext = m[1].split("/")[1].replace("jpeg", "jpg");
  var blob = Utilities.newBlob(bytes, m[1], "avatar_" + uid + "_" + Date.now() + "." + ext);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var tenMoi = "drv_" + file.getId();

  _xoaAnhDriveCu(u.avatar);
  u.avatar = tenMoi;
  dbMarkDirty("users");
  return _jsonOut(200, { success: true, avatar: tenMoi });
}

// ==================== CONTESTS ====================
function _apiListContests() {
  var rows = dbReadTable("contests").slice().sort(function (a, b) {
    return String(b.bat_dau || "").localeCompare(String(a.bat_dau || ""));
  });
  var bayGio = vnNowHmStr();
  var ds = rows.map(function (r) {
    var c = Object.assign({}, r, { id: Number(r.id) });
    c.trang_thai = bayGio < c.bat_dau ? "sap-dien-ra" : (bayGio <= c.ket_thuc ? "dang-dien-ra" : "da-ket-thuc");
    return c;
  });
  return _jsonOut(200, { success: true, data: ds });
}

function _apiContestSubmit(cid, data, token) {
  var uid = _toInt(data.user_id, null);
  if (!uid) return _err("Hãy đăng nhập để thi!", 401);
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);

  var answers = data.answers == null ? {} : data.answers;
  if (typeof answers !== "object" || Array.isArray(answers)) return _err("Dữ liệu bài làm không hợp lệ!", 400);

  var cs = dbReadTable("contests").filter(function (c) { return Number(c.id) === cid; })[0];
  if (!cs) return _err("Không có cuộc thi này!", 404);
  var bayGio = vnNowHmStr();
  if (!(String(cs.bat_dau) <= bayGio && bayGio <= String(cs.ket_thuc))) {
    return _err("Cuộc thi không trong giờ làm bài!", 403);
  }
  var dapAn = getDapAnData("contest/" + cid);
  if (!dapAn || typeof dapAn !== "object") return _err("Không tìm thấy đáp án cuộc thi này!", 404);

  var existing = dbReadTable("contest_ket_qua");
  for (var e = 0; e < existing.length; e++) {
    if (Number(existing[e].user_id) === uid && Number(existing[e].contest_id) === cid) {
      return _err("Bạn đã nộp bài này rồi!", 409);
    }
  }

  var diem = 0;
  Object.keys(dapAn).forEach(function (cauId) {
    var info = dapAn[cauId];
    if (!info || typeof info !== "object") return;
    var tl = answers[cauId];
    if (tl === null || tl === undefined || String(tl).trim() === "") return;
    if (info.loai === "tu-luan" || (info.dap_an_dung === undefined && (info.y || info.nhom_tu_khoa))) {
      diem += chamTuLuan(info, tl).diem;
      return;
    }
    if (info.dap_an_dung !== undefined && info.dap_an_dung !== null && cham(info.dap_an_dung, tl)) {
      diem += typeof info.diem === "number" ? info.diem : 10;
    }
  });
  diem = diem === Math.floor(diem) ? diem : Math.round(diem * 100) / 100;

  dbInsert("contest_ket_qua", { user_id: uid, contest_id: cid, diem: diem }, false);
  return _jsonOut(200, { success: true, diem: diem });
}

function _apiContestRanking(cid) {
  var uMap = {};
  dbReadTable("users").forEach(function (u) { uMap[Number(u.id)] = u; });
  var rows = dbReadTable("contest_ket_qua").filter(function (r) { return Number(r.contest_id) === cid; })
    .sort(function (a, b) { return Number(b.diem || 0) - Number(a.diem || 0); }).slice(0, 50)
    .map(function (r) {
      var u = uMap[Number(r.user_id)] || {};
      return {
        user_id: Number(r.user_id), username: u.username || "",
        avatar: u.avatar || "", huy_hieu: u.huy_hieu || "", diem: Number(r.diem || 0)
      };
    });
  return _jsonOut(200, { success: true, data: rows });
}

// ==================== HUY HIỆU ====================
function _apiXemHuyHieu(uid) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    resetDbMemCache();
    var data = layDuLieuHuyHieu(uid);
    if (!data) return _err("Không tìm thấy người dùng!", 404);
    dbFlushDirty();
    return _jsonOut(200, { success: true, data: data });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function _apiDeoHuyHieu(data, token) {
  var uid = _toInt(data.user_id, null);
  if (!uid) return _err("Dữ liệu không hợp lệ!", 400);
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  var badgeId = typeof data.huy_hieu === "string" ? data.huy_hieu.trim() : "";
  var hhMap = {};
  DS_HUY_HIEU.forEach(function (b) { hhMap[b.id] = b; });
  if (badgeId && !hhMap[badgeId]) return _err("Huy hiệu không tồn tại!", 400);
  var u = findUserRow(uid);
  if (!u) return _err("Không tìm thấy người dùng!", 404);

  if (badgeId) {
    kiemTraHuyHieu(uid);
    var unlocked = dbReadTable("user_huy_hieu").some(function (r) {
      return Number(r.user_id) === uid && String(r.badge_id) === badgeId;
    });
    if (!unlocked) return _err("Bạn chưa mở khóa huy hiệu này!", 403);
  }
  u.huy_hieu = badgeId;
  dbMarkDirty("users");
  return _jsonOut(200, { success: true, huy_hieu: badgeId, data: { huy_hieu: badgeId, dang_deo: badgeId } });
}

// ==================== PET (SAO LA) ====================
function _petTrangThai(uid) {
  var pRow = dbReadTable("pet").filter(function (r) { return Number(r.user_id) === uid; })[0];
  var soHuu = { mac_dinh: true };
  dbReadTable("pet_do").forEach(function (r) {
    if (Number(r.user_id) === uid) soHuu[String(r.skin_id)] = true;
  });
  var gioiTinh = pRow && (pRow.gioi_tinh === "nam" || pRow.gioi_tinh === "nu") ? pRow.gioi_tinh : "nu";
  var dangMac = pRow && pRow.skin_dang_mac ? String(pRow.skin_dang_mac) : "mac_dinh";
  if (!PET_MANIFEST.skin[dangMac] || !soHuu[dangMac]) dangMac = "mac_dinh";
  var dsSkin = Object.keys(PET_MANIFEST.skin).map(function (sid) {
    var info = PET_MANIFEST.skin[sid];
    var own = !!soHuu[sid];
    var d = { id: sid, ten: info.ten, gia: info.gia, xem_truoc: "img/pet/than/" + sid + "/_xem_truoc.webp?v=1", so_huu: own };
    if (own) { d.thu_muc = "img/pet/than/" + sid + "/"; d.hanh_dong = info.hanh_dong; d.v = 1; }
    return d;
  });
  var hienTai = dsSkin.filter(function (s) { return s.id === dangMac; })[0] || null;
  return {
    gioi_tinh: gioiTinh, skin_dang_mac: dangMac, skin_hien_tai: hienTai, skin: dsSkin,
    so_khung: PET_MANIFEST.so_khung, fps: PET_MANIFEST.fps,
    hieu_ung: Object.assign({ thu_muc: "img/pet/hieu_ung/", v: 1 }, PET_MANIFEST.hieu_ung)
  };
}

function _apiXemPet(q) {
  var uid = _toInt(q.user_id, null);
  if (!uid) return _err("Thiếu user_id!", 400);
  if (!findUserRow(uid)) return _err("Không tìm thấy người dùng!", 404);
  return _jsonOut(200, { success: true, data: _petTrangThai(uid) });
}

function _apiDoiGioiTinhPet(data, token) {
  var auth = _authMatch(null, token);
  if (!auth.ok) return _err("Hãy đăng xuất rồi đăng nhập lại để dùng tính năng này!", 401);
  var uid = auth.uid;
  var gt = String(data.gioi_tinh || "").trim().toLowerCase();
  if (gt !== "nam" && gt !== "nu") return _err("Giới tính chỉ có thể là 'nam' hoặc 'nu'!", 400);
  if (!findUserRow(uid)) return _err("Không tìm thấy người dùng!", 404);
  var pRow = dbReadTable("pet").filter(function (r) { return Number(r.user_id) === uid; })[0];
  if (!pRow) dbInsert("pet", { user_id: uid, skin_dang_mac: "mac_dinh", gioi_tinh: gt }, false);
  else { pRow.gioi_tinh = gt; dbMarkDirty("pet"); }
  return _jsonOut(200, { success: true, data: _petTrangThai(uid) });
}

function _apiMacSkinPet(data, token) {
  var auth = _authMatch(null, token);
  if (!auth.ok) return _err("Hãy đăng xuất rồi đăng nhập lại để dùng tính năng này!", 401);
  var uid = auth.uid;
  var skin = String(data.skin || "").trim();
  if (!/^[a-z0-9_]{1,40}$/.test(skin) || !PET_MANIFEST.skin[skin]) return _err("Trang phục không tồn tại!", 404);
  if (!findUserRow(uid)) return _err("Không tìm thấy người dùng!", 404);
  var own = skin === "mac_dinh" || dbReadTable("pet_do").some(function (r) {
    return Number(r.user_id) === uid && String(r.skin_id) === skin;
  });
  if (!own) return _err("Bạn chưa sở hữu trang phục này!", 403);
  var pRow = dbReadTable("pet").filter(function (r) { return Number(r.user_id) === uid; })[0];
  if (!pRow) dbInsert("pet", { user_id: uid, skin_dang_mac: skin, gioi_tinh: "nu" }, false);
  else { pRow.skin_dang_mac = skin; dbMarkDirty("pet"); }
  return _jsonOut(200, { success: true, data: _petTrangThai(uid) });
}

// ==================== QUÀ TẶNG & ĐIỂM DANH ====================
function _apiXemQua(uid) {
  var tt = quaTrangThai(uid);
  if (!tt) return _err("Không tìm thấy người dùng!", 404);
  tt.vong_quay = VONG_QUAY.map(function (o) { return { id: o.id, ten: o.ten }; });
  return _jsonOut(200, { success: true, data: tt });
}

function _apiDiemDanh(data, token) {
  var uid = _toInt(data.user_id, null);
  if (!uid) return _err("Hãy đăng nhập để điểm danh!", 401);
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  var u = findUserRow(uid);
  if (!u) return _err("Không tìm thấy người dùng!", 404);
  var homNay = vnTodayStr();
  if (String(u.dd_last || "") === homNay) return _err("Hôm nay bạn đã điểm danh rồi!", 409);

  u.dd_last = homNay;
  u.dd_tong = Number(u.dd_tong || 0) + 1;
  dbMarkDirty("users");
  var tong = u.dd_tong;
  var nhan = [];
  if (tong <= QUA_CHU_KY) {
    var q = QUA_TUAN_DAU[tong - 1];
    if (q.loai === "diem") { updateUserScore(uid, q.gia_tri); nhan.push("+" + q.gia_tri + " điểm"); }
    else if (q.loai === "bao_ho") {
      if (_congBaoHo(u)) nhan.push("1 thẻ bảo hộ streak");
      else { updateUserScore(uid, DIEM_DOI_THE_DAY); nhan.push("+" + DIEM_DOI_THE_DAY + " điểm (thẻ bảo hộ đã đầy)"); }
    }
  }
  if (tong % QUA_CHU_KY === 0) {
    u.luot_quay = Number(u.luot_quay || 0) + 1;
    dbMarkDirty("users");
    nhan.push("1 lượt quay vòng quay thưởng");
  }
  if (!nhan.length) nhan.push("Điểm danh thành công! Cố lên, sắp tới quà rồi");
  kiemTraHuyHieu(uid);
  return _jsonOut(200, { success: true, tong_ngay: tong, nhan: nhan, trang_thai: quaTrangThai(uid) });
}

function _apiQuayThuong(data, token) {
  var uid = _toInt(data.user_id, null);
  if (!uid) return _err("Hãy đăng nhập để quay!", 401);
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  var u = findUserRow(uid);
  if (!u) return _err("Không tìm thấy người dùng!", 404);
  if (Number(u.luot_quay || 0) <= 0) return _err("Bạn chưa có lượt quay nào!", 403);
  u.luot_quay = Number(u.luot_quay) - 1;
  dbMarkDirty("users");

  var totalW = 0;
  VONG_QUAY.forEach(function (o) { totalW += o.w; });
  var r = Math.random() * totalW, acc = 0, trung = VONG_QUAY[0];
  for (var i = 0; i < VONG_QUAY.length; i++) {
    acc += VONG_QUAY[i].w;
    if (r < acc) { trung = VONG_QUAY[i]; break; }
  }
  var ghiChu = "";
  if (trung.id === "diem10" || trung.id === "diem20" || trung.id === "diem50") {
    updateUserScore(uid, trung.diem);
  } else if (trung.id === "bao_ho") {
    if (!_congBaoHo(u)) {
      updateUserScore(uid, DIEM_DOI_THE_DAY);
      ghiChu = "Thẻ bảo hộ đã đầy nên được đổi thành +" + DIEM_DOI_THE_DAY + " điểm";
    }
  } else if (trung.id === "x15") {
    var conLai = x15ConLai(u.x15_den);
    var hetMs = vnNowUtcMs() + (conLai + BUFF_X15_GIAY) * 1000;
    u.x15_den = Utilities.formatDate(new Date(hetMs), TZ_VN, "yyyy-MM-dd HH:mm:ss");
    dbMarkDirty("users");
  } else if (trung.id === "them_luot") {
    u.luot_quay = Number(u.luot_quay || 0) + 1;
    dbMarkDirty("users");
  }
  kiemTraHuyHieu(uid);
  return _jsonOut(200, {
    success: true, trung: { id: trung.id, ten: trung.ten },
    ghi_chu: ghiChu, trang_thai: quaTrangThai(uid)
  });
}

function _apiDoiBaoHo(data, token) {
  var uid = _toInt(data.user_id, null);
  if (!uid) return _err("Hãy đăng nhập để đổi thẻ bảo hộ!", 401);
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  var u = findUserRow(uid);
  if (!u) return _err("Không tìm thấy người dùng!", 404);
  var curBh = Number(u.the_bao_ho || 0);
  if (curBh >= TOI_DA_BAO_HO) return _err("Bạn đã giữ tối đa " + TOI_DA_BAO_HO + "/" + TOI_DA_BAO_HO + " thẻ bảo hộ rồi!", 400);
  if (Number(u.score || 0) < 100) return _err("Bạn cần ít nhất 100 điểm để đổi 1 thẻ bảo hộ!", 400);
  u.score = Number(u.score || 0) - 100;
  u.the_bao_ho = curBh + 1;
  dbMarkDirty("users");
  return _jsonOut(200, {
    success: true, message: "Đã đổi -100 điểm lấy +1 thẻ bảo hộ streak!",
    score: u.score, the_bao_ho: u.the_bao_ho, toi_da_bao_ho: TOI_DA_BAO_HO
  });
}

// ==================== VƯỜN SAOLADOU & SHOP EDUCOIN ====================
function _apiVuonXem(q) {
  var uid = _toInt(q.user_id, null);
  if (!uid) return _err("Thiếu user_id!", 400);
  var st = vuonBuildState(uid);
  if (!st) return _err("Không tìm thấy người dùng!", 404);
  dbFlushDirty();
  return _jsonOut(200, { success: true, data: st });
}

function _apiVuonMua(data, token) {
  var auth = _authMatch(null, token);
  if (!auth.ok) return _err("Hãy đăng xuất rồi đăng nhập lại để dùng tính năng này!", 401);
  var uid = auth.uid;
  var u = findUserRow(uid);
  if (!u) return _err("Không tìm thấy người dùng!", 404);

  var loai = String(data.loai || "").trim();
  var itemId = String(data.id || "").trim();
  var sl = _toInt(data.so_luong != null ? data.so_luong : 1, null);
  if (sl === null || sl <= 0 || sl > 99) return _err("Số lượng mua không hợp lệ!", 400);

  if (loai === "skin") {
    var skinInfo = PET_MANIFEST.skin[itemId];
    if (!skinInfo) return _err("Trang phục không tồn tại!", 404);
    var gia = Number(skinInfo.gia || 0);
    if (gia <= 0) return _err("Trang phục này không bán trong cửa hàng!", 400);
    var ownSkin = itemId === "mac_dinh" || dbReadTable("pet_do").some(function (r) {
      return Number(r.user_id) === uid && String(r.skin_id) === itemId;
    });
    if (ownSkin) return _err("Bạn đã sở hữu trang phục này rồi!", 409);
    if (Number(u.educoin || 0) < gia) return _err("Không đủ EduCoin (cần " + gia + " EduCoin)!", 400);
    u.educoin = Number(u.educoin || 0) - gia;
    dbMarkDirty("users");
    dbInsert("pet_do", { user_id: uid, skin_id: itemId, ngay_nhan: vnNowStr() }, false);
    return _jsonOut(200, { success: true, message: "Đã mở khóa trang phục \"" + skinInfo.ten + "\"!", data: vuonBuildState(uid) });
  }

  if (loai !== "vat_pham") return _err("Loại vật phẩm không hợp lệ!", 400);
  var meta = _vuonCatalogMap()[itemId];
  if (!meta) return _err("Vật phẩm không tồn tại!", 404);
  if (meta.mua_1_lan && sl !== 1) return _err("Vật phẩm này chỉ mua 1 lần!", 400);

  if (meta.nhom === "trang_tri") {
    var hasDecor = dbReadTable("vuon_trang_tri").some(function (r) {
      return Number(r.user_id) === uid && String(r.item_id) === itemId;
    });
    if (hasDecor) return _err("Bạn đã sở hữu đồ trang trí này rồi!", 409);
  } else if (meta.mua_1_lan) {
    var hasReuse = dbReadTable("vuon_tui_do").some(function (r) {
      return Number(r.user_id) === uid && String(r.item_id) === itemId && Number(r.so_luong || 0) > 0;
    });
    if (hasReuse) return _err("Bạn đã sở hữu vật phẩm này rồi!", 409);
  }

  var tongGia = Number(meta.gia || 0) * sl;
  if (Number(u.educoin || 0) < tongGia) return _err("Không đủ EduCoin (cần " + tongGia + " EduCoin)!", 400);
  u.educoin = Number(u.educoin || 0) - tongGia;
  dbMarkDirty("users");

  if (meta.nhom === "trang_tri") {
    dbInsert("vuon_trang_tri", { user_id: uid, item_id: itemId, dang_bat: 1 }, false);
  } else {
    var tuiRow = dbReadTable("vuon_tui_do").filter(function (r) {
      return Number(r.user_id) === uid && String(r.item_id) === itemId;
    })[0];
    if (tuiRow) {
      tuiRow.so_luong = Number(tuiRow.so_luong || 0) + sl;
      dbMarkDirty("vuon_tui_do");
    } else {
      dbInsert("vuon_tui_do", { user_id: uid, item_id: itemId, so_luong: sl, lan_dung_cuoi: "" }, false);
    }
  }
  return _jsonOut(200, { success: true, message: "Đã mua " + meta.ten + " (-" + tongGia + " EduCoin)!", data: vuonBuildState(uid) });
}

function _apiVuonDung(data, token) {
  var auth = _authMatch(null, token);
  if (!auth.ok) return _err("Hãy đăng xuất rồi đăng nhập lại để dùng tính năng này!", 401);
  var uid = auth.uid;
  var itemId = String(data.item_id || "").trim();
  var meta = _vuonCatalogMap()[itemId];
  if (!meta || meta.nhom === "trang_tri") return _err("Vật phẩm này không dùng trực tiếp được!", 400);

  var tuiRow = dbReadTable("vuon_tui_do").filter(function (r) {
    return Number(r.user_id) === uid && String(r.item_id) === itemId && Number(r.so_luong || 0) > 0;
  })[0];
  if (!tuiRow) return _err("Bạn chưa có vật phẩm này trong túi!", 404);

  var nowMs = vnNowUtcMs();
  if (!meta.tieu_hao && meta.cooldown_giay > 0 && tuiRow.lan_dung_cuoi) {
    var lastMs = parseYmdHmsMs(tuiRow.lan_dung_cuoi);
    if (lastMs !== null) {
      var rem = Math.ceil(meta.cooldown_giay - (nowMs - lastMs) / 1000);
      if (rem > 0) return _err("Vật phẩm đang hồi chiêu, chờ thêm " + rem + " giây nữa nhé!", 429);
    }
  }

  var vt = _vuonApplyDecay(_vuonGetOrInit(uid));
  var hq = meta.hieu_qua || {};
  if (hq.min_all) {
    vt.no_bung = Math.max(Number(vt.no_bung || 0), hq.min_all);
    vt.vui_ve = Math.max(Number(vt.vui_ve || 0), hq.min_all);
    vt.sach_se = Math.max(Number(vt.sach_se || 0), hq.min_all);
  }
  if (hq.no_bung) vt.no_bung = Math.max(0, Math.min(100, Number(vt.no_bung || 0) + hq.no_bung));
  if (hq.vui_ve) vt.vui_ve = Math.max(0, Math.min(100, Number(vt.vui_ve || 0) + hq.vui_ve));
  if (hq.sach_se) vt.sach_se = Math.max(0, Math.min(100, Number(vt.sach_se || 0) + hq.sach_se));
  vt.lan_cham = vnNowStr();
  dbMarkDirty("vuon_trang_thai");

  var leveledUp = _vuonCongExp(vt, Number(hq.exp || 0));
  if (meta.tieu_hao) {
    tuiRow.so_luong = Math.max(0, Number(tuiRow.so_luong || 0) - 1);
  } else {
    tuiRow.lan_dung_cuoi = vnNowStr();
  }
  dbMarkDirty("vuon_tui_do");

  return _jsonOut(200, {
    success: true,
    message: "Đã dùng " + meta.ten + (leveledUp ? " — SaoLa vừa lên cấp!" : "!"),
    leveled_up: leveledUp,
    data: vuonBuildState(uid)
  });
}

function _apiVuonVuotVe(data, token) {
  var auth = _authMatch(null, token);
  if (!auth.ok) return _err("Hãy đăng xuất rồi đăng nhập lại để dùng tính năng này!", 401);
  var uid = auth.uid;
  var vt = _vuonApplyDecay(_vuonGetOrInit(uid));
  var nowMs = vnNowUtcMs();
  if (vt.lan_vuot_ve) {
    var lMs = parseYmdHmsMs(vt.lan_vuot_ve);
    if (lMs !== null) {
      var rem = Math.ceil(VUON_VUOT_VE_CD - (nowMs - lMs) / 1000);
      if (rem > 0) return _err("Đợi " + rem + " giây nữa hãy vuốt ve tiếp nhé!", 429);
    }
  }
  var sk = _vuonSucKhoe(Number(vt.no_bung || 0), Number(vt.vui_ve || 0), Number(vt.sach_se || 0));
  if (sk === "om") {
    return _jsonOut(200, {
      success: true, exp_cong: 0, vui_cong: 0, leveled_up: false,
      message: "Saoladuo đang ốm, hãy cho ăn hoặc dùng Thảo dược trước nhé!",
      data: vuonBuildState(uid)
    });
  }
  var homNay = vnTodayStr();
  var dem = String(vt.vuot_ve_ngay || "") === homNay ? Number(vt.vuot_ve_dem || 0) : 0;
  vt.lan_vuot_ve = vnNowStr();
  vt.vuot_ve_ngay = homNay;
  if (dem >= VUON_VUOT_VE_MAX_NGAY) {
    dbMarkDirty("vuon_trang_thai");
    return _jsonOut(200, {
      success: true, exp_cong: 0, vui_cong: 0, leveled_up: false,
      message: "Hôm nay Saoladuo đã nhận đủ 5 lượt thưởng vuốt ve rồi, nhưng vẫn rất thích được bạn cưng nựng!",
      data: vuonBuildState(uid)
    });
  }
  vt.vuot_ve_dem = dem + 1;
  vt.vui_ve = Math.max(0, Math.min(100, Number(vt.vui_ve || 0) + 5));
  vt.lan_cham = vnNowStr();
  dbMarkDirty("vuon_trang_thai");
  var leveledUp = _vuonCongExp(vt, 4);
  return _jsonOut(200, {
    success: true, exp_cong: 4, vui_cong: 5, leveled_up: leveledUp,
    message: "Saoladuo thích mê! (+5 Vui vẻ, +4 EXP)",
    data: vuonBuildState(uid)
  });
}

function _apiVuonTrangTri(data, token) {
  var auth = _authMatch(null, token);
  if (!auth.ok) return _err("Hãy đăng xuất rồi đăng nhập lại để dùng tính năng này!", 401);
  var uid = auth.uid;
  var itemId = String(data.item_id || "").trim();
  var bat = Boolean(data.bat);
  var row = dbReadTable("vuon_trang_tri").filter(function (r) {
    return Number(r.user_id) === uid && String(r.item_id) === itemId;
  })[0];
  if (!row) return _err("Bạn chưa sở hữu đồ trang trí này!", 404);
  row.dang_bat = bat ? 1 : 0;
  dbMarkDirty("vuon_trang_tri");
  return _jsonOut(200, {
    success: true,
    message: bat ? "Đã bật đồ trang trí trong vườn!" : "Đã cất đồ trang trí.",
    data: vuonBuildState(uid)
  });
}

// ==================== NHIỆM VỤ ====================
function _apiNvXem(uid) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    resetDbMemCache();
    if (!findUserRow(uid)) return _err("Không tìm thấy người dùng!", 404);
    var tt = nvTrangThai(uid);
    dbFlushDirty();
    return _jsonOut(200, { success: true, data: tt });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function _apiNvNhan(data, token) {
  var uid = _toInt(data.user_id, null);
  var nvId = String(data.nv_id || "");
  var nv = _nvMap()[nvId];
  if (!uid || !nv) return _err("Dữ liệu không hợp lệ!", 400);
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  var u = findUserRow(uid);
  if (!u) return _err("Không tìm thấy người dùng!", 404);
  var ngay = vnTodayStr();
  var ids = _nvDsHomNay(uid, ngay);
  if (ids.indexOf(nvId) === -1) return _err("Nhiệm vụ này không có trong hôm nay!", 403);
  if (_nvTienDo(uid, ngay, nv) < nv.muc_tieu) return _err("Bạn chưa hoàn thành nhiệm vụ này!", 409);

  var nvRows = dbReadTable("nv_ngay");
  var targetRow = null;
  for (var i = 0; i < nvRows.length; i++) {
    if (Number(nvRows[i].user_id) === uid && String(nvRows[i].ngay) === ngay && String(nvRows[i].nv_id) === nvId) {
      targetRow = nvRows[i]; break;
    }
  }
  if (!targetRow || Number(targetRow.da_nhan || 0) !== 0) return _err("Bạn đã nhận thưởng nhiệm vụ này rồi!", 409);
  targetRow.da_nhan = 1;
  dbMarkDirty("nv_ngay");

  var diem = NV_THUONG[nv.kho].diem;
  congDiemVaEduCoin(uid, diem, false);

  var soNhan = 0, daDu3 = false;
  for (var j = 0; j < nvRows.length; j++) {
    if (Number(nvRows[j].user_id) === uid && String(nvRows[j].ngay) === ngay && Number(nvRows[j].da_nhan) === 1) {
      if (String(nvRows[j].nv_id) === "_du3") daDu3 = true;
      else if (ids.indexOf(String(nvRows[j].nv_id)) !== -1) soNhan++;
    }
  }
  var thuongThem = 0;
  if (soNhan >= ids.length && !daDu3) {
    dbInsert("nv_ngay", { user_id: uid, ngay: ngay, nv_id: "_du3", da_nhan: 1 }, false);
    u.luot_quay = Number(u.luot_quay || 0) + NV_LUOT_QUAY_DU_3;
    dbMarkDirty("users");
    thuongThem = NV_LUOT_QUAY_DU_3;
  }
  kiemTraHuyHieu(uid);
  return _jsonOut(200, { success: true, diem: diem, luot_quay_them: thuongThem, trang_thai: nvTrangThai(uid) });
}

function _apiNvSuKien(data, token) {
  var uid = _toInt(data.user_id, null);
  var loai = String(data.loai || "");
  if (!uid || loai !== "ly_thuyet") return _err("Dữ liệu không hợp lệ!", 400);
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  if (!findUserRow(uid)) return _err("Không tìm thấy người dùng!", 404);
  nvGhiSuKien(uid, loai, 1);
  return _jsonOut(200, { success: true });
}

// ==================== SỔ LỖI SAI ====================
function _apiSlKyNang(uid) {
  if (!findUserRow(uid)) return _err("Không tìm thấy người dùng!", 404);
  var homNay = vnTodayStr();
  var slRows = dbReadTable("so_loi");
  var ds = [];
  dbReadTable("ky_nang_user").forEach(function (r) {
    if (Number(r.user_id) !== uid) return;
    var key = String(r.bai_key || "");
    if (!SL_KEY_RE.test(key)) return;
    var tong = 0, chua = 0, nnCount = {};
    for (var i = 0; i < slRows.length; i++) {
      var s = slRows[i];
      if (Number(s.user_id) === uid && String(s.bai_key) === key) {
        tong++;
        if (Number(s.da_hieu || 0) === 0) chua++;
        if (s.nguyen_nhan) nnCount[s.nguyen_nhan] = (nnCount[s.nguyen_nhan] || 0) + 1;
      }
    }
    var nnTop = "", nnMax = 0;
    Object.keys(nnCount).forEach(function (k) { if (nnCount[k] > nnMax) { nnMax = nnCount[k]; nnTop = k; } });
    var muc = Math.min(Math.max(Number(r.muc || 0), 0), SL_TEN_MUC.length - 1);
    var hen = String(r.ngay_on_ke || "");
    var info = _slTenKyNang(key);
    ds.push(Object.assign(info, {
      bai_key: key, muc: muc, ten_muc: SL_TEN_MUC[muc], ngay_on_ke: hen,
      den_han: Boolean(hen && hen <= homNay), tong_loi: tong, loi_chua_hieu: chua, nguyen_nhan_chinh: nnTop
    }));
  });
  ds.sort(function (a, b) {
    if (a.den_han !== b.den_han) return a.den_han ? -1 : 1;
    if (a.muc !== b.muc) return a.muc - b.muc;
    return a.bai_key.localeCompare(b.bai_key);
  });
  var tomTat = {
    tong: ds.length,
    den_han: ds.filter(function (k) { return k.den_han; }).length,
    thong_thao: ds.filter(function (k) { return k.muc === 3; }).length,
    loi_chua_hieu: ds.reduce(function (acc, k) { return acc + k.loi_chua_hieu; }, 0)
  };
  return _jsonOut(200, { success: true, data: { tom_tat: tomTat, ds: ds } });
}

function _apiSlChanDoan(data, token) {
  var uid = _toInt(data.user_id, null), nn = String(data.nguyen_nhan || "");
  if (!uid || !SL_NGUYEN_NHAN[nn]) return _err("Dữ liệu không hợp lệ!", 400);
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  var key, cauId;
  if (data.the_id != null) {
    var tid = _toInt(data.the_id, null);
    var the = dbReadTable("on_tap_the").filter(function (r) { return Number(r.id) === tid && Number(r.user_id) === uid; })[0];
    if (!the) return _err("Không tìm thấy thẻ này!", 404);
    the.nguyen_nhan = nn;
    dbMarkDirty("on_tap_the");
    key = String(the.bai_key); cauId = String(the.cau_id);
  } else {
    key = String(data.bai_key || ""); cauId = String(data.cau_id || "");
    if (!SL_KEY_RE.test(key)) return _err("Dữ liệu không hợp lệ!", 400);
  }
  dbReadTable("so_loi").forEach(function (s) {
    if (Number(s.user_id) === uid && String(s.bai_key) === key && String(s.cau_id) === cauId) {
      s.nguyen_nhan = nn; dbMarkDirty("so_loi");
    }
  });
  return _jsonOut(200, { success: true });
}

function _apiSlTaoThe(data, token) {
  var uid = _toInt(data.user_id, null), key = String(data.bai_key || "");
  if (!uid || !SL_KEY_RE.test(key)) return _err("Dữ liệu không hợp lệ!", 400);
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  var tai = _slTaiBai(key);
  if (!tai) return _err("Không tìm thấy đề hoặc đáp án của bài này!", 404);
  var kn = dbReadTable("ky_nang_user").filter(function (r) { return Number(r.user_id) === uid && String(r.bai_key) === key; })[0];
  if (!kn) return _err("Kỹ năng này chưa có trong sổ của bạn!", 404);

  var homNay = vnTodayStr();
  var loai = null, cauId = null, conLai = 0;
  var slRows = dbReadTable("so_loi");
  for (var i = 0; i < slRows.length; i++) {
    var s = slRows[i];
    if (Number(s.user_id) === uid && String(s.bai_key) === key && Number(s.da_hieu || 0) === 0) {
      var cid = String(s.cau_id);
      if (_slTimCau(tai, cid) && tai.dap_an[cid]) {
        if (loai === null) { loai = "sua"; cauId = cid; }
        conLai++;
      } else {
        s.da_hieu = 1; dbMarkDirty("so_loi");
      }
    }
  }
  if (loai === null) {
    var hopLe = (tai.bai.cau_hoi || []).filter(function (c) {
      return SL_LOAI_CAU[c.type] && tai.dap_an[String(c.id)];
    }).map(function (c) { return String(c.id); });
    if (!hopLe.length) return _err("Bài này chưa đủ câu để ôn.", 409);
    var daSai = {};
    slRows.forEach(function (s) { if (Number(s.user_id) === uid && String(s.bai_key) === key) daSai[String(s.cau_id)] = true; });
    var ganDay = {};
    dbReadTable("on_tap_the").forEach(function (t) {
      if (Number(t.user_id) === uid && String(t.bai_key) === key) {
        ganDay[String(t.cau_id)] = Math.max(ganDay[String(t.cau_id)] || 0, Number(t.id));
      }
    });
    var pool = hopLe.filter(function (id) { return !daSai[id]; });
    if (!pool.length) pool = hopLe;
    pool.sort(function (a, b) { return ((ganDay[a] || 0) - (ganDay[b] || 0)) || (Math.random() - 0.5); });
    cauId = pool[0];
    loai = "chung_minh";
  }

  var the = dbInsert("on_tap_the", {
    user_id: uid, bai_key: key, cau_id: cauId, loai: loai,
    tang_goi_y: 0, so_lan_sai: 0, nguyen_nhan: "", ket_qua: "", tao_luc: homNay
  }, true);
  var cau = _slTimCau(tai, cauId);
  var muc = Math.min(Math.max(Number(kn.muc || 0), 0), SL_TEN_MUC.length - 1);
  var denHan = Boolean(kn.ngay_on_ke && String(kn.ngay_on_ke) <= homNay);
  return _jsonOut(200, {
    success: true,
    data: {
      the_id: the.id, loai: loai, bai_key: key,
      tinh_tien_do: loai === "chung_minh" && denHan, loi_con_lai: conLai,
      ky_nang: Object.assign(_slTenKyNang(key), { muc: muc, ten_muc: SL_TEN_MUC[muc] }),
      cau: _slCauChoClient(tai.bai, cau), tac_pham: tai.bai.tac_pham || null
    }
  });
}

function _slLayTheDangMo(uid, rawTheId) {
  var tid = _toInt(rawTheId, null);
  if (!tid) return { the: null, err: _err("Không tìm thấy thẻ này!", 404) };
  var the = dbReadTable("on_tap_the").filter(function (r) { return Number(r.id) === tid && Number(r.user_id) === uid; })[0];
  if (!the) return { the: null, err: _err("Không tìm thấy thẻ này!", 404) };
  if (String(the.ket_qua || "") !== "") return { the: null, err: _err("Thẻ này đã kết thúc rồi, hãy mở thẻ mới!", 409) };
  return { the: the, err: null };
}

function _apiSlGoiY(data, token) {
  var uid = _toInt(data.user_id, null);
  if (!uid) return _err("Dữ liệu không hợp lệ!", 400);
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  var res = _slLayTheDangMo(uid, data.the_id);
  if (res.err) return res.err;
  var the = res.the;
  var tang = Number(the.tang_goi_y || 0) + 1;
  if (tang > 3) return _err("Bạn đã mở hết gợi ý rồi!", 409);
  var tai = _slTaiBai(String(the.bai_key));
  var cau = tai ? _slTimCau(tai, the.cau_id) : null;
  var dap = tai && tai.dap_an ? tai.dap_an[String(the.cau_id)] : null;
  if (!cau || !dap) return _err("Không tìm thấy câu hỏi này!", 404);

  var nd = _slNoiDungGoiY(tang, tai, cau, dap, the.id);
  the.tang_goi_y = tang;
  dbMarkDirty("on_tap_the");
  var phanHoi = { success: true, tang: tang, goi_y: nd, da_dong: false };
  if (tang === 3) {
    var kq = the.loai === "sua" ? "da_hieu" : "chua_dat";
    phanHoi.da_dong = true;
    phanHoi.ket_qua = kq;
    phanHoi.tien_do = _slKetThucThe(uid, the, kq);
  }
  return _jsonOut(200, phanHoi);
}

function _apiSlTraLoi(data, token) {
  var uid = _toInt(data.user_id, null);
  var tl = String(data.answer == null ? "" : data.answer).trim();
  if (!uid) return _err("Dữ liệu không hợp lệ!", 400);
  var auth = _authMatch(uid, token);
  if (!auth.ok) return _err(auth.msg, auth.status);
  if (!tl) return _err("Hãy chọn hoặc nhập câu trả lời trước nhé!", 400);

  var res = _slLayTheDangMo(uid, data.the_id);
  if (res.err) return res.err;
  var the = res.the;
  var tai = _slTaiBai(String(the.bai_key));
  var cau = tai ? _slTimCau(tai, the.cau_id) : null;
  var dap = tai && tai.dap_an ? tai.dap_an[String(the.cau_id)] : null;
  if (!cau || !dap) return _err("Không tìm thấy câu hỏi này!", 404);

  if (!_slCham(dap.dap_an_dung, tl)) {
    var soSai = Number(the.so_lan_sai || 0) + 1;
    the.so_lan_sai = soSai;
    dbMarkDirty("on_tap_the");
    if (the.loai === "chung_minh") _slGhiLoi(uid, String(the.bai_key), String(the.cau_id), vnTodayStr(), false);
    return _jsonOut(200, { success: true, dung: false, so_lan_sai: soSai, tang_goi_y: Number(the.tang_goi_y || 0) });
  }
  var kq = the.loai === "sua" ? "da_hieu" : ((Number(the.so_lan_sai || 0) === 0 && Number(the.tang_goi_y || 0) === 0) ? "dat" : "dat_goi_y");
  var tt = _slKetThucThe(uid, the, kq);
  return _jsonOut(200, {
    success: true, dung: true, ket_qua: kq, tien_do: tt,
    loi_giai: dap.loi_giai || "", dap_an_hien: _slDapAnHien(cau, dap)
  });
}

// ==================== KHOA BẢNG ====================
function _kbBangHopLe(b) {
  b = String(b || "khong-chuyen");
  return BANG_XEP_HANG[b] ? b : null;
}

function _apiKbCauHinh() {
  return _jsonOut(200, {
    success: true,
    bang: Object.keys(BANG_XEP_HANG).map(function (k) { return { id: k, ten: BANG_XEP_HANG[k][0], mon: BANG_XEP_HANG[k][1] }; }),
    cap: KB_CAP.map(function (c) { return { id: c, ten: KB_TEN_CAP[c], chu_ky: KB_CHU_KY[c] }; })
  });
}

function _apiKbTongQuan(q) {
  var bang = _kbBangHopLe(q.bang);
  if (!bang) return _err("Nhóm thi không hợp lệ!", 400);
  kbChotLuoi();
  var cacs = KB_CAP.map(function (cap) {
    var ky = kbLayHoacTaoKy(cap, bang);
    var res = kbBangCuaKy(ky, 5);
    return {
      cap: cap, ten: KB_TEN_CAP[cap], chu_ky: KB_CHU_KY[cap], ky: _kbKyInfo(ky),
      top: res.ds, tong: res.tong, tam_tinh: res.tam_tinh, nguoi_giu_ngoi: res.ds[0] || null
    };
  });
  var noiBat = [];
  ["dinh", "hoi", "huong"].forEach(function (cap) {
    var kys = dbReadTable("kb_ky").filter(function (k) {
      return String(k.cap) === cap && String(k.bang) === bang && String(k.trang_thai) === "da_khoa";
    }).sort(function (a, b) { return String(b.bat_dau).localeCompare(String(a.bat_dau)); });
    for (var i = 0; i < kys.length; i++) {
      var dhs = _kbDanhHieuKy(kys[i].id);
      if (dhs.length) {
        noiBat.push({ cap: cap, ten: KB_TEN_CAP[cap], ma_ky: kys[i].ma, ds: dhs.slice(0, 3) });
        break;
      }
    }
  });
  dbFlushDirty();
  return _jsonOut(200, { success: true, cap: cacs, noi_bat: noiBat });
}

function _apiKbKy(cap, q) {
  if (!KB_TEN_CAP[cap]) return _err("Cấp thi không tồn tại!", 404);
  var bang = _kbBangHopLe(q.bang);
  if (!bang) return _err("Nhóm thi không hợp lệ!", 400);
  kbChotLuoi();
  var hienTai = kbLayHoacTaoKy(cap, bang);
  var ma = q.ma ? String(q.ma) : null;
  var ky = hienTai;
  if (ma && ma !== String(hienTai.ma)) {
    ky = dbReadTable("kb_ky").filter(function (k) { return String(k.cap) === cap && String(k.ma) === ma && String(k.bang) === bang; })[0];
    if (!ky) return _err("Không tìm thấy kỳ này!", 404);
  }
  var res = kbBangCuaKy(ky, 50);
  var uMap = {};
  dbReadTable("users").forEach(function (u) { uMap[Number(u.id)] = u.username || ""; });
  var kqAll = dbReadTable("kb_ket_qua");
  var lichSu = dbReadTable("kb_ky").filter(function (k) {
    if (String(k.cap) !== cap || String(k.bang) !== bang || String(k.trang_thai) !== "da_khoa") return false;
    return kqAll.some(function (r) { return Number(r.ky_id) === Number(k.id); });
  }).sort(function (a, b) { return String(b.bat_dau).localeCompare(String(a.bat_dau)); }).slice(0, 12).map(function (r) {
    var kqKy = kqAll.filter(function (x) { return Number(x.ky_id) === Number(r.id); });
    var dau = kqKy.filter(function (x) { return Number(x.hang) === 1; })[0];
    return {
      ma: r.ma, bat_dau: r.bat_dau, ket_thuc: r.ket_thuc, so_nguoi: kqKy.length,
      nguoi_dau: dau ? (uMap[Number(dau.user_id)] || null) : null,
      diem_dau: dau ? Number(dau.diem_tong) : null
    };
  });
  dbFlushDirty();
  return _jsonOut(200, {
    success: true, ky: _kbKyInfo(ky), ma_hien_tai: hienTai.ma, quy_che: kbQuyChe(cap),
    ds: res.ds, tong: res.tong, tam_tinh: res.tam_tinh, lich_su: lichSu
  });
}

function _apiKbVinhDanh(q) {
  var bang = _kbBangHopLe(q.bang);
  if (!bang) return _err("Nhóm thi không hợp lệ!", 400);
  kbChotLuoi();
  var ds = [];
  dbReadTable("kb_ky").filter(function (k) {
    return String(k.cap) === "dinh" && String(k.bang) === bang && String(k.trang_thai) === "da_khoa";
  }).sort(function (a, b) { return String(b.bat_dau).localeCompare(String(a.bat_dau)); }).forEach(function (ky) {
    var dhs = _kbDanhHieuKy(ky.id);
    if (dhs.length && ds.length < 12) {
      ds.push({ id: Number(ky.id), ma: ky.ma, bat_dau: ky.bat_dau, ket_thuc: ky.ket_thuc, danh_hieu: dhs });
    }
  });
  return _jsonOut(200, { success: true, ds: ds });
}

function _apiKbHoSo(uid) {
  var u = findUserRow(uid);
  if (!u) return _err("Không tìm thấy học sinh!", 404);
  var dhMap = {}, kyMap = {};
  dbReadTable("kb_danh_hieu").forEach(function (d) { dhMap[String(d.ma)] = d; });
  dbReadTable("kb_ky").forEach(function (k) { kyMap[Number(k.id)] = k; });
  var uuTien = { dinh: 0, hoi: 1, huong: 2 };
  var rows = dbReadTable("kb_user_danh_hieu").filter(function (t) { return Number(t.user_id) === uid; }).map(function (t) {
    var d = dhMap[String(t.ma_danh_hieu)] || {}, k = kyMap[Number(t.ky_id)] || {};
    return { ma: t.ma_danh_hieu, ten: d.ten || t.ma_danh_hieu, cap: d.cap || "huong", thu_tu: Number(d.thu_tu || 99), ky_ma: k.ma || "" };
  });
  var cao = null;
  rows.forEach(function (r) {
    if (!cao || uuTien[r.cap] < uuTien[cao.cap] || (uuTien[r.cap] === uuTien[cao.cap] && r.thu_tu < cao.thu_tu)) cao = r;
  });
  var dem = {};
  rows.forEach(function (r) {
    if (!dem[r.ma]) dem[r.ma] = { ma: r.ma, ten: r.ten, cap: r.cap, thu_tu: r.thu_tu, so_lan: 0 };
    dem[r.ma].so_lan++;
  });
  var sumByU = {};
  dbReadTable("kb_diem_tich_luy").forEach(function (d) {
    var du = Number(d.user_id);
    sumByU[du] = (sumByU[du] || 0) + Number(d.diem || 0);
  });
  var diem = sumByU[uid] || 0, higher = 0;
  Object.keys(sumByU).forEach(function (k) { if (sumByU[k] > diem) higher++; });

  var udhByKy = {};
  rows.forEach(function (r) { udhByKy[r.ky_ma] = r.ten; });
  var udhMapByKyId = {};
  dbReadTable("kb_user_danh_hieu").filter(function (t) { return Number(t.user_id) === uid; }).forEach(function (t) {
    var d = dhMap[String(t.ma_danh_hieu)];
    udhMapByKyId[Number(t.ky_id)] = d ? d.ten : t.ma_danh_hieu;
  });
  var lichSu = dbReadTable("kb_ket_qua").filter(function (r) { return Number(r.user_id) === uid; }).map(function (r) {
    var k = kyMap[Number(r.ky_id)] || {};
    return {
      ky_id: Number(r.ky_id), cap: k.cap || "", ma: k.ma || "", bang: k.bang || "",
      ket_thuc: k.ket_thuc || "", hang: Number(r.hang), diem: Number(r.diem_tong),
      danh_hieu: udhMapByKyId[Number(r.ky_id)] || null, _bd: k.bat_dau || ""
    };
  }).sort(function (a, b) { return b._bd.localeCompare(a._bd) || a.cap.localeCompare(b.cap); }).slice(0, 60);
  lichSu.forEach(function (x) { delete x._bd; });

  return _jsonOut(200, {
    success: true,
    data: {
      user: { id: Number(u.id), username: u.username, avatar: u.avatar || "", huy_hieu: u.huy_hieu || "", bio: u.bio || "" },
      tong_danh_hieu: rows.length,
      cao_nhat: cao ? { ma: cao.ma, ten: cao.ten, ky_ma: cao.ky_ma } : null,
      dem: Object.keys(dem).map(function (k) { return dem[k]; }).sort(function (a, b) { return (uuTien[a.cap] - uuTien[b.cap]) || (a.thu_tu - b.thu_tu); }),
      diem_tich_luy: diem, hang_tich_luy: diem ? higher + 1 : null, lich_su: lichSu
    }
  });
}

function _apiKbPhucKhao(data, token) {
  var auth = _authMatch(null, token);
  if (!auth.ok) return _err("Hãy đăng xuất rồi đăng nhập lại để gửi phúc khảo.", 401);
  var uid = auth.uid;
  var noiDung = String(data.noi_dung || "").trim();
  if (noiDung.length < 10 || noiDung.length > 500) return _err("Nội dung phúc khảo cần từ 10 đến 500 ký tự!", 400);
  var kyId = _toInt(data.ky_id, null);
  var ky = dbReadTable("kb_ky").filter(function (k) { return Number(k.id) === kyId; })[0];
  if (!ky || String(ky.trang_thai) !== "da_khoa") return _err("Chỉ phúc khảo được kỳ đã có kết quả chính thức!", 409);
  var thamGia = dbReadTable("kb_tham_gia").some(function (r) { return Number(r.ky_id) === kyId && Number(r.user_id) === uid; });
  if (!thamGia) return _err("Bạn không tham gia kỳ này!", 403);
  var han = addDaysYmd(kbHanChot(String(ky.cap), String(ky.ket_thuc)), KB_HAN_PHUC_KHAO_NGAY);
  if (vnTodayStr() > han) return _err("Đã quá hạn phúc khảo (" + KB_HAN_PHUC_KHAO_NGAY + " ngày sau khi kỳ kết thúc)!", 409);
  var daGui = dbReadTable("kb_phuc_khao").some(function (r) { return Number(r.ky_id) === kyId && Number(r.user_id) === uid; });
  if (daGui) return _err("Bạn đã gửi phúc khảo cho kỳ này rồi!", 409);

  dbInsert("kb_phuc_khao", {
    ky_id: kyId, user_id: uid, noi_dung: noiDung, trang_thai: "cho", ghi_chu_admin: "", tao_luc: vnNowStr()
  }, true);
  return _jsonOut(200, { success: true, message: "Đã nhận phúc khảo, ban quản trị sẽ xem xét." });
}
