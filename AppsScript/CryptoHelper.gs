// CryptoHelper.gs - Hash/Verify mật khẩu (tương thích Werkzeug scrypt:32768:8:1 & pbkdf2:sha256) và ký token HMAC

function strToUtf8Bytes(str) {
  var s = String(str == null ? "" : str);
  var raw = Utilities.newBlob(s, "text/plain", "u.txt").getBytes();
  var out = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) out[i] = raw[i] & 0xff;
  return out;
}

function bytesToHex(bytes) {
  var hex = [];
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] & 0xff;
    hex.push((b < 16 ? "0" : "") + b.toString(16));
  }
  return hex.join("");
}

function constantTimeEqual(a, b) {
  a = String(a || "");
  b = String(b || "");
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function randomSalt(len) {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var out = "";
  for (var i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

// ====================== Pure JS SHA-256 & HMAC-SHA256 ======================
var _SHA256_K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);
var _SHA256_W = new Int32Array(64);

function sha256Bytes(msg) {
  var len = msg.length;
  var bitLen = len * 8;
  var padLen = ((len + 8) >> 6) + 1;
  var padded = new Uint8Array(padLen * 64);
  padded.set(msg);
  padded[len] = 0x80;
  var hi = Math.floor(bitLen / 0x100000000);
  var lo = bitLen >>> 0;
  var pEnd = padded.length;
  padded[pEnd - 8] = (hi >>> 24) & 0xff;
  padded[pEnd - 7] = (hi >>> 16) & 0xff;
  padded[pEnd - 6] = (hi >>> 8) & 0xff;
  padded[pEnd - 5] = hi & 0xff;
  padded[pEnd - 4] = (lo >>> 24) & 0xff;
  padded[pEnd - 3] = (lo >>> 16) & 0xff;
  padded[pEnd - 2] = (lo >>> 8) & 0xff;
  padded[pEnd - 1] = lo & 0xff;

  var h0 = 0x6a09e667 | 0, h1 = 0xbb67ae85 | 0, h2 = 0x3c6ef372 | 0, h3 = 0xa54ff53a | 0;
  var h4 = 0x510e527f | 0, h5 = 0x9b05688c | 0, h6 = 0x1f83d9ab | 0, h7 = 0x5be0cd19 | 0;
  var W = _SHA256_W;
  var K = _SHA256_K;

  for (var off = 0; off < padded.length; off += 64) {
    for (var i = 0; i < 16; i++) {
      var j = off + i * 4;
      W[i] = (padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3];
    }
    for (var i2 = 16; i2 < 64; i2++) {
      var w15 = W[i2 - 15], w2 = W[i2 - 2];
      var s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      var s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      W[i2] = (W[i2 - 16] + s0 + W[i2 - 7] + s1) | 0;
    }

    var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (var t = 0; t < 64; t++) {
      var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      var ch = (e & f) ^ ((~e) & g);
      var temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  var hs = [h0, h1, h2, h3, h4, h5, h6, h7];
  var out = new Uint8Array(32);
  for (var k = 0; k < 8; k++) {
    out[k * 4] = (hs[k] >>> 24) & 0xff;
    out[k * 4 + 1] = (hs[k] >>> 16) & 0xff;
    out[k * 4 + 2] = (hs[k] >>> 8) & 0xff;
    out[k * 4 + 3] = hs[k] & 0xff;
  }
  return out;
}

function hmacSha256(keyBytes, msgBytes) {
  var k = keyBytes.length > 64 ? sha256Bytes(keyBytes) : keyBytes;
  var ipad = new Uint8Array(64 + msgBytes.length);
  var opad = new Uint8Array(64 + 32);
  for (var i = 0; i < 64; i++) {
    var kb = i < k.length ? k[i] : 0;
    ipad[i] = kb ^ 0x36;
    opad[i] = kb ^ 0x5c;
  }
  ipad.set(msgBytes, 64);
  opad.set(sha256Bytes(ipad), 64);
  return sha256Bytes(opad);
}

function pbkdf2Sha256(pwBytes, saltBytes, iterations, dkLen) {
  var blocks = Math.ceil(dkLen / 32);
  var out = new Uint8Array(blocks * 32);
  var msg0 = new Uint8Array(saltBytes.length + 4);
  msg0.set(saltBytes);
  for (var b = 1; b <= blocks; b++) {
    msg0[saltBytes.length] = (b >>> 24) & 0xff;
    msg0[saltBytes.length + 1] = (b >>> 16) & 0xff;
    msg0[saltBytes.length + 2] = (b >>> 8) & 0xff;
    msg0[saltBytes.length + 3] = b & 0xff;
    var u = hmacSha256(pwBytes, msg0);
    var t = new Uint8Array(u);
    for (var it = 1; it < iterations; it++) {
      u = hmacSha256(pwBytes, u);
      for (var j = 0; j < 32; j++) t[j] ^= u[j];
    }
    out.set(t, (b - 1) * 32);
  }
  return out.subarray(0, dkLen);
}

// ====================== Pure JS scrypt (RFC 7914) với giảm RAM 4x ======================
function _salsa20_8(B) {
  var x0 = B[0], x1 = B[1], x2 = B[2], x3 = B[3],
      x4 = B[4], x5 = B[5], x6 = B[6], x7 = B[7],
      x8 = B[8], x9 = B[9], x10 = B[10], x11 = B[11],
      x12 = B[12], x13 = B[13], x14 = B[14], x15 = B[15];
  var s;
  for (var i = 0; i < 4; i++) {
    s = (x0 + x12) | 0; x4 ^= (s << 7) | (s >>> 25);
    s = (x4 + x0) | 0; x8 ^= (s << 9) | (s >>> 23);
    s = (x8 + x4) | 0; x12 ^= (s << 13) | (s >>> 19);
    s = (x12 + x8) | 0; x0 ^= (s << 18) | (s >>> 14);
    s = (x5 + x1) | 0; x9 ^= (s << 7) | (s >>> 25);
    s = (x9 + x5) | 0; x13 ^= (s << 9) | (s >>> 23);
    s = (x13 + x9) | 0; x1 ^= (s << 13) | (s >>> 19);
    s = (x1 + x13) | 0; x5 ^= (s << 18) | (s >>> 14);
    s = (x10 + x6) | 0; x14 ^= (s << 7) | (s >>> 25);
    s = (x14 + x10) | 0; x2 ^= (s << 9) | (s >>> 23);
    s = (x2 + x14) | 0; x6 ^= (s << 13) | (s >>> 19);
    s = (x6 + x2) | 0; x10 ^= (s << 18) | (s >>> 14);
    s = (x15 + x11) | 0; x3 ^= (s << 7) | (s >>> 25);
    s = (x3 + x15) | 0; x7 ^= (s << 9) | (s >>> 23);
    s = (x7 + x3) | 0; x11 ^= (s << 13) | (s >>> 19);
    s = (x11 + x7) | 0; x15 ^= (s << 18) | (s >>> 14);

    s = (x0 + x3) | 0; x1 ^= (s << 7) | (s >>> 25);
    s = (x1 + x0) | 0; x2 ^= (s << 9) | (s >>> 23);
    s = (x2 + x1) | 0; x3 ^= (s << 13) | (s >>> 19);
    s = (x3 + x2) | 0; x0 ^= (s << 18) | (s >>> 14);
    s = (x5 + x4) | 0; x6 ^= (s << 7) | (s >>> 25);
    s = (x6 + x5) | 0; x7 ^= (s << 9) | (s >>> 23);
    s = (x7 + x6) | 0; x4 ^= (s << 13) | (s >>> 19);
    s = (x4 + x7) | 0; x5 ^= (s << 18) | (s >>> 14);
    s = (x10 + x9) | 0; x11 ^= (s << 7) | (s >>> 25);
    s = (x11 + x10) | 0; x8 ^= (s << 9) | (s >>> 23);
    s = (x8 + x11) | 0; x9 ^= (s << 13) | (s >>> 19);
    s = (x9 + x8) | 0; x10 ^= (s << 18) | (s >>> 14);
    s = (x15 + x14) | 0; x12 ^= (s << 7) | (s >>> 25);
    s = (x12 + x15) | 0; x13 ^= (s << 9) | (s >>> 23);
    s = (x13 + x12) | 0; x14 ^= (s << 13) | (s >>> 19);
    s = (x14 + x13) | 0; x15 ^= (s << 18) | (s >>> 14);
  }
  B[0] = (B[0] + x0) | 0; B[1] = (B[1] + x1) | 0; B[2] = (B[2] + x2) | 0; B[3] = (B[3] + x3) | 0;
  B[4] = (B[4] + x4) | 0; B[5] = (B[5] + x5) | 0; B[6] = (B[6] + x6) | 0; B[7] = (B[7] + x7) | 0;
  B[8] = (B[8] + x8) | 0; B[9] = (B[9] + x9) | 0; B[10] = (B[10] + x10) | 0; B[11] = (B[11] + x11) | 0;
  B[12] = (B[12] + x12) | 0; B[13] = (B[13] + x13) | 0; B[14] = (B[14] + x14) | 0; B[15] = (B[15] + x15) | 0;
}

function _blockMix(B, out, r, tmp16) {
  var lastOff = (2 * r - 1) * 16;
  for (var k = 0; k < 16; k++) tmp16[k] = B[lastOff + k];
  for (var i = 0; i < 2 * r; i++) {
    var bOff = i * 16;
    for (var k2 = 0; k2 < 16; k2++) tmp16[k2] ^= B[bOff + k2];
    _salsa20_8(tmp16);
    var dstChunk = (i & 1) === 0 ? (i >>> 1) : (r + (i >>> 1));
    var dstOff = dstChunk * 16;
    for (var k3 = 0; k3 < 16; k3++) out[dstOff + k3] = tmp16[k3];
  }
}

function scryptBytes(pwBytes, saltBytes, N, r, p, dkLen) {
  var blockBytes = 128 * r;
  var wordsPerBlock = 32 * r;
  var B = pbkdf2Sha256(pwBytes, saltBytes, 1, p * blockBytes);
  var memStep = N >= 4 && (N % 4) === 0 ? 4 : 1;
  var V = new Int32Array((N / memStep) * wordsPerBlock);
  var X = new Int32Array(wordsPerBlock);
  var Y = new Int32Array(wordsPerBlock);
  var T = new Int32Array(wordsPerBlock);
  var tmp16 = new Int32Array(16);
  var intIdx = (2 * r - 1) * 16;

  for (var b = 0; b < p; b++) {
    var bByteOff = b * blockBytes;
    for (var w = 0; w < wordsPerBlock; w++) {
      var o = bByteOff + w * 4;
      X[w] = (B[o]) | (B[o + 1] << 8) | (B[o + 2] << 16) | (B[o + 3] << 24);
    }

    for (var i = 0; i < N; i++) {
      if ((i % memStep) === 0) {
        V.set(X, (i / memStep) * wordsPerBlock);
      }
      _blockMix(X, Y, r, tmp16);
      var swap1 = X; X = Y; Y = swap1;
    }

    for (var i2 = 0; i2 < N; i2++) {
      var j = (X[intIdx] >>> 0) & (N - 1);
      var rem = j % memStep;
      var vOff = ((j - rem) / memStep) * wordsPerBlock;
      T.set(V.subarray(vOff, vOff + wordsPerBlock));
      for (var s = 0; s < rem; s++) {
        _blockMix(T, Y, r, tmp16);
        var swapT = T; T = Y; Y = swapT;
      }
      for (var k = 0; k < wordsPerBlock; k++) X[k] ^= T[k];
      _blockMix(X, Y, r, tmp16);
      var swap2 = X; X = Y; Y = swap2;
    }

    for (var w2 = 0; w2 < wordsPerBlock; w2++) {
      var val = X[w2];
      var o2 = bByteOff + w2 * 4;
      B[o2] = val & 0xff;
      B[o2 + 1] = (val >>> 8) & 0xff;
      B[o2 + 2] = (val >>> 16) & 0xff;
      B[o2 + 3] = (val >>> 24) & 0xff;
    }
  }
  return pbkdf2Sha256(pwBytes, B, 1, dkLen);
}

// ====================== Password Hash & Verify ======================
function hashPassword(password) {
  var salt = randomSalt(16);
  var iters = 10000;
  var dk = pbkdf2Sha256(strToUtf8Bytes(password), strToUtf8Bytes(salt), iters, 32);
  return "pbkdf2:sha256:" + iters + "$" + salt + "$" + bytesToHex(dk);
}

function verifyPassword(storedHash, password) {
  var s = String(storedHash || "");
  var parts = s.split("$");
  if (parts.length !== 3) return false;
  var method = parts[0];
  var salt = parts[1];
  var expectedHex = parts[2].toLowerCase();
  var pwBytes = strToUtf8Bytes(password);
  var saltBytes = strToUtf8Bytes(salt);

  if (method.indexOf("pbkdf2:sha256") === 0) {
    var mParts = method.split(":");
    var iters = mParts.length >= 3 ? parseInt(mParts[2], 10) : 260000;
    if (!iters || iters < 1) return false;
    var dkLen = expectedHex.length / 2;
    var actual = bytesToHex(pbkdf2Sha256(pwBytes, saltBytes, iters, dkLen));
    return constantTimeEqual(actual, expectedHex);
  }

  if (method.indexOf("scrypt:") === 0) {
    var sParts = method.split(":");
    if (sParts.length !== 4) return false;
    var N = parseInt(sParts[1], 10);
    var r = parseInt(sParts[2], 10);
    var p = parseInt(sParts[3], 10);
    var dkLen2 = expectedHex.length / 2;
    if (!N || !r || !p || dkLen2 <= 0) return false;
    var actual2 = bytesToHex(scryptBytes(pwBytes, saltBytes, N, r, p, dkLen2));
    return constantTimeEqual(actual2, expectedHex);
  }

  return false;
}

function needsPasswordUpgrade(storedHash) {
  return String(storedHash || "").indexOf("scrypt:") === 0;
}

// ====================== Token HMAC (kbToken) ======================
function _getSecretKey() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty("KB_SECRET_KEY");
  if (!key) {
    key = Utilities.getUuid() + "-" + Utilities.getUuid();
    props.setProperty("KB_SECRET_KEY", key);
  }
  return key;
}

function taoToken(userId) {
  var payload = { uid: Number(userId), exp: Math.floor(Date.now() / 1000) + KB_HAN_TOKEN_SEC };
  var payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload)).replace(/=+$/, "");
  var sigBytes = Utilities.computeHmacSha256Signature(payloadB64, _getSecretKey());
  var sigB64 = Utilities.base64EncodeWebSafe(sigBytes).replace(/=+$/, "");
  return payloadB64 + "." + sigB64;
}

function uidTuToken(tokenStr) {
  if (!tokenStr || typeof tokenStr !== "string") return null;
  var dot = tokenStr.indexOf(".");
  if (dot <= 0) return null;
  var payloadB64 = tokenStr.slice(0, dot);
  var sigB64 = tokenStr.slice(dot + 1);
  var expectedSig = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payloadB64, _getSecretKey())
  ).replace(/=+$/, "");
  if (!constantTimeEqual(sigB64, expectedSig)) return null;
  try {
    var pad = payloadB64.length % 4 === 0 ? "" : "====".slice(payloadB64.length % 4);
    var jsonStr = Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64 + pad)).getDataAsString("UTF-8");
    var obj = JSON.parse(jsonStr);
    if (!obj || !obj.uid || !obj.exp) return null;
    if (Math.floor(Date.now() / 1000) > Number(obj.exp)) return null;
    return Number(obj.uid);
  } catch (e) {
    return null;
  }
}

function testCryptoSelfCheck() {
  var v1 = bytesToHex(scryptBytes(strToUtf8Bytes(""), strToUtf8Bytes(""), 16, 1, 1, 64));
  var ok1 = v1.indexOf("77d6576238657b203b19ca42c18a9397") === 0;
  var h = hashPassword("test123456");
  var ok2 = verifyPassword(h, "test123456") && !verifyPassword(h, "wrong");
  Logger.log("scrypt RFC7914 vec1 ok=" + ok1 + ", pbkdf2 ok=" + ok2);
  return ok1 && ok2;
}
