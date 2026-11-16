/* =========================================================================
 * 비주얼 노벨 엔진
 * story.js 의 STORY / CHARACTERS / BACKGROUNDS / ENDINGS 를 읽어 실행한다.
 * ========================================================================= */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const stage = $('#stage');
  const els = {
    bgA: $('#bg-a'), bgB: $('#bg-b'), tint: $('#tint'),
    chars: $('#char-layer'),
    textbox: $('#textbox'), name: $('#namebox'), text: $('#text'), next: $('#next-indicator'),
    choices: $('#choices'), quick: $('#quickmenu'),
    chapter: $('#chapter-card'), fader: $('#fader'),
    title: $('#title-screen'), modal: $('#modal'), ending: $('#ending-screen'), toast: $('#toast'),
  };

  const TYPE_SPEED = 28;          // ms / 글자
  const AUTO_BASE = 1200;         // 자동 진행 기본 대기
  const AUTO_PER_CHAR = 45;
  const SKIP_DELAY = 50;
  const POSITIONS = { left: 340, center: 640, right: 940 };
  const SAVE_KEY = 'seoha_vn_saves_v1';
  const ENDING_KEY = 'seoha_vn_endings_v1';
  const SLOT_COUNT = 4;           // 0번은 자동 저장

  /* ------------------------------------------------------------ 저장소 (실패해도 동작) */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch { return false; }
    },
  };

  /* ------------------------------------------------------------ 상태 */
  let state = null;          // 저장 대상
  let checkpoint = null;     // 마지막으로 표시된 대사/선택지 직전 상태
  let bgFront = els.bgA;

  const flags = {
    running: false, busy: false, typing: false, waiting: false,
    auto: false, skip: false, skipHeld: false, uiHidden: false,
  };
  let typeTimer = null;
  let autoTimer = null;
  let fullText = '';

  const newState = () => ({
    scene: 'start', idx: 0,
    vars: { ...INITIAL_VARS },
    bg: null, tint: null,
    chars: {},               // id -> { face, at }
    log: [],
  });

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fast = () => flags.skip || flags.skipHeld;

  /* ------------------------------------------------------------ 스케일 */
  function fit() {
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    stage.style.setProperty('--scale', s);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', fit);
  fit();

  /* ------------------------------------------------------------ 프리로드 */
  function preload() {
    const urls = [...Object.values(BACKGROUNDS)];
    Object.values(CHARACTERS).forEach((c) => urls.push(...Object.values(c.faces)));
    urls.forEach((u) => { const i = new Image(); i.src = u; });
  }

  /* ------------------------------------------------------------ 배경 */
  async function setBackground(name, tint, trans) {
    const url = BACKGROUNDS[name];
    if (!url) { console.warn('알 수 없는 배경:', name); return; }
    state.bg = name;
    state.tint = tint || null;

    if (trans === 'black' && !fast()) {
      els.fader.classList.add('on');
      await sleep(650);
      applyBgInstant(url, state.tint);
      await sleep(200);
      els.fader.classList.remove('on');
      await sleep(450);
      return;
    }
    const back = bgFront === els.bgA ? els.bgB : els.bgA;
    back.style.backgroundImage = `url("${url}")`;
    back.style.transition = fast() ? 'none' : '';
    bgFront.style.transition = fast() ? 'none' : '';
    back.classList.add('show');
    bgFront.classList.remove('show');
    bgFront = back;
    applyTint(state.tint);
    if (!fast()) await sleep(800);
  }

  function applyBgInstant(url, tint) {
    [els.bgA, els.bgB].forEach((b) => { b.style.transition = 'none'; b.classList.remove('show'); });
    bgFront.style.backgroundImage = `url("${url}")`;
    bgFront.classList.add('show');
    void bgFront.offsetWidth;
    [els.bgA, els.bgB].forEach((b) => { b.style.transition = ''; });
    applyTint(tint);
  }

  function applyTint(tint) {
    els.tint.className = tint || '';
    els.chars.querySelectorAll('.char').forEach((c) => {
      c.classList.remove('evening', 'night');
      if (tint) c.classList.add(tint);
    });
  }

  /* ------------------------------------------------------------ 캐릭터 */
  function charEl(id) {
    return els.chars.querySelector(`.char[data-id="${id}"]`);
  }

  function showChar(id, face, at) {
    const def = CHARACTERS[id];
    if (!def) { console.warn('알 수 없는 캐릭터:', id); return; }
    const prev = state.chars[id];
    face = face || (prev && prev.face) || 'normal';
    at = at || (prev && prev.at) || 'center';
    state.chars[id] = { face, at };

    let el = charEl(id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'char';
      el.dataset.id = id;
      if (state.tint) el.classList.add(state.tint);
      const img = document.createElement('img');
      img.src = def.faces[face];
      img.alt = def.name;
      el.appendChild(img);
      els.chars.appendChild(el);
      el.style.left = POSITIONS[at] + 'px';
      void el.offsetWidth;
    } else {
      setFace(id, face);
    }
    el.style.left = POSITIONS[at] + 'px';
    el.classList.add('show');
  }

  function setFace(id, face) {
    const def = CHARACTERS[id];
    const el = charEl(id);
    if (!def || !el || !def.faces[face]) return;
    if (state.chars[id]) state.chars[id].face = face;
    const cur = el.querySelector('img:last-child');
    const src = def.faces[face];
    if (cur && cur.getAttribute('src') === src) return;
    // 표정 크로스페이드
    const img = document.createElement('img');
    img.src = src;
    img.alt = def.name;
    img.style.opacity = 0;
    el.appendChild(img);
    requestAnimationFrame(() => { img.style.opacity = 1; });
    setTimeout(() => {
      el.querySelectorAll('img').forEach((i) => { if (i !== img) i.remove(); });
    }, fast() ? 0 : 260);
  }

  function hideChar(id) {
    delete state.chars[id];
    const el = charEl(id);
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), fast() ? 0 : 420);
  }

  function clearChars() {
    els.chars.innerHTML = '';
  }

  /* ------------------------------------------------------------ 대사 */
  function showLine(cmd) {
    checkpoint = clone({ ...state, idx: state.idx - 1 });

    const who = cmd.say;
    if (who && who !== '나') {
      const id = Object.keys(CHARACTERS).find((k) => CHARACTERS[k].name === who);
      if (id && cmd.face) {
        if (!state.chars[id]) showChar(id, cmd.face);
        else setFace(id, cmd.face);
      }
    }

    els.textbox.classList.remove('hidden');
    els.quick.classList.remove('hidden');
    if (who) {
      els.name.textContent = who;
      els.name.classList.remove('hidden');
      els.name.classList.toggle('me', who === '나');
      els.text.classList.remove('narration');
    } else {
      els.name.classList.add('hidden');
      els.text.classList.add('narration');
    }

    const text = who ? `“${cmd.text}”` : cmd.text;
    state.log.push({ who, text: cmd.text });
    if (state.log.length > 300) state.log.shift();
    typeText(text);
  }

  function typeText(text) {
    fullText = text;
    els.text.textContent = '';
    els.next.classList.remove('on');
    flags.typing = true;
    flags.waiting = true;
    clearTimeout(typeTimer);

    if (fast()) { finishTyping(); return; }

    let i = 0;
    const chars = Array.from(text);
    const tick = () => {
      i++;
      els.text.textContent = chars.slice(0, i).join('');
      if (i >= chars.length) { finishTyping(); return; }
      const c = chars[i - 1];
      const extra = '.,!?…'.includes(c) ? TYPE_SPEED * 4 : 0;
      typeTimer = setTimeout(tick, TYPE_SPEED + extra);
    };
    typeTimer = setTimeout(tick, TYPE_SPEED);
  }

  function finishTyping() {
    clearTimeout(typeTimer);
    els.text.textContent = fullText;
    flags.typing = false;
    els.next.classList.add('on');
    scheduleAuto();
  }

  function scheduleAuto() {
    clearTimeout(autoTimer);
    if (!flags.waiting || flags.typing) return;
    if (fast()) autoTimer = setTimeout(proceed, SKIP_DELAY);
    else if (flags.auto) autoTimer = setTimeout(proceed, AUTO_BASE + fullText.length * AUTO_PER_CHAR);
  }

  /* ------------------------------------------------------------ 선택지 */
  function showChoices(cmd) {
    checkpoint = clone({ ...state, idx: state.idx - 1 });
    autosave();
    // 스킵은 선택지에서 멈춘다
    setSkip(false);
    flags.waiting = false;
    els.choices.innerHTML = '';
    cmd.choice.forEach((opt, i) => {
      if (opt.if && !opt.if(state.vars)) return;
      const b = document.createElement('button');
      b.textContent = opt.text;
      b.style.animationDelay = `${i * 0.06}s`;
      b.addEventListener('click', (e) => { e.stopPropagation(); pickChoice(opt); });
      els.choices.appendChild(b);
    });
    els.choices.classList.remove('hidden');
  }

  function pickChoice(opt) {
    els.choices.classList.add('hidden');
    els.choices.innerHTML = '';
    state.log.push({ choice: opt.text });
    if (opt.set) applySet(opt.set);
    if (opt.goto) jump(opt.goto);
    run();
  }

  /* ------------------------------------------------------------ 변수 / 흐름 */
  function applySet(obj) {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'number' && typeof state.vars[k] === 'number') state.vars[k] += v;
      else state.vars[k] = v;
    }
  }

  function jump(label) {
    if (!STORY[label]) throw new Error(`스토리 라벨 없음: ${label}`);
    state.scene = label;
    state.idx = 0;
  }

  /* 명령 하나 실행. 'wait' 을 반환하면 입력 대기 */
  async function exec(cmd) {
    if ('text' in cmd) { showLine(cmd); return 'wait'; }
    if (cmd.choice) { showChoices(cmd); return 'wait'; }
    if (cmd.bg) { await setBackground(cmd.bg, cmd.tint, cmd.trans); return; }
    if (cmd.show) { showChar(cmd.show, cmd.face, cmd.at); if (!fast()) await sleep(300); return; }
    if (cmd.hide) { hideChar(cmd.hide); if (!fast()) await sleep(250); return; }
    if (cmd.face) { const id = cmd.who || Object.keys(state.chars)[0]; if (id) setFace(id, cmd.face); return; }
    if (cmd.chapter) { await showChapter(cmd); return; }
    if (cmd.set) { applySet(cmd.set); return; }
    if (cmd.if) { if (cmd.if(state.vars)) jump(cmd.goto); return; }
    if (cmd.goto) { jump(cmd.goto); return; }
    if (cmd.shake) { shake(); return; }
    if (cmd.wait) { if (!fast()) await sleep(cmd.wait); return; }
    if (cmd.end) { showEnding(cmd.end, cmd.title); return 'wait'; }
    console.warn('알 수 없는 명령:', cmd);
  }

  async function run() {
    if (flags.running) return;
    flags.running = true;
    flags.busy = true;
    try {
      while (true) {
        const scene = STORY[state.scene];
        const cmd = scene && scene[state.idx];
        if (!cmd) throw new Error(`스크립트 끝에 도달함: ${state.scene}[${state.idx}] — goto/end 가 필요합니다.`);
        state.idx++;
        const r = await exec(cmd);
        if (r === 'wait') break;
      }
    } catch (err) {
      console.error(err);
      toast('스크립트 오류: ' + err.message);
    } finally {
      flags.running = false;
      flags.busy = false;
    }
  }

  function proceed() {
    if (flags.busy || !flags.waiting) return;
    if (!els.modal.classList.contains('hidden')) return;
    if (flags.typing) { finishTyping(); return; }
    flags.waiting = false;
    els.next.classList.remove('on');
    clearTimeout(autoTimer);
    run();
  }

  async function showChapter(cmd) {
    els.textbox.classList.add('hidden');
    els.quick.classList.add('hidden');
    if (fast()) return;
    els.chapter.querySelector('.chapter-sub').textContent = cmd.chapter;
    els.chapter.querySelector('.chapter-title').textContent = cmd.title || '';
    els.chapter.classList.remove('hidden');
    els.chapter.style.animation = 'none';
    void els.chapter.offsetWidth;
    els.chapter.style.animation = '';
    await sleep(2200);
    els.chapter.classList.add('hidden');
  }

  function shake() {
    stage.classList.remove('shake');
    void stage.offsetWidth;
    stage.classList.add('shake');
    setTimeout(() => stage.classList.remove('shake'), 500);
  }

  /* ------------------------------------------------------------ 엔딩 */
  function showEnding(id, title) {
    setSkip(false);
    setAuto(false);
    flags.waiting = false;
    const seen = store.get(ENDING_KEY, []);
    if (!seen.includes(id)) { seen.push(id); store.set(ENDING_KEY, seen); }
    els.textbox.classList.add('hidden');
    els.quick.classList.add('hidden');
    els.ending.querySelector('.ending-title').textContent = title || ENDINGS[id] || id;
    els.ending.classList.remove('hidden');
  }

  /* ------------------------------------------------------------ 저장 / 불러오기 */
  function getSaves() { return store.get(SAVE_KEY, {}); }

  function snapshotLabel(snap) {
    const last = [...snap.log].reverse().find((l) => l.text);
    return last ? (last.who ? `${last.who}: ${last.text}` : last.text) : '(시작)';
  }

  function writeSlot(slot) {
    if (!checkpoint) return false;
    const saves = getSaves();
    saves[slot] = { time: Date.now(), label: snapshotLabel(checkpoint), data: checkpoint };
    return store.set(SAVE_KEY, saves);
  }

  function autosave() { writeSlot(0); }

  function loadSnapshot(snap) {
    resetView();
    state = clone(snap.data);
    const chars = state.chars;
    state.chars = {};
    if (state.bg) applyBgInstant(BACKGROUNDS[state.bg], state.tint);
    for (const [id, c] of Object.entries(chars)) showChar(id, c.face, c.at);
    els.title.classList.add('hidden');
    run();
  }

  function resetView() {
    clearTimeout(typeTimer);
    clearTimeout(autoTimer);
    setAuto(false);
    setSkip(false);
    Object.assign(flags, { running: false, busy: false, typing: false, waiting: false });
    clearChars();
    els.choices.classList.add('hidden');
    els.choices.innerHTML = '';
    els.chapter.classList.add('hidden');
    els.ending.classList.add('hidden');
    els.textbox.classList.add('hidden');
    els.quick.classList.add('hidden');
    els.text.textContent = '';
    els.tint.className = '';
    stage.classList.remove('ui-hidden');
    flags.uiHidden = false;
  }

  /* ------------------------------------------------------------ 모달 */
  function openModal(title, bodyEl) {
    els.modal.querySelector('.modal-title').textContent = title;
    const body = els.modal.querySelector('.modal-body');
    body.innerHTML = '';
    body.appendChild(bodyEl);
    els.modal.classList.remove('hidden');
    clearTimeout(autoTimer);
    return body;
  }

  function closeModal() {
    els.modal.classList.add('hidden');
    scheduleAuto();
  }

  function openLog() {
    const wrap = document.createElement('div');
    const log = state ? state.log : [];
    if (!log.length) {
      wrap.innerHTML = '<div class="log-empty">아직 기록이 없어요.</div>';
    }
    log.forEach((l) => {
      const row = document.createElement('div');
      row.className = 'log-entry' + (l.choice ? ' choice' : '');
      if (l.choice) row.textContent = `▶ ${l.choice}`;
      else {
        if (l.who) {
          const w = document.createElement('span');
          w.className = 'who' + (l.who === '나' ? ' me' : '');
          w.textContent = l.who;
          row.appendChild(w);
        }
        row.appendChild(document.createTextNode(l.text));
      }
      wrap.appendChild(row);
    });
    const body = openModal('대사 로그', wrap);
    body.scrollTop = body.scrollHeight;
  }

  function openSlots(mode) {
    const saves = getSaves();
    const wrap = document.createElement('div');
    wrap.className = 'slots';
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (mode === 'save' && i === 0) continue; // 자동 저장 슬롯엔 수동 저장 불가
      const s = saves[i];
      const b = document.createElement('button');
      b.className = 'slot';
      const num = i === 0 ? 'A' : String(i);
      const when = s ? new Date(s.time).toLocaleString('ko-KR') : '';
      b.innerHTML = `<div class="num">${num}</div><div class="meta"><small>${i === 0 ? '자동 저장 · ' : ''}${s ? when : '비어 있음'}</small><span></span></div>`;
      b.querySelector('span').textContent = s ? s.label : '—';
      if (mode === 'load' && !s) b.disabled = true;
      b.addEventListener('click', () => {
        if (mode === 'save') {
          const ok = writeSlot(i);
          closeModal();
          toast(ok ? `${num}번 슬롯에 저장했어요.` : '저장할 수 없어요. (브라우저 저장소 차단)');
        } else {
          closeModal();
          loadSnapshot(s);
          toast(`${num}번 슬롯을 불러왔어요.`);
        }
      });
      wrap.appendChild(b);
    }
    openModal(mode === 'save' ? '저장하기' : '불러오기', wrap);
  }

  function openEndings() {
    const seen = store.get(ENDING_KEY, []);
    const wrap = document.createElement('div');
    wrap.className = 'end-list';
    Object.entries(ENDINGS).forEach(([id, name]) => {
      const d = document.createElement('div');
      const ok = seen.includes(id);
      d.className = 'end-item' + (ok ? '' : ' locked');
      d.textContent = ok ? `★ ${name}` : '☆ ？？？';
      wrap.appendChild(d);
    });
    openModal(`엔딩 목록 (${seen.filter((s) => ENDINGS[s]).length}/${Object.keys(ENDINGS).length})`, wrap);
  }

  function confirm(msg, onYes) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div style="font-size:20px"></div><div class="confirm-actions"><button>취소</button><button class="primary">확인</button></div>`;
    wrap.firstChild.textContent = msg;
    const [no, yes] = wrap.querySelectorAll('button');
    no.addEventListener('click', closeModal);
    yes.addEventListener('click', () => { closeModal(); onYes(); });
    openModal('확인', wrap);
  }

  let toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2200);
  }

  /* ------------------------------------------------------------ 모드 토글 */
  function setAuto(on) {
    flags.auto = on;
    els.quick.querySelector('[data-act="auto"]').classList.toggle('active', on);
    if (on) scheduleAuto(); else clearTimeout(autoTimer);
  }
  function setSkip(on) {
    flags.skip = on;
    els.quick.querySelector('[data-act="skip"]').classList.toggle('active', on);
    if (on) { if (flags.typing) finishTyping(); else scheduleAuto(); }
    else clearTimeout(autoTimer);
  }
  function toggleUI() {
    flags.uiHidden = !flags.uiHidden;
    stage.classList.toggle('ui-hidden', flags.uiHidden);
  }

  /* ------------------------------------------------------------ 타이틀 */
  function toTitle() {
    resetView();
    state = null;
    checkpoint = null;
    [els.bgA, els.bgB].forEach((b) => b.classList.remove('show'));
    els.title.classList.remove('hidden');
    refreshTitle();
  }

  function refreshTitle() {
    const has = Object.keys(getSaves()).length > 0;
    els.title.querySelector('[data-title="continue"]').disabled = !has;
  }

  function newGame() {
    resetView();
    state = newState();
    els.title.classList.add('hidden');
    run();
  }

  /* ------------------------------------------------------------ 입력 */
  els.title.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.dataset.title;
    if (act === 'new') newGame();
    else if (act === 'continue') openSlots('load');
    else if (act === 'endings') openEndings();
  });

  els.quick.addEventListener('click', (e) => {
    e.stopPropagation();
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'log') openLog();
    else if (act === 'auto') setAuto(!flags.auto);
    else if (act === 'skip') setSkip(!flags.skip);
    else if (act === 'save') openSlots('save');
    else if (act === 'load') openSlots('load');
    else if (act === 'hide') toggleUI();
    else if (act === 'title') confirm('타이틀 화면으로 돌아갈까요? 저장하지 않은 진행은 사라져요.', toTitle);
  });

  els.modal.querySelector('.modal-close').addEventListener('click', closeModal);
  els.modal.addEventListener('click', (e) => { if (e.target === els.modal) closeModal(); });
  els.ending.querySelector('button').addEventListener('click', toTitle);

  stage.addEventListener('click', (e) => {
    if (!els.title.classList.contains('hidden')) return;
    if (!els.modal.classList.contains('hidden')) return;
    if (e.target.closest('#choices, #quickmenu, #ending-screen, #modal')) return;
    if (flags.uiHidden) { toggleUI(); return; }
    if (flags.skip) setSkip(false);
    proceed();
  });

  stage.addEventListener('wheel', (e) => {
    if (e.deltaY < 0 && state && els.modal.classList.contains('hidden') && els.title.classList.contains('hidden')) openLog();
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    const modalOpen = !els.modal.classList.contains('hidden');
    if (e.key === 'Escape') { if (modalOpen) closeModal(); return; }
    if (modalOpen || !state || !els.title.classList.contains('hidden')) return;

    if (e.key === 'Control') { if (!flags.skipHeld) { flags.skipHeld = true; if (flags.typing) finishTyping(); else scheduleAuto(); } return; }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (flags.uiHidden) { toggleUI(); return; }
      proceed();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'h') toggleUI();
    else if (k === 'l') openLog();
    else if (k === 'a') setAuto(!flags.auto);
    else if (/^[1-9]$/.test(e.key) && !els.choices.classList.contains('hidden')) {
      const b = els.choices.querySelectorAll('button')[Number(e.key) - 1];
      if (b) b.click();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Control') { flags.skipHeld = false; clearTimeout(autoTimer); scheduleAuto(); }
  });
  window.addEventListener('blur', () => { flags.skipHeld = false; });

  /* ------------------------------------------------------------ 시작 */
  preload();
  refreshTitle();

  // 디버그용: 콘솔에서 VN.state 로 변수 확인 가능
  window.VN = { get state() { return state; }, jump: (l) => { jump(l); run(); } };
})();
