/* =====================================================================
   📱 노벨 공방 APK 만들기
   앱 틀(template.apk, android/build_template.py 로 만든 것)에
     - 게임 파일(assets/game.html)과 아이콘(res/icon.png)을 넣고
     - 앱 이름 · 패키지 이름을 바꾸고
     - APK 서명 v2 로 서명해서 설치할 수 있는 .apk 를 만들어요.
   브라우저(WebCrypto)만으로 돌아가고, 서버로 아무것도 보내지 않아요.
   사용: await NovelApk.build({ template, html, label, icon, pkgSuffix, key })
   ===================================================================== */
(function (root) {
  "use strict";
  const PKG_PH = "com.novelworkshop.gxxxxxxxxxxxx"; // 31자 — 끝 12자를 작품마다 바꿔요
  const LABEL_PH = "NOVEL_APP_NAME_" + "_".repeat(33); // 48자
  const MAX_LABEL = 48;
  const te = new TextEncoder();
  const subtle = (root.crypto || globalThis.crypto).subtle;

  // ---------- 바이트 도우미 ----------
  function concat(parts) {
    let n = 0;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  const u16 = (n) => new Uint8Array([n & 255, (n >>> 8) & 255]);
  const u32 = (n) => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
  const u64 = (n) => concat([u32(n % 4294967296), u32(Math.floor(n / 4294967296))]);
  const lp = (b) => concat([u32(b.length), b]); // 길이를 앞에 붙인 바이트
  const b64 = {
    enc(u8) { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); },
    dec(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; },
  };

  // ---------- ZIP ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

  function readZip(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let e = u8.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error("앱 틀 파일이 망가졌어요 (ZIP 끝을 찾을 수 없음)");
    const count = dv.getUint16(e + 10, true), cdOff = dv.getUint32(e + 16, true);
    const out = [];
    let p = cdOff;
    for (let i = 0; i < count; i++) {
      const method = dv.getUint16(p + 10, true), crc = dv.getUint32(p + 16, true);
      const csize = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const lo = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
      const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
      out.push({ name, method, crc, size, data: u8.subarray(start, start + csize) });
      p += 46 + nl + el + cl;
    }
    return out;
  }
  async function pipe(data, stream) {
    return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(stream)).arrayBuffer());
  }
  const inflate = (d) => pipe(d, new DecompressionStream("deflate-raw"));
  async function entry(name, raw, compress) {
    const crc = crc32(raw);
    if (compress && typeof CompressionStream !== "undefined") {
      const c = await pipe(raw, new CompressionStream("deflate-raw"));
      if (c.length < raw.length) return { name, method: 8, crc, size: raw.length, data: c };
    }
    return { name, method: 0, crc, size: raw.length, data: raw };
  }
  // 압축 안 한 파일은 4바이트 경계에 맞춰요 (zipalign 과 같은 효과 — 안드로이드 11+ 에서 필요)
  function writeZip(entries) {
    const parts = [], central = [];
    let off = 0;
    for (const e of entries) {
      const nb = te.encode(e.name);
      let pad = 0;
      if (e.method === 0) pad = (4 - ((off + 30 + nb.length) % 4)) % 4;
      const local = concat([u32(0x04034b50), u16(20), u16(0x0800), u16(e.method), u16(0), u16(0x21), u32(e.crc), u32(e.data.length), u32(e.size),
        u16(nb.length), u16(pad), nb, new Uint8Array(pad)]);
      central.push(concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(e.method), u16(0), u16(0x21), u32(e.crc), u32(e.data.length), u32(e.size),
        u16(nb.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), nb]));
      parts.push(local, e.data);
      off += local.length + e.data.length;
    }
    const cd = concat(central);
    const eocd = concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cd.length), u32(off), u16(0)]);
    return { body: concat(parts), cd, eocd };
  }

  // ---------- 매니페스트 글자 바꾸기 (같은 칸 안에서) ----------
  function findUtf16(u8, s) {
    const pat = te.encode(s).reduce((a, c) => (a.push(c, 0), a), []);
    outer: for (let i = 0; i + pat.length <= u8.length; i++) {
      for (let j = 0; j < pat.length; j++) if (u8[i + j] !== pat[j]) continue outer;
      return i;
    }
    return -1;
  }
  function patchString(u8, placeholder, value) {
    const at = findUtf16(u8, placeholder);
    if (at < 2) throw new Error("앱 틀에서 자리표시자를 찾을 수 없어요: " + placeholder);
    const units = [];
    for (let i = 0; i < value.length; i++) units.push(value.charCodeAt(i));
    if (units.length > placeholder.length) throw new Error("이름이 너무 길어요");
    u8.set(u16(units.length), at - 2);
    for (let i = 0; i < placeholder.length + 1; i++) u8.set(u16(i < units.length ? units[i] : 0), at + i * 2);
  }

  // ---------- 서명 키 + 인증서 (DER) ----------
  function derLen(n) {
    if (n < 128) return new Uint8Array([n]);
    const b = []; while (n > 0) { b.unshift(n & 255); n = Math.floor(n / 256); }
    return new Uint8Array([0x80 | b.length, ...b]);
  }
  const der = (tag, body) => concat([new Uint8Array([tag]), derLen(body.length), body]);
  const seq = (...xs) => der(0x30, concat(xs));
  const set = (...xs) => der(0x31, concat(xs));
  function derInt(bytes) { if (bytes[0] & 0x80) bytes = concat([new Uint8Array([0]), bytes]); return der(0x02, bytes); }
  function oid(s) {
    const a = s.split(".").map(Number), out = [a[0] * 40 + a[1]];
    for (const v of a.slice(2)) { const b = [v & 127]; let x = Math.floor(v / 128); while (x > 0) { b.unshift((x & 127) | 128); x = Math.floor(x / 128); } out.push(...b); }
    return der(0x06, new Uint8Array(out));
  }
  const NULL = new Uint8Array([5, 0]);
  const pad2 = (n) => String(n).padStart(2, "0");
  const genTime = (d) => der(0x18, te.encode(`${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`));
  const utcTime = (d) => der(0x17, te.encode(`${pad2(d.getUTCFullYear() % 100)}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`));
  const RSA = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };

  // 작품마다 한 번 만들어 두는 서명 키 (같은 키로 서명해야 앱을 업데이트할 수 있어요)
  async function makeKey(commonName) {
    const kp = await subtle.generateKey(Object.assign({ modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, RSA), true, ["sign", "verify"]);
    const spki = new Uint8Array(await subtle.exportKey("spki", kp.publicKey));
    const pkcs8 = new Uint8Array(await subtle.exportKey("pkcs8", kp.privateKey));
    const alg = seq(oid("1.2.840.113549.1.1.11"), NULL); // sha256WithRSAEncryption
    const name = seq(set(seq(oid("2.5.4.3"), der(0x0c, te.encode(commonName || "Novel Workshop")))));
    const now = new Date(), later = new Date(now.getTime() + 30 * 365 * 864e5);
    const serial = (root.crypto || globalThis.crypto).getRandomValues(new Uint8Array(16)); serial[0] &= 0x7f;
    const tbs = seq(der(0xa0, derInt(new Uint8Array([2]))), derInt(serial), alg, name, seq(utcTime(now), genTime(later)), name, spki);
    const sig = new Uint8Array(await subtle.sign(RSA, kp.privateKey, tbs));
    const cert = seq(tbs, alg, der(0x03, concat([new Uint8Array([0]), sig])));
    return { pkcs8: b64.enc(pkcs8), cert: b64.enc(cert), spki: b64.enc(spki) };
  }

  // ---------- APK 서명 v2 ----------
  const sha256 = async (b) => new Uint8Array(await subtle.digest("SHA-256", b));
  async function contentDigest(sections) {
    const chunks = [];
    for (const s of sections) {
      for (let o = 0; o < s.length; o += 1048576) {
        const c = s.subarray(o, Math.min(o + 1048576, s.length));
        chunks.push(await sha256(concat([new Uint8Array([0xa5]), u32(c.length), c])));
      }
    }
    return sha256(concat([new Uint8Array([0x5a]), u32(chunks.length), ...chunks]));
  }
  async function signV2(zip, key) {
    const { body, cd, eocd } = zip;
    const ALG = 0x0103; // RSASSA-PKCS1-v1_5 + SHA2-256
    const digest = await contentDigest([body, cd, eocd]);
    const cert = b64.dec(key.cert), spki = b64.dec(key.spki);
    const signedData = concat([lp(lp(concat([u32(ALG), lp(digest)]))), lp(lp(cert)), u32(0)]);
    const priv = await subtle.importKey("pkcs8", b64.dec(key.pkcs8), RSA, false, ["sign"]);
    const sig = new Uint8Array(await subtle.sign(RSA, priv, signedData));
    const signer = concat([lp(signedData), lp(lp(concat([u32(ALG), lp(sig)]))), lp(spki)]);
    const value = lp(lp(signer));
    const pair = concat([u64(4 + value.length), u32(0x7109871a), value]);
    const size = pair.length + 8 + 16;
    const block = concat([u64(size), pair, u64(size), te.encode("APK Sig Block 42")]);
    const newEocd = eocd.slice();
    newEocd.set(u32(body.length + block.length), 16); // 중앙 디렉터리 위치가 서명 블록만큼 뒤로 밀려요
    return concat([body, block, cd, newEocd]);
  }

  // ---------- 전체 ----------
  async function build(opt) {
    const tpl = typeof opt.template === "string" ? b64.dec(opt.template) : opt.template;
    const label = String(opt.label || "Novel").trim().slice(0, MAX_LABEL) || "Novel";
    const suffix = String(opt.pkgSuffix || "").toLowerCase().replace(/[^a-z0-9]/g, "").padEnd(12, "0").slice(0, 12);
    const files = readZip(tpl);
    const out = [];
    for (const f of files) {
      if (f.name === "AndroidManifest.xml") {
        const xml = f.method === 8 ? await inflate(f.data) : f.data.slice();
        patchString(xml, LABEL_PH, label);
        patchString(xml, PKG_PH, PKG_PH.slice(0, PKG_PH.length - 12) + suffix);
        out.push(await entry(f.name, xml, true));
      } else if (f.name === "assets/game.html") {
        out.push(await entry(f.name, typeof opt.html === "string" ? te.encode(opt.html) : opt.html, true));
      } else if (f.name === "res/icon.png" && opt.icon) {
        out.push(await entry(f.name, opt.icon, false));
      } else out.push(f);
    }
    return signV2(writeZip(out), opt.key);
  }

  root.NovelApk = { build, makeKey, MAX_LABEL, b64 };
})(typeof window !== "undefined" ? window : globalThis);
