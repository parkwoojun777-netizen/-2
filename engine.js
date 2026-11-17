/* =====================================================================
   🛠 비주얼 노벨 엔진 — 스토리는 story.js 에서 수정하세요.
   ===================================================================== */
(() => {
  const $ = (s) => document.querySelector(s);
  const el = {
    stage: $("#stage"), bg: $("#bg"), bg2: $("#bg2"), chars: $("#chars"),
    box: $("#textbox"), name: $("#name"), text: $("#text"), next: $("#next-ind"),
    choices: $("#choices"), fx: $("#fx"),
    title: $("#title"), titleName: $("#title-name"), titleSub: $("#title-sub"), titleBg: $("#title-bg"),
    menu: $("#menu"), panel: $("#panel"), panelTitle: $("#panel-title"), panelBody: $("#panel-body"),
    ending: $("#ending"), endingName: $("#ending-name"),
    toast: $("#toast"),
  };

  const SLOTS = 6;
  const SAVE_KEY = "vn_save_" + (GAME.title || "game");
  const SPEED_KEY = "vn_speed";

  let S;            // 현재 게임 상태
  let typing = null; // 타이핑 중인 타이머
  let waitingTap = false;
  let auto = false, skip = false, autoTimer = null;
  let speed = load(SPEED_KEY, 28); // 글자당 ms

  function fresh() {
    return { scene: GAME.start, index: 0, lineIndex: 0, vars: {}, bg: null, chars: {}, log: [] };
  }

  // ---------- 저장소 (실패해도 게임은 동작) ----------
  function load(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }

  // ---------- 화면 ----------
  function setBg(name, instant) {
    const src = BACKGROUNDS[name] || name;
    S.bg = name;
    if (instant) { el.bg.style.backgroundImage = `url("${src}")`; el.bg2.style.opacity = 0; return; }
    el.bg2.style.transition = "none";
    el.bg2.style.backgroundImage = el.bg.style.backgroundImage;
    el.bg2.style.opacity = 1;
    el.bg.style.backgroundImage = `url("${src}")`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.bg2.style.transition = "opacity .6s"; el.bg2.style.opacity = 0;
    }));
  }

  function renderChars(instant) {
    const ids = Object.keys(S.chars);
    // 제거
    [...el.chars.children].forEach((img) => {
      if (!S.chars[img.dataset.id]) {
        img.classList.remove("on");
        setTimeout(() => img.remove(), instant ? 0 : 400);
      }
    });
    ids.forEach((id) => {
      const c = S.chars[id], def = CHARACTERS[id];
      if (!def) return console.warn("없는 캐릭터:", id);
      const src = def.faces[c.face] || Object.values(def.faces)[0];
      let img = el.chars.querySelector(`img[data-id="${id}"]`);
      if (!img) {
        img = document.createElement("img");
        img.dataset.id = id; img.alt = def.name; img.draggable = false;
        img.src = src;
        el.chars.appendChild(img);
        if (instant) img.classList.add("on");
        else requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add("on")));
      } else if (!img.src.endsWith(src)) {
        img.src = src;
        img.classList.remove("bounce"); void img.offsetWidth; img.classList.add("bounce");
      }
      img.dataset.pos = c.pos || "center";
    });
  }

  function speakerHighlight(name) {
    [...el.chars.children].forEach((img) => {
      const def = CHARACTERS[img.dataset.id];
      img.classList.toggle("dim", !!name && def && def.name !== name && Object.keys(S.chars).length > 1);
    });
  }

  function colorFor(name) {
    if (NAME_COLORS[name]) return NAME_COLORS[name];
    const c = Object.values(CHARACTERS).find((d) => d.name === name);
    return c ? c.color : "#fff";
  }

  // ---------- 텍스트 ----------
  function showLine(name, text) {
    el.choices.innerHTML = ""; el.choices.hidden = true;
    el.box.hidden = false;
    el.name.textContent = name || "";
    el.name.hidden = !name;
    el.name.style.color = colorFor(name);
    el.text.classList.toggle("narration", !name);
    speakerHighlight(name);
    S.log.push({ name, text }); if (S.log.length > 200) S.log.shift();
    el.next.classList.remove("on");
    el.text.textContent = "";
    clearTimeout(autoTimer);
    const chars = [...text];
    if (skip || speed === 0) { el.text.textContent = text; doneTyping(); return; }
    let i = 0;
    typing = setInterval(() => {
      el.text.textContent += chars[i++];
      if (i >= chars.length) { clearInterval(typing); typing = null; doneTyping(); }
    }, speed);
    waitingTap = true;
  }

  function doneTyping() {
    typing = null; waitingTap = true;
    el.next.classList.add("on");
    if (skip) autoTimer = setTimeout(advance, 60);
    else if (auto) autoTimer = setTimeout(advance, 1200 + el.text.textContent.length * 40);
  }

  function finishTyping() {
    if (!typing) return false;
    clearInterval(typing);
    const last = S.log[S.log.length - 1];
    el.text.textContent = last.text;
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
    el.choices.innerHTML = "";
    el.choices.hidden = false;
    list.forEach((opt) => {
      if (opt.if && !evalCond(opt.if)) return;
      const b = document.createElement("button");
      b.className = "choice";
      b.textContent = opt.text;
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
      if (typeof v === "number") S.vars[k] = (S.vars[k] || 0) + v;
      else if (typeof v === "string" && /^=/.test(v)) S.vars[k] = isNaN(+v.slice(1)) ? v.slice(1) : +v.slice(1);
      else S.vars[k] = v;
    }
  }
  function evalCond(expr) {
    const m = String(expr).match(/^\s*(\S+)\s*(>=|<=|==|!=|>|<)\s*(\S+)\s*$/);
    if (!m) return !!S.vars[String(expr).trim()];
    const a = S.vars[m[1]] ?? 0;
    const b = isNaN(+m[3]) ? (S.vars[m[3]] ?? m[3]) : +m[3];
    switch (m[2]) {
      case ">=": return a >= b; case "<=": return a <= b;
      case ">": return a > b;   case "<": return a < b;
      case "==": return a == b; case "!=": return a != b;
    }
  }

  function jump(scene) {
    if (!STORY[scene]) { alert(`장면 "${scene}" 을(를) 찾을 수 없어요. story.js를 확인하세요.`); return; }
    S.scene = scene; S.index = 0; run();
  }

  // ---------- 메인 실행 루프 ----------
  function run() {
    while (true) {
      const list = STORY[S.scene];
      if (!list) return alert(`장면 "${S.scene}" 이 없어요.`);
      if (S.index >= list.length) return alert(`장면 "${S.scene}" 이 goto / end 없이 끝났어요.`);
      const cmd = list[S.index];
      S.lineIndex = S.index;
      S.index++;

      if (typeof cmd === "string") {
        const m = cmd.match(/^([^:：\s][^:：]{0,15})[:：]\s?([\s\S]*)$/);
        if (m) showLine(m[1].trim(), m[2]); else showLine("", cmd);
        return;
      }
      if (cmd.say !== undefined || cmd.text !== undefined) { showLine(cmd.say || "", cmd.text || ""); return; }
      if (cmd.bg) setBg(cmd.bg);
      if (cmd.show) {
        const prev = S.chars[cmd.show] || {};
        S.chars[cmd.show] = { face: cmd.face || prev.face || "normal", pos: cmd.pos || prev.pos || "center" };
        renderChars();
      }
      if (cmd.hide) {
        if (cmd.hide === "all") S.chars = {}; else delete S.chars[cmd.hide];
        renderChars();
      }
      if (cmd.set && !cmd.choice) applySet(cmd.set);
      if (cmd.shake) { el.stage.classList.remove("shake"); void el.stage.offsetWidth; el.stage.classList.add("shake"); }
      if (cmd.flash) flash(cmd.flash, 500);
      if (cmd.choice) { el.box.hidden = false; showChoices(cmd.choice); return; }
      if (cmd.if) { const ok = evalCond(cmd.if); const t = ok ? cmd.goto : cmd.else; if (t) return jump(t); continue; }
      if (cmd.goto) return jump(cmd.goto);
      if (cmd.end !== undefined) return showEnding(cmd.end);
      if (cmd.fade) { el.box.hidden = true; return fadeThrough(cmd.fade, () => { el.box.hidden = false; run(); }); }
      if (cmd.wait) { el.box.hidden = true; setTimeout(() => { el.box.hidden = false; run(); }, skip ? 0 : cmd.wait); return; }
    }
  }

  function flash(color, ms) {
    el.fx.style.transition = "none"; el.fx.style.background = color; el.fx.style.opacity = 1;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.fx.style.transition = `opacity ${ms}ms`; el.fx.style.opacity = 0; }));
  }
  function fadeThrough(color, cb) {
    el.fx.style.background = color; el.fx.style.transition = "opacity .7s"; el.fx.style.opacity = 1;
    setTimeout(() => { cb(); setTimeout(() => (el.fx.style.opacity = 0), 100); }, 900);
  }

  // ---------- 엔딩 / 타이틀 ----------
  function showEnding(name) {
    stopSkip(); auto = false; syncButtons();
    el.endingName.textContent = name || "THE END";
    el.ending.hidden = false;
    const seen = load(SAVE_KEY + "_endings", []);
    if (name && !seen.includes(name)) { seen.push(name); store(SAVE_KEY + "_endings", seen); }
  }

  function toTitle() {
    S = null; clearInterval(typing); clearTimeout(autoTimer); auto = skip = false; syncButtons();
    el.ending.hidden = true; el.panel.hidden = true;
    el.title.hidden = false;
    const seen = load(SAVE_KEY + "_endings", []);
    $("#title-endings").textContent = seen.length ? `🏁 본 엔딩: ${seen.join(" · ")}` : "";
  }

  function startGame(state) {
    el.title.hidden = true; el.ending.hidden = true; el.panel.hidden = true;
    el.chars.innerHTML = "";
    if (state) {
      S = JSON.parse(JSON.stringify(state));
      S.index = S.lineIndex;
      S.log = S.log || [];
      if (S.bg) setBg(S.bg, true);
      renderChars(true);
      S.log.pop(); // 다시 출력될 줄 중복 방지
    } else {
      S = fresh();
      el.bg.style.backgroundImage = ""; el.bg2.style.opacity = 0;
    }
    run();
  }

  // ---------- 저장 / 불러오기 ----------
  function slotsData() { return load(SAVE_KEY, Array(SLOTS).fill(null)); }

  function openSlots(mode) {
    stopSkip(); auto = false; syncButtons();
    el.panelTitle.textContent = mode === "save" ? "💾 저장하기" : "📂 불러오기";
    el.panelBody.innerHTML = "";
    const data = slotsData();
    for (let i = 0; i < SLOTS; i++) {
      const d = data[i];
      const b = document.createElement("button");
      b.className = "slot";
      b.innerHTML = d
        ? `<b>슬롯 ${i + 1}</b><span>${escapeHtml(d.preview)}</span><small>${d.date}</small>`
        : `<b>슬롯 ${i + 1}</b><span class="empty">— 비어 있음 —</span>`;
      b.onclick = () => {
        if (mode === "save") {
          if (!S) return;
          const last = S.log[S.log.length - 1];
          data[i] = {
            state: S,
            preview: last ? (last.name ? last.name + ": " : "") + last.text.slice(0, 40) : S.scene,
            date: new Date().toLocaleString("ko-KR"),
          };
          toast(store(SAVE_KEY, data) ? "저장했어요" : "저장 실패 (브라우저 저장소 사용 불가)");
          openSlots("save");
        } else if (d) {
          startGame(d.state);
          toast("불러왔어요");
        }
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
      p.className = "log-line";
      p.innerHTML = name ? `<b style="color:${colorFor(name)}">${escapeHtml(name)}</b>${escapeHtml(text)}` : `<i>${escapeHtml(text)}</i>`;
      el.panelBody.appendChild(p);
    });
    el.panel.hidden = false;
    el.panelBody.scrollTop = 1e9;
  }

  function openSettings() {
    el.panelTitle.textContent = "⚙️ 설정";
    el.panelBody.innerHTML = `
      <label class="setting">글자 속도
        <input type="range" min="0" max="80" step="4" value="${80 - speed}" id="spd">
      </label>
      <p class="hint">오른쪽 끝 = 즉시 표시</p>
      <button class="slot" id="to-title"><b>타이틀로 돌아가기</b></button>`;
    $("#spd").oninput = (e) => { speed = 80 - +e.target.value; store(SPEED_KEY, speed); };
    $("#to-title").onclick = () => { if (confirm("타이틀로 돌아갈까요? (저장 안 된 진행은 사라져요)")) toTitle(); };
    el.panel.hidden = false;
  }

  // ---------- 자동 / 스킵 ----------
  function stopSkip() { skip = false; syncButtons(); }
  function syncButtons() {
    $("#btn-auto").classList.toggle("active", auto);
    $("#btn-skip").classList.toggle("active", skip);
  }
  function toggleAuto() { auto = !auto; skip = false; syncButtons(); if (auto && waitingTap && !typing) advance(); }
  function toggleSkip() { skip = !skip; auto = false; syncButtons(); if (skip && waitingTap) { finishTyping(); advance(); } }

  // ---------- 유틸 ----------
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  let toastT;
  function toast(msg) { el.toast.textContent = msg; el.toast.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove("on"), 1600); }

  // ---------- 입력 ----------
  el.stage.addEventListener("click", (e) => {
    if (e.target.closest("#menu, #choices, #panel")) return;
    if (auto || skip) { auto = skip = false; syncButtons(); }
    advance();
  });
  document.addEventListener("keydown", (e) => {
    if (!el.panel.hidden) { if (e.key === "Escape") el.panel.hidden = true; return; }
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); advance(); }
  });
  $("#btn-save").onclick = () => openSlots("save");
  $("#btn-load").onclick = () => openSlots("load");
  $("#btn-log").onclick = openLog;
  $("#btn-auto").onclick = toggleAuto;
  $("#btn-skip").onclick = toggleSkip;
  $("#btn-set").onclick = openSettings;
  $("#panel-close").onclick = () => (el.panel.hidden = true);
  $("#t-start").onclick = () => startGame(null);
  $("#t-load").onclick = () => openSlots("load");
  $("#t-set").onclick = openSettings;
  $("#ending-btn").onclick = toTitle;

  // ---------- 초기화 ----------
  document.title = GAME.title;
  el.titleName.textContent = GAME.title;
  el.titleSub.textContent = GAME.subtitle || "";
  if (GAME.titleBg) el.titleBg.style.backgroundImage = `url("${BACKGROUNDS[GAME.titleBg] || GAME.titleBg}")`;
  // 이미지 미리 불러오기
  [...Object.values(BACKGROUNDS), ...Object.values(CHARACTERS).flatMap((c) => Object.values(c.faces))]
    .forEach((src) => { const i = new Image(); i.src = src; });
  toTitle();
})();
