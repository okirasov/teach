import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { ReviewCard } from '@/domain/reviewCard';
import { dueLabel, dueLater, dueToday, forSubject } from '@/features/reviews/queue';
import { sortByOrder } from '@/features/subjects/order';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { activeSubjectIds, REVIEW_ID, subjectName, useProgress } from '@/store/progress';
import { useReviews } from '@/store/reviews';
import { useTheme } from '@/theme';
import { AppHeader, Button, Card, Chip, Screen, SubjectTabs, TabTitle, Txt } from '@/ui';

const ALL = 'all';

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

/** DESIGN.md §4.5 «Повторы»: вкладки предметов, списки СЕГОДНЯ / ПОЗЖЕ, закреплённая «Начать повторы». */
export default function ReviewsScreen() {
  const t = useT();
  const router = useRouter();
  const { space } = useTheme();
  const name = useAuth((s) => s.account?.name ?? '');
  const cards = useReviews((s) => s.cards);
  const removed = useProgress((s) => s.removed);
  const userSubjects = useProgress((s) => s.subjects);
  const now = useMemo(() => new Date(), []);
  const [subject, setSubject] = useState<string>(ALL);

  // Вкладки: «Все» и предметы, у которых есть карточки, — в том же порядке, что на «Сегодня».
  const tabs = useMemo(() => {
    const order = activeSubjectIds({ removed, subjects: userSubjects });
    const names = new Map<string, string>();
    for (const c of cards) if (!names.has(c.subjectId)) names.set(c.subjectId, subjectName({ subjects: userSubjects }, c.subjectId) || c.subjectName);
    const list = sortByOrder([...names].map(([id, n]) => ({ id, name: n })), (x) => x.id, order);
    return [{ id: ALL, name: t.allSubjects }, ...list];
  }, [cards, removed, userSubjects, t]);

  // Карточки предмета закончились или предмет удалён — возвращаемся к «Все».
  useEffect(() => {
    if (!tabs.some((x) => x.id === subject)) setSubject(ALL);
  }, [tabs, subject]);

  const scoped = subject === ALL ? undefined : subject;
  const today = useMemo(() => forSubject(dueToday(cards, now), scoped), [cards, now, scoped]);
  const later = useMemo(() => forSubject(dueLater(cards, now), scoped), [cards, now, scoped]);

  // «Все» — вперемешку: чередование предметов помогает запоминанию; вкладка предмета — только его карточки.
  const start = () => router.push({ pathname: '/session/[id]', params: { id: REVIEW_ID, ...(scoped ? { subject: scoped } : {}) } });

  return (
    <Screen noBottom>
      <AppHeader userName={name} onAvatar={() => router.push('/profile')} />
      <TabTitle title={t.reviews} note={t.reviewsSummary(cards.length)} />
      {tabs.length > 2 ? <SubjectTabs items={tabs} value={subject} onChange={setSubject} /> : null}
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
      <Button label={t.startReviews} disabled={today.length === 0} onPress={start} style={{ marginBottom: 6 + space.sm }} />
    </Screen>
  );
}
