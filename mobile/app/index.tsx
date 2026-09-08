import { Redirect } from 'expo-router';

import { useAuth } from '@/store/auth';

export default function Index() {
  const signedIn = useAuth((s) => s.status === 'signedIn');
  return <Redirect href={signedIn ? '/(tabs)/today' : '/(auth)/sign-in'} />;
}
