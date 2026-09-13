import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { content, contentUrl } from '@/content';
import type { ContentService } from '@/content';
import { isNewer } from './version';

export interface UpdateInfo {
  build: number;
  url: string;
}

interface UpdateState {
  /** Сборка новее установленной; null — обновлять нечего или ещё не проверяли. */
  latest: UpdateInfo | null;
  /** Скрыто крестиком до следующего запуска. */
  dismissed: boolean;
  setLatest: (latest: UpdateInfo | null) => void;
  dismiss: () => void;
}

export const useUpdate = create<UpdateState>((set) => ({
  latest: null,
  dismissed: false,
  setLatest: (latest) => set({ latest }),
  dismiss: () => set({ dismissed: true }),
}));

/** Номер установленной сборки из app.json (ios.buildNumber) или из нативного бандла. */
export function installedBuild(): string | undefined {
  return Constants.expoConfig?.ios?.buildNumber ?? Constants.nativeBuildVersion ?? undefined;
}

/** Спрашивает сервер и возвращает сборку, если она новее установленной; сбои сети — молча null. */
export async function checkForUpdate(svc: Pick<ContentService, 'latestApp'>, current: string | undefined): Promise<UpdateInfo | null> {
  try {
    const r = await svc.latestApp();
    if (!r || !isNewer(current, r.ios.build)) return null;
    return { build: r.ios.build, url: r.ios.url };
  } catch {
    return null;
  }
}

let checked = false;

/** Одна проверка за запуск приложения; только iOS и только при подключённом сервере. */
export function useUpdateNudge(): void {
  const setLatest = useUpdate((s) => s.setLatest);
  useEffect(() => {
    if (checked || Platform.OS !== 'ios' || !contentUrl) return;
    checked = true;
    void checkForUpdate(content, installedBuild()).then(setLatest);
  }, [setLatest]);
}
