/* =========================================================================
 * 스토리 스크립트
 *
 * 헬퍼:
 *   N(text)              나레이션
 *   M(text)              주인공(나) 대사
 *   S(face, text)        서하 대사 (face: normal | pout | uneasy | wink | null=유지)
 *
 * 명령 객체:
 *   { bg: 'campus', tint: 'evening'|'night'|null, trans: 'fade'|'black' }
 *   { show: 'seoha', face: 'normal', at: 'center'|'left'|'right' }
 *   { hide: 'seoha' }
 *   { chapter: '1교시', title: '월요일 아침' }
 *   { choice: [ { text, set: {aff: 1}, goto: 'label' } ] }
 *   { set: { aff: 1 } }                 (숫자는 더하기, 그 외는 대입)
 *   { if: v => v.aff >= 3, goto: 'label' }
 *   { goto: 'label' }
 *   { shake: true } / { wait: 600 }
 *   { end: 'good', title: '엔딩 제목' }
 *
 * TODO(가스 시스템): 이후 v.gauge 같은 변수와 { gauge: +10 } 명령을 추가할 자리.
 * ========================================================================= */

const N = (text) => ({ say: null, text });
const M = (text) => ({ say: '나', text });
const S = (face, text) => ({ say: '서하', face, text });

const CHARACTERS = {
  seoha: {
    name: '서하',
    color: '#7fb8c9',
    faces: {
      normal: 'assets/characters/normal.png',
      pout: 'assets/characters/pout.png',
      uneasy: 'assets/characters/uneasy.png',
      wink: 'assets/characters/wink.png',
    },
  },
};

const BACKGROUNDS = {
  campus: 'assets/bg/campus.svg',
  lecture: 'assets/bg/classroom.jpg',
  cafeteria: 'assets/bg/cafeteria.svg',
  library: 'assets/bg/library.svg',
};

const INITIAL_VARS = { aff: 0 };

const ENDINGS = {
  good: '내일도, 같은 자리에서',
  normal: '평범한 월요일',
  bad: '엇갈린 하루',
};

const STORY = {
  /* ------------------------------------------------------------ 프롤로그 */
  start: [
    { bg: 'campus', trans: 'black' },
    { chapter: '프롤로그', title: '월요일 아침의 캠퍼스' },
    N('월요일 아침 8시 50분. 캠퍼스 정문 앞은 졸린 얼굴의 학생들로 붐볐다.'),
    N('나는 이 대학 국문과 3학년. 오늘은 1교시부터 전공 수업이 있다.'),
    M('(하아… 주말이 너무 짧았어.)'),
    N('본관으로 이어지는 길 위에서, 낯익은 베레모가 눈에 들어왔다.'),
    { show: 'seoha', face: 'normal', at: 'center' },
    N('윤서하. 같은 과 동기이자, 2년째 같은 수업을 듣고 있는 사람.'),
    N('스물두 살. 말수는 적지만, 과제만큼은 누구보다 꼼꼼한 걸로 유명하다.'),
    S('normal', '……아. 너구나.'),
    S('normal', '좋은 아침. 아니, 월요일이니까 별로 좋지는 않나.'),
    {
      choice: [
        { text: '"좋은 아침! 오늘 날씨 좋다."', set: { aff: 1 }, goto: 'p_bright' },
        { text: '"그 베레모, 새로 산 거야? 잘 어울린다."', set: { aff: 2 }, goto: 'p_hat' },
        { text: '"……응." (졸려서 대충 대답한다)', set: { aff: -1 }, goto: 'p_sleepy' },
      ],
    },
  ],

  p_bright: [
    M('좋은 아침! 오늘 날씨 진짜 좋다.'),
    S('normal', '……아침부터 텐션 높네.'),
    S('normal', '그래도 뭐, 나쁘진 않아. 하늘 맑은 건 인정.'),
    { goto: 'p_walk' },
  ],

  p_hat: [
    M('그 베레모 새로 산 거야? 잘 어울린다.'),
    S('pout', '……뭐, 뭐야 갑자기.'),
    S('pout', '지난주에 산 거 맞는데… 그걸 어떻게 알아봐.'),
    N('서하는 모자챙을 꾹 눌러 내려 얼굴을 가렸다. 귀가 조금 빨개진 것 같다.'),
    S('normal', '……고마워. 일단은.'),
    { goto: 'p_walk' },
  ],

  p_sleepy: [
    M('……응.'),
    S('pout', '……'),
    S('pout', '인사를 그렇게 성의 없이 받는 사람은 처음 봐.'),
    N('서하는 작게 한숨을 쉬더니 먼저 걸어가 버렸다.'),
    M('(아, 너무 대충 대답했나…)'),
    { goto: 'p_walk' },
  ],

  p_walk: [
    N('우리는 나란히 본관 3층 강의실로 향했다.'),
    { hide: 'seoha' },
    { goto: 'lecture' },
  ],

  /* ------------------------------------------------------------ 1교시 */
  lecture: [
    { bg: 'lecture', trans: 'fade' },
    { chapter: '1교시', title: '현대문학의 이해' },
    N('강의실은 생각보다 한산했다. 교수님은 아직 오지 않았다.'),
    { show: 'seoha', face: 'normal', at: 'center' },
    S('normal', '교수님 10분 늦으신대. 단톡방에 공지 올라왔어.'),
    M('그럼 잠깐 여유 있네.'),
    N('마침 가방 안에, 오는 길에 산 음료가 두 개 들어 있었다.'),
    M('(하나 건네볼까?)'),
    {
      choice: [
        { text: '아이스 아메리카노를 건넨다', set: { aff: 1, drink: 'coffee' }, goto: 'l_coffee' },
        { text: '따뜻한 우유를 건넨다', set: { aff: 2, drink: 'milk' }, goto: 'l_milk' },
        { text: '그냥 내가 둘 다 마신다', set: { aff: -1, drink: 'none' }, goto: 'l_none' },
      ],
    },
  ],

  l_coffee: [
    M('이거 마실래? 아아.'),
    S('normal', '……월요일 1교시엔 이게 국룰이긴 하지.'),
    S('wink', '고마워. 잘 마실게.'),
    { goto: 'l_after' },
  ],

  l_milk: [
    M('이거 마실래? 따뜻한 우유인데.'),
    S('pout', '……우유? 내가 애도 아니고.'),
    N('라고 말하면서도, 서하는 두 손으로 컵을 받아 들었다.'),
    S('normal', '……근데 오늘 좀 쌀쌀하긴 했어. 따뜻하다.'),
    S('wink', '센스는 인정해 줄게.'),
    { goto: 'l_after' },
  ],

  l_none: [
    N('나는 아메리카노와 우유를 번갈아 마셨다.'),
    S('pout', '……두 개를 혼자 다 마시는 거야?'),
    M('어? 아, 응. 오늘 좀 피곤해서.'),
    S('normal', '……그래. 마음대로 해.'),
    { goto: 'l_after' },
  ],

  l_after: [
    N('곧 교수님이 들어오셨고, 90분짜리 강의가 시작되었다.'),
    N('……'),
    N('수업이 끝나자 서하가 노트를 덮으며 이쪽을 돌아보았다.'),
    S('normal', '점심 어떻게 할 거야?'),
    {
      choice: [
        { text: '"학식 같이 먹을래?"', set: { aff: 1 }, goto: 'lunch_cafeteria' },
        { text: '"날씨 좋은데 벤치에서 먹자."', set: { aff: 1 }, goto: 'lunch_bench' },
      ],
    },
  ],

  /* ------------------------------------------------------------ 점심 A: 학식 */
  lunch_cafeteria: [
    { hide: 'seoha' },
    { bg: 'cafeteria', trans: 'fade' },
    { chapter: '점심시간', title: '학생식당' },
    N('점심시간의 학생식당은 언제나처럼 전쟁터였다.'),
    { show: 'seoha', face: 'normal', at: 'center' },
    S('normal', '오늘 백반 메뉴… 청국장이네.'),
    S('pout', '……나 청국장 좋아하는 거, 아무한테도 말하지 마.'),
    M('그게 왜 비밀이야?'),
    S('pout', '이미지라는 게 있잖아, 이미지가.'),
    N('서하는 결국 청국장 백반에 고구마 맛탕까지 추가해서 쟁반을 채웠다.'),
    M('(꽤 많이 먹네…)'),
    S('normal', '……뭘 봐. 아침 안 먹었단 말이야.'),
    { goto: 'lunch_end' },
  ],

  /* ------------------------------------------------------------ 점심 B: 벤치 */
  lunch_bench: [
    { hide: 'seoha' },
    { bg: 'campus', trans: 'fade' },
    { chapter: '점심시간', title: '본관 앞 벤치' },
    N('편의점에서 이것저것 사 들고 본관 앞 벤치에 앉았다.'),
    { show: 'seoha', face: 'normal', at: 'center' },
    S('normal', '바람 시원하다. 이런 날은 밖에서 먹는 게 맞네.'),
    N('서하의 봉지에는 삶은 계란 두 개와 탄산수, 그리고 군고구마가 들어 있었다.'),
    M('조합이 독특하다?'),
    S('pout', '……다이어트 식단이야. 건드리지 마.'),
    S('normal', '너도 하나 먹을래? 계란.'),
    M('그럼 하나만.'),
    S('wink', '나눠 먹으니까 더 맛있네.'),
    { goto: 'lunch_end' },
  ],

  lunch_end: [
    S('normal', '아, 맞다. 오후에 조별과제 자료 정리하기로 했잖아.'),
    S('normal', '도서관 3층에서 보자. 2시까지.'),
    M('응, 이따 봐.'),
    { hide: 'seoha' },
    { goto: 'library' },
  ],

  /* ------------------------------------------------------------ 오후: 도서관 */
  library: [
    { bg: 'library', trans: 'fade' },
    { chapter: '오후', title: '도서관 3층 열람실' },
    N('오후 2시. 도서관 3층은 조용하고 따뜻했다.'),
    { show: 'seoha', face: 'normal', at: 'center' },
    S('normal', '왔어? 발표 자료 목차는 대충 짜 놨어.'),
    N('서하가 노트북 화면을 이쪽으로 돌렸다. 역시나 꼼꼼하다.'),
    M('와, 벌써 다 했네.'),
    S('wink', '당연하지. 나 누구라고 생각해.'),
    N('한동안 자료를 정리하던 중이었다.'),
    S('uneasy', '……'),
    N('서하가 갑자기 말을 멈추더니, 배 쪽을 살짝 감싸며 자세를 고쳐 앉았다.'),
    S('uneasy', '……아, 아무것도 아니야. 신경 쓰지 마.'),
    N('얼굴이 조금 붉어져 있다. 아까 점심을 너무 급하게 먹은 걸까.'),
    {
      choice: [
        { text: '"괜찮아? 잠깐 쉬었다 할까?"', set: { aff: 2 }, goto: 'lib_care' },
        { text: '모른 척하고 하던 작업을 계속한다', set: { aff: 1 }, goto: 'lib_ignore' },
        { text: '"점심을 그렇게 먹더니~" 하고 놀린다', set: { aff: -2 }, goto: 'lib_tease' },
      ],
    },
  ],

  lib_care: [
    M('괜찮아? 잠깐 쉬었다 할까?'),
    S('uneasy', '……어?'),
    S('pout', '괜찮다니까. 그냥… 잠깐 자리 좀 비울게.'),
    N('서하는 노트북을 그대로 둔 채 조용히 열람실을 나갔다.'),
    { hide: 'seoha' },
    N('……10분쯤 지나 서하가 돌아왔다.'),
    { show: 'seoha', face: 'normal', at: 'center' },
    S('normal', '……아까는 물어봐 줘서, 고마워.'),
    S('wink', '너 의외로 눈치 빠르구나.'),
    { goto: 'lib_end' },
  ],

  lib_ignore: [
    N('나는 아무것도 못 본 척 키보드를 두드렸다.'),
    N('잠시 후, 서하는 "화장실 좀" 이라고 짧게 말하고 자리를 비웠다.'),
    { hide: 'seoha' },
    N('……'),
    { show: 'seoha', face: 'normal', at: 'center' },
    S('normal', '……미안, 갑자기 나가서. 이어서 하자.'),
    N('서하는 아무 일도 없었다는 듯 다시 화면에 집중했다.'),
    { goto: 'lib_end' },
  ],

  lib_tease: [
    M('점심을 그렇게 먹더니~ 배라도 아파?'),
    S('pout', '……'),
    { shake: true },
    S('pout', '진짜 최악이야, 너.'),
    N('서하는 노트북을 탁 덮고 자리에서 일어났다.'),
    S('pout', '나머지는 단톡방으로 보낼게. 먼저 갈게.'),
    { hide: 'seoha' },
    M('(……선 넘었다.)'),
    { goto: 'lib_end' },
  ],

  lib_end: [
    N('창밖의 하늘이 천천히 주황빛으로 물들기 시작했다.'),
    { goto: 'evening' },
  ],

  /* ------------------------------------------------------------ 저녁 & 엔딩 분기 */
  evening: [
    { hide: 'seoha' },
    { bg: 'campus', tint: 'evening', trans: 'fade' },
    { chapter: '방과 후', title: '노을 지는 캠퍼스' },
    N('오후 6시. 정문으로 향하는 길이 노을빛으로 물들어 있었다.'),
    { if: (v) => v.aff >= 5, goto: 'end_good' },
    { if: (v) => v.aff >= 1, goto: 'end_normal' },
    { goto: 'end_bad' },
  ],

  end_good: [
    { show: 'seoha', face: 'normal', at: 'center' },
    S('normal', '……어, 너도 지금 가?'),
    S('normal', '같이 가. 방향 같잖아.'),
    N('우리는 나란히 정문까지 걸었다. 아침과 똑같은 길인데, 어쩐지 다르게 느껴졌다.'),
    S('pout', '오늘… 이것저것 고마웠어. 음료도, 그리고 아까 도서관에서도.'),
    M('별거 아니었는데.'),
    S('wink', '별거였어. 나한테는.'),
    S('wink', '내일 2교시도 같은 수업이지? 자리, 맡아 둘게.'),
    { end: 'good' },
  ],

  end_normal: [
    { show: 'seoha', face: 'normal', at: 'center' },
    S('normal', '아, 수고했어. 오늘 과제 정리 덕분에 많이 줄었다.'),
    M('응, 너도 수고했어.'),
    S('normal', '그럼 내일 봐.'),
    { hide: 'seoha' },
    N('서하는 가볍게 손을 흔들고 버스 정류장 쪽으로 걸어갔다.'),
    N('특별할 것 없는, 평범한 월요일이었다.'),
    { end: 'normal' },
  ],

  end_bad: [
    N('정문 앞에서 서하의 뒷모습이 보였다.'),
    N('불러 볼까 잠깐 망설였지만, 서하는 이어폰을 낀 채 빠르게 멀어져 갔다.'),
    M('(……내일은 제대로 사과해야겠다.)'),
    { end: 'bad' },
  ],
};
