/* =====================================================================
   📖 스토리 파일 — 게임 내용은 전부 PROJECT 안에 있어요.
   창작기(editor.html)의 "코드" 탭에 나오는 것과 똑같은 형식이에요.

   ── 스토리 블록 문법 ───────────────────────────────────────
   "그냥 문장"                          → 나레이션
   "샬럿: 안녕?"                        → 대사 (이름: 내용)
   { say: "샬럿", face: "smile", text: "안녕?" } → 표정까지 바꾸면서 대사
   { bg: "classroom" }                  → 배경 바꾸기
   { show: "charlotte", face: "smile", pos: "left" } → 캐릭터 등장/표정 (pos: left/center/right)
   { hide: "charlotte" }  /  { hide: "all" } → 퇴장
   { choice: [ { text: "보기", goto: "장면", set: { 호감도: +1 } } ] } → 선택지
   { set: { 호감도: +1 } }  /  { set: { 이름: "=샬럿" } } → 변수 더하기 / 값 정하기
   { if: "호감도 >= 2", goto: "좋은엔딩", else: "보통엔딩" } → 조건 분기
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

  // 배경: 이름 → 이미지
  backgrounds: {
    classroom: "images/bg/classroom.jpg",
  },

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
      "나: 왠지 네가 혼자 있을 것 같아서.",
      { show: "charlotte", face: "shy" },
      { shake: true },
      "샬럿: 무, 무슨 소리야 갑자기……!",
      "샬럿: ……바보.",
      { goto: "공통" },
    ],
    공통: [
      { say: "샬럿", face: "normal", text: "있잖아. 내일 시간 있어?" },
      { choice: [
        { text: "있어.", goto: "약속", set: { 호감도: +1 } },
        { text: "글쎄, 왜?", goto: "판정" },
      ] },
    ],
    약속: [
      { say: "샬럿", face: "smile", text: "그럼 내일, 여기서." },
      { goto: "판정" },
    ],
    판정: [
      { if: "호감도 >= 2", goto: "좋은엔딩", else: "보통엔딩" },
    ],
    좋은엔딩: [
      { say: "샬럿", face: "smile", text: "오늘…… 와 줘서 고마워." },
      { flash: "white" },
      "그 윙크가, 오래도록 머릿속에서 떠나지 않았다.",
      { end: "GOOD END — 노을빛 약속" },
    ],
    보통엔딩: [
      { say: "샬럿", face: "normal", text: "……뭐, 됐어. 먼저 갈게." },
      { hide: "charlotte" },
      "텅 빈 교실에 나 혼자 남았다.",
      { fade: "black" },
      { end: "NORMAL END — 빈 교실" },
    ],
  },
};
