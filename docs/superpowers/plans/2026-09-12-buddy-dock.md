# Buddy Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A persistent dock above the session CTA where the brand mark (four dots) animates the turn state and reacts to the answer, with a one-word status.

**Architecture:** A pure state machine (`buddyState.ts`) maps existing session flags to one of eight `BuddyState`s. `BuddyMark` (in `src/ui`) animates four `Animated.View` dots per state using RN `Animated` only. `BuddyDock` (in `src/features/session`) composes the mark with the status word, background tone, accessibility announcements and haptics, and is mounted once in `app/session/[id].tsx` above the primary button.

**Tech Stack:** React Native 0.86 / Expo SDK 57, TypeScript, zustand, RN `Animated` (native driver), jest-expo + react-test-renderer 19. New dependency: `expo-haptics` (Task 7 only).

**Spec:** `docs/superpowers/specs/2026-09-12-buddy-dock-design.md`

## Global Constraints

- All work happens in `mobile/`; run commands from `mobile/`.
- No new animation libraries (no reanimated, lottie, rive, skia). RN `Animated` only.
- Only new dependency allowed: `expo-haptics` (Task 7). Everything else must work with what is in `package.json`.
- Dock is rendered only on the session screen (`app/session/[id].tsx`). Nowhere else.
- Colors only through theme tokens (`useTheme().c`): dots `mintInk`, contour dot `amber`, dock background `card` / `mint` / `amberBg` / `errBg`, border `line`.
- Words from i18n (`src/i18n/ru.ts` is the type source; `en.ts` must have the same keys).
- Reduce-motion: when enabled, no loops and no one-shot animations; only final poses.
- Priority of states: `listening` > `speaking` > `thinking` > reaction (`right`/`partial`/`wrong`) > `reading` > `waiting`.
- Keep `npm run typecheck` and `npm test` green after every task. Commit after every task.
- Comments in code are in Russian, like the rest of the codebase; identifiers in English.

---

## File structure

| File | Responsibility |
|---|---|
| `src/features/session/buddyState.ts` (create) | Pure function `buddyStateOf(input)` and the `BuddyState` union. No React. |
| `src/features/session/__tests__/buddyState.test.ts` (create) | Table + priority tests. |
| `src/i18n/ru.ts`, `src/i18n/en.ts` (modify) | `buddy` dictionary: one word per state. |
| `src/ui/useReduceMotion.ts` (create) | Hook over `AccessibilityInfo.isReduceMotionEnabled` + change subscription. |
| `src/ui/BuddyMark.tsx` (create) | Four animated dots; takes `state`, `reduceMotion`, `animateReaction`. Owns all `Animated` code. |
| `src/ui/index.ts` (modify) | Export `BuddyMark`, `useReduceMotion`. |
| `src/features/session/BuddyDock.tsx` (create) | Card with mark + word; reads `useSpeaker()`; computes state; VoiceOver announcements; haptics. |
| `src/features/session/__tests__/BuddyDock.test.tsx` (create) | Renders each state, checks word and background. |
| `app/session/[id].tsx` (modify) | Compute `hits`/`tone` once; mount `<BuddyDock>` above `<Button>`. |
| `README.md` (modify) | Short paragraph about the dock. |

---

### Task 1: State machine

**Files:**
- Create: `src/features/session/buddyState.ts`
- Test: `src/features/session/__tests__/buddyState.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type BuddyState = 'reading' | 'waiting' | 'listening' | 'speaking' | 'thinking' | 'right' | 'partial' | 'wrong';
  export type FeedbackTone = 'mint' | 'amber' | 'err';
  export interface BuddyInput {
    stepType: 'explain' | 'choice' | 'input' | 'free' | 'order';
    checked: boolean;
    viewingPast: boolean;
    rec: boolean;
    speaking: boolean;
    grading: boolean;
    /** Тон фидбек-карточки после проверки; null, пока шаг не проверен. */
    tone: FeedbackTone | null;
  }
  export function buddyStateOf(i: BuddyInput): BuddyState;
  export const REACTIONS: ReadonlySet<BuddyState>; // right, partial, wrong
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/session/__tests__/buddyState.test.ts
import { buddyStateOf, REACTIONS, type BuddyInput } from '../buddyState';

const base: BuddyInput = { stepType: 'free', checked: false, viewingPast: false, rec: false, speaking: false, grading: false, tone: null };

describe('buddyStateOf', () => {
  it('reads on explain steps and on past steps', () => {
    expect(buddyStateOf({ ...base, stepType: 'explain' })).toBe('reading');
    expect(buddyStateOf({ ...base, checked: true, tone: 'mint', viewingPast: true })).toBe('reading');
  });
  it('waits on an unchecked practice step', () => {
    expect(buddyStateOf(base)).toBe('waiting');
    expect(buddyStateOf({ ...base, stepType: 'choice' })).toBe('waiting');
  });
  it('maps flags to listening, speaking, thinking', () => {
    expect(buddyStateOf({ ...base, rec: true })).toBe('listening');
    expect(buddyStateOf({ ...base, speaking: true })).toBe('speaking');
    expect(buddyStateOf({ ...base, grading: true })).toBe('thinking');
  });
  it('maps the feedback tone to a reaction', () => {
    expect(buddyStateOf({ ...base, checked: true, tone: 'mint' })).toBe('right');
    expect(buddyStateOf({ ...base, checked: true, tone: 'amber' })).toBe('partial');
    expect(buddyStateOf({ ...base, checked: true, tone: 'err' })).toBe('wrong');
  });
  it('falls back to waiting when checked without a tone', () => {
    expect(buddyStateOf({ ...base, checked: true })).toBe('waiting');
  });
  it('applies priorities: listening > speaking > thinking > reaction > reading', () => {
    expect(buddyStateOf({ ...base, rec: true, speaking: true, grading: true, checked: true, tone: 'err' })).toBe('listening');
    expect(buddyStateOf({ ...base, speaking: true, grading: true, checked: true, tone: 'err' })).toBe('speaking');
    expect(buddyStateOf({ ...base, grading: true, checked: true, tone: 'err' })).toBe('thinking');
    expect(buddyStateOf({ ...base, speaking: true, checked: true, tone: 'mint' })).toBe('speaking');
    expect(buddyStateOf({ ...base, speaking: true, stepType: 'explain' })).toBe('speaking');
    expect(buddyStateOf({ ...base, speaking: true, viewingPast: true, checked: true, tone: 'mint' })).toBe('speaking');
  });
  it('lists reactions', () => {
    expect([...REACTIONS].sort()).toEqual(['partial', 'right', 'wrong']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/session/__tests__/buddyState.test.ts`
Expected: FAIL, cannot find module `../buddyState`.

- [ ] **Step 3: Implement the state machine**

```ts
// src/features/session/buddyState.ts
/**
 * Состояние бадди в сессии (spec: docs/superpowers/specs/2026-09-12-buddy-dock-design.md).
 * Чистая функция над уже существующими флагами сессии; приоритеты при наложении:
 * слушает > читает пример > думает > реакция > читайте > ваш ход.
 */
export type BuddyState = 'reading' | 'waiting' | 'listening' | 'speaking' | 'thinking' | 'right' | 'partial' | 'wrong';

export type FeedbackTone = 'mint' | 'amber' | 'err';

export interface BuddyInput {
  stepType: 'explain' | 'choice' | 'input' | 'free' | 'order';
  checked: boolean;
  viewingPast: boolean;
  rec: boolean;
  speaking: boolean;
  grading: boolean;
  /** Тон фидбек-карточки после проверки; null, пока шаг не проверен. */
  tone: FeedbackTone | null;
}

export const REACTIONS: ReadonlySet<BuddyState> = new Set<BuddyState>(['right', 'partial', 'wrong']);

const REACTION_OF: Record<FeedbackTone, BuddyState> = { mint: 'right', amber: 'partial', err: 'wrong' };

export function buddyStateOf(i: BuddyInput): BuddyState {
  if (i.rec) return 'listening';
  if (i.speaking) return 'speaking';
  if (i.grading) return 'thinking';
  if (i.viewingPast || i.stepType === 'explain') return 'reading';
  if (i.checked && i.tone) return REACTION_OF[i.tone];
  return 'waiting';
}
```

Check the actual step type names in `src/domain/types.ts` (`grep -n "type: '" src/domain/types.ts`). If there is a step type other than `explain | choice | input | free | order`, add it to `stepType`; the logic does not change.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/session/__tests__/buddyState.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/session/buddyState.ts src/features/session/__tests__/buddyState.test.ts
git commit -m "Buddy: state machine over session flags"
```

---

### Task 2: Dictionary words

**Files:**
- Modify: `src/i18n/ru.ts` (inside the `ru` object, next to `micIdle`)
- Modify: `src/i18n/en.ts` (same place)

**Interfaces:**
- Produces: `t.buddy[state]` for every `BuddyState` from Task 1 (`Record<BuddyState, string>`).

- [ ] **Step 1: Add the Russian words**

In `src/i18n/ru.ts`, right after the `micIdle: … micRec: …` line, add:

```ts
  buddy: { reading: 'Читайте', waiting: 'Ваш ход', listening: 'Слушаю', speaking: 'Читаю пример', thinking: 'Думаю', right: 'Верно', partial: 'Частично', wrong: 'Не совсем' },
```

- [ ] **Step 2: Add the English words**

In `src/i18n/en.ts`, right after the `micIdle: … micRec: …` line, add:

```ts
  buddy: { reading: 'Read on', waiting: 'Your turn', listening: 'Listening', speaking: 'Reading the example', thinking: 'Thinking', right: 'Correct', partial: 'Partly', wrong: 'Not quite' },
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors (`Dict = typeof ru`, so `en` must carry the same keys; a missing key fails here).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/ru.ts src/i18n/en.ts
git commit -m "Buddy: status words in ru and en"
```

---

### Task 3: Reduce-motion hook

**Files:**
- Create: `src/ui/useReduceMotion.ts`
- Modify: `src/ui/index.ts`

**Interfaces:**
- Produces: `export function useReduceMotion(): boolean`

- [ ] **Step 1: Write the hook**

```ts
// src/ui/useReduceMotion.ts
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Системное «Уменьшить движение»: при включении анимации бадди заменяются конечными позами. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
```

- [ ] **Step 2: Export it**

Append to `src/ui/index.ts`:

```ts
export { useReduceMotion } from './useReduceMotion';
```

- [ ] **Step 3: Typecheck and commit**

Run: `npm run typecheck` → no errors.

```bash
git add src/ui/useReduceMotion.ts src/ui/index.ts
git commit -m "Buddy: useReduceMotion hook"
```

---

### Task 4: BuddyMark animations

**Files:**
- Create: `src/ui/BuddyMark.tsx`
- Modify: `src/ui/index.ts`

**Interfaces:**
- Consumes: `BuddyState` from `@/features/session/buddyState`.
- Produces:
  ```ts
  export function BuddyMark(props: { state: BuddyState; reduceMotion: boolean; animateReaction: boolean; size?: number }): JSX.Element;
  ```
  `size` is the dot diameter (default 10; gap = 0.6 × size). `animateReaction=false` jumps a reaction to its final pose without playing it.

Geometry: dots 10px, gap 6, so centers sit at 5, 21, 37, 53 of a 58px row; the center of the row is 29, so the "think" offsets toward the center are `[+24, +8, -8, -24]`. The last dot is a 2.5px `amber` ring; its fill is an inner `Animated.View` scaled 0→1 (native driver friendly, no color animation).

- [ ] **Step 1: Write the component**

```tsx
// src/ui/BuddyMark.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import type { BuddyState } from '@/features/session/buddyState';
import { useTheme } from '@/theme';

interface BuddyMarkProps {
  state: BuddyState;
  /** Системное «Уменьшить движение»: только конечные позы. */
  reduceMotion: boolean;
  /** false — реакция сразу в конечной позе (просмотр уже сыгранной реакции). */
  animateReaction: boolean;
  /** Диаметр точки; gap = 0.6 × size. */
  size?: number;
}

interface Dot {
  scale: Animated.Value;
  scaleY: Animated.Value;
  tx: Animated.Value;
  ty: Animated.Value;
}

const THINK_OFFSETS = [24, 8, -8, -24];

/** Знак бренда как бадди: четыре точки, последняя контурная янтарная. Вся пластика — здесь. */
export function BuddyMark({ state, reduceMotion, animateReaction, size = 10 }: BuddyMarkProps) {
  const { c } = useTheme();
  const dots = useMemo<Dot[]>(
    () => Array.from({ length: 4 }, () => ({ scale: new Animated.Value(1), scaleY: new Animated.Value(1), tx: new Animated.Value(0), ty: new Animated.Value(0) })),
    [],
  );
  const fill = useRef(new Animated.Value(0)).current;
  const running = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    running.current?.stop();
    running.current = null;
    // Сброс в нейтральную позу; залитая точка остаётся только на «верно».
    for (const d of dots) {
      d.scale.setValue(1);
      d.scaleY.setValue(1);
      d.tx.setValue(0);
      d.ty.setValue(0);
    }
    fill.setValue(state === 'right' ? 1 : 0);
    if (reduceMotion) return;
    const isReaction = state === 'right' || state === 'partial' || state === 'wrong';
    if (isReaction && !animateReaction) return;

    const anim = animationFor(state, dots, fill, size);
    if (!anim) return;
    running.current = anim;
    anim.start();
    return () => {
      anim.stop();
    };
  }, [state, reduceMotion, animateReaction, dots, fill, size]);

  const gap = Math.round(size * 0.6);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap, height: size * 2.4 }} accessible={false}>
      {dots.map((d, i) => {
        const last = i === 3;
        const ring = last ? size + 1 : size;
        return (
          <Animated.View
            key={i}
            style={{
              width: ring,
              height: ring,
              borderRadius: ring / 2,
              backgroundColor: last ? 'transparent' : c.mintInk,
              borderWidth: last ? 2.5 : 0,
              borderColor: last ? c.amber : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ translateX: d.tx }, { translateY: d.ty }, { scale: d.scale }, { scaleY: d.scaleY }],
            }}
          >
            {last ? (
              <Animated.View style={{ width: ring - 5, height: ring - 5, borderRadius: (ring - 5) / 2, backgroundColor: c.amber, transform: [{ scale: fill }] }} />
            ) : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

const T = (value: Animated.Value, toValue: number, duration: number, easing = Easing.inOut(Easing.ease)) =>
  Animated.timing(value, { toValue, duration, easing, useNativeDriver: true });

/** Анимация состояния; null — статичная поза («читайте», реакции без проигрывания). */
function animationFor(state: BuddyState, dots: Dot[], fill: Animated.Value, size: number): Animated.CompositeAnimation | null {
  switch (state) {
    case 'waiting':
      // Дыхание слева направо, 2.6 с на круг.
      return Animated.loop(
        Animated.stagger(
          300,
          dots.map((d) => Animated.sequence([T(d.scale, 1.2, 1300), T(d.scale, 1, 1300)])),
        ),
      );
    case 'listening': {
      // Эквалайзер: у каждой точки свой период, уровень микрофона платформа не отдаёт.
      const periods = [700, 550, 800, 650];
      return Animated.parallel(
        dots.map((d, i) =>
          Animated.loop(Animated.sequence([T(d.scaleY, 2.1, periods[i] / 2), T(d.scaleY, 0.7, periods[i] / 2)])),
        ),
      );
    }
    case 'speaking':
      // Волна бежит по ряду, 1 с.
      return Animated.loop(
        Animated.stagger(
          120,
          dots.map((d) => Animated.sequence([T(d.ty, -size * 0.6, 300), T(d.ty, size * 0.2, 300), T(d.ty, 0, 400)])),
        ),
      );
    case 'thinking':
      // Точки сходятся к центру и расходятся, 1.4 с.
      return Animated.loop(
        Animated.parallel(
          dots.map((d, i) => Animated.sequence([T(d.tx, THINK_OFFSETS[i], 700), T(d.tx, 0, 700)])),
        ),
      );
    case 'right': {
      // Контурная точка заливается и подпрыгивает; остаётся залитой.
      const last = dots[3];
      fill.setValue(0);
      return Animated.parallel([
        T(fill, 1, 350, Easing.out(Easing.back(1.5))),
        Animated.sequence([T(last.scale, 1.5, 250), T(last.scale, 1.15, 200)]),
      ]);
    }
    case 'partial':
      // Половина ряда оседает и выпрямляется.
      return sag(dots.slice(2), size);
    case 'wrong':
      // Весь ряд оседает и выпрямляется.
      return sag(dots, size);
    case 'reading':
      return null;
  }
}

function sag(dots: Dot[], size: number): Animated.CompositeAnimation {
  return Animated.stagger(
    50,
    dots.map((d) =>
      Animated.sequence([
        Animated.parallel([T(d.ty, size * 0.5, 400), T(d.scale, 0.9, 400)]),
        Animated.delay(500),
        Animated.parallel([T(d.ty, 0, 550), T(d.scale, 1, 550)]),
      ]),
    ),
  );
}
```

- [ ] **Step 2: Export it**

Append to `src/ui/index.ts`:

```ts
export { BuddyMark } from './BuddyMark';
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck` → no errors. If `Animated.stagger` / `Animated.loop` typings complain about `CompositeAnimation`, the return type annotation of `animationFor` should stay `Animated.CompositeAnimation | null`; both helpers return that type in RN 0.86.

- [ ] **Step 4: Smoke-render in a test**

Create `src/ui/__tests__/BuddyMark.test.tsx`:

```tsx
import React from 'react';
import { act, create } from 'react-test-renderer';

import { BuddyMark } from '../BuddyMark';

describe('BuddyMark', () => {
  it('renders four dots in every state without throwing', () => {
    const states = ['reading', 'waiting', 'listening', 'speaking', 'thinking', 'right', 'partial', 'wrong'] as const;
    for (const state of states) {
      let tree!: ReturnType<typeof create>;
      act(() => {
        tree = create(<BuddyMark state={state} reduceMotion animateReaction />);
      });
      // Четыре точки: три залитых + контурная (у контурной есть внутренняя заливка).
      const views = tree.root.findAll((n) => typeof n.type === 'string' && n.type === 'View');
      expect(views.length).toBeGreaterThanOrEqual(5);
      act(() => tree.unmount());
    }
  });
});
```

Run: `npx jest src/ui/__tests__/BuddyMark.test.tsx`
Expected: PASS. (Uses `reduceMotion` so no timers are scheduled in the test.)

- [ ] **Step 5: Commit**

```bash
git add src/ui/BuddyMark.tsx src/ui/index.ts src/ui/__tests__/BuddyMark.test.tsx
git commit -m "Buddy: animated brand mark with a pose per state"
```

---

### Task 5: BuddyDock

**Files:**
- Create: `src/features/session/BuddyDock.tsx`
- Test: `src/features/session/__tests__/BuddyDock.test.tsx`

**Interfaces:**
- Consumes: `buddyStateOf`, `BuddyInput`, `REACTIONS` (Task 1); `t.buddy` (Task 2); `useReduceMotion`, `BuddyMark` (Tasks 3–4); `useSpeaker` from `./speaker`.
- Produces:
  ```ts
  export interface BuddyDockProps extends Omit<BuddyInput, 'speaking'> {
    /** Индекс активного шага (s.step): реакция играет один раз на шаг. */
    stepIndex: number;
    /** Тестовый override системной настройки. */
    reduceMotion?: boolean;
  }
  export function BuddyDock(props: BuddyDockProps): JSX.Element;
  ```
  `speaking` is read inside via `useSpeaker()` (the dock renders inside `SpeakerProvider`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/session/__tests__/BuddyDock.test.tsx
import React from 'react';
import { act, create } from 'react-test-renderer';

import { BuddyDock } from '../BuddyDock';
import { ru } from '@/i18n/ru';
import { palette } from '@/theme/tokens';

const base = { stepType: 'free' as const, checked: false, viewingPast: false, rec: false, grading: false, tone: null, stepIndex: 1, reduceMotion: true };

function render(props: Partial<React.ComponentProps<typeof BuddyDock>>) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<BuddyDock {...base} {...props} />);
  });
  return tree;
}

function wordOf(tree: ReturnType<typeof create>): string {
  return tree.root.findAll((n) => n.type === 'Text').map((n) => n.children.join('')).join(' ');
}

function bgOf(tree: ReturnType<typeof create>): string {
  const root = tree.root.findByProps({ testID: 'buddy-dock' });
  const style = Array.isArray(root.props.style) ? Object.assign({}, ...root.props.style) : root.props.style;
  return style.backgroundColor;
}

describe('BuddyDock', () => {
  it('shows the word of the state', () => {
    expect(wordOf(render({}))).toContain(ru.buddy.waiting);
    expect(wordOf(render({ rec: true }))).toContain(ru.buddy.listening);
    expect(wordOf(render({ grading: true }))).toContain(ru.buddy.thinking);
    expect(wordOf(render({ stepType: 'explain' }))).toContain(ru.buddy.reading);
  });
  it('tints the dock on reactions', () => {
    expect(bgOf(render({}))).toBe(palette.light.card);
    expect(bgOf(render({ checked: true, tone: 'mint' }))).toBe(palette.light.mint);
    expect(bgOf(render({ checked: true, tone: 'amber' }))).toBe(palette.light.amberBg);
    expect(bgOf(render({ checked: true, tone: 'err' }))).toBe(palette.light.errBg);
  });
  it('exposes the word to screen readers', () => {
    const root = render({ checked: true, tone: 'err' }).root.findByProps({ testID: 'buddy-dock' });
    expect(root.props.accessibilityLabel).toBe(ru.buddy.wrong);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/session/__tests__/BuddyDock.test.tsx`
Expected: FAIL, cannot find module `../BuddyDock`.

- [ ] **Step 3: Implement the dock**

```tsx
// src/features/session/BuddyDock.tsx
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';

import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import { BuddyMark, Txt, useReduceMotion } from '@/ui';
import { buddyStateOf, REACTIONS, type BuddyInput, type BuddyState } from './buddyState';
import { useSpeaker } from './speaker';

export interface BuddyDockProps extends Omit<BuddyInput, 'speaking'> {
  /** Индекс активного шага (s.step): реакция играет один раз на шаг. */
  stepIndex: number;
  /** Тестовый override системной настройки «Уменьшить движение». */
  reduceMotion?: boolean;
}

/** Состояния, о которых VoiceOver сообщает вслух: смена хода и реакции. */
const ANNOUNCED: ReadonlySet<BuddyState> = new Set<BuddyState>(['listening', 'right', 'partial', 'wrong']);

/**
 * Док бадди над главной кнопкой сессии: знак бренда + слово статуса.
 * Фон меняется на реакциях; реакция проигрывается один раз на шаг и при возврате к шагу
 * показывается уже в конечной позе.
 */
export function BuddyDock({ stepIndex, reduceMotion: reduceOverride, ...input }: BuddyDockProps) {
  const t = useT();
  const { c, radius, border } = useTheme();
  const speaker = useSpeaker();
  const systemReduce = useReduceMotion();
  const reduceMotion = reduceOverride ?? systemReduce;
  const state = buddyStateOf({ ...input, speaking: speaker?.speaking != null });
  const word = t.buddy[state];

  // Ключ уже сыгранной реакции: «шаг:состояние». Повторный показ идёт без анимации.
  const played = useRef<string | null>(null);
  const key = `${stepIndex}:${state}`;
  const isReaction = REACTIONS.has(state);
  const animateReaction = isReaction && played.current !== key;
  useEffect(() => {
    if (isReaction) played.current = key;
  }, [isReaction, key]);

  // iOS не читает live-region у обычного View — объявляем переходы сами.
  useEffect(() => {
    if (Platform.OS === 'ios' && ANNOUNCED.has(state)) AccessibilityInfo.announceForAccessibility(word);
  }, [state, word]);

  const bg = state === 'right' ? c.mint : state === 'partial' ? c.amberBg : state === 'wrong' ? c.errBg : c.card;
  return (
    <View
      testID="buddy-dock"
      accessible
      accessibilityRole="text"
      accessibilityLabel={word}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginTop: 10,
        borderRadius: radius.card,
        borderWidth: border.card,
        borderColor: c.line,
        backgroundColor: bg,
      }}
    >
      <View style={{ width: 64, alignItems: 'center' }}>
        <BuddyMark state={state} reduceMotion={reduceMotion} animateReaction={animateReaction} />
      </View>
      <Txt t="body" color="ink" style={{ flex: 1 }} numberOfLines={1}>
        {word}
      </Txt>
    </View>
  );
}
```

Note on `played`: `animateReaction` is computed during render from the ref, and the ref is written after the render committed, so the first render of a new reaction animates and any later render of the same `stepIndex:state` (including after a swipe back and forward) does not.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/session/__tests__/BuddyDock.test.tsx`
Expected: PASS, 3 tests. If `findByProps({ testID })` finds two nodes (host and composite), switch to `findAllByProps({ testID: 'buddy-dock' })[0]`.

- [ ] **Step 5: Typecheck, full tests, commit**

Run: `npm run typecheck && npm test` → green.

```bash
git add src/features/session/BuddyDock.tsx src/features/session/__tests__/BuddyDock.test.tsx
git commit -m "Buddy: dock with status word, tone and VoiceOver announcements"
```

---

### Task 6: Mount the dock in the session screen

**Files:**
- Modify: `app/session/[id].tsx` (the `ok`/`feedback` block around lines 128–192 and the `<Button>` around line 301)

**Interfaces:**
- Consumes: `BuddyDock` (Task 5), `FeedbackTone` (Task 1), existing `hitsOf`, `evaluateStep`, `viewedStep`, `isViewingPast`, `answerAt`.

- [ ] **Step 1: Compute `hits` and `tone` once**

Replace the current block that starts with `const ok = a.checked ? evaluateStep(step, a) : false;` and the `feedback` computation so that `hits` and `tone` are computed once and shared:

```tsx
  const n = lesson.steps.length;
  const ok = a.checked ? evaluateStep(step, a) : false;
  const hits = a.checked && step.type === "free" ? hitsOf(step, a) : [];
  // Тон фидбека нужен и карточке, и доку бадди.
  const tone: FeedbackTone | null =
    a.checked && step.type !== "explain"
      ? ok
        ? "mint"
        : step.type === "free" && hits.some(Boolean)
          ? "amber"
          : "err"
      : null;
```

and in the `feedback` block delete the local `const hits = …` and `const tone = …` lines, keeping `title` and the `<FeedbackCard … tone={tone!} …>` usage (`tone` is non-null inside `if (a.checked && step.type !== "explain")`; write `tone ?? "err"` instead of `tone!` to keep lint quiet).

Add the imports:

```tsx
import { BuddyDock } from "@/features/session/BuddyDock";
import type { FeedbackTone } from "@/features/session/buddyState";
```

- [ ] **Step 2: Mount the dock above the primary button**

Replace

```tsx
            <Button
              label={label}
              onPress={() => void onPrimary()}
              disabled={!canProceed(s) || grading}
              loading={grading}
              style={{ marginTop: 10 }}
            />
```

with

```tsx
            <BuddyDock
              stepType={step.type}
              checked={a.checked}
              viewingPast={past}
              rec={voice.rec}
              grading={grading}
              tone={tone}
              stepIndex={s.step}
            />
            <Button
              label={label}
              onPress={() => void onPrimary()}
              disabled={!canProceed(s) || grading}
              loading={grading}
              style={{ marginTop: 10 }}
            />
```

`BuddyDock` sits inside `<SpeakerProvider>` (the provider wraps the whole `<Screen>`), so `useSpeaker()` returns the live speaking key.

- [ ] **Step 3: Typecheck and tests**

Run: `npm run typecheck && npm test` → green. If `step.type` is not assignable to `BuddyInput['stepType']`, extend the union in `buddyState.ts` with the missing literal from `src/domain/types.ts`.

- [ ] **Step 4: Verify on the simulator**

Follow `~/.claude/projects/-Users-olegkirasov-Projects-teach/memory/ios-build-quirks.md` (xcodebuild + simctl, not `expo run:ios`) or use the web preview. Run Metro with `EXPO_PUBLIC_AUTH_LOCAL=1 EXPO_PUBLIC_VOICE_SIM=1`. Open the English demo lesson and check:

- explain step → «Читайте», dots static;
- choice step → «Ваш ход» breathing; answer wrong → dock `errBg`, row sags once; answer right → amber dot fills once;
- free step → tap mic → «Слушаю» equalizer; stop → «Ваш ход»; «Ответить» → «Думаю» while grading → reaction;
- tap a speak button after checking → «Читаю пример» wave; when it ends, reaction returns without replaying;
- swipe right to a past step → «Читайте»; swipe left back → reaction shown in final pose, no replay;
- toggle theme in Profile: dark colors read; enable Reduce Motion in Simulator Settings → Accessibility → Motion: no movement, words and backgrounds still change.

Take one screenshot per theme in the `right` state for the commit message / PR.

- [ ] **Step 5: Commit**

```bash
git add app/session/\[id\].tsx
git commit -m "Session: buddy dock above the primary button"
```

---

### Task 7: Haptics on reactions

**Files:**
- Modify: `package.json`, `package-lock.json` (via `npx expo install expo-haptics`), `ios/Podfile.lock`
- Modify: `src/features/session/BuddyDock.tsx`

**Interfaces:**
- Consumes: `REACTIONS`, `state`, `animateReaction` inside `BuddyDock`.

- [ ] **Step 1: Install the dependency**

Run from `mobile/`:

```bash
npx expo install expo-haptics
```

Then refresh pods (UTF-8 locale, see the iOS build quirks memory):

```bash
cd ios && LANG=en_US.UTF-8 pod install && cd ..
```

Expected: `expo-haptics` at the SDK 57 version in `package.json`; `ExpoHaptics` in `ios/Podfile.lock`.

- [ ] **Step 2: Add the haptic module with a kill switch**

Create `src/features/session/buddyHaptics.ts`:

```ts
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { BuddyState } from './buddyState';

/** Один флаг, чтобы выключить хаптику бадди целиком, не трогая остальное. */
export const BUDDY_HAPTICS = true;

/** Лёгкий отклик на реакцию; на web и при выключенном флаге — тишина. */
export function buddyHaptic(state: BuddyState): void {
  if (!BUDDY_HAPTICS || Platform.OS === 'web') return;
  const run =
    state === 'right'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : state === 'partial'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        : state === 'wrong'
          ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          : null;
  run?.catch(() => {});
}
```

- [ ] **Step 3: Call it from the dock**

In `src/features/session/BuddyDock.tsx` add the import `import { buddyHaptic } from './buddyHaptics';` and extend the `played` effect so the haptic fires only when the reaction is played for the first time (never when viewing a past step):

```tsx
  useEffect(() => {
    if (!isReaction) return;
    if (played.current !== key) buddyHaptic(state);
    played.current = key;
  }, [isReaction, key, state]);
```

- [ ] **Step 4: Mock haptics in tests**

Add to the top of `src/features/session/__tests__/BuddyDock.test.tsx`:

```tsx
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  ImpactFeedbackStyle: { Light: 'light' },
}));
```

and a test:

```tsx
  it('fires one haptic per reaction', () => {
    const Haptics = jest.requireMock('expo-haptics');
    Haptics.notificationAsync.mockClear();
    const tree = render({ checked: true, tone: 'mint' });
    act(() => {
      tree.update(<BuddyDock {...base} checked tone="mint" />);
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });
```

Run: `npx jest src/features/session/__tests__/BuddyDock.test.tsx` → PASS, 4 tests.

- [ ] **Step 5: Typecheck, tests, device check, commit**

Run: `npm run typecheck && npm test` → green. On the simulator haptics are silent; if a physical device is at hand, answer one step right and one wrong and feel two different taps.

```bash
git add package.json package-lock.json ios/Podfile.lock src/features/session/buddyHaptics.ts src/features/session/BuddyDock.tsx src/features/session/__tests__/BuddyDock.test.tsx
git commit -m "Buddy: haptic tap on reactions (expo-haptics)"
```

---

### Task 8: Documentation and graph

**Files:**
- Modify: `README.md` (section «Контент и прогрессия» or a new short section after «Повторы по предметам»)

- [ ] **Step 1: Document the dock**

Append to `README.md`:

```markdown
## Бадди в сессии

Над главной кнопкой сессии живёт док бадди: знак бренда из четырёх точек плюс слово статуса. Состояние считает чистая функция `buddyStateOf` (`src/features/session/buddyState.ts`) из флагов, которые уже есть: запись (`rec`), озвучка (`useSpeaker().speaking`), оценка на сервере (`grading`), тон фидбека. Приоритеты: слушает > читает пример > думает > реакция > читайте > ваш ход. Пластика в `src/ui/BuddyMark.tsx` на RN `Animated`; реакция играет один раз на шаг, при системном «Уменьшить движение» остаются только конечные позы. Хаптика на реакциях выключается флагом `BUDDY_HAPTICS` в `src/features/session/buddyHaptics.ts`. Спека: `docs/superpowers/specs/2026-09-12-buddy-dock-design.md`.
```

- [ ] **Step 2: Refresh the knowledge graph**

Run from the repo root: `graphify update .` (AST-only; per project CLAUDE.md).

- [ ] **Step 3: Commit**

```bash
git add README.md ../graphify-out
git commit -m "Docs: buddy dock in the session"
```

If `graphify update` changes nothing or `graphify-out` is not tracked, commit only `README.md`.

---

## Self-review

- **Spec coverage:** placement and look (Task 5, 6); eight states with words (Tasks 1, 2); priorities (Task 1 tests); one-shot reactions and no replay after swipe (Task 5 `played`, Task 6 manual check); listening without a real mic level (Task 4 comment); reduce-motion (Tasks 3, 4, 5); accessibility label + announcements (Task 5); haptics with a kill switch (Task 7); tests listed in the spec (Tasks 1, 4, 5, 6 step 4). Not in scope, as the spec says: buddy outside the session, settings toggle, sounds.
- **Placeholders:** none; every step has its code or exact command.
- **Type consistency:** `BuddyState`, `FeedbackTone`, `BuddyInput`, `REACTIONS`, `buddyStateOf` are defined in Task 1 and used with the same names in Tasks 5–7; `BuddyMark` props `{ state, reduceMotion, animateReaction, size? }` match between Task 4 and Task 5; `BuddyDockProps` in Task 5 match the mount in Task 6; `t.buddy[state]` keys equal the `BuddyState` union.
