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
  .vn-root.vn-preview .vn-menu,.vn-root.vn-preview .vn-box,.vn-root.vn-preview .vn-title{display:none!important}
  .vn-scene{position:absolute;inset:0;transition:filter .8s}
  .vn-scene[data-tint="sepia"]{filter:sepia(.8) contrast(.95) brightness(1.02)}
  .vn-scene[data-tint="gray"]{filter:grayscale(1) contrast(1.05)}
  .vn-scene[data-tint="night"]{filter:brightness(.55) saturate(.7) hue-rotate(10deg)}
  .vn-scene[data-tint="sunset"]{filter:saturate(1.25) sepia(.25) brightness(.97)}
  .vn-scene[data-tint="dream"]{filter:blur(2px) brightness(1.1) saturate(1.1)}
  .vn-tintfx{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .8s}
  .vn-tintfx[data-tint="sepia"]{opacity:1;background:radial-gradient(ellipse at center,transparent 55%,rgba(60,35,10,.45))}
  .vn-tintfx[data-tint="gray"]{opacity:1;background:radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.35))}
  .vn-tintfx[data-tint="night"]{opacity:1;background:rgba(25,45,130,.3)}
  .vn-tintfx[data-tint="sunset"]{opacity:1;background:linear-gradient(rgba(255,140,60,.28),rgba(190,60,120,.2))}
  .vn-tintfx[data-tint="dream"]{opacity:1;background:radial-gradient(ellipse at center,transparent 45%,rgba(255,255,255,.5))}
  .vn-pfx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
  .vn-gallery{z-index:12;background:#0b0f1d;justify-content:flex-start;padding:calc(12px + env(safe-area-inset-top,0px)) 16px calc(16px + env(safe-area-inset-bottom,0px))}
  .vn-gal-head{width:min(760px,100%);display:flex;justify-content:space-between;align-items:center}
  .vn-gal-head h2{font-family:"Gowun Batang",serif;margin:0;font-size:24px}
  .vn-gal-tabs{width:min(760px,100%);display:flex;gap:6px;margin:12px 0}
  .vn-gal-tabs button{flex:1;padding:10px 4px;border-radius:10px;background:#182038;border:1px solid var(--vn-line);font-size:14px}
  .vn-gal-tabs button.on{background:var(--vn-accent);color:#0b1020;font-weight:700}
  .vn-gal-body{width:min(760px,100%);flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:10px}
  .vn-gal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
  .vn-gal-cg{aspect-ratio:16/10;border-radius:10px;border:1px solid var(--vn-line);background:#182038 center/cover no-repeat;display:flex;align-items:flex-end;padding:0;overflow:hidden}
  .vn-gal-cg span{width:100%;background:rgba(0,0,0,.6);font-size:12px;padding:4px 8px;text-align:left}
  .vn-gal-cg.locked{align-items:center;justify-content:center;font-size:28px;color:#55608a}
  .vn-gal-row{text-align:left;padding:14px;border-radius:10px;background:#182038;border:1px solid var(--vn-line);font-size:15px}
  .vn-gal-row small{display:block;opacity:.6;font-size:12px;margin-top:2px}
  .vn-gal-row.locked{opacity:.5}
  .vn-gal-count{font-size:13px;opacity:.7;margin:0}
  .vn-viewer{position:absolute;inset:0;z-index:25;background:#000 center/contain no-repeat;cursor:pointer}
  .vn-mg{position:absolute;inset:0;z-index:5;background:#000;cursor:default;overflow:hidden}
  .vn-pick-scroll{position:absolute;inset:0;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
  .vn-pick-art{position:absolute;background:center/100% 100% no-repeat}
  .vn-pick-pan{position:absolute;z-index:2;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:rgba(10,14,26,.8);border:1px solid var(--vn-line);border-radius:999px;padding:6px 14px;font-size:13px;pointer-events:none;white-space:nowrap;animation:vn-pan 2.4s ease-in-out infinite}
  @keyframes vn-pan{50%{transform:translateX(calc(-50% + 8px))}}
  .vn-obj{position:absolute;transform:translate(-50%,-50%);padding:0;border:0;background:none;display:flex;flex-direction:column;align-items:center;touch-action:manipulation}
  .vn-obj img{width:100%;display:block;filter:drop-shadow(0 0 6px rgba(255,255,255,.7));pointer-events:none}
  .vn-obj .mk{width:100%;aspect-ratio:1;border-radius:50%;border:2px solid #fff;background:radial-gradient(circle,rgba(255,255,255,.6),rgba(143,211,255,.2) 55%,transparent 70%);box-shadow:0 0 12px rgba(255,255,255,.7);animation:vn-pulse 1.6s ease-in-out infinite}
  @keyframes vn-pulse{50%{transform:scale(1.12);opacity:.75}}
  .vn-obj.hid .mk,.vn-obj.hid img{opacity:0;animation:none;box-shadow:none}
  .vn-obj .lb{margin-top:4px;font-size:12px;line-height:1.3;background:rgba(10,14,26,.8);border:1px solid var(--vn-line);padding:2px 8px;border-radius:999px;white-space:nowrap;pointer-events:none}
  .vn-obj.picked{pointer-events:none}.vn-obj.picked .mk,.vn-obj.picked img{opacity:.3;animation:none}
  .vn-obj.picked::after{content:"✔";position:absolute;top:0;right:-4px;font-size:18px;color:#8fffb0;text-shadow:0 0 4px #000}
  .vn-pick-top{position:absolute;z-index:2;top:calc(8px + env(safe-area-inset-top,0px));left:8px;right:8px;display:flex;gap:8px;align-items:flex-start;justify-content:space-between;pointer-events:none}
  .vn-pick-top>*{pointer-events:auto}
  .vn-pick-ttl{background:rgba(10,14,26,.8);border:1px solid var(--vn-line);padding:8px 14px;border-radius:12px;font-size:14px;line-height:1.4}
  .vn-pick-ttl b{display:block;font-size:15px}
  .vn-pick-end{background:var(--vn-accent);color:#0b1020;border:0;border-radius:12px;padding:10px 14px;font-weight:700;font-size:14px;white-space:nowrap}
  .vn-pick-msg{z-index:3;cursor:pointer}
  `;

  const HTML = `
  <div class="vn-stage">
    <div class="vn-scene">
      <div class="vn-bg"></div><div class="vn-bg vn-bg2"></div>
      <div class="vn-chars"></div>
      <div class="vn-cg"></div>
    </div>
    <div class="vn-tintfx"></div>
    <canvas class="vn-pfx"></canvas>
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
    <button class="vn-tbtn" data-a="gallery">회상방</button>
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
  <div class="vn-overlay vn-gallery" hidden>
    <div class="vn-gal-head"><h2>회상방</h2><button class="vn-panel-close" data-a="galclose" aria-label="닫기">✕</button></div>
    <div class="vn-gal-tabs"><button data-g="cg">이벤트 그림</button><button data-g="scene">장면 다시 보기</button><button data-g="end">엔딩</button></div>
    <div class="vn-gal-body"></div>
  </div>
  <div class="vn-viewer" hidden></div>
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
      cg: q(".vn-cg"), scene: q(".vn-scene"), tintfx: q(".vn-tintfx"), pfx: q(".vn-pfx"),
      gallery: q(".vn-gallery"), galBody: q(".vn-gal-body"), viewer: q(".vn-viewer"), box: q(".vn-box"), name: q(".vn-name"), text: q(".vn-text"), next: q(".vn-next"),
      choices: q(".vn-choices"), mg: q(".vn-mg"), fx: q(".vn-fx"), title: q(".vn-title"), ending: q(".vn-ending"),
      panel: q(".vn-panel"), panelTitle: q(".vn-panel-title"), panelBody: q(".vn-panel-body"), toastEl: q(".vn-toast"),
    };

    // 묶음 { group, blocks: [...] } 은 안의 블록들을 차례대로 펼쳐서 실행해요
    const flatten = (l) => (Array.isArray(l) ? l : []).flatMap((b) => (b && typeof b === "object" && !Array.isArray(b) && Array.isArray(b.blocks) && b.group !== undefined ? flatten(b.blocks) : [b]));
    const STORY = {};
    for (const [k, l] of Object.entries(P.story || {})) STORY[k] = flatten(l);
    const CHARS = P.characters || {};
    const BGS = P.backgrounds || {};
    const CGS = P.cgs || {};
    const SLOTS = 6;
    const SAVE_KEY = "vn_save_" + (P.title || "game");
    const SPEED_KEY = "vn_speed";

    let replay = null; // 회상방에서 다시 보는 장면
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

    function layout() { R.classList.toggle("portrait", R.clientHeight > R.clientWidth); if (pfx.ctx) pfxResize(); }
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

    function unlock(kind, name) {
      if (!name) return;
      const k = SAVE_KEY + "_" + kind, l = load(k, []);
      if (!l.includes(name)) { l.push(name); store(k, l); }
    }
    const isOpen = (kind, name) => !!opts.unlockAll || load(SAVE_KEY + "_" + kind, []).includes(name);

    function setCg(name, fit) {
      if (name && CGS[name]) unlock("cg", name);
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
      if (replay && scene !== replay) return endReplay();
      unlock("seen", scene);
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
        if (cmd.particles !== undefined) particles(cmd);
        if (cmd.tint !== undefined) setTint(cmd.tint);
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

    // ---------- 화면 색감 ----------
    function setTint(t) { S.tint = t || ""; el.scene.dataset.tint = S.tint; el.tintfx.dataset.tint = S.tint; }

    // ---------- 입자 효과 ----------
    // 모양마다 움직임이 달라요. mode: fall(화면 전체) / spread(한 지점에서 계속) / burst(한 지점에서 한 번 펑)
    const PFX_COLOR = {
      petal: "#ffb7c5", snow: "#ffffff", sparkle: "#fff3a8", heart: "#ff6b8b", rain: "#a8c8ff", dot: "#8fd3ff", steam: "#ffffff",
      drip: "#9fd4ff", smoke: "#2b2b31", fog: "#e6ecf2", storm: "#b8c8e8", ember: "#ff8a3d", leaf: "", firefly: "#d8ff7a", bubble: "#bfefff", confetti: "",
    };
    const PALETTE = { leaf: ["#d9822b", "#c0392b", "#e0a82e", "#8e5b2a", "#b5651d"], confetti: ["#ff5d8f", "#ffd23f", "#3bceac", "#5d9cec", "#ac92eb", "#ff8a5c"] };
    const RATE_FALL = { rain: 70, storm: 140, sparkle: 12, dot: 12, steam: 6, smoke: 7, fog: 1.1, drip: 4, ember: 14, leaf: 6, firefly: 3, bubble: 6, confetti: 25 };
    const RATE_POINT = { steam: 5, smoke: 11, fog: 1.2, drip: 3, ember: 25, firefly: 4, bubble: 8, confetti: 30, rain: 40, storm: 50 };
    const BURST = { steam: 10, smoke: 14, fog: 6, drip: 16, confetti: 60, ember: 40, firefly: 15, bubble: 18 };
    const pfx = { list: [], emit: null, raf: 0, last: 0, acc: 0, ctx: null, w: 0, h: 0, dpr: 1, bolt: 0 };
    function pfxResize() {
      pfx.dpr = Math.min(2, window.devicePixelRatio || 1);
      pfx.w = R.clientWidth || 1; pfx.h = R.clientHeight || 1;
      el.pfx.width = Math.round(pfx.w * pfx.dpr); el.pfx.height = Math.round(pfx.h * pfx.dpr);
      pfx.ctx = el.pfx.getContext("2d");
    }
    function particles(cmd) {
      if (!cmd || !cmd.particles || cmd.particles === "off") { pfx.emit = null; if (S) S.pfx = null; return; }
      pfxResize();
      const shape = cmd.particles in PFX_COLOR ? cmd.particles : "dot";
      const c = {
        shape, mode: cmd.mode || "fall", color: cmd.color || PFX_COLOR[shape] || "",
        x: cmd.x == null ? 50 : +cmd.x, y: cmd.y == null ? 50 : +cmd.y,
        amount: Math.min(3, Math.max(1, +cmd.amount || 2)),
      };
      if (c.mode === "burst") for (let i = 0; i < c.amount * (BURST[shape] || 28); i++) spawn(c);
      else {
        pfx.emit = c; pfx.bolt = performance.now() + 1500; if (S) S.pfx = cmd;
        // 안개 · 반딧불은 천천히 생겨서, 처음부터 어느 정도 깔려 있게 미리 만들어 둬요
        const warm = c.mode === "fall" ? { fog: 7, firefly: 8 }[shape] : 0;
        for (let i = 0; i < (warm || 0) * c.amount; i++) { spawn(c); const q = pfx.list[pfx.list.length - 1]; if (q) { q.life = q.max * (0.15 + Math.random() * 0.5); q.x = Math.random() * pfx.w; } }
      }
      if (!pfx.raf) { pfx.last = performance.now(); pfx.raf = requestAnimationFrame(tick); }
    }
    function pfxStop() { pfx.emit = null; pfx.list = []; cancelAnimationFrame(pfx.raf); pfx.raf = 0; if (pfx.ctx) pfx.ctx.clearRect(0, 0, el.pfx.width, el.pfx.height); }

    function spawn(c) {
      if (pfx.list.length > 700) return;
      const W = pfx.w, H = pfx.h, u = Math.max(0.7, Math.min(W, H) / 420), rnd = Math.random;
      const fall = c.mode === "fall", burst = c.mode === "burst";
      const px = (W * c.x) / 100, py = (H * c.y) / 100;
      const pal = PALETTE[c.shape];
      const p = { shape: c.shape, color: c.color || (pal ? pal[(rnd() * pal.length) | 0] : "#ffffff"), x: px, y: py, vx: 0, vy: 0, g: 0, drag: 0,
        life: 0, max: 3, size: 6 * u, rot: rnd() * 6.28, vr: (rnd() - 0.5) * 3, sway: rnd() * 6.28, swayAmp: 0, fade: true, alphaMul: 1, grow: 0, wander: 0 };
      const radial = (lo, hi) => { const an = rnd() * 6.28, sp = (lo + rnd() * (hi - lo)) * u; p.vx = Math.cos(an) * sp; p.vy = Math.sin(an) * sp; };
      const up = (cone, lo, hi) => { const an = -Math.PI / 2 + (rnd() - 0.5) * cone, sp = (lo + rnd() * (hi - lo)) * u; p.vx = Math.cos(an) * sp; p.vy = Math.sin(an) * sp; };
      const fromTop = () => { p.x = rnd() * W * 1.2 - W * 0.1; p.y = -20; };
      const fromBottom = () => { p.x = rnd() * W; p.y = H + 20; };
      const point = (lo, hi) => { radial(burst ? hi * 0.9 : lo, burst ? hi * 2.7 : hi); p.drag = burst ? 2.2 : 0.35; p.max = burst ? 1.4 + rnd() * 1.4 : 2.2 + rnd() * 2.2; };
      switch (c.shape) {
        case "petal": case "heart": case "leaf":
          p.size = (5 + rnd() * 6) * u * (c.shape === "leaf" ? 1.25 : 1); p.swayAmp = 0.5;
          if (fall) { fromTop(); p.vx = (rnd() * 45 - 10) * u; p.vy = (35 + rnd() * 45) * u; p.max = 40; p.fade = false; }
          else { point(40, 170); p.g = 35 * u; }
          break;
        case "snow":
          p.size = (3 + rnd() * 3.5) * u; p.swayAmp = 0.5;
          if (fall) { fromTop(); p.vx = (rnd() * 30 - 10) * u; p.vy = (30 + rnd() * 40) * u; p.max = 40; p.fade = false; }
          else { point(40, 170); p.g = 35 * u; }
          break;
        case "sparkle": case "dot":
          p.size = (5 + rnd() * 6) * u * (c.shape === "dot" ? 0.5 : 1);
          if (fall) { p.x = rnd() * W; p.y = rnd() * H; p.vx = (rnd() - 0.5) * 20 * u; p.vy = -(10 + rnd() * 25) * u; p.max = 2 + rnd() * 2.5; }
          else { point(40, 170); p.g = 8 * u; }
          break;
        case "rain": case "storm": {
          const heavy = c.shape === "storm";
          if (fall) { fromTop(); p.vx = (heavy ? -170 : -50) * u; p.vy = ((heavy ? 950 : 650) + rnd() * 300) * u; p.max = 3; p.fade = false; }
          else { p.x = px + (rnd() - 0.5) * 50 * u; p.vx = (rnd() - 0.5) * 30 * u; p.vy = (300 + rnd() * 300) * u; p.g = 400 * u; p.max = 1.6; p.fade = false; }
          break;
        }
        case "steam":
          p.size = (14 + rnd() * 14) * u; p.grow = 1.2 + rnd() * 1.2; p.drag = 0.3; p.g = -6 * u; p.alphaMul = 0.2;
          if (fall) { fromBottom(); p.vx = (rnd() - 0.5) * 16 * u; p.vy = -(25 + rnd() * 35) * u; p.max = 4 + rnd() * 3; }
          else { up(burst ? 1.8 : 1.0, burst ? 70 : 22, burst ? 180 : 60); p.x += (rnd() - 0.5) * 36 * u; p.max = burst ? 1.8 + rnd() * 1.2 : 2.4 + rnd() * 1.8; }
          break;
        case "smoke":
          p.size = (18 + rnd() * 20) * u; p.grow = 1.5 + rnd() * 2; p.alphaMul = 0.8; p.g = -4 * u; p.drag = 0.4; p.swayAmp = 0.6; p.dense = true;
          if (fall) { fromBottom(); p.vx = (rnd() - 0.5) * 20 * u; p.vy = -(20 + rnd() * 30) * u; p.max = 5 + rnd() * 3; }
          else if (burst) { radial(60, 220); p.drag = 1.6; p.max = 2 + rnd() * 1.5; }
          else { up(0.55, 55, 120); p.x += (rnd() - 0.5) * 16 * u; p.max = 3.5 + rnd() * 2.5; p.g = -12 * u; p.drag = 0.25; p.size *= 0.75; p.grow = 2.6 + rnd() * 2; p.swayAmp = 1.2; }
          break;
        case "fog":
          p.size = (0.4 + rnd() * 0.4) * W; p.alphaMul = 0.38; p.envelope = true; p.fade = false; p.dense = true;
          if (fall) { const dir = rnd() < 0.5 ? 1 : -1; p.y = H * (0.15 + rnd() * 0.85); p.x = rnd() * W; p.vx = dir * (8 + rnd() * 14) * u; p.vy = (rnd() - 0.5) * 3 * u; p.max = 14 + rnd() * 10; }
          else { radial(burst ? 30 : 8, burst ? 90 : 30); p.drag = burst ? 0.8 : 0.1; p.max = burst ? 4 + rnd() * 3 : 8 + rnd() * 6; p.size *= 0.6; }
          break;
        case "drip":
          p.size = (3.4 + rnd() * 2) * u; p.g = 900 * u; p.splash = true; p.ground = H * (0.78 + rnd() * 0.2); p.max = 6; p.fade = false;
          if (fall) { p.x = rnd() * W; p.y = -10; p.vy = (50 + rnd() * 150) * u; }
          else if (burst) { radial(120, 380); p.vy -= 200 * u; p.g = 700 * u; p.splash = false; p.fade = true; p.max = 1.2 + rnd(); p.size *= 0.7; }
          else { p.x = px + (rnd() - 0.5) * 6 * u; p.vy = 0; p.ground = Math.max(py + 20 * u, H * (0.8 + rnd() * 0.15)); }
          break;
        case "ember":
          p.size = (2.2 + rnd() * 2.6) * u; p.glow = true; p.wander = 60 * u; p.flicker = true;
          if (fall) { fromBottom(); p.vx = (rnd() - 0.5) * 30 * u; p.vy = -(50 + rnd() * 90) * u; p.max = 3 + rnd() * 3; }
          else if (burst) { radial(150, 420); p.drag = 1.8; p.g = 120 * u; p.max = 1 + rnd() * 1.4; }
          else { up(0.9, 60, 160); p.g = -10 * u; p.max = 1.5 + rnd() * 2; }
          break;
        case "firefly":
          p.size = (3 + rnd() * 2.4) * u; p.glow = true; p.wander = 40 * u; p.blink = true; p.envelope = true; p.fade = false; p.drag = 0.5;
          if (fall) { p.x = rnd() * W; p.y = H * (0.25 + rnd() * 0.75); p.max = 5 + rnd() * 5; }
          else { const an = rnd() * 6.28, r = rnd() * (burst ? 120 : 60) * u; p.x = px + Math.cos(an) * r; p.y = py + Math.sin(an) * r; radial(5, burst ? 60 : 25); p.max = 4 + rnd() * 4; }
          break;
        case "bubble":
          p.size = (4 + rnd() * 8) * u; p.swayAmp = 0.7;
          if (fall) { fromBottom(); p.vy = -(30 + rnd() * 50) * u; p.max = 4 + rnd() * 5; p.fade = false; }
          else { up(burst ? 2.4 : 0.8, burst ? 60 : 30, burst ? 180 : 80); p.drag = burst ? 1 : 0.2; p.g = -15 * u; p.max = 2.5 + rnd() * 2.5; }
          break;
        case "confetti":
          p.size = (6 + rnd() * 5) * u; p.vr = (rnd() - 0.5) * 10;
          if (fall) { fromTop(); p.vx = (rnd() - 0.5) * 60 * u; p.vy = (60 + rnd() * 60) * u; p.max = 30; p.fade = false; p.swayAmp = 0.6; }
          else { up(burst ? 1.6 : 1.0, burst ? 300 : 200, burst ? 700 : 450); p.drag = burst ? 1.8 : 1.5; p.g = (burst ? 420 : 380) * u; p.max = 2.4 + rnd() * 1.5; }
          break;
      }
      pfx.list.push(p);
    }
    function splash(p) {
      const u = Math.max(0.7, Math.min(pfx.w, pfx.h) / 420), n = 3 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) pfx.list.push({ shape: "drip", color: p.color, x: p.x, y: p.ground, vx: (Math.random() - 0.5) * 160 * u, vy: -(80 + Math.random() * 140) * u,
        g: 900 * u, drag: 0, life: 0, max: 0.45 + Math.random() * 0.2, size: p.size * 0.45, rot: 0, vr: 0, sway: 0, swayAmp: 0, fade: true, alphaMul: 1, grow: 0, wander: 0 });
    }

    function rgba(hex, al) {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
      if (!m) return hex;
      const n = parseInt(m[1], 16);
      return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${al})`;
    }
    function soft(ctx, r, color, a, dense) {
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      if (dense) { gr.addColorStop(0, rgba(color, 1)); gr.addColorStop(0.35, rgba(color, 0.85)); gr.addColorStop(0.7, rgba(color, 0.35)); gr.addColorStop(1, rgba(color, 0)); }
      else { gr.addColorStop(0, color); gr.addColorStop(1, "rgba(255,255,255,0)"); }
      ctx.globalAlpha = a; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.29); ctx.fill();
    }
    function drawP(ctx, p, a) {
      const s = p.size;
      ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
      ctx.save(); ctx.translate(p.x, p.y);
      switch (p.shape) {
        case "petal":
          ctx.rotate(p.rot); ctx.scale(1, 0.55 + 0.45 * Math.sin(p.sway * 1.6));
          ctx.beginPath(); ctx.moveTo(0, -s);
          ctx.quadraticCurveTo(s * 0.95, -s * 0.15, s * 0.15, s); ctx.lineTo(0, s * 0.75); ctx.lineTo(-s * 0.15, s);
          ctx.quadraticCurveTo(-s * 0.95, -s * 0.15, 0, -s); ctx.fill(); break;
        case "leaf":
          ctx.rotate(p.rot); ctx.scale(1, 0.5 + 0.5 * Math.sin(p.sway * 1.3));
          ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.85, 0, 0, s); ctx.quadraticCurveTo(-s * 0.85, 0, 0, -s); ctx.fill();
          ctx.strokeStyle = "rgba(60,30,10,.45)"; ctx.lineWidth = Math.max(0.8, s * 0.08); ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s * 1.25); ctx.stroke(); break;
        case "heart":
          ctx.rotate(Math.sin(p.sway) * 0.4); ctx.scale(s / 10, s / 10);
          ctx.beginPath(); ctx.moveTo(0, 3);
          ctx.bezierCurveTo(-10, -4, -5, -11, 0, -5); ctx.bezierCurveTo(5, -11, 10, -4, 0, 3); ctx.lineTo(0, 7); ctx.fill(); break;
        case "sparkle": {
          ctx.rotate(p.rot * 0.3); const k = s * (0.7 + 0.3 * Math.sin(p.life * 12));
          ctx.beginPath();
          for (let i = 0; i < 8; i++) { const r = i % 2 ? k * 0.22 : k; const an = (i * Math.PI) / 4; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
          ctx.closePath(); ctx.fill(); break;
        }
        case "rain": case "storm":
          ctx.lineWidth = p.shape === "storm" ? 1.7 : 1.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-p.vx * 0.025, -p.vy * 0.025); ctx.stroke(); break;
        case "steam":
          soft(ctx, s * (1 + (p.life / p.max) * p.grow), p.color, a * p.alphaMul * Math.min(1, p.life / 0.5)); break;
        case "smoke":
          soft(ctx, s * (1 + (p.life / p.max) * p.grow), p.color, a * p.alphaMul * Math.min(1, p.life / 0.4), true); break;
        case "fog":
          ctx.scale(1, 0.32); soft(ctx, s, p.color, a * p.alphaMul, true); break;
        case "drip": {
          const st = 1 + Math.min(1, Math.abs(p.vy) / 700) * 0.7;
          ctx.scale(1, st);
          ctx.beginPath(); ctx.moveTo(0, -s * 2.1);
          ctx.bezierCurveTo(s * 1.1, -s * 0.5, s, s, 0, s); ctx.bezierCurveTo(-s, s, -s * 1.1, -s * 0.5, 0, -s * 2.1); ctx.fill();
          ctx.globalAlpha = a * 0.7; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.1, s * 0.28, 0, 6.29); ctx.fill(); break;
        }
        case "ember": case "firefly":
          ctx.globalCompositeOperation = "lighter";
          soft(ctx, s * 3.4, p.color, a * 0.95);
          ctx.globalAlpha = a; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, 6.29); ctx.fill();
          break;
        case "bubble":
          ctx.lineWidth = Math.max(1, s * 0.12); ctx.fillStyle = "rgba(255,255,255,.08)";
          ctx.beginPath(); ctx.arc(0, 0, s, 0, 6.29); ctx.fill(); ctx.stroke();
          ctx.globalAlpha = a * 0.8; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.35, s * 0.22, 0, 6.29); ctx.fill(); break;
        case "confetti":
          ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.sway * 3)); ctx.fillRect(-s / 2, -s / 4, s, s / 2); break;
        case "snow": case "dot": default:
          soft(ctx, s, p.color, a);
      }
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";
    }
    function tick(now) {
      if (dead || !R.isConnected) { pfx.raf = 0; return; }
      const dt = Math.min(0.05, (now - pfx.last) / 1000); pfx.last = now;
      const e = pfx.emit;
      if (e) {
        const rate = (e.mode === "fall" ? RATE_FALL[e.shape] || 9 : RATE_POINT[e.shape] || 20) * e.amount;
        pfx.acc += rate * dt;
        while (pfx.acc >= 1) { spawn(e); pfx.acc--; }
        // 폭우: 가끔 번개가 번쩍
        if (e.shape === "storm" && now > pfx.bolt) {
          pfx.bolt = now + 3500 + Math.random() * 5000;
          flash("rgba(235,240,255,.85)", 320);
          later(() => flash("rgba(235,240,255,.6)", 420), 140);
        }
      }
      const ctx = pfx.ctx, W = pfx.w, H = pfx.h;
      ctx.setTransform(pfx.dpr, 0, 0, pfx.dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      pfx.list = pfx.list.filter((p) => {
        p.life += dt;
        if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
        p.vy += p.g * dt;
        if (p.wander) { p.vx += (Math.random() - 0.5) * p.wander * dt * 8; p.vy += (Math.random() - 0.5) * p.wander * dt * 8; }
        p.sway += dt * 2.2; p.rot += p.vr * dt;
        p.x += p.vx * dt + (p.swayAmp ? Math.sin(p.sway) * p.swayAmp : 0);
        p.y += p.vy * dt;
        if (p.splash && p.y >= p.ground) { splash(p); return false; }
        const m = p.size * (1 + (p.grow || 0)) + 40;
        if (p.life > p.max || p.y > H + m || p.y < -m - 40 || p.x < -m || p.x > W + m) return false;
        let a = p.envelope ? Math.sin(Math.PI * Math.min(1, p.life / p.max)) : p.fade ? Math.max(0, 1 - p.life / p.max) : 0.9;
        a *= Math.min(1, p.life / 0.15);
        if (p.blink) a *= 0.35 + 0.65 * Math.max(0, Math.sin(p.life * 2.5 + p.rot * 3));
        if (p.flicker) a *= 0.7 + 0.3 * Math.random();
        drawP(ctx, p, a);
        return true;
      });
      ctx.globalAlpha = 1;
      if (!pfx.list.length && !pfx.emit) { pfx.raf = 0; ctx.clearRect(0, 0, W, H); return; }
      pfx.raf = requestAnimationFrame(tick);
    }

    // ---------- 회상방 ----------
    function endingNames() {
      const out = [];
      for (const l of Object.values(STORY)) (l || []).forEach((b) => { if (b && typeof b === "object" && b.end !== undefined && !out.includes(b.end || "THE END")) out.push(b.end || "THE END"); });
      return out;
    }
    let galTabNow = "cg";
    function openGallery(tab) {
      el.gallery.hidden = false;
      galTab(tab || galTabNow);
    }
    function galTab(t) {
      galTabNow = t;
      R.querySelectorAll(".vn-gal-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.g === t));
      const B = el.galBody; B.innerHTML = "";
      const count = (n, all) => add(B, "p", `${n} / ${all} 열림`, "vn-gal-count");
      if (t === "cg") {
        const names = Object.keys(CGS);
        if (!names.length) return add(B, "p", "이 게임에는 이벤트 그림이 없어요.", "vn-gal-count");
        count(names.filter((n) => isOpen("cg", n)).length, names.length);
        const grid = add(B, "div", null, "vn-gal-grid");
        names.forEach((n) => {
          if (isOpen("cg", n)) {
            const b = add(grid, "button", null, "vn-gal-cg");
            b.style.backgroundImage = `url("${img(CGS[n])}")`;
            add(b, "span", n);
            b.onclick = () => { el.viewer.style.backgroundImage = `url("${img(CGS[n])}")`; el.viewer.hidden = false; };
          } else add(grid, "div", "?", "vn-gal-cg locked");
        });
      } else if (t === "scene") {
        const mem = (P.memories || []).filter((m) => STORY[m.scene]);
        if (!mem.length) return add(B, "p", "다시 볼 수 있는 장면이 없어요.", "vn-gal-count");
        count(mem.filter((m) => isOpen("seen", m.scene)).length, mem.length);
        mem.forEach((m) => {
          if (isOpen("seen", m.scene)) {
            const b = add(B, "button", "▶ " + (m.title || m.scene), "vn-gal-row");
            b.onclick = () => startReplay(m.scene);
          } else { const d = add(B, "div", "??? ", "vn-gal-row locked"); add(d, "small", "아직 보지 못한 장면"); }
        });
      } else {
        const names = endingNames();
        if (!names.length) return add(B, "p", "엔딩이 없어요.", "vn-gal-count");
        count(names.filter((n) => isOpen("endings", n)).length, names.length);
        names.forEach((n) => {
          const open = isOpen("endings", n);
          add(B, "div", open ? "🏁 " + n : "??? ", "vn-gal-row" + (open ? "" : " locked"));
        });
      }
    }
    function startReplay(scene) {
      el.gallery.hidden = true;
      replay = scene;
      startGame(null, scene);
      toast("회상 중 · 장면이 끝나면 회상방으로 돌아가요");
    }
    function endReplay() {
      toTitle();
      openGallery("scene");
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

    // ---------- 미니게임: 그림 속 오브젝트 고르기 ----------
    // 일러스트 위에 오브젝트(선택지)를 놓고, 고르는 것에 따라 변수가 바뀌어요.
    const ITEMS = P.items || {};
    let mgTimers = [];
    const mgLater = (fn, ms) => mgTimers.push(later(fn, ms));
    let mgFit = null, mgRO = null;
    function mgClear() { mgTimers.forEach(clearTimeout); mgTimers = []; if (mgFit) window.removeEventListener("resize", mgFit); mgFit = null; if (mgRO) mgRO.disconnect(); mgRO = null; }
    function add(parent, tag, text, cls) {
      const e = document.createElement(tag);
      if (text != null) e.textContent = text;
      if (cls) e.className = cls;
      parent.appendChild(e); return e;
    }

    function minigame(cmd) {
      if (cmd.minigame !== "pick") return showError(`이 미니게임 종류("${cmd.minigame}")는 더 이상 쓰지 않아요. 창작기에서 새 미니게임 블록으로 바꿔 주세요.`);
      stopSkip(); auto = false; syncButtons(); clearTimeout(autoTimer);
      waitingTap = false;
      el.box.hidden = true; el.choices.hidden = true;
      mgClear();
      const M = el.mg; M.innerHTML = ""; M.hidden = false;
      const objs = (cmd.objects || []).filter(Boolean);
      const limit = Math.max(0, +cmd.picks || 0);
      let picked = 0, busy = false;

      // 일러스트: 그림 비율을 지키면서 화면에 맞추고, 오브젝트는 그림 위 % 위치에 놓아요
      const scroller = add(M, "div", null, "vn-pick-scroll");
      const art = add(scroller, "div", null, "vn-pick-art");
      const pan = add(M, "div", "← 옆으로 밀어서 둘러보세요 →", "vn-pick-pan"); pan.hidden = true;
      const src = img(CGS[cmd.image] || BGS[cmd.image] || ITEMS[cmd.image] || cmd.image || "");
      let ratio = 16 / 9;
      // 세로 화면에서 가로로 긴 그림이 너무 작아지면, 화면 높이에 맞추고 옆으로 밀어서 보게 해요
      let panned = false;
      const fit = () => {
        const W = M.clientWidth, H = M.clientHeight;
        let w = W, h = W / ratio;
        if (h > H) { h = H; w = H * ratio; }
        const wide = h < H * 0.62;
        if (wide) { h = H * 0.86; w = h * ratio; if (w <= W) { w = W; h = W / ratio; } }
        Object.assign(art.style, { width: w + "px", height: h + "px", left: Math.max(0, (W - w) / 2) + "px", top: (H - h) / 2 + "px" });
        const scrolls = w > W + 1;
        pan.hidden = !scrolls || panned;
        if (scrolls && !panned) scroller.scrollLeft = (w - W) / 2;
      };
      scroller.addEventListener("scroll", () => { if (!pan.hidden && Math.abs(scroller.scrollLeft - (art.offsetWidth - M.clientWidth) / 2) > 20) { panned = true; pan.hidden = true; } }, { passive: true });
      if (src) {
        art.style.backgroundImage = `url("${src}")`;
        const im = new Image();
        im.onload = () => { if (im.naturalWidth) ratio = im.naturalWidth / im.naturalHeight; fit(); };
        im.src = src;
      }
      fit(); mgFit = fit; window.addEventListener("resize", fit);
      if (window.ResizeObserver) { mgRO = new ResizeObserver(fit); mgRO.observe(M); }

      const top = add(M, "div", null, "vn-pick-top");
      const ttl = add(top, "div", null, "vn-pick-ttl");
      add(ttl, "b", cmd.title || "무엇을 고를까?");
      const info = add(ttl, "span", "");
      const endBtn = add(top, "button", "다 골랐어요", "vn-pick-end");
      endBtn.hidden = limit > 0;
      endBtn.onclick = (e) => { e.stopPropagation(); if (!busy) finish(); };
      const upd = () => (info.textContent = limit ? `${limit}개 고를 수 있어요 · 남은 ${limit - picked}개` : (cmd.hint || "마음에 드는 것을 눌러 보세요"));
      if (cmd.hint && limit) info.textContent = cmd.hint;
      upd();

      // 고른 뒤 보여줄 말풍선 (기존 대사 창 모양 그대로)
      const msg = add(M, "div", null, "vn-box vn-pick-msg"); msg.hidden = true;
      const mName = add(msg, "div", null, "vn-name"), mText = add(msg, "div", null, "vn-text");
      add(msg, "div", "▼", "vn-next on");
      let after = null;
      msg.onclick = (e) => { e.stopPropagation(); msg.hidden = true; busy = false; const f = after; after = null; if (f) f(); };

      objs.forEach((o) => {
        const b = add(art, "button", null, "vn-obj" + (o.hidden ? " hid" : ""));
        b.setAttribute("aria-label", o.name || "오브젝트");
        b.style.left = (o.x == null ? 50 : o.x) + "%";
        b.style.top = (o.y == null ? 50 : o.y) + "%";
        b.style.width = (o.size || 12) + "%";
        const isrc = o.item ? img(ITEMS[o.item] || o.item) : "";
        if (isrc) { const i = add(b, "img"); i.src = isrc; i.alt = ""; } else add(b, "div", null, "mk");
        if (cmd.labels && o.name && !o.hidden) add(b, "span", o.name, "lb");
        b.onclick = (e) => {
          e.stopPropagation();
          if (busy || b.classList.contains("picked")) return;
          if (o.once !== false) b.classList.add("picked");
          if (o.hidden && cmd.labels && o.name) add(b, "span", o.name, "lb");
          b.classList.remove("hid");
          if (o.set) applySet(o.set);
          picked++; upd();
          S.log.push({ name: "🔍", text: o.name || "?" });
          const next = () => {
            if (o.goto) return finish(o.goto);
            const left = objs.length - art.querySelectorAll(".vn-obj.picked").length;
            if ((limit && picked >= limit) || (o.once !== false && left <= 0)) finish();
          };
          if (o.text) {
            busy = true;
            mName.textContent = o.say || o.name || ""; mName.hidden = !(o.say || o.name);
            mName.style.color = colorFor(o.say || "");
            mText.textContent = o.text;
            msg.hidden = false; after = next;
          } else next();
        };
      });
      if (!objs.length) endBtn.hidden = false;

      function finish(target) {
        mgClear();
        M.hidden = true; M.innerHTML = "";
        S.log.push({ name: "🎮", text: `${cmd.title || "미니게임"} — ${picked}개 골랐어요` });
        if (cmd.score) S.vars[cmd.score] = picked;
        const t = target || cmd.goto;
        if (t) jump(t); else run();
      }
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
      if (replay) return endReplay();
      stopSkip(); auto = false; syncButtons();
      q(".vn-ending-name").textContent = name || "THE END";
      el.ending.hidden = false;
      const seen = load(SAVE_KEY + "_endings", []);
      if (name && !seen.includes(name)) { seen.push(name); store(SAVE_KEY + "_endings", seen); }
    }

    function toTitle() {
      replay = null; pfxStop();
      el.scene.dataset.tint = ""; el.tintfx.dataset.tint = "";
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
      pfxStop(); el.scene.dataset.tint = ""; el.tintfx.dataset.tint = "";
      if (!scene) replay = null;
      if (state) {
        S = JSON.parse(JSON.stringify(state));
        S.index = S.lineIndex; S.log = S.log || [];
        if (S.bg) setBg(S.bg, true);
        setCg(S.cg, S.cgFit);
        setTint(S.tint);
        if (S.pfx) particles(S.pfx);
        renderChars(true);
        S.log.pop();
      } else {
        S = fresh(scene);
        unlock("seen", S.scene);
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
            if (replay) return toast("회상 중에는 저장할 수 없어요");
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
      totitle: toTitle, gallery: () => openGallery(), galclose: () => (el.gallery.hidden = true), exit: () => opts.onExit && opts.onExit(),
    };
    R.addEventListener("click", (e) => {
      const g = e.target.closest("[data-g]");
      if (g) { e.stopPropagation(); return galTab(g.dataset.g); }
      const b = e.target.closest("[data-a]");
      if (b && actions[b.dataset.a]) { e.stopPropagation(); actions[b.dataset.a](); }
    });
    q(".vn-panel .vn-panel-close").onclick = () => (el.panel.hidden = true);
    el.viewer.onclick = () => (el.viewer.hidden = true);
    if (P.gallery === false) q('[data-a="gallery"]').hidden = true;
    if (opts.onExit) R.querySelectorAll('[data-a="exit"]').forEach((b) => (b.hidden = false));
    if (opts.preview) R.classList.add("vn-preview"); // 창작기 미리보기: 메뉴와 대사 창 숨김

    // ---------- 시작 ----------
    q(".vn-title h1").textContent = P.title || "제목 없음";
    q(".vn-title-sub").textContent = P.subtitle || "";
    if (P.titleBg) q(".vn-title-bg").style.backgroundImage = `url("${bgSrc(P.titleBg)}")`;
    [...Object.values(BGS), ...Object.values(CGS), ...Object.values(CHARS).flatMap((c) => Object.values(c.faces || {}))]
      .forEach((ref) => { const i = new Image(); i.src = img(ref); });
    layout();
    if (opts.startScene) startGame(null, opts.startScene); else { toTitle(); if (opts.openGallery) openGallery(); }

    return {
      destroy() {
        dead = true; mgClear(); cancelAnimationFrame(pfx.raf); clearInterval(typing); timers.forEach(clearTimeout);
        document.removeEventListener("keydown", onKey);
        if (ro) ro.disconnect();
        root.innerHTML = "";
      },
    };
  }

  window.VN = { mount, SAY_RE };
})();
