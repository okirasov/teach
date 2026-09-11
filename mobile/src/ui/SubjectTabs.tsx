import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Txt } from './Txt';

export interface SubjectTab {
  id: string;
  name: string;
}

/** Вкладки предметов: пиллы с горизонтальной прокруткой. Одинаковые в справочниках и повторах. */
export function SubjectTabs({ items, value, onChange, style }: { items: SubjectTab[]; value: string; onChange: (id: string) => void; style?: StyleProp<ViewStyle> }) {
  const { c, radius, size, space } = useTheme();
  return (
    <View style={[{ marginTop: 14, marginHorizontal: -space.screenX }, style]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.screenX, gap: 8 }}>
        {items.map((s) => {
          const active = s.id === value;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(s.id)}
              style={{ height: size.pill, paddingHorizontal: 13, borderRadius: radius.pill, backgroundColor: active ? c.mintInk : c.mint, justifyContent: 'center' }}
            >
              <Txt t="pill" style={{ color: active ? c.btnInk : c.mintInk }} numberOfLines={1}>{s.name}</Txt>
            </Pressable>
          );
        })}
      </ScrollView>
      <LinearGradient colors={['transparent', c.bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 1, width: 36 }} />
    </View>
  );
}
