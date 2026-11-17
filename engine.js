/* =====================================================================
   🛠 비주얼 노벨 엔진 (VN)
   사용법:  VN.mount(화면을_넣을_요소, PROJECT, 옵션)
   - PROJECT 형식은 story.js 를 참고하세요.
   - 옵션: { startScene: "장면", onExit: 함수 }  (창작기의 테스트 실행용)
   ===================================================================== */
(function () {
  const STYLE = `
  .vn-root{position:relative;width:100%;height:100%;overflow:hidden;background:#000;color:#f3f6ff;
    font-family:"Noto Sans KR",system-ui,sans-serif;user-select:none;-webkit-user-select:none;
    --vn-box:rgba(14,18,32,.84);--vn-line:rgba(160,200,255,.35);--vn-accent:#8fd3ff}
  .vn-root *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
  .vn-root button{font:inherit;color:inherit;cursor:pointer}
  .vn-root [hidden]{display:none!important}
  .vn-stage{position:absolute;inset:0;overflow:hidden;cursor:pointer}
  .vn-cg{position:absolute;inset:0;background:#000 center/contain no-repeat;opacity:0;transition:opacity .5s;pointer-events:none}
  .vn-cg.cover{background-size:cover}.vn-cg.on{opacity:1}
  .vn-bg{position:absolute;inset:0;background:#111 center/cover no-repeat}
  .vn-bg2{opacity:0}
  .vn-chars{position:absolute;inset:0;pointer-events:none}
  .vn-chars img{position:absolute;bottom:0;height:88%;max-width:92%;object-fit:contain;object-position:bottom;left:50%;
    transform:translate(-50%,4%);opacity:0;transition:opacity .4s,transform .4s,filter .3s,left .4s;filter:drop-shadow(0 0 12px rgba(0,0,0,.35))}
  .vn-chars img.on{opacity:1;transform:translate(-50%,0)}
  .vn-chars img[data-pos="left"]{left:25%}.vn-chars img[data-pos="right"]{left:75%}
  .vn-chars img.dim{filter:brightness(.6) drop-shadow(0 0 12px rgba(0,0,0,.35))}
  .vn-chars img.bounce{animation:vn-bounce .3s}
  @keyframes vn-bounce{50%{transform:translate(-50%,-2%)}}
  .vn-root.portrait .vn-chars img{height:72%;bottom:14%}
  .vn-root.portrait .vn-chars img[data-pos="left"]{left:30%}.vn-root.portrait .vn-chars img[data-pos="right"]{left:70%}
  .vn-box{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(10px + env(safe-area-inset-bottom,0px));
    width:min(960px,calc(100% - 20px));min-height:150px;padding:26px 22px 20px;background:var(--vn-box);
    border:1px solid var(--vn-line);border-radius:16px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-shadow:0 8px 30px rgba(0,0,0,.4)}
  .vn-name{position:absolute;top:-16px;left:18px;padding:4px 16px;border-radius:999px;background:#182038;border:1px solid var(--vn-line);font-weight:700;font-size:15px;letter-spacing:.05em}
  .vn-text{font-family:"Gowun Batang",serif;font-size:clamp(16px,2.2vw + 8px,21px);line-height:1.75;white-space:pre-wrap;word-break:keep-all}
  .vn-text.narration{color:#d9def0}
  .vn-next{position:absolute;right:18px;bottom:10px;opacity:0;color:var(--vn-accent)}
  .vn-next.on{opacity:1;animation:vn-blink 1s infinite}
  @keyframes vn-blink{50%{transform:translateY(3px);opacity:.4}}
  .vn-menu{position:absolute;top:calc(8px + env(safe-area-inset-top,0px));right:8px;left:8px;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
  .vn-menu button{background:rgba(10,14,26,.6);border:1px solid var(--vn-line);border-radius:10px;padding:7px 10px;font-size:13px}
  .vn-menu button.active{background:var(--vn-accent);color:#0b1020;font-weight:700}
  .vn-menu .vn-exit{margin-right:auto;background:#5a1f2e}
  .vn-choices{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px 20px 190px;background:rgba(0,0,0,.25)}
  .vn-choice{width:min(560px,100%);padding:16px 20px;border-radius:14px;background:rgba(18,24,44,.92);border:1px solid var(--vn-line);font-size:16px;text-align:center;animation:vn-pop .25s both}
  .vn-choice:hover,.vn-choice:active{background:var(--vn-accent);color:#0b1020}
  @keyframes vn-pop{from{opacity:0;transform:translateY(8px)}}
  .vn-fx{position:absolute;inset:0;opacity:0;pointer-events:none}
  .vn-shake{animation:vn-shake .4s}
  @keyframes vn-shake{20%{transform:translate(-8px,2px)}40%{transform:translate(7px,-3px)}60%{transform:translate(-5px,1px)}80%{transform:translate(4px,0)}}
  .vn-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .vn-title{z-index:10;background:#000}
  .vn-title-bg{position:absolute;inset:0;background:center/cover;filter:blur(2px) brightness(.55);transform:scale(1.05)}
  .vn-title>*:not(.vn-title-bg){position:relative}
  .vn-title h1{font-family:"Gowun Batang",serif;font-size:clamp(32px,8vw,64px);font-weight:700;margin:0;text-shadow:0 4px 24px rgba(0,0,0,.6);text-align:center;padding:0 16px}
  .vn-title-sub{letter-spacing:.4em;font-size:13px;opacity:.8;margin:8px 0 40px;text-align:center}
  .vn-tbtn{width:220px;padding:14px;margin:6px;border-radius:12px;background:rgba(14,18,32,.75);border:1px solid var(--vn-line);font-size:16px}
  .vn-tbtn:active,.vn-tbtn:hover{background:var(--vn-accent);color:#0b1020}
  .vn-endings{margin-top:24px;font-size:12px;opacity:.75;padding:0 16px;text-align:center}
  .vn-ending{z-index:11;background:rgba(0,0,0,.85);animation:vn-fadein 1.2s both}
  .vn-ending-name{font-family:"Gowun Batang",serif;font-size:clamp(22px,5vw,36px);margin-bottom:30px;text-align:center;padding:0 16px}
  @keyframes vn-fadein{from{opacity:0}}
  .vn-panel{z-index:20;background:rgba(0,0,0,.6);padding:16px}
  .vn-panel-inner{width:min(560px,100%);max-height:86%;display:flex;flex-direction:column;background:#10162a;border:1px solid var(--vn-line);border-radius:16px;overflow:hidden}
  .vn-panel-head{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--vn-line);font-weight:700}
  .vn-panel-close{background:none;border:0;font-size:22px;line-height:1;padding:0 4px}
  .vn-panel-body{overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
  .vn-slot{display:flex;flex-direction:column;text-align:left;gap:2px;padding:12px 14px;border-radius:10px;background:#182038;border:1px solid transparent}
  .vn-slot:hover,.vn-slot:active{border-color:var(--vn-accent)}
  .vn-slot span{font-size:14px;opacity:.9}.vn-slot small{font-size:11px;opacity:.6}.vn-slot .empty{opacity:.5}
  .vn-log{font-size:14px;line-height:1.6;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.06)}
  .vn-log b{display:block;font-size:12px}.vn-log i{font-style:normal;opacity:.8}
  .vn-setting{display:flex;flex-direction:column;gap:8px}.vn-setting input{width:100%}
  .vn-hint{font-size:12px;opacity:.6;margin:0 0 8px}
  .vn-toast{position:absolute;z-index:30;left:50%;top:20%;transform:translate(-50%,-10px);background:var(--vn-accent);color:#0b1020;padding:8px 18px;border-radius:999px;font-weight:700;opacity:0;transition:.25s;pointer-events:none}
  .vn-toast.on{opacity:1;transform:translate(-50%,0)}
  .vn-error{color:#ffb4b4}
  .vn-mg{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,8,18,.72);cursor:default}
  .vn-mg-card{width:min(520px,100%);max-height:100%;overflow:auto;background:#10162a;border:1px solid var(--vn-line);border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:14px;text-align:center;animation:vn-pop .25s both}
  .vn-mg h2{margin:0;font-family:"Gowun Batang",serif;font-size:22px}
  .vn-mg p{margin:0;opacity:.85;font-size:15px;line-height:1.6;word-break:keep-all}
  .vn-mg .vn-q{font-family:"Gowun Batang",serif;font-size:18px;opacity:1}
  .vn-mg .big{font-size:42px;font-weight:700;font-variant-numeric:tabular-nums}
  .vn-mg-btn{padding:14px;border-radius:12px;background:#182038;border:1px solid var(--vn-line);font-size:16px}
  .vn-mg-btn:active{background:#24305a}
  .vn-mg-btn.primary{background:var(--vn-accent);color:#0b1020;font-weight:700;border-color:var(--vn-accent)}
  .vn-bar{position:relative;height:48px;border-radius:10px;background:#0b0f1d;border:1px solid var(--vn-line);overflow:hidden}
  .vn-zone{position:absolute;top:0;bottom:0;background:rgba(143,211,255,.35);border-left:2px solid var(--vn-accent);border-right:2px solid var(--vn-accent)}
  .vn-mark{position:absolute;top:0;bottom:0;width:4px;margin-left:-2px;background:#fff;box-shadow:0 0 10px #fff}
  .vn-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .vn-card{aspect-ratio:3/4;border-radius:10px;background:#182038;border:1px solid var(--vn-line);font-size:28px;display:flex;align-items:center;justify-content:center;padding:0}
  .vn-card.open{background:#f3f6ff;color:#000}.vn-card.done{opacity:.4}
  .vn-mash{width:170px;height:170px;border-radius:50%;margin:0 auto;font-size:24px;font-weight:700;background:var(--vn-accent);color:#0b1020;border:0;user-select:none;-webkit-user-select:none}
  .vn-mash:active{transform:scale(.94)}
  .vn-mg input{padding:12px;font-size:20px;border-radius:10px;border:1px solid var(--vn-line);background:#0b0f1d;color:#fff;text-align:center;width:100%}
  .vn-timer{height:6px;background:#0b0f1d;border-radius:3px;overflow:hidden}.vn-timer i{display:block;height:100%;width:100%;background:var(--vn-accent)}
  `;

  const HTML = `
  <div class="vn-stage">
    <div class="vn-bg"></div><div class="vn-bg vn-bg2"></div>
    <div class="vn-chars"></div>
    <div class="vn-cg"></div>
    <div class="vn-choices" hidden></div>
    <div class="vn-mg" hidden></div>
    <div class="vn-box" hidden><div class="vn-name"></div><div class="vn-text"></div><div class="vn-next">▼</div></div>
    <div class="vn-menu">
      <button class="vn-exit" data-a="exit" hidden>✕ 테스트 종료</button>
      <button data-a="auto">자동</button><button data-a="skip">스킵</button><button data-a="log">로그</button>
      <button data-a="save">저장</button><button data-a="load">불러오기</button><button data-a="set">⚙️</button>
    </div>
    <div class="vn-fx"></div>
  </div>
  <div class="vn-overlay vn-title">
    <div class="vn-title-bg"></div><h1></h1><div class="vn-title-sub"></div>
    <button class="vn-tbtn" data-a="start">처음부터</button>
    <button class="vn-tbtn" data-a="tload">이어하기</button>
    <button class="vn-tbtn" data-a="tset">설정</button>
    <button class="vn-tbtn" data-a="exit" hidden>창작기로 돌아가기</button>
    <div class="vn-endings"></div>
  </div>
  <div class="vn-overlay vn-ending" hidden><div class="vn-ending-name"></div><button class="vn-tbtn" data-a="totitle">타이틀로</button></div>
  <div class="vn-overlay vn-panel" hidden>
    <div class="vn-panel-inner">
      <div class="vn-panel-head"><span class="vn-panel-title"></span><button class="vn-panel-close" aria-label="닫기">✕</button></div>
      <div class="vn-panel-body"></div>
    </div>
  </div>
  <div class="vn-toast"></div>`;

  // 대사 문자열 "이름: 내용" 판별 (창작기도 같은 규칙을 씀)
  const SAY_RE = /^([^:：\s][^:：]{0,15})[:：]\s?([\s\S]*)$/;

  function injectCSS() {
    if (document.getElementById("vn-css")) return;
    const s = document.createElement("style");
    s.id = "vn-css"; s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function mount(root, P, opts) {
    opts = opts || {};
    injectCSS();
    root.innerHTML = "";
    const R = document.createElement("div");
    R.className = "vn-root";
    R.innerHTML = HTML;
    root.appendChild(R);
    const q = (s) => R.querySelector(s);
    const el = {
      stage: q(".vn-stage"), bg: q(".vn-bg"), bg2: q(".vn-bg2"), chars: q(".vn-chars"),
      cg: q(".vn-cg"), box: q(".vn-box"), name: q(".vn-name"), text: q(".vn-text"), next: q(".vn-next"),
      choices: q(".vn-choices"), mg: q(".vn-mg"), fx: q(".vn-fx"), title: q(".vn-title"), ending: q(".vn-ending"),
      panel: q(".vn-panel"), panelTitle: q(".vn-panel-title"), panelBody: q(".vn-panel-body"), toastEl: q(".vn-toast"),
    };

    const STORY = P.story || {};
    const CHARS = P.characters || {};
    const BGS = P.backgrounds || {};
    const CGS = P.cgs || {};
    const SLOTS = 6;
    const SAVE_KEY = "vn_save_" + (P.title || "game");
    const SPEED_KEY = "vn_speed";

    let S = null, typing = null, waitingTap = false, auto = false, skip = false, autoTimer = null, dead = false;
    let speed = load(SPEED_KEY, 28);
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; };

    function img(ref) {
      if (!ref) return "";
      if (ref.startsWith("img:")) return (P.images || {})[ref.slice(4)] || "";
      return ref;
    }
    function bgSrc(name) { return img(BGS[name] || name); }

    function load(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
    function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

    function fresh(scene) {
      return { scene: scene || P.start, index: 0, lineIndex: 0, vars: JSON.parse(JSON.stringify(P.vars || {})), bg: null, chars: {}, log: [] };
    }

    function layout() { R.classList.toggle("portrait", R.clientHeight > R.clientWidth); }
    const ro = window.ResizeObserver ? new ResizeObserver(layout) : null;
    if (ro) ro.observe(R); else window.addEventListener("resize", layout);

    // ---------- 화면 ----------
    function setBg(name, instant) {
      const src = bgSrc(name);
      S.bg = name;
      if (instant) { el.bg.style.backgroundImage = src ? `url("${src}")` : ""; el.bg2.style.opacity = 0; return; }
      el.bg2.style.transition = "none";
      el.bg2.style.backgroundImage = el.bg.style.backgroundImage;
      el.bg2.style.opacity = 1;
      el.bg.style.backgroundImage = src ? `url("${src}")` : "";
      requestAnimationFrame(() => requestAnimationFrame(() => { el.bg2.style.transition = "opacity .6s"; el.bg2.style.opacity = 0; }));
    }

    function setCg(name, fit) {
      S.cg = name || ""; S.cgFit = fit || "";
      const src = name ? img(CGS[name] || name) : "";
      if (src) el.cg.style.backgroundImage = `url("${src}")`;
      el.cg.classList.toggle("cover", fit === "cover");
      el.cg.classList.toggle("on", !!src);
    }

    function renderChars(instant) {
      [...el.chars.children].forEach((im) => {
        if (!S.chars[im.dataset.id]) { im.classList.remove("on"); later(() => im.remove(), instant ? 0 : 400); }
      });
      Object.keys(S.chars).forEach((id) => {
        const c = S.chars[id], def = CHARS[id];
        if (!def) return console.warn("없는 캐릭터:", id);
        const faces = def.faces || {};
        const src = img(faces[c.face] || Object.values(faces)[0]);
        let im = el.chars.querySelector(`img[data-id="${window.CSS && CSS.escape ? CSS.escape(id) : id}"]`);
        if (!im) {
          im = document.createElement("img");
          im.dataset.id = id; im.alt = def.name || id; im.draggable = false; im.src = src;
          el.chars.appendChild(im);
          if (instant) im.classList.add("on");
          else requestAnimationFrame(() => requestAnimationFrame(() => im.classList.add("on")));
        } else if (im.getAttribute("src") !== src) {
          im.src = src; im.classList.add("on");
          im.classList.remove("bounce"); void im.offsetWidth; im.classList.add("bounce");
        }
        im.dataset.pos = c.pos || "center";
      });
    }

    function charIdByName(name) { return Object.keys(CHARS).find((id) => CHARS[id].name === name); }

    function speakerHighlight(name) {
      [...el.chars.children].forEach((im) => {
        const def = CHARS[im.dataset.id];
        im.classList.toggle("dim", !!name && def && def.name !== name && Object.keys(S.chars).length > 1);
      });
    }

    function colorFor(name) {
      if (P.nameColors && P.nameColors[name]) return P.nameColors[name];
      const id = charIdByName(name);
      return id ? CHARS[id].color || "#fff" : "#fff";
    }

    // ---------- 텍스트 ----------
    function showLine(name, text) {
      el.choices.innerHTML = ""; el.choices.hidden = true;
      el.box.hidden = false;
      el.name.textContent = name || ""; el.name.hidden = !name;
      el.name.style.color = colorFor(name);
      el.text.classList.toggle("narration", !name);
      el.text.classList.remove("vn-error");
      speakerHighlight(name);
      S.log.push({ name, text }); if (S.log.length > 200) S.log.shift();
      el.next.classList.remove("on");
      el.text.textContent = "";
      clearTimeout(autoTimer);
      const chars = [...String(text)];
      if (skip || speed === 0) { el.text.textContent = text; doneTyping(); return; }
      let i = 0;
      typing = setInterval(() => {
        if (dead) return clearInterval(typing);
        el.text.textContent += chars[i++] || "";
        if (i >= chars.length) { clearInterval(typing); typing = null; doneTyping(); }
      }, speed);
      waitingTap = true;
    }

    function doneTyping() {
      typing = null; waitingTap = true;
      el.next.classList.add("on");
      if (skip) autoTimer = later(advance, 60);
      else if (auto) autoTimer = later(advance, 1200 + el.text.textContent.length * 40);
    }

    function finishTyping() {
      if (!typing) return false;
      clearInterval(typing);
      el.text.textContent = S.log[S.log.length - 1].text;
      doneTyping();
      return true;
    }

    function advance() {
      if (!S || !waitingTap) return;
      if (finishTyping()) return;
      waitingTap = false;
      clearTimeout(autoTimer);
      run();
    }

    // ---------- 선택지 ----------
    function showChoices(list) {
      stopSkip();
      el.choices.innerHTML = ""; el.choices.hidden = false;
      list.forEach((opt) => {
        if (opt.if && !evalCond(opt.if)) return;
        const b = document.createElement("button");
        b.className = "vn-choice"; b.textContent = opt.text;
        b.onclick = (e) => {
          e.stopPropagation();
          el.choices.hidden = true;
          S.log.push({ name: "▶", text: opt.text });
          if (opt.set) applySet(opt.set);
          if (opt.goto) jump(opt.goto); else run();
        };
        el.choices.appendChild(b);
      });
    }

    // ---------- 변수 / 조건 ----------
    function applySet(obj) {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "number") S.vars[k] = (+S.vars[k] || 0) + v;
        else if (typeof v === "string" && v[0] === "=") { const r = v.slice(1); S.vars[k] = r === "true" ? true : r === "false" ? false : isNaN(+r) || r === "" ? r : +r; }
        else S.vars[k] = v;
      }
    }
    function evalCond(expr) {
      const m = String(expr).match(/^\s*(\S+)\s*(>=|<=|==|!=|>|<)\s*(.+?)\s*$/);
      if (!m) return !!S.vars[String(expr).trim()];
      const a = S.vars[m[1]] ?? 0;
      let b = m[3];
      if (b === "true") b = true; else if (b === "false") b = false;
      else if (!isNaN(+b)) b = +b; else if (b in S.vars) b = S.vars[b]; else b = b.replace(/^["']|["']$/g, "");
      switch (m[2]) {
        case ">=": return a >= b; case "<=": return a <= b;
        case ">": return a > b; case "<": return a < b;
        case "==": return a == b; case "!=": return a != b;
      }
    }

    function jump(scene) {
      if (!STORY[scene]) return showError(`장면 "${scene}" 을(를) 찾을 수 없어요.`);
      S.scene = scene; S.index = 0; run();
    }

    function showError(msg) {
      console.error(msg);
      el.choices.hidden = true;
      el.box.hidden = false; el.name.hidden = true;
      el.text.textContent = "⚠️ " + msg;
      el.text.classList.add("vn-error");
      waitingTap = false;
    }

    // ---------- 메인 실행 루프 ----------
    function run() {
      let guard = 0;
      while (!dead) {
        if (++guard > 5000) return showError("무한 반복이 감지됐어요. goto / 조건을 확인하세요.");
        const list = STORY[S.scene];
        if (!list) return showError(`장면 "${S.scene}" 이 없어요.`);
        if (S.index >= list.length) return showError(`장면 "${S.scene}" 이 끝났는데 다음으로 갈 곳(이동 / 엔딩)이 없어요.`);
        const cmd = list[S.index];
        S.lineIndex = S.index;
        S.index++;

        if (typeof cmd === "string") {
          const m = cmd.match(SAY_RE);
          if (m) showLine(m[1].trim(), m[2]); else showLine("", cmd);
          return;
        }
        if (!cmd || typeof cmd !== "object") continue;
        if (cmd.say !== undefined) {
          const id = charIdByName(cmd.say);
          if (id && cmd.face) {
            const prev = S.chars[id] || {};
            S.chars[id] = { face: cmd.face, pos: cmd.pos || prev.pos || "center" };
            renderChars();
          }
          showLine(cmd.say || "", cmd.text || "");
          return;
        }
        if (cmd.text !== undefined) { showLine("", cmd.text); return; }
        if (cmd.minigame) return minigame(cmd);
        if (cmd.varImage !== undefined) applyVarImage(cmd);
        if (cmd.bg) setBg(cmd.bg);
        if (cmd.cg !== undefined) setCg(cmd.cg, cmd.fit);
        if (cmd.show) {
          const prev = S.chars[cmd.show] || {};
          S.chars[cmd.show] = { face: cmd.face || prev.face || "normal", pos: cmd.pos || prev.pos || "center" };
          renderChars();
        }
        if (cmd.hide) { if (cmd.hide === "all") S.chars = {}; else delete S.chars[cmd.hide]; renderChars(); }
        if (cmd.set && !cmd.choice) applySet(cmd.set);
        if (cmd.shake) { el.stage.classList.remove("vn-shake"); void el.stage.offsetWidth; el.stage.classList.add("vn-shake"); }
        if (cmd.flash) flash(cmd.flash, 500);
        if (cmd.choice) { el.box.hidden = false; showChoices(cmd.choice); return; }
        if (cmd.if) { const t = evalCond(cmd.if) ? cmd.goto : cmd.else; if (t) return jump(t); continue; }
        if (cmd.goto) return jump(cmd.goto);
        if (cmd.end !== undefined) return showEnding(cmd.end);
        if (cmd.fade) { el.box.hidden = true; return fadeThrough(cmd.fade, () => { el.box.hidden = false; run(); }); }
        if (cmd.wait) { el.box.hidden = true; later(() => { el.box.hidden = false; run(); }, skip ? 0 : cmd.wait); return; }
      }
    }

    // ---------- 변수 그림: 변수 값에 따라 다른 그림 ----------
    function applyVarImage(c) {
      const hit = (c.cases || []).find((x) => evalCond(x.if));
      const im = hit ? hit.image : c.else;
      if (im === undefined || im === null) return; // 맞는 조건이 없고 else 도 없으면 그대로
      const t = c.varImage;
      if (t === "bg") { if (im) setBg(im); }
      else if (t === "cg") setCg(im, c.fit);
      else if (CHARS[t]) {
        const prev = S.chars[t] || {};
        S.chars[t] = { face: im || prev.face || "normal", pos: c.pos || prev.pos || "center" };
        renderChars();
      }
    }

    // ---------- 미니게임 ----------
    const MG_NAMES = { quiz: "퀴즈", timing: "타이밍 맞추기", mash: "연타하기", memory: "짝 맞추기", guess: "숫자 맞추기" };
    let mgTimers = [], mgRaf = 0;
    const mgLater = (fn, ms) => mgTimers.push(later(fn, ms));
    function mgClear() { mgTimers.forEach(clearTimeout); mgTimers = []; cancelAnimationFrame(mgRaf); }
    function add(parent, tag, text, cls) {
      const e = document.createElement(tag);
      if (text != null) e.textContent = text;
      if (cls) e.className = cls;
      parent.appendChild(e); return e;
    }
    const mgBtn = (parent, text, primary) => add(parent, "button", text, "vn-mg-btn" + (primary ? " primary" : ""));
    function timerBar(card, sec, onEnd) {
      if (!(sec > 0)) return;
      const bar = add(card, "div", null, "vn-timer"), fill = add(bar, "i");
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.transition = `width ${sec}s linear`; fill.style.width = "0%"; }));
      mgLater(onEnd, sec * 1000);
    }
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    const GAMES = {
      quiz(card, c, done) {
        add(card, "p", c.question || "문제", "vn-q");
        timerBar(card, +c.time, () => done(false, 0));
        (c.options || []).forEach((o, i) => { mgBtn(card, o).onclick = () => { const ok = i === (+c.answer || 0); done(ok, ok ? 1 : 0); }; });
      },
      timing(card, c, done) {
        const rounds = +c.rounds || 3, need = Math.min(rounds, +c.need || 2), speed = Math.min(5, Math.max(1, +c.speed || 2));
        const zw = 30 - speed * 4;
        let round = 0, hits = 0, z0 = 0, t0 = 0, pos = 0, running = false;
        const info = add(card, "p", "");
        const bar = add(card, "div", null, "vn-bar"), zone = add(bar, "div", null, "vn-zone"), mark = add(bar, "div", null, "vn-mark");
        const b = mgBtn(card, "지금!", true);
        function next() {
          if (hits >= need || hits + (rounds - round) < need) return done(hits >= need, hits);
          info.textContent = `${round + 1} / ${rounds} 번째 · 성공 ${hits}번 (필요 ${need}번)`;
          z0 = 8 + Math.random() * (84 - zw); zone.style.left = z0 + "%"; zone.style.width = zw + "%";
          t0 = performance.now(); running = true; loop();
        }
        function loop() {
          if (!running || dead) return;
          const t = ((performance.now() - t0) / 1000) * speed * 0.55, ph = t % 2;
          pos = (ph < 1 ? ph : 2 - ph) * 100; mark.style.left = pos + "%";
          mgRaf = requestAnimationFrame(loop);
        }
        b.onclick = () => {
          if (!running) return;
          running = false; cancelAnimationFrame(mgRaf);
          const hit = pos >= z0 && pos <= z0 + zw;
          if (hit) hits++;
          info.textContent = hit ? "✔ 성공!" : "✘ 빗나갔어요";
          round++; mgLater(next, 700);
        };
        next();
      },
      mash(card, c, done) {
        const T = +c.time || 5, goal = +c.goal || 30;
        let n = 0, started = false, over = false;
        const big = add(card, "div", "0", "big");
        add(card, "p", `목표 ${goal}번 · ${T}초 (처음 누르는 순간 시작)`);
        const bar = add(card, "div", null, "vn-timer"), fill = add(bar, "i");
        const b = add(card, "button", "눌러!", "vn-mash");
        b.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (over) return;
          if (!started) {
            started = true;
            requestAnimationFrame(() => { fill.style.transition = `width ${T}s linear`; fill.style.width = "0%"; });
            mgLater(() => { over = true; done(n >= goal, n); }, T * 1000);
          }
          n++; big.textContent = n;
        });
      },
      memory(card, c, done) {
        const pairs = Math.min(8, Math.max(2, +c.pairs || 4));
        const EM = ["🍓", "🌙", "⭐", "🎀", "🐱", "🌸", "🍀", "🎵"];
        const deck = shuffle([...EM.slice(0, pairs), ...EM.slice(0, pairs)]);
        let open = [], found = 0, moves = 0, lock = false;
        const info = add(card, "p", "");
        timerBar(card, +c.time, () => done(false, found));
        const grid = add(card, "div", null, "vn-cards");
        if (pairs <= 3) grid.style.gridTemplateColumns = "repeat(3,1fr)";
        const upd = () => (info.textContent = `찾은 짝 ${found} / ${pairs} · 뒤집은 횟수 ${moves}`);
        deck.forEach((em) => {
          const d = add(grid, "button", "?", "vn-card");
          d.onclick = () => {
            if (lock || d.classList.contains("open")) return;
            d.classList.add("open"); d.textContent = em; open.push([d, em]);
            if (open.length === 2) {
              moves++; lock = true;
              const [a, b] = open;
              if (a[1] === b[1]) {
                a[0].classList.add("done"); b[0].classList.add("done"); found++; open = []; lock = false;
                if (found === pairs) mgLater(() => done(true, found), 400);
              } else mgLater(() => { [a, b].forEach(([x]) => { x.classList.remove("open"); x.textContent = "?"; }); open = []; lock = false; }, 700);
            }
            upd();
          };
        });
        upd();
      },
      guess(card, c, done) {
        const max = +c.max || 50, tries = +c.tries || 6, ans = 1 + Math.floor(Math.random() * max);
        let left = tries;
        const info = add(card, "p", `1 ~ ${max} · 남은 기회 ${left}번`);
        const hint = add(card, "div", "?", "big");
        const inp = add(card, "input"); inp.type = "number"; inp.inputMode = "numeric"; inp.placeholder = `1 ~ ${max}`;
        const go = () => {
          const v = Math.round(+inp.value);
          if (!v) return;
          left--;
          if (v === ans) { hint.textContent = String(ans); return done(true, tries - left); }
          if (left <= 0) { hint.textContent = `정답 ${ans}`; return mgLater(() => done(false, tries), 1000); }
          hint.textContent = v < ans ? `${v} ⬆` : `${v} ⬇`;
          info.textContent = (v < ans ? "더 큰 수예요" : "더 작은 수예요") + ` · 남은 기회 ${left}번`;
          inp.value = ""; inp.focus();
        };
        mgBtn(card, "확인", true).onclick = go;
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
      },
    };
    const SCORE_TEXT = {
      quiz: (s) => (s ? "정답!" : "오답"), timing: (s) => `${s}번 성공`, mash: (s) => `${s}번 눌렀어요`,
      memory: (s) => `짝 ${s}개`, guess: (s, w) => (w ? `${s}번 만에 맞췄어요` : "기회를 다 썼어요"),
    };

    function minigame(cmd) {
      stopSkip(); auto = false; syncButtons(); clearTimeout(autoTimer);
      waitingTap = false;
      el.box.hidden = true; el.choices.hidden = true;
      const type = cmd.minigame;
      if (!GAMES[type]) return showError(`모르는 미니게임 종류예요: "${type}"`);
      const intro = {
        quiz: "문제를 읽고 정답을 고르세요." + (cmd.time > 0 ? ` 제한 시간 ${cmd.time}초.` : ""),
        timing: `움직이는 막대가 파란 칸 안에 있을 때 [지금!]을 누르세요. ${cmd.rounds || 3}번 중 ${Math.min(cmd.rounds || 3, cmd.need || 2)}번 성공하면 이겨요.`,
        mash: `${cmd.time || 5}초 안에 버튼을 ${cmd.goal || 30}번 누르세요!`,
        memory: "같은 그림 카드 두 장을 찾아 짝을 모두 맞추세요." + (cmd.time > 0 ? ` 제한 시간 ${cmd.time}초.` : ""),
        guess: `1부터 ${cmd.max || 50} 사이의 숫자를 ${cmd.tries || 6}번 안에 맞추세요. 틀리면 더 큰지 작은지 알려줘요.`,
      }[type];
      mgClear();
      el.mg.innerHTML = ""; el.mg.hidden = false;
      const card = add(el.mg, "div", null, "vn-mg-card");
      const title = cmd.title || MG_NAMES[type];
      add(card, "h2", "🎮 " + title);
      add(card, "p", intro);
      mgBtn(card, "시작", true).onclick = () => {
        card.innerHTML = "";
        add(card, "h2", title);
        let fin = false;
        GAMES[type](card, cmd, (win, score) => { if (fin || dead) return; fin = true; mgFinish(card, cmd, win, score); });
      };
    }

    function mgFinish(card, cmd, win, score) {
      mgClear();
      card.innerHTML = "";
      add(card, "h2", win ? "🎉 성공!" : "실패…");
      add(card, "p", SCORE_TEXT[cmd.minigame](score, win));
      if (!win && cmd.retry) mgBtn(card, "다시 도전").onclick = () => minigame(cmd);
      mgBtn(card, "계속", true).onclick = () => {
        el.mg.hidden = true; el.mg.innerHTML = "";
        if (cmd.score) S.vars[cmd.score] = score;
        if (win && cmd.winSet) applySet(cmd.winSet);
        if (!win && cmd.loseSet) applySet(cmd.loseSet);
        S.log.push({ name: "🎮", text: `${cmd.title || MG_NAMES[cmd.minigame]} — ${win ? "성공" : "실패"}` });
        const t = win ? cmd.win : cmd.lose;
        if (t) jump(t); else run();
      };
    }

    function flash(color, ms) {
      el.fx.style.transition = "none"; el.fx.style.background = color; el.fx.style.opacity = 1;
      requestAnimationFrame(() => requestAnimationFrame(() => { el.fx.style.transition = `opacity ${ms}ms`; el.fx.style.opacity = 0; }));
    }
    function fadeThrough(color, cb) {
      el.fx.style.background = color; el.fx.style.transition = "opacity .7s"; el.fx.style.opacity = 1;
      later(() => { cb(); later(() => (el.fx.style.opacity = 0), 100); }, 900);
    }

    // ---------- 엔딩 / 타이틀 ----------
    function showEnding(name) {
      stopSkip(); auto = false; syncButtons();
      q(".vn-ending-name").textContent = name || "THE END";
      el.ending.hidden = false;
      const seen = load(SAVE_KEY + "_endings", []);
      if (name && !seen.includes(name)) { seen.push(name); store(SAVE_KEY + "_endings", seen); }
    }

    function toTitle() {
      S = null; clearInterval(typing); clearTimeout(autoTimer); auto = skip = false; syncButtons();
      el.ending.hidden = true; el.panel.hidden = true; el.title.hidden = false;
      const seen = load(SAVE_KEY + "_endings", []);
      q(".vn-endings").textContent = seen.length ? `🏁 본 엔딩: ${seen.join(" · ")}` : "";
    }

    function startGame(state, scene) {
      el.title.hidden = true; el.ending.hidden = true; el.panel.hidden = true;
      el.chars.innerHTML = "";
      el.bg.style.backgroundImage = ""; el.bg2.style.opacity = 0;
      el.cg.classList.remove("on");
      mgClear(); el.mg.hidden = true; el.mg.innerHTML = "";
      if (state) {
        S = JSON.parse(JSON.stringify(state));
        S.index = S.lineIndex; S.log = S.log || [];
        if (S.bg) setBg(S.bg, true);
        setCg(S.cg, S.cgFit);
        renderChars(true);
        S.log.pop();
      } else {
        S = fresh(scene);
      }
      run();
    }

    // ---------- 저장 / 불러오기 ----------
    function slotsData() { return load(SAVE_KEY, Array(SLOTS).fill(null)); }
    function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

    function openSlots(mode) {
      stopSkip(); auto = false; syncButtons();
      el.panelTitle.textContent = mode === "save" ? "💾 저장하기" : "📂 불러오기";
      el.panelBody.innerHTML = "";
      const data = slotsData();
      for (let i = 0; i < SLOTS; i++) {
        const d = data[i];
        const b = document.createElement("button");
        b.className = "vn-slot";
        b.innerHTML = d ? `<b>슬롯 ${i + 1}</b><span>${esc(d.preview)}</span><small>${esc(d.date)}</small>` : `<b>슬롯 ${i + 1}</b><span class="empty">— 비어 있음 —</span>`;
        b.onclick = () => {
          if (mode === "save") {
            if (!S) return;
            const last = S.log[S.log.length - 1];
            data[i] = { state: S, preview: last ? (last.name ? last.name + ": " : "") + String(last.text).slice(0, 40) : S.scene, date: new Date().toLocaleString("ko-KR") };
            toast(store(SAVE_KEY, data) ? "저장했어요" : "저장하지 못했어요 (브라우저 저장소를 쓸 수 없어요)");
            openSlots("save");
          } else if (d) { startGame(d.state); toast("불러왔어요"); }
        };
        el.panelBody.appendChild(b);
      }
      el.panel.hidden = false;
    }

    function openLog() {
      stopSkip(); auto = false; syncButtons();
      el.panelTitle.textContent = "📜 대사 기록";
      el.panelBody.innerHTML = "";
      (S ? S.log : []).forEach(({ name, text }) => {
        const p = document.createElement("div");
        p.className = "vn-log";
        p.innerHTML = name ? `<b style="color:${esc(colorFor(name))}">${esc(name)}</b>${esc(text)}` : `<i>${esc(text)}</i>`;
        el.panelBody.appendChild(p);
      });
      el.panel.hidden = false;
      el.panelBody.scrollTop = 1e9;
    }

    function openSettings() {
      el.panelTitle.textContent = "⚙️ 설정";
      el.panelBody.innerHTML = `
        <label class="vn-setting">글자 속도<input type="range" min="0" max="80" step="4" value="${80 - speed}"></label>
        <p class="vn-hint">오른쪽 끝 = 바로 표시</p>
        ${S ? '<button class="vn-slot vn-totitle"><b>타이틀로 돌아가기</b></button>' : ""}`;
      el.panelBody.querySelector("input").oninput = (e) => { speed = 80 - +e.target.value; store(SPEED_KEY, speed); };
      const tt = el.panelBody.querySelector(".vn-totitle");
      if (tt) tt.onclick = () => {
        if (tt.dataset.armed) return toTitle();
        tt.dataset.armed = 1; tt.innerHTML = "<b>한 번 더 누르면 타이틀로 가요 (저장 안 한 진행은 사라져요)</b>";
      };
      el.panel.hidden = false;
    }

    // ---------- 자동 / 스킵 ----------
    function stopSkip() { skip = false; syncButtons(); }
    function syncButtons() {
      q('[data-a="auto"]').classList.toggle("active", auto);
      q('[data-a="skip"]').classList.toggle("active", skip);
    }
    function toggleAuto() { auto = !auto; skip = false; syncButtons(); if (auto && waitingTap && !typing) advance(); }
    function toggleSkip() { skip = !skip; auto = false; syncButtons(); if (skip && waitingTap) { finishTyping(); advance(); } }

    let toastT;
    function toast(msg) { el.toastEl.textContent = msg; el.toastEl.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => el.toastEl.classList.remove("on"), 1600); }

    // ---------- 입력 ----------
    el.stage.addEventListener("click", (e) => {
      if (e.target.closest(".vn-menu, .vn-choices, .vn-mg")) return;
      if (auto || skip) { auto = skip = false; syncButtons(); }
      advance();
    });
    function onKey(e) {
      if (!R.isConnected) return;
      if (!el.panel.hidden) { if (e.key === "Escape") el.panel.hidden = true; return; }
      if (e.key === " " || e.key === "Enter") {
        if (e.target && /INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)) return;
        e.preventDefault(); advance();
      }
    }
    document.addEventListener("keydown", onKey);

    const actions = {
      auto: toggleAuto, skip: toggleSkip, log: openLog, save: () => openSlots("save"), load: () => openSlots("load"),
      set: openSettings, tset: openSettings, tload: () => openSlots("load"), start: () => startGame(null),
      totitle: toTitle, exit: () => opts.onExit && opts.onExit(),
    };
    R.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]");
      if (b && actions[b.dataset.a]) { e.stopPropagation(); actions[b.dataset.a](); }
    });
    q(".vn-panel-close").onclick = () => (el.panel.hidden = true);
    if (opts.onExit) R.querySelectorAll('[data-a="exit"]').forEach((b) => (b.hidden = false));

    // ---------- 시작 ----------
    q(".vn-title h1").textContent = P.title || "제목 없음";
    q(".vn-title-sub").textContent = P.subtitle || "";
    if (P.titleBg) q(".vn-title-bg").style.backgroundImage = `url("${bgSrc(P.titleBg)}")`;
    [...Object.values(BGS), ...Object.values(CGS), ...Object.values(CHARS).flatMap((c) => Object.values(c.faces || {}))]
      .forEach((ref) => { const i = new Image(); i.src = img(ref); });
    layout();
    if (opts.startScene) startGame(null, opts.startScene); else toTitle();

    return {
      destroy() {
        dead = true; mgClear(); clearInterval(typing); timers.forEach(clearTimeout);
        document.removeEventListener("keydown", onKey);
        if (ro) ro.disconnect();
        root.innerHTML = "";
      },
    };
  }

  window.VN = { mount, SAY_RE };
})();
