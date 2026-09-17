import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Screen from '../components/Screen';
import Hairline from '../components/Hairline';
import SampleBanner from '../components/SampleBanner';
import { Block, Body, Figures, FiguresMeta, Kicker, Label, MonoMeta } from '../components/Type';
import { color, space, type } from '../tokens';
import {
  CALIBRATION_MIN_REVEALED,
  EARLY_READ_MIN_REVEALED,
  PastRound,
  RecordState,
  earlyRecord,
  pastRounds,
  record,
  sampleRecord,
} from '../mock';

function RoundRow({ round }: { round: PastRound }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: space.md,
        borderBottomWidth: 1,
        borderBottomColor: color.hairline,
        gap: space.md,
      }}
    >
      <View style={{ width: 56 }}>
        <MonoMeta>{round.date}</MonoMeta>
      </View>
      <View style={{ flex: 1 }}>
        <Label numberOfLines={2} style={{ color: color.ink }}>
          {round.question}
        </Label>
        <FiguresMeta style={{ marginTop: space.xs }}>
          {[
            round.probability === null ? 'You —' : `You ${round.probability}`,
            round.outcome === null ? 'Outcome —' : `Outcome · ${round.outcome}`,
            round.brier === null ? 'Brier —' : `Brier ${round.brier}`,
            round.status,
          ].join(' · ')}
        </FiguresMeta>
      </View>
    </View>
  );
}

/**
 * Record — 03 §4, plus the owner's early read.
 *
 * The "Show sample record (36 rounds)" toggle is specified copy from 03, not a
 * dev control. Which mock dataset is loaded is chosen on the Settings stub.
 */
export default function Record({
  state,
  showSample,
  onToggleSample,
}: {
  state: RecordState;
  showSample: boolean;
  onToggleSample: () => void;
}) {
  const base = state === 'early_read' ? earlyRecord : record;
  const baseRounds = state === 'early_read' ? earlyRecord.rounds : pastRounds;

  const brier = showSample ? sampleRecord.brier : base.brier;
  const counts = showSample ? sampleRecord.countsValue : base.countsValue;
  const baselines = showSample ? sampleRecord.baselines : base.baselines;
  const rounds = showSample ? sampleRecord.rounds : baseRounds;

  const revealed = rounds.filter((r) => r.probability !== null).length;
  const curveUnlocked = revealed >= CALIBRATION_MIN_REVEALED;
  const showEarlyRead =
    !showSample && state === 'early_read' && revealed >= EARLY_READ_MIN_REVEALED && !curveUnlocked;

  return (
    <Screen>
      {showSample ? <SampleBanner text={record.sampleBanner} /> : null}

      <Kicker>{record.brierLabel}</Kicker>
      <Text style={{ ...type.hero, color: color.ink, marginTop: space.sm }}>{brier}</Text>

      <Block>
        <Label>{record.countsLabel}</Label>
        <Text style={{ ...type.numberLarge, color: color.ink, marginTop: space.xs }}>
          {counts}
        </Text>
        <FiguresMeta style={{ marginTop: space.xs }}>{record.countsFootnote}</FiguresMeta>
      </Block>

      <Block top={space.lg}>
        <FiguresMeta>{baselines}</FiguresMeta>
      </Block>

      <Hairline />

      {/* The early read: a leaning with its sample size and its band — never a
          verdict. The curve below it stays locked until 21 revealed rounds. */}
      {showEarlyRead ? (
        <Block top={0}>
          <Figures style={{ letterSpacing: 0.6 }}>{earlyRecord.earlyRead}</Figures>
          <Body style={{ marginTop: space.sm, color: color.meta }}>
            {earlyRecord.calibrationLocked}
          </Body>
        </Block>
      ) : showSample || curveUnlocked ? null : (
        <Body>{state === 'early_read' ? earlyRecord.calibrationLocked : record.calibrationLocked}</Body>
      )}

      <Block>
        <Kicker>Rounds</Kicker>
        <View style={{ marginTop: space.sm }}>
          {rounds.map((r) => (
            <RoundRow key={r.round} round={r} />
          ))}
        </View>
      </Block>

      <Pressable
        onPress={onToggleSample}
        accessibilityRole="switch"
        accessibilityState={{ checked: showSample }}
        accessibilityLabel={record.sampleToggle}
        style={{ minHeight: 48, justifyContent: 'center', marginTop: space.lg }}
      >
        <Label style={{ color: color.ink, textDecorationLine: 'underline' }}>
          {record.sampleToggle}
        </Label>
      </Pressable>
    </Screen>
  );
}
