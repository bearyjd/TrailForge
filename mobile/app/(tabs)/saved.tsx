import React from 'react';
import { FlatList, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { TrailRow } from '@/components/TrailRow';
import { useSavedStore } from '@/stores/savedStore';

export default function SavedScreen() {
  const { savedTrails } = useSavedStore();
  const trails = Object.values(savedTrails);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.manageBtn} onPress={() => router.push('/offline')}>
        <Text style={styles.manageBtnText}>🗂 Manage Downloads</Text>
      </TouchableOpacity>
      {trails.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No saved trails yet.</Text>
          <Text style={styles.hint}>Tap "Save" on any trail detail to bookmark it here.</Text>
        </View>
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TrailRow trail={item} onPress={() => router.push(`/trail/${item.id}`)} />
          )}
          style={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { backgroundColor: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  hint: { color: '#888', textAlign: 'center' },
  manageBtn: { margin: 12, padding: 12, backgroundColor: '#f0f4ff', borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  manageBtnText: { color: '#2979c0', fontWeight: '600', fontSize: 14 },
});
