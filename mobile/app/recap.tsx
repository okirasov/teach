import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { recapRecords } from '@/features/session/engine';
import { useT } from '@/i18n';
import { useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { Button, Screen, Txt } from '@/ui';

/** Заглушка разбора: фиксирует результаты и возвращает на «Сегодня». Полный экран — следующий шаг. */
export default function RecapScreen() {
  const t = useT();
  const router = useRouter();
  const s = useSession((st) => st.s);
  const end = useSession((st) => st.end);
  const markDone = useProgress((p) => p.markDone);
  const records = s ? recapRecords(s) : [];
  const okCount = records.filter((r) => r.ok).length;

  const finish = () => {
    if (s) markDone(s.subjectId, records.map((r) => ({ t: r.title, s: s.lesson.name })));
    end();
    router.dismissTo('/(tabs)/today');
  };

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 8 }}>
        <Txt t="kicker" color="mut">{t.recapChip}</Txt>
        <Txt t="h1">{okCount === records.length ? t.cleanSession : t.toFix}</Txt>
        <Txt t="meta" color="mut">{t.firstTry(okCount, records.length)}{s ? ` · ${s.lesson.name}` : ''}</Txt>
      </View>
      <Button label={t.done} onPress={finish} />
    </Screen>
  );
}
