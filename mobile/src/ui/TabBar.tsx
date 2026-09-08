import type { BottomTabBarProps } from 'expo-router/tabs';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { Txt } from './Txt';

/**
 * Таб-бар (DESIGN.md §3): 4 пункта, 11.5px, active --ink 500, inactive --mut2,
 * верхняя граница --lineSoft, без иконок.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: c.lineSoft,
        backgroundColor: c.bg,
        paddingTop: 12,
        paddingHorizontal: space.screenX - 4,
        paddingBottom: Math.max(insets.bottom, space.screenBottom),
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = typeof options.title === 'string' ? options.title : route.name;
        const active = state.index === index;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!active && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 4, minHeight: 28, justifyContent: 'center' }}
          >
            <Txt t={active ? 'tabActive' : 'tab'} color={active ? 'ink' : 'mut2'} numberOfLines={1}>
              {label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
