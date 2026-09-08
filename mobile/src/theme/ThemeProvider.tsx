import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '@/store/settings';
import { border, palette, radius, shadow, size, space, type ThemeName, type Palette } from './tokens';
import { fonts, type } from './typography';

export interface Theme {
  name: ThemeName;
  isDark: boolean;
  c: Palette;
  radius: typeof radius;
  space: typeof space;
  size: typeof size;
  border: typeof border;
  shadow: typeof shadow;
  fonts: typeof fonts;
  type: typeof type;
}

function buildTheme(name: ThemeName): Theme {
  return { name, isDark: name === 'dark', c: palette[name], radius, space, size, border, shadow, fonts, type };
}

const themes: Record<ThemeName, Theme> = { light: buildTheme('light'), dark: buildTheme('dark') };

const ThemeContext = createContext<Theme>(themes.light);

/**
 * Тема выбирается в Профиле (light/dark). Пока пользователь не выбрал,
 * следуем системной. Значение хранится в settings-store.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const chosen = useSettings((s) => s.theme);
  const name: ThemeName = chosen ?? (system === 'dark' ? 'dark' : 'light');
  const value = useMemo(() => themes[name], [name]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
