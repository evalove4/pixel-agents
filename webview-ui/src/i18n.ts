export type Locale = 'en' | 'ko';

const LOCALE_KEY = 'pixel-agents-locale';

export function getStoredLocale(): Locale {
  try {
    const v = localStorage.getItem(LOCALE_KEY);
    return v === 'ko' ? 'ko' : 'en';
  } catch {
    return 'en';
  }
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // ignore
  }
}

const strings = {
  en: {
    idle: 'Idle',
    needsApproval: 'Needs approval',
    waitingForInput: 'Waiting for input',
    subtask: 'Subtask',
    settings: 'Settings',
    layout: 'Layout',
    addAgent: '+ Agent',
    skipPermissions: 'Skip permissions mode',
    undo: 'Undo',
    redo: 'Redo',
    save: 'Save',
    reset: 'Reset',
    resetConfirm: 'Reset?',
    yes: 'Yes',
    no: 'No',
    language: 'Language',
    closeAgent: 'Close agent',
    loading: 'Loading...',
    rotate: 'Rotate (R)',
    openSessionsFolder: 'Open Sessions Folder',
    exportLayout: 'Export Layout',
    importLayout: 'Import Layout',
    addAssetDir: 'Add Asset Directory',
    soundNotifications: 'Sound Notifications',
    watchAllSessions: 'Watch All Sessions',
    instantDetection: 'Instant Detection (Hooks)',
    alwaysShowLabels: 'Always Show Labels',
    debugView: 'Debug View',
    hooksTitle: 'Instant Detection Active',
    hooksDesc: 'Your agents now respond in real-time.',
    hooksViewMore: 'View more',
    hooksModalTitle: 'Instant Detection is ON',
    hooksModalIntro: 'Your Pixel Agents office now reacts in real-time:',
    hooksFeature1: 'Permission prompts appear instantly',
    hooksFeature2: 'Turn completions detected the moment they happen',
    hooksFeature3: 'Sound notifications play immediately',
    hooksModalNote:
      'This works through Claude Code Hooks, small event listeners that notify Pixel Agents whenever something happens in your Claude sessions.',
    gotIt: 'Got it',
    hooksDisableHint: 'To disable, go to Settings > Instant Detection',
  },
  ko: {
    idle: '대기 중',
    needsApproval: '승인 필요',
    waitingForInput: '입력 기다리는 중',
    subtask: '서브작업',
    settings: '설정',
    layout: '레이아웃',
    addAgent: '+ 에이전트',
    skipPermissions: '권한 승인 건너뛰기',
    undo: '실행 취소',
    redo: '다시 실행',
    save: '저장',
    reset: '초기화',
    resetConfirm: '초기화?',
    yes: '예',
    no: '아니오',
    language: '언어',
    closeAgent: '에이전트 닫기',
    loading: '불러오는 중...',
    rotate: '회전 (R)',
    openSessionsFolder: '세션 폴더 열기',
    exportLayout: '레이아웃 내보내기',
    importLayout: '레이아웃 가져오기',
    addAssetDir: '에셋 디렉터리 추가',
    soundNotifications: '소리 알림',
    watchAllSessions: '모든 세션 감시',
    instantDetection: '즉시 감지 (훅)',
    alwaysShowLabels: '항상 레이블 표시',
    debugView: '디버그 뷰',
    hooksTitle: '즉시 감지 활성화됨',
    hooksDesc: '에이전트가 이제 실시간으로 반응합니다.',
    hooksViewMore: '더 보기',
    hooksModalTitle: '즉시 감지가 켜져 있어요',
    hooksModalIntro: '픽셀 에이전트 오피스가 이제 실시간으로 반응해요:',
    hooksFeature1: '권한 요청이 즉시 표시됩니다',
    hooksFeature2: '턴 완료가 바로 감지됩니다',
    hooksFeature3: '소리 알림이 즉시 재생됩니다',
    hooksModalNote:
      'Claude Code 훅을 통해 동작합니다. Claude 세션에서 무언가 일어날 때마다 픽셀 에이전트에 알려주는 이벤트 리스너입니다.',
    gotIt: '확인',
    hooksDisableHint: '비활성화하려면 설정 > 즉시 감지로 이동하세요',
  },
} as const;

type StringKey = keyof typeof strings.en;

export function t(key: StringKey, locale: Locale): string {
  return strings[locale][key];
}

// Dynamic tool status translation — English prefix → Korean.
// The server always emits English status strings (STATUS_TO_TOOL depends on them).
// This function translates at render time without touching the detection layer.
const STATUS_KO: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^Reading (.+)$/, (m) => `${m[1]} 읽는 중`],
  [/^Writing (.+)$/, (m) => `${m[1]} 쓰는 중`],
  [/^Editing (.+)$/, (m) => `${m[1]} 편집 중`],
  [/^Running: (.+)$/, (m) => `실행 중: ${m[1]}`],
  [/^Searching files$/, () => '파일 검색 중'],
  [/^Searching code$/, () => '코드 검색 중'],
  [/^Fetching web content$/, () => '웹 콘텐츠 가져오는 중'],
  [/^Searching the web$/, () => '웹 검색 중'],
  [/^Subtask: (.+)$/, (m) => `서브작업: ${m[1]}`],
  [/^Running subtask$/, () => '서브작업 실행 중'],
  [/^Using (.+)$/, (m) => `${m[1]} 사용 중`],
  [/^Waiting for your answer$/, () => '답변 기다리는 중'],
  [/^Planning$/, () => '계획 중'],
  [/^Editing notebook$/, () => '노트북 편집 중'],
  [/^Creating team: (.+)$/, (m) => `팀 생성 중: ${m[1]}`],
  [/^Creating team$/, () => '팀 생성 중'],
  [/^Sending message$/, () => '메시지 전송 중'],
];

export function translateStatus(status: string, locale: Locale): string {
  if (locale === 'en') return status;
  for (const [re, fn] of STATUS_KO) {
    const m = status.match(re);
    if (m) return fn(m);
  }
  return status;
}
