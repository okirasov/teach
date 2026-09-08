import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { previewDays } from '@/domain/fsrs';
import { recapRecords } from '@/features/session/engine';
import { useT } from '@/i18n';
import { REVIEW_ID, useProgress } from '@/store/progress';
import { useReviews } from '@/store/reviews';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme';
import { Button, Card, Screen, SessionHeader, Txt } from '@/ui';

/** DESIGN.md §4.4 «Разбор»: вердикт, карточки «УЙДЁТ В ПОВТОРЫ» с интервалом, «Сомневаюсь», «Готово». */
export default function RecapScreen() {
  const t = useT();
  const router = useRouter();
  const { c, radius } = useTheme();
  const s = useSession((st) => st.s);
  const doubts = useSession((st) => st.doubts);
  const doubt = useSession((st) => st.doubt);
  const end = useSession((st) => st.end);
  const markDone = useProgress((p) => p.markDone);
  const cards = useReviews((st) => st.cards);
  const addRecords = useReviews((st) => st.addRecords);
  const applyResults = useReviews((st) => st.applyResults);

  if (!s) return <Screen />;

  const isReview = s.subjectId === REVIEW_ID;
  const records = recapRecords(s);
  const okCount = records.filter((r) => r.ok).length;
  const explain = s.lesson.steps.find((st) => st.type === 'explain');
  const lessonSource = (explain?.type === 'explain' ? explain.source : t.srcFromPlan).split(' · ')[0];
  const cardOf = (id?: string) => (id ? cards.find((c) => c.id === id) ?? null : null);
  const now = new Date();

  const leave = () => {
    end();
    router.dismissTo('/(tabs)/today');
  };
  const finish = async () => {
    if (isReview) {
      await applyResults(records.filter((r) => r.cardId).map((r) => ({ cardId: r.cardId!, ok: r.ok })), now);
    } else {
      await addRecords(
        records.map((r) => ({
          subjectId: s.subjectId, subjectName: s.lesson.name, title: r.title, note: r.note, source: lessonSource,
          ref: { subjectId: s.subjectId, step: r.stepIndex }, ok: r.ok,
        })),
        now,
      );
      markDone(s.subjectId, records.map((r) => ({ t: r.title, s: s.lesson.name })));
    }
    leave();
  };

  return (
    <Screen>
      <SessionHeader chip={t.recapChip} chipDark onClose={leave} />
      <ScrollView showsVerticalScrollIndicator={false} style={{ marginHorizontal: -4 }} contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 8 }}>
        <Txt t="h1" style={{ marginTop: 24, fontSize: 24, lineHeight: 29 }}>{okCount === records.length ? t.cleanSession : t.toFix}</Txt>
        <Txt t="row" color="mut" style={{ marginTop: 6, fontSize: 14, lineHeight: 21 }}>{t.firstTry(okCount, records.length)} · {s.lesson.name}</Txt>
        <View style={{ gap: 10, marginTop: 18 }}>
          {records.map((r, i) => {
            const card = cardOf(r.cardId);
            const days = previewDays(card?.fsrs ?? null, r.ok, now);
            const source = card?.source || lessonSource;
            const sent = !!doubts[i];
            return (
              <Card key={i} style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <Txt t="kickerSm" color="amber">{t.toReviews}</Txt>
                  <Txt t="monoMeta" color="amber" numberOfLines={1}>{t.dInDays(days)}</Txt>
                </View>
                <Txt t="item" style={{ marginTop: 8, lineHeight: 20 }}>{r.title}</Txt>
                <Txt t="meta" color="mut" style={{ marginTop: 4, lineHeight: 19 }}>{r.note}</Txt>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.lineSoft,
                  }}
                >
                  <Txt t="note" color="mut" numberOfLines={1} style={{ flexShrink: 1 }}>{t.srcL} {source}</Txt>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: sent }}
                    disabled={sent}
                    onPress={() => doubt(i)}
                    hitSlop={6}
                    style={{
                      paddingVertical: 7, paddingHorizontal: 10, borderRadius: radius.chip, borderWidth: 1,
                      backgroundColor: sent ? c.sand : 'transparent', borderColor: sent ? 'transparent' : c.errLine,
                    }}
                  >
                    <Txt t="note" style={{ color: sent ? c.sandInk : c.err, fontFamily: 'GolosText_500Medium', lineHeight: 13 }}>
                      {sent ? t.doubtSent : t.doubt}
                    </Txt>
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>
        <Txt t="small" color="mut" style={{ marginTop: 14, lineHeight: 19 }}>{t.recapFoot}</Txt>
      </ScrollView>
      <Button label={t.done} onPress={finish} style={{ marginTop: 10 }} />
    </Screen>
  );
}
