import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2979c0' }}>
      <Tabs.Screen name="index" options={{ title: 'Explore', tabBarIcon: ({ color }) => <Text style={{ color }}>🗺</Text> }} />
      <Tabs.Screen name="list" options={{ title: 'Trails', tabBarIcon: ({ color }) => <Text style={{ color }}>📋</Text> }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: ({ color }) => <Text style={{ color }}>🔖</Text> }} />
      <Tabs.Screen name="routes" options={{ title: 'Routes', tabBarIcon: ({ color }) => <Text style={{ color }}>📍</Text> }} />
    </Tabs>
  );
}
