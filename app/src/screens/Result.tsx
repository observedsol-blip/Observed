// Result — the reveal moment, in the order the owner fixed on 21.09.2026 (03 §3):
//   1. the sentence from yesterday
//   2. the sealed answer, word for word, with the exact number
//   3. the verdict
//   4. the streak
//
// The Brier value is deliberately absent: it lives in the Record, not here (§11.3). And the
// sealed answer comes back before the verdict, because that is the whole point of the app —
// your memory can change, your sealed answer cannot.
import React from "react";
import { View } from "react-native";
import Screen from "../components/Screen";
import Scale from "../components/Scale";
import Hairline from "../components/Hairline";
import StrikeMoment from "../components/StrikeMoment";
import { Block, Body, Kicker, Label, MonoMeta, Reading, Sentence } from "../components/Type";
import type { ResultView } from "../core/day.ts";
import { copy } from "../copy.ts";
import { color, space } from "../tokens";

export default function Result({
  view,
  waiting = null,
}: {
  view: ResultView | null;
  /** Shown instead of a result when there is nothing revealed yet. */
  waiting?: string | null;
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

      <Block>
        <StrikeMoment before="pending" after="observed" />
      </Block>

      {/* 1 — what you wrote yesterday, before you knew */}
      <Block>
        {view.sentence ? (
          <>
            <Label>Yesterday you wrote:</Label>
            {/* Literata italic, the real cut (03 §3). Until 22.09.2026 this was Plex Sans with a
                synthetic slant — neither the family nor the italic the document asks for, and
                the cut was in the font package all along. */}
            <Sentence style={{ marginTop: space.xs }}>{view.sentence}</Sentence>
          </>
        ) : (
          <Label style={{ color: color.meta }}>No note yesterday.</Label>
        )}
      </Block>

      {/* 2 — the sealed answer, with the exact number */}
      <Block>
        <Body style={{ color: color.ink }}>{view.sealedAnswer}</Body>
      </Block>

      {/* 3 — the verdict */}
      <Block>
        <Reading>{view.verdict}</Reading>
        {view.verdictSubline ? (
          <Label style={{ marginTop: space.sm }}>{view.verdictSubline}</Label>
        ) : null}
        {view.verdictDetail ? (
          <Label style={{ marginTop: space.sm, color: color.meta }}>{view.verdictDetail}</Label>
        ) : null}
      </Block>

      {/* 4 — the streak */}
      <Block>
        <Label>{view.streak}</Label>
      </Block>

      <Hairline />

      {/* the crowd, at the same 21 positions as the input */}
      {view.crowd.mean !== null ? (
        <Block>
          <Scale
            mode="distribution"
            buckets={view.crowdBuckets ?? []}
            ownValue={view.ownPercent}
            mean={view.crowd.mean / 100}
          />
          <MonoMeta style={{ marginTop: space.sm }}>
            {`${view.crowd.revealed} revealed · Crowd ${Math.round(view.crowd.mean / 100)} · You ${view.ownPercent}`}
          </MonoMeta>
        </Block>
      ) : null}

      <Block>
        <Label>{copy.others.heading}</Label>
        <Label style={{ color: color.meta, marginTop: space.xs }}>
          {view.others.length === 0
            ? copy.others.empty
            : view.others.map((o) => `“${o}”`).join("\n")}
        </Label>
      </Block>

      <Block top={space.lg}>
        <Label style={{ color: color.meta }}>One call added. No verdict on your skill.</Label>
      </Block>

      <View style={{ height: space.xxl }} />
    </Screen>
  );
}
