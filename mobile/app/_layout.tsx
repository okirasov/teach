import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DbGate } from '@/db/DbGate';
import { useAuth } from '@/store/auth';
import { fontAssets, ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { c, isDark } = useTheme();
  const signedIn = useAuth((s) => s.status === 'signedIn');
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)/sign-in" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="session/[id]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="recap" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="setup" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="subject/[id]" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const authStatus = useAuth((s) => s.status);
  const hydrate = useAuth((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const ready = (fontsLoaded || !!fontError) && authStatus !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DbGate>
          <RootStack />
        </DbGate>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
