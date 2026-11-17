/* =====================================================================
   ✏️ 노벨 공방 — 비주얼 노벨 창작기
   만든 내용은 PROJECT 객체 하나로 저장돼요 (story.js 와 같은 형식).
   ===================================================================== */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);

  // ---------- 작은 DOM 도우미 ----------
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "value") e.value = v;
      else if (k === "checked") e.checked = !!v;
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) e.append(k instanceof Node ? k : String(k));
    return e;
  }
  const put = (parent, ...kids) => parent.append(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  let toastT;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2000);
  }

  // ---------- 저장소 (IndexedDB, 안 되면 메모리) ----------
  const Store = (() => {
    let dbp = null, mem = new Map(), ok = true;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise((res, rej) => {
        try {
          const r = indexedDB.open("novel-workshop", 1);
          r.onupgradeneeded = () => r.result.createObjectStore("projects", { keyPath: "id" });
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
          r.onblocked = () => rej(new Error("blocked"));
          setTimeout(() => rej(new Error("timeout")), 3000); // 응답이 없는 환경 대비
        } catch (e) { rej(e); }
      }).catch(() => { ok = false; return null; });
      return dbp;
    }
    async function tx(mode, fn) {
      const db = await open();
      if (!db) return fn(null);
      return new Promise((res, rej) => {
        const t = db.transaction("projects", mode);
        const r = fn(t.objectStore("projects"));
        t.oncomplete = () => res(r && r.result);
        t.onerror = () => rej(t.error);
      });
    }
    return {
      get ok() { return ok; },
      async all() { const r = await tx("readonly", (s) => s ? s.getAll() : null); return r || [...mem.values()]; },
      async put(rec) { if (!(await open())) { mem.set(rec.id, rec); return; } await tx("readwrite", (s) => s.put(rec)); },
      async del(id) { if (!(await open())) { mem.delete(id); return; } await tx("readwrite", (s) => s.delete(id)); },
    };
  })();
  const pref = {
    get(k, d) { try { const v = localStorage.getItem("nw_" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("nw_" + k, JSON.stringify(v)); } catch (e) {} },
  };

  // ---------- 상태 ----------
  let proj = null;      // 지금 만드는 PROJECT
  let projId = null;
  let projects = [];    // [{id, name, updated}]
  let tab = "story";
  let scene = null;     // 지금 보는 장면
  let codeDirty = false;

  function blankProject() {
    return {
      title: "새 비주얼 노벨", subtitle: "", titleBg: "", start: "시작",
      vars: {}, backgrounds: {}, cgs: {}, items: {}, characters: {}, nameColors: { 나: "#ffd27a" },
      story: { 시작: ["여기에 첫 문장을 써 보세요.", { end: "THE END" }] },
      memories: [], gallery: true,
      images: {},
    };
  }
  function sampleProject() {
    const p = clone(typeof PROJECT !== "undefined" ? PROJECT : blankProject());
    p.images = p.images || {};
    return p;
  }
  function normalize(p) {
    const b = blankProject();
    for (const k of Object.keys(b)) if (p[k] == null) p[k] = k === "story" ? { 시작: [] } : clone(b[k]);
    if (!Array.isArray(p.memories)) p.memories = [];
    if (!p.story[p.start]) p.start = Object.keys(p.story)[0] || "시작";
    if (!p.story[p.start]) p.story[p.start] = [];
    return p;
  }

  let saveT;
  function changed(opts) {
    codeDirty = false;
    $("#proj-name").textContent = proj.title || "제목 없음";
    setSave("저장 중…");
    clearTimeout(saveT);
    saveT = setTimeout(persist, 400);
    if (!opts || opts.render !== false) render();
  }
  async function persist() {
    try {
      gcImages();
      await Store.put({ id: projId, name: proj.title, updated: Date.now(), data: proj });
      const m = projects.find((x) => x.id === projId);
      if (m) { m.name = proj.title; m.updated = Date.now(); }
      setSave(Store.ok ? "저장됨" : "임시 저장 (창 닫으면 사라짐)", !Store.ok);
    } catch (e) {
      console.error(e);
      setSave("저장 실패 — 백업 파일로 내보내 주세요", true);
    }
  }
  function setSave(t, bad) { const s = $("#save-state"); s.textContent = t; s.classList.toggle("bad", !!bad); }

  // 쓰이지 않는 그림 정리
  function gcImages() {
    const used = new Set();
    const mark = (ref) => { if (typeof ref === "string" && ref.startsWith("img:")) used.add(ref.slice(4)); };
    Object.values(proj.backgrounds).forEach(mark);
    Object.values(proj.cgs).forEach(mark);
    Object.values(proj.items).forEach(mark);
    Object.values(proj.characters).forEach((c) => Object.values(c.faces || {}).forEach(mark));
    for (const id of Object.keys(proj.images)) if (!used.has(id)) delete proj.images[id];
  }

  const imgSrc = (ref) => (!ref ? "" : ref.startsWith("img:") ? proj.images[ref.slice(4)] || "" : ref);

  // ---------- 블록 종류 ----------
  const KINDS = {
    say:    { label: "대사",        desc: "캐릭터가 말해요" },
    narr:   { label: "나레이션",    desc: "이름 없는 설명 글" },
    bg:     { label: "배경",        desc: "배경 그림을 바꿔요" },
    cg:     { label: "이벤트 그림", desc: "그림을 화면 가득 보여줘요" },
    varimg: { label: "변수 그림",   desc: "변수에 따라 다른 그림" },
    show:   { label: "캐릭터 등장", desc: "등장 / 표정 / 위치" },
    hide:   { label: "캐릭터 퇴장", desc: "화면에서 사라져요" },
    choice: { label: "선택지",      desc: "플레이어가 골라요" },
    set:    { label: "변수 바꾸기", desc: "호감도 +1 같은 것" },
    if:     { label: "조건 분기",   desc: "변수에 따라 이동" },
    goto:   { label: "장면 이동",   desc: "다른 장면으로" },
    fx:     { label: "효과",        desc: "흔들기 · 번쩍 · 암전" },
    particles: { label: "입자 효과", desc: "벚꽃·비·안개·연기·물방울·불티 등 16가지" },
    tint:   { label: "화면 색감",   desc: "회상·흑백·밤·노을·꿈" },
    wait:   { label: "잠깐 멈춤",   desc: "몇 초 쉬어요" },
    minigame: { label: "미니게임",  desc: "그림 속 오브젝트를 골라 변수 바꾸기" },
    end:    { label: "엔딩",        desc: "게임을 끝내요" },
  };
  const SAY_RE = VN.SAY_RE;
  const FX = { shake: "화면 흔들기", "flash:white": "하얗게 번쩍", "flash:#ff4d6d": "빨갛게 번쩍", "fade:black": "검은 화면 전환", "fade:white": "하얀 화면 전환" };
  const POS = { left: "왼쪽", center: "가운데", right: "오른쪽" };

  function kindOf(b) {
    if (typeof b === "string") return SAY_RE.test(b) ? "say" : "narr";
    if (!b || typeof b !== "object") return "raw";
    if (isGroup(b)) return "group";
    if (b.minigame) return b.minigame === "pick" ? "minigame" : "raw"; // 예전 미니게임은 코드 블록으로 보여줘요
    if (b.particles !== undefined) return "particles";
    if (b.tint !== undefined) return "tint";
    if (b.varImage !== undefined) return "varimg";
    if (b.choice) return "choice";
    if (b.say !== undefined) return "say";
    if (b.text !== undefined) return "narr";
    if (b.if) return "if";
    if (b.end !== undefined) return "end";
    if (b.cg !== undefined) return "cg";
    if (b.bg) return "bg";
    if (b.show) return "show";
    if (b.hide) return "hide";
    if (b.set) return "set";
    if (b.goto) return "goto";
    if (b.wait) return "wait";
    if (b.shake || b.flash || b.fade) return "fx";
    return "raw";
  }

  function parseSetEntry(set) {
    const [k, v] = Object.entries(set || {})[0] || ["", 1];
    if (typeof v === "number") return { var: k, op: v < 0 ? "-" : "+", val: String(Math.abs(v)) };
    if (typeof v === "string" && v[0] === "=") return { var: k, op: "=", val: v.slice(1) };
    return { var: k, op: "=", val: String(v) };
  }
  function buildSet(f) {
    if (!f.var) return null;
    const n = Number(f.val);
    if (f.op === "+") return { [f.var]: isNaN(n) ? 1 : n };
    if (f.op === "-") return { [f.var]: isNaN(n) ? -1 : -n };
    return { [f.var]: "=" + f.val };
  }

  function parseCond(expr) {
    const m = String(expr || "").match(/^\s*(\S+)\s*(>=|<=|==|!=|>|<)\s*(.+?)\s*$/);
    return m ? { var: m[1], op: m[2], val: m[3] } : { var: String(expr || "").trim(), op: "==", val: "true" };
  }
  // 미니게임(그림 속 오브젝트 고르기) 편집용
  const LOOKS = { marker: "✦ 반짝이는 표시", item: "🖼 오브젝트 그림", hidden: "👻 숨김 (투명 · 찾아야 해요)" };
  const newObj = (i, x, y) => ({ name: `오브젝트 ${i}`, x, y, size: 12, look: "marker", item: "", text: "", say: "", var: "", op: "+", val: "1", goto: "", once: true });
  const artRef = (name) => proj.cgs[name] || proj.backgrounds[name] || proj.items[name] || "";
  function imageChoices(target) {
    if (target === "bg") return Object.fromEntries(Object.keys(proj.backgrounds).map((n) => [n, n]));
    if (target === "cg") return Object.assign({ "": "숨기기" }, Object.fromEntries(Object.keys(proj.cgs).map((n) => [n, n])));
    const c = proj.characters[target];
    return c ? Object.fromEntries(Object.keys(c.faces || {}).map((n) => [n, n])) : {};
  }
  const targetName = (t) => (t === "bg" ? "배경" : t === "cg" ? "이벤트 그림" : `${charName(t)} 표정`);

  const PSHAPE = {
    petal: "🌸 벚꽃잎", leaf: "🍂 낙엽", snow: "❄ 눈", rain: "🌧 비", storm: "⛈ 폭우 + 번개", drip: "💧 물방울 떨어지기",
    fog: "🌫 안개", steam: "♨ 수증기", smoke: "💨 진한 연기", ember: "🔥 불티 (불꽃 가루)",
    sparkle: "✨ 반짝이", firefly: "🟡 반딧불", dot: "● 빛 알갱이", bubble: "🫧 거품 · 비눗방울", heart: "💗 하트", confetti: "🎉 꽃가루 (축하)",
  };
  const PCOLOR = { petal: "#ffb7c5", snow: "#ffffff", sparkle: "#fff3a8", heart: "#ff6b8b", rain: "#a8c8ff", dot: "#8fd3ff", steam: "#ffffff",
    drip: "#9fd4ff", smoke: "#3c3c44", fog: "#dfe6ee", storm: "#b8c8e8", ember: "#ff8a3d", leaf: "#d9822b", firefly: "#d8ff7a", bubble: "#bfefff", confetti: "#ff5d8f" };
  const MULTI = { leaf: true, confetti: true }; // 기본 색이면 여러 색이 섞여요
  const PTIP = {
    drip: "'한 지점에서 퍼져 나오기'로 고르면 그 지점(천장, 수도꼭지)에서 물이 똑똑 떨어지고 바닥에서 튀어요.",
    storm: "화면 전체로 쓰면 가끔 번개가 번쩍여요. [화면 색감] '밤'과 같이 쓰면 잘 어울려요.",
    fog: "화면 전체로 쓰면 안개가 천천히 옆으로 흘러가요. 진하게 하려면 양을 '많이'로.",
    smoke: "검은 연기예요. 색을 밝게 바꾸면 흰 연기·먼지 구름이 돼요. '펑! 터지기'는 폭발 연기.",
    ember: "모닥불이나 불난 장면에 좋아요. 아래쪽 지점에서 '퍼져 나오기'로 써 보세요.",
    firefly: "밤 장면에서 [화면 색감] '밤'과 같이 쓰면 예뻐요.",
    confetti: "'펑! 터지기'로 쓰면 폭죽처럼 위로 터졌다가 떨어져요.",
    steam: "찻잔이나 목욕탕 장면에서 컵 위 · 화면 아래쪽에 두세요.",
  };
  const PMODE = { fall: "화면 전체에 흩날리기 (계속)", spread: "한 지점에서 퍼져 나오기 (계속)", burst: "한 지점에서 펑! 터지기 (한 번)" };
  const TINTS = { "": "원래대로", sepia: "회상 (세피아)", gray: "흑백", night: "밤", sunset: "노을", dream: "꿈 (뿌옇게)" };

  function toForm(b) {
    const k = kindOf(b);
    switch (k) {
      case "say": {
        if (typeof b === "string") { const m = b.match(SAY_RE); return { name: m[1].trim(), text: m[2], face: "" }; }
        return { name: b.say, text: b.text || "", face: b.face || "" };
      }
      case "narr": return { text: typeof b === "string" ? b : b.text };
      case "bg": return { bg: b.bg };
      case "cg": return { cg: b.cg || "", fit: b.fit || "contain" };
      case "show": return { id: b.show, face: b.face || "", pos: b.pos || "center" };
      case "hide": return { id: b.hide };
      case "set": return parseSetEntry(b.set);
      case "if": {
        const m = String(b.if).match(/^\s*(\S+)\s*(>=|<=|==|!=|>|<)\s*(.+?)\s*$/) || [, b.if, "==", "true"];
        return { var: m[1], op: m[2], val: m[3], goto: b.goto || "", else: b.else || "" };
      }
      case "goto": return { goto: b.goto };
      case "wait": return { sec: (b.wait || 1000) / 1000 };
      case "fx": return { fx: b.shake ? "shake" : b.flash ? "flash:" + b.flash : "fade:" + b.fade };
      case "end": return { name: b.end };
      case "particles": return b.particles === "off" ? { shape: "off", mode: "fall", color: PCOLOR.petal, x: 50, y: 40, amount: 2 }
        : { shape: b.particles, mode: b.mode || "fall", color: (b.color || PCOLOR[b.particles] || "#ffffff").toLowerCase(), x: b.x == null ? 50 : b.x, y: b.y == null ? 40 : b.y, amount: b.amount || 2 };
      case "tint": return { tint: b.tint || "" };
      case "varimg": return {
        target: b.varImage, fit: b.fit || "contain",
        cases: (b.cases || []).map((x) => Object.assign(parseCond(x.if), { image: x.image == null ? "" : x.image })),
        else: b.else === undefined ? "__keep" : b.else };
      case "minigame": return {
        title: b.title || "", hint: b.hint || "", image: b.image || "", picks: String(b.picks || 0), labels: !!b.labels, goto: b.goto || "", score: b.score || "",
        objects: (b.objects || []).map((o) => Object.assign({
          name: o.name || "", x: o.x == null ? 50 : o.x, y: o.y == null ? 50 : o.y, size: o.size || 12,
          look: o.hidden ? "hidden" : o.item ? "item" : "marker", item: o.item || "", text: o.text || "", say: o.say || "", goto: o.goto || "", once: o.once !== false,
        }, o.set ? parseSetEntry(o.set) : { var: "", op: "+", val: "1" })),
        active: 0 };
      case "choice": return { options: b.choice.map((o) => Object.assign({ text: o.text, goto: o.goto || "" }, o.set ? parseSetEntry(o.set) : { var: "", op: "+", val: "1" }, { if: o.if || "" })) };
      default: return { raw: b };
    }
  }

  function fromForm(k, f) {
    switch (k) {
      case "say": {
        const name = (f.name || "").trim() || "???";
        if (f.face || /[:：]/.test(name) || name.length > 16) return f.face ? { say: name, face: f.face, text: f.text } : { say: name, text: f.text };
        return `${name}: ${f.text}`;
      }
      case "narr": return SAY_RE.test(f.text) ? { text: f.text } : f.text;
      case "bg": return { bg: f.bg };
      case "cg": return !f.cg ? { cg: "" } : f.fit === "cover" ? { cg: f.cg, fit: "cover" } : { cg: f.cg };
      case "show": { const o = { show: f.id }; if (f.face) o.face = f.face; if (f.pos && f.pos !== "center") o.pos = f.pos; return o; }
      case "hide": return { hide: f.id };
      case "set": return { set: buildSet(f) || {} };
      case "if": { const o = { if: `${f.var} ${f.op} ${f.val}`, goto: f.goto }; if (f.else) o.else = f.else; return o; }
      case "goto": return { goto: f.goto };
      case "wait": return { wait: Math.max(100, Math.round((+f.sec || 1) * 1000)) };
      case "fx": { const [a, c] = f.fx.split(":"); return a === "shake" ? { shake: true } : { [a]: c }; }
      case "end": return { end: f.name || "THE END" };
      case "particles": {
        if (f.shape === "off") return { particles: "off" };
        const o = { particles: f.shape };
        if (f.mode !== "fall") o.mode = f.mode;
        if (f.color.toLowerCase() !== PCOLOR[f.shape]) o.color = f.color;
        if (f.mode !== "fall") { o.x = Math.round(f.x); o.y = Math.round(f.y); }
        if (+f.amount !== 2) o.amount = +f.amount;
        return o;
      }
      case "tint": return { tint: f.tint };
      case "varimg": {
        const o = { varImage: f.target, cases: f.cases.filter((c) => c.var).map((c) => ({ if: `${c.var} ${c.op} ${c.val}`, image: c.image })) };
        if (f.else !== "__keep") o.else = f.else;
        if (f.target === "cg" && f.fit === "cover") o.fit = "cover";
        return o;
      }
      case "minigame": {
        const o = { minigame: "pick" };
        if (f.title) o.title = f.title;
        o.image = f.image;
        if (+f.picks) o.picks = +f.picks;
        if (f.labels) o.labels = true;
        if (f.hint) o.hint = f.hint;
        o.objects = f.objects.map((x) => {
          const r = { name: x.name || "?", x: Math.round(x.x), y: Math.round(x.y) };
          if (+x.size !== 12) r.size = +x.size;
          if (x.look === "item" && x.item) r.item = x.item;
          if (x.look === "hidden") r.hidden = true;
          if (x.text) r.text = x.text;
          if (x.say) r.say = x.say;
          const st = buildSet(x); if (st) r.set = st;
          if (x.goto) r.goto = x.goto;
          if (!x.once) r.once = false;
          return r;
        });
        if (f.goto) o.goto = f.goto;
        if (f.score) o.score = f.score;
        return o;
      }
      case "choice": return { choice: f.options.map((o) => { const r = { text: o.text || "…" }; if (o.goto) r.goto = o.goto; const s = buildSet(o); if (s) r.set = s; if (o.if) r.if = o.if; return r; }) };
      default: return f.raw;
    }
  }

  function defaultForm(k) {
    const scenes = Object.keys(proj.story);
    const chars = Object.keys(proj.characters);
    const firstChar = chars[0];
    const vars = Object.keys(proj.vars);
    switch (k) {
      case "say": return { name: firstChar ? proj.characters[firstChar].name : "나", text: "", face: "" };
      case "narr": return { text: "" };
      case "bg": return { bg: Object.keys(proj.backgrounds)[0] || "" };
      case "cg": return { cg: Object.keys(proj.cgs)[0] || "", fit: "contain" };
      case "show": return { id: firstChar || "", face: firstChar ? Object.keys(proj.characters[firstChar].faces || {})[0] || "" : "", pos: "center" };
      case "hide": return { id: firstChar || "all" };
      case "set": return { var: vars[0] || "", op: "+", val: "1" };
      case "if": return { var: vars[0] || "", op: ">=", val: "1", goto: scenes[0], else: "" };
      case "goto": return { goto: scenes.find((s) => s !== scene) || scenes[0] };
      case "wait": return { sec: 1 };
      case "fx": return { fx: "shake" };
      case "end": return { name: "THE END" };
      case "varimg": {
        const target = Object.keys(proj.cgs).length ? "cg" : Object.keys(proj.characters)[0] || "bg";
        const first = Object.keys(imageChoices(target)).find((x) => x) || "";
        return { target, fit: "contain", cases: [{ var: vars[0] || "", op: ">=", val: "1", image: first }], else: "__keep" };
      }
      case "minigame": return {
        title: "", hint: "", image: Object.keys(proj.cgs)[0] || Object.keys(proj.backgrounds)[0] || "", picks: "1", labels: true, goto: "", score: "",
        objects: [Object.assign(newObj(1, 35, 60), { var: vars[0] || "" }), Object.assign(newObj(2, 65, 60), { var: vars[0] || "" })], active: 0 };
      case "particles": return { shape: "petal", mode: "spread", color: PCOLOR.petal, x: 50, y: 40, amount: 2 };
      case "tint": return { tint: "sepia" };
      case "choice": return { options: [{ text: "", goto: "", var: "", op: "+", val: "1", if: "" }, { text: "", goto: "", var: "", op: "+", val: "1", if: "" }] };
    }
  }

  const charName = (id) => (id === "all" ? "모두" : proj.characters[id] ? proj.characters[id].name : `⚠ ${id}`);
  function setText(s) { if (!s) return ""; const [k, v] = Object.entries(s)[0]; return typeof v === "number" ? `${k} ${v >= 0 ? "+" : ""}${v}` : `${k} = ${String(v).replace(/^=/, "")}`; }

  function summary(b) {
    const k = kindOf(b), f = toForm(b);
    switch (k) {
      case "say": return [h("b", { style: { color: nameColor(f.name) } }, f.name), f.face ? `(${f.face}) ` : "", f.text];
      case "narr": return f.text;
      case "bg": return ["🖼 ", f.bg, proj.backgrounds[f.bg] ? "" : " ⚠ 없는 배경"];
      case "cg": return f.cg ? ["🎞 ", f.cg, f.fit === "cover" ? " · 꽉 채우기" : "", proj.cgs[f.cg] ? "" : " ⚠ 없는 그림"] : "이벤트 그림 숨기기";
      case "show": return `${charName(f.id)} · ${f.face || "표정 그대로"} · ${POS[f.pos] || f.pos}`;
      case "hide": return `${charName(f.id)} 퇴장`;
      case "set": return setText(b.set);
      case "if": return `만약 ${f.var} ${f.op} ${f.val} 이면 → ${f.goto}${f.else ? `, 아니면 → ${f.else}` : ""}`;
      case "goto": return `→ ${f.goto}`;
      case "wait": return `${f.sec}초 멈춤`;
      case "fx": return FX[f.fx] || f.fx;
      case "end": return `🏁 ${f.name}`;
      case "particles": return f.shape === "off" ? "입자 효과 끄기" :
        [h("span", { style: { display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", background: f.color, marginRight: "6px", verticalAlign: "-1px", border: "1px solid var(--line)" } }),
          `${PSHAPE[f.shape] || f.shape} · ${PMODE[f.mode].split(" (")[0]}${f.mode !== "fall" ? ` (${Math.round(f.x)}%, ${Math.round(f.y)}%)` : ""}`];
      case "tint": return `🎨 ${TINTS[f.tint] || f.tint}`;
      case "varimg": return [h("div", {}, `${targetName(f.target)} 바꾸기`),
        f.cases.map((c) => h("div", { class: "opt" }, `▸ ${c.var} ${c.op} ${c.val} 이면 → ${c.image || "숨기기"}`)),
        f.else !== "__keep" ? h("div", { class: "opt" }, `▸ 그 밖에는 → ${f.else || "숨기기"}`) : null];
      case "minigame": return [h("div", {}, `🎮 ${f.title || "그림 속 오브젝트 고르기"} · 🖼 ${f.image || "그림 없음"}${+f.picks ? ` · ${f.picks}개 고르기` : " · 자유롭게 고르기"}`),
        f.objects.map((o) => h("div", { class: "opt" }, `▸ ${o.look === "hidden" ? "👻 " : ""}${o.name}${o.var ? ` [${setText(buildSet(o))}]` : ""}${o.goto ? ` → ${o.goto}` : ""}`)),
        f.goto ? h("div", { class: "opt" }, `끝나면 → ${f.goto}`) : null];
      case "choice": return f.options.map((o) => h("div", { class: "opt" }, `▸ ${o.text} → ${o.goto || "(다음 블록)"}`, o.var ? `  [${setText(buildSet(o))}]` : ""));
      default: return "직접 쓴 코드 블록";
    }
  }
  function nameColor(name) {
    if (proj.nameColors[name]) return proj.nameColors[name];
    const c = Object.values(proj.characters).find((x) => x.name === name);
    return c ? c.color : "";
  }

  // ---------- 코드 만들기 (보기 좋게) ----------
  const IDENT = /^[A-Za-z_$ㄱ-힝][\w$ㄱ-힝]*$/;
  function lit(v, key, parentKey) {
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "number") return parentKey === "set" && v > 0 ? "+" + v : String(v);
    return String(v);
  }
  function toCode(v, ind = "", key = null, parentKey = null) {
    if (v === null || typeof v !== "object") return lit(v, key, parentKey);
    const inline = inlineCode(v, key);
    if (inline.length + ind.length <= 96 && !(key === "story") && !(Array.isArray(v) && parentKey === "story")) return inline;
    const ni = ind + "  ";
    if (Array.isArray(v)) return "[\n" + v.map((x) => ni + toCode(x, ni, null, key) + ",").join("\n") + "\n" + ind + "]";
    return "{\n" + Object.entries(v).map(([k, x]) => ni + (IDENT.test(k) ? k : JSON.stringify(k)) + ": " + toCode(x, ni, k, key) + ",").join("\n") + "\n" + ind + "}";
  }
  function inlineCode(v, key) {
    if (v === null || typeof v !== "object") return lit(v, null, key);
    if (Array.isArray(v)) return "[" + v.map((x) => inlineCode(x, null)).join(", ") + "]";
    const parts = Object.entries(v).map(([k, x]) => (IDENT.test(k) ? k : JSON.stringify(k)) + ": " + (x !== null && typeof x === "object" ? inlineCode(x, k) : lit(x, k, key)));
    return parts.length ? "{ " + parts.join(", ") + " }" : "{}";
  }
  function projectCode() {
    const p = clone(proj); delete p.images;
    return "// 💡 왼쪽 탭에서 만든 내용이 자동으로 이 코드가 돼요.\n// 여기서 직접 고치고 [코드 적용]을 눌러도 돼요.\n// \"img:...\" 는 올린 그림을 가리키는 이름표예요.\n\nconst PROJECT = " + toCode(p) + ";\n";
  }

  // ---------- 묶음 도우미 ----------
  // 묶음 = { group: "이름", blocks: [ ...블록들 ] }. 게임에서는 안의 블록들이 차례대로 실행돼요.
  const isGroup = (b) => !!b && typeof b === "object" && !Array.isArray(b) && Array.isArray(b.blocks) && b.group !== undefined;
  function walk(list, fn, label) {
    list.forEach((b, i) => {
      const lb = label ? `${label}-${i + 1}` : String(i + 1);
      if (isGroup(b)) walk(b.blocks, fn, lb);
      else fn(b, list, i, lb);
    });
  }
  const flatList = (list) => list.flatMap((b) => (isGroup(b) ? flatList(b.blocks) : [b]));
  const countBlocks = (b) => (isGroup(b) ? flatList(b.blocks).length : 1);

  // ---------- 검사 ----------
  function problems() {
    const out = [];
    const S = proj.story;
    const scn = (n) => S[n] !== undefined;
    if (!scn(proj.start)) out.push(`시작 장면 "${proj.start}" 이 없어요.`);
    for (const [name, list] of Object.entries(S)) {
      walk(list, (b, l, i, lb) => {
        const at = `「${name}」 ${lb}번`;
        const k = kindOf(b), f = toForm(b);
        if (k === "goto" && !scn(f.goto)) out.push(`${at}: 이동할 장면 "${f.goto}" 이 없어요.`);
        if (k === "if") { if (!scn(f.goto)) out.push(`${at}: 조건이 맞을 때 갈 장면 "${f.goto}" 이 없어요.`); if (f.else && !scn(f.else)) out.push(`${at}: 아닐 때 갈 장면 "${f.else}" 이 없어요.`); }
        if (k === "choice") f.options.forEach((o) => o.goto && !scn(o.goto) && out.push(`${at}: 선택지 "${o.text}" 의 장면 "${o.goto}" 이 없어요.`));
        if (k === "minigame") {
          if (!artRef(f.image)) out.push(`${at}: 미니게임 그림 "${f.image}" 이 없어요.`);
          if (f.goto && !scn(f.goto)) out.push(`${at}: 미니게임이 끝나고 갈 장면 "${f.goto}" 이 없어요.`);
          f.objects.forEach((o) => { if (o.goto && !scn(o.goto)) out.push(`${at}: 오브젝트 "${o.name}" 의 장면 "${o.goto}" 이 없어요.`); if (o.look === "item" && !proj.items[o.item]) out.push(`${at}: 오브젝트 "${o.name}" 의 그림 "${o.item}" 이 없어요.`); });
          if (!f.objects.length) out.push(`${at}: 미니게임에 오브젝트가 없어요.`);
        }
        if (kindOf(b) === "raw" && b && b.minigame) out.push(`${at}: 예전 미니게임("${b.minigame}")은 더 이상 쓰지 않아요. 삭제하고 새 미니게임 블록을 넣어 주세요.`);
        if (k === "varimg") {
          const ok = imageChoices(f.target);
          if (f.target !== "bg" && f.target !== "cg" && !proj.characters[f.target]) out.push(`${at}: 캐릭터 "${f.target}" 이 없어요.`);
          else [...f.cases.map((c) => c.image), f.else === "__keep" ? undefined : f.else].forEach((im) => im !== undefined && !(im in ok) && out.push(`${at}: 변수 그림의 "${im || "(빈 칸)"}" 그림이 없어요.`));
        }
        if (k === "bg" && !proj.backgrounds[f.bg]) out.push(`${at}: 배경 "${f.bg}" 이 없어요.`);
        if (k === "cg" && f.cg && !proj.cgs[f.cg]) out.push(`${at}: 이벤트 그림 "${f.cg}" 이 없어요.`);
        if ((k === "show" || k === "hide") && f.id !== "all" && !proj.characters[f.id]) out.push(`${at}: 캐릭터 "${f.id}" 이 없어요.`);
      });
      const flat = flatList(list);
      const last = flat[flat.length - 1];
      const lk = last === undefined ? null : kindOf(last);
      const closed = lk === "goto" || lk === "end" || (lk === "choice" && toForm(last).options.every((o) => o.goto)) || (lk === "if" && toForm(last).else);
      if (!closed) out.push(`「${name}」 의 마지막에 장면 이동이나 엔딩이 없어요. (끝까지 가면 멈춰요)`);
    }
    return out;
  }

  // ---------- 화면 그리기 ----------
  function render() {
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    const v = $("#view");
    const keep = v.scrollTop;
    v.innerHTML = "";
    const w = h("div", { class: "wrap" });
    v.append(w);
    ({ story: renderStory, assets: renderAssets, vars: renderVars, code: renderCode })[tab](w);
    v.scrollTop = keep;
  }

  // ===== 스토리 탭 =====
  let selecting = false, selList = null, selIdx = new Set(); // 여러 개 선택
  let clip = pref.get("clip", []);                          // 복사한 블록 (다른 장면·작품에도 붙여넣기 가능)
  if (!Array.isArray(clip)) clip = [];
  const openGroups = new WeakSet();                          // 펼쳐 둔 묶음
  let flashKey = "";
  function setClip(blocks) { clip = clone(blocks); pref.set("clip", clip); }
  function stopSelecting() { selecting = false; selList = null; selIdx = new Set(); }

  function renderStory(w) {
    if (!proj.story[scene]) scene = proj.start in proj.story ? proj.start : Object.keys(proj.story)[0];
    const names = Object.keys(proj.story);
    const sel = h("select", { "aria-label": "장면 고르기", onchange: (e) => { scene = e.target.value; stopSelecting(); render(); } },
      names.map((n) => h("option", { value: n, selected: n === scene }, (n === proj.start ? "⭐ " : "") + n + (proj.memories.some((m) => m.scene === n) ? "  🎞" : ""))));
    w.append(
      h("div", { class: "scene-bar" }, sel),
      h("div", { class: "scene-tools" },
        h("button", { class: "btn", onclick: () => sceneSheet(null) }, "+ 새 장면"),
        h("button", { class: "btn", onclick: () => sceneSheet(scene) }, "장면 설정 · 삭제"),
        scene === proj.start ? h("span", { class: "start-badge", style: { alignSelf: "center" } }, "⭐ 게임이 여기서 시작해요")
          : h("button", { class: "btn", onclick: () => { proj.start = scene; changed(); toast(`"${scene}" 에서 시작해요`); } }, "⭐ 시작 장면으로"),
        h("button", { class: "btn" + (selecting ? " primary" : ""), onclick: () => { if (selecting) stopSelecting(); else selecting = true; render(); } },
          selecting ? "✓ 선택 끝내기" : "☑ 여러 개 선택 (복사 · 묶기)")
      )
    );
    const list = proj.story[scene];
    if (selecting) w.append(h("p", { class: "hint" }, "블록을 눌러 고르세요. 묶음 안의 블록은 묶음을 펼친 뒤 고를 수 있어요."));
    w.append(renderList(list, ""));
    if (!list.length) w.append(h("p", { class: "hint" }, "아직 비어 있어요. 아래 버튼으로 첫 블록을 넣어 보세요."));
    if (!selecting) w.append(addRow(list, ""));
    if (selecting) w.append(selectBar());
    flashKey = "";
    const pr = problems();
    if (pr.length) w.append(h("div", { class: "warn" }, h("b", {}, `🔍 확인해 볼 곳 ${pr.length}개`), h("ul", {}, pr.slice(0, 8).map((p) => h("li", {}, p)))));
  }

  function renderList(list, prefix) {
    const ol = h("ol", { class: "blocks" });
    list.forEach((b, i) => {
      const key = prefix ? `${prefix}/${i}` : String(i);
      const label = prefix ? `${prefix.split("/").map((n) => +n + 1).join("-")}-${i + 1}` : String(i + 1);
      const isSel = selecting && selList === list && selIdx.has(i);
      const onMain = () => {
        if (selecting) {
          if (selList !== list) { selList = list; selIdx = new Set(); }
          if (selIdx.has(i)) selIdx.delete(i); else selIdx.add(i);
          render(); return;
        }
        if (isGroup(b)) groupSheet(list, i); else blockSheet(list, i);
      };
      const tick = selecting ? h("span", { class: "tick" }, isSel ? "☑" : "☐") : null;
      const side = h("div", { class: "side" },
        h("button", { "aria-label": "위로", onclick: () => move(list, i, -1, prefix), disabled: i === 0 }, "▲"),
        h("button", { "aria-label": "아래로", onclick: () => move(list, i, 1, prefix), disabled: i === list.length - 1 }, "▼"));
      if (isGroup(b)) {
        const open = openGroups.has(b);
        const card = h("div", { class: `block k-group${isSel ? " sel" : ""}${key === flashKey ? " flash" : ""}` },
          h("div", { class: "stripe" }),
          h("button", { class: "main", onclick: onMain, "aria-label": `${label}번 묶음` },
            h("span", { class: "kind" }, tick, `${label} · 묶음`),
            h("div", { class: "sum" }, `📦 ${b.group || "이름 없는 묶음"}`),
            h("div", { class: "opt" }, `블록 ${countBlocks(b)}개`),
            h("code", {}, `{ group: ${JSON.stringify(b.group)}, blocks: [ …${b.blocks.length}개 ] }`)),
          side);
        const toggle = h("button", { class: "group-toggle", onclick: () => { if (open) openGroups.delete(b); else openGroups.add(b); render(); } },
          open ? "▾ 접기" : `▸ 펼쳐서 안의 블록 ${b.blocks.length}개 보기`);
        ol.append(h("li", { class: "group-item" }, card, toggle,
          open ? h("div", { class: "group-body" }, renderList(b.blocks, key), b.blocks.length ? null : h("p", { class: "hint" }, "비어 있는 묶음이에요."), selecting ? null : addRow(b.blocks, key)) : null));
        return;
      }
      const k = kindOf(b);
      ol.append(h("li", { class: `block k-${k}${isSel ? " sel" : ""}${key === flashKey ? " flash" : ""}` },
        h("div", { class: "stripe" }),
        h("button", { class: "main", onclick: onMain, "aria-label": `${label}번 블록 ${selecting ? "고르기" : "편집"}` },
          h("span", { class: "kind" }, tick, `${label} · ${(KINDS[k] || { label: "코드" }).label}`),
          h("div", { class: "sum" }, summary(b)),
          h("code", {}, inlineCode(b))),
        side));
    });
    return ol;
  }

  function addRow(list, prefix) {
    return h("div", { class: "add-row" },
      h("button", { class: "btn primary", onclick: () => pickKind(list, list.length, prefix) }, prefix ? "+ 묶음 안에 블록 추가" : "+ 블록 추가"),
      clip.length ? h("button", { class: "btn", onclick: () => paste(list, list.length, prefix) }, `📋 붙여넣기 (${clip.length})`) : null);
  }

  function paste(list, at, prefix) {
    if (!clip.length) return toast("복사한 블록이 없어요");
    const items = clone(clip);
    list.splice(at, 0, ...items);
    flashKey = prefix ? `${prefix}/${at}` : String(at);
    stopSelecting(); closeSheet(); changed();
    toast(`${items.length}개를 붙여넣었어요`);
  }

  function selectBar() {
    const n = selIdx.size;
    const idx = [...selIdx].sort((a, b) => a - b);
    const picked = () => idx.map((i) => selList[i]);
    const removeSel = () => { for (const i of [...idx].reverse()) selList.splice(i, 1); };
    const need = (fn) => () => { if (!n) return toast("먼저 블록을 눌러 골라 주세요"); fn(); };
    const del = h("button", { class: "btn danger", onclick: need(() => {
      if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = `${n}개 정말 삭제`; return; }
      removeSel(); stopSelecting(); changed(); toast(`${n}개를 삭제했어요`);
    }) }, "🗑 삭제");
    return h("div", { class: "select-bar" },
      h("b", {}, n ? `${n}개 선택됨` : "블록을 눌러 고르세요"),
      h("button", { class: "btn", onclick: () => { selList = proj.story[scene]; selIdx = new Set(selList.map((_, i) => i)); render(); } }, "전체 선택"),
      h("button", { class: "btn primary", onclick: need(() => { setClip(picked()); stopSelecting(); render(); toast(`${n}개를 복사했어요. 원하는 곳에서 [붙여넣기]를 누르세요`); }) }, "📄 복사"),
      h("button", { class: "btn", onclick: need(() => { setClip(picked()); removeSel(); stopSelecting(); changed(); toast(`${n}개를 잘라냈어요. 원하는 곳에서 [붙여넣기]를 누르세요`); }) }, "✂ 잘라내기"),
      h("button", { class: "btn", onclick: need(() => {
        let c = 1; walkGroups((g) => { const m = /^묶음 (\d+)$/.exec(g.group); if (m) c = Math.max(c, +m[1] + 1); });
        const g = { group: `묶음 ${c}`, blocks: clone(picked()) };
        const at = idx[0];
        removeSel(); selList.splice(at, 0, g); openGroups.add(g);
        stopSelecting(); changed(); toast("묶었어요. 묶음을 누르면 이름을 바꿀 수 있어요");
      }) }, "📦 묶기"),
      clip.length ? h("button", { class: "btn", onclick: need(() => paste(selList, idx[idx.length - 1] + 1, "")) }, `📋 아래에 붙여넣기 (${clip.length})`) : null,
      del);
  }
  function walkGroups(fn) {
    const go = (l) => l.forEach((b) => { if (isGroup(b)) { fn(b); go(b.blocks); } });
    Object.values(proj.story).forEach(go);
  }

  // 묶음 편집: 이름 바꾸기 · 풀기 · 복사 · 삭제
  function groupSheet(list, i) {
    const g = list[i];
    const nameIn = h("input", { type: "text", value: g.group, placeholder: "예: 1교시 쉬는 시간" });
    const save = () => { g.group = nameIn.value.trim() || "묶음"; };
    const del = h("button", { class: "btn danger", onclick: () => {
      if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "안의 블록까지 정말 삭제"; return; }
      list.splice(i, 1); closeSheet(); changed();
    } }, "삭제");
    openSheet("묶음", [
      field("묶음 이름", nameIn),
      h("p", { class: "hint" }, `블록 ${countBlocks(g)}개가 들어 있어요. 게임에서는 안의 블록이 위에서부터 차례대로 실행돼요. 묶음은 정리용이라 플레이에는 영향이 없어요.`),
      h("code", { class: "hint", style: { whiteSpace: "pre-wrap", wordBreak: "break-all" } }, `코드: { group: ${JSON.stringify(g.group)}, blocks: [ ...블록 ${g.blocks.length}개 ] }`),
    ], [
      h("button", { class: "btn primary grow", onclick: () => { save(); closeSheet(); changed(); } }, "저장"),
      h("button", { class: "btn", onclick: () => { save(); openGroups.add(g); closeSheet(); render(); pickKind(g.blocks, g.blocks.length, ""); } }, "+ 안에 블록 추가"),
      h("button", { class: "btn", onclick: () => { save(); setClip([g]); closeSheet(); changed(); toast("묶음을 복사했어요"); } }, "📄 복사"),
      h("button", { class: "btn", onclick: () => { save(); list.splice(i + 1, 0, clone(g)); closeSheet(); changed(); } }, "복제"),
      h("button", { class: "btn", onclick: () => { list.splice(i, 1, ...g.blocks); closeSheet(); changed(); toast("묶음을 풀었어요"); } }, "📭 묶음 풀기"),
      del]);
  }

  function move(list, i, d, prefix) {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    flashKey = prefix ? `${prefix}/${j}` : String(j);
    stopSelecting(); changed();
  }

  function pickKind(list, at, prefix) {
    openSheet("어떤 블록을 넣을까요?", [
      clip.length ? h("button", { class: "btn wide", onclick: () => paste(list, at, prefix) }, `📋 복사한 블록 붙여넣기 (${clip.length}개)`) : null,
      h("div", { class: "picker" }, Object.entries(KINDS).map(([k, d]) =>
        h("button", { class: `k-${k}`, onclick: () => blockSheet(list, at, k, prefix) }, h("b", {}, d.label), h("span", {}, d.desc)))),
    ]);
  }

  // ----- 블록 편집 창 -----
  function blockSheet(list, i, newKind, prefix) {
    const isNew = !!newKind;
    const k = newKind || kindOf(list[i]);
    const f = isNew ? defaultForm(k) : toForm(list[i]);
    if (k === "raw") return rawSheet(list, i);
    const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } });
    const codeLine = h("code", { class: "hint", style: { whiteSpace: "pre-wrap", wordBreak: "break-all" } });
    let pvT;
    const refreshCode = () => {
      codeLine.textContent = "코드: " + inlineCode(fromForm(k, f));
      if (f._preview) { clearTimeout(pvT); pvT = setTimeout(() => f._preview && f._preview(), 300); } // 효과 미리보기 새로 고침
    };
    const draw = () => { body.innerHTML = ""; put(body, formFor(k, f, draw, refreshCode)); refreshCode(); };
    draw();
    const flashAt = (n) => (flashKey = prefix ? `${prefix}/${n}` : String(n));
    const commit = () => {
      if (k === "choice" && !f.options.length) return toast("선택지를 하나 이상 넣어 주세요");
      const b = fromForm(k, f);
      if (isNew) list.splice(i, 0, b); else list[i] = b;
      flashAt(i); closeSheet(); changed();
    };
    const foot = [h("button", { class: "btn primary grow", onclick: commit }, isNew ? "넣기" : "저장")];
    if (!isNew) {
      const del = h("button", { class: "btn danger", onclick: () => {
        if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "정말 삭제"; return; }
        list.splice(i, 1); closeSheet(); changed();
      } }, "삭제");
      foot.push(
        h("button", { class: "btn", onclick: () => { list[i] = fromForm(k, f); setClip([list[i]]); closeSheet(); changed(); toast("복사했어요. 원하는 곳에서 [붙여넣기]를 누르세요"); } }, "📄 복사"),
        h("button", { class: "btn", onclick: () => { list.splice(i + 1, 0, clone(fromForm(k, f))); flashAt(i + 1); closeSheet(); changed(); } }, "복제"),
        h("button", { class: "btn", onclick: () => { list[i] = fromForm(k, f); pickKind(list, i + 1, prefix); } }, "아래에 추가"),
        clip.length ? h("button", { class: "btn", onclick: () => { list[i] = fromForm(k, f); paste(list, i + 1, prefix); } }, `📋 아래에 붙여넣기`) : null,
        del);
    }
    openSheet(`${isNew ? "새 " : ""}${KINDS[k].label}`, [body, codeLine], foot);
  }

  function scenesSelect(val, on, allowEmpty) {
    return h("select", { onchange: (e) => on(e.target.value) },
      allowEmpty ? h("option", { value: "", selected: !val }, allowEmpty) : null,
      Object.keys(proj.story).map((n) => h("option", { value: n, selected: n === val }, n)),
      val && !proj.story[val] ? h("option", { value: val, selected: true }, `⚠ ${val} (없음)`) : null);
  }
  function varsSelect(val, on, allowEmpty) {
    const names = Object.keys(proj.vars);
    return h("select", { onchange: (e) => on(e.target.value) },
      allowEmpty ? h("option", { value: "", selected: !val }, allowEmpty) : null,
      names.map((n) => h("option", { value: n, selected: n === val }, n)),
      val && !(val in proj.vars) ? h("option", { value: val, selected: true }, `⚠ ${val}`) : null);
  }
  const field = (label, input, extra) => h("label", { class: "f" }, label, input, extra || null);
  const noVarsHint = () => Object.keys(proj.vars).length ? null : h("p", { class: "hint" }, "변수가 아직 없어요. 아래 [변수] 탭에서 먼저 만들어 주세요.");

  function formFor(k, f, redraw, upd) {
    const inp = (key, attrs) => h("input", Object.assign({ type: "text", value: f[key] ?? "", oninput: (e) => { f[key] = e.target.value; upd(); } }, attrs));
    const area = (key, ph) => h("textarea", { value: f[key] ?? "", placeholder: ph, oninput: (e) => { f[key] = e.target.value; upd(); } });
    const sel = (key, opts, re) => h("select", { onchange: (e) => { f[key] = e.target.value; re ? redraw() : upd(); } },
      Object.entries(opts).map(([v, t]) => h("option", { value: v, selected: String(f[key]) === v }, t)));
    const chars = Object.fromEntries(Object.entries(proj.characters).map(([id, c]) => [id, c.name]));
    const facesOf = (id) => Object.keys((proj.characters[id] || {}).faces || {});
    switch (k) {
      case "say": {
        const names = [...new Set([...Object.values(chars), ...Object.keys(proj.nameColors)])];
        const custom = !names.includes(f.name);
        const opts = Object.fromEntries(names.map((n) => [n, n])); opts["__custom"] = "✎ 직접 쓰기…";
        const s = h("select", { onchange: (e) => { if (e.target.value === "__custom") f.name = ""; else f.name = e.target.value; f.face = ""; redraw(); } },
          Object.entries(opts).map(([v, t]) => h("option", { value: v, selected: custom ? v === "__custom" : v === f.name }, t)));
        const cid = Object.keys(proj.characters).find((id) => proj.characters[id].name === f.name);
        const faceOpts = { "": "그대로 두기" }; if (cid) facesOf(cid).forEach((x) => (faceOpts[x] = x));
        return [
          h("div", { class: "grid2" }, field("누가 말하나요?", s), cid ? field("표정도 바꾸기", sel("face", faceOpts)) : null),
          custom ? field("이름", inp("name", { placeholder: "예: 선생님" })) : null,
          field("대사", area("text", "할 말을 써 주세요")),
        ];
      }
      case "narr": return [field("나레이션", area("text", "장면 설명이나 속마음을 써 주세요"))];
      case "bg": {
        const opts = Object.fromEntries(Object.keys(proj.backgrounds).map((n) => [n, n]));
        const up = imageInput({ kind: "bg", label: "🖼 새 배경 그림 올리기" }, (ref, file) => {
          const n = uniqueName(proj.backgrounds, fileBase(file, "배경"));
          proj.backgrounds[n] = ref; if (!proj.titleBg) proj.titleBg = n;
          f.bg = n; changed({ render: false }); redraw();
        });
        if (!Object.keys(opts).length) return [h("p", { class: "hint" }, "배경이 아직 없어요. 바로 올려 보세요."), up];
        return [field("배경", sel("bg", opts, true)), h("div", { class: "bg-preview", style: { backgroundImage: `url("${imgSrc(proj.backgrounds[f.bg])}")` } }), up];
      }
      case "cg": {
        const opts = { "": "— 숨기기 —" }; Object.keys(proj.cgs).forEach((n) => (opts[n] = n));
        const up = imageInput({ kind: "cg", label: "🎞 새 이벤트 그림 올리기" }, (ref, file) => {
          const n = uniqueName(proj.cgs, fileBase(file, "그림"));
          proj.cgs[n] = ref; f.cg = n; changed({ render: false }); redraw();
        });
        return [
          h("p", { class: "hint" }, "배경과 캐릭터 위에 그림 한 장을 크게 보여줘요. 다 보여준 뒤에는 [숨기기] 블록으로 치워 주세요."),
          h("div", { class: "grid2" }, field("그림", sel("cg", opts, true)), field("맞추기", sel("fit", { contain: "그림 전체 보이기", cover: "화면 꽉 채우기" }, true))),
          f.cg ? h("div", { class: "bg-preview", style: { backgroundImage: `url("${imgSrc(proj.cgs[f.cg])}")`, backgroundSize: f.fit === "cover" ? "cover" : "contain", backgroundColor: "#000" } }) : null,
          up];
      }
      case "show": {
        if (!Object.keys(chars).length) return [h("p", { class: "hint" }, "캐릭터가 아직 없어요. [그림] 탭에서 캐릭터를 만들어 주세요.")];
        const faceOpts = { "": "그대로 두기" }; facesOf(f.id).forEach((x) => (faceOpts[x] = x));
        const ref = (proj.characters[f.id] || {}).faces || {};
        const prev = imgSrc(ref[f.face] || Object.values(ref)[0]);
        return [
          field("캐릭터", h("select", { onchange: (e) => { f.id = e.target.value; f.face = facesOf(f.id)[0] || ""; redraw(); } },
            Object.entries(chars).map(([id, n]) => h("option", { value: id, selected: id === f.id }, n)))),
          h("div", { class: "grid2" }, field("표정", sel("face", faceOpts, true)), field("위치", sel("pos", POS))),
          prev ? h("div", { class: "face-row" }, h("div", { class: "pic", style: { backgroundImage: `url("${prev}")` } }), h("span", { class: "hint" }, "미리보기")) : null,
        ];
      }
      case "hide": return [field("누가 나가나요?", sel("id", Object.assign({}, chars, { all: "모두" })))];
      case "set": return [noVarsHint(), h("div", { class: "grid3" },
        field("변수", varsSelect(f.var, (v) => { f.var = v; upd(); })),
        field("어떻게", sel("op", { "+": "+ 더하기", "-": "− 빼기", "=": "= 값 정하기" })),
        field("값", inp("val")))];
      case "if": return [noVarsHint(), h("div", { class: "grid3" },
          field("만약 변수", varsSelect(f.var, (v) => { f.var = v; upd(); })),
          field("비교", sel("op", { ">=": "≥ 이상", "<=": "≤ 이하", ">": "> 초과", "<": "< 미만", "==": "= 같음", "!=": "≠ 다름" })),
          field("값", inp("val"))),
        h("div", { class: "grid2" },
          field("맞으면 갈 장면", scenesSelect(f.goto, (v) => { f.goto = v; upd(); })),
          field("아니면", scenesSelect(f.else, (v) => { f.else = v; upd(); }, "다음 블록 계속")))];
      case "goto": return [field("이동할 장면", scenesSelect(f.goto, (v) => { f.goto = v; upd(); }))];
      case "wait": return [field("몇 초?", inp("sec", { type: "number", min: "0.1", step: "0.5" }))];
      case "fx": return [field("효과", sel("fx", FX))];
      case "end": return [field("엔딩 이름", inp("name", { placeholder: "예: GOOD END — 약속" }))];
      case "particles": {
        const shapes = Object.assign({}, PSHAPE, { off: "⏹ 입자 효과 끄기" });
        const parts = [field("모양", h("select", { onchange: (e) => { const old = f.shape; f.shape = e.target.value; if (PCOLOR[f.shape] && f.color.toLowerCase() === (PCOLOR[old] || "").toLowerCase()) f.color = PCOLOR[f.shape]; redraw(); } },
          Object.entries(shapes).map(([v, t]) => h("option", { value: v, selected: v === f.shape }, t))))];
        if (f.shape === "off") { f._preview = null; return [...parts, h("p", { class: "hint" }, "계속 나오던 입자를 멈춰요. 이미 나온 입자는 자연스럽게 사라져요.")]; }
        const point = f.mode !== "fall";
        // 미리보기 + 위치 고르기: 실제 게임 엔진으로 효과를 보여주고, 누른 곳이 입자가 나오는 지점이 돼요
        const stage = h("div", { class: "pfx-stage" });
        const dot = point ? h("div", { class: "pos-dot", style: { left: f.x + "%", top: f.y + "%", background: f.color } }) : null;
        const box = h("div", { class: "pos-box pfx-box" + (point ? "" : " nopick") }, stage, dot);
        const posTxt = h("span", { class: "hint" }, point ? `가로 ${Math.round(f.x)}% · 세로 ${Math.round(f.y)}%` : "화면 전체에 나와요");
        if (point) {
          const setFrom = (ev) => {
            const r = box.getBoundingClientRect();
            f.x = Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100));
            f.y = Math.max(0, Math.min(100, ((ev.clientY - r.top) / r.height) * 100));
            dot.style.left = f.x + "%"; dot.style.top = f.y + "%"; posTxt.textContent = `가로 ${Math.round(f.x)}% · 세로 ${Math.round(f.y)}%`; upd();
          };
          box.addEventListener("pointerdown", (ev) => { box.setPointerCapture(ev.pointerId); setFrom(ev); });
          box.addEventListener("pointermove", (ev) => { if (ev.buttons || ev.pointerType === "touch") setFrom(ev); });
        }
        let inst = null;
        f._preview = () => {
          if (inst) inst.destroy();
          if (!stage.isConnected) return;
          const bgName = Object.keys(proj.backgrounds)[0];
          const P = { title: "__preview", start: "a", backgrounds: proj.backgrounds, images: proj.images,
            story: { a: [bgName ? { bg: bgName } : { wait: 1 }, fromForm("particles", f), { wait: 2000000000 }] } };
          inst = VN.mount(stage, P, { startScene: "a", preview: true });
        };
        parts.push(
          field("나오는 방식", sel("mode", PMODE, true)),
          h("label", { class: "f" }, point ? "미리보기 — 누른 곳에서 나와요" : "미리보기", box, h("div", { class: "row" }, posTxt,
            h("button", { class: "btn", style: { marginLeft: "auto", padding: "5px 10px", fontSize: "13px" }, onclick: (e) => { e.preventDefault(); f._preview && f._preview(); } }, "↻ 다시 보기"))),
          h("div", { class: "row" },
            h("label", { class: "f", style: { flex: "none" } }, "색", h("input", { type: "color", value: f.color, oninput: (e) => { f.color = e.target.value; if (dot) dot.style.background = f.color; upd(); } })),
            h("button", { class: "btn", style: { alignSelf: "flex-end" }, onclick: () => { f.color = PCOLOR[f.shape]; redraw(); } }, "기본 색"),
            field("양", sel("amount", { 1: "적게", 2: "보통", 3: "많이" }))),
          MULTI[f.shape] ? h("p", { class: "hint" }, "기본 색이면 여러 색이 섞여서 나와요.") : null);
        if (point) {
          const presets = { "캐릭터 얼굴": [50, 35], "가운데": [50, 50], "위쪽 (천장)": [50, 5], "아래 (바닥)": [50, 95], "왼쪽 위": [15, 15], "오른쪽 위": [85, 15] };
          parts.push(h("div", { class: "row" }, Object.entries(presets).map(([t, [x, y]]) => h("button", { class: "btn", style: { padding: "6px 10px", fontSize: "13px" }, onclick: () => { f.x = x; f.y = y; redraw(); } }, t))));
        }
        if (PTIP[f.shape]) parts.push(h("p", { class: "hint" }, "💡 " + PTIP[f.shape]));
        parts.push(h("p", { class: "hint" }, f.mode === "burst" ? "한 번 나오고 끝나요." : "끌 때까지 계속 나와요. 멈추려면 [입자 효과] 블록에서 '끄기'를 넣어 주세요."));
        return parts;
      }
      case "tint": return [field("화면 색감", sel("tint", TINTS)), h("p", { class: "hint" }, "배경과 캐릭터의 색을 바꿔요. 대사 창은 그대로예요. 되돌리려면 '원래대로'를 넣어 주세요.")];
      case "varimg": {
        const targets = { bg: "배경", cg: "이벤트 그림" };
        Object.entries(proj.characters).forEach(([id, c]) => (targets[id] = `${c.name}의 표정`));
        const imgs = imageChoices(f.target);
        const imgSel = (val, on) => h("select", { onchange: (e) => { on(e.target.value); redraw(); } },
          Object.entries(imgs).map(([v, t]) => h("option", { value: v, selected: v === val }, t)),
          val && !(val in imgs) ? h("option", { value: val, selected: true }, `⚠ ${val}`) : null);
        const preview = (val) => {
          const ref = f.target === "bg" ? proj.backgrounds[val] : f.target === "cg" ? proj.cgs[val] : ((proj.characters[f.target] || {}).faces || {})[val];
          return ref ? h("div", { class: "face-row", style: { gridTemplateColumns: "64px 1fr" } }, h("div", { class: "pic", style: { backgroundImage: `url("${imgSrc(ref)}")` } }), h("span", { class: "hint" }, val)) : null;
        };
        return [
          h("p", { class: "hint" }, "변수 값에 따라 다른 그림을 보여줘요. 위 조건부터 차례로 확인해서 처음 맞는 조건의 그림을 써요."),
          noVarsHint(),
          field("무엇을 바꿀까요?", h("select", { onchange: (e) => {
            f.target = e.target.value; const first = Object.keys(imageChoices(f.target)).find((x) => x) || "";
            f.cases.forEach((c) => (c.image = first)); if (f.else !== "__keep") f.else = first; redraw();
          } }, Object.entries(targets).map(([v, t]) => h("option", { value: v, selected: v === f.target }, t)))),
          !Object.keys(imgs).filter((x) => x).length ? h("p", { class: "hint", style: { color: "var(--danger)" } }, "고를 그림이 없어요. [그림] 탭에서 먼저 올려 주세요.") : null,
          f.target === "cg" ? field("맞추기", sel("fit", { contain: "그림 전체 보이기", cover: "화면 꽉 채우기" })) : null,
          f.cases.map((c, j) => h("div", { class: "opt-card" },
            h("div", { class: "row" }, h("b", { style: { flex: "none" } }, j === 0 ? "만약" : "아니고 만약"),
              h("button", { class: "btn danger", style: { flex: "none", marginLeft: "auto", padding: "5px 10px" }, onclick: () => { f.cases.splice(j, 1); redraw(); } }, "빼기")),
            h("div", { class: "grid3" },
              field("변수", varsSelect(c.var, (v) => { c.var = v; upd(); })),
              field("비교", h("select", { onchange: (e) => { c.op = e.target.value; upd(); } }, [">=", "<=", ">", "<", "==", "!="].map((x) => h("option", { value: x, selected: c.op === x }, x)))),
              field("값", h("input", { type: "text", value: c.val, oninput: (e) => { c.val = e.target.value; upd(); } }))),
            field("이면 이 그림", imgSel(c.image, (v) => (c.image = v))), preview(c.image))),
          h("button", { class: "btn dashed wide", onclick: () => { f.cases.push({ var: Object.keys(proj.vars)[0] || "", op: ">=", val: "1", image: Object.keys(imgs).find((x) => x) || "" }); redraw(); } }, "+ 조건 추가"),
          field("어느 조건에도 안 맞으면", h("select", { onchange: (e) => { f.else = e.target.value; redraw(); } },
            h("option", { value: "__keep", selected: f.else === "__keep" }, "그대로 두기"),
            Object.entries(imgs).map(([v, t]) => h("option", { value: v, selected: v === f.else }, t)))),
          f.else !== "__keep" ? preview(f.else) : null,
        ];
      }
      case "minigame": {
        const o = f.objects[f.active] || f.objects[0];
        // 그림 고르기 (이벤트 그림 + 배경)
        const artOpts = h("select", { onchange: (e) => { f.image = e.target.value; redraw(); } },
          h("option", { value: "", selected: !f.image }, "— 그림을 골라 주세요 —"),
          Object.keys(proj.cgs).length ? h("optgroup", { label: "이벤트 그림" }, Object.keys(proj.cgs).map((n) => h("option", { value: n, selected: n === f.image }, n))) : null,
          Object.keys(proj.backgrounds).length ? h("optgroup", { label: "배경" }, Object.keys(proj.backgrounds).map((n) => h("option", { value: n, selected: n === f.image }, n))) : null);
        const upArt = imageInput({ kind: "cg", label: "🖼 새 일러스트 올리기" }, (ref, file) => {
          const n = uniqueName(proj.cgs, fileBase(file, "일러스트")); proj.cgs[n] = ref; f.image = n; changed({ render: false }); redraw();
        });
        // 위치 미리보기: 그림 위에 오브젝트가 놓인 모습. 누르면 지금 고른 오브젝트가 그 자리로 가요
        const src = imgSrc(artRef(f.image));
        const box = h("div", { class: "pos-box obj-box", style: { backgroundImage: src ? `url("${src}")` : "", backgroundSize: "100% 100%" } });
        if (src) { const im = new Image(); im.onload = () => { box.style.aspectRatio = `${im.naturalWidth} / ${im.naturalHeight}`; }; im.src = src; }
        const marks = f.objects.map((x, j) => {
          const itemSrc = x.look === "item" ? imgSrc(proj.items[x.item]) : "";
          const m = h("div", { class: "obj-mark" + (j === f.active ? " on" : "") + (x.look === "hidden" ? " hid" : ""),
            style: { left: x.x + "%", top: x.y + "%", width: x.size + "%", backgroundImage: itemSrc ? `url("${itemSrc}")` : "" } }, h("span", {}, String(j + 1)));
          box.append(m); return m;
        });
        const setFrom = (ev) => {
          if (!o) return;
          const r = box.getBoundingClientRect();
          o.x = Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100));
          o.y = Math.max(0, Math.min(100, ((ev.clientY - r.top) / r.height) * 100));
          const m = marks[f.active]; m.style.left = o.x + "%"; m.style.top = o.y + "%"; upd();
        };
        box.addEventListener("pointerdown", (ev) => { box.setPointerCapture(ev.pointerId); setFrom(ev); });
        box.addEventListener("pointermove", (ev) => { if (ev.buttons || ev.pointerType === "touch") setFrom(ev); });

        const parts = [
          h("p", { class: "hint" }, "일러스트 위에 오브젝트(선택지)를 놓아요. 플레이어가 오브젝트를 누르면 말이 나오고 변수가 바뀌어요."),
          field("제목 (위쪽에 보여요)", inp("title", { placeholder: "예: 샬럿의 책상 살펴보기" })),
          field("일러스트", artOpts), upArt,
          h("label", { class: "f" }, `오브젝트 위치 — 그림을 누르면 ${o ? `「${o.name}」` : "오브젝트"} 이(가) 그 자리로 가요`, box),
          h("div", { class: "chips" },
            f.objects.map((x, j) => h("button", { class: "chip" + (j === f.active ? " on" : ""), onclick: () => { f.active = j; redraw(); } }, `${j + 1}. ${x.name || "?"}`)),
            h("button", { class: "chip add", onclick: () => { f.objects.push(Object.assign(newObj(f.objects.length + 1, 50, 50), { var: Object.keys(proj.vars)[0] || "" })); f.active = f.objects.length - 1; redraw(); } }, "+ 오브젝트")),
        ];
        if (o) {
          const sayOpts = { "": "(오브젝트 이름으로)" };
          Object.values(proj.characters).forEach((c) => (sayOpts[c.name] = c.name));
          Object.keys(proj.nameColors).forEach((n) => (sayOpts[n] = n));
          const sizeLabel = h("span", {}, `크기 (그림 너비의 ${o.size}%)`);
          parts.push(h("div", { class: "opt-card" },
            h("div", { class: "row" }, h("b", { style: { flex: "none" } }, `오브젝트 ${f.active + 1}`),
              h("button", { class: "btn danger", style: { flex: "none", marginLeft: "auto", padding: "5px 10px" }, onclick: () => { f.objects.splice(f.active, 1); f.active = Math.max(0, f.active - 1); redraw(); } }, "빼기")),
            h("div", { class: "grid2" },
              field("이름", h("input", { type: "text", value: o.name, placeholder: "예: 편지", oninput: (e) => { o.name = e.target.value; upd(); } })),
              field("모양", h("select", { onchange: (e) => { o.look = e.target.value; if (o.look === "item" && !o.item) o.item = Object.keys(proj.items)[0] || ""; redraw(); } },
                Object.entries(LOOKS).map(([v, t]) => h("option", { value: v, selected: v === o.look }, t))))),
            o.look === "item" ? [
              Object.keys(proj.items).length ? field("오브젝트 그림", h("select", { onchange: (e) => { o.item = e.target.value; redraw(); } },
                Object.keys(proj.items).map((n) => h("option", { value: n, selected: n === o.item }, n)))) : null,
              imageInput({ kind: "sprite", label: "🖼 오브젝트 그림 올리기 (흰 배경 자동 지움)", white: () => true }, (ref, file) => {
                const n = uniqueName(proj.items, fileBase(file, o.name || "오브젝트")); proj.items[n] = ref; o.item = n; changed({ render: false }); redraw();
              })] : null,
            h("label", { class: "f" }, sizeLabel, h("input", { type: "range", min: "4", max: "40", value: o.size, oninput: (e) => { o.size = +e.target.value; marks[f.active].style.width = o.size + "%"; sizeLabel.textContent = `크기 (그림 너비의 ${o.size}%)`; upd(); } })),
            field("누르면 나올 말 (비워 두면 말 없이 넘어가요)", h("textarea", { value: o.text, placeholder: "예: 누군가에게 쓰다 만 편지다.", oninput: (e) => { o.text = e.target.value; upd(); } })),
            field("말하는 사람", h("select", { onchange: (e) => { o.say = e.target.value; upd(); } }, Object.entries(sayOpts).map(([v, t]) => h("option", { value: v, selected: v === o.say }, t)))),
            h("div", { class: "grid3" },
              field("고르면 변수", varsSelect(o.var, (v) => { o.var = v; upd(); }, "안 바꿈")),
              field("어떻게", h("select", { onchange: (e) => { o.op = e.target.value; upd(); } }, ["+", "-", "="].map((x) => h("option", { value: x, selected: o.op === x }, x)))),
              field("값", h("input", { type: "text", value: o.val, oninput: (e) => { o.val = e.target.value; upd(); } }))),
            field("고르면 바로 갈 장면 (선택)", scenesSelect(o.goto, (v) => { o.goto = v; upd(); }, "미니게임 계속")),
            h("label", { class: "check" }, h("input", { type: "checkbox", checked: o.once, onchange: (e) => { o.once = e.target.checked; upd(); } }), "한 번만 고를 수 있어요 (고르면 ✔ 표시)")));
        }
        parts.push(
          h("b", {}, "규칙"),
          h("div", { class: "grid2" },
            field("몇 개 고를 수 있나요?", sel("picks", { 0: "자유롭게 ([다 골랐어요] 버튼)", 1: "1개", 2: "2개", 3: "3개", 4: "4개", 5: "5개" })),
            field("끝나면 갈 장면", scenesSelect(f.goto, (v) => { f.goto = v; upd(); }, "다음 블록 계속"))),
          field("안내 문구 (선택)", inp("hint", { placeholder: "예: 샬럿에게 줄 선물을 하나 골라 보세요" })),
          h("label", { class: "check" }, h("input", { type: "checkbox", checked: f.labels, onchange: (e) => { f.labels = e.target.checked; upd(); } }), "오브젝트 아래에 이름 보이기"),
          field("고른 개수를 변수에 저장 (선택)", varsSelect(f.score, (v) => { f.score = v; upd(); }, "저장 안 함")),
          noVarsHint());
        return parts;
      }
      case "choice": {
        const cards = f.options.map((o, j) => h("div", { class: "opt-card" },
          h("div", { class: "row" }, h("b", { style: { flex: "none" } }, `보기 ${j + 1}`),
            h("button", { class: "btn danger", style: { flex: "none", marginLeft: "auto", padding: "5px 10px" }, onclick: () => { f.options.splice(j, 1); redraw(); } }, "빼기")),
          h("input", { type: "text", value: o.text, placeholder: "플레이어가 볼 문장", oninput: (e) => { o.text = e.target.value; upd(); } }),
          field("고르면 갈 장면", scenesSelect(o.goto, (v) => { o.goto = v; upd(); }, "다음 블록 계속")),
          h("div", { class: "grid3" },
            field("변수 바꾸기 (선택)", varsSelect(o.var, (v) => { o.var = v; upd(); }, "안 바꿈")),
            field("어떻게", h("select", { onchange: (e) => { o.op = e.target.value; upd(); } }, ["+", "-", "="].map((x) => h("option", { value: x, selected: o.op === x }, x)))),
            field("값", h("input", { type: "text", value: o.val, oninput: (e) => { o.val = e.target.value; upd(); } }))),
          field("보일 조건 (선택, 예: 호감도 >= 2)", h("input", { type: "text", value: o.if || "", placeholder: "비워 두면 항상 보여요", oninput: (e) => { o.if = e.target.value.trim(); upd(); } }))
        ));
        return [...cards, h("button", { class: "btn dashed wide", onclick: () => { f.options.push({ text: "", goto: "", var: "", op: "+", val: "1", if: "" }); redraw(); } }, "+ 보기 추가")];
      }
    }
    return [];
  }

  function rawSheet(list, i) {
    const ta = h("textarea", { class: "code-edit", style: { minHeight: "30vh" }, value: toCode(list[i]) });
    const msg = h("div");
    openSheet("코드 블록", [h("p", { class: "hint" }, "창작기가 모르는 형식이라 코드로 보여 드려요."), ta, msg], [
      h("button", { class: "btn primary grow", onclick: () => {
        try { list[i] = new Function("return (" + ta.value + ");")(); closeSheet(); changed(); }
        catch (e) { msg.className = "msg err"; msg.textContent = e.message; }
      } }, "저장"),
      h("button", { class: "btn danger", onclick: () => { list.splice(i, 1); closeSheet(); changed(); } }, "삭제"),
    ]);
  }

  // ----- 장면 이름/추가/삭제 -----
  function renameScene(from, to) {
    const S = {};
    for (const [n, l] of Object.entries(proj.story)) S[n === from ? to : n] = l;
    proj.story = S;
    if (proj.start === from) proj.start = to;
    proj.memories.forEach((m) => { if (m.scene === from) m.scene = to; });
    eachBlock((b, l, i) => {
      if (typeof b !== "object" || !b) return;
      if (b.goto === from) b.goto = to;
      if (b.else === from) b.else = to;
      if (b.minigame) (b.objects || []).forEach((o) => { if (o.goto === from) o.goto = to; });
      if (b.choice) b.choice.forEach((o) => { if (o.goto === from) o.goto = to; });
    });
  }
  function eachBlock(fn) { for (const l of Object.values(proj.story)) walk(l, fn); } // 묶음 안의 블록까지

  function sceneSheet(name) {
    const isNew = name == null;
    const inp = h("input", { type: "text", value: isNew ? "" : name, placeholder: "예: 2장 옥상" });
    const err = h("p", { class: "hint", style: { color: "var(--danger)" } });
    const foot = [h("button", { class: "btn primary grow", onclick: () => {
      const v = inp.value.trim();
      if (!v) { err.textContent = "이름을 써 주세요."; return; }
      if (v !== name && proj.story[v]) { err.textContent = "같은 이름의 장면이 이미 있어요."; return; }
      if (isNew) proj.story[v] = [];
      else if (v !== name) renameScene(name, v);
      scene = v; closeSheet(); changed();
    } }, isNew ? "만들기" : "이름 바꾸기")];
    if (!isNew && Object.keys(proj.story).length > 1) {
      const del = h("button", { class: "btn danger", onclick: () => {
        if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = `"${name}" 정말 삭제`; return; }
        delete proj.story[name];
        proj.memories = proj.memories.filter((m) => m.scene !== name);
        if (proj.start === name) proj.start = Object.keys(proj.story)[0];
        scene = proj.start; closeSheet(); changed();
      } }, "장면 삭제");
      foot.push(del);
    }
    const mem = isNew ? null : proj.memories.find((m) => m.scene === name);
    const memOn = h("input", { type: "checkbox", checked: !!mem });
    const memTitle = h("input", { type: "text", value: mem ? mem.title || "" : "", placeholder: "회상방에 보일 제목 (예: 노을빛 약속)" });
    foot[0].addEventListener("click", () => {
      if (isNew || !$("#sheet-wrap").hidden) return; // 저장이 성공했을 때만
      const sceneName = scene;
      proj.memories = proj.memories.filter((m) => m.scene !== sceneName);
      if (memOn.checked) proj.memories.push({ scene: sceneName, title: memTitle.value.trim() || sceneName });
      changed();
    });
    openSheet(isNew ? "새 장면" : "장면 설정", [field("장면 이름", inp), err,
      isNew ? null : h("p", { class: "hint" }, "이름을 바꾸면 이 장면으로 가는 이동·선택지도 같이 바뀌어요."),
      isNew ? null : h("div", { class: "opt-card" },
        h("label", { class: "check" }, memOn, "🎞 회상방에서 다시 보기에 넣기"),
        memTitle,
        h("p", { class: "hint" }, "플레이어가 이 장면을 한 번 본 뒤에 회상방에서 다시 볼 수 있어요. 다시 볼 때는 이 장면이 끝나거나 다른 장면으로 넘어가면 회상방으로 돌아가요. 장면 첫 블록에 배경을 넣어 두면 좋아요."))], foot);
    setTimeout(() => inp.focus(), 50);
  }

  // ===== 그림 탭 =====
  function renderAssets(w) {
    w.append(h("h3", { class: "sec" }, "배경"),
      h("p", { class: "hint" }, "가로로 긴 그림이 좋아요. 폰 세로 화면에서는 가운데가 보여요."));
    w.append(h("div", { class: "thumbs" },
      Object.entries(proj.backgrounds).map(([n, ref]) => h("button", { class: "thumb", onclick: () => bgSheet(n) },
        h("div", { class: "pic", style: { backgroundImage: `url("${imgSrc(ref)}")` } }),
        h("div", { class: "cap" }, h("b", {}, n), h("small", {}, `{ bg: "${n}" }`)))),
      h("button", { class: "thumb add", onclick: () => bgSheet(null) }, "+ 배경 추가")));

    w.append(h("h3", { class: "sec" }, "이벤트 그림 (CG)"),
      h("p", { class: "hint" }, "중요한 장면에서 화면 가득 보여줄 그림이에요. 스토리에서 [이벤트 그림] 블록으로 써요."));
    w.append(h("div", { class: "thumbs" },
      Object.entries(proj.cgs).map(([n, ref]) => h("button", { class: "thumb", onclick: () => bgSheet(n, "cgs") },
        h("div", { class: "pic", style: { backgroundImage: `url("${imgSrc(ref)}")`, backgroundSize: "contain", backgroundColor: "#000" } }),
        h("div", { class: "cap" }, h("b", {}, n), h("small", {}, `{ cg: "${n}" }`)))),
      h("button", { class: "thumb add", onclick: () => bgSheet(null, "cgs") }, "+ 이벤트 그림 추가")));

    w.append(h("h3", { class: "sec" }, "오브젝트 그림"),
      h("p", { class: "hint" }, "미니게임에서 일러스트 위에 놓을 물건 그림이에요 (편지, 열쇠, 선물 등). 흰 배경은 자동으로 지울 수 있어요."));
    w.append(h("div", { class: "thumbs" },
      Object.entries(proj.items).map(([n, ref]) => h("button", { class: "thumb char", onclick: () => bgSheet(n, "items") },
        h("div", { class: "pic", style: { backgroundImage: `url("${imgSrc(ref)}")`, backgroundPosition: "center" } }),
        h("div", { class: "cap" }, h("b", {}, n), h("small", {}, `item: "${n}"`)))),
      h("button", { class: "thumb add", onclick: () => bgSheet(null, "items") }, "+ 오브젝트 그림 추가")));

    w.append(h("h3", { class: "sec" }, "캐릭터"),
      h("p", { class: "hint" }, "캐릭터 하나에 표정 그림을 여러 장 넣을 수 있어요. 흰 배경은 자동으로 지울 수 있어요."));
    w.append(h("div", { class: "thumbs" },
      Object.entries(proj.characters).map(([id, c]) => h("button", { class: "thumb char", onclick: () => charSheet(id) },
        h("div", { class: "pic", style: { backgroundImage: `url("${imgSrc(Object.values(c.faces || {})[0])}")` } }),
        h("div", { class: "cap" }, h("b", { style: { color: c.color } }, c.name), h("small", {}, `${id} · 표정 ${Object.keys(c.faces || {}).length}개`)))),
      h("button", { class: "thumb add char", onclick: () => charSheet(null) }, "+ 캐릭터 추가")));

    const others = Object.entries(proj.nameColors);
    w.append(h("h3", { class: "sec" }, "그 밖의 이름"),
      h("p", { class: "hint" }, "그림 없이 말만 하는 사람(주인공 \"나\" 등)의 이름 색이에요."),
      h("div", { class: "card", style: { display: "flex", flexDirection: "column", gap: "8px" } },
        others.map(([n, col]) => h("div", { class: "row" },
          h("input", { type: "color", value: col, oninput: (e) => { proj.nameColors[n] = e.target.value; changed({ render: false }); } }),
          h("b", { style: { flex: 1 } }, n),
          h("button", { class: "btn danger", onclick: () => { delete proj.nameColors[n]; changed(); } }, "빼기"))),
        (() => {
          const i = h("input", { type: "text", placeholder: "이름 (예: 선생님)" });
          return h("div", { class: "row" }, h("div", { style: { flex: 1 } }, i),
            h("button", { class: "btn", onclick: () => { const v = i.value.trim(); if (v) { proj.nameColors[v] = "#ffffff"; changed(); } } }, "추가"));
        })()));
  }

  // ---------- 그림 넣기 ----------
  // 투명한 파일 입력칸을 버튼 위에 덮어서, 손가락이 바로 입력칸을 누르게 해요 (폰에서 가장 확실한 방법)
  function fileButton(label, accept, onFile, cls) {
    const input = h("input", { type: "file", accept, "aria-label": label, onchange: (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) onFile(f); } });
    return h("label", { class: "btn filebtn " + (cls || "") }, h("span", {}, label), input);
  }
  // 그림 고르기 + 붙여넣기 + 진행 상태
  function imageInput(opts, onRef) {
    const status = h("div", { class: "img-status" });
    const say = (t, bad) => { status.className = "img-status" + (bad ? " err" : ""); status.textContent = t; };
    const handle = async (file) => {
      if (!file) return;
      if (file.type && !file.type.startsWith("image/")) return say("그림 파일이 아니에요.", true);
      say("그림 처리 중…");
      try {
        const ref = addImage(await processImage(file, opts.kind, opts.white ? opts.white() : false));
        say("✅ 넣었어요");
        onRef(ref, file);
      } catch (e) { say("그림을 읽지 못했어요. 다른 그림으로 해 보세요. (" + e.message + ")", true); }
    };
    const paste = h("textarea", { class: "paste", rows: 1, "aria-label": "그림 붙여넣기",
      placeholder: "또는 그림을 복사한 뒤 여기를 길게 눌러 [붙여넣기]",
      oninput: (e) => (e.target.value = ""),
      onpaste: (e) => {
        e.preventDefault(); e.target.value = ""; e.target.blur();
        const it = [...((e.clipboardData && e.clipboardData.items) || [])].find((i) => i.kind === "file" && i.type.startsWith("image/"));
        if (it) handle(it.getAsFile()); else say("붙여넣은 내용에 그림이 없어요. 그림 자체를 복사해 주세요.", true);
      } });
    return h("div", { class: "img-in" }, fileButton(opts.label || "🖼 사진첩에서 그림 고르기", "image/*", handle, "wide" + (opts.primary ? " primary" : "")), paste, status);
  }
  // 사진 파일 이름(IMG_1234 같은 것)은 의미가 없어서 "배경", "그림" 같은 이름을 대신 써요
  function fileBase(file, fallback) {
    const n = ((file && file.name) || "").replace(/\.[^.]+$/, "").replace(/[^\w가-힣]/g, "_").replace(/^_+|_+$/g, "").slice(0, 20);
    return !n || /\d{3,}|image|img|photo|screenshot|스크린샷|사진/i.test(n) ? fallback : n;
  }
  function uniqueName(map, base) {
    let n = base, i = 2; while (map[n]) n = base + i++;
    return n;
  }
  function loadImg(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); res(im); };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("그림을 읽을 수 없어요")); };
      im.src = url;
    });
  }
  async function processImage(file, kind, removeWhite) {
    const im = await loadImg(file);
    const max = kind === "sprite" ? 1400 : 1600;
    const sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    let W = Math.round(im.naturalWidth * sc), H = Math.round(im.naturalHeight * sc);
    let cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    let cx = cv.getContext("2d"); cx.drawImage(im, 0, 0, W, H);
    if (kind !== "sprite") return cv.toDataURL("image/jpeg", 0.86);
    if (removeWhite) {
      const d = cx.getImageData(0, 0, W, H), p = d.data;
      const white = (i) => p[i] >= 232 && p[i + 1] >= 232 && p[i + 2] >= 232;
      const seen = new Uint8Array(W * H), stack = [];
      for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
      for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
      while (stack.length) {
        const n = stack.pop();
        if (seen[n]) continue; seen[n] = 1;
        if (!white(n * 4)) continue;
        p[n * 4 + 3] = 0;
        const x = n % W, y = (n / W) | 0;
        if (x > 0) stack.push(n - 1); if (x < W - 1) stack.push(n + 1);
        if (y > 0) stack.push(n - W); if (y < H - 1) stack.push(n + W);
      }
      // 가장자리 흰 테두리 다듬기
      for (let n = 0; n < W * H; n++) {
        const i = n * 4; if (p[i + 3] === 0) continue;
        const x = n % W, y = (n / W) | 0;
        const nb = (x > 0 && p[i - 1] === 0) || (x < W - 1 && p[i + 7] === 0) || (y > 0 && p[i - W * 4 + 3] === 0) || (y < H - 1 && p[i + W * 4 + 3] === 0);
        if (nb && p[i] >= 200 && p[i + 1] >= 200 && p[i + 2] >= 200) p[i + 3] = 90;
      }
      cx.putImageData(d, 0, 0);
      // 빈 곳 잘라내기
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (p[(y * W + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 >= x0) {
        const c2 = document.createElement("canvas"); c2.width = x1 - x0 + 1; c2.height = y1 - y0 + 1;
        c2.getContext("2d").drawImage(cv, -x0, -y0); cv = c2;
      }
    }
    const webp = cv.toDataURL("image/webp", 0.9);
    return webp.startsWith("data:image/webp") ? webp : cv.toDataURL("image/png");
  }
  function addImage(dataUrl) { const id = uid(); proj.images[id] = dataUrl; return "img:" + id; }

  // 배경 / 이벤트 그림 편집 (map: "backgrounds" 또는 "cgs")
  function bgSheet(name, map) {
    map = map || "backgrounds";
    const isBg = map === "backgrounds", isItem = map === "items";
    const white = { on: true };
    const M = proj[map];
    const isNew = name == null;
    const st = { ref: isNew ? "" : M[name] };
    const prev = h("div", { class: "bg-preview", style: isBg ? {} : { backgroundSize: "contain", backgroundColor: isItem ? "color-mix(in srgb, var(--accent) 12%, var(--surface-2))" : "#000" } });
    const showPrev = () => { prev.style.backgroundImage = st.ref ? `url("${imgSrc(st.ref)}")` : ""; };
    showPrev();
    const nameIn = h("input", { type: "text", value: isNew ? "" : name, placeholder: isBg ? "예: 교실, rooftop" : "예: 옥상_노을" });
    const err = h("p", { class: "hint", style: { color: "var(--danger)" } });
    const up = imageInput({ kind: isBg ? "bg" : isItem ? "sprite" : "cg", white: () => white.on, label: st.ref ? "🖼 다른 그림으로 바꾸기" : "🖼 사진첩에서 그림 고르기", primary: !st.ref }, (ref, file) => {
      st.ref = ref; showPrev();
      if (!nameIn.value) nameIn.value = uniqueName(M, fileBase(file, isBg ? "배경" : isItem ? "오브젝트" : "그림"));
    });
    const whiteBox = isItem ? h("label", { class: "check" }, h("input", { type: "checkbox", checked: true, onchange: (e) => (white.on = e.target.checked) }), "흰 배경 지우기") : null;
    const foot = [h("button", { class: "btn primary grow", onclick: () => {
      const v = nameIn.value.trim();
      if (!v) return (err.textContent = "이름을 써 주세요.");
      if (!st.ref) return (err.textContent = "그림을 골라 주세요.");
      if (v !== name && M[v]) return (err.textContent = "같은 이름이 이미 있어요.");
      const key = isBg ? "bg" : isItem ? "__none" : "cg";
      if (!isNew && v !== name) {
        delete M[name];
        eachBlock((b) => {
          if (b && b.minigame) { if (b.image === name) b.image = v; (b.objects || []).forEach((o) => { if (isItem && o.item === name) o.item = v; }); }
          if (b && b[key] === name) b[key] = v;
          if (b && b.varImage === key) { (b.cases || []).forEach((c) => { if (c.image === name) c.image = v; }); if (b.else === name) b.else = v; }
        });
        if (isBg && proj.titleBg === name) proj.titleBg = v;
      }
      M[v] = st.ref;
      if (isBg && !proj.titleBg) proj.titleBg = v;
      closeSheet(); changed();
    } }, "저장")];
    if (!isNew) {
      const del = h("button", { class: "btn danger", onclick: () => {
        if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "정말 삭제"; return; }
        delete M[name]; if (isBg && proj.titleBg === name) proj.titleBg = ""; closeSheet(); changed();
      } }, "삭제");
      foot.push(del);
    }
    const label = isBg ? "배경" : isItem ? "오브젝트 그림" : "이벤트 그림";
    openSheet(`${label} ${isNew ? "추가" : "편집"}`, [prev, whiteBox, up, field("이름 (스토리에서 부를 이름)", nameIn), err], foot);
  }

  function charSheet(id) {
    const isNew = id == null;
    const src = isNew ? { name: "", color: "#8fd3ff", faces: {} } : proj.characters[id];
    const st = { id: isNew ? "" : id, name: src.name, color: src.color || "#ffffff", faces: Object.entries(src.faces || {}).map(([k, v]) => ({ k, v })), white: true };
    const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } });
    const err = h("p", { class: "hint", style: { color: "var(--danger)" } });
    const draw = () => {
      body.innerHTML = "";
      put(body, 
        h("div", { class: "grid2" },
          field("이름 (화면에 보이는 이름)", h("input", { type: "text", value: st.name, placeholder: "예: 샬럿", oninput: (e) => (st.name = e.target.value) })),
          field("코드 이름 (영어, 띄어쓰기 없이)", h("input", { type: "text", value: st.id, placeholder: "예: charlotte", oninput: (e) => (st.id = e.target.value.trim()) }))),
        h("div", { class: "row" }, h("span", { class: "hint" }, "이름 색"), h("input", { type: "color", value: st.color, oninput: (e) => (st.color = e.target.value) })),
        h("b", {}, "표정"),
        st.faces.length ? null : h("p", { class: "hint" }, "아직 표정이 없어요. 아래 버튼으로 그림을 넣어 주세요."),
        st.faces.map((fc, j) => h("div", { class: "face-row" },
          h("div", { class: "pic", style: { backgroundImage: `url("${imgSrc(fc.v)}")` } }),
          h("input", { type: "text", value: fc.k, "aria-label": "표정 이름", oninput: (e) => (fc.k = e.target.value.trim()) }),
          h("div", { class: "row", style: { flexDirection: "column", gap: "4px" } },
            fileButton("바꾸기", "image/*", async (file) => { const r = await faceImg(file); if (r) { fc.v = r; draw(); } }),
            h("button", { class: "btn danger", style: { padding: "6px 10px" }, onclick: () => { st.faces.splice(j, 1); draw(); } }, "빼기")))),
        h("label", { class: "check" }, h("input", { type: "checkbox", checked: st.white, onchange: (e) => (st.white = e.target.checked) }), "새로 넣는 그림의 흰 배경 지우기"),
        imageInput({ kind: "sprite", label: "+ 표정 그림 넣기 (사진첩)", primary: !st.faces.length, white: () => st.white }, (r) => {
          const base = ["normal", "smile", "sad", "angry", "shy", "surprised"].find((n) => !st.faces.some((f) => f.k === n)) || "face" + (st.faces.length + 1);
          st.faces.push({ k: base, v: r }); draw();
        }),
        err);
    };
    async function faceImg(f) {
      if (!f) return null;
      toast("그림 처리 중…");
      try { return addImage(await processImage(f, "sprite", st.white)); } catch (e) { err.textContent = e.message; return null; }
    }
    draw();
    const foot = [h("button", { class: "btn primary grow", onclick: () => {
      if (!st.name.trim()) return (err.textContent = "이름을 써 주세요.");
      if (!st.id) st.id = "char" + (Object.keys(proj.characters).length + 1);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(st.id)) return (err.textContent = "코드 이름은 영어·숫자·_ 만 쓸 수 있어요 (숫자로 시작 X).");
      if (st.id !== id && proj.characters[st.id]) return (err.textContent = "같은 코드 이름의 캐릭터가 있어요.");
      const keys = st.faces.map((f) => f.k);
      if (keys.some((k) => !k)) return (err.textContent = "표정 이름이 빈 칸이에요.");
      if (new Set(keys).size !== keys.length) return (err.textContent = "같은 표정 이름이 두 번 있어요.");
      const oldName = isNew ? null : proj.characters[id].name;
      const c = { name: st.name.trim(), color: st.color, faces: Object.fromEntries(st.faces.map((f) => [f.k, f.v])) };
      if (!isNew && st.id !== id) {
        const C = {}; for (const [k, v] of Object.entries(proj.characters)) C[k === id ? st.id : k] = v; proj.characters = C;
        eachBlock((b) => { if (b && b.show === id) b.show = st.id; if (b && b.hide === id) b.hide = st.id; if (b && b.varImage === id) b.varImage = st.id; });
      }
      proj.characters[st.id] = c;
      if (oldName && oldName !== c.name) {
        eachBlock((b, l, i) => {
          if (typeof b === "string") { const m = b.match(SAY_RE); if (m && m[1].trim() === oldName) l[i] = `${c.name}: ${m[2]}`; }
          else if (b && b.say === oldName) b.say = c.name;
        });
      }
      closeSheet(); changed();
    } }, "저장")];
    if (!isNew) {
      const del = h("button", { class: "btn danger", onclick: () => {
        if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "정말 삭제"; return; }
        delete proj.characters[id]; closeSheet(); changed();
      } }, "삭제");
      foot.push(del);
    }
    openSheet(isNew ? "캐릭터 추가" : "캐릭터 편집", [body], foot);
  }

  // ===== 변수 탭 =====
  function varUses(name) {
    let n = 0;
    eachBlock((b) => {
      if (!b || typeof b !== "object") return;
      if (b.set && name in b.set) n++;
      if (b.if && String(b.if).trim().split(/\s+/)[0] === name) n++;
      if (b.choice) b.choice.forEach((o) => { if (o.set && name in o.set) n++; if (o.if && o.if.trim().split(/\s+/)[0] === name) n++; });
      if (b.cases) b.cases.forEach((c) => { if (String(c.if).trim().split(/\s+/)[0] === name) n++; });
      if (b.minigame) { if (b.score === name) n++; (b.objects || []).forEach((o) => { if (o.set && name in o.set) n++; }); }
    });
    return n;
  }
  function renameVar(from, to) {
    const V = {}; for (const [k, v] of Object.entries(proj.vars)) V[k === from ? to : k] = v; proj.vars = V;
    const fixSet = (s) => { if (s && from in s) { s[to] = s[from]; delete s[from]; } };
    const fixIf = (e) => String(e).replace(new RegExp("^\\s*" + from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=\\s|$)"), to);
    eachBlock((b) => {
      if (!b || typeof b !== "object") return;
      fixSet(b.set); if (b.if) b.if = fixIf(b.if);
      if (b.choice) b.choice.forEach((o) => { fixSet(o.set); if (o.if) o.if = fixIf(o.if); });
      if (b.cases) b.cases.forEach((c) => (c.if = fixIf(c.if)));
      if (b.minigame) { if (b.score === from) b.score = to; (b.objects || []).forEach((o) => fixSet(o.set)); }
    });
  }
  function renderVars(w) {
    w.append(h("h3", { class: "sec" }, "변수"),
      h("p", { class: "hint" }, "변수는 게임이 기억하는 숫자나 글자예요. 예: 호감도, 돈, 열쇠를 얻었나? 선택지로 바꾸고, 조건 분기로 엔딩을 나눌 수 있어요."));
    const card = h("div", { class: "card", style: { display: "flex", flexDirection: "column", gap: "14px" } });
    const entries = Object.entries(proj.vars);
    if (!entries.length) card.append(h("p", { class: "hint" }, "아직 변수가 없어요."));
    entries.forEach(([name, val]) => {
      const type = typeof val === "boolean" ? "bool" : typeof val === "number" ? "num" : "str";
      const nameIn = h("input", { type: "text", value: name, onchange: (e) => {
        const v = e.target.value.trim().replace(/\s+/g, "_");
        if (!v || v === name) { e.target.value = name; return; }
        if (v in proj.vars) { toast("같은 이름의 변수가 있어요"); e.target.value = name; return; }
        if (!IDENT.test(v)) { toast("변수 이름은 글자로 시작하고 기호 없이 써 주세요"); e.target.value = name; return; }
        renameVar(name, v);
        // 바로 다시 그리면 지금 누르려는 버튼이 사라져서 터치가 씹혀요 → 조금 뒤에 다시 그리기
        changed({ render: false }); setTimeout(() => { if (tab === "vars") render(); }, 400);
      } });
      const valIn = type === "bool"
        ? h("select", { onchange: (e) => { proj.vars[name] = e.target.value === "true"; changed({ render: false }); } },
            h("option", { value: "true", selected: val === true }, "참 (true)"), h("option", { value: "false", selected: val === false }, "거짓 (false)"))
        : h("input", { type: type === "num" ? "number" : "text", value: String(val), oninput: (e) => { proj.vars[name] = type === "num" ? +e.target.value || 0 : e.target.value; changed({ render: false }); } });
      const del = h("button", { class: "btn danger del", "aria-label": `${name} 삭제`, onclick: () => {
        if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "정말?"; return; }
        delete proj.vars[name]; changed();
      } }, "삭제");
      const uses = varUses(name);
      card.append(h("div", { class: "var-row" },
        field("이름", nameIn),
        field("종류", h("select", { onchange: (e) => { proj.vars[name] = e.target.value === "num" ? 0 : e.target.value === "bool" ? false : ""; changed(); } },
          h("option", { value: "num", selected: type === "num" }, "숫자"), h("option", { value: "str", selected: type === "str" }, "글자"), h("option", { value: "bool", selected: type === "bool" }, "참/거짓"))),
        field("처음 값", valIn), del,
        h("div", { class: "uses" }, uses ? `스토리에서 ${uses}번 쓰여요` : "아직 스토리에서 안 쓰여요")));
    });
    card.append(h("button", { class: "btn dashed wide", onclick: () => {
      let n = "변수", i = 1; while (n + i in proj.vars) i++;
      proj.vars[n + i] = 0; changed();
    } }, "+ 변수 추가"));
    w.append(card);
  }

  // ===== 코드 탭 =====
  let codeText = "";
  function renderCode(w) {
    if (!codeDirty) codeText = projectCode();
    const ta = h("textarea", { class: "code-edit", spellcheck: "false", autocapitalize: "off", autocomplete: "off", value: codeText,
      oninput: (e) => { codeText = e.target.value; codeDirty = true; } });
    const msg = h("div");
    w.append(
      h("h3", { class: "sec" }, "코드"),
      h("p", { class: "hint" }, "지금 만든 게임이 자바스크립트 코드로는 이렇게 생겼어요. 블록 하나가 코드 한 줄이에요. 고쳐 보고 [코드 적용]을 누르면 게임에 반영돼요."),
      ta,
      h("div", { class: "row" },
        h("button", { class: "btn primary", onclick: () => applyCode(msg) }, "✅ 코드 적용"),
        h("button", { class: "btn", onclick: () => { codeDirty = false; render(); toast("원래 코드로 되돌렸어요"); } }, "↩ 되돌리기"),
        h("button", { class: "btn", onclick: () => copy(codeText) }, "📋 복사")),
      msg,
      lessons());
  }
  function applyCode(msg) {
    let P;
    try {
      if (!/\bPROJECT\s*=/.test(codeText)) throw new Error("PROJECT 를 찾을 수 없어요. 맨 위의 const PROJECT = { ... } 를 지우지 마세요.");
      P = new Function(codeText + "\n;return typeof PROJECT === 'undefined' ? undefined : PROJECT;")();
      if (!P || typeof P !== "object") throw new Error("PROJECT 를 찾을 수 없어요. 맨 위의 const PROJECT = { ... } 를 지우지 마세요.");
      if (!P.story || typeof P.story !== "object" || Array.isArray(P.story)) throw new Error("story: { 장면이름: [ ... ] } 가 필요해요.");
      for (const [n, l] of Object.entries(P.story)) if (!Array.isArray(l)) throw new Error(`장면 "${n}" 은 [ ] 목록이어야 해요.`);
    } catch (e) {
      msg.className = "msg err";
      const line = (e.stack || "").match(/<anonymous>:(\d+):(\d+)/);
      msg.textContent = "❌ 코드에 문제가 있어요\n" + e.message + (line ? `\n(대략 ${Math.max(1, line[1] - 2)}번째 줄 근처)` : "") +
        "\n\n자주 하는 실수: 쉼표(,) 빠짐 · 따옴표(\") 짝이 안 맞음 · 괄호 { } [ ] 짝이 안 맞음";
      return;
    }
    P.images = proj.images;
    proj = normalize(P);
    codeDirty = false;
    changed({ render: false });
    render();
    toast("코드를 적용했어요");
  }
  function lessons() {
    const L = (t, p, code) => h("details", { class: "lesson" }, h("summary", {}, t), h("p", {}, p), code ? h("pre", {}, code) : null);
    return h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } },
      h("h3", { class: "sec" }, "코드 기초 배우기"),
      L("1. 문자열 — 따옴표 안의 글자", "따옴표 \" \" 로 감싼 글자를 문자열이라고 해요. 이 게임에서는 문자열 하나가 대사나 나레이션 한 줄이에요. \"이름: 내용\" 이면 대사가 돼요.",
        '"창밖에 비가 내린다."      // 나레이션\n"샬럿: 우산 있어?"          // 대사'),
      L("2. 객체 — { 이름: 값 }", "중괄호 { } 안에 이름: 값 을 쉼표로 이어 쓴 것을 객체라고 해요. 명령에 설정을 붙일 때 써요.",
        '{ show: "charlotte", face: "smile", pos: "left" }\n//  ↑ 무엇을      ↑ 어떤 표정      ↑ 어디에'),
      L("3. 배열 — [ 순서대로 ]", "대괄호 [ ] 는 순서가 있는 목록이에요. 장면 하나가 블록들의 배열이라서, 위에서부터 차례대로 실행돼요.",
        '프롤로그: [\n  { bg: "classroom" },\n  "샬럿: 안녕",\n  { goto: "다음장면" },\n],'),
      L("4. 변수 — 게임이 기억하는 값", "vars 안에 처음 값을 정해 두고, set 으로 바꿔요. 숫자는 + 나 - 를 붙이면 더하고 빼요. \"=값\" 은 그 값으로 정해요.",
        'vars: { 호감도: 0, 열쇠: false },\n\n{ set: { 호감도: +1 } }     // 1 더하기\n{ set: { 열쇠: "=true" } }  // 값 정하기'),
      L("5. 조건 — 만약 ~라면", "if 에 비교식을 쓰면 맞을 때 goto 장면으로, 아니면 else 장면으로 가요. >= 이상, <= 이하, == 같음, != 다름.",
        '{ if: "호감도 >= 3", goto: "고백", else: "친구엔딩" }'),
      L("6. 이벤트 그림 — 그림 한 장 크게", "cgs 에 그림을 등록해 두고 { cg: \"이름\" } 으로 보여주고, { cg: \"\" } 로 숨겨요. 빈 문자열 \"\" 은 '아무것도 없음'이라는 뜻이에요.",
        'cgs: { 옥상_노을: "img:..." },\n\n{ cg: "옥상_노을" }   // 보여주기\n"샬럿: 예쁘다…"\n{ cg: "" }            // 숨기기'),
      L("7. 변수 그림과 미니게임", "varImage 는 cases 목록을 위에서부터 확인해서 처음 맞는 조건의 그림을 보여줘요. minigame 은 일러스트(image) 위에 objects 를 놓고, 플레이어가 누른 오브젝트의 set 으로 변수를 바꿔요. x · y 는 그림 위 위치(%), picks 는 고를 수 있는 개수예요.",
        '{ varImage: "charlotte",\n  cases: [ { if: "호감도 >= 3", image: "smile" } ],\n  else: "pout" }\n\n{ minigame: "pick", image: "교실", picks: 1, labels: true,\n  objects: [\n    { name: "사탕", x: 30, y: 60, text: "달콤해 보인다.", set: { 호감도: +1 } },\n    { name: "숙제", x: 70, y: 55, hidden: true, text: "숨겨진 숙제를 찾았다!" },\n  ],\n  goto: "다음장면" }'),
      L("8. 입자 효과 · 색감 · 회상방", "particles 는 입자 모양, mode 는 나오는 방식(fall 흩날리기 / spread 퍼지기 / burst 터지기), x·y 는 화면에서의 위치(%)예요. memories 에 넣은 장면은 회상방에서 다시 볼 수 있어요.",
        '{ particles: "petal", mode: "spread", color: "#ffb7c5", x: 50, y: 35 }\n{ particles: "off" }      // 끄기\n{ tint: "sepia" }         // 회상 색감\n{ tint: "" }              // 원래대로\n\nmemories: [ { scene: "좋은엔딩", title: "노을빛 약속" } ],'),
      L("9. 묶음 — 블록 정리하기", "여러 블록을 group 으로 묶으면 창작기에서 접었다 펼 수 있어요. 게임에서는 blocks 안의 블록이 위에서부터 차례대로 실행돼요. 묶음 안에 묶음을 넣을 수도 있어요.",
        '{ group: "아침 인사", blocks: [\n  { bg: "classroom" },\n  "샬럿: 좋은 아침!",\n  "나: 안녕.",\n] },'),
      L("10. 쉼표와 괄호 — 가장 흔한 실수", "목록의 항목 사이에는 꼭 쉼표(,)가 있어야 해요. 여는 괄호와 닫는 괄호의 짝도 맞아야 해요. 에러가 나면 그 줄 근처의 쉼표와 괄호부터 확인하세요.",
        '[\n  "첫 줄",\n  "둘째 줄"   // ← 쉼표가 없으면 에러!\n  "셋째 줄",\n]'));
  }
  async function copy(t) {
    try { await navigator.clipboard.writeText(t); toast("복사했어요"); }
    catch (e) { toast("복사가 안 돼요. 코드 칸을 길게 눌러 직접 복사해 주세요."); }
  }

  // ===== 테스트 =====
  let playerInst = null;
  function playSheet() {
    const pr = problems();
    openSheet("테스트 플레이", [
      pr.length ? h("div", { class: "warn" }, h("b", {}, `확인해 볼 곳 ${pr.length}개`), h("ul", {}, pr.slice(0, 6).map((p) => h("li", {}, p)))) : h("p", { class: "hint" }, "✅ 눈에 띄는 문제는 없어요."),
      h("button", { class: "btn primary wide", onclick: () => play(null) }, "▶ 타이틀 화면부터"),
      h("button", { class: "btn wide", onclick: () => play(scene) }, `▶ 지금 장면 「${scene}」 부터`),
      h("button", { class: "btn wide", onclick: () => play(null, { unlockAll: true, openGallery: true }) }, "🎞 회상방 미리보기 (전부 열린 상태)"),
      h("p", { class: "hint" }, "테스트 중 왼쪽 위 [✕ 테스트 종료] 를 누르면 돌아와요. 저장 슬롯은 실제 게임과 따로예요."),
    ]);
  }
  function play(startScene, extra) {
    closeSheet();
    const box = $("#player"); box.hidden = false;
    const P = clone(proj); P.title = (P.title || "") + " (테스트)";
    playerInst = VN.mount(box, P, Object.assign({ startScene, onExit: stopPlay }, extra));
  }
  function stopPlay() { if (playerInst) playerInst.destroy(); playerInst = null; $("#player").hidden = true; }

  // ===== 메뉴 (게임 정보 / 프로젝트 / 내보내기) =====
  function menuSheet() {
    const t = h("input", { type: "text", value: proj.title, oninput: (e) => { proj.title = e.target.value; changed({ render: false }); } });
    const s = h("input", { type: "text", value: proj.subtitle || "", oninput: (e) => { proj.subtitle = e.target.value; changed({ render: false }); } });
    const tb = h("select", { onchange: (e) => { proj.titleBg = e.target.value; changed({ render: false }); } },
      h("option", { value: "" }, "없음"), Object.keys(proj.backgrounds).map((n) => h("option", { value: n, selected: n === proj.titleBg }, n)));
    const list = projects.slice().sort((a, b) => b.updated - a.updated);
    openSheet("메뉴", [
      h("h3", { class: "sec" }, "게임 정보"),
      h("div", { class: "grid2" }, field("게임 제목", t), field("부제", s)),
      field("타이틀 화면 배경", tb),
      h("label", { class: "check" }, h("input", { type: "checkbox", checked: proj.gallery !== false, onchange: (e) => { proj.gallery = e.target.checked; changed({ render: false }); } }),
        "타이틀 화면에 [회상방] 버튼 보이기 (이벤트 그림 · 다시 볼 장면 · 엔딩 모음)"),
      h("h3", { class: "sec" }, "내 작품"),
      h("div", { class: "menu-list" },
        list.map((p) => h("button", { class: "btn" + (p.id === projId ? " cur" : ""), onclick: () => { if (p.id !== projId) openProject(p.id); closeSheet(); } },
          h("span", {}, p.name || "제목 없음"), h("small", {}, p.id === projId ? "지금 편집 중" : new Date(p.updated).toLocaleDateString("ko-KR"))))),
      h("div", { class: "row" },
        h("button", { class: "btn", onclick: () => newProject(blankProject()) }, "+ 빈 작품"),
        h("button", { class: "btn", onclick: () => newProject(sampleProject()) }, "+ 샘플 (샬럿)"),
        (() => { const d = h("button", { class: "btn danger", onclick: () => {
          if (!d.classList.contains("armed")) { d.classList.add("armed"); d.textContent = "정말 이 작품 삭제"; return; }
          deleteProject();
        } }, "이 작품 삭제"); return d; })()),
      h("h3", { class: "sec" }, "내보내기 · 가져오기"),
      h("p", { class: "hint" }, "작품은 이 브라우저 안에만 저장돼요. 다른 기기로 옮기거나 잃어버리지 않으려면 백업 파일을 저장해 두세요."),
      h("div", { class: "menu-list" },
        h("button", { class: "btn", onclick: exportGame }, h("span", {}, "🎮 게임 파일로 저장 (.html)"), h("small", {}, "누구나 열어서 플레이")),
        h("button", { class: "btn", onclick: exportBackup }, h("span", {}, "💾 백업 파일로 저장 (.json)"), h("small", {}, "창작기에서 다시 열기")),
        fileButton("📂 백업 파일 열기 (.json) — 새 작품으로 추가", ".json,application/json", importBackup)),
    ]);
  }

  async function download(filename, data) {
    try {
      const api = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
      if (api) {
        try { await api.save({ filename, data: new Blob([data]) }); toast("저장했어요"); }
        catch (e) { toast(e && e.code === "declined" ? "저장을 취소했어요" : "저장하지 못했어요 (" + ((e && e.code) || "오류") + ")"); }
        return;
      }
    } catch (e) {}
    const url = URL.createObjectURL(new Blob([data]));
    const a = h("a", { href: url, download: filename }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast("파일을 저장했어요");
  }
  const safeName = (s) => (s || "novel").replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 60) || "novel";

  async function toDataUrl(path) {
    const r = await fetch(path); if (!r.ok) throw new Error(path);
    const b = await r.blob();
    return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
  }
  // 파일 경로로 된 그림까지 모두 넣은 완전한 복사본
  async function bundledProject() {
    const P = clone(proj);
    const conv = async (ref) => {
      if (!ref || ref.startsWith("img:") || ref.startsWith("data:")) return ref;
      try { const id = uid(); P.images[id] = await toDataUrl(ref); return "img:" + id; } catch (e) { return ref; }
    };
    for (const k of Object.keys(P.backgrounds)) P.backgrounds[k] = await conv(P.backgrounds[k]);
    for (const k of Object.keys(P.cgs || {})) P.cgs[k] = await conv(P.cgs[k]);
    for (const k of Object.keys(P.items || {})) P.items[k] = await conv(P.items[k]);
    for (const c of Object.values(P.characters)) for (const k of Object.keys(c.faces || {})) c.faces[k] = await conv(c.faces[k]);
    return P;
  }
  async function exportBackup() {
    toast("백업 파일 만드는 중…");
    const P = await bundledProject();
    await download(safeName(proj.title) + ".json", JSON.stringify({ format: "novel-workshop", version: 1, project: P }));
  }
  async function exportGame() {
    toast("게임 파일 만드는 중…");
    let engine = "";
    try { engine = await (await fetch("engine.js")).text(); } catch (e) {}
    if (!engine.includes("window.VN")) { const s = document.getElementById("engine-src"); engine = s ? s.textContent : ""; }
    if (!engine) return toast("엔진 코드를 읽지 못했어요");
    const P = await bundledProject();
    const esc = (s) => s.replace(/<\/(script)/gi, "<\\/$1").replace(/<!-{2}/g, "<\\!-" + "-"); // 주의: 이 파일 안에 HTML 주석 시작 기호를 그대로 쓰면 페이지에 넣었을 때 코드가 통째로 무시돼요
    const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>${(proj.title || "Visual Novel").replace(/[<&]/g, "")}</title>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#game{position:fixed;inset:0}</style>
</head><body><div id="game"></div>
<script>${esc(engine)}<\/script>
<script>const PROJECT = ${esc(JSON.stringify(P))};
VN.mount(document.getElementById("game"), PROJECT);<\/script>
</body></html>`;
    await download(safeName(proj.title) + ".html", html);
  }
  async function importBackup(f) {
    {
      try {
        const j = JSON.parse(await f.text());
        const P = j.project || j;
        if (!P.story) throw new Error();
        await newProject(normalize(P));
        toast("백업을 열었어요");
      } catch (e) { toast("이 파일은 열 수 없어요 (창작기 백업 .json 이 아니에요)"); }
    }
  }

  // ---------- 프로젝트 열기/만들기 ----------
  async function newProject(P) {
    clearTimeout(saveT); if (proj) await persist();
    projId = uid(); proj = normalize(P); scene = proj.start;
    projects.push({ id: projId, name: proj.title, updated: Date.now() });
    pref.set("last", projId);
    closeSheet(); tab = "story"; changed();
  }
  async function openProject(id) {
    clearTimeout(saveT); if (proj) await persist();
    const all = await Store.all();
    const r = all.find((x) => x.id === id); if (!r) return;
    projId = id; proj = normalize(r.data); scene = proj.start; codeDirty = false;
    pref.set("last", id);
    $("#proj-name").textContent = proj.title; setSave("저장됨");
    render();
  }
  async function deleteProject() {
    await Store.del(projId);
    projects = projects.filter((p) => p.id !== projId);
    proj = null; closeSheet();
    if (projects.length) await openProject(projects.sort((a, b) => b.updated - a.updated)[0].id);
    else await newProject(sampleProject());
    toast("작품을 삭제했어요");
  }

  // ---------- 시트 ----------
  function openSheet(title, body, foot) {
    $("#sheet-title").textContent = title;
    const b = $("#sheet-body"); b.innerHTML = ""; put(b, body); b.scrollTop = 0;
    const f = $("#sheet-foot"); f.innerHTML = ""; if (foot) put(f, foot);
    $("#sheet-wrap").hidden = false;
  }
  function closeSheet() {
    $("#sheet-wrap").hidden = true;
    $("#sheet-body").innerHTML = ""; // 효과 미리보기 같은 움직이는 것도 같이 멈춰요
  }
  $("#sheet-x").onclick = closeSheet;
  $("#sheet-wrap").addEventListener("click", (e) => { if (e.target.id === "sheet-wrap") closeSheet(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet-wrap").hidden) closeSheet(); });

  // ---------- 탭 ----------
  document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => {
    if (b.dataset.tab === "play") return playSheet();
    tab = b.dataset.tab; pref.set("tab", tab); $("#view").scrollTop = 0; render();
  }));
  $("#btn-menu").onclick = menuSheet;

  // ---------- 시작 ----------
  (async () => {
    tab = pref.get("tab", "story"); if (tab === "play") tab = "story";
    let all = [];
    try { all = await Store.all(); } catch (e) {}
    projects = all.map((r) => ({ id: r.id, name: r.name, updated: r.updated }));
    const last = pref.get("last", null);
    const pick = all.find((r) => r.id === last) || all.sort((a, b) => b.updated - a.updated)[0];
    if (pick) { projId = pick.id; proj = normalize(pick.data); scene = proj.start; $("#proj-name").textContent = proj.title; setSave(Store.ok ? "저장됨" : "임시 저장", !Store.ok); render(); }
    else await newProject(sampleProject());
  })();
})();
