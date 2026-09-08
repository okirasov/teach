/**
 * Design tokens — источник: design_handoff_teach_mobile/DESIGN.md §2–3.
 * Имена совпадают с CSS-переменными прототипа (--bg → bg), чтобы спецификацию
 * можно было читать один в один.
 */

export const palette = {
  light: {
    bg: '#FAF6EE',
    card: '#FFFFFF',
    ink: '#12281C',
    ink2: '#24332B',
    mut: '#4A5A50',
    mut2: '#8A9A8F',
    mint: '#DCEEDF',
    mintInk: '#1C4634',
    chipDk: '#12281C',
    btnInk: '#FAF6EE',
    sand: '#EFE7D5',
    sandInk: '#6B6353',
    amber: '#835A0E',
    amberBg: '#F5EAD2',
    err: '#B4552F',
    errBg: '#F5E3DB',
    errInk: '#7A3A22',
    errLine: 'rgba(180,85,47,0.4)',
    errHalo: 'rgba(180,85,47,0.15)',
    sel: '#EFF7F0',
    onAccent: '#FAF6EE',
    dis: '#C9D6CC',
    trackOff: '#D9D2C2',
    line: 'rgba(28,70,52,0.15)',
    lineSoft: 'rgba(28,70,52,0.11)',
    line2: 'rgba(28,70,52,0.22)',
    heroBg: '#1C4634',
    heroInk: '#FAF6EE',
    heroSub: '#C9D6CC',
    heroKicker: '#9FD6B4',
    /** Фон вокруг девайса (только для превью/веба). */
    frame: '#EFEBE0',
  },
  dark: {
    bg: '#0F1B15',
    card: '#17271D',
    ink: '#EDF3EA',
    ink2: '#C9D6CC',
    mut: '#8FA697',
    mut2: '#5E7065',
    mint: '#1E3226',
    mintInk: '#9FD6B4',
    chipDk: '#DCEEDF',
    btnInk: '#12281C',
    sand: '#2A281E',
    sandInk: '#B5A98E',
    amber: '#DFA032',
    amberBg: '#3A2F14',
    err: '#D9764F',
    errBg: '#3A231B',
    errInk: '#F0B49B',
    errLine: 'rgba(217,118,79,0.5)',
    errHalo: 'rgba(217,118,79,0.15)',
    sel: '#21332A',
    onAccent: '#FAF6EE',
    dis: '#2E3E34',
    trackOff: '#3A473E',
    line: 'rgba(220,238,223,0.15)',
    lineSoft: 'rgba(220,238,223,0.1)',
    line2: 'rgba(220,238,223,0.28)',
    heroBg: '#14231A',
    heroInk: '#EDF3EA',
    heroSub: '#8FA697',
    heroKicker: '#9FD6B4',
    frame: '#0A120D',
  },
} as const;

export type ThemeName = keyof typeof palette;
export type Palette = { [K in keyof typeof palette.light]: string };

/** Бренд-константы, не зависящие от темы. */
export const brand = {
  /** Янтарная точка знака — «ещё не наступивший повтор». */
  markAmber: '#DFA032',
  /** Хвойный фон иконки приложения. */
  pine: '#1C4634',
  cream: '#FAF6EE',
} as const;

export const radius = {
  chip: 7, // чипы-статусы, сегменты
  segBox: 9, // подложка сегмент-контрола
  pill: 10, // пиллы h42
  input: 12, // инпуты, варианты ответа
  card: 14, // карточки, primary-кнопки
  cardLg: 16, // hero, карточки предметов
  round: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  /** Боковые поля экрана. */
  screenX: 20,
  /** Нижний отступ экрана (поверх safe-area). */
  screenBottom: 30,
} as const;

export const size = {
  buttonPrimary: 54,
  buttonSecondary: 52,
  buttonConfirm: 48,
  pill: 42,
  hitTarget: 44,
  row: 46,
  toggleW: 46,
  toggleH: 28,
  toggleKnob: 22,
  avatar: 34,
  avatarLg: 44,
  closeCircle: 36,
  closeCircleSm: 26,
  progressH: 4,
  progressGap: 5,
  mic: 52,
  micLg: 96,
  refTermCol: 126,
} as const;

export const border = {
  card: 1,
  input: 1.5,
} as const;

export const shadow = {
  segActive: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
} as const;
