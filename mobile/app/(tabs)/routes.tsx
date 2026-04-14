import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { RouteRow } from '@/components/RouteRow';
import { useSavedRoutesStore } from '@/stores/savedRoutesStore';

export default function RoutesScreen() {
  const { routes } = useSavedRoutesStore();
  const sorted = Object.values(routes).sort((a, b) => b.created_at - a.created_at);

  if (sorted.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No recorded routes yet</Text>
        <Text style={styles.hint}>Start recording from the map tab</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sorted}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => (
        <RouteRow route={item} onPress={() => router.push(`/route/${item.id}`)} />
      )}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  hint: { color: '#888', textAlign: 'center' },
});
