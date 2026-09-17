import React from 'react';
import { Text, View } from 'react-native';
import { color, font, space } from '../tokens';

/**
 * The strike: "pending" struck through, "observed" set above it in pencil.
 *
 * Rendered STATICALLY. 03 calls this the only motion in the app, but the
 * motion concept is not decided (see SealMoment.tsx), so nothing here animates.
 */
export default function StrikeMoment({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Text
        style={{
          fontFamily: font.sansMedium,
          fontSize: 15,
          lineHeight: 20,
          color: color.pencil,
        }}
      >
        {after}
      </Text>
      <Text
        style={{
          fontFamily: font.sans,
          fontSize: 15,
          lineHeight: 20,
          marginTop: space.xs,
          color: color.meta,
          textDecorationLine: 'line-through',
          textDecorationColor: color.pencil,
        }}
      >
        {before}
      </Text>
    </View>
  );
}
