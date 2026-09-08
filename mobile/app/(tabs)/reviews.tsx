import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import type { ReviewCard } from '@/domain/reviewCard';
import { dueLabel, dueLater, dueToday } from '@/features/reviews/queue';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { REVIEW_ID } from '@/store/progress';
import { useReviews } from '@/store/reviews';
import { useTheme } from '@/theme';
import { AppHeader, Button, Card, Chip, Screen, TabTitle, Txt } from '@/ui';

function CardRow({ card, later, now }: { card: ReviewCard; later?: boolean; now: Date }) {
  const t = useT();
  return (
    <Card style={{ paddingVertical: 13, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: later ? 0.75 : 1 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt t="item" style={{ lineHeight: 20 }}>{card.title}</Txt>
        <Txt t="tiny" color="mut" style={{ marginTop: 3 }}>{card.subjectName}</Txt>
      </View>
      <Chip label={dueLabel(t, card.fsrs.due, now)} tone={later ? 'mint' : 'amber'} small />
    </Card>
  );
}

/** DESIGN.md §4.5 «Повторы»: списки СЕГОДНЯ / ПОЗЖЕ, закреплённая «Начать повторы». */
export default function ReviewsScreen() {
  const t = useT();
  const router = useRouter();
  const { space } = useTheme();
  const name = useAuth((s) => s.account?.name ?? '');
  const cards = useReviews((s) => s.cards);
  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => dueToday(cards, now), [cards, now]);
  const later = useMemo(() => dueLater(cards, now), [cards, now]);

  return (
    <Screen noBottom>
      <AppHeader userName={name} onAvatar={() => router.push('/profile')} />
      <TabTitle title={t.reviews} note={t.reviewsSummary(cards.length)} />
      <ScrollView showsVerticalScrollIndicator={false} style={{ marginHorizontal: -4 }} contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 8 }}>
        <Txt t="kicker" color="mut" style={{ marginTop: 18 }}>{t.dueToday}</Txt>
        <View style={{ gap: 9, marginTop: 10 }}>
          {today.map((c) => <CardRow key={c.id} card={c} now={now} />)}
        </View>
        <Txt t="kicker" color="mut" style={{ marginTop: 18 }}>{t.dueLater}</Txt>
        <View style={{ gap: 9, marginTop: 10 }}>
          {later.map((c) => <CardRow key={c.id} card={c} later now={now} />)}
        </View>
      </ScrollView>
      <Button
        label={t.startReviews}
        disabled={today.length === 0}
        onPress={() => router.push({ pathname: '/session/[id]', params: { id: REVIEW_ID } })}
        style={{ marginBottom: 6 + space.sm }}
      />
    </Screen>
  );
}
