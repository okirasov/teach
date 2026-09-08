import React, { useState } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Button } from './Button';
import { Txt } from './Txt';

interface TwoStepConfirmProps {
  /** Подпись контурной кнопки: «Удалить предмет», «Выйти». */
  label: string;
  /** Пояснение на errBg-карточке. */
  message: string;
  yes: string;
  no: string;
  onConfirm: () => void;
}

/** Двухшаговое подтверждение (DESIGN.md §3): кнопка → карточка --errBg + пара «Да, …» / «Оставить». */
export function TwoStepConfirm({ label, message, yes, no, onConfirm }: TwoStepConfirmProps) {
  const { c, radius } = useTheme();
  const [asking, setAsking] = useState(false);
  if (!asking) return <Button variant="destructiveOutline" label={label} onPress={() => setAsking(true)} style={{ marginBottom: 6 }} />;
  return (
    <View>
      <View style={{ backgroundColor: c.errBg, borderRadius: radius.card, paddingVertical: 14, paddingHorizontal: 16 }}>
        <Txt t="row" color="errInk" style={{ fontSize: 13.5, lineHeight: 20, fontFamily: 'GolosText_500Medium' }}>{message}</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 6 }}>
        <Button variant="confirmYes" label={yes} onPress={onConfirm} style={{ flex: 1 }} />
        <Button variant="confirmNo" label={no} onPress={() => setAsking(false)} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
