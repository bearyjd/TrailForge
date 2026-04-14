import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { SavedRoute } from '@/types/route';

interface RouteRowProps {
  route: SavedRoute;
  onPress: () => void;
}

export function RouteRow({ route, onPress }: RouteRowProps) {
  const date = new Date(route.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const distKm = (route.distance_m / 1000).toFixed(1);
  const mins = Math.floor(route.duration_s / 60);
  const secs = String(route.duration_s % 60).padStart(2, '0');

  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{route.name}</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      <View style={styles.badges}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{distKm} km</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{mins}:{secs}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee', backgroundColor: '#fff' },
  info: { flex: 1, marginRight: 12 },
  name: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  date: { fontSize: 13, color: '#888' },
  badges: { flexDirection: 'row', gap: 6 },
  badge: { backgroundColor: '#f0f4ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#2979c0' },
});
