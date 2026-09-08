import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { useTheme } from '@/theme';
import { AppHeader, Screen, TabTitle, Txt } from '@/ui';

/** Вкладка «Предметы»: карточки миссий — следующий шаг; кнопка «+ Новый предмет» закреплена внизу. */
export default function SubjectsScreen() {
  const t = useT();
  const router = useRouter();
  const { c, radius, space } = useTheme();
  const name = useAuth((s) => s.account?.name ?? '');
  return (
    <Screen noBottom>
      <AppHeader userName={name} onAvatar={() => router.push('/profile')} />
      <TabTitle title={t.mission} note={t.missionNote} />
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/setup')}
        style={{
          borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.line2, borderRadius: radius.cardLg, padding: 15,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 + space.sm,
        }}
      >
        <Txt t="body" color="mintInk" style={{ fontSize: 18, lineHeight: 20 }}>+</Txt>
        <Txt t="rowMed" color="mintInk" style={{ fontSize: 14, lineHeight: 16 }}>{t.newSubj}</Txt>
      </Pressable>
    </Screen>
  );
}
