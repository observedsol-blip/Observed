// Result — yesterday's call, in whatever state it is actually in (03 §3).
//
// One state, two screens. Until 23.09.2026 this screen said "Nothing revealed yet." while Today,
// two taps away, already showed the outcome: `latestResult` only ever looked at entries the
// chain calls revealed, and before tonight's approval no entry is. A player saw the result on
// one screen and "nothing" on the other, and both were the app talking about the same call.
//
// Now Result shows the same `RevealSequence` Today shows, from the same view, and says which of
// the two states it is in — with the line Today already uses, not a second wording for the same
// fact.
//
// The Brier is deliberately absent: it lives on chain and in the verifier, not here (§11.3).
import React from "react";
import { View } from "react-native";
import Screen from "../components/Screen";
import RevealSequence from "../components/RevealSequence";
import { Block, Body, Kicker, Label, MonoMeta } from "../components/Type";
import type { ResultView } from "../core/day.ts";
import { copy } from "../copy.ts";
import { color, space } from "../tokens";

export default function Result({
  view,
  pending = null,
  waiting = null,
  memoryQuestion = false,
  onRemember,
}: {
  /** The call as the chain has it: revealed, scored, countable. */
  view: ResultView | null;
  /** The same call before tonight's approval — known to this phone, not yet to the chain. */
  pending?: ResultView | null;
  /**
   * What to say instead of a result. Two jobs, one prop: the empty state when there is nothing
   * at all, and the "not on chain yet" line above a pending reveal.
   */
  waiting?: string | null;
  /** The memory question is a build flag: on in the tester build, off by default. */
  memoryQuestion?: boolean;
  /** `null` is a skip: the question was put and waved away, which is not the same as unasked. */
  onRemember?: (roundId: number, confidence: number | null) => void | Promise<void>;
}) {
  const shown = view ?? pending;
  const onChain = view !== null;

  if (!shown) {
    return (
      <Screen>
        <Block>
          <Body style={{ color: color.meta }}>{waiting ?? copy.nothingRevealed}</Body>
        </Block>
      </Screen>
    );
  }

  return (
    <Screen>
      <Kicker>READING</Kicker>
      <Block top={space.md}>
        <Body>{shown.question}</Body>
        {shown.context ? <MonoMeta style={{ marginTop: space.xs }}>{shown.context}</MonoMeta> : null}
      </Block>

      {/* Not on chain yet: the same sentence Today uses for the same fact. */}
      {!onChain && waiting ? (
        <Block top={space.sm}>
          <Label style={{ color: color.meta }}>{waiting}</Label>
        </Block>
      ) : null}

      <RevealSequence
        view={shown}
        onChain={onChain}
        memoryQuestion={memoryQuestion}
        onRemember={onRemember}
      />

      <View style={{ height: space.xxl }} />
    </Screen>
  );
}
