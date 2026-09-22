// Record — the side record, the streak and the calls (03 §4), drawn from what the chain stores.
//
// The Brier is deliberately NOT here (owner, 22.09.2026): not as a season score, not per call,
// not as the "always 50 %" and crowd baselines that only mean something beside it. The number
// itself has not changed — the program keeps it, `recordView` still computes it, and
// scripts/verify-round.mjs still prints it. It is the display that is gone: a three-decimal
// score under every call turns one question a day into a scoreboard, and that is the opposite
// of what the record is for.
//
// Before 22.09.2026 this screen read from `app/src/mock.ts`: a cumulative Brier as the hero, the
// word "rounds", the calibration lock at 21, and a missing reveal counted as 0.250. All four
// were wrong. What is big now is the side record.
import React from "react";
import { Text, View } from "react-native";
import Screen from "../components/Screen";
import Hairline from "../components/Hairline";
import { Block, Body, FiguresMeta, Kicker, Label } from "../components/Type";
import type { PastCall, RecordView } from "../core/record.ts";
import { copy } from "../copy.ts";
import { color, space, type } from "../tokens";

function CallRow({ call, hideUnrevealed }: { call: PastCall; hideUnrevealed: boolean }) {
  // A call that is sealed but not yet opened: the number is only on this phone, and in a build
  // that asks what you remember, printing it here would answer the question in advance.
  const sealed = hideUnrevealed && !call.revealed ? null : call.sealed;
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
          {[sealed ?? "—", call.outcome ?? "—", call.status].join(" · ")}
        </FiguresMeta>
      </View>
    </View>
  );
}

export default function Record({
  view,
  hideUnrevealedAnswer = false,
}: {
  view: RecordView;
  /** On in the build that asks the memory question. */
  hideUnrevealedAnswer?: boolean;
}) {
  return (
    <Screen>
      {/* the side record, big — calls with a side, without the close ones */}
      <Kicker>{copy.headings.sideRecord}</Kicker>
      <Text style={{ ...type.hero, color: color.ink, marginTop: space.sm }}>
        {copy.record.sideRecord(view.sideRecord.hits, view.sideRecord.calls)}
      </Text>
      <Block top={space.sm}>
        <Label>{view.streak}</Label>
      </Block>

      <Block>
        <Label>Commits · Reveals · Missing</Label>
        <Text style={{ ...type.numberLarge, color: color.ink, marginTop: space.xs }}>
          {`${view.counts.commits} · ${view.counts.reveals} · ${view.counts.missing}`}
        </Text>
        <FiguresMeta style={{ marginTop: space.xs }}>missing counts as a full miss</FiguresMeta>
      </Block>

      <Hairline />

      {/* no curve and no word about overconfidence until there are enough revealed calls */}
      {view.calibration.unlocked ? null : <Body>{view.calibration.locked}</Body>}

      <Block>
        <Kicker>{copy.headings.calls}</Kicker>
        <View style={{ marginTop: space.sm }}>
          {view.calls.map((call) => (
            <CallRow key={call.roundId} call={call} hideUnrevealed={hideUnrevealedAnswer} />
          ))}
        </View>
      </Block>

      <View style={{ height: space.xxl }} />
    </Screen>
  );
}
