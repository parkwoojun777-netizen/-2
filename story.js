/* =====================================================================
   📖 스토리 파일 — 게임 내용은 전부 PROJECT 안에 있어요.
   창작기(editor.html)의 "코드" 탭에 나오는 것과 똑같은 형식이에요.

   ── 스토리 블록 문법 ───────────────────────────────────────
   "그냥 문장"                          → 나레이션
   "샬럿: 안녕?"                        → 대사 (이름: 내용)
   { say: "샬럿", face: "smile", text: "안녕?" } → 표정까지 바꾸면서 대사
   { bg: "classroom" }                  → 배경 바꾸기
   { show: "charlotte", face: "smile", pos: "left" } → 캐릭터 등장/표정 (pos: left/center/right)
   { cg: "옥상_노을" }  /  { cg: "" }  → 이벤트 그림(CG) 화면 가득 보여주기 / 숨기기
   { hide: "charlotte" }  /  { hide: "all" } → 퇴장
   { choice: [ { text: "보기", goto: "장면", set: { 호감도: +1 } } ] } → 선택지
   { set: { 호감도: +1 } }  /  { set: { 이름: "=샬럿" } } → 변수 더하기 / 값 정하기
   { if: "호감도 >= 2", goto: "좋은엔딩", else: "보통엔딩" } → 조건 분기
   { varImage: "charlotte", cases: [ { if: "호감도 >= 2", image: "smile" } ], else: "pout" }
                                        → 변수에 따라 다른 그림 (varImage: "bg" / "cg" / 캐릭터 코드 이름)
   { minigame: "pick", image: "classroom", picks: 1, objects: [ { name: "사탕", x: 30, y: 60, text: "…", set: { 호감도: +1 } } ] }
                                        → 미니게임: 그림 위 오브젝트를 골라 변수 바꾸기 (hidden: true 면 숨은 오브젝트)
   { particles: "petal", mode: "spread", color: "#ffb7c5", x: 50, y: 35 } → 입자 효과
                                        (petal/leaf/snow/rain/storm/drip/fog/steam/smoke/ember/sparkle/firefly/dot/bubble/heart/confetti
                                         · fall/spread/burst · { particles: "off" } 로 끄기)
   { particles: "petal", mode: "spread", dir: 90, spread: 30 } → 방향: 0 위 · 90 오른쪽 · 180 아래 · 270 왼쪽
   { particles: "별가루", mode: "burst" } → effects 에 직접 만든 효과
   { gauge: "호감도", show: false }       → 게이지 보이기/숨기기 (gauges 설정)
   { cgSeq: [ { image: "추억_교실", text: "…" }, { image: "추억_윙크", sound: "띠링", fx: "flash" } ] }
                                        → CG 넘기기: 탭할 때마다 그림 · 대사 · 효과음 · 효과 (text 없으면 탭 기다리기)
   { sound: "띠링" }                     → 효과음 (sounds 에 등록)
   { tint: "sepia" }                    → 화면 색감 (sepia/gray/night/sunset/dream · "" 은 원래대로)
   { goto: "장면" }   { wait: 1000 }   { shake: true }   { flash: "white" }   { fade: "black" }
   { end: "엔딩 이름" }                 → 엔딩
   ===================================================================== */

const PROJECT = {
  title: "방과 후의 교실",
  subtitle: "A Visual Novel",
  titleBg: "classroom",
  start: "프롤로그",

  // 변수와 처음 값
  vars: {
    호감도: 0,
  },

  // 변수 게이지: 값이 바뀌면 화면 왼쪽 위 게이지가 차올라요
  gauges: {
    호감도: { label: "호감도", icon: "💗", color: "#ff6b8b", min: 0, max: 5, always: true },
  },

  // 직접 만든 입자 효과 (창작기 [그림] 탭 → 🎨 내 효과)
  effects: {
    별가루: { shape: "star", colors: ["#fff3a8", "#ffd23f", "#ffffff"], sizeMin: 4, sizeMax: 9, dir: 0, spread: 70,
      speedMin: 90, speedMax: 220, gravity: 120, drag: 0.6, lifeMin: 1.2, lifeMax: 2.2, alpha: 1, fadeIn: 0.05, fadeOut: 0.6,
      grow: -0.4, spin: 200, twinkle: true, glow: true, count: 60, rate: 24, area: 10 },
  },

  // 배경: 이름 → 이미지
  backgrounds: {
    classroom: "images/bg/classroom.jpg",
  },

  // 이벤트 그림(CG): 이름 → 이미지
  cgs: {
    추억_교실: "images/cg/cg_classroom.jpg",
    추억_윙크: "images/cg/cg_wink.jpg",
  },

  // 효과음: 이름 → 소리 파일
  sounds: {
    띠링: "sounds/chime.wav",
  },

  // 오브젝트 그림 (미니게임에서 일러스트 위에 놓는 물건): 이름 → 이미지
  items: {},

  // 캐릭터: 코드용 이름 → { 표시 이름, 이름 색, 표정들 }
  characters: {
    charlotte: {
      name: "샬럿",
      color: "#8fd3ff",
      faces: {
        normal: "images/char/charlotte_normal.png",
        smile: "images/char/charlotte_smile.png",
        pout: "images/char/charlotte_pout.png",
        shy: "images/char/charlotte_shy.png",
      },
    },
  },

  // 회상방에서 다시 볼 수 있는 장면
  memories: [
    { scene: "걱정", title: "너 혼자 있을 것 같아서" },
    { scene: "좋은엔딩", title: "노을빛 약속" },
  ],

  // 캐릭터가 아닌 이름의 색 (예: 주인공)
  nameColors: {
    나: "#ffd27a",
  },

  story: {
    프롤로그: [
      { bg: "classroom" },
      "종례가 끝나고 30분. 교실에는 아무도 남아 있지 않을 줄 알았다.",
      "창문으로 들어온 햇빛이 칠판 위에 길게 늘어져 있다.",
      { show: "charlotte", face: "normal" },
      "……아니, 한 명 있었다.",
      "샬럿: ……",
      "나: 어, 아직 안 갔어?",
      { say: "샬럿", face: "shy", text: "……그냥. 집에 가기 싫어서." },
      "샬럿: 너야말로 왜 왔어?",
      { choice: [
        { text: "두고 간 노트를 가지러 왔어.", goto: "노트" },
        { text: "너 혼자 있을 것 같아서.", goto: "걱정", set: { 호감도: +1 } },
      ] },
    ],
    노트: [
      "나: 노트를 두고 가서.",
      { say: "샬럿", face: "pout", text: "……흥. 그렇겠지." },
      "괜히 서운한 표정이다.",
      { goto: "공통" },
    ],
    걱정: [
      { bg: "classroom" },
      "나: 왠지 네가 혼자 있을 것 같아서.",
      { show: "charlotte", face: "shy" },
      { shake: true },
      "샬럿: 무, 무슨 소리야 갑자기……!",
      "샬럿: ……바보.",
      { goto: "공통" },
    ],
    공통: [
      "그때, 열린 창문으로 바람이 훅 불어 들어왔다.",
      { shake: true },
      { say: "샬럿", face: "shy", text: "앗, 필통이……!" },
      "샬럿의 물건이 교실 바닥에 흩어졌다. 하나를 주워 주자.",
      { minigame: "pick", title: "흩어진 물건 줍기", image: "classroom", picks: 1, labels: true,
        hint: "샬럿에게 하나를 주워 주자",
        objects: [
          { name: "머리핀", x: 28, y: 78, say: "샬럿", text: "아, 그거 찾고 있었어! ……고마워.", set: { 호감도: +1 } },
          { name: "숙제 프린트", x: 55, y: 66, say: "샬럿", text: "……그건 그냥 숙제야." },
          { name: "낙서 노트", x: 80, y: 80, say: "샬럿", text: "보, 보지 마!", set: { 호감도: -1 } },
          { name: "고양이 스티커", x: 12, y: 45, size: 9, hidden: true, say: "샬럿", text: "그걸 어떻게 찾았어? 내 보물인데.", set: { 호감도: +2 } },
        ] },
      { varImage: "charlotte", cases: [ { if: "호감도 >= 2", image: "smile" } ], else: "normal" },
      "샬럿: 있잖아. 내일 시간 있어?",
      { choice: [
        { text: "있어.", goto: "약속", set: { 호감도: +1 } },
        { text: "글쎄, 왜?", goto: "판정" },
      ] },
    ],
    약속: [
      { say: "샬럿", face: "smile", text: "그럼 내일, 여기서." },
      { particles: "별가루", mode: "burst", x: 50, y: 30 },
      { goto: "판정" },
    ],
    판정: [
      { if: "호감도 >= 2", goto: "좋은엔딩", else: "보통엔딩" },
    ],
    좋은엔딩: [
      { bg: "classroom" },
      { tint: "sunset" },
      { say: "샬럿", face: "smile", text: "오늘…… 와 줘서 고마워." },
      // CG 넘기기: 탭할 때마다 그림 · 대사 · 효과음 · 효과가 차례로 바뀌어요
      { cgSeq: [
        { image: "추억_교실", text: "노을이 교실을 주황색으로 물들이고 있었다." },
        { say: "샬럿", text: "……저기, 눈 감아 봐." },
        { image: "추억_윙크", sound: "띠링", fx: "flash", particles: "별가루" },
        { say: "샬럿", text: "헤헤. 속았지?" },
      ] },
      { particles: "sparkle", mode: "burst", x: 50, y: 35 },
      { particles: "petal", mode: "spread", x: 50, y: 35 },
      "그 윙크가, 오래도록 머릿속에서 떠나지 않았다.",
      { particles: "off" },
      { end: "GOOD END — 노을빛 약속" },
    ],
    보통엔딩: [
      { say: "샬럿", face: "normal", text: "……뭐, 됐어. 먼저 갈게." },
      { hide: "charlotte" },
      { tint: "gray" },
      { particles: "rain" },
      "텅 빈 교실에 나 혼자 남았다.",
      "창밖에는 어느새 비가 내리고 있었다.",
      { fade: "black" },
      { end: "NORMAL END — 빈 교실" },
    ],
  },
};
