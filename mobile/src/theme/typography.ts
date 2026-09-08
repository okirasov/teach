import type { TextStyle } from 'react-native';

/**
 * Шрифты: Golos Text (UI), IBM Plex Mono (данные/кикеры).
 * В React Native вес задаётся именем гарнитуры, а не fontWeight,
 * поэтому каждый вес — отдельное семейство.
 */
export const fonts = {
  sans400: 'GolosText_400Regular',
  sans500: 'GolosText_500Medium',
  sans600: 'GolosText_600SemiBold',
  sans700: 'GolosText_700Bold',
  mono400: 'IBMPlexMono_400Regular',
  mono500: 'IBMPlexMono_500Medium',
} as const;

type Weight = 400 | 500 | 600 | 700;

const sansByWeight: Record<Weight, string> = {
  400: fonts.sans400,
  500: fonts.sans500,
  600: fonts.sans600,
  700: fonts.sans700,
};

const monoByWeight: Record<400 | 500, string> = {
  400: fonts.mono400,
  500: fonts.mono500,
};

export function sans(size: number, weight: Weight = 400, lineHeight = 1.4): TextStyle {
  return { fontFamily: sansByWeight[weight], fontSize: size, lineHeight: Math.round(size * lineHeight) };
}

export function mono(size: number, weight: 400 | 500 = 500, letterSpacing = 0): TextStyle {
  return { fontFamily: monoByWeight[weight], fontSize: size, lineHeight: Math.round(size * 1.2), letterSpacing };
}

/** Именованные стили из DESIGN.md §1 «Типографика» и §3. */
export const type = {
  /** h1 экрана / вкладки. */
  h1: { ...sans(26, 600, 1.2), letterSpacing: -0.3 },
  /** Заголовок шага объяснения. */
  h2: { ...sans(23, 600, 1.2), letterSpacing: -0.3 },
  /** Заголовок hero-карты. */
  hero: sans(22, 600, 1.2),
  /** Вопрос практики. */
  question: sans(19, 500, 1.45),
  /** Имя предмета на карточке. */
  cardTitle: sans(16.5, 600, 1.3),
  /** Основной текст. */
  body: sans(15, 400, 1.6),
  /** Строка списка / вариант ответа. */
  row: sans(14.5, 400, 1.4),
  rowMed: sans(14.5, 500, 1.4),
  /** Заголовок карточки повтора. */
  item: sans(14, 500, 1.4),
  /** Подпись вкладки рядом с h1, мета. */
  meta: sans(13, 400, 1.4),
  metaMed: sans(13, 500, 1.4),
  /** Заголовок группы настроек в Профиле. */
  group: sans(13, 500, 1.4),
  /** Вторичный текст. */
  small: sans(12.5, 400, 1.45),
  smallMed: sans(12.5, 500, 1),
  /** Мелкая подпись. */
  tiny: sans(12, 400, 1.4),
  note: sans(11.5, 400, 1.5),
  /** Таб-бар. */
  tab: sans(11.5, 400, 1),
  tabActive: sans(11.5, 500, 1),
  /** Текст кнопок. */
  button: sans(16, 600, 1),
  buttonSm: sans(15, 600, 1),
  buttonConfirm: sans(14, 600, 1),
  /** Пиллы и сегменты. */
  pill: sans(13, 500, 1),
  seg: sans(12.5, 500, 1),
  segActive: sans(12.5, 600, 1),
  /** Логотип в шапке. */
  logo: { ...sans(21, 600, 1), letterSpacing: -0.3 },
  logoLg: { ...sans(40, 600, 1), letterSpacing: -0.5 },
  /** Кикеры: mono, UPPERCASE, ls .08–.1em. */
  kicker: { ...mono(10.5, 500, 1.05), textTransform: 'uppercase' as const },
  kickerSm: { ...mono(10, 500, 1.0), textTransform: 'uppercase' as const },
  /** Чип-статус. */
  chip: { ...mono(11, 500, 0.66), textTransform: 'uppercase' as const },
  chipSm: mono(10, 500, 0.5),
  chipTag: mono(10.5, 500, 0),
  /** Дата в шапке, счётчик n/N, уровень. */
  monoMeta: mono(11, 500, 0),
  monoBadge: mono(11, 500, 0),
  /** Числа статистики в профиле. */
  stat: sans(19, 600, 1.1),
  statLabel: sans(11, 400, 1.2),
} satisfies Record<string, TextStyle>;

export type TypeName = keyof typeof type;
