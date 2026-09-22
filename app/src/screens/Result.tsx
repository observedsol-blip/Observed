// Result — the reveal of a call that is already open on chain (03 §3).
//
// The sequence itself lives in components/RevealSequence: the same two stages appear on Today,
// above tonight's question, before the evening transaction goes out. One implementation, so the
// order the owner fixed cannot drift between the two places it is shown.
//
// The Brier is deliberately absent: it lives on chain and in the verifier, not here (§11.3).
import React from "react";
import { View } from "react-native";
import Screen from "../components/Screen";
import RevealSequence from "../components/RevealSequence";
import { Block, Body, Kicker, MonoMeta } from "../components/Type";
import type { ResultView } from "../core/day.ts";
import { copy } from "../copy.ts";
import { color, space } from "../tokens";

export default function Result({
  view,
  waiting = null,
  memoryQuestion = false,
  onRemember,
}: {
  view: ResultView | null;
  /** Shown instead of a result when there is nothing revealed yet. */
  waiting?: string | null;
  /** The memory question is a build flag: on in the tester build, off by default. */
  memoryQuestion?: boolean;
  /** `null` is a skip: the question was put and waved away, which is not the same as unasked. */
  onRemember?: (roundId: number, confidence: number | null) => void | Promise<void>;
}) {
  if (!view) {
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
        <Body>{view.question}</Body>
        {view.context ? <MonoMeta style={{ marginTop: space.xs }}>{view.context}</MonoMeta> : null}
      </Block>

      {/* On this screen the call is open on chain: the entry carries the revealed answer. */}
      <RevealSequence
        view={view}
        onChain
        memoryQuestion={memoryQuestion}
        onRemember={onRemember}
      />

      <View style={{ height: space.xxl }} />
    </Screen>
  );
}
