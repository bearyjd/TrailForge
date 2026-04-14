import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Trail } from '@/types/trail';
import { DifficultyBadge } from './DifficultyBadge';

interface Props {
  trail: Trail;
  onPress: (trail: Trail) => void;
}

export function TrailRow({ trail, onPress }: Props) {
  const km = (trail.distance_m / 1000).toFixed(1);
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(trail)}>
      <View style={styles.info}>
        <Text style={styles.name}>{trail.name}</Text>
        <Text style={styles.meta}>{km} km · {trail.trail_type}</Text>
      </View>
      <DifficultyBadge difficulty={trail.difficulty} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '500' },
  meta: { fontSize: 13, color: '#666', marginTop: 2 },
});
