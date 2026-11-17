/* =====================================================================
   📖 스토리 파일 — 게임 내용은 전부 여기에 씁니다.
   (엔진 코드는 engine.js 에 있고, 건드릴 필요 없어요.)

   ── 기본 문법 ───────────────────────────────────────────────
   "그냥 문장"                    → 나레이션(이름 없이 출력)
   "하루: 안녕?"                  → 대사 (이름: 내용)
   { bg: "classroom" }            → 배경 바꾸기 (아래 BACKGROUNDS 이름)
   { show: "haru", face: "smile" }→ 캐릭터 등장 / 표정 바꾸기
   { show: "haru", face: "shy", pos: "left" } → 위치: left / center / right
   { hide: "haru" }               → 캐릭터 퇴장
   { hide: "all" }                → 모든 캐릭터 퇴장
   { choice: [                    → 선택지
       { text: "보기 1", goto: "장면이름", set: { 호감도: +1 } },
       { text: "보기 2", goto: "다른장면" },
     ] }
   { goto: "장면이름" }           → 다른 장면으로 이동
   { set: { 호감도: +1 } }        → 변수 더하기 (+1, -1 ...)
   { if: "호감도 >= 2", goto: "좋은엔딩", else: "보통엔딩" } → 조건 분기
   { wait: 1000 }                 → 1초 쉬기 (밀리초)
   { shake: true }                → 화면 흔들기
   { flash: "white" }             → 화면 번쩍
   { fade: "black" }              → 검은 화면으로 전환 후 다음 진행
   { end: "엔딩 이름" }           → 엔딩 화면 → 타이틀로
   ===================================================================== */

const GAME = {
  title: "방과 후의 교실",
  subtitle: "A Visual Novel",
  titleBg: "classroom",
  start: "프롤로그",      // 처음 시작할 장면 이름
};

// 배경 이미지 목록: 이름 → 파일 경로
const BACKGROUNDS = {
  classroom: "images/bg/classroom.jpg",
};

// 캐릭터 목록: 이름 → { 표시이름, 색, 표정들 }
const CHARACTERS = {
  haru: {
    name: "하루",
    color: "#8fd3ff",
    faces: {
      normal: "images/char/haru_normal.png",
      smile:  "images/char/haru_smile.png",
      pout:   "images/char/haru_pout.png",
      shy:    "images/char/haru_shy.png",
    },
  },
};

// 대사에서 "나: ..." 처럼 쓸 때 이름 색 (선택)
const NAME_COLORS = {
  "나": "#ffd27a",
};

// ===================== 스토리 시작 =====================
const STORY = {

  "프롤로그": [
    { bg: "classroom" },
    "종례가 끝나고 30분. 교실에는 아무도 남아 있지 않을 줄 알았다.",
    "창문으로 들어온 햇빛이 칠판 위에 길게 늘어져 있다.",
    { show: "haru", face: "normal" },
    "……아니, 한 명 있었다.",
    "하루: ……",
    "나: 어, 아직 안 갔어?",
    { show: "haru", face: "shy" },
    "하루: ……그냥. 집에 가기 싫어서.",
    "하루: 너야말로 왜 왔어?",
    { choice: [
      { text: "두고 간 노트를 가지러 왔어.", goto: "노트" },
      { text: "너 혼자 있을 것 같아서.", goto: "걱정", set: { 호감도: +1 } },
    ] },
  ],

  "노트": [
    "나: 노트를 두고 가서.",
    { show: "haru", face: "pout" },
    "하루: ……흥. 그렇겠지.",
    "괜히 서운한 표정이다.",
    { goto: "공통" },
  ],

  "걱정": [
    "나: 왠지 네가 혼자 있을 것 같아서.",
    { show: "haru", face: "shy" },
    { shake: true },
    "하루: 무, 무슨 소리야 갑자기……!",
    "하루: ……바보.",
    { goto: "공통" },
  ],

  "공통": [
    { show: "haru", face: "normal" },
    "하루: 있잖아. 내일 시간 있어?",
    { choice: [
      { text: "있어.", goto: "약속", set: { 호감도: +1 } },
      { text: "글쎄, 왜?", goto: "판정" },
    ] },
  ],

  "약속": [
    { show: "haru", face: "smile" },
    "하루: 그럼 내일, 여기서.",
    { goto: "판정" },
  ],

  "판정": [
    { if: "호감도 >= 2", goto: "좋은엔딩", else: "보통엔딩" },
  ],

  "좋은엔딩": [
    { show: "haru", face: "smile" },
    "하루: 오늘…… 와 줘서 고마워.",
    { flash: "white" },
    "그 윙크가, 오래도록 머릿속에서 떠나지 않았다.",
    { end: "GOOD END — 노을빛 약속" },
  ],

  "보통엔딩": [
    { show: "haru", face: "normal" },
    "하루: ……뭐, 됐어. 먼저 갈게.",
    { hide: "haru" },
    "텅 빈 교실에 나 혼자 남았다.",
    { fade: "black" },
    { end: "NORMAL END — 빈 교실" },
  ],

};
