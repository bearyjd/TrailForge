import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';
import { useFilterStore } from '@/stores/filterStore';
import type { Difficulty, TrailType } from '@/types/trail';

const DIFFICULTIES: Difficulty[] = ['easy', 'moderate', 'hard'];
const TYPES: TrailType[] = ['hiking', 'running', 'biking'];

export function FilterBar() {
  const { difficulty, trailType, setDifficulty, setTrailType } = useFilterStore();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bar}>
      {DIFFICULTIES.map((d) => (
        <Chip key={d} label={d} active={difficulty === d} onPress={() => setDifficulty(difficulty === d ? null : d)} />
      ))}
      <View style={styles.divider} />
      {TYPES.map((t) => (
        <Chip key={t} label={t} active={trailType === t} onPress={() => setTrailType(trailType === t ? null : t)} />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#ccc', marginRight: 8 },
  chipActive: { backgroundColor: '#2979c0', borderColor: '#2979c0' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  divider: { width: 1, backgroundColor: '#e0e0e0', marginHorizontal: 4 },
});
