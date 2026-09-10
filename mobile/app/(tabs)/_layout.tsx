import { content } from '@/content';
import { useReminders } from '@/features/reminders/useReminders';
import { resumePrepare } from '@/features/subjects/prepare';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useSettings } from '@/store/settings';

import { useT } from '@/i18n';
import { TabBar } from '@/ui';

/** 4 вкладки: Сегодня · Повторы · Справочники · Предметы. */
export default function TabsLayout() {
  const introSeen = useSettings((s) => s.introSeen);
  // Напоминания держим в согласии с настройками профиля.
  useReminders();
  // Подготовка урока могла прерваться вместе с приложением — продолжаем ждать сервер.
  // Возврат из фона тоже проверяем: пока приложение было свёрнуто, урок мог стать готов,
  // а таймеры опроса в фоне не работают.
  useEffect(() => {
    void resumePrepare(content);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void resumePrepare(content);
    });
    return () => sub.remove();
  }, []);

  const t = useT();
  // Первый вход: интро с возможностями, затем мастер предмета.
  if (!introSeen) return <Redirect href="/intro" />;
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="today" options={{ title: t.today }} />
      <Tabs.Screen name="reviews" options={{ title: t.reviews }} />
      <Tabs.Screen name="refs" options={{ title: t.refs }} />
      <Tabs.Screen name="subjects" options={{ title: t.mission }} />
    </Tabs>
  );
}
