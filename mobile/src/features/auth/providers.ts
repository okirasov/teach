import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

import { localDevSession } from './local';
import { rememberedName } from './session';
import type { Session } from './types';

export { localDevSession };

export class AuthCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'AuthCancelled';
  }
}

export async function isAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<Session> {
  if (!(await isAppleAvailable())) {
    if (__DEV__) return localDevSession('apple');
    throw new Error('apple-unavailable');
  }
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') throw new AuthCancelled();
    throw e;
  }
  const given = credential.fullName?.givenName?.trim();
  const name = given || (await rememberedName(credential.user)) || 'Apple';
  return {
    account: { id: credential.user, name, provider: 'apple' },
    token: credential.identityToken ?? credential.authorizationCode ?? '',
  };
}

export const googleClientIds = {
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

export function isGoogleConfigured(): boolean {
  return Boolean(googleClientIds.iosClientId || googleClientIds.androidClientId || googleClientIds.webClientId);
}

/** Профиль Google по access token → сессия. */
export async function googleSessionFromToken(accessToken: string): Promise<Session> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('google-userinfo-failed');
  const info = (await res.json()) as { sub: string; given_name?: string; name?: string };
  return {
    account: { id: info.sub, name: info.given_name || info.name || 'Google', provider: 'google' },
    token: accessToken,
  };
}
