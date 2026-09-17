import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { color, font, space } from '../tokens';

/** Wordmark left, Settings right. Nothing else ever lives here. */
export default function Header({
  onSettings,
  settingsActive,
}: {
  onSettings: () => void;
  settingsActive: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: space.lg,
        height: 56,
      }}
    >
      <Text
        style={{
          fontFamily: font.serif,
          fontSize: 17,
          letterSpacing: 2,
          color: color.ink,
          textTransform: 'uppercase',
        }}
      >
        Observed
      </Text>
      <Pressable
        onPress={onSettings}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        hitSlop={12}
        style={{ minHeight: 48, justifyContent: 'center' }}
      >
        <Text
          style={{
            fontFamily: font.sans,
            fontSize: 13,
            color: settingsActive ? color.ink : color.meta,
          }}
        >
          Settings
        </Text>
      </Pressable>
    </View>
  );
}
