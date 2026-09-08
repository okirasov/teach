import { useRouter } from 'expo-router';

import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { AppHeader, Screen, TabTitle } from '@/ui';

/** Заглушка до реализации «Предметов». */
export default function SubjectsScreen() {
  const t = useT();
  const router = useRouter();
  const name = useAuth((s) => s.account?.name ?? '');
  return (
    <Screen noBottom>
      <AppHeader userName={name} onAvatar={() => router.push('/profile')} />
      <TabTitle title={t.mission} note={t.missionNote} />
    </Screen>
  );
}
