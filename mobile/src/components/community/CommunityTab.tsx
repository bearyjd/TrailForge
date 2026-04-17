import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useCommunityStore } from '@/stores/communityStore';
import { ConditionBadge } from './ConditionBadge';
import { SubmitRatingSheet } from './SubmitRatingSheet';
import { SubmitConditionSheet } from './SubmitConditionSheet';

interface Props {
  osmTrailId: string;
  onSignInPress: () => void;
}

export function CommunityTab({ osmTrailId, onSignInPress }: Props) {
  const session = useCommunityStore((s) => s.session);
  const ratings = useCommunityStore((s) => s.ratings[osmTrailId] ?? []);
  const conditions = useCommunityStore((s) => s.conditions[osmTrailId] ?? []);
  const fetchCommunityData = useCommunityStore((s) => s.fetchCommunityData);

  const [ratingSheetVisible, setRatingSheetVisible] = useState(false);
  const [conditionSheetVisible, setConditionSheetVisible] = useState(false);

  useEffect(() => {
    fetchCommunityData(osmTrailId);
  }, [osmTrailId, fetchCommunityData]);

  const avgRating =
    ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(1)
      : null;

  const latestCondition = conditions.length > 0 ? conditions[0] : null;

  const handleRatePress = () => {
    if (!session) { onSignInPress(); return; }
    setRatingSheetVisible(true);
  };

  const handleConditionPress = () => {
    if (!session) { onSignInPress(); return; }
    setConditionSheetVisible(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Community</Text>

      {avgRating ? (
        <View style={styles.row}>
          <Text style={styles.avgRating}>{avgRating} ★</Text>
          <Text style={styles.ratingCount}>{ratings.length} ratings</Text>
        </View>
      ) : (
        <Text style={styles.emptyText}>Be the first to rate this trail</Text>
      )}

      {latestCondition && (
        <View style={styles.conditionRow}>
          <Text style={styles.conditionLabel}>Latest condition: </Text>
          <ConditionBadge tag={latestCondition.tag} />
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleRatePress}>
          <Text style={styles.actionText}>Rate Trail</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={handleConditionPress}>
          <Text style={styles.actionText}>Report Condition</Text>
        </TouchableOpacity>
      </View>

      <SubmitRatingSheet
        osmTrailId={osmTrailId}
        visible={ratingSheetVisible}
        onDismiss={() => setRatingSheetVisible(false)}
      />
      <SubmitConditionSheet
        osmTrailId={osmTrailId}
        visible={conditionSheetVisible}
        onDismiss={() => setConditionSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  heading: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avgRating: { fontSize: 22, fontWeight: '700', color: '#f4a829', marginRight: 8 },
  ratingCount: { color: '#888', fontSize: 14 },
  emptyText: { color: '#aaa', marginBottom: 8 },
  conditionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  conditionLabel: { color: '#666', fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#2979c0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnSecondary: { backgroundColor: '#5a4fcf' },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
