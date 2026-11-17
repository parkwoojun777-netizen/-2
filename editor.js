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
      vars: {}, gauges: {}, watches: [], effects: {}, backgrounds: {}, cgs: {}, items: {}, pics: {}, sounds: {}, characters: {}, nameColors: { 나: "#ffd27a" },
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
    Object.values(proj.pics).forEach(mark);
    Object.values(proj.sounds).forEach(mark);
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
    cgseq:  { label: "CG 넘기기",   desc: "탭할 때마다 그림·대사·소리·효과" },
    sound:  { label: "효과음",      desc: "소리 한 번 재생" },
    bgm:    { label: "배경음악",    desc: "음악 틀기 · 바꾸기 · 끄기" },
    act:    { label: "캐릭터 움직임", desc: "떨기 · 깡총 · 아래로 · 다가오기 등" },
    signal: { label: "시그널 보내기", desc: "⚡ 이름 붙인 블록 묶음 실행" },
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
    gauge:  { label: "게이지",      desc: "변수 게이지 보이기 · 숨기기" },
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
    if (Array.isArray(b.cgSeq)) return "cgseq";
    if (b.sound !== undefined) return "sound";
    if (b.bgm !== undefined) return "bgm";
    if (b.signal !== undefined) return "signal";
    if (b.act !== undefined && b.say === undefined) return "act";
    if (b.minigame) return b.minigame === "pick" ? "minigame" : "raw"; // 예전 미니게임은 코드 블록으로 보여줘요
    if (b.particles !== undefined) return "particles";
    if (b.tint !== undefined) return "tint";
    if (b.gauge !== undefined) return "gauge";
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
    if (target === "pic") return Object.assign({ "": "숨기기 (이 자리 비우기)" }, Object.fromEntries(Object.keys(proj.pics).map((n) => [n, "🧩 " + n])));
    if (target === "bg") return Object.fromEntries(Object.keys(proj.backgrounds).map((n) => [n, n]));
    if (target === "cg") return Object.assign({ "": "숨기기" }, Object.fromEntries(Object.keys(proj.cgs).map((n) => [n, n])));
    const c = proj.characters[target];
    return c ? Object.fromEntries(Object.keys(c.faces || {}).map((n) => [n, n])) : {};
  }
  const targetName = (t) => (t === "pic" ? "화면 위 그림" : t === "bg" ? "배경" : t === "cg" ? "이벤트 그림" : `${charName(t)} 표정`);

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
        if (typeof b === "string") { const m = b.match(SAY_RE); return { name: m[1].trim(), text: m[2], face: "", act: "" }; }
        return { name: b.say, text: b.text || "", face: b.face || "", act: b.act || "" };
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
      case "particles": return b.particles === "off" ? { shape: "off", only: b.only || "", mode: "fall", color: PCOLOR.petal, x: 50, y: 40, amount: 2 }
        : { shape: b.particles, mode: b.mode || "fall", color: (b.color || PCOLOR[b.particles] || "#ffffff").toLowerCase(), dir: b.dir == null ? null : b.dir, spread: b.spread == null ? null : b.spread, x: b.x == null ? 50 : b.x, y: b.y == null ? 40 : b.y, amount: b.amount || 2 };
      case "tint": return { tint: b.tint || "" };
      case "sound": return { sound: b.sound, volume: b.volume == null ? 1 : b.volume };
      case "bgm": return { bgm: b.bgm || "", volume: b.volume == null ? 1 : b.volume, fade: b.fade == null ? 1 : b.fade };
      case "act": return { id: b.act, motion: b.motion || "hop" };
      case "signal": return { name: b.signal };
      case "cgseq": return { fit: b.fit || "contain", after: b.after || "hide", steps: b.cgSeq.map((st) => Object.assign(newStep(), clone(st))) };
      case "gauge": return { name: b.gauge, show: b.show !== false };
      case "varimg": return {
        target: b.varImage, fit: b.fit || "contain",
        cases: (b.cases || []).map((x) => Object.assign(parseCond(x.if), { image: x.image == null ? "" : x.image })),
        else: b.else === undefined ? "__keep" : b.else,
        slot: b.slot || "그림", x: b.x == null ? 50 : b.x, y: b.y == null ? 50 : b.y, w: b.w == null ? 25 : b.w, layer: b.layer || "front", anim: b.anim || "fade" };
      case "minigame": return {
        title: b.title || "", hint: b.hint || "", image: b.image || "", picks: String(b.picks || 0), labels: !!b.labels, goto: b.goto || "", score: b.score || "",
        objects: (b.objects || []).map((o) => Object.assign({
          name: o.name || "", x: o.x == null ? 50 : o.x, y: o.y == null ? 50 : o.y, size: o.size || 12,
          look: o.hidden ? "hidden" : o.item ? "item" : "marker", item: o.item || "", text: o.text || "", say: o.say || "", goto: o.goto || "", once: o.once !== false,
        }, o.set ? parseSetEntry(o.set) : { var: "", op: "+", val: "1" })),
        active: 0 };
      case "choice": return { options: b.choice.map((o) => Object.assign({ text: o.text, goto: o.goto || "" }, o.set ? parseSetEntry(o.set) : { var: "", op: "+", val: "1" }, { if: o.if || "", signal: o.signal || "" })) };
      default: return { raw: b };
    }
  }

  function fromForm(k, f) {
    switch (k) {
      case "say": {
        const name = (f.name || "").trim() || "???";
        if (f.face || f.act || /[:：]/.test(name) || name.length > 16) {
          const o = { say: name };
          if (f.face) o.face = f.face;
          if (f.act) o.act = f.act;
          o.text = f.text;
          return o;
        }
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
        if (f.shape === "off") return f.only ? { particles: "off", only: f.only } : { particles: "off" };
        const o = { particles: f.shape };
        if (f.mode !== "fall") o.mode = f.mode;
        if (PCOLOR[f.shape] !== undefined && f.color.toLowerCase() !== PCOLOR[f.shape]) o.color = f.color;
        if (f.dir != null) { o.dir = Math.round(f.dir); o.spread = Math.round(f.spread == null ? 60 : f.spread); }
        if (f.mode !== "fall") { o.x = Math.round(f.x); o.y = Math.round(f.y); }
        if (+f.amount !== 2) o.amount = +f.amount;
        return o;
      }
      case "tint": return { tint: f.tint };
      case "sound": return +f.volume === 1 ? { sound: f.sound } : { sound: f.sound, volume: +f.volume };
      case "bgm": { const o = { bgm: f.bgm }; if (f.bgm && +f.volume !== 1) o.volume = +f.volume; if (+f.fade !== 1) o.fade = +f.fade; return o; }
      case "act": return { act: f.id, motion: f.motion };
      case "signal": return { signal: f.name };
      case "cgseq": {
        const o = { cgSeq: f.steps.map((st) => { const r = {}; for (const k of ["image", "say", "text", "sound", "fx", "particles"]) if (st[k]) r[k] = st[k]; return r; }) };
        if (f.fit === "cover") o.fit = "cover";
        if (f.after === "keep") o.after = "keep";
        return o;
      }
      case "gauge": return f.show ? { gauge: f.name } : { gauge: f.name, show: false };
      case "varimg": {
        const o = { varImage: f.target, cases: f.cases.filter((c) => c.var).map((c) => ({ if: `${c.var} ${c.op} ${c.val}`, image: c.image })) };
        if (f.else !== "__keep") o.else = f.else;
        if (f.target === "cg" && f.fit === "cover") o.fit = "cover";
        if (f.target === "pic") Object.assign(o, { slot: f.slot || "그림", x: Math.round(f.x), y: Math.round(f.y), w: f.w, layer: f.layer, anim: f.anim });
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
      case "choice": return { choice: f.options.map((o) => { const r = { text: o.text || "…" }; if (o.goto) r.goto = o.goto; const s = buildSet(o); if (s) r.set = s; if (o.if) r.if = o.if; if (o.signal) r.signal = o.signal; return r; }) };
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
        const target = "pic";
        const first = Object.keys(imageChoices(target)).find((x) => x) || "";
        return { target, fit: "contain", cases: [{ var: vars[0] || "", op: ">=", val: "1", image: first }], else: "__keep", slot: "그림", x: 50, y: 30, w: 25, layer: "front", anim: "pop" };
      }
      case "minigame": return {
        title: "", hint: "", image: Object.keys(proj.cgs)[0] || Object.keys(proj.backgrounds)[0] || "", picks: "1", labels: true, goto: "", score: "",
        objects: [Object.assign(newObj(1, 35, 60), { var: vars[0] || "" }), Object.assign(newObj(2, 65, 60), { var: vars[0] || "" })], active: 0 };
      case "particles": return { shape: "petal", mode: "spread", color: PCOLOR.petal, x: 50, y: 40, amount: 2 };
      case "tint": return { tint: "sepia" };
      case "sound": return { sound: Object.keys(proj.sounds)[0] || "", volume: 1 };
      case "bgm": return { bgm: Object.keys(proj.sounds)[0] || "", volume: 1, fade: 1 };
      case "act": return { id: Object.keys(proj.characters)[0] || "all", motion: "hop" };
      case "signal": return { name: sigNames()[0] || "" };
      case "cgseq": { const c = Object.keys(proj.cgs)[0] || ""; return { fit: "contain", after: "hide", steps: [Object.assign(newStep(), { image: c }), newStep()] }; }
      case "gauge": return { name: Object.keys(proj.gauges)[0] || "all", show: true };
      case "choice": return { options: [{ text: "", goto: "", var: "", op: "+", val: "1", if: "" }, { text: "", goto: "", var: "", op: "+", val: "1", if: "" }] };
    }
  }

  const charName = (id) => (id === "all" ? "모두" : proj.characters[id] ? proj.characters[id].name : `⚠ ${id}`);
  function setText(s) { if (!s) return ""; const [k, v] = Object.entries(s)[0]; return typeof v === "number" ? `${k} ${v >= 0 ? "+" : ""}${v}` : `${k} = ${String(v).replace(/^=/, "")}`; }

  function summary(b) {
    const k = kindOf(b), f = toForm(b);
    switch (k) {
      case "say": return [h("b", { style: { color: nameColor(f.name) } }, f.name), f.face ? `(${f.face}) ` : "", f.act ? `[${(MOTION_NAME[f.act] || f.act).replace(/^\S+\s/, "")}] ` : "", f.text];
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
      case "particles": return f.shape === "off" ? (f.only ? `${PSHAPE[f.only] || "🎨 " + f.only} 끄기` : "입자 효과 모두 끄기") :
        [h("span", { style: { display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", background: f.color, marginRight: "6px", verticalAlign: "-1px", border: "1px solid var(--line)" } }),
          `${PSHAPE[f.shape] || "🎨 " + f.shape} · ${PMODE[f.mode].split(" (")[0]}${f.mode !== "fall" ? ` (${Math.round(f.x)}%, ${Math.round(f.y)}%)` : ""}${f.dir != null ? ` · ${dirArrow(f.dir)} ${dirName(f.dir)}` : ""}`];
      case "tint": return `🎨 ${TINTS[f.tint] || f.tint}`;
      case "sound": return `🔊 ${f.sound || "(없음)"}${+f.volume !== 1 ? ` · 크기 ${Math.round(f.volume * 100)}%` : ""}`;
      case "bgm": return f.bgm ? `🎵 ${f.bgm} 틀기${+f.volume !== 1 ? ` · 크기 ${Math.round(f.volume * 100)}%` : ""}${+f.fade ? ` · ${f.fade}초 동안 서서히` : ""}` : `🎵 음악 끄기${+f.fade ? ` (${f.fade}초 동안 작아지며)` : ""}`;
      case "act": return `🕺 ${charName(f.id)} · ${MOTION_NAME[f.motion] || f.motion}`;
      case "signal": return `⚡ 「${f.name || "?"}」 보내기`;
      case "cgseq": return [h("div", {}, `🎞 CG 넘기기 · 탭 ${f.steps.length}번`),
        f.steps.slice(0, 4).map((st, j) => h("div", { class: "opt" }, `${j + 1}. ${st.image ? "🖼 " + st.image + " " : ""}${st.sound ? "🔊 " : ""}${st.fx || st.particles ? "✨ " : ""}${st.text ? (st.say ? st.say + ": " : "") + st.text.slice(0, 24) : "(탭)"}`)),
        f.steps.length > 4 ? h("div", { class: "opt" }, `… ${f.steps.length - 4}단계 더`) : null];
      case "gauge": return `📊 ${f.name === "all" ? "모든 게이지" : (proj.gauges[f.name] && proj.gauges[f.name].label) || f.name} ${f.show ? "보이기" : "숨기기"}`;
      case "varimg": return [h("div", {}, `${targetName(f.target)} 바꾸기${f.target === "pic" ? ` · 자리 「${f.slot}」 (${Math.round(f.x)}%, ${Math.round(f.y)}%) · 너비 ${f.w}%` : ""}`),
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
    const p = clone(proj); delete p.images; delete p.apk; // 그림 데이터와 앱 서명 키는 코드에 보여주지 않아요
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
    (proj.watches || []).forEach((w) => { if (!S[SIG + w.signal]) out.push(`자동 조건 "${w.if}" 의 시그널 "${w.signal}" 이 없어요.`); });
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
        if (k === "sound" && !proj.sounds[f.sound]) out.push(`${at}: 효과음 "${f.sound}" 이 없어요.`);
        if (k === "signal" && !proj.story[SIG + f.name]) out.push(`${at}: 시그널 "${f.name}" 이 없어요.`);
        if (k === "choice") f.options.forEach((o) => o.signal && !proj.story[SIG + o.signal] && out.push(`${at}: 선택지 "${o.text}" 의 시그널 "${o.signal}" 이 없어요.`));
        if (k === "bgm" && f.bgm && !proj.sounds[f.bgm]) out.push(`${at}: 배경음악 "${f.bgm}" 이 없어요.`);
        if (k === "act" && f.id !== "all" && !proj.characters[f.id]) out.push(`${at}: 캐릭터 "${f.id}" 이 없어요.`);
        if (k === "cgseq") f.steps.forEach((st, j) => {
          if (st.image && !proj.cgs[st.image]) out.push(`${at} CG 넘기기 ${j + 1}번: 그림 "${st.image}" 이 없어요.`);
          if (st.sound && !proj.sounds[st.sound]) out.push(`${at} CG 넘기기 ${j + 1}번: 효과음 "${st.sound}" 이 없어요.`);
          if (j === 0 && !st.image) out.push(`${at} CG 넘기기: 첫 단계에 그림을 골라 주세요.`);
        });
        if (k === "particles" && f.shape !== "off" && PCOLOR[f.shape] === undefined && !proj.effects[f.shape]) out.push(`${at}: 입자 효과 "${f.shape}" 이 없어요.`);
        if (k === "gauge" && f.name !== "all" && !proj.gauges[f.name]) out.push(`${at}: "${f.name}" 게이지가 없어요. [변수] 탭에서 켜 주세요.`);
        if ((k === "show" || k === "hide") && f.id !== "all" && !proj.characters[f.id]) out.push(`${at}: 캐릭터 "${f.id}" 이 없어요.`);
      });
      const flat = flatList(list);
      const last = flat[flat.length - 1];
      const lk = last === undefined ? null : kindOf(last);
      const closed = lk === "goto" || lk === "end" || (lk === "choice" && toForm(last).options.every((o) => o.goto)) || (lk === "if" && toForm(last).else);
      if (!closed && !isSig(name)) out.push(`「${name}」 의 마지막에 장면 이동이나 엔딩이 없어요. (끝까지 가면 멈춰요)`);
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
  let mapMode = false; // 🗺 장면 지도 보기
  function setClip(blocks) { clip = clone(blocks); pref.set("clip", clip); }
  function stopSelecting() { selecting = false; selList = null; selIdx = new Set(); }

  function renderStory(w) {
    if (!proj.story[scene]) scene = proj.start in proj.story ? proj.start : Object.keys(proj.story)[0];
    if (mapMode) return renderMap(w);
    const names = Object.keys(proj.story).filter((n) => !isSig(n));
    const sigs = sigNames();
    const sel = h("select", { "aria-label": "장면 고르기", onchange: (e) => { scene = e.target.value; stopSelecting(); render(); } },
      h("optgroup", { label: "장면" }, names.map((n) => h("option", { value: n, selected: n === scene }, (n === proj.start ? "⭐ " : "") + n + (proj.memories.some((m) => m.scene === n) ? "  🎞" : "")))),
      sigs.length ? h("optgroup", { label: "⚡ 시그널" }, sigs.map((n) => h("option", { value: SIG + n, selected: SIG + n === scene }, "⚡ " + n))) : null);
    if (isSig(scene)) {
      const nm = scene.slice(SIG.length);
      w.append(
        h("div", { class: "scene-bar" }, sel),
        h("div", { class: "sig-banner" }, h("b", {}, `⚡ 시그널 「${nm}」`), h("span", {}, `보내면 아래 블록이 실행되고, 끝나면 보낸 곳으로 돌아가요. (보내는 곳 ${signalUses(nm)}곳)`)),
        h("div", { class: "scene-tools" },
          h("button", { class: "btn", onclick: () => signalSheet(nm) }, "⚡ 시그널 설정 · 자동 조건 · 삭제"),
          h("button", { class: "btn", onclick: () => signalSheet(null) }, "+ 새 시그널"),
          h("button", { class: "btn" + (selecting ? " primary" : ""), onclick: () => { if (selecting) stopSelecting(); else selecting = true; render(); } }, selecting ? "✓ 선택 끝내기" : "☑ 여러 개 선택")));
    } else w.append(
      h("div", { class: "scene-bar" }, sel),
      h("div", { class: "scene-tools" },
        h("button", { class: "btn", onclick: () => sceneSheet(null) }, "+ 새 장면"),
        h("button", { class: "btn", onclick: () => sceneSheet(scene) }, "장면 설정 · 삭제"),
        scene === proj.start ? h("span", { class: "start-badge", style: { alignSelf: "center" } }, "⭐ 게임이 여기서 시작해요")
          : h("button", { class: "btn", onclick: () => { proj.start = scene; changed(); toast(`"${scene}" 에서 시작해요`); } }, "⭐ 시작 장면으로"),
        h("button", { class: "btn" + (selecting ? " primary" : ""), onclick: () => { if (selecting) stopSelecting(); else selecting = true; render(); } },
          selecting ? "✓ 선택 끝내기" : "☑ 여러 개 선택 (복사 · 묶기)"),
        h("button", { class: "btn", onclick: () => branchSheet("choice") }, "🔀 분기 만들기"),
        h("button", { class: "btn", onclick: () => { stopSelecting(); mapMode = true; render(); } }, "🗺 장면 지도"),
        h("button", { class: "btn", onclick: () => signalSheet(null) }, "⚡ 새 시그널")
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
  let lastBlockArgs = null;
  // 내 효과를 만들고 돌아왔을 때 같은 블록 창을 그 효과로 다시 열어요
  function blockSheetAgain(effectName) {
    if (!lastBlockArgs) return;
    const [list, i, newKind, prefix] = lastBlockArgs;
    blockSheet(list, i, newKind || "particles", prefix, { shape: effectName, mode: "spread", x: 50, y: 50 }, !newKind);
  }
  function blockSheet(list, i, newKind, prefix, preset, editing) {
    lastBlockArgs = [list, i, newKind, prefix];
    const isNew = !!newKind && !editing;
    const k = newKind || kindOf(list[i]);
    const f = Object.assign(isNew || !list[i] ? defaultForm(k) : toForm(list[i]), preset || {});
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
        !prefix && i > 0 ? h("button", { class: "btn", onclick: () => { list[i] = fromForm(k, f); splitSheet(list, i); } }, "✂ 여기서 장면 나누기") : null,
        del);
    }
    openSheet(`${isNew ? "새 " : ""}${KINDS[k].label}`, [body, codeLine], foot);
  }

  // ===== 🧭 방향 고르기 (입자 효과 · 내 효과에서 같이 써요) =====
  // o.dir: 도 (0 위 · 90 오른쪽 · 180 아래 · 270 왼쪽, null = 기본 방향), o.spread: 퍼지는 폭(도)
  const ARROWS = [["↖", 315], ["↑", 0], ["↗", 45], ["←", 270], ["◎", -1], ["→", 90], ["↙", 225], ["↓", 180], ["↘", 135]];
  function dirPicker(o, onChange, allowDefault) {
    const wrap = h("div", { class: "dir-pick" });
    const angleTxt = h("span", { class: "hint" });
    const spreadTxt = h("span", { class: "hint" });
    const grid = h("div", { class: "dir-grid" });
    const angle = h("input", { type: "range", min: "0", max: "359", step: "1", value: o.dir == null ? 180 : o.dir, "aria-label": "방향 각도" });
    const spread = h("input", { type: "range", min: "0", max: "360", step: "5", value: o.spread == null ? 60 : o.spread, "aria-label": "퍼지는 폭" });
    const sync = () => {
      grid.querySelectorAll("button").forEach((b) => b.classList.toggle("on", +b.dataset.d === (o.dir == null ? -2 : o.spread >= 360 ? -1 : o.dir)));
      angleTxt.textContent = o.dir == null ? "기본 방향 (효과마다 원래 움직임)" : `방향 ${Math.round(o.dir)}° ${dirName(o.dir)}`;
      spreadTxt.textContent = `퍼지는 폭 ${o.spread == null ? 60 : o.spread}°${(o.spread || 0) >= 360 ? " (사방으로)" : (o.spread || 0) <= 10 ? " (한 줄로)" : ""}`;
      angle.value = o.dir == null ? 180 : o.dir; spread.value = o.spread == null ? 60 : o.spread;
    };
    ARROWS.forEach(([t, d]) => grid.append(h("button", { "data-d": d, "aria-label": d < 0 ? "사방으로" : dirName(d), onclick: (e) => {
      e.preventDefault();
      if (d < 0) { o.spread = 360; if (o.dir == null) o.dir = 0; } else { o.dir = d; if (o.spread == null || o.spread >= 360) o.spread = 60; }
      sync(); onChange();
    } }, t)));
    angle.oninput = () => { o.dir = +angle.value; if (o.spread == null) o.spread = 60; sync(); onChange(); };
    spread.oninput = () => { o.spread = +spread.value; if (o.dir == null) o.dir = 180; sync(); onChange(); };
    put(wrap, grid, h("div", { class: "dir-sliders" },
      h("label", { class: "f" }, angleTxt, angle), h("label", { class: "f" }, spreadTxt, spread),
      allowDefault ? h("button", { class: "btn", style: { padding: "5px 10px", fontSize: "13px", alignSelf: "flex-start" }, onclick: (e) => { e.preventDefault(); o.dir = null; o.spread = null; sync(); onChange(); } }, "기본 방향으로") : null));
    sync();
    return wrap;
  }
  function dirName(d) {
    const names = ["위", "오른쪽 위", "오른쪽", "오른쪽 아래", "아래", "왼쪽 아래", "왼쪽", "왼쪽 위"];
    return names[Math.round((((d % 360) + 360) % 360) / 45) % 8];
  }
  const dirArrow = (d) => (d == null ? "" : "↑↗→↘↓↙←↖"[Math.round((((d % 360) + 360) % 360) / 45) % 8]);

  // ===== 🎨 내 효과 (커스텀 입자) =====
  const FX_SHAPES = { circle: "● 동그라미", glow: "◉ 빛 방울 (흐릿)", star: "★ 별", sparkle: "✦ 반짝이", heart: "♥ 하트", square: "■ 네모 조각", petal: "🌸 꽃잎", ring: "◯ 고리", line: "／ 줄 (빗줄기·유성)", emoji: "😀 이모지 · 글자", image: "🖼 오브젝트 그림" };
  const FX_DEFAULT = { shape: "star", colors: ["#fff3a8", "#ffd23f"], sizeMin: 4, sizeMax: 9, dir: 0, spread: 50, speedMin: 60, speedMax: 160, gravity: 40, drag: 0.4,
    lifeMin: 1.2, lifeMax: 2.4, alpha: 1, fadeIn: 0.1, fadeOut: 0.6, grow: -0.3, spin: 180, wobble: 0, twinkle: true, glow: true, flip: false, rate: 24, count: 50, area: 10, emoji: "⭐", image: "" };
  const FX_PRESETS = {
    "✨ 별가루": {},
    "🎆 불꽃놀이": { shape: "glow", colors: ["#ff5d8f", "#ffd23f", "#5d9cec", "#3bceac"], sizeMin: 2, sizeMax: 4, spread: 360, speedMin: 120, speedMax: 260, gravity: 90, drag: 1.4, lifeMin: 1, lifeMax: 1.8, fadeOut: 0.7, grow: 0, spin: 0, twinkle: true, glow: true, count: 120, area: 0 },
    "💖 하트 분수": { shape: "heart", colors: ["#ff6b8b", "#ffb7c5", "#ff4d6d"], sizeMin: 6, sizeMax: 12, dir: 0, spread: 40, speedMin: 180, speedMax: 300, gravity: 260, drag: 0.3, lifeMin: 1.6, lifeMax: 2.6, fadeOut: 0.4, grow: 0, spin: 90, twinkle: false, glow: false, rate: 18 },
    "🌠 유성": { shape: "line", colors: ["#ffffff", "#bfefff"], sizeMin: 5, sizeMax: 9, dir: 225, spread: 6, speedMin: 420, speedMax: 620, gravity: 0, drag: 0, lifeMin: 0.8, lifeMax: 1.4, fadeOut: 0.8, grow: 0, spin: 0, twinkle: false, glow: true, rate: 2 },
    "🌫 빛 먼지": { shape: "glow", colors: ["#fff8e1", "#ffe9a8"], sizeMin: 2, sizeMax: 5, dir: 0, spread: 360, speedMin: 5, speedMax: 25, gravity: -5, drag: 0.2, lifeMin: 3, lifeMax: 6, alpha: 0.8, fadeIn: 1, fadeOut: 0.5, grow: 0, spin: 0, twinkle: true, glow: true, wobble: 0.4, rate: 10, area: 200 },
    "💬 이모지 펑": { shape: "emoji", emoji: "💕", colors: ["#ffffff"], sizeMin: 8, sizeMax: 14, dir: 0, spread: 120, speedMin: 120, speedMax: 240, gravity: 220, drag: 0.6, lifeMin: 1.2, lifeMax: 2, fadeOut: 0.5, grow: 0.2, spin: 60, twinkle: false, glow: false, count: 24 },
  };
  function fxSwatch(d) {
    return h("span", { class: "fx-sw" }, (d.colors || []).slice(0, 5).map((c) => h("i", { style: { background: c } })));
  }
  function effectSheet(name, after) {
    const isNew = name == null;
    const d = Object.assign(clone(FX_DEFAULT), isNew ? {} : clone(proj.effects[name]));
    const st = { name: isNew ? uniqueEffect("내 효과") : name, mode: "spread", x: 50, y: 60 };
    const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } });
    const err = h("p", { class: "hint", style: { color: "var(--danger)" } });
    let inst = null, pvT = null;
    const stage = h("div", { class: "pfx-stage" });
    const dot = h("div", { class: "pos-dot", style: { left: st.x + "%", top: st.y + "%", background: (d.colors || [])[0] || "#fff" } });
    const box = h("div", { class: "pos-box pfx-box" }, stage, dot);
    const preview = () => {
      if (inst) inst.destroy();
      if (!stage.isConnected) return;
      const bgName = Object.keys(proj.backgrounds)[0];
      const fxName = "__preview__";
      const P = { title: "__preview", start: "a", backgrounds: proj.backgrounds, images: proj.images, items: proj.items, effects: { [fxName]: clean(d) },
        story: { a: [bgName ? { bg: bgName } : { wait: 1 }, Object.assign({ particles: fxName, mode: st.mode }, st.mode !== "fall" ? { x: Math.round(st.x), y: Math.round(st.y) } : {}), { wait: 2000000000 }] } };
      inst = VN.mount(stage, P, { startScene: "a", preview: true });
    };
    const upd = () => { clearTimeout(pvT); pvT = setTimeout(preview, 250); dot.style.background = (d.colors || [])[0] || "#fff"; dot.hidden = st.mode === "fall"; };
    const setFrom = (ev) => {
      if (st.mode === "fall") return;
      const r = box.getBoundingClientRect();
      st.x = Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100)); st.y = Math.max(0, Math.min(100, ((ev.clientY - r.top) / r.height) * 100));
      dot.style.left = st.x + "%"; dot.style.top = st.y + "%"; upd();
    };
    box.addEventListener("pointerdown", (ev) => { box.setPointerCapture(ev.pointerId); setFrom(ev); });
    box.addEventListener("pointermove", (ev) => { if (ev.buttons || ev.pointerType === "touch") setFrom(ev); });
    // 슬라이더 하나 = 숫자 하나
    const slider = (label, key, min, max, step, fmt) => {
      const txt = h("span", {}, `${label}: ${fmt(d[key])}`);
      return h("label", { class: "f fx-slider" }, txt, h("input", { type: "range", min, max, step, value: d[key], oninput: (e) => { d[key] = +e.target.value; txt.textContent = `${label}: ${fmt(d[key])}`; upd(); } }));
    };
    const pair = (label, a, b, min, max, step, unit) => {
      const txt = h("span", {});
      const show = () => (txt.textContent = `${label}: ${d[a]} ~ ${d[b]}${unit}`);
      const lo = h("input", { type: "range", min, max, step, value: d[a], "aria-label": label + " 최소", oninput: (e) => { d[a] = +e.target.value; if (d[a] > d[b]) { d[b] = d[a]; hi.value = d[b]; } show(); upd(); } });
      const hi = h("input", { type: "range", min, max, step, value: d[b], "aria-label": label + " 최대", oninput: (e) => { d[b] = +e.target.value; if (d[b] < d[a]) { d[a] = d[b]; lo.value = d[a]; } show(); upd(); } });
      show();
      return h("label", { class: "f fx-slider" }, txt, h("div", { class: "fx-pair" }, lo, hi));
    };
    const check = (key, label) => h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!d[key], onchange: (e) => { d[key] = e.target.checked; upd(); } }), label);
    const sec = (t) => h("b", { class: "fx-sec" }, t);
    const draw = () => {
      body.innerHTML = "";
      put(body,
        h("div", { class: "chips" }, Object.keys(FX_PRESETS).map((k) => h("button", { class: "chip", onclick: () => { Object.assign(d, clone(FX_DEFAULT), clone(FX_PRESETS[k])); draw(); upd(); } }, k))),
        h("p", { class: "hint" }, "위 예시를 눌러 시작하고, 아래에서 하나씩 바꿔 보세요. 미리보기가 바로 바뀌어요."),
        h("label", { class: "f" }, "미리보기 — 누른 곳에서 나와요", box),
        h("div", { class: "chips" }, Object.entries({ spread: "퍼져 나오기 (계속)", burst: "펑! 터지기", fall: "화면 전체" }).map(([m, t]) =>
          h("button", { class: "chip" + (st.mode === m ? " on" : ""), onclick: () => { st.mode = m; draw(); upd(); } }, t)),
          h("button", { class: "chip", onclick: () => preview() }, "↻ 다시")),
        field("효과 이름", h("input", { type: "text", value: st.name, placeholder: "예: 별가루", oninput: (e) => (st.name = e.target.value) })),
        sec("모양 · 색"),
        field("모양", h("select", { onchange: (e) => { d.shape = e.target.value; if (d.shape === "image" && !d.image) d.image = Object.keys(proj.items)[0] || ""; draw(); upd(); } },
          Object.entries(FX_SHAPES).map(([v, t]) => h("option", { value: v, selected: v === d.shape }, t)))),
        d.shape === "emoji" ? field("이모지나 글자 (한 글자)", h("input", { type: "text", value: d.emoji, maxlength: "4", oninput: (e) => { d.emoji = e.target.value; upd(); } })) : null,
        d.shape === "image" ? (Object.keys(proj.items).length
          ? field("오브젝트 그림", h("select", { onchange: (e) => { d.image = e.target.value; upd(); } }, Object.keys(proj.items).map((n) => h("option", { value: n, selected: n === d.image }, n))))
          : h("p", { class: "hint" }, "오브젝트 그림이 없어요. [그림] 탭 → 오브젝트 그림에서 먼저 올려 주세요.")) : null,
        h("div", { class: "row fx-colors" }, h("span", { class: "hint" }, d.shape === "emoji" || d.shape === "image" ? "색 (이모지·그림에는 안 쓰여요)" : "색 (여러 개면 섞여서 나와요)"),
          d.colors.map((c, j) => h("span", { class: "fx-color" },
            h("input", { type: "color", value: c, "aria-label": `색 ${j + 1}`, oninput: (e) => { d.colors[j] = e.target.value; upd(); } }),
            d.colors.length > 1 ? h("button", { class: "icon-btn", "aria-label": "색 빼기", onclick: () => { d.colors.splice(j, 1); draw(); upd(); } }, "✕") : null)),
          d.colors.length < 5 ? h("button", { class: "btn", style: { padding: "6px 10px" }, onclick: () => { d.colors.push("#ffffff"); draw(); upd(); } }, "+ 색") : null),
        pair("크기", "sizeMin", "sizeMax", 1, 60, 1, "px"),
        sec("방향 · 움직임"),
        dirPicker(d, upd, false),
        pair("빠르기", "speedMin", "speedMax", 0, 700, 5, ""),
        slider("중력", "gravity", -400, 600, 10, (v) => (v > 0 ? `${v} (아래로 떨어져요)` : v < 0 ? `${v} (위로 떠올라요)` : "0 (그대로)")),
        slider("느려짐 (공기 저항)", "drag", 0, 3, 0.1, (v) => (v ? v.toFixed(1) : "0 (안 느려져요)")),
        slider("흔들림", "wobble", 0, 1, 0.05, (v) => (v ? Math.round(v * 100) + "%" : "없음")),
        slider("회전", "spin", 0, 720, 10, (v) => (v ? `초당 ${v}°` : "안 돌아요")),
        slider("나오는 범위", "area", 0, 300, 5, (v) => (v ? `${v}px 안에서 퍼져 나와요` : "한 점에서")),
        sec("투명도 · 사라짐"),
        slider("투명도", "alpha", 0.05, 1, 0.05, (v) => `${Math.round(v * 100)}% 보여요`),
        pair("수명 (화면에 있는 시간)", "lifeMin", "lifeMax", 0.2, 10, 0.1, "초"),
        slider("나타나는 시간", "fadeIn", 0, 2, 0.05, (v) => (v ? `${v.toFixed(2)}초 동안 서서히` : "바로 나타나요")),
        slider("서서히 사라지는 정도", "fadeOut", 0, 1, 0.05, (v) => (v === 0 ? "끝에 갑자기 사라져요" : v >= 1 ? "처음부터 천천히 사라져요" : `수명의 마지막 ${Math.round(v * 100)}% 동안 사라져요`)),
        slider("크기 변화", "grow", -1, 3, 0.1, (v) => (v === 0 ? "그대로" : v < 0 ? `점점 작아져요 (${Math.round(v * 100)}%)` : `점점 커져요 (+${Math.round(v * 100)}%)`)),
        h("div", { class: "row" }, check("twinkle", "깜빡이기"), check("glow", "빛나게 (겹치면 밝아짐)"), check("flip", "뒤집히며 날기")),
        sec("양"),
        slider("계속 나올 때: 1초에", "rate", 1, 120, 1, (v) => `${v}개`),
        slider("펑! 터질 때", "count", 5, 200, 5, (v) => `${v}개`),
        err);
    };
    draw();
    const foot = [h("button", { class: "btn primary grow", onclick: () => {
      const v = st.name.trim();
      if (!v) return (err.textContent = "효과 이름을 써 주세요.");
      if (PCOLOR[v] !== undefined || v === "off") return (err.textContent = "기본 효과와 같은 이름은 쓸 수 없어요.");
      if (v !== name && proj.effects[v]) return (err.textContent = "같은 이름의 효과가 있어요.");
      if (!isNew && v !== name) { delete proj.effects[name]; eachBlock((b) => { if (b && b.particles === name) b.particles = v; }); }
      proj.effects[v] = clean(d);
      if (inst) inst.destroy();
      closeSheet(); changed();
      toast(`「${v}」 효과를 저장했어요`);
      if (after) after(v);
    } }, "저장")];
    if (!isNew) {
      const del = h("button", { class: "btn danger", onclick: () => {
        if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "정말 삭제"; return; }
        delete proj.effects[name]; closeSheet(); changed();
      } }, "삭제");
      foot.push(del);
    }
    openSheet(isNew ? "🎨 새 효과 만들기" : "🎨 효과 고치기", [body], foot);
    upd();
  }
  // 저장할 때는 쓰는 값만 남겨요
  function clean(d) {
    const o = {};
    for (const k of Object.keys(FX_DEFAULT)) if (d[k] !== undefined && d[k] !== "") o[k] = d[k];
    if (o.shape !== "emoji") delete o.emoji;
    if (o.shape !== "image") delete o.image;
    return o;
  }
  function uniqueEffect(base) { let n = base, i = 2; while (proj.effects[n]) n = `${base} ${i++}`; return n; }

  // ===== 🔊 효과음 =====
  function readDataUrl(file) {
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error("파일을 읽지 못했어요")); fr.readAsDataURL(file); });
  }
  let testAudio = null;
  function playTest(name, vol) {
    try {
      if (testAudio) testAudio.pause();
      const src = imgSrc(proj.sounds[name] || "");
      if (!src) return toast("없는 효과음이에요");
      testAudio = new Audio(src); testAudio.volume = Math.max(0, Math.min(1, vol == null ? 1 : +vol));
      const p = testAudio.play(); if (p && p.catch) p.catch(() => toast("이 화면에서는 소리를 낼 수 없어요"));
    } catch (e) { toast("소리를 재생하지 못했어요"); }
  }
  // 소리 파일 고르기 → 효과음 목록에 넣고 이름을 돌려줘요
  function soundInput(label, onAdd) {
    const status = h("div", { class: "img-status" });
    const handle = async (file) => {
      if (file.type && !file.type.startsWith("audio/")) { status.className = "img-status err"; status.textContent = "소리 파일이 아니에요."; return; }
      if (file.size > 15 * 1048576) { status.className = "img-status err"; status.textContent = "15MB 보다 작은 파일을 써 주세요. (배경음악은 mp3 로 줄이면 좋아요)"; return; }
      status.className = "img-status"; status.textContent = "넣는 중…";
      try {
        const ref = addImage(await readDataUrl(file));
        const base = fileBase(file, "효과음");
        const n = uniqueName(proj.sounds, base);
        proj.sounds[n] = ref; changed({ render: false });
        status.textContent = `✅ 「${n}」 을(를) 넣었어요`;
        onAdd(n);
      } catch (e) { status.className = "img-status err"; status.textContent = e.message; }
    };
    return h("div", { class: "img-in" }, fileButton(label || "🔊 소리 파일 고르기 (mp3 · wav · ogg)", "audio/*", handle, "wide"), inboxPicker("audio", handle), status);
  }
  function soundSheet(name) {
    const nameIn = h("input", { type: "text", value: name });
    const err = h("p", { class: "hint", style: { color: "var(--danger)" } });
    const del = h("button", { class: "btn danger", onclick: () => {
      if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "정말 삭제"; return; }
      delete proj.sounds[name]; closeSheet(); changed();
    } }, "삭제");
    openSheet("효과음", [h("button", { class: "btn wide", onclick: () => playTest(name) }, "▶ 들어보기"), field("이름 (스토리에서 부를 이름)", nameIn), err], [
      h("button", { class: "btn primary grow", onclick: () => {
        const v = nameIn.value.trim();
        if (!v) return (err.textContent = "이름을 써 주세요.");
        if (v !== name && proj.sounds[v]) return (err.textContent = "같은 이름의 효과음이 있어요.");
        if (v !== name) {
          proj.sounds[v] = proj.sounds[name]; delete proj.sounds[name];
          eachBlock((b) => { if (!b || typeof b !== "object") return; if (b.sound === name) b.sound = v; if (b.bgm === name) b.bgm = v; (b.cgSeq || []).forEach((st) => { if (st.sound === name) st.sound = v; }); });
          if (proj.titleBgm === name) proj.titleBgm = v;
        }
        closeSheet(); changed();
      } }, "저장"), del]);
  }

  // ===== 🎞 CG 넘기기: 탭할 때마다 그림 · 대사 · 효과음 · 효과 =====
  const SEQ_FX = { "": "효과 없음", shake: "화면 흔들기", flash: "하얗게 번쩍", flashRed: "빨갛게 번쩍" };
  const newStep = () => ({ image: "", say: "", text: "", sound: "", fx: "", particles: "" });
  function seqForm(f, redraw, upd) {
    const cgNames = Object.keys(proj.cgs);
    const speakers = { "": "나레이션 (이름 없이)" };
    Object.values(proj.characters).forEach((c) => (speakers[c.name] = c.name));
    Object.keys(proj.nameColors).forEach((n) => (speakers[n] = n));
    const pOpts = { "": "없음" };
    Object.entries(PSHAPE).forEach(([v, t]) => (pOpts[v] = t));
    Object.keys(proj.effects).forEach((n) => (pOpts[n] = "🎨 " + n));
    const selOf = (val, opts, on) => h("select", { onchange: (e) => on(e.target.value) }, Object.entries(opts).map(([v, t]) => h("option", { value: v, selected: v === (val || "") }, t)));
    // 이 단계에서 화면에 보일 그림 (비워 두면 앞 단계 그림 그대로)
    const shownAt = (j) => { for (let k = j; k >= 0; k--) if (f.steps[k].image) return f.steps[k].image; return ""; };
    const cards = f.steps.map((st, j) => {
      const showing = shownAt(j);
      const ref = proj.cgs[showing];
      return h("div", { class: "opt-card seq-step" },
        h("div", { class: "row" },
          h("b", { style: { flex: 1 } }, `탭 ${j + 1}`),
          h("button", { class: "icon-btn", "aria-label": "위로", disabled: j === 0, onclick: () => { [f.steps[j - 1], f.steps[j]] = [f.steps[j], f.steps[j - 1]]; redraw(); } }, "▲"),
          h("button", { class: "icon-btn", "aria-label": "아래로", disabled: j === f.steps.length - 1, onclick: () => { [f.steps[j + 1], f.steps[j]] = [f.steps[j], f.steps[j + 1]]; redraw(); } }, "▼"),
          h("button", { class: "icon-btn", "aria-label": "복제", onclick: () => { f.steps.splice(j + 1, 0, clone(st)); redraw(); } }, "⧉"),
          f.steps.length > 1 ? h("button", { class: "icon-btn", "aria-label": "빼기", onclick: () => { f.steps.splice(j, 1); redraw(); } }, "✕") : null),
        h("span", { class: "hint", style: { marginTop: "-4px" } }, st.text ? "대사가 나오고, 탭하면 다음 단계로" : "그림만 보여주고, 탭하면 다음 단계로"),
        h("div", { class: "seq-top" },
          h("div", { class: "seq-thumb", style: { backgroundImage: ref ? `url("${imgSrc(ref)}")` : "" } }, ref ? null : h("span", {}, "그림 없음")),
          h("div", { style: { display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: 0 } },
            field("그림", selOf(st.image, Object.assign({ "": j === 0 ? "— 골라 주세요 —" : "앞 그림 그대로" }, Object.fromEntries(cgNames.map((n) => [n, n]))), (v) => { st.image = v; redraw(); })),
            imageInput({ kind: "cg", label: "🖼 새 그림 올리기" }, (r, file) => { const n = uniqueName(proj.cgs, fileBase(file, "CG")); proj.cgs[n] = r; st.image = n; changed({ render: false }); redraw(); }))),
        h("div", { class: "grid2" },
          field("말하는 사람", selOf(st.say, speakers, (v) => { st.say = v; upd(); })),
          field("효과음", selOf(st.sound, Object.assign({ "": "없음" }, Object.fromEntries(Object.keys(proj.sounds).map((n) => [n, "🔊 " + n]))), (v) => { st.sound = v; upd(); if (v) playTest(v); }))),
        field("대사 (비워 두면 그림만 보여주고 탭을 기다려요)", h("textarea", { value: st.text || "", placeholder: "예: 이 사진…… 기억나?", oninput: (e) => { st.text = e.target.value; upd(); } })),
        h("div", { class: "grid2" },
          field("효과", selOf(st.fx, SEQ_FX, (v) => { st.fx = v; upd(); })),
          field("입자 펑!", selOf(st.particles, pOpts, (v) => { st.particles = v; upd(); }))));
    });
    return [
      h("p", { class: "hint" }, "이벤트 그림을 여러 장 이어서 보여줘요. 플레이어가 탭할 때마다 다음 단계로 넘어가면서 그림이 부드럽게 바뀌고, 대사 · 효과음 · 효과가 나와요."),
      cgNames.length ? null : h("p", { class: "hint", style: { color: "var(--danger)" } }, "이벤트 그림이 아직 없어요. 아래 단계에서 바로 올리거나 [그림] 탭에서 올려 주세요."),
      h("div", { class: "grid2" },
        field("그림 맞추기", selOf(f.fit, { contain: "그림 전체 보이기", cover: "화면 꽉 채우기" }, (v) => { f.fit = v; upd(); })),
        field("다 보면", selOf(f.after, { hide: "그림을 치우고 계속", keep: "그림을 남겨 두고 계속" }, (v) => { f.after = v; upd(); }))),
      cards,
      h("button", { class: "btn dashed wide", onclick: () => { f.steps.push(newStep()); redraw(); } }, "+ 탭 하나 더 (다음 단계)"),
      Object.keys(proj.sounds).length ? null : h("details", { class: "lesson" }, h("summary", {}, "🔊 효과음 넣기"), h("p", {}, "효과음 파일을 올리면 위의 [효과음]에서 고를 수 있어요."), soundInput(null, () => redraw())),
      h("button", { class: "btn wide", onclick: () => previewBlock(fromForm("cgseq", f)) }, "▶ 이 블록만 미리보기"),
    ];
  }
  // 블록 하나만 테스트 플레이
  function previewBlock(block) {
    const P = clone(proj); P.title = (P.title || "") + " (테스트)";
    const bgName = Object.keys(proj.backgrounds)[0];
    // 블록이 끝나면 바로 엔딩 화면이 덮지 않게, 탭을 한 번 기다려요
    P.story = Object.assign({}, P.story, { __블록미리보기: [bgName ? { bg: bgName } : { wait: 1 }, block, { tap: true }, { end: "미리보기 끝" }] });
    const box = $("#player"); box.hidden = false;
    if (playerInst) playerInst.destroy();
    playerInst = VN.mount(box, P, { startScene: "__블록미리보기", onExit: stopPlay });
  }

  // ===== 🕺 캐릭터 움직임 · 🎵 배경음악 =====
  const MOTIONS = {
    "한 번": { hop: "🐇 깡총 뛰기", nod: "🙂 끄덕끄덕", shake: "🙅 도리도리", jolt: "😲 깜짝 놀라기", sway: "🤔 갸웃하기" },
    "계속 (멈출 때까지)": { tremble: "😨 덜덜 떨기", shiver: "🥶 부들부들 (빠르게)", breathe: "😌 숨 쉬기", float: "☁ 둥실둥실", stop: "⏹ 움직임 멈추기" },
    "자세 (그대로 유지)": { down: "⬇ 살짝 아래로", sink: "⏬ 많이 아래로 (주저앉기)", up: "⬆ 살짝 위로", closer: "🔍 다가오기", away: "↘ 멀어지기", tilt: "↙ 기울이기", fade: "👻 반투명", reset: "↺ 제자리로" },
  };
  const MOTION_NAME = Object.assign({}, ...Object.values(MOTIONS));
  function motionSelect(val, on, allowNone) {
    return h("select", { onchange: (e) => on(e.target.value) },
      allowNone ? h("option", { value: "", selected: !val }, "움직이지 않기") : null,
      Object.entries(MOTIONS).map(([g, ms]) => h("optgroup", { label: g }, Object.entries(ms).map(([v, t]) => h("option", { value: v, selected: v === val }, t)))));
  }
  // 캐릭터 움직임 미리보기 (실제 엔진)
  function motionPreview(charId, motion, face) {
    const stage = h("div", { class: "pfx-stage" });
    const box = h("div", { class: "pos-box motion-box" }, stage);
    let inst = null;
    const run = () => {
      if (inst) inst.destroy();
      if (!stage.isConnected) return;
      const bgName = Object.keys(proj.backgrounds)[0];
      const ids = charId === "all" ? Object.keys(proj.characters) : [charId];
      const pos = ids.length > 1 ? ["left", "right", "center"] : ["center"];
      const story = [bgName ? { bg: bgName } : { wait: 1 }, ...ids.map((id, i) => Object.assign({ show: id, pos: pos[i % pos.length] }, face ? { face } : {})), { wait: 500 }, { act: charId, motion }, { wait: 2000000000 }];
      inst = VN.mount(stage, { title: "__preview", start: "a", backgrounds: proj.backgrounds, images: proj.images, characters: proj.characters, story: { a: story } }, { startScene: "a", preview: true });
    };
    setTimeout(run, 60);
    return h("div", { class: "motion-prev" }, box, h("button", { class: "btn", style: { alignSelf: "flex-start", padding: "5px 10px", fontSize: "13px" }, onclick: (e) => { e.preventDefault(); run(); } }, "↻ 다시 보기"));
  }
  let bgmTest = null;
  function testBgm(name, vol) {
    if (bgmTest) { bgmTest.pause(); bgmTest = null; return toast("들어보기를 멈췄어요"); }
    const src = imgSrc(proj.sounds[name] || "");
    if (!src) return toast("없는 음악이에요");
    bgmTest = new Audio(src); bgmTest.loop = true; bgmTest.volume = Math.max(0, Math.min(1, vol == null ? 1 : +vol));
    const p = bgmTest.play(); if (p && p.catch) p.catch(() => toast("이 화면에서는 소리를 낼 수 없어요"));
    toast("한 번 더 누르면 멈춰요");
  }

  // ===== ⚡ 시그널 =====
  // 시그널은 story 안에 "⚡이름" 으로 저장되는 블록 묶음이에요. [시그널 보내기] · 선택지 · 자동 조건 · 게이지 표시점으로 보내요.
  const SIG = "⚡";
  const isSig = (n) => typeof n === "string" && n.startsWith(SIG);
  const sigNames = () => Object.keys(proj.story).filter(isSig).map((n) => n.slice(SIG.length));
  function signalSelect(val, on, emptyLabel) {
    const names = sigNames();
    return h("select", { onchange: (e) => on(e.target.value) },
      emptyLabel ? h("option", { value: "", selected: !val }, emptyLabel) : null,
      names.map((n) => h("option", { value: n, selected: n === val }, "⚡ " + n)),
      val && !names.includes(val) ? h("option", { value: val, selected: true }, `⚠ ${val} (없음)`) : null);
  }
  function signalUses(name) {
    let n = 0;
    eachBlock((b) => {
      if (!b || typeof b !== "object") return;
      if (b.signal === name) n++;
      if (b.choice) b.choice.forEach((o) => { if (o.signal === name) n++; });
    });
    n += (proj.watches || []).filter((w) => w.signal === name).length;
    Object.values(proj.gauges).forEach((g) => (g.markers || []).forEach((m) => { if (m.signal === name) n++; }));
    return n;
  }
  function renameSignal(from, to) {
    const S = {};
    for (const [k, l] of Object.entries(proj.story)) S[k === SIG + from ? SIG + to : k] = l;
    proj.story = S;
    eachBlock((b) => {
      if (!b || typeof b !== "object") return;
      if (b.signal === from) b.signal = to;
      if (b.choice) b.choice.forEach((o) => { if (o.signal === from) o.signal = to; });
    });
    (proj.watches || []).forEach((w) => { if (w.signal === from) w.signal = to; });
    Object.values(proj.gauges).forEach((g) => (g.markers || []).forEach((m) => { if (m.signal === from) m.signal = to; }));
  }
  function signalSheet(name) {
    const isNew = name == null;
    const nameIn = h("input", { type: "text", value: isNew ? "" : name, placeholder: "예: 호감도 최고, 깜짝 이벤트" });
    const err = h("p", { class: "hint", style: { color: "var(--danger)" } });
    // 이 시그널을 자동으로 보내는 조건들
    const conds = isNew ? [] : (proj.watches || []).filter((w) => w.signal === name).map((w) => Object.assign(parseCond(w.if), { once: !!w.once }));
    const condBox = h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } });
    const drawConds = () => {
      condBox.innerHTML = "";
      put(condBox,
        conds.map((c, j) => h("div", { class: "opt-card" },
          h("div", { class: "grid3" },
            field("변수", varsSelect(c.var, (v) => (c.var = v))),
            field("비교", h("select", { onchange: (e) => (c.op = e.target.value) }, [">=", ">", "==", "!=", "<=", "<"].map((x) => h("option", { value: x, selected: c.op === x }, x)))),
            field("값", h("input", { type: "text", value: c.val, oninput: (e) => (c.val = e.target.value) }))),
          h("div", { class: "row" },
            h("label", { class: "check", style: { flex: 1 } }, h("input", { type: "checkbox", checked: c.once, onchange: (e) => (c.once = e.target.checked) }), "처음 한 번만"),
            h("button", { class: "btn danger", style: { padding: "5px 10px" }, onclick: () => { conds.splice(j, 1); drawConds(); } }, "빼기")))),
        Object.keys(proj.vars).length
          ? h("button", { class: "btn dashed wide", onclick: () => { conds.push({ var: Object.keys(proj.vars)[0], op: ">=", val: "5", once: true }); drawConds(); } }, "+ 조건 추가")
          : h("p", { class: "hint" }, "변수가 없어요. [변수] 탭에서 만들면 조건을 넣을 수 있어요."));
    };
    drawConds();
    const foot = [h("button", { class: "btn primary grow", onclick: () => {
      const v = nameIn.value.trim();
      if (!v) return (err.textContent = "이름을 써 주세요.");
      if (v !== name && proj.story[SIG + v]) return (err.textContent = "같은 이름의 시그널이 있어요.");
      if (isNew) proj.story[SIG + v] = [];
      else if (v !== name) renameSignal(name, v);
      proj.watches = (proj.watches || []).filter((w) => w.signal !== v && w.signal !== name);
      conds.filter((c) => c.var).forEach((c) => proj.watches.push(Object.assign({ if: `${c.var} ${c.op} ${c.val}`, signal: v }, c.once ? { once: true } : {})));
      scene = SIG + v; closeSheet(); changed();
    } }, isNew ? "만들기" : "저장")];
    if (!isNew) {
      const del = h("button", { class: "btn danger", onclick: () => {
        if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "정말 삭제"; return; }
        delete proj.story[SIG + name];
        proj.watches = (proj.watches || []).filter((w) => w.signal !== name);
        scene = proj.start; closeSheet(); changed();
      } }, "삭제");
      foot.push(del);
    }
    openSheet(isNew ? "⚡ 새 시그널" : "⚡ 시그널 설정", [
      h("p", { class: "hint" }, "시그널은 이름 붙인 블록 묶음이에요. 시그널을 보내면 그 블록들이 실행되고, 다 끝나면 보낸 곳으로 돌아가서 이야기가 이어져요."),
      field("시그널 이름", nameIn), err,
      h("b", {}, "언제 자동으로 보낼까요? (선택)"),
      h("p", { class: "hint" }, "조건이 맞게 되는 순간 저절로 보내요. 예: 호감도가 5 이상이 되는 순간. 그 밖에 [시그널 보내기] 블록, 선택지, 게이지 표시점에서도 보낼 수 있어요."),
      condBox,
      isNew ? null : h("p", { class: "hint" }, `이 시그널을 보내는 곳: ${signalUses(name)}곳`),
    ], foot);
  }

  // ===== 🔀 장면 나누기 · 분기 만들기 · 장면 지도 =====
  function uniqueScene(base) { let n = base, i = 2; while (proj.story[n]) n = `${base} ${i++}`; return n; }

  // 이 블록부터 끝까지를 새 장면으로 옮기고, 원래 장면 끝에 "장면 이동"을 넣어요
  function splitSheet(list, i) {
    const nameIn = h("input", { type: "text", value: uniqueScene(`${scene} (이어서)`) });
    const err = h("p", { class: "hint", style: { color: "var(--danger)" } });
    openSheet("✂ 여기서 장면 나누기", [
      h("p", { class: "hint" }, `「${scene}」의 ${i + 1}번 블록부터 끝까지(${list.length - i}개)를 새 장면으로 옮겨요. 원래 장면 끝에는 새 장면으로 가는 [장면 이동]이 들어가서 플레이는 그대로예요.`),
      field("새 장면 이름", nameIn), err,
    ], [h("button", { class: "btn primary grow", onclick: () => {
      const v = nameIn.value.trim();
      if (!v) return (err.textContent = "이름을 써 주세요.");
      if (proj.story[v]) return (err.textContent = "같은 이름의 장면이 있어요.");
      proj.story[v] = list.splice(i);
      list.push({ goto: v });
      flashKey = String(list.length - 1);
      closeSheet(); changed(); toast(`「${v}」 장면을 만들었어요`);
    } }, "나누기")]);
  }

  // 장면의 마지막 블록이 이미 다른 곳으로 보내는 블록인지 (그 뒤에 넣으면 실행되지 않아요)
  function closingLast(list) {
    const b = list[list.length - 1];
    if (b === undefined || isGroup(b)) return null;
    const k = kindOf(b), f = toForm(b);
    const closed = k === "goto" || k === "end" || (k === "if" && f.else) || (k === "choice" && f.options.every((o) => o.goto));
    return closed ? b : null;
  }
  function branchSheet(mode) {
    mode = mode || "choice";
    const last = closingLast(proj.story[scene]);
    const replace = { on: !!last };
    const replaceBox = last ? h("label", { class: "check warn-check" }, h("input", { type: "checkbox", checked: true, onchange: (e) => (replace.on = e.target.checked) }),
      `이 장면은 마지막 블록(${inlineCode(last).slice(0, 60)})에서 다른 곳으로 넘어가요. 그 블록을 지우고 그 자리에 넣을게요.`) : null;
    const tabs = h("div", { class: "chips" },
      h("button", { class: "chip" + (mode === "choice" ? " on" : ""), onclick: () => branchSheet("choice") }, "🔀 선택지로 나누기"),
      h("button", { class: "chip" + (mode === "ending" ? " on" : ""), onclick: () => branchSheet("ending") }, "🏁 변수로 엔딩 나누기"));
    const err = h("p", { class: "hint", style: { color: "var(--danger)" } });
    const others = Object.keys(proj.story);
    if (mode === "choice") {
      const st = { lead: "", opts: [0, 1].map((k) => ({ text: "", name: uniqueScene(`${scene}-${"ABCD"[k]}`), after: "later", ending: "" })) };
      const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } });
      const draw = () => {
        body.innerHTML = "";
        put(body,
          field("선택지 앞에 나올 말 (선택)", h("input", { type: "text", value: st.lead, placeholder: "예: 어떻게 대답할까?", oninput: (e) => (st.lead = e.target.value) })),
          st.opts.map((o, j) => h("div", { class: "opt-card" },
            h("div", { class: "row" }, h("b", { style: { flex: "none" } }, `갈래 ${"ABCD"[j]}`),
              st.opts.length > 2 ? h("button", { class: "btn danger", style: { flex: "none", marginLeft: "auto", padding: "5px 10px" }, onclick: () => { st.opts.splice(j, 1); draw(); } }, "빼기") : null),
            h("input", { type: "text", value: o.text, placeholder: "플레이어가 볼 선택지", oninput: (e) => (o.text = e.target.value) }),
            field("새로 만들 장면 이름", h("input", { type: "text", value: o.name, oninput: (e) => (o.name = e.target.value) })),
            field("그 장면이 끝나면", h("select", { onchange: (e) => { o.after = e.target.value; draw(); } },
              h("option", { value: "later", selected: o.after === "later" }, "나중에 정할게요"),
              h("option", { value: "end", selected: o.after === "end" }, "🏁 엔딩으로 끝내기"),
              others.map((n) => h("option", { value: "goto:" + n, selected: o.after === "goto:" + n }, `「${n}」 장면으로 합치기`)))),
            o.after === "end" ? field("엔딩 이름", h("input", { type: "text", value: o.ending, placeholder: `예: ${"ABCD"[j]} 엔딩`, oninput: (e) => (o.ending = e.target.value) })) : null)),
          st.opts.length < 4 ? h("button", { class: "btn dashed wide", onclick: () => { st.opts.push({ text: "", name: uniqueScene(`${scene}-${"ABCD"[st.opts.length]}`), after: "later", ending: "" }); draw(); } }, "+ 갈래 추가") : null);
      };
      draw();
      openSheet("분기 만들기", [tabs, h("p", { class: "hint" }, `「${scene}」 끝에 선택지를 넣고, 고른 것마다 새 장면을 만들어 연결해요.`), replaceBox, body, err], [h("button", { class: "btn primary grow", onclick: () => {
        const names = st.opts.map((o) => o.name.trim());
        if (names.some((n) => !n)) return (err.textContent = "장면 이름을 모두 써 주세요.");
        if (new Set(names).size !== names.length || names.some((n) => proj.story[n])) return (err.textContent = "장면 이름이 겹쳐요. 다른 이름을 써 주세요.");
        const list = proj.story[scene];
        if (last && replace.on) list.pop();
        if (st.lead.trim()) list.push(st.lead.trim());
        list.push({ choice: st.opts.map((o, j) => ({ text: o.text.trim() || `선택지 ${"ABCD"[j]}`, goto: names[j] })) });
        st.opts.forEach((o, j) => {
          const l = ["(여기에 이 길의 이야기를 써 주세요)"];
          if (o.after === "end") l.push({ end: o.ending.trim() || `${names[j]} 엔딩` });
          else if (o.after.startsWith("goto:")) l.push({ goto: o.after.slice(5) });
          proj.story[names[j]] = l;
        });
        flashKey = String(list.length - 1);
        closeSheet(); changed(); toast(`장면 ${names.length}개를 만들어 연결했어요. 🗺 지도에서 볼 수 있어요`);
      } }, "만들기")]);
      return;
    }
    // 변수로 엔딩 나누기
    const vars = Object.keys(proj.vars);
    const st = { var: vars[0] || "", rules: [{ op: ">=", val: "3", name: "행복한 엔딩" }, { op: ">=", val: "1", name: "보통 엔딩" }], other: "쓸쓸한 엔딩" };
    const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } });
    const draw = () => {
      body.innerHTML = "";
      put(body,
        vars.length ? null : h("p", { class: "hint", style: { color: "var(--danger)" } }, "변수가 없어요. [변수] 탭에서 먼저 만들어 주세요 (예: 호감도)."),
        field("어떤 변수로 나눌까요?", varsSelect(st.var, (v) => (st.var = v))),
        h("p", { class: "hint" }, "위에서부터 차례로 확인해서 처음 맞는 엔딩으로 가요."),
        st.rules.map((r, j) => h("div", { class: "opt-card" },
          h("div", { class: "grid3" },
            field(j ? "아니고 만약" : "만약", h("select", { onchange: (e) => (r.op = e.target.value) }, [">=", ">", "==", "<=", "<", "!="].map((x) => h("option", { value: x, selected: r.op === x }, `${st.var || "변수"} ${x}`)))),
            field("값", h("input", { type: "text", value: r.val, oninput: (e) => (r.val = e.target.value) })),
            field("엔딩 이름", h("input", { type: "text", value: r.name, oninput: (e) => (r.name = e.target.value) }))),
          st.rules.length > 1 ? h("button", { class: "btn danger", style: { alignSelf: "flex-end", padding: "5px 10px" }, onclick: () => { st.rules.splice(j, 1); draw(); } }, "빼기") : null)),
        st.rules.length < 5 ? h("button", { class: "btn dashed wide", onclick: () => { st.rules.push({ op: ">=", val: "0", name: `엔딩 ${st.rules.length + 2}` }); draw(); } }, "+ 엔딩 추가") : null,
        field("어디에도 안 맞으면", h("input", { type: "text", value: st.other, oninput: (e) => (st.other = e.target.value) })));
    };
    draw();
    openSheet("분기 만들기", [tabs, h("p", { class: "hint" }, `「${scene}」 끝에 조건 분기를 넣고, 엔딩마다 장면을 하나씩 만들어요.`), replaceBox, body, err], [h("button", { class: "btn primary grow", onclick: () => {
      if (!st.var) return (err.textContent = "변수를 골라 주세요.");
      const ends = [...st.rules.map((r) => r.name.trim()), st.other.trim()];
      if (ends.some((n) => !n)) return (err.textContent = "엔딩 이름을 모두 써 주세요.");
      const names = ends.map((n) => n);
      if (new Set(names).size !== names.length) return (err.textContent = "엔딩 이름이 겹쳐요.");
      const sceneNames = []; const taken = new Set();
      names.forEach((n) => { let s = uniqueScene(n); while (taken.has(s)) s = uniqueScene(s + " "); taken.add(s); sceneNames.push(s); });
      const list = proj.story[scene];
      if (last && replace.on) list.pop();
      st.rules.forEach((r, j) => list.push({ if: `${st.var} ${r.op} ${r.val}`, goto: sceneNames[j] }));
      list.push({ goto: sceneNames[sceneNames.length - 1] });
      names.forEach((n, j) => (proj.story[sceneNames[j]] = ["(여기에 엔딩 이야기를 써 주세요)", { end: n }]));
      flashKey = String(list.length - 1);
      closeSheet(); changed(); toast(`엔딩 장면 ${names.length}개를 만들었어요. 🗺 지도에서 볼 수 있어요`);
    } }, "만들기")]);
  }

  // 장면에서 나가는 길 모으기
  function sceneLinks(list) {
    const out = [], endings = [];
    walk(list, (b) => {
      if (!b || typeof b !== "object") return;
      const k = kindOf(b);
      if (k === "goto") out.push({ to: b.goto, label: "" });
      if (k === "if") { out.push({ to: b.goto, label: `${b.if}` }); if (b.else) out.push({ to: b.else, label: "아니면" }); }
      if (k === "choice") b.choice.forEach((o) => o.goto && out.push({ to: o.goto, label: `▸ ${o.text}` }));
      if (k === "minigame") { if (b.goto) out.push({ to: b.goto, label: "🎮 끝나면" }); (b.objects || []).forEach((o) => o.goto && out.push({ to: o.goto, label: `🎮 ${o.name}` })); }
      if (k === "end") endings.push(b.end || "THE END");
    });
    return { out, endings };
  }
  function renderMap(w) {
    const S = proj.story, names = Object.keys(S).filter((n) => !isSig(n));
    const info = Object.fromEntries(names.map((n) => [n, sceneLinks(S[n])]));
    // 시작 장면에서부터 몇 번 만에 닿는지로 줄을 나눠요
    const level = {}; const q = [proj.start]; if (S[proj.start]) level[proj.start] = 0;
    while (q.length) { const n = q.shift(); for (const e of info[n].out) if (S[e.to] && level[e.to] === undefined) { level[e.to] = level[n] + 1; q.push(e.to); } }
    const rows = [];
    names.forEach((n) => { const l = level[n] === undefined ? -1 : level[n]; (rows[l < 0 ? 999 : l] = rows[l < 0 ? 999 : l] || []).push(n); });
    const total = names.reduce((a, n) => a + info[n].endings.length, 0);
    w.append(h("div", { class: "row" },
      h("button", { class: "btn", onclick: () => { mapMode = false; render(); } }, "← 블록 목록으로"),
      h("span", { class: "hint" }, `장면 ${names.length}개 · 엔딩 ${total}개`)));
    const box = h("div", { class: "map" });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "map-lines");
    box.append(svg);
    const cards = {};
    rows.forEach((r, li) => {
      if (!r) return;
      const row = h("div", { class: "map-row" }, li === 999 ? h("div", { class: "map-row-label" }, "⚠ 시작에서 닿지 않는 장면") : null);
      r.forEach((n) => {
        const inf = info[n];
        const card = h("button", { class: "map-card" + (n === proj.start ? " start" : "") + (inf.endings.length ? " ending" : "") + (li === 999 ? " lost" : ""),
          onclick: () => { scene = n; mapMode = false; render(); } },
          h("b", {}, (n === proj.start ? "⭐ " : "") + n),
          h("small", {}, `블록 ${flatList(S[n]).length}개${proj.memories.some((m) => m.scene === n) ? " · 🎞" : ""}`),
          inf.endings.map((e) => h("span", { class: "map-end" }, "🏁 " + e)),
          !inf.out.length && !inf.endings.length ? h("span", { class: "map-warn" }, "끝이 정해지지 않았어요") : null,
          inf.out.filter((e) => !S[e.to]).map((e) => h("span", { class: "map-warn" }, `없는 장면 → ${e.to}`)));
        cards[n] = card; row.append(card);
      });
      box.append(row);
    });
    w.append(box, h("p", { class: "hint" }, "장면을 누르면 그 장면을 편집해요. 선은 장면 이동 · 선택지 · 조건 분기로 이어진 길이에요."));
    // 화면에 놓인 뒤 선 그리기
    requestAnimationFrame(() => {
      const br = box.getBoundingClientRect();
      svg.setAttribute("width", br.width); svg.setAttribute("height", br.height);
      const NS = "http://www.w3.org/2000/svg";
      const defs = document.createElementNS(NS, "defs");
      defs.innerHTML = '<marker id="map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="map-arrowhead"/></marker>';
      svg.append(defs);
      for (const [n, inf] of Object.entries(info)) {
        const seen = new Set();
        for (const e of inf.out) {
          if (!cards[e.to] || seen.has(e.to)) continue; seen.add(e.to);
          const a = cards[n].getBoundingClientRect(), b = cards[e.to].getBoundingClientRect();
          const x1 = a.left + a.width / 2 - br.left, y1 = a.bottom - br.top;
          const x2 = b.left + b.width / 2 - br.left, y2 = b.top - br.top;
          const back = y2 <= y1;
          const p = document.createElementNS(NS, "path");
          const d = back
            ? `M${a.right - br.left},${a.top + a.height / 2 - br.top} C${a.right - br.left + 40},${a.top - br.top} ${b.right - br.left + 40},${b.bottom - br.top} ${b.right - br.left},${b.top + b.height / 2 - br.top}`
            : `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
          p.setAttribute("d", d); p.setAttribute("class", "map-line" + (back ? " back" : "")); p.setAttribute("marker-end", "url(#map-arrow)");
          svg.append(p);
        }
      }
    });
  }

  function scenesSelect(val, on, allowEmpty) {
    return h("select", { onchange: (e) => on(e.target.value) },
      allowEmpty ? h("option", { value: "", selected: !val }, allowEmpty) : null,
      Object.keys(proj.story).filter((n) => !isSig(n)).map((n) => h("option", { value: n, selected: n === val }, n)),
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
          cid ? field("말하면서 움직이기", motionSelect(f.act, (v) => { f.act = v; upd(); }, true)) : null,
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
        const isCustom = PCOLOR[f.shape] === undefined && f.shape !== "off";
        const myFx = Object.keys(proj.effects);
        const parts = [field("모양", h("select", { onchange: (e) => {
            if (e.target.value === "__new") return effectSheet(null, (name) => blockSheetAgain(name));
            const old = f.shape; f.shape = e.target.value; if (PCOLOR[f.shape] && f.color.toLowerCase() === (PCOLOR[old] || "").toLowerCase()) f.color = PCOLOR[f.shape]; redraw(); } },
          h("optgroup", { label: "기본 효과" }, Object.entries(PSHAPE).map(([v, t]) => h("option", { value: v, selected: v === f.shape }, t))),
          h("optgroup", { label: "🎨 내 효과" }, myFx.map((n) => h("option", { value: n, selected: n === f.shape }, "🎨 " + n)),
            isCustom && !proj.effects[f.shape] ? h("option", { value: f.shape, selected: true }, `⚠ ${f.shape} (없는 효과)`) : null,
            h("option", { value: "__new" }, "＋ 새 효과 만들기…")),
          h("option", { value: "off", selected: f.shape === "off" }, "⏹ 입자 효과 끄기"))),
          isCustom && proj.effects[f.shape] ? h("button", { class: "btn", style: { alignSelf: "flex-start" }, onclick: () => effectSheet(f.shape, (name) => blockSheetAgain(name)) }, `🎨 「${f.shape}」 효과 고치기`) : null];
        if (f.shape === "off") {
          f._preview = null;
          const offOpts = { "": "계속 나오는 효과 모두" };
          Object.entries(PSHAPE).forEach(([v, t]) => (offOpts[v] = t));
          myFx.forEach((n) => (offOpts[n] = "🎨 " + n));
          return [...parts, field("어떤 효과를 끌까요?", sel("only", offOpts)),
            h("p", { class: "hint" }, "계속 나오는 효과는 여러 개를 같이 켤 수 있어요 (예: 비 + 안개). 이미 나온 입자는 자연스럽게 사라져요.")];
        }
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
          const P = { title: "__preview", start: "a", backgrounds: proj.backgrounds, images: proj.images, items: proj.items, effects: proj.effects,
            story: { a: [bgName ? { bg: bgName } : { wait: 1 }, fromForm("particles", f), { wait: 2000000000 }] } };
          inst = VN.mount(stage, P, { startScene: "a", preview: true });
        };
        parts.push(
          field("나오는 방식", sel("mode", PMODE, true)),
          h("label", { class: "f" }, point ? "미리보기 — 누른 곳에서 나와요" : "미리보기", box, h("div", { class: "row" }, posTxt,
            h("button", { class: "btn", style: { marginLeft: "auto", padding: "5px 10px", fontSize: "13px" }, onclick: (e) => { e.preventDefault(); f._preview && f._preview(); } }, "↻ 다시 보기"))),
          h("label", { class: "f" }, "🧭 나오는 방향", dirPicker(f, upd, true)),
          h("div", { class: "row" },
            isCustom ? null : h("label", { class: "f", style: { flex: "none" } }, "색", h("input", { type: "color", value: f.color, oninput: (e) => { f.color = e.target.value; if (dot) dot.style.background = f.color; upd(); } })),
            isCustom ? null : h("button", { class: "btn", style: { alignSelf: "flex-end" }, onclick: () => { f.color = PCOLOR[f.shape]; redraw(); } }, "기본 색"),
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
      case "sound": {
        const opts = Object.fromEntries(Object.keys(proj.sounds).map((n) => [n, "🔊 " + n]));
        const volTxt = h("span", {}, `소리 크기 ${Math.round((+f.volume || 0) * 100)}%`);
        return [
          Object.keys(opts).length ? field("효과음", sel("sound", opts)) : h("p", { class: "hint" }, "효과음이 아직 없어요. 아래에서 소리 파일을 올려 주세요."),
          soundInput(null, (n) => { f.sound = n; redraw(); }),
          h("label", { class: "f" }, volTxt, h("input", { type: "range", min: "0.05", max: "1", step: "0.05", value: f.volume, oninput: (e) => { f.volume = +e.target.value; volTxt.textContent = `소리 크기 ${Math.round(f.volume * 100)}%`; upd(); } })),
          f.sound ? h("button", { class: "btn", onclick: () => playTest(f.sound, f.volume) }, "▶ 들어보기") : null,
          h("p", { class: "hint" }, "소리는 플레이어가 화면을 한 번 누른 뒤부터 나와요 (휴대폰 정책). 설정에서 효과음 크기를 바꿀 수 있어요."),
        ];
      }
      case "cgseq": return seqForm(f, redraw, upd);
      case "signal": return [
        sigNames().length ? field("보낼 시그널", signalSelect(f.name, (v) => { f.name = v; upd(); })) : h("p", { class: "hint" }, "시그널이 아직 없어요. 스토리 탭 위의 [⚡ 새 시그널]로 먼저 만들어 주세요."),
        h("p", { class: "hint" }, "이 블록에 오면 시그널의 블록들이 실행되고, 다 끝나면 이 블록 다음으로 이어져요. 여러 장면에서 똑같이 쓰는 연출을 한 번만 만들어 두고 불러 쓸 때 좋아요."),
      ];
      case "bgm": {
        const opts = { "": "⏹ 음악 끄기" };
        Object.keys(proj.sounds).forEach((n) => (opts[n] = "🎵 " + n));
        const volTxt = h("span", {}, `음악 크기 ${Math.round((+f.volume || 0) * 100)}%`);
        const fadeTxt = h("span", {}, `서서히 바뀌는 시간 ${(+f.fade || 0).toFixed(1)}초`);
        return [
          field("음악", sel("bgm", opts, true)),
          soundInput("🎵 음악 파일 올리기 (mp3 권장)", (n) => { f.bgm = n; redraw(); }),
          f.bgm ? h("label", { class: "f" }, volTxt, h("input", { type: "range", min: "0.05", max: "1", step: "0.05", value: f.volume, oninput: (e) => { f.volume = +e.target.value; volTxt.textContent = `음악 크기 ${Math.round(f.volume * 100)}%`; upd(); } })) : null,
          h("label", { class: "f" }, fadeTxt, h("input", { type: "range", min: "0", max: "5", step: "0.5", value: f.fade, oninput: (e) => { f.fade = +e.target.value; fadeTxt.textContent = `서서히 바뀌는 시간 ${f.fade.toFixed(1)}초`; upd(); } })),
          f.bgm ? h("button", { class: "btn", onclick: () => testBgm(f.bgm, f.volume) }, "▶ 들어보기 / ⏹ 멈추기") : null,
          h("p", { class: "hint" }, "음악은 반복해서 계속 나와요. 다른 음악을 틀면 서서히 바뀌고, '음악 끄기'로 멈춰요. 저장하고 불러와도 그때 음악이 다시 나와요. 플레이어는 설정에서 배경음악 크기를 따로 바꿀 수 있어요."),
        ];
      }
      case "act": {
        if (!Object.keys(proj.characters).length) return [h("p", { class: "hint" }, "캐릭터가 아직 없어요. [그림] 탭에서 캐릭터를 만들어 주세요.")];
        const chars = Object.assign({}, Object.fromEntries(Object.entries(proj.characters).map(([id, c]) => [id, c.name])), { all: "화면의 모든 캐릭터" });
        return [
          h("div", { class: "grid2" }, field("누가?", sel("id", chars, true)), field("어떻게?", motionSelect(f.motion, (v) => { f.motion = v; redraw(); }))),
          motionPreview(f.id, f.motion),
          h("p", { class: "hint" }, "· 한 번: 그 자리에서 한 번 움직여요.  · 계속: '움직임 멈추기'나 '제자리로'를 넣을 때까지 계속해요.  · 자세: '제자리로'를 넣을 때까지 그 자세로 있어요. 캐릭터가 화면에 나와 있어야 움직여요."),
        ];
      }
      case "gauge": {
        const names = Object.keys(proj.gauges);
        if (!names.length) return [h("p", { class: "hint" }, "게이지가 아직 없어요. [변수] 탭에서 숫자 변수의 '📊 게이지로 보여주기'를 켜 주세요.")];
        const opts = { all: "모든 게이지" }; names.forEach((n) => (opts[n] = `${proj.gauges[n].icon || "📊"} ${proj.gauges[n].label || n}`));
        return [
          field("어떤 게이지?", sel("name", opts)),
          field("어떻게?", h("select", { onchange: (e) => { f.show = e.target.value === "show"; upd(); } },
            h("option", { value: "show", selected: f.show }, "보이기"), h("option", { value: "hide", selected: !f.show }, "숨기기"))),
          h("p", { class: "hint" }, "'항상 보이기'로 설정한 게이지는 이 블록 없이도 늘 보여요. 게이지는 변수 값이 바뀔 때마다 차오르거나 줄어들어요."),
        ];
      }
      case "tint": return [field("화면 색감", sel("tint", TINTS)), h("p", { class: "hint" }, "배경과 캐릭터의 색을 바꿔요. 대사 창은 그대로예요. 되돌리려면 '원래대로'를 넣어 주세요.")];
      case "varimg": {
        const targets = { pic: "🧩 화면 위 그림 (위치 자유)", bg: "배경", cg: "이벤트 그림" };
        Object.entries(proj.characters).forEach(([id, c]) => (targets[id] = `${c.name}의 표정`));
        const imgs = imageChoices(f.target);
        const isPic = f.target === "pic";
        const refOf = (val) => f.target === "pic" ? proj.pics[val] : f.target === "bg" ? proj.backgrounds[val] : f.target === "cg" ? proj.cgs[val] : ((proj.characters[f.target] || {}).faces || {})[val];
        const imgSel = (val, on) => h("select", { onchange: (e) => { on(e.target.value); redraw(); } },
          Object.entries(imgs).map(([v, t]) => h("option", { value: v, selected: v === val }, t)),
          val && !(val in imgs) ? h("option", { value: val, selected: true }, `⚠ ${val}`) : null);
        const preview = (val) => {
          const ref = refOf(val);
          return ref ? h("div", { class: "face-row", style: { gridTemplateColumns: "64px 1fr" } }, h("div", { class: "pic", style: { backgroundImage: `url("${imgSrc(ref)}")` } }), h("span", { class: "hint" }, val)) : null;
        };
        const parts = [
          h("p", { class: "hint" }, "변수 값에 따라 다른 그림을 보여줘요. 위 조건부터 차례로 확인해서 처음 맞는 조건의 그림을 써요."),
          noVarsHint(),
          field("무엇을 바꿀까요?", h("select", { onchange: (e) => {
            f.target = e.target.value; const first = Object.keys(imageChoices(f.target)).find((x) => x) || "";
            f.cases.forEach((c) => (c.image = first)); if (f.else !== "__keep") f.else = first; redraw();
          } }, Object.entries(targets).map(([v, t]) => h("option", { value: v, selected: v === f.target }, t)))),
          isPic ? imageInput({ kind: "sprite", label: "🧩 변수 그림 올리기 (흰 배경 자동 지움)", white: () => f._white !== false }, (ref, file) => {
            const n = uniqueName(proj.pics, fileBase(file, "그림")); proj.pics[n] = ref; changed({ render: false });
            const empty = f.cases.find((c) => !c.image); if (empty) empty.image = n; else if (!f.cases.length) f.else = n;
            redraw();
          }) : null,
          isPic ? h("label", { class: "check" }, h("input", { type: "checkbox", checked: f._white !== false, onchange: (e) => (f._white = e.target.checked) }), "올릴 때 흰 배경 지우기") : null,
          !Object.keys(imgs).filter((x) => x).length ? h("p", { class: "hint", style: { color: "var(--danger)" } }, isPic ? "변수 그림이 아직 없어요. 위 버튼으로 올리거나 [그림] 탭 → 🧩 변수 그림에서 올려 주세요." : "고를 그림이 없어요. [그림] 탭에서 먼저 올려 주세요.") : null,
          f.target === "cg" ? field("맞추기", sel("fit", { contain: "그림 전체 보이기", cover: "화면 꽉 채우기" })) : null,
          f.cases.map((c, j) => h("div", { class: "opt-card" },
            h("div", { class: "row" }, h("b", { style: { flex: "none" } }, j === 0 ? "만약" : "아니고 만약"),
              h("button", { class: "btn danger", style: { flex: "none", marginLeft: "auto", padding: "5px 10px" }, onclick: () => { f.cases.splice(j, 1); redraw(); } }, "빼기")),
            h("div", { class: "grid3" },
              field("변수", varsSelect(c.var, (v) => { c.var = v; upd(); })),
              field("비교", h("select", { onchange: (e) => { c.op = e.target.value; upd(); } }, [">=", "<=", ">", "<", "==", "!="].map((x) => h("option", { value: x, selected: c.op === x }, x)))),
              field("값", h("input", { type: "text", value: c.val, oninput: (e) => { c.val = e.target.value; upd(); } }))),
            field("이면 이 그림", imgSel(c.image, (v) => { c.image = v; f._pv = v; })), preview(c.image))),
          h("button", { class: "btn dashed wide", onclick: () => { f.cases.push({ var: Object.keys(proj.vars)[0] || "", op: ">=", val: "1", image: Object.keys(imgs).find((x) => x) || "" }); redraw(); } }, "+ 조건 추가"),
          field("어느 조건에도 안 맞으면", h("select", { onchange: (e) => { f.else = e.target.value; redraw(); } },
            h("option", { value: "__keep", selected: f.else === "__keep" }, "그대로 두기"),
            Object.entries(imgs).map(([v, t]) => h("option", { value: v, selected: v === f.else }, t)))),
          f.else !== "__keep" ? preview(f.else) : null,
        ];
        if (isPic) {
          // 🧩 어디에 나올지: 미리보기 화면을 눌러서(끌어서) 위치, 슬라이더로 크기
          const shown = f._pv || (f.cases.find((c) => c.image) || {}).image || (f.else !== "__keep" ? f.else : "");
          const bgRef = proj.backgrounds[proj.titleBg] || Object.values(proj.backgrounds)[0];
          const pv = h("img", { class: "pic-pv", alt: "", src: shown && proj.pics[shown] ? imgSrc(proj.pics[shown]) : "", style: { left: f.x + "%", top: f.y + "%", width: f.w + "%" } });
          const box = h("div", { class: "pos-box pic-box" + (f._portrait ? " portrait" : ""), style: { backgroundImage: bgRef ? `url("${imgSrc(bgRef)}")` : "" } },
            h("div", { class: "pic-box-text" }), pv);
          const posTxt = h("span", { class: "hint" });
          const showPos = () => (posTxt.textContent = `가로 ${Math.round(f.x)}% · 세로 ${Math.round(f.y)}% · 너비 ${f.w}%`);
          const setFrom = (ev) => {
            const r = box.getBoundingClientRect();
            f.x = Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100)); f.y = Math.max(0, Math.min(100, ((ev.clientY - r.top) / r.height) * 100));
            pv.style.left = f.x + "%"; pv.style.top = f.y + "%"; showPos(); upd();
          };
          box.addEventListener("pointerdown", (ev) => { box.setPointerCapture(ev.pointerId); setFrom(ev); });
          box.addEventListener("pointermove", (ev) => { if (ev.buttons || ev.pointerType === "touch") setFrom(ev); });
          showPos();
          const wTxt = h("span", {}, `크기 (화면 너비의 ${f.w}%)`);
          const slots = new Set(["그림"]);
          eachBlock((b) => { if (b && b.varImage === "pic" && b.slot) slots.add(b.slot); });
          const presets = { "왼쪽 위": [14, 18], "가운데 위": [50, 16], "오른쪽 위": [86, 18], "가운데": [50, 45], "왼쪽": [18, 50], "오른쪽": [82, 50], "대사창 위": [50, 66] };
          parts.push(
            h("b", { class: "fx-sec" }, "🧩 어디에 나올까요?"),
            h("div", { class: "chips" },
              h("button", { class: "chip" + (f._portrait ? "" : " on"), onclick: () => { f._portrait = false; redraw(); } }, "가로 화면으로 보기"),
              h("button", { class: "chip" + (f._portrait ? " on" : ""), onclick: () => { f._portrait = true; redraw(); } }, "세로 화면으로 보기")),
            h("label", { class: "f" }, "미리보기 — 누르거나 끌어서 위치를 정해요 (그림 가운데 기준)", box, posTxt),
            h("div", { class: "row" }, Object.entries(presets).map(([t, [x, y]]) => h("button", { class: "btn", style: { padding: "6px 10px", fontSize: "13px" }, onclick: () => { f.x = x; f.y = y; redraw(); } }, t))),
            h("label", { class: "f" }, wTxt, h("input", { type: "range", min: "3", max: "100", step: "1", value: f.w, oninput: (e) => { f.w = +e.target.value; pv.style.width = f.w + "%"; wTxt.textContent = `크기 (화면 너비의 ${f.w}%)`; showPos(); upd(); } })),
            h("div", { class: "grid3" },
              field("층", sel("layer", { back: "캐릭터 뒤", front: "캐릭터 앞", top: "맨 앞 (대사창 위)" })),
              field("나타나기", sel("anim", { fade: "서서히", pop: "톡 튀어나오기", drop: "위에서 떨어지기", slide: "옆에서 밀려오기", none: "바로" })),
              field("자리 이름", h("input", { type: "text", value: f.slot, list: "pic-slots", placeholder: "그림", oninput: (e) => { f.slot = e.target.value.trim() || "그림"; upd(); } }))),
            h("datalist", { id: "pic-slots" }, [...slots].map((n) => h("option", { value: n }))),
            h("p", { class: "hint" }, "같은 '자리 이름'을 쓰는 블록끼리는 그림이 바뀌고, 다른 이름이면 여러 그림이 같이 떠 있어요. 그림을 치우려면 '숨기기'를 고르세요."),
            h("button", { class: "btn wide", onclick: () => previewBlock(fromForm("varimg", f)) }, "▶ 이 블록만 미리보기"));
        }
        return parts;
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
          field("보일 조건 (선택, 예: 호감도 >= 2)", h("input", { type: "text", value: o.if || "", placeholder: "비워 두면 항상 보여요", oninput: (e) => { o.if = e.target.value.trim(); upd(); } })),
          sigNames().length ? field("고르면 시그널 보내기 (선택)", signalSelect(o.signal, (v) => { o.signal = v; upd(); }, "안 보냄")) : null
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
      if (isSig(v)) { err.textContent = "장면 이름은 ⚡ 로 시작할 수 없어요 (시그널용이에요)."; return; }
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
    w.append(h("div", { class: "card inbox-card" },
      h("b", {}, "📥 보관함"),
      h("p", { class: "hint" }, "사진첩이 안 열리면, 그림이나 소리를 이 채팅으로 Claude 에게 보내 주세요. 보관함에 넣어 드리면 어느 [사진첩에서 고르기] 옆에서든 [📥 보관함에서 고르기]로 가져올 수 있어요."),
      inboxPicker("image", () => toast("그림을 넣을 곳(배경 · 캐릭터 · 이벤트 그림 …)에서 [📥 보관함에서 고르기]를 눌러 주세요"))));
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

    w.append(h("h3", { class: "sec" }, "🔊 소리 (효과음 · 배경음악)"),
      h("p", { class: "hint" }, "소리 파일(mp3 · wav · ogg)을 올리면 [효과음] · [배경음악] 블록과 [CG 넘기기]에서 쓸 수 있어요. 배경음악은 mp3 로 올리면 작품 크기가 작아져요."));
    w.append(h("div", { class: "card", style: { display: "flex", flexDirection: "column", gap: "8px" } },
      Object.keys(proj.sounds).length ? null : h("p", { class: "hint" }, "아직 효과음이 없어요."),
      Object.keys(proj.sounds).map((n) => h("div", { class: "row sound-row" },
        h("button", { class: "btn", "aria-label": `${n} 들어보기`, onclick: () => playTest(n) }, "▶"),
        h("b", { style: { flex: 1 } }, n),
        h("button", { class: "btn", onclick: () => soundSheet(n) }, "이름 · 삭제"))),
      soundInput(null, () => render())));

    w.append(h("h3", { class: "sec" }, "🎨 내 효과 (입자)"),
      h("p", { class: "hint" }, "모양 · 색 · 방향 · 투명도 · 사라지는 정도까지 직접 정한 입자 효과예요. 스토리의 [입자 효과] 블록에서 골라 써요."));
    w.append(h("div", { class: "fx-list" },
      Object.entries(proj.effects).map(([n, d]) => h("button", { class: "fx-card", onclick: () => effectSheet(n) },
        h("b", {}, n), h("small", {}, `${FX_SHAPES[d.shape] || d.shape}${d.dir != null ? ` · ${dirArrow(d.dir)}` : ""}`), fxSwatch(d))),
      h("button", { class: "fx-card add", onclick: () => effectSheet(null) }, "+ 새 효과 만들기")));

    w.append(h("h3", { class: "sec" }, "🧩 변수 그림"),
      h("p", { class: "hint" }, "[변수 그림] 블록의 '화면 위 그림'에서 쓰는 그림이에요. 화면 어디에든, 원하는 크기로 띄울 수 있어요 (예: 상태 아이콘, 말풍선, 쪽지, 표정 이모티콘)."));
    w.append(h("div", { class: "thumbs" },
      Object.entries(proj.pics).map(([n, ref]) => h("button", { class: "thumb char", onclick: () => bgSheet(n, "pics") },
        h("div", { class: "pic", style: { backgroundImage: `url("${imgSrc(ref)}")`, backgroundPosition: "center" } }),
        h("div", { class: "cap" }, h("b", {}, n), h("small", {}, `image: "${n}"`)))),
      h("button", { class: "thumb add", onclick: () => bgSheet(null, "pics") }, "+ 변수 그림 추가")));

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
  // ===== 📥 보관함 =====
  // 사진첩이 안 열리는 앱 화면을 위한 길: 채팅으로 Claude 에게 보낸 그림 · 소리를 inbox/ 에 넣어 두면 여기서 바로 가져와요.
  let inboxItems = null;
  async function loadInbox() {
    if (inboxItems) return inboxItems;
    try {
      const r = await fetch("inbox/inbox.json", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      inboxItems = (Array.isArray(j.items) ? j.items : []).filter((x) => x && x.file);
    } catch (e) { inboxItems = []; }
    return inboxItems;
  }
  async function inboxFile(item) {
    const r = await fetch(item.file);
    if (!r.ok) throw new Error("보관함 파일을 읽지 못했어요");
    const blob = await r.blob();
    const ext = (item.file.match(/\.(\w+)$/) || [, "png"])[1];
    return new File([blob], `${item.name || "보관함"}.${ext}`, { type: blob.type || (item.type === "audio" ? "audio/mpeg" : "image/png") });
  }
  // 버튼을 누르면 그 자리에 보관함 목록이 펼쳐져요 (편집 중인 창을 닫지 않아요)
  function inboxPicker(type, onFile) {
    const list = h("div", { class: "inbox-grid", hidden: true });
    const btn = h("button", { class: "btn wide inbox-btn", onclick: async (e) => {
      e.preventDefault();
      if (!list.hidden) { list.hidden = true; return; }
      list.hidden = false; list.innerHTML = ""; list.append(h("span", { class: "hint" }, "불러오는 중…"));
      const items = (await loadInbox()).filter((x) => (x.type || "image") === type);
      list.innerHTML = "";
      if (!items.length) { list.append(h("p", { class: "hint" }, type === "audio" ? "보관함에 소리가 없어요. 이 채팅으로 Claude 에게 소리 파일을 보내 주세요." : "보관함이 비어 있어요. 이 채팅으로 Claude 에게 그림을 보내 주시면 여기에 넣어 드려요.")); return; }
      items.forEach((it) => list.append(h("button", { class: "inbox-item", onclick: async (ev) => {
        ev.preventDefault();
        try { onFile(await inboxFile(it)); list.hidden = true; } catch (er) { toast(er.message); }
      } }, type === "audio" ? h("span", { class: "inbox-audio" }, "🔊") : h("span", { class: "inbox-thumb", style: { backgroundImage: `url("${it.file}")` } }), h("small", {}, it.name || "이름 없음"))));
    } }, type === "audio" ? "📥 보관함에서 소리 고르기" : "📥 보관함에서 그림 고르기");
    return h("div", { class: "inbox-pick" }, btn, list);
  }
  const pickerHelp = () => h("p", { class: "hint picker-help" }, "사진첩이 안 열리면: ① 이 채팅으로 Claude 에게 그림을 보내 주세요 → 📥 보관함에 넣어 드려요 ② 또는 폰의 크롬 · 사파리에서 이 페이지를 열면 사진첩이 열려요.");

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
    return h("div", { class: "img-in" }, fileButton(opts.label || "🖼 사진첩에서 그림 고르기", "image/*", handle, "wide" + (opts.primary ? " primary" : "")), inboxPicker("image", handle), paste, status, pickerHelp());
  }
  // 사진 파일 이름(IMG_1234 같은 것)은 의미가 없어서 "배경", "그림" 같은 이름을 대신 써요
  function fileBase(file, fallback) {
    const n = ((file && file.name) || "").replace(/\.[^.]+$/, "").replace(/[^\w가-힣]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20);
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
    const isBg = map === "backgrounds", isItem = map === "items" || map === "pics";
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
          if (b && b.minigame && map !== "pics") { if (b.image === name) b.image = v; (b.objects || []).forEach((o) => { if (map === "items" && o.item === name) o.item = v; }); }
          if (b && map === "pics" && b.varImage === "pic") { (b.cases || []).forEach((c) => { if (c.image === name) c.image = v; }); if (b.else === name) b.else = v; }
          if (b && b[key] === name) b[key] = v;
          if (b && key === "cg" && Array.isArray(b.cgSeq)) b.cgSeq.forEach((st) => { if (st.image === name) st.image = v; });
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
    const label = isBg ? "배경" : map === "pics" ? "변수 그림" : isItem ? "오브젝트 그림" : "이벤트 그림";
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
        eachBlock((b) => { if (b && b.show === id) b.show = st.id; if (b && b.hide === id) b.hide = st.id; if (b && b.varImage === id) b.varImage = st.id; if (b && b.act === id) b.act = st.id; });
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
    if (proj.gauges[from]) { proj.gauges[to] = proj.gauges[from]; delete proj.gauges[from]; }
    (proj.watches || []).forEach((w) => (w.if = String(w.if).replace(new RegExp("^\\s*" + from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=\\s|$)"), to)));
    const fixSet = (s) => { if (s && from in s) { s[to] = s[from]; delete s[from]; } };
    const fixIf = (e) => String(e).replace(new RegExp("^\\s*" + from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=\\s|$)"), to);
    eachBlock((b) => {
      if (!b || typeof b !== "object") return;
      fixSet(b.set); if (b.if) b.if = fixIf(b.if);
      if (b.choice) b.choice.forEach((o) => { fixSet(o.set); if (o.if) o.if = fixIf(o.if); });
      if (b.cases) b.cases.forEach((c) => (c.if = fixIf(c.if)));
      if (b.minigame) { if (b.score === from) b.score = to; (b.objects || []).forEach((o) => fixSet(o.set)); }
      if (b.gauge === from) b.gauge = to;
    });
  }
  // 📊 숫자 변수를 게이지로 보여주기
  const G_STYLES = { bar: "▬ 가로 막대", tank: "▮ 세로 통 (탱크)", ring: "◯ 동그라미", icons: "★ 아이콘 여러 개", cells: "🔋 배터리 칸" };
  const G_POS = { tl: "왼쪽 위", tc: "가운데 위", tr: "오른쪽 위" };
  const G_SHOW = { value: "3 / 10", percent: "30%", plain: "3", none: "숫자 숨기기" };
  const G_FX = { "": "효과 없음", shake: "화면 흔들기", flash: "화면 번쩍" };
  function gPresets(g) {
    const min = +g.min || 0, max = g.max == null ? 10 : +g.max, at = (r) => Math.round((min + (max - min) * r) * 10) / 10;
    return {
      "💗 하트 막대": { style: "bar", icon: "💗", color: "#ff6b8b", show: "value", ticks: false, markers: [], zoneColor: false, overflow: false },
      "🧪 세로 통 + 경고": { style: "tank", icon: "", color: "#9c6b3c", show: "percent", pctColor: "#ffe14d", overflow: true, ticks: true, zoneColor: false,
        markers: [{ at: at(0.95), icon: "!", color: "#ff3b3b", fx: "flash" }, { at: at(0.85), icon: "!", color: "#ff8a3d", fx: "shake" }, { at: at(0.7), icon: "!", color: "#ffd23f", fx: "" }] },
      "⭕ 동그라미": { style: "ring", icon: "🔥", color: "#ff8a3d", show: "percent", markers: [], zoneColor: false },
      "⭐ 별 다섯 개": { style: "icons", icon: "⭐", show: "value", cells: 5, markers: [] },
      "🔋 배터리": { style: "cells", icon: "🔋", color: "#3bceac", show: "percent", cells: 5, markers: [{ at: at(0.2), icon: "!", color: "#ff3b3b" }], zoneColor: false },
      "🚦 단계별 색": { style: "bar", icon: "🌡", color: "#3bceac", show: "value", ticks: true, zoneColor: true,
        markers: [{ at: at(0.5), icon: "!", color: "#ffd23f" }, { at: at(0.8), icon: "!", color: "#ff3b3b", fx: "shake" }] },
    };
  }
  function gaugeEditor(name) {
    const box = h("div", { class: "gauge-edit" });
    const toggle = h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!proj.gauges[name], onchange: (e) => {
      if (e.target.checked) proj.gauges[name] = { label: name, icon: "💗", color: "#ff6b8b", min: 0, max: 10, always: true, style: "bar", pos: "tl", show: "value" };
      else delete proj.gauges[name];
      changed();
    } }), "📊 게임 화면에 게이지로 보여주기");
    box.append(toggle);
    const g = proj.gauges[name];
    if (!g) return box;
    const panel = h("div", { class: "gauge-panel" });
    const pv = { v: +proj.vars[name] || 0 };
    const stage = h("div", { class: "gauge-stage" });
    let inst = null, timer = null;
    // 실제 게임 엔진으로 게이지를 보여주는 미리보기
    const preview = () => {
      if (inst) inst.destroy();
      if (!stage.isConnected || !proj.gauges[name]) return;
      const bgName = Object.keys(proj.backgrounds)[0];
      inst = VN.mount(stage, { title: "__preview", start: "a", backgrounds: proj.backgrounds, images: proj.images, vars: { [name]: pv.v },
        gauges: { [name]: Object.assign({}, proj.gauges[name], { always: true }) },
        story: { a: [bgName ? { bg: bgName } : { wait: 1 }, { wait: 2000000000 }] } }, { startScene: "a", preview: true });
    };
    const refresh = () => { clearTimeout(timer); timer = setTimeout(preview, 200); };
    const set = (k, v, redraw) => { g[k] = v; changed({ render: false }); if (redraw) draw(); refresh(); };
    const DEF = () => ({ size: 1, style: "bar", pos: "tl", show: g.hideValue ? "none" : g.showMax === false ? "plain" : (g.style || "bar") === "tank" ? "percent" : "value" });
    const sel = (k, opts, redraw) => h("select", { onchange: (e) => set(k, k === "size" ? +e.target.value : e.target.value, redraw) },
      Object.entries(opts).map(([v, t]) => h("option", { value: v, selected: String(g[k] == null ? DEF()[k] : g[k]) === v }, t)));
    const chk = (k, label, redraw) => h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!g[k], onchange: (e) => set(k, e.target.checked, redraw) }), label);
    const draw = () => {
      panel.innerHTML = "";
      const st = g.style || "bar";
      const min = +g.min || 0, max = g.max == null ? 10 : +g.max;
      const pvTxt = h("span", {}, `미리보기 값: ${pv.v}`);
      put(panel,
        h("div", { class: "chips" }, Object.entries(gPresets(g)).map(([t, p]) => h("button", { class: "chip", onclick: () => { Object.assign(g, clone(p)); changed({ render: false }); draw(); refresh(); } }, t))),
        h("div", { class: "gauge-stage-wrap" }, stage,
          h("label", { class: "f" }, pvTxt, h("input", { type: "range", min: String(min), max: String(max + (g.overflow ? (max - min) * 0.2 : 0)), step: String((max - min) / 50 || 0.1), value: pv.v,
            oninput: (e) => { pv.v = Math.round(+e.target.value * 10) / 10; pvTxt.textContent = `미리보기 값: ${pv.v}`; refresh(); } }))),
        h("div", { class: "grid3" },
          field("모양", sel("style", G_STYLES, true)),
          field("위치", sel("pos", G_POS)),
          field("크기", sel("size", { 0.8: "작게", 1: "보통", 1.3: "크게", 1.6: "아주 크게" }))),
        h("div", { class: "grid3" },
          field("표시 이름", h("input", { type: "text", value: g.label == null ? "" : g.label, placeholder: "비우면 이름 숨김", oninput: (e) => set("label", e.target.value) })),
          field(st === "icons" ? "채울 아이콘" : "아이콘", h("input", { type: "text", value: g.icon || "", maxlength: "4", placeholder: st === "icons" ? "⭐" : "💗", oninput: (e) => set("icon", e.target.value) })),
          st === "icons" ? null : h("label", { class: "f" }, "색", h("input", { type: "color", value: g.color || "#ff6b8b", oninput: (e) => set("color", e.target.value) }))),
        h("div", { class: "grid3" },
          field("빈 칸일 때 값", h("input", { type: "number", value: min, onchange: (e) => set("min", +e.target.value || 0, true) })),
          field("꽉 찰 때 값", h("input", { type: "number", value: max, onchange: (e) => set("max", +e.target.value || 0, true) })),
          field("숫자 표시", sel("show", G_SHOW))),
        h("div", { class: "grid3" },
          field("보이기", h("select", { onchange: (e) => set("always", e.target.value === "always") },
            h("option", { value: "always", selected: g.always !== false }, "항상"), h("option", { value: "block", selected: g.always === false }, "[게이지] 블록으로"))),
          st === "icons" || st === "cells" ? field("칸 개수", h("input", { type: "number", min: "1", max: "20", value: g.cells || Math.min(10, Math.round(max - min)) || 5, onchange: (e) => set("cells", Math.max(1, Math.min(20, +e.target.value || 5))) })) : null,
          st === "tank" ? h("label", { class: "f" }, "% 글자 색", h("input", { type: "color", value: g.pctColor || "#ffe14d", oninput: (e) => set("pctColor", e.target.value) })) : null),
        h("div", { class: "row" },
          chk("overflow", "꽉 찬 뒤에도 숫자 올라가기 (예: 106%)"),
          st === "bar" || st === "tank" ? chk("ticks", "눈금 보이기") : null,
          st !== "icons" ? chk("zoneColor", "표시점에 닿으면 게이지 색 바꾸기") : null),
        st === "icons" ? null : h("div", { class: "marker-list" },
          h("b", {}, "표시점 (경고 · 목표 지점)"),
          h("p", { class: "hint" }, "게이지 위의 특정 값에 아이콘을 붙여요. 값이 그 지점에 닿으면 아이콘이 반짝이고, 고른 효과가 나와요."),
          (g.markers || []).map((m, j) => h("div", { class: "marker-row" },
            field("값", h("input", { type: "number", value: m.at, onchange: (e) => { m.at = +e.target.value; set("markers", g.markers); } })),
            field("아이콘", h("input", { type: "text", value: m.icon || "!", maxlength: "2", oninput: (e) => { m.icon = e.target.value; set("markers", g.markers); } })),
            h("label", { class: "f" }, "색", h("input", { type: "color", value: m.color || "#ffd23f", oninput: (e) => { m.color = e.target.value; set("markers", g.markers); } })),
            field("닿으면", h("select", { onchange: (e) => { m.fx = e.target.value; set("markers", g.markers); } }, Object.entries(G_FX).map(([v, t]) => h("option", { value: v, selected: (m.fx || "") === v }, t)))),
            sigNames().length ? field("시그널", signalSelect(m.signal, (v) => { m.signal = v; set("markers", g.markers); }, "안 보냄")) : null,
            h("button", { class: "btn danger", style: { padding: "6px 10px", alignSelf: "flex-end" }, "aria-label": "표시점 빼기", onclick: () => { g.markers.splice(j, 1); set("markers", g.markers, true); } }, "✕"))),
          h("button", { class: "btn dashed", onclick: () => { g.markers = g.markers || []; g.markers.push({ at: Math.round((min + (max - min) * 0.8) * 10) / 10, icon: "!", color: "#ffd23f", fx: "" }); set("markers", g.markers, true); } }, "+ 표시점 추가")));
    };
    draw();
    box.append(panel);
    setTimeout(preview, 80);
    return box;
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
        delete proj.vars[name]; delete proj.gauges[name]; changed();
      } }, "삭제");
      const uses = varUses(name);
      card.append(h("div", { class: "var-row" },
        field("이름", nameIn),
        field("종류", h("select", { onchange: (e) => { proj.vars[name] = e.target.value === "num" ? 0 : e.target.value === "bool" ? false : ""; changed(); } },
          h("option", { value: "num", selected: type === "num" }, "숫자"), h("option", { value: "str", selected: type === "str" }, "글자"), h("option", { value: "bool", selected: type === "bool" }, "참/거짓"))),
        field("처음 값", valIn), del,
        h("div", { class: "uses" }, uses ? `스토리에서 ${uses}번 쓰여요` : "아직 스토리에서 안 쓰여요"),
        type === "num" ? gaugeEditor(name) : null));
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
    if (proj.apk) P.apk = proj.apk;
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
      L("9. 게이지 · 방향 · 내 효과", "gauges 에 변수 이름을 쓰면 그 변수가 게이지로 보여요. 입자 효과의 dir 은 방향(0 위, 90 오른쪽, 180 아래, 270 왼쪽), spread 는 퍼지는 폭이에요. effects 에 만든 효과는 particles 에 이름을 써서 불러요.",
        'gauges: { 호감도: { icon: "💗", max: 10, color: "#ff6b8b", always: true } },\neffects: { 별가루: { shape: "star", colors: ["#fff3a8"], alpha: 0.9, fadeOut: 0.6, dir: 0, spread: 50 } },\n\n{ particles: "petal", mode: "spread", dir: 90, spread: 30 }  // 오른쪽으로\n{ particles: "별가루", mode: "burst", x: 50, y: 40 }\n{ gauge: "호감도", show: false }                       // 숨기기'),
      L("10. CG 넘기기 · 효과음", "cgSeq 는 탭할 때마다 넘어가는 단계 목록이에요. 단계마다 image(그림) · say/text(대사) · sound(효과음) · fx(효과) · particles(입자)를 넣을 수 있고, text 가 없으면 그림만 보여주고 탭을 기다려요.",
        'sounds: { 띠링: "img:..." },\n\n{ cgSeq: [\n  { image: "추억1", text: "그날의 교실." },\n  { image: "추억2", sound: "띠링", fx: "flash" },\n  { say: "샬럿", text: "기억나?", particles: "별가루" },\n] }\n\n{ sound: "띠링", volume: 0.6 }'),
      L("11. 배경음악 · 캐릭터 움직임", "bgm 에 소리 이름을 쓰면 반복해서 틀고, 빈 칸 \"\" 이면 꺼요. fade 는 서서히 바뀌는 시간(초)이에요. act 는 움직일 캐릭터, motion 은 움직임이에요. 대사 블록에 act 를 넣으면 말하면서 움직여요.",
        '{ bgm: "교실의 오후", volume: 0.7, fade: 2 }\n{ bgm: "" }                                  // 음악 끄기\n\n{ act: "charlotte", motion: "tremble" }      // 덜덜 (계속)\n{ act: "charlotte", motion: "down" }         // 살짝 아래로 (자세)\n{ act: "charlotte", motion: "reset" }        // 제자리로\n{ say: "샬럿", act: "hop", text: "야호!" }'),
      L("12. ⚡ 시그널 — 이름 붙인 블록 묶음", "story 안에 이름이 ⚡ 로 시작하는 목록을 만들면 시그널이 돼요. { signal: 이름 } 으로 보내면 그 블록들이 실행되고 끝나면 돌아와요. watches 는 '조건이 맞게 되는 순간' 저절로 보내요. 선택지와 게이지 표시점에도 signal 을 쓸 수 있어요.",
        'story: {\n  "⚡깜짝 이벤트": [ { shake: true }, { sound: "띠링" }, "쿵!" ],\n  ...\n},\nwatches: [ { if: "호감도 >= 4", signal: "깜짝 이벤트", once: true } ],\n\n{ signal: "깜짝 이벤트" }                       // 보내기\n{ choice: [ { text: "만지기", signal: "깜짝 이벤트", goto: "다음" } ] }'),
      L("13. 묶음 — 블록 정리하기", "여러 블록을 group 으로 묶으면 창작기에서 접었다 펼 수 있어요. 게임에서는 blocks 안의 블록이 위에서부터 차례대로 실행돼요. 묶음 안에 묶음을 넣을 수도 있어요.",
        '{ group: "아침 인사", blocks: [\n  { bg: "classroom" },\n  "샬럿: 좋은 아침!",\n  "나: 안녕.",\n] },'),
      L("14. 쉼표와 괄호 — 가장 흔한 실수", "목록의 항목 사이에는 꼭 쉼표(,)가 있어야 해요. 여는 괄호와 닫는 괄호의 짝도 맞아야 해요. 에러가 나면 그 줄 근처의 쉼표와 괄호부터 확인하세요.",
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
      field("타이틀 화면 음악 (첫 탭부터 나와요)", h("select", { onchange: (e) => { proj.titleBgm = e.target.value; changed({ render: false }); } },
        h("option", { value: "" }, "없음"), Object.keys(proj.sounds).map((n) => h("option", { value: n, selected: n === proj.titleBgm }, "🎵 " + n)))),
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
        h("button", { class: "btn", onclick: apkSheet }, h("span", {}, "📱 안드로이드 앱으로 저장 (.apk)"), h("small", {}, "폰에 설치하는 앱")),
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
    for (const k of Object.keys(P.pics || {})) P.pics[k] = await conv(P.pics[k]);
    for (const k of Object.keys(P.sounds || {})) P.sounds[k] = await conv(P.sounds[k]);
    for (const c of Object.values(P.characters)) for (const k of Object.keys(c.faces || {})) c.faces[k] = await conv(c.faces[k]);
    return P;
  }
  async function exportBackup() {
    toast("백업 파일 만드는 중…");
    const P = await bundledProject();
    await download(safeName(proj.title) + ".json", JSON.stringify({ format: "novel-workshop", version: 1, project: P }));
  }
  // 플레이용 게임 파일(HTML 한 장) 만들기 — 이미지까지 모두 안에 넣어요
  async function gameHtml() {
    let engine = "";
    try { engine = await (await fetch("engine.js")).text(); } catch (e) {}
    if (!engine.includes("window.VN")) { const s = document.getElementById("engine-src"); engine = s ? s.textContent : ""; }
    if (!engine) throw new Error("엔진 코드를 읽지 못했어요");
    const P = await bundledProject();
    delete P.apk; // 앱 서명 키는 게임 파일에 넣지 않아요
    const esc = (s) => s.replace(/<\/(script)/gi, "<\\/$1").replace(/<!-{2}/g, "<\\!-" + "-"); // 주의: 이 파일 안에 HTML 주석 시작 기호를 그대로 쓰면 페이지에 넣었을 때 코드가 통째로 무시돼요
    return `<!doctype html>
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
  }
  async function exportGame() {
    toast("게임 파일 만드는 중…");
    try { await download(safeName(proj.title) + ".html", await gameHtml()); }
    catch (e) { toast(e.message); }
  }

  // ===== 📱 안드로이드 앱(.apk) 만들기 =====
  function loadImage(src) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("그림을 불러오지 못했어요")); im.src = src; });
  }
  // 앱 아이콘 (192×192 PNG): 캐릭터 얼굴 / 타이틀 배경 / 기본
  async function makeIcon(kind) {
    if (kind === "default") return null;
    const S = 192, cv = document.createElement("canvas"); cv.width = cv.height = S;
    const cx = cv.getContext("2d");
    cx.beginPath(); cx.roundRect ? cx.roundRect(0, 0, S, S, 40) : cx.rect(0, 0, S, S); cx.clip();
    if (kind === "char") {
      const c = Object.values(proj.characters)[0];
      const ref = c && (c.faces[Object.keys(c.faces).find((k) => /smile|normal/.test(k))] || Object.values(c.faces)[0]);
      if (!ref) return null;
      cx.fillStyle = c.color || "#8fd3ff"; cx.fillRect(0, 0, S, S);
      const g = cx.createLinearGradient(0, 0, 0, S); g.addColorStop(0, "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(0,0,0,.15)");
      cx.fillStyle = g; cx.fillRect(0, 0, S, S);
      const im = await loadImage(imgSrc(ref));
      const w = S * 1.7, h = (im.naturalHeight / im.naturalWidth) * w;
      cx.drawImage(im, (S - w) / 2, S * 0.06, w, h);
    } else {
      const ref = proj.backgrounds[proj.titleBg] || Object.values(proj.backgrounds)[0];
      if (!ref) return null;
      const im = await loadImage(imgSrc(ref));
      const sc = Math.max(S / im.naturalWidth, S / im.naturalHeight);
      cx.drawImage(im, (S - im.naturalWidth * sc) / 2, (S - im.naturalHeight * sc) / 2, im.naturalWidth * sc, im.naturalHeight * sc);
    }
    const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
    return new Uint8Array(await blob.arrayBuffer());
  }
  async function saveApk(name, bytes) {
    let api = null;
    try { api = window.claude && window.claude.use ? await window.claude.use("downloads") : null; } catch (e) {}
    if (!api) {
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.android.package-archive" }));
      const a = h("a", { href: url, download: name + ".apk" }); document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return "saved";
    }
    try { await api.save({ filename: name + ".apk", data: new Blob([bytes]) }); return "saved"; }
    catch (e) {
      if (e && e.code === "declined") return "declined";
      if (e && (e.code === "rejected_extension" || e.code === "extension_not_enabled")) {
        // 이 화면에서는 .apk 저장이 막혀 있어서 .zip 이름으로 저장해요 (이름만 바꾸면 그대로 설치돼요)
        try { await api.save({ filename: name + ".apk.zip", data: new Blob([bytes]) }); return "zip"; }
        catch (e2) { return (e2 && e2.code) || "error"; }
      }
      return (e && e.code) || "error";
    }
  }
  function apkSheet() {
    const st = { label: (proj.title || "").slice(0, NovelApk.MAX_LABEL), icon: Object.keys(proj.characters).length ? "char" : Object.keys(proj.backgrounds).length ? "bg" : "default" };
    const preview = h("div", { class: "apk-icon" });
    const drawPreview = async () => {
      preview.style.backgroundImage = "";
      preview.textContent = st.icon === "default" ? "📖" : "";
      try { const png = await makeIcon(st.icon); if (png) preview.style.backgroundImage = `url("${URL.createObjectURL(new Blob([png], { type: "image/png" }))}")`; } catch (e) {}
      previewName.textContent = st.label || "앱 이름";
    };
    const previewName = h("span", {});
    const iconBtns = h("div", { class: "chips" }, Object.entries({ char: "캐릭터 얼굴", bg: "타이틀 배경", default: "기본 아이콘" }).map(([k, t]) =>
      h("button", { class: "chip" + (st.icon === k ? " on" : ""), onclick: (e) => { st.icon = k; iconBtns.querySelectorAll(".chip").forEach((c) => c.classList.remove("on")); e.currentTarget.classList.add("on"); drawPreview(); } }, t)));
    const status = h("div", { class: "msg", hidden: true });
    const go = h("button", { class: "btn primary grow", onclick: async () => {
      go.disabled = true; status.hidden = false; status.className = "msg ok";
      try {
        if (!window.NovelApk || !window.APK_TEMPLATE_B64) throw new Error("앱 만들기 도구를 불러오지 못했어요");
        status.textContent = "① 게임 파일 묶는 중…";
        const html = await gameHtml();
        status.textContent = "② 아이콘 만드는 중…";
        const icon = await makeIcon(st.icon).catch(() => null);
        if (!proj.apk || !proj.apk.key) {
          status.textContent = "③ 이 작품의 서명 키 만드는 중… (처음 한 번만)";
          const pkg = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
          proj.apk = { pkg, key: await NovelApk.makeKey(proj.title || "Novel") };
          changed({ render: false }); await persist();
        }
        status.textContent = "④ 앱 포장하고 서명하는 중…";
        const bytes = await NovelApk.build({ template: window.APK_TEMPLATE_B64, html, label: st.label || proj.title, icon, pkgSuffix: proj.apk.pkg, key: proj.apk.key });
        const mb = (bytes.length / 1048576).toFixed(1);
        const r = await saveApk(safeName(st.label || proj.title), bytes);
        if (r === "saved") status.textContent = `✅ 앱을 만들었어요 (${mb}MB). 아래 설치 방법을 보고 폰에서 열어 주세요.`;
        else if (r === "zip") status.textContent = `✅ 앱을 만들었어요 (${mb}MB). 이 화면에서는 .apk 로 바로 저장할 수 없어서 "${safeName(st.label || proj.title)}.apk.zip" 으로 저장했어요. 파일 앱에서 이름 끝의 ".zip" 만 지우면 설치할 수 있어요.`;
        else if (r === "declined") status.textContent = "저장을 취소했어요.";
        else { status.className = "msg err"; status.textContent = "저장하지 못했어요 (" + r + ")"; }
      } catch (e) { status.className = "msg err"; status.textContent = "앱을 만들지 못했어요: " + e.message; }
      go.disabled = false;
    } }, "📱 앱 만들기");
    openSheet("안드로이드 앱 (.apk)", [
      h("div", { class: "apk-head" }, preview, previewName),
      field("앱 이름 (홈 화면에 보여요)", h("input", { type: "text", value: st.label, maxlength: String(NovelApk.MAX_LABEL), oninput: (e) => { st.label = e.target.value; previewName.textContent = st.label || "앱 이름"; } })),
      h("label", { class: "f" }, "앱 아이콘", iconBtns),
      status,
      h("details", { class: "lesson", open: true }, h("summary", {}, "설치하는 방법"),
        h("p", {}, "1. [앱 만들기]로 .apk 파일을 저장해요."),
        h("p", {}, "2. 폰의 파일 앱(다운로드 폴더)에서 파일을 눌러요. 처음이면 '출처를 알 수 없는 앱 설치'를 허용해 달라고 나와요 → 허용."),
        h("p", {}, "3. [설치]. 'Play 프로텍트' 경고가 나오면 [무시하고 설치]를 눌러요. (직접 만든 앱이라 나오는 안내예요)"),
        h("p", {}, "· 같은 작품은 항상 같은 서명 키로 만들어서, 고친 뒤 다시 만들어 설치하면 업데이트돼요. 키는 이 작품(과 백업 파일)에 저장돼요 — 백업 파일은 남에게 주지 마세요."),
        h("p", {}, "· 안드로이드 7.0 이상에서 돌아가요. 저장 슬롯은 앱 안에 따로 저장돼요."),
        h("p", {}, "· 아이폰 앱은 애플의 정책상 이 방법으로 만들 수 없어요. 아이폰에서는 [게임 파일 (.html)]을 쓰세요.")),
    ], [go]);
    drawPreview();
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
    tab = b.dataset.tab; pref.set("tab", tab); mapMode = false; $("#view").scrollTop = 0; render();
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
