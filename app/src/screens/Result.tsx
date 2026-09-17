import React from 'react';
import { View } from 'react-native';
import Screen from '../components/Screen';
import Scale from '../components/Scale';
import Hairline from '../components/Hairline';
import StrikeMoment from '../components/StrikeMoment';
import SampleBanner from '../components/SampleBanner';
import EvidenceRef from '../components/EvidenceRef';
import { Block, Body, Figures, FiguresMeta, Kicker, Label, MonoMeta, Reading } from '../components/Type';
import { color, space } from '../tokens';
import { crowdBuckets, result, ResultState } from '../mock';

/**
 * Result — the core. Order of elements is exactly 03 §3, items 1–9.
 * Which state is shown is chosen on the Settings stub.
 */
export default function Result({ state }: { state: ResultState }) {
  if (state === 'no_resolve') {
    return (
      <Screen>
        <Kicker>{result.kicker}</Kicker>
        <Block top={space.md}>
          <Body>{result.question}</Body>
        </Block>
        <Hairline />
        <Reading>{result.noResolve}</Reading>
        <Block top={space.xl}>
          <MonoMeta>{result.noResolveReference}</MonoMeta>
          <MonoMeta style={{ marginTop: space.xs }}>{result.noResolveOutcome}</MonoMeta>
        </Block>
        <EvidenceRef showPoster={false} />
      </Screen>
    );
  }

  const isSample = state === 'sample';
  const revealedLine =
    state === 'resolved_partial' ? result.revealedPartial : result.revealedFinal;

  return (
    <Screen>
      {isSample ? <SampleBanner text={result.sampleBanner} /> : null}

      {/* 1 — question, small */}
      <Kicker>{result.kicker}</Kicker>
      <Block top={space.md}>
        <Body>{result.question}</Body>
      </Block>

      {/* 2 — the strike: "pending" struck through, "observed" above it */}
      <Block>
        <StrikeMoment before={result.strikeBefore} after={result.strikeAfter} />
      </Block>

      {/* 3 — hero in Literata, not the number */}
      <Block>
        <Reading>{result.reading}</Reading>
        <Label style={{ marginTop: space.sm }}>{result.outcomeMeta}</Label>
      </Block>

      <Hairline />

      {/* 4 — your sentence */}
      <Body>{result.yourSentence}</Body>

      {/* 5 — the scale becomes the distribution */}
      <Block>
        <Scale
          mode="distribution"
          buckets={crowdBuckets}
          ownValue={result.yourProbability}
          mean={result.crowdMean}
        />
        <MonoMeta style={{ marginTop: space.sm }}>{revealedLine}</MonoMeta>
      </Block>

      {/* 6 — facts. Two probabilities, so Plex Sans. */}
      <Block>
        <Figures>{result.facts}</Figures>
      </Block>

      {/* 7 — protocol line. Plex Sans, not Mono: it is all Brier values. */}
      <Block top={space.md}>
        <FiguresMeta>{result.protocol}</FiguresMeta>
      </Block>

      {/* 8 — closing */}
      <Block>
        <Label style={{ color: color.meta }}>{result.closing}</Label>
      </Block>

      {/* 9 — evidence */}
      <View>
        <EvidenceRef />
      </View>

      {isSample ? (
        <Block top={space.lg}>
          <MonoMeta>{result.sampleWindow}</MonoMeta>
        </Block>
      ) : null}
    </Screen>
  );
}
