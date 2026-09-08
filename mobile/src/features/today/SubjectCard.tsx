import React from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useTheme } from '@/theme';
import { Card, Chip, Txt } from '@/ui';

export interface SubjectCardModel {
  id: string;
  name: string;
  level: string;
  lessonTitle: string;
  done: boolean;
  /** Готовится в фоне: индекс текущего этапа (0..PREP_STAGES-1); undefined — готов. */
  prepStage?: number;
}

/** Карточка предмета на «Сегодня» (DESIGN.md §4.2): имя + уровень, урок, чип-статус, CTA. */
export function SubjectCard({ m, onPress }: { m: SubjectCardModel; onPress: () => void }) {
  const t = useT();
  const { c, fonts } = useTheme();
  const preparing = m.prepStage !== undefined;
  const status = m.done ? t.doneToday : preparing ? t.prepSteps[Math.min(m.prepStage ?? 0, t.prepSteps.length - 1)] : t.ready;
  const cta = preparing ? t.inBg : m.done ? t.more : t.start;
  const chipTone = !preparing && !m.done ? 'dark' : 'mint';

  return (
    <Card large onPress={preparing ? undefined : onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Txt t="cardTitle" style={{ flexShrink: 1 }}>{m.name}</Txt>
        <Txt t="monoMeta" color="mut" numberOfLines={1}>{m.level}</Txt>
      </View>
      <Txt t="meta" color="mut" style={{ marginTop: 6, lineHeight: 19 }}>{m.lessonTitle}</Txt>
      {preparing ? (
        <View style={{ gap: 6, marginTop: 10 }}>
          {t.prepSteps.map((name, i) => {
            const isDone = i < (m.prepStage ?? 0);
            const cur = i === m.prepStage;
            return (
              <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isDone ? c.mintInk : cur ? c.amber : c.dis }} />
                <Txt t="tiny" color={isDone ? 'mut' : cur ? 'ink' : 'mut2'} style={cur ? { fontFamily: fonts.sans500 } : undefined}>
                  {name}
                </Txt>
              </View>
            );
          })}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <Chip label={status} tone={chipTone} />
        <Txt t="metaMed" color="mintInk">{cta} →</Txt>
      </View>
    </Card>
  );
}
