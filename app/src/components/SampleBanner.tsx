import React from 'react';
import { Text, View } from 'react-native';
import { color, font, space } from '../tokens';

/** No radius, no fill — a banner is a rule and a line of Plex Sans. */
export default function SampleBanner({ text }: { text: string }) {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: color.hairline,
        paddingVertical: space.sm,
        marginBottom: space.lg,
      }}
    >
      <Text
        style={{
          fontFamily: font.sans,
          fontSize: 12,
          letterSpacing: 1,
          color: color.meta,
          textTransform: 'uppercase',
        }}
      >
        {text}
      </Text>
    </View>
  );
}
