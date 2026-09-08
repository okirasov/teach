import React from 'react';
import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';

import { useTheme, type Theme } from '@/theme';
import { Txt } from './Txt';

export type ButtonVariant =
  | 'primary' // mintInk / btnInk, h54 r14 — основной CTA
  | 'dark' // chipDk / btnInk, h52 — «Продолжить с Apple»
  | 'outline' // card + 1.5 line2, ink, h52 — «Продолжить с Google»
  | 'destructiveOutline' // errLine рамка, err текст, h52
  | 'confirmYes' // err / onAccent, h48 r12
  | 'confirmNo' // mint / mintInk, h48 r12
  | 'mint'; // mint / mintInk, h52 — второстепенная

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

function variantStyle(th: Theme, v: ButtonVariant, disabled: boolean) {
  const { c, size, radius, border } = th;
  switch (v) {
    case 'primary':
      return { box: { height: size.buttonPrimary, borderRadius: radius.card, backgroundColor: disabled ? c.dis : c.mintInk }, text: c.btnInk, t: 'button' as const };
    case 'dark':
      return { box: { height: size.buttonSecondary, borderRadius: radius.card, backgroundColor: c.chipDk }, text: c.btnInk, t: 'buttonSm' as const };
    case 'outline':
      return { box: { height: size.buttonSecondary, borderRadius: radius.card, backgroundColor: c.card, borderWidth: border.input, borderColor: c.line2 }, text: c.ink, t: 'buttonSm' as const };
    case 'destructiveOutline':
      return { box: { height: size.buttonSecondary, borderRadius: radius.card, borderWidth: 1, borderColor: c.errLine }, text: c.err, t: 'buttonSm' as const };
    case 'confirmYes':
      return { box: { height: size.buttonConfirm, borderRadius: radius.input, backgroundColor: c.err }, text: c.onAccent, t: 'buttonConfirm' as const };
    case 'confirmNo':
      return { box: { height: size.buttonConfirm, borderRadius: radius.input, backgroundColor: c.mint }, text: c.mintInk, t: 'buttonConfirm' as const };
    case 'mint':
      return { box: { height: size.buttonSecondary, borderRadius: radius.card, backgroundColor: c.mint }, text: c.mintInk, t: 'buttonSm' as const };
  }
}

export function Button({ label, onPress, variant = 'primary', disabled = false, loading = false, icon, style }: ButtonProps) {
  const th = useTheme();
  const vs = variantStyle(th, variant, disabled);
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
        vs.box,
        pressed && !inactive ? { opacity: 0.85 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={vs.text} />
      ) : (
        <>
          {icon ? <View style={{ flexShrink: 0 }}>{icon}</View> : null}
          <Txt t={vs.t} style={{ color: vs.text }} numberOfLines={1}>
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}
