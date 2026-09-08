import { Tabs } from 'expo-router';

/** Таб-бар по DESIGN.md §3 появится вместе с экраном «Сегодня»; пока — системный. */
export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }} />;
}
