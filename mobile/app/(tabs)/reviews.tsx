import { useRouter } from 'expo-router';

import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { queueCount, useProgress } from '@/store/progress';
import { AppHeader, Screen, TabTitle } from '@/ui';

/** Заглушка до реализации «Повторов». */
export default function ReviewsScreen() {
  const t = useT();
  const router = useRouter();
  const name = useAuth((s) => s.account?.name ?? '');
  const queue = useProgress(queueCount);
  return (
    <Screen noBottom>
      <AppHeader userName={name} onAvatar={() => router.push('/profile')} />
      <TabTitle title={t.reviews} note={t.reviewsSummary(queue)} />
    </Screen>
  );
}
