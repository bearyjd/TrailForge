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

const MAX_ENTRIES = 5;

function newestWithText<T extends { createdAt: string }>(
  items: T[],
  getText: (item: T) => string | undefined
): T[] {
  return items
    .filter((item) => (getText(item) ?? '').trim().length > 0)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_ENTRIES);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function CommunityTab({ osmTrailId, onSignInPress }: Props) {
  const session = useCommunityStore((s) => s.session);
  const ratings = useCommunityStore((s) => s.ratings[osmTrailId] ?? []);
  const conditions = useCommunityStore((s) => s.conditions[osmTrailId] ?? []);
  const fetchCommunityData = useCommunityStore((s) => s.fetchCommunityData);

  const [ratingSheetVisible, setRatingSheetVisible] = useState(false);
  const [conditionSheetVisible, setConditionSheetVisible] = useState(false);

  useEffect(() => {
    fetchCommunityData(osmTrailId).catch(() => {
      // network/Supabase error — empty state will show
    });
  }, [osmTrailId, fetchCommunityData]);

  const avgRating =
    ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(1)
      : null;

  const latestCondition = conditions.length > 0
    ? [...conditions].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0]
    : null;

  const reviews = newestWithText(ratings, (r) => r.review);
  const conditionNotes = newestWithText(conditions, (c) => c.note);

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

      {reviews.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.subheading}>Reviews</Text>
          {reviews.map((r) => (
            <View key={r.id} style={styles.entry}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryStars}>{'★'.repeat(r.stars)}</Text>
                <Text style={styles.entryDate}>{formatDate(r.createdAt)}</Text>
              </View>
              <Text style={styles.entryText} numberOfLines={4}>{r.review}</Text>
            </View>
          ))}
        </View>
      )}

      {conditionNotes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.subheading}>Recent conditions</Text>
          {conditionNotes.map((c) => (
            <View key={c.id} style={styles.entry}>
              <View style={styles.entryHeader}>
                <ConditionBadge tag={c.tag} />
                <Text style={styles.entryDate}>{formatDate(c.createdAt)}</Text>
              </View>
              <Text style={styles.entryText} numberOfLines={4}>{c.note}</Text>
            </View>
          ))}
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
  section: { marginBottom: 12 },
  subheading: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  entry: { marginBottom: 8 },
  entryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  entryStars: { color: '#f4a829', fontSize: 14 },
  entryDate: { color: '#888', fontSize: 12 },
  entryText: { color: '#333', fontSize: 14 },
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
