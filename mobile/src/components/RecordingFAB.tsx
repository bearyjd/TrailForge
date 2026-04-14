import React, { useEffect, useRef, useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Animated } from 'react-native';

interface RecordingFABProps {
  isRecording: boolean;
  startTime: number | null;
  onStart: () => void;
  onStop: () => void;
}

export function RecordingFAB({ isRecording, startTime, onStart, onStop }: RecordingFABProps) {
  const [elapsed, setElapsed] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isRecording) { setElapsed(0); return; }
    const interval = setInterval(() => {
      setElapsed(startTime ? Math.floor((Date.now() - startTime) / 1000) : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, startTime]);

  useEffect(() => {
    if (!isRecording) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isRecording, pulseAnim]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <TouchableOpacity
      style={[styles.fab, isRecording ? styles.fabActive : styles.fabIdle]}
      onPress={isRecording ? onStop : onStart}
    >
      {isRecording ? (
        <View style={styles.activeContent}>
          <Animated.View style={[styles.dot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.timer}>{mm}:{ss}</Text>
        </View>
      ) : (
        <Text style={styles.idleText}>⏺ Record</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIdle: { backgroundColor: '#666' },
  fabActive: { backgroundColor: '#c0392b' },
  activeContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  timer: { color: '#fff', fontWeight: '600', fontSize: 14 },
  idleText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
