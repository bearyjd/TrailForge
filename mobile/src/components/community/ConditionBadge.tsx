import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ConditionTag } from '@/types/community';

const COLORS: Record<ConditionTag, string> = {
  dry: '#2d9a4e',
  wet: '#2979c0',
  muddy: '#795548',
  icy: '#00acc1',
  snow: '#5c6bc0',
  closed: '#d32f2f',
  overgrown: '#689f38',
};

interface Props {
  tag: ConditionTag;
}

export function ConditionBadge({ tag }: Props) {
  const label = tag.charAt(0).toUpperCase() + tag.slice(1);
  return (
    <View style={[styles.badge, { backgroundColor: COLORS[tag] }]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  label: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
