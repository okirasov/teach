import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { getLesson, useProgress } from '@/store/progress';
import { Button, Screen, Txt } from '@/ui';

/** Заглушка сессии: следующий шаг — полный экран урока. */
export default function SessionScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lesson = useProgress((s) => getLesson(s, id, t.reviewName));
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 8 }}>
        <Txt t="kicker" color="mut">Сессия · {id}</Txt>
        <Txt t="h1">{lesson?.name ?? '—'}</Txt>
        <Txt t="meta" color="mut">{lesson ? `${lesson.steps.length} шагов` : ''}</Txt>
      </View>
      <Button variant="mint" label={t.cancel} onPress={() => router.back()} />
    </Screen>
  );
}
