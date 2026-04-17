import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface Props {
  value: number;
  onChange: (stars: number) => void;
}

export function StarRating({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity
          key={n}
          accessibilityRole="button"
          onPress={() => onChange(n)}
          style={styles.star}
        >
          <Text style={[styles.starText, n <= value && styles.starFilled]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  star: { padding: 4 },
  starText: { fontSize: 28, color: '#ccc' },
  starFilled: { color: '#f4a829' },
});
