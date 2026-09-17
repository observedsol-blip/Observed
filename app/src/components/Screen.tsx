import React from 'react';
import { ScrollView } from 'react-native';
import { space } from '../tokens';

/** Left-aligned, one column, no cards. */
export default function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: space.lg,
        paddingTop: space.lg,
        paddingBottom: space.xxxl,
      }}
    >
      {children}
    </ScrollView>
  );
}
