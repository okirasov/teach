import React from 'react';
import { Pressable, View } from 'react-native';

import { formatHeaderDate } from '@/i18n';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';
import { Avatar } from './Avatar';
import { Logo } from './Logo';
import { Txt } from './Txt';

interface AppHeaderProps {
  userName: string;
  onAvatar?: () => void;
  /** На Профиле и Настройках предмета вместо знака — ×-кружок 26px. */
  onClose?: () => void;
}

/** Шапка приложения (DESIGN.md §3): знак+«teach» | дата mono + аватар. */
export function AppHeader({ userName, onAvatar, onClose }: AppHeaderProps) {
  const { c, size } = useTheme();
  const lang = useSettings((s) => s.lang);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {onClose ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="close"
            onPress={onClose}
            hitSlop={10}
            style={{
              width: size.closeCircleSm,
              height: size.closeCircleSm,
              borderRadius: size.closeCircleSm / 2,
              backgroundColor: c.mint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt t="meta" color="mintInk" style={{ fontSize: 15, lineHeight: 17 }}>×</Txt>
          </Pressable>
          <Txt t="logo">teach</Txt>
        </View>
      ) : (
        <Logo />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Txt t="monoMeta" color="mut">{formatHeaderDate(new Date(), lang)}</Txt>
        <Avatar name={userName} onPress={onAvatar} />
      </View>
    </View>
  );
}
