// api-config.js - Cấu hình kết nối Google Apps Script khi chạy trên Netlify
// BƯỚC CUỐI KHI DEPLOY: Dán URL Web App (dạng https://script.google.com/macros/s/.../exec)
// vào biến VNSTARL_APPS_SCRIPT_URL bên dưới.
(function (global) {
  "use strict";

  // DÁN LINK APPS SCRIPT WEB APP CỦA BẠN VÀO ĐÂY:
  global.VNSTARL_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxcYnRhDVnY2OjPCGFsOxPMwqEc3EHrr_L3OFd06oW7YdzBBj7cA2vCR7CCGURJp3U8Zg/exec";

  var LOCAL_PREFIXES = ["http://127.0.0.1:5000", "http://localhost:5000"];
  var isLocalHost =
    location.hostname === "127.0.0.1" ||
    location.hostname === "localhost" ||
    location.protocol === "file:";

  if (isLocalHost) {
    try {
      var qLocal = new URLSearchParams(location.search).get("local");
      if (qLocal === "1") localStorage.setItem("vnstarl_use_local", "1");
      else if (qLocal === "0") localStorage.setItem("vnstarl_use_local", "0");
    } catch (e) {}
  }

  function preferLocalBackend() {
    if (!isLocalHost) return false;
    try {
      return localStorage.getItem("vnstarl_use_local") !== "0";
    } catch (e) {
      return true;
    }
  }

  function getAppsScriptUrl() {
    return String(global.VNSTARL_APPS_SCRIPT_URL || "").trim();
  }

  function matchLocalApi(rawUrl) {
    var s = String(rawUrl || "");
    for (var i = 0; i < LOCAL_PREFIXES.length; i++) {
      if (s.indexOf(LOCAL_PREFIXES[i] + "/api/") === 0) {
        return s.slice(LOCAL_PREFIXES[i].length);
      }
    }
    if (s.indexOf("/api/") === 0) return s;
    return null;
  }

  function readToken(headers) {
    if (headers) {
      var auth = "";
      if (typeof headers.get === "function") {
        auth = headers.get("Authorization") || headers.get("authorization") || "";
      } else {
        auth = headers.Authorization || headers.authorization || "";
      }
      if (auth.indexOf("Bearer ") === 0) return auth.slice(7).trim();
    }
    try {
      return localStorage.getItem("kbToken") || "";
    } catch (e) {
      return "";
    }
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error("Không đọc được file ảnh.")); };
      reader.readAsDataURL(blob);
    });
  }

  async function extractBodyObj(body) {
    if (!body) return {};
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      var obj = {};
      var file = body.get("file");
      if (file) {
        obj.file_base64 = await blobToDataUrl(file);
        obj.file_name = file.name || "avatar.webp";
      }
      body.forEach(function (val, key) {
        if (key !== "file") obj[key] = val;
      });
      return obj;
    }
    if (typeof body === "string") {
      try {
        var parsed = JSON.parse(body);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  var origFetch = global.fetch.bind(global);

  global.fetch = async function (input, init) {
    var rawUrl = typeof input === "string" ? input : (input && input.url) || "";
    var apiRel = matchLocalApi(rawUrl);
    if (!apiRel) {
      return origFetch(input, init);
    }

    var gsUrl = getAppsScriptUrl();
    if (preferLocalBackend()) {
      try {
        return await origFetch(input, init);
      } catch (localErr) {
        if (!gsUrl) throw localErr;
      }
    }
    if (!gsUrl) {
      if (isLocalHost) {
        return origFetch(input, init);
      }
      throw new Error("Chưa cấu hình VNSTARL_APPS_SCRIPT_URL trong Frontend/api-config.js!");
    }

    var opts = init || {};
    var method = String(opts.method || (input && input.method) || "GET").toUpperCase();
    var token = readToken(opts.headers);
    var parsedUrl = new URL(apiRel, "https://vnstarl.local");
    var pathOnly = parsedUrl.pathname;
    var queryStr = parsedUrl.search ? parsedUrl.search.slice(1) : "";

    var res;
    if (method === "GET") {
      var sep = gsUrl.indexOf("?") === -1 ? "?" : "&";
      var target = gsUrl + sep + "path=" + encodeURIComponent(pathOnly);
      if (queryStr) target += "&" + queryStr;
      if (token) target += "&_token=" + encodeURIComponent(token);
      res = await origFetch(target, {
        method: "GET",
        signal: opts.signal,
        credentials: "omit"
      });
    } else {
      var bodyObj = await extractBodyObj(opts.body);
      var payload = Object.assign({}, bodyObj, {
        _path: pathOnly,
        _method: method,
        _token: token
      });
      // Dùng text/plain để tránh trình duyệt gửi preflight OPTIONS (Apps Script không hỗ trợ OPTIONS)
      res = await origFetch(gsUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: opts.signal,
        credentials: "omit"
      });
    }

    var text = await res.text();
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return new Response(text, {
        status: res.ok ? 500 : res.status,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    var status = data && typeof data._httpStatus === "number" ? data._httpStatus : res.status;
    if (
      isLocalHost &&
      status === 404 &&
      data &&
      typeof data.message === "string" &&
      data.message.indexOf("Không tìm thấy endpoint:") === 0
    ) {
      try {
        var localRes = await origFetch(input, init);
        if (localRes && localRes.status !== 404) {
          return localRes;
        }
      } catch (e2) {
        /* Backend Python local chưa chạy -> trả lại lỗi Apps Script bên dưới */
      }
    }
    if (data && typeof data === "object" && "_httpStatus" in data) {
      delete data._httpStatus;
    }
    return new Response(JSON.stringify(data), {
      status: status,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  };
})(window);
