import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { AppHeader, Button, Screen, Txt } from '@/ui';

/** Заглушка Профиля: шапка с ×, временная кнопка выхода. */
export default function ProfileScreen() {
  const t = useT();
  const router = useRouter();
  const account = useAuth((s) => s.account);
  const signOut = useAuth((s) => s.signOut);
  return (
    <Screen>
      <AppHeader userName={account?.name ?? ''} onClose={() => router.back()} />
      <Txt t="h1" style={{ marginTop: 22 }}>{t.profileTitle}</Txt>
      <View style={{ flex: 1 }} />
      <Button variant="destructiveOutline" label={t.logout} onPress={signOut} />
    </Screen>
  );
}
