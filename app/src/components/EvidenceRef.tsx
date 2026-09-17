import React from 'react';
import { View } from 'react-native';
import { space } from '../tokens';
import { evidence, thisPhonePosted } from '../mock';
import { MonoMeta, Kicker } from './Type';

/**
 * Evidence reference (03 §3.9). Explorer links are inert text in this
 * skeleton — the app makes no network calls of any kind.
 */
export default function EvidenceRef({ showPoster = thisPhonePosted }: { showPoster?: boolean }) {
  return (
    <View style={{ marginTop: space.xl }}>
      <Kicker>Evidence</Kicker>
      <View style={{ marginTop: space.sm, gap: space.xs }}>
        <MonoMeta>{evidence.feed}</MonoMeta>
        <MonoMeta>{evidence.reference}</MonoMeta>
        <MonoMeta>{evidence.referenceMeta}</MonoMeta>
        <MonoMeta>{evidence.outcome}</MonoMeta>
        <MonoMeta>{evidence.outcomeMeta}</MonoMeta>
        {showPoster ? <MonoMeta>{evidence.poster}</MonoMeta> : null}
        <MonoMeta>{evidence.explorerReference}</MonoMeta>
        <MonoMeta>{evidence.explorerOutcome}</MonoMeta>
      </View>
    </View>
  );
}
