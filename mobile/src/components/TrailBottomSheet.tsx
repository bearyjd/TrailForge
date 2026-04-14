import React, { useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import type { Trail } from '@/types/trail';
import { DifficultyBadge } from './DifficultyBadge';

interface Props {
  trail: Trail | null;
  onDismiss: () => void;
}

export function TrailBottomSheet({ trail, onDismiss }: Props) {
  const sheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (trail) sheetRef.current?.expand();
    else sheetRef.current?.close();
  }, [trail]);

  const handleChange = useCallback(
    (index: number) => { if (index === -1) onDismiss(); },
    [onDismiss]
  );

  if (!trail) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={['25%']}
      enablePanDownToClose
      onChange={handleChange}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{trail.name}</Text>
          <DifficultyBadge difficulty={trail.difficulty} />
        </View>
        <Text style={styles.meta}>
          {(trail.distance_m / 1000).toFixed(1)} km · {trail.trail_type}
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push(`/trail/${trail.id}`)}
        >
          <Text style={styles.buttonText}>View Details</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 18, fontWeight: '600', flex: 1, marginRight: 8 },
  meta: { color: '#666', marginTop: 4, marginBottom: 12 },
  button: { backgroundColor: '#2979c0', padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
