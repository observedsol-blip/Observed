import React from 'react';
import { Pressable, Text } from 'react-native';
import { color, space, type } from '../tokens';

/**
 * The single primary action. Pencil blue is NEVER used here (04): the CTA is
 * ink on ground with a hairline edge. No radius, no shadow.
 */
export default function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: 56,
        justifyContent: 'center',
        paddingHorizontal: space.lg,
        borderWidth: 1,
        borderColor: disabled ? color.hairline : color.ink,
        alignSelf: 'flex-start',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ ...type.body, fontFamily: type.label.fontFamily, color: color.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}
