import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { REACTIONS, type BuddyState } from '@/features/session/buddyState';
import { brand, useTheme } from '@/theme';

interface BuddyMarkProps {
  state: BuddyState;
  /** Системное «Уменьшить движение»: только конечные позы. */
  reduceMotion: boolean;
  /** false — реакция сразу в конечной позе (просмотр уже сыгранной реакции). */
  animateReaction: boolean;
}

interface Dot {
  scale: Animated.Value;
  scaleY: Animated.Value;
  tx: Animated.Value;
  ty: Animated.Value;
}

const DOT = 10;
const GAP = 6;
const RING = DOT + 1;
const THINK_OFFSETS = [24, 8, -8, -24];

function makeDots(): Dot[] {
  return Array.from({ length: 4 }, () => ({ scale: new Animated.Value(1), scaleY: new Animated.Value(1), tx: new Animated.Value(0), ty: new Animated.Value(0) }));
}

/** Знак бренда как бадди: четыре точки, последняя контурная янтарная. Вся пластика — здесь. */
export function BuddyMark({ state, reduceMotion, animateReaction }: BuddyMarkProps) {
  const { c } = useTheme();
  const dots = useRef<Dot[]>(makeDots()).current;
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Сброс в нейтральную позу; залитая точка остаётся только на «верно».
    for (const d of dots) {
      d.scale.setValue(1);
      d.scaleY.setValue(1);
      d.tx.setValue(0);
      d.ty.setValue(0);
    }
    fill.setValue(state === 'right' ? 1 : 0);
    if (reduceMotion) return;
    const isReaction = REACTIONS.has(state);
    if (isReaction && !animateReaction) return;

    const anim = animationFor(state, dots, fill);
    if (!anim) return;
    anim.start();
    return () => {
      anim.stop();
    };
  }, [state, reduceMotion, animateReaction, dots, fill]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: GAP, height: DOT * 2.4 }} accessible={false}>
      {dots.map((d, i) => {
        const last = i === 3;
        const ring = last ? RING : DOT;
        return (
          <Animated.View
            key={i}
            style={{
              width: ring,
              height: ring,
              borderRadius: ring / 2,
              backgroundColor: last ? 'transparent' : c.mintInk,
              borderWidth: last ? 2.5 : 0,
              borderColor: last ? brand.markAmber : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ translateX: d.tx }, { translateY: d.ty }, { scale: d.scale }, { scaleY: d.scaleY }],
            }}
          >
            {last ? (
              <Animated.View style={{ width: ring - 5, height: ring - 5, borderRadius: (ring - 5) / 2, backgroundColor: brand.markAmber, transform: [{ scale: fill }] }} />
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
function animationFor(state: BuddyState, dots: Dot[], fill: Animated.Value): Animated.CompositeAnimation | null {
  switch (state) {
    case 'waiting':
      // Дыхание слева направо, ≈2.6 с на круг.
      return Animated.loop(
        Animated.stagger(
          200,
          dots.map((d) => Animated.sequence([T(d.scale, 1.2, 1000), T(d.scale, 1, 1000)])),
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
      // Волна бежит по ряду, ≈1 с на точку.
      return Animated.loop(
        Animated.stagger(
          120,
          dots.map((d) => Animated.sequence([T(d.ty, -DOT * 0.6, 250), T(d.ty, DOT * 0.2, 250), T(d.ty, 0, 140)])),
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
      // Контурная точка заливается и подпрыгивает; финальная поза — заливка + scale 1.
      const last = dots[3];
      fill.setValue(0);
      return Animated.parallel([
        T(fill, 1, 350, Easing.out(Easing.back(1.5))),
        Animated.sequence([T(last.scale, 1.5, 250), T(last.scale, 1, 200)]),
      ]);
    }
    case 'partial':
      // Половина ряда оседает и выпрямляется.
      return sag(dots.slice(2));
    case 'wrong':
      // Весь ряд оседает и выпрямляется.
      return sag(dots);
    case 'reading':
      return null;
  }
}

function sag(dots: Dot[]): Animated.CompositeAnimation {
  return Animated.stagger(
    50,
    dots.map((d) =>
      Animated.sequence([
        Animated.parallel([T(d.ty, DOT * 0.5, 400), T(d.scale, 0.9, 400)]),
        Animated.delay(500),
        Animated.parallel([T(d.ty, 0, 550), T(d.scale, 1, 550)]),
      ]),
    ),
  );
}
