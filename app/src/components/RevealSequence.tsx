// The reveal, in two stages — one component, used in two places.
//
// It is the same sequence on Result (after the call is open on chain) and on Today (before it
// is, where it stands above tonight's question). One implementation, because two would drift,
// and the order of this screen is the one thing the owner fixed twice.
//
//   1. what you wrote yesterday, alone
//   2. "Face it"
//   3. the outcome
//   4. the memory question, if this build asks it
//   5. what you sealed, next to what you remembered
//   6. at most two sentences from other people
//   7. the streak, as a footnote
//
// `onChain` is the honest half. Before the evening transaction goes out, this phone knows the
// outcome and knows its own sealed answer — but the chain does not know the answer yet. So
// nothing here says "revealed", and the link that invites a stranger to check the call only
// appears once there is something to check.
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Scale from "./Scale";
import Hairline from "./Hairline";
import PrimaryButton from "./PrimaryButton";
import StrikeMoment from "./StrikeMoment";
import { Block, Body, Label, MonoMeta, Reading, Sentence } from "./Type";
import type { ResultView } from "../core/day.ts";
import { clampToStep } from "../core/answer.ts";
import { copy } from "../copy.ts";
import { color, space } from "../tokens";

export default function RevealSequence({
  view,
  onChain,
  memoryQuestion = false,
  onRemember,
}: {
  view: ResultView;
  /** Whether the reveal is on chain. False on Today, before tonight's approval. */
  onChain: boolean;
  memoryQuestion?: boolean;
  onRemember?: (roundId: number, confidence: number | null) => void | Promise<void>;
}) {
  const [faced, setFaced] = useState(false);
  // No default and no thumb: the answer only counts once the player has touched the scale.
  const [guess, setGuess] = useState<number | null>(null);

  useEffect(() => {
    setFaced(false);
    setGuess(null);
  }, [view.roundId]);

  // The memory question belongs to an entry, and before the reveal there is no entry to hang it
  // on. It waits for the chain.
  const ask = onChain && memoryQuestion && !view.memoryAsked;
  const answered = view.remembered !== null;

  if (!faced) {
    return (
      <View>
        <Block top={space.xl}>
          {view.sentence ? (
            <>
              <Label>Yesterday you wrote:</Label>
              {/* Literata italic, the real cut (03 §3). */}
              <Sentence style={{ marginTop: space.xs }}>{view.sentence}</Sentence>
            </>
          ) : ask && view.sealedSide ? (
            // The side may be shown, the number may not — it is what the question asks about.
            <Body style={{ color: color.ink }}>{view.sealedSide}</Body>
          ) : ask ? null : (
            <Body style={{ color: color.ink }}>{view.sealedAnswer}</Body>
          )}
        </Block>

        <Block top={space.xl}>
          <PrimaryButton label={copy.faceIt} onPress={() => setFaced(true)} />
        </Block>
      </View>
    );
  }

  return (
    <View>
      <Block>
        <StrikeMoment before="pending" after="observed" />
      </Block>

      {/* the sentence stays — it is what the outcome is being read against */}
      {view.sentence ? (
        <Block>
          <Label>Yesterday you wrote:</Label>
          <Sentence style={{ marginTop: space.xs }}>{view.sentence}</Sentence>
        </Block>
      ) : null}

      <Block>
        <Reading>{view.verdict}</Reading>
        {view.verdictSubline ? (
          <Label style={{ marginTop: space.sm }}>{view.verdictSubline}</Label>
        ) : null}
        {view.verdictDetail ? (
          <Label style={{ marginTop: space.sm, color: color.meta }}>{view.verdictDetail}</Label>
        ) : null}
      </Block>

      {ask ? (
        <Block>
          <Label style={{ color: color.ink }}>{copy.memory.question}</Label>
          <View style={{ marginTop: space.md }}>
            <Scale mode="input" value={guess} onChange={(next) => setGuess(clampToStep(next))} />
          </View>
          <View style={{ marginTop: space.md }}>
            <PrimaryButton
              label={copy.faceIt}
              disabled={guess === null}
              onPress={() => void onRemember?.(view.roundId, guess)}
            />
          </View>
          <Pressable onPress={() => void onRemember?.(view.roundId, null)} accessibilityRole="button">
            <Label style={{ marginTop: space.md, color: color.meta }}>{copy.notNow}</Label>
          </Pressable>
        </Block>
      ) : null}

      {/* the confidence, and only now: after the question, never before it */}
      {ask ? null : (
        <Block>
          <Body style={{ color: color.ink }}>
            {answered
              ? copy.memory.sealedAndRemembered(view.ownConfidence, view.remembered as number)
              : view.sealedAnswer}
          </Body>
        </Block>
      )}

      <Hairline />

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
        <Label style={{ color: color.meta }}>{view.streak}</Label>
        <Label style={{ color: color.meta, marginTop: space.xs }}>
          One call added. No verdict on your skill.
        </Label>
        {/* Only once there is something for a stranger to look up. */}
        {onChain ? (
          <Label style={{ color: color.meta, marginTop: space.sm }}>{copy.checkYourself}</Label>
        ) : null}
      </Block>
    </View>
  );
}
