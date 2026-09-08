import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { useReviews } from '@/store/reviews';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';
import { AppHeader, Avatar, Card, Screen, Segment, Toggle, TwoStepConfirm, Txt } from '@/ui';

/** DESIGN.md §4.11 «Профиль»: без скролла, карточка аккаунта, группы настроек, «Выйти». */
export default function ProfileScreen() {
  const t = useT();
  const router = useRouter();
  const th = useTheme();
  const { c, fonts } = th;
  const account = useAuth((s) => s.account);
  const signOut = useAuth((s) => s.signOut);
  const stats = useReviews((s) => s.stats);
  const g = useSettings();

  const providerName = account?.provider === 'google' ? 'Google' : 'Apple';

  const Group = ({ title, first, children }: { title: string; first?: boolean; children: React.ReactNode }) => (
    <>
      <Txt t="group" color="mut" style={{ marginTop: first ? 16 : 14, marginBottom: 6, marginLeft: 4, lineHeight: 13 }}>{title}</Txt>
      <Card large padding={0}>{children}</Card>
    </>
  );
  const Row = ({ label, control, last }: { label: string; control: React.ReactNode; last?: boolean }) => (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: th.size.row,
        paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.lineSoft,
      }}
    >
      <Txt t="row" style={{ lineHeight: 19, flexShrink: 1 }}>{label}</Txt>
      {control}
    </View>
  );

  return (
    <Screen>
      <AppHeader userName={account?.name ?? ''} onClose={() => router.back()} />
      <Txt t="h1" style={{ marginTop: 16 }}>{t.profileTitle}</Txt>

      <Card large style={{ marginTop: 12, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <Avatar name={account?.name ?? ''} size={th.size.avatarLg} />
          <View style={{ minWidth: 0, flexShrink: 1 }}>
            <Txt t="body" numberOfLines={1} style={{ fontFamily: fonts.sans600, fontSize: 16, lineHeight: 19 }}>{account?.name}</Txt>
            <Txt t="tiny" color="mut" numberOfLines={1} style={{ marginTop: 2 }}>{`${t.via} ${providerName}`}</Txt>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {[{ v: stats.month, l: t.stClosed }, { v: stats.today, l: t.stToday }].map((s) => (
            <View key={s.l} style={{ alignItems: 'flex-end' }}>
              <Txt t="stat" style={{ letterSpacing: -0.3 }}>{String(s.v)}</Txt>
              <Txt t="statLabel" color="mut" style={{ marginTop: 4 }} numberOfLines={1}>{s.l}</Txt>
            </View>
          ))}
        </View>
      </Card>

      <Group title={t.remG} first>
        <Row label={t.remTime} control={<Segment options={[{ value: 'morning' as const, label: t.remMorning }, { value: 'evening' as const, label: t.remEvening }]} value={g.reminder} onChange={g.setReminder} />} />
        <Row label={t.weekendOff} control={<Toggle value={g.weekendOff} onChange={g.setWeekendOff} label={t.weekendOff} />} last />
      </Group>

      <Group title={t.reviewsG}>
        <Row
          label={t.capG}
          control={<Segment options={[{ value: 20, label: '20' }, { value: 40, label: '40' }, { value: 80, label: '80' }, { value: 0, label: t.capOff }] as { value: 20 | 40 | 80 | 0; label: string }[]} value={g.cap} onChange={g.setCap} />}
          last
        />
      </Group>

      <Group title={t.voiceG}>
        <Row label={t.recMode} control={<Segment options={[{ value: 'ptt' as const, label: t.modePtt }, { value: 'hands' as const, label: t.modeHands }]} value={g.mode} onChange={g.setMode} />} last />
      </Group>

      <Group title={t.appG}>
        <Row label={t.language} control={<Segment options={[{ value: 'ru' as const, label: t.langRu }, { value: 'en' as const, label: t.langEn }]} value={g.lang} onChange={g.setLang} />} />
        <Row label={t.themeT} control={<Segment options={[{ value: 'light' as const, label: t.lightL }, { value: 'dark' as const, label: t.darkL }]} value={th.name} onChange={g.setTheme} />} last />
      </Group>

      <View style={{ flex: 1 }} />
      <TwoStepConfirm label={t.logout} message={t.logoutConfirm} yes={t.logoutYes} no={t.logoutNo} onConfirm={() => void signOut()} />
    </Screen>
  );
}
