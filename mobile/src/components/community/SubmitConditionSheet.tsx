import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { ConditionBadge } from './ConditionBadge';
import { useCommunityStore } from '@/stores/communityStore';
import type { ConditionTag } from '@/types/community';

const TAGS: ConditionTag[] = ['dry', 'wet', 'muddy', 'icy', 'snow', 'closed', 'overgrown'];

interface Props {
  osmTrailId: string;
  visible: boolean;
  onDismiss: () => void;
}

export function SubmitConditionSheet({ osmTrailId, visible, onDismiss }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const submitting = useRef(false);
  const submitCondition = useCommunityStore((s) => s.submitCondition);
  const [selected, setSelected] = useState<ConditionTag | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = useCallback(
    (index: number) => {
      if (index === -1) {
        setSelected(null);
        setNote('');
        onDismiss();
      }
    },
    [onDismiss]
  );

  const handleSubmit = async () => {
    if (!selected) {
      Alert.alert('Pick a condition', 'Please select a condition tag before submitting.');
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    try {
      await submitCondition(osmTrailId, selected, note.trim() || undefined);
      setSelected(null);
      setNote('');
      onDismiss();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Submission failed — try again');
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={visible ? 0 : -1}
      snapPoints={['55%']}
      enablePanDownToClose
      onChange={handleChange}
    >
      <View style={styles.content}>
        <Text style={styles.heading}>Report trail condition</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tags}>
          {TAGS.map((tag) => (
            <TouchableOpacity
              key={tag}
              onPress={() => setSelected(tag)}
              style={[styles.tagWrap, selected === tag && styles.tagSelected]}
            >
              <ConditionBadge tag={tag} />
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TextInput
          style={styles.input}
          placeholder="Add a note (optional)"
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={2}
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
  tags: { marginBottom: 12 },
  tagWrap: { marginRight: 8, opacity: 0.6 },
  tagSelected: { opacity: 1, transform: [{ scale: 1.05 }] },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  btn: { backgroundColor: '#2979c0', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
