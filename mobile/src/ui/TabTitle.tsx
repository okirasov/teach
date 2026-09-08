import React from 'react';
import { View } from 'react-native';

import { Txt } from './Txt';

/** Заголовок вкладки: h1 26/600 + короткий подтекст 13 --mut в той же строке (baseline, ellipsis). */
export function TabTitle({ title, note, marginTop = 22 }: { title: string; note?: string; marginTop?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop, minWidth: 0 }}>
      <Txt t="h1" style={{ flexShrink: 0 }}>{title}</Txt>
      {note ? (
        <Txt t="meta" color="mut" numberOfLines={1} style={{ flexShrink: 1 }}>
          {note}
        </Txt>
      ) : null}
    </View>
  );
}
