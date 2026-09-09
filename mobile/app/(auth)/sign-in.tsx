import { useState } from 'react';
import { View } from 'react-native';

import { AuthCancelled, isGoogleConfigured, signInWithApple } from '@/features/auth/providers';
import type { Provider, Session } from '@/features/auth/types';
import { useGoogleSignIn } from '@/features/auth/useGoogleSignIn';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { useTheme } from '@/theme';
import { AppleLogo, Button, GoogleLogo, Mark, Screen, Txt } from '@/ui';

/** DESIGN.md §4.1 — логотип + слоган по центру, кнопки провайдеров внизу. */
export default function SignInScreen() {
  const t = useT();
  const { c } = useTheme();
  const signIn = useAuth((s) => s.signIn);
  const googleSignIn = useGoogleSignIn();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState(false);

  const run = async (provider: Provider, flow: () => Promise<Session>) => {
    setBusy(provider);
    setError(false);
    try {
      await signIn(await flow());
    } catch (e) {
      if (!(e instanceof AuthCancelled)) setError(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Mark size={64} />
        <Txt t="logoLg">teach</Txt>
        <Txt t="meta" color="mut" style={{ textAlign: 'center', maxWidth: 250, fontSize: 14, lineHeight: 21 }}>
          {t.authSub}
        </Txt>
      </View>
      <View style={{ gap: 10 }}>
        <Button
          variant="dark"
          label={t.authApple}
          icon={<AppleLogo color={c.btnInk} />}
          loading={busy === 'apple'}
          disabled={busy !== null}
          onPress={() => run('apple', signInWithApple)}
        />
        {isGoogleConfigured() || __DEV__ ? (
          <Button
            variant="outline"
            label={t.authGoogle}
            icon={<GoogleLogo />}
            loading={busy === 'google'}
            disabled={busy !== null}
            onPress={() => run('google', googleSignIn)}
          />
        ) : null}
        <Txt t="note" color={error ? 'err' : 'mut'} style={{ textAlign: 'center', marginTop: 6 }}>
          {error ? t.authError : t.authNote}
        </Txt>
      </View>
    </Screen>
  );
}
