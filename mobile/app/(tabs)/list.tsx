import React, { useState, useEffect } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { FilterBar } from '@/components/FilterBar';
import { TrailRow } from '@/components/TrailRow';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useMapStore } from '@/stores/mapStore';
import { useFilterStore } from '@/stores/filterStore';
import { searchTrails } from '@/api/trailApi';
import type { Trail } from '@/types/trail';

export default function ListScreen() {
  const { bbox } = useMapStore();
  const { difficulty, trailType, maxDistanceKm } = useFilterStore();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bbox) return;
    let active = true;
    setLoading(true);
    searchTrails(bbox)
      .then((res) => {
        if (!active) return;
        let filtered = res.features;
        if (difficulty) filtered = filtered.filter((t) => t.difficulty === difficulty);
        if (trailType) filtered = filtered.filter((t) => t.trail_type === trailType);
        if (maxDistanceKm) filtered = filtered.filter((t) => t.distance_m / 1000 <= maxDistanceKm);
        setTrails(filtered);
      })
      .catch(() => { if (active) setTrails([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bbox, difficulty, trailType, maxDistanceKm]);

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <FilterBar />
      {loading ? (
        <View style={styles.center}><Text>Loading trails…</Text></View>
      ) : trails.length === 0 ? (
        <View style={styles.center}><Text>No trails in this area. Explore the map first.</Text></View>
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TrailRow trail={item} onPress={() => router.push(`/trail/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
