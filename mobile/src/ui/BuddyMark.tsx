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
