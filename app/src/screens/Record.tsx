// Record — two numbers and a sentence (03 §4 and §11.5), drawn from what the chain stores.
//
// Until 22.09.2026 this screen read from `app/src/mock.ts`: a cumulative Brier as the hero, the
// word "rounds", the calibration lock at 21, and a missing reveal counted as 0.250. All four were
// wrong. What is big now is the side record; the Brier is the season score underneath it, and
// every number comes out of `recordView` — from the Player account, the rounds, the entries and
// the seal records on this phone.
import React from "react";
import { Text, View } from "react-native";
import Screen from "../components/Screen";
import Hairline from "../components/Hairline";
import { Block, Body, FiguresMeta, Kicker, Label } from "../components/Type";
import type { PastCall, RecordView } from "../core/record.ts";
import { copy } from "../copy.ts";
import { color, space, type } from "../tokens";

function CallRow({ call }: { call: PastCall }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        paddingVertical: space.md,
        borderBottomWidth: 1,
        borderBottomColor: color.hairline,
        gap: space.md,
      }}
    >
      <View style={{ width: 56 }}>
        <FiguresMeta>{call.date}</FiguresMeta>
      </View>
      <View style={{ flex: 1 }}>
        <Label numberOfLines={2} style={{ color: color.ink }}>
          {call.question}
        </Label>
        <FiguresMeta style={{ marginTop: space.xs }}>
          {[
            call.sealed ?? "—",
            call.outcome ?? "—",
            call.brier ?? "—",
            call.status,
          ].join(" · ")}
        </FiguresMeta>
      </View>
    </View>
  );
}

export default function Record({ view }: { view: RecordView }) {
  return (
    <Screen>
      {/* the side record, big — calls with a side, without the close ones */}
      <Kicker>Side record</Kicker>
      <Text style={{ ...type.hero, color: color.ink, marginTop: space.sm }}>
        {copy.record.sideRecord(view.sideRecord.hits, view.sideRecord.calls)}
      </Text>
      <Block top={space.sm}>
        <Label>{view.streak}</Label>
      </Block>

      {/* the season score: the program's own number, including what was never revealed */}
      <Block>
        <Kicker>Season score</Kicker>
        <Text style={{ ...type.numberLarge, color: color.ink, marginTop: space.xs }}>
          {view.seasonScore ? `${view.seasonScore.value} · ${view.seasonScore.scored} scored` : "—"}
        </Text>
        <Body style={{ marginTop: space.sm }}>{copy.record.explain}</Body>
      </Block>

      <Block>
        <Label>Commits · Reveals · Missing</Label>
        <Text style={{ ...type.numberLarge, color: color.ink, marginTop: space.xs }}>
          {`${view.counts.commits} · ${view.counts.reveals} · ${view.counts.missing}`}
        </Text>
        <FiguresMeta style={{ marginTop: space.xs }}>missing counts as a full miss</FiguresMeta>
      </Block>

      <Block top={space.lg}>
        <FiguresMeta>
          {`Always 50%: ${view.baselines.always50}${
            view.baselines.crowd === null ? "" : ` · Crowd: ${view.baselines.crowd}`
          }`}
        </FiguresMeta>
      </Block>

      <Hairline />

      {/* no curve and no word about overconfidence until there are enough revealed calls */}
      {view.calibration.unlocked ? null : <Body>{view.calibration.locked}</Body>}

      <Block>
        <Kicker>Calls</Kicker>
        <View style={{ marginTop: space.sm }}>
          {view.calls.map((call) => (
            <CallRow key={call.roundId} call={call} />
          ))}
        </View>
      </Block>

      <View style={{ height: space.xxl }} />
    </Screen>
  );
}
