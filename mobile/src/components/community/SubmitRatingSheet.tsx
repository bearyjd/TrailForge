import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { StarRating } from './StarRating';
import { useCommunityStore } from '@/stores/communityStore';

interface Props {
  osmTrailId: string;
  visible: boolean;
  onDismiss: () => void;
}

export function SubmitRatingSheet({ osmTrailId, visible, onDismiss }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const submitRating = useCommunityStore((s) => s.submitRating);
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) sheetRef.current?.expand();
    else sheetRef.current?.close();
  }, [visible]);

  const handleChange = useCallback(
    (index: number) => { if (index === -1) onDismiss(); },
    [onDismiss]
  );

  const handleSubmit = async () => {
    if (stars === 0) {
      Alert.alert('Pick a rating', 'Please select 1–5 stars before submitting.');
      return;
    }
    setLoading(true);
    try {
      await submitRating(osmTrailId, stars, review.trim() || undefined);
      setStars(0);
      setReview('');
      onDismiss();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Submission failed — try again');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={['50%']}
      enablePanDownToClose
      onChange={handleChange}
    >
      <View style={styles.content}>
        <Text style={styles.heading}>Rate this trail</Text>
        <StarRating value={stars} onChange={setStars} />
        <TextInput
          style={styles.input}
          placeholder="Add a review (optional)"
          value={review}
          onChangeText={setReview}
          multiline
          numberOfLines={3}
        />
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit</Text>}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  heading: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    marginBottom: 16,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  btn: { backgroundColor: '#2979c0', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
