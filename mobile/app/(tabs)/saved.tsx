import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { TrailRow } from '@/components/TrailRow';
import { useSavedStore } from '@/stores/savedStore';

export default function SavedScreen() {
  const { savedTrails } = useSavedStore();
  const trails = Object.values(savedTrails);

  if (trails.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No saved trails yet.</Text>
        <Text style={styles.hint}>Tap "Save" on any trail detail to bookmark it here.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={trails}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => (
        <TrailRow trail={item} onPress={() => router.push(`/trail/${item.id}`)} />
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
