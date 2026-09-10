import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { useT } from '@/i18n';
import { userSubjectIds, useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';
import { Button, Mark, Screen, Txt } from '@/ui';

/**
 * Интро после первого входа: четыре экрана про метод, листаются свайпом.
 * Показывается один раз (settings.introSeen); дальше — мастер первого предмета, если предметов нет.
 */
export default function IntroScreen() {
  const t = useT();
  const router = useRouter();
  const { c, space } = useTheme();
  const { width } = useWindowDimensions();
  const setIntroSeen = useSettings((s) => s.setIntroSeen);
  const hasSubject = useProgress((s) => userSubjectIds(s).length > 0);
  const [page, setPage] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const slides = t.introSlides;
  const last = page === slides.length - 1;
  const pageWidth = width - space.screenX * 2;

  const finish = () => {
    setIntroSeen(true);
    router.replace('/(tabs)/today');
    if (!hasSubject) router.push('/setup');
  };
  const next = () => {
    if (last) {
      finish();
      return;
    }
    // Страницу двигаем сразу: onMomentumScrollEnd после программной прокрутки приходит не везде.
    setPage(page + 1);
    scroll.current?.scrollTo({ x: (page + 1) * pageWidth, animated: true });
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth));

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <Mark />
        {!last ? (
          <Pressable accessibilityRole="button" onPress={finish} hitSlop={8}>
            <Txt t="metaMed" color="mut">{t.introSkip}</Txt>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1, marginTop: 24 }}
      >
        {slides.map((sl) => (
          <View key={sl.n} style={{ width: pageWidth, paddingRight: 8 }}>
            <Txt t="monoMeta" color="amber" style={{ fontSize: 13, letterSpacing: 1.3 }}>{sl.n}</Txt>
            <Txt t="h1" style={{ marginTop: 14, fontSize: 30, lineHeight: 36 }}>{sl.title}</Txt>
            <Txt t="row" color="ink2" style={{ marginTop: 14, fontSize: 16, lineHeight: 25 }}>{sl.text}</Txt>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
        {slides.map((sl, i) => (
          <View key={sl.n} style={{ width: i === page ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? c.mintInk : c.line2 }} />
        ))}
      </View>
      <Button label={last ? (hasSubject ? t.introGo : t.introStart) : t.introNext} onPress={next} />
    </Screen>
  );
}
