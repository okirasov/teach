import { splitSource } from "@/domain/source";
import React from "react";
import { Pressable, TextInput, View } from "react-native";

import type {
  ChoiceStep,
  ExplainStep,
  FreeStep,
  InputStep,
  OrderStep,
} from "@/domain/types";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";
import { SpeakButton, Txt } from "@/ui";
import { useSpeaker } from "./speaker";

/** Шаг «объяснение» (DESIGN.md §4.3): кикер ЗАЧЕМ, заголовок, абзацы, ПРИМЕР, источник. */
export function ExplainView({
  step,
  showSources = true,
}: {
  step: ExplainStep;
  showSources?: boolean;
}) {
  const speaker = useSpeaker();
  const t = useT();
  const { c, radius } = useTheme();
  const src = splitSource(step.source);
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          gap: 8,
          marginTop: 20,
        }}
      >
        <Txt t="kicker" color="amber" style={{ letterSpacing: 0.84 }}>
          {t.why}
        </Txt>
        <Txt t="small" color="mut" numberOfLines={1} style={{ flexShrink: 1 }}>
          {step.why}
        </Txt>
      </View>
      <Txt t="h2" style={{ marginTop: 12, lineHeight: 29 }}>
        {step.title}
      </Txt>
      {step.paras.map((p, i) => (
        <Txt
          key={i}
          t="body"
          color="ink2"
          style={{ marginTop: 12, lineHeight: 24 }}
        >
          {p}
        </Txt>
      ))}
      <View
        style={{
          backgroundColor: c.mint,
          borderRadius: radius.card,
          paddingVertical: 14,
          paddingHorizontal: 16,
          marginTop: 16,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <Txt t="kickerSm" color="mintInk">
            {t.example}
          </Txt>
          {speaker ? (
            <SpeakButton
              speaking={speaker.speaking === "example"}
              onPress={() => speaker.toggle("example", step.example)}
            />
          ) : null}
        </View>
        <Txt t="row" style={{ marginTop: 7, fontSize: 14, lineHeight: 22 }}>
          {step.example}
        </Txt>
      </View>
      {showSources ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 14,
          }}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              backgroundColor: c.sand,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Txt t="chipSm" color="sandInk">
              1
            </Txt>
          </View>
          <Txt t="tiny" color="mut" style={{ flexShrink: 1 }}>
            {src.text}
            {src.warn ? (
              <Txt
                t="tiny"
                color={src.warn === "low" ? "errInk" : "amber"}
              >{` · ${t.trustWarn(src.warn === "low" ? t.trustLow : t.trustMid)}`}</Txt>
            ) : null}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

function Prompt({ children }: { children: string }) {
  return (
    <Txt
      t="question"
      style={{ marginTop: 20, fontFamily: "GolosText_600SemiBold" }}
    >
      {children}
    </Txt>
  );
}

interface ChoiceViewProps {
  step: ChoiceStep;
  sel: number | null;
  checked: boolean;
  onSelect: (i: number) => void;
}

/** Варианты-карточки: выбранный --sel; после ответа верный mint+ВЕРНО, ваш неверный errBg+ВАШ ВЫБОР. */
export function ChoiceView({ step, sel, checked, onSelect }: ChoiceViewProps) {
  const speaker = useSpeaker();
  const t = useT();
  const { c, radius, border } = useTheme();
  return (
    <View>
      <Prompt>{step.prompt}</Prompt>
      <View style={{ gap: 9, marginTop: 16 }}>
        {step.options.map((label, i) => {
          let bg = c.card;
          let bd = c.line2;
          let fg = c.ink;
          let badge = "";
          if (!checked && sel === i) {
            bd = c.mintInk;
            bg = c.sel;
          }
          if (checked && step.correct === -1 && i === sel) {
            bd = c.mintInk;
            bg = c.mint;
            badge = t.badgeAccepted;
          } else if (checked && i === step.correct) {
            bd = c.mintInk;
            bg = c.mint;
            badge = t.badgeRight;
          } else if (checked && i === sel) {
            bd = c.err;
            bg = c.errBg;
            fg = c.errInk;
            badge = t.badgeYours;
          }
          return (
            <View
              key={i}
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: sel === i }}
                disabled={checked}
                onPress={() => onSelect(i)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  paddingVertical: 15,
                  paddingHorizontal: 16,
                  borderRadius: radius.input,
                  borderWidth: border.input,
                  borderColor: bd,
                  backgroundColor: bg,
                }}
              >
                <Txt
                  t="body"
                  style={{ color: fg, lineHeight: 21, flexShrink: 1, flex: 1 }}
                >
                  {label}
                </Txt>
                {badge ? (
                  <Txt t="chipSm" style={{ color: fg, letterSpacing: 0.6 }}>
                    {badge}
                  </Txt>
                ) : null}
              </Pressable>
              {speaker ? (
                <SpeakButton
                  speaking={speaker.speaking === `opt-${i}`}
                  onPress={() => speaker.toggle(`opt-${i}`, label)}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

interface OrderViewProps {
  step: OrderStep;
  ordSel: number[];
  checked: boolean;
  onToggle: (i: number) => void;
}

/** Хронология: нажатия нумеруют элементы; после ответа неверные позиции показывают «было→надо». */
export function OrderView({ step, ordSel, checked, onToggle }: OrderViewProps) {
  const speaker = useSpeaker();
  const t = useT();
  const { c, radius, border } = useTheme();
  return (
    <View>
      <Prompt>{step.prompt}</Prompt>
      <Txt t="small" color="mut" style={{ marginTop: 6 }}>
        {t.orderHint}
      </Txt>
      <View style={{ gap: 9, marginTop: 14 }}>
        {step.items.map((label, i) => {
          const pos = ordSel.indexOf(i);
          const picked = pos !== -1;
          const rightPos = checked ? step.correct.indexOf(i) : -1;
          let bd = c.line2;
          let bg = c.card;
          let badge = picked ? String(pos + 1) : "";
          if (picked && !checked) {
            bd = c.mintInk;
            bg = c.sel;
          }
          if (checked) {
            if (pos === rightPos) {
              bd = c.mintInk;
              bg = c.mint;
            } else {
              bd = c.err;
              bg = c.errBg;
              badge = `${pos + 1}→${rightPos + 1}`;
            }
          }
          return (
            <View
              key={i}
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Pressable
                accessibilityRole="button"
                disabled={checked}
                onPress={() => onToggle(i)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 13,
                  paddingHorizontal: 14,
                  borderRadius: radius.input,
                  borderWidth: border.input,
                  borderColor: bd,
                  backgroundColor: bg,
                }}
              >
                <View
                  style={{
                    minWidth: 26,
                    height: 26,
                    paddingHorizontal: 6,
                    borderRadius: 13,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: picked ? c.chipDk : c.sand,
                  }}
                >
                  <Txt
                    t="monoBadge"
                    style={{ color: picked ? c.btnInk : c.sandInk }}
                  >
                    {badge}
                  </Txt>
                </View>
                <Txt t="row" style={{ flex: 1 }}>
                  {label}
                </Txt>
              </Pressable>
              {speaker ? (
                <SpeakButton
                  speaking={speaker.speaking === `item-${i}`}
                  onPress={() => speaker.toggle(`item-${i}`, label)}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

interface InputViewProps {
  step: InputStep | FreeStep;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
}

/** Свободный ввод: инпут (одна строка) или textarea (free), рамка 1.5 --mintInk, r14. */
export function InputView({ step, value, checked, onChange }: InputViewProps) {
  const { c, radius, border, fonts } = useTheme();
  const multi = step.type === "free";
  return (
    <View>
      <Prompt>{step.prompt}</Prompt>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={!checked}
        placeholder={step.placeholder}
        placeholderTextColor={c.mut2}
        multiline={multi}
        numberOfLines={multi ? 5 : 1}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          backgroundColor: c.card,
          borderWidth: border.input,
          borderColor: c.mintInk,
          borderRadius: radius.card,
          paddingVertical: multi ? 14 : 15,
          paddingHorizontal: 16,
          marginTop: 16,
          fontFamily: fonts.sans400,
          fontSize: 15,
          lineHeight: multi ? 23 : 22,
          color: c.ink,
          minHeight: multi ? 140 : undefined,
          textAlignVertical: multi ? "top" : "center",
        }}
      />
    </View>
  );
}

interface FeedbackProps {
  title: string;
  text: string;
  tone: "mint" | "amber" | "err";
  answer?: string;
  criteria?: { t: string; hit: boolean }[];
}

/** Фидбек-карточка после попытки: «Верно/Не совсем» + объяснение, КАК ПРАВИЛЬНО, критерии. */
export function FeedbackCard({
  title,
  text,
  tone,
  answer,
  criteria,
}: FeedbackProps) {
  const speaker = useSpeaker();
  const t = useT();
  const { c, radius } = useTheme();
  const bg = tone === "mint" ? c.mint : tone === "amber" ? c.amberBg : c.errBg;
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: radius.card,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginTop: 14,
      }}
    >
      <Txt
        t="body"
        style={{ fontFamily: "GolosText_600SemiBold", lineHeight: 20 }}
      >
        {title}
      </Txt>
      <Txt
        t="row"
        color="ink2"
        style={{ marginTop: 6, fontSize: 14, lineHeight: 22 }}
      >
        {text}
      </Txt>
      {answer ? (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginTop: 12,
            }}
          >
            <Txt t="kickerSm" color="mintInk">
              {t.howRight}
            </Txt>
            {speaker ? (
              <SpeakButton
                speaking={speaker.speaking === "answer"}
                onPress={() => speaker.toggle("answer", answer)}
              />
            ) : null}
          </View>
          <Txt t="row" style={{ marginTop: 6, fontSize: 14, lineHeight: 21 }}>
            {answer}
          </Txt>
        </>
      ) : null}
      {criteria ? (
        <>
          <Txt t="kickerSm" color="mintInk" style={{ marginTop: 14 }}>
            {t.criteria}
          </Txt>
          <View style={{ marginTop: 4 }}>
            {criteria.map((cr, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 9,
                  paddingVertical: 9,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: c.lineSoft,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: cr.hit ? c.mintInk : "transparent",
                    borderWidth: cr.hit ? 0 : 1.5,
                    borderColor: c.err,
                  }}
                >
                  <Txt
                    t="statLabel"
                    style={{
                      color: cr.hit ? c.btnInk : c.err,
                      fontFamily: "GolosText_600SemiBold",
                      lineHeight: 13,
                    }}
                  >
                    {cr.hit ? "✓" : "–"}
                  </Txt>
                </View>
                <Txt
                  t="row"
                  style={{ flex: 1, fontSize: 13.5, lineHeight: 20 }}
                >
                  {cr.t}
                </Txt>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
