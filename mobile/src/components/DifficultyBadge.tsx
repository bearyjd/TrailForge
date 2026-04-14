import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Difficulty } from '@/types/trail';

const COLORS: Record<Difficulty, string> = {
  easy: '#2d9a4e',
  moderate: '#2979c0',
  hard: '#1a1a1a',
};

interface Props { difficulty: Difficulty }

export function DifficultyBadge({ difficulty }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: COLORS[difficulty] }]}>
      <Text style={styles.label}>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  label: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
