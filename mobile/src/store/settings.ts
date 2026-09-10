import { create } from 'zustand';

import type { ThemeName } from '@/theme/tokens';

export type Lang = 'ru' | 'en';
export type ReminderSlot = 'morning' | 'evening';
export type DailyCap = 20 | 40 | 80 | 0;
export type RecordingMode = 'ptt' | 'hands';

/**
 * Глобальные настройки (`g` в прототипе) + язык и тема.
 * Персистентность подключается на шаге «хранилище» (SQLite kv);
 * на текущем шаге состояние живёт в памяти.
 */
export interface SettingsState {
  lang: Lang;
  /** null — следовать системной теме, пока пользователь не выбрал. */
  theme: ThemeName | null;
  reminder: ReminderSlot;
  weekendOff: boolean;
  cap: DailyCap;
  mode: RecordingMode;
  /** Интро показано один раз после первого входа. */
  introSeen: boolean;
  setIntroSeen: (seen: boolean) => void;
  setLang: (lang: Lang) => void;
  setTheme: (theme: ThemeName) => void;
  setReminder: (slot: ReminderSlot) => void;
  setWeekendOff: (off: boolean) => void;
  setCap: (cap: DailyCap) => void;
  setMode: (mode: RecordingMode) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  lang: 'ru',
  theme: null,
  reminder: 'evening',
  weekendOff: false,
  cap: 40,
  mode: 'ptt',
  setLang: (lang) => set({ lang }),
  setTheme: (theme) => set({ theme }),
  setReminder: (reminder) => set({ reminder }),
  setWeekendOff: (weekendOff) => set({ weekendOff }),
  setCap: (cap) => set({ cap }),
  setMode: (mode) => set({ mode }),
  introSeen: false,
  setIntroSeen: (introSeen) => set({ introSeen }),
}));
