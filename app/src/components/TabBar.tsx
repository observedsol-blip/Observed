import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { color, font, space } from '../tokens';

export type Area = 'Today' | 'Result' | 'Record';
export const AREAS: Area[] = ['Today', 'Result', 'Record'];

/** Three areas. Never a fourth tab. */
export default function TabBar({
  active,
  onChange,
}: {
  active: Area | null;
  onChange: (area: Area) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: space.xl,
        paddingHorizontal: space.lg,
        borderTopWidth: 1,
        borderTopColor: color.hairline,
      }}
    >
      {AREAS.map((area) => {
        const isActive = area === active;
        return (
          <Pressable
            key={area}
            onPress={() => onChange(area)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={area}
            style={{ height: 56, justifyContent: 'center' }}
          >
            <Text
              style={{
                fontFamily: font.sans,
                fontSize: 14,
                color: isActive ? color.ink : color.meta,
              }}
            >
              {area}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
