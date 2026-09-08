import { View } from 'react-native';

import { formatHeaderDate } from '@/i18n';
import { useAuth } from '@/store/auth';
import { useSettings } from '@/store/settings';
import { Button, Logo, Screen, Txt } from '@/ui';

/** Заглушка до реализации экрана «Сегодня»: проверяет цикл вход → выход. */
export default function TodayPlaceholder() {
  const account = useAuth((s) => s.account);
  const signOut = useAuth((s) => s.signOut);
  const lang = useSettings((s) => s.lang);
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo />
        <Txt t="monoMeta" color="mut">{formatHeaderDate(new Date(), lang)}</Txt>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: 8 }}>
        <Txt t="h1">{account?.name}</Txt>
        <Txt t="meta" color="mut">{account?.provider} · {account?.id}</Txt>
      </View>
      <Button variant="destructiveOutline" label="Выйти (временно)" onPress={signOut} />
    </Screen>
  );
}
