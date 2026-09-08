import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { HeroCard } from '@/features/today/HeroCard';
import { SubjectCard } from '@/features/today/SubjectCard';
import { useTodaySubjects } from '@/features/today/useTodaySubjects';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { queueCount, useProgress } from '@/store/progress';
import { useTheme } from '@/theme';
import { AppHeader, Screen, Txt } from '@/ui';

/** DESIGN.md §4.2 «Сегодня». */
export default function TodayScreen() {
  const t = useT();
  const { c } = useTheme();
  const router = useRouter();
  const name = useAuth((s) => s.account?.name ?? '');
  const queue = useProgress(queueCount);
  const added = useProgress((s) => s.added);
  const subjects = useTodaySubjects();

  return (
    <Screen noBottom>
      <AppHeader userName={name} onAvatar={() => router.push('/profile')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <HeroCard count={queue} onPress={() => router.navigate('/(tabs)/reviews')} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingHorizontal: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.mintInk }} />
          <Txt t="meta" color="mut" numberOfLines={1} style={{ flexShrink: 1 }}>{t.weekLine(14 + added, 3)}</Txt>
        </View>
        <Txt t="kicker" color="mut" style={{ marginTop: 24 }}>{t.subjects}</Txt>
        <View style={{ gap: 10, marginTop: 12 }}>
          {subjects.map((m) => (
            <SubjectCard key={m.id} m={m} onPress={() => router.push({ pathname: '/session/[id]', params: { id: m.id } })} />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
