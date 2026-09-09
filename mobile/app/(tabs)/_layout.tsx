import { content } from '@/content';
import { resumePrepare } from '@/features/subjects/prepare';
import { useEffect } from 'react';
import { Tabs } from 'expo-router';

import { useT } from '@/i18n';
import { TabBar } from '@/ui';

/** 4 вкладки: Сегодня · Повторы · Справочники · Предметы. */
export default function TabsLayout() {
  // Подготовка урока могла прерваться вместе с приложением — продолжаем ждать сервер.
  useEffect(() => {
    void resumePrepare(content);
  }, []);

  const t = useT();
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="today" options={{ title: t.today }} />
      <Tabs.Screen name="reviews" options={{ title: t.reviews }} />
      <Tabs.Screen name="refs" options={{ title: t.refs }} />
      <Tabs.Screen name="subjects" options={{ title: t.mission }} />
    </Tabs>
  );
}
