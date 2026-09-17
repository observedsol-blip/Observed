import React from 'react';
import { View } from 'react-native';
import { color, space } from '../tokens';

/** A single rule. Max two per screen (04 §1). */
export default function Hairline({ marginVertical = space.lg }: { marginVertical?: number }) {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: color.hairline,
        marginVertical,
      }}
    />
  );
}
