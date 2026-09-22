// Result — the reveal, as a sequence (owner, 22.09.2026; 03 §3).
//
//   1. what you wrote yesterday, alone on the screen
//   2. "Face it" — nothing of the outcome is visible until you ask for it
//   3. the outcome
//   4. "How sure were you last night?" — optional, behind a flag, never sent anywhere
//   5. "You sealed n%. You remembered m%." — only once it has been answered
//   6. at most two sentences from other people
//   7. the streak, as a footnote
//
// The order is deliberate and not the obvious one. The outcome comes BEFORE the memory
// question, because what is being measured is the drift between what you sealed and what you
// now think you sealed — and that drift only exists once you know how it went. Asking first
// would measure recall instead.
//
// Without a sentence there is nothing to stand alone, so the first stage shows the sealed
// answer instead and the button still reads "Face it".
//
// The Brier is deliberately absent: it lives on chain and in the verifier, not here (§11.3).
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Screen from "../components/Screen";
import Scale from "../components/Scale";
import Hairline from "../components/Hairline";
import PrimaryButton from "../components/PrimaryButton";
import StrikeMoment from "../components/StrikeMoment";
import { Block, Body, Kicker, Label, MonoMeta, Reading, Sentence } from "../components/Type";
import type { ResultView } from "../core/day.ts";
import { clampToStep } from "../core/answer.ts";
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
  onRemember?: (roundId: number, confidence: number) => void | Promise<void>;
}) {
  const roundId = view?.roundId ?? null;
  const [faced, setFaced] = useState(false);
  const [asking, setAsking] = useState(true);
  const [guess, setGuess] = useState(75);

  // A new call is a new reveal: the sentence stands alone again, and the memory question comes
  // back. Without this the second evening would open straight on the outcome.
  useEffect(() => {
    setFaced(false);
    setAsking(true);
    setGuess(75);
  }, [roundId]);

  if (!view) {
    return (
      <Screen>
        <Block>
          <Body style={{ color: color.meta }}>{waiting ?? copy.nothingRevealed}</Body>
        </Block>
      </Screen>
    );
  }

  // 1 — what you wrote yesterday, before you knew. Nothing else is on the screen.
  if (!faced) {
    return (
      <Screen>
        <Kicker>READING</Kicker>
        <Block top={space.md}>
          <Body>{view.question}</Body>
          {view.context ? <MonoMeta style={{ marginTop: space.xs }}>{view.context}</MonoMeta> : null}
        </Block>

        <Block top={space.xl}>
          {view.sentence ? (
            <>
              <Label>Yesterday you wrote:</Label>
              {/* Literata italic, the real cut (03 §3). */}
              <Sentence style={{ marginTop: space.xs }}>{view.sentence}</Sentence>
            </>
          ) : (
            // No sentence to stand alone, so the sealed answer takes the stage instead.
            <Body style={{ color: color.ink }}>{view.sealedAnswer}</Body>
          )}
        </Block>

        <Block top={space.xl}>
          <PrimaryButton label={copy.faceIt} onPress={() => setFaced(true)} />
        </Block>

        <View style={{ height: space.xxl }} />
      </Screen>
    );
  }

  const answered = view.remembered !== null;
  const ask = memoryQuestion && asking && !answered;

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

      {/* the sentence stays on the screen — it is what the outcome is being read against */}
      {view.sentence ? (
        <Block>
          <Label>Yesterday you wrote:</Label>
          <Sentence style={{ marginTop: space.xs }}>{view.sentence}</Sentence>
        </Block>
      ) : null}

      {/* 3 — the outcome */}
      <Block>
        <Reading>{view.verdict}</Reading>
        {view.verdictSubline ? (
          <Label style={{ marginTop: space.sm }}>{view.verdictSubline}</Label>
        ) : null}
        {view.verdictDetail ? (
          <Label style={{ marginTop: space.sm, color: color.meta }}>{view.verdictDetail}</Label>
        ) : null}
      </Block>

      {/* 4 — the memory question, if this build asks it and it is still unanswered */}
      {ask ? (
        <Block>
          <Label style={{ color: color.ink }}>{copy.memory.question}</Label>
          <View style={{ marginTop: space.md }}>
            <Scale mode="input" value={guess} onChange={(next) => setGuess(clampToStep(next))} />
          </View>
          <View style={{ marginTop: space.md }}>
            <PrimaryButton
              label={copy.faceIt}
              onPress={() => void onRemember?.(view.roundId, guess)}
            />
          </View>
          {/* Skippable by one tap. "Not now" is the word this app already uses for that. */}
          <Pressable onPress={() => setAsking(false)} accessibilityRole="button">
            <Label style={{ marginTop: space.md, color: color.meta }}>{copy.notNow}</Label>
          </Pressable>
        </Block>
      ) : null}

      {/* 5 — what you sealed, next to what you remembered. Only once it has been answered. */}
      <Block>
        <Body style={{ color: color.ink }}>
          {answered
            ? copy.memory.sealedAndRemembered(view.ownConfidence, view.remembered as number)
            : view.sealedAnswer}
        </Body>
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

      {/* 6 — at most two sentences from other people, chosen in core/others.ts */}
      <Block>
        <Label>{copy.others.heading}</Label>
        <Label style={{ color: color.meta, marginTop: space.xs }}>
          {view.others.length === 0
            ? copy.others.empty
            : view.others.map((o) => `“${o}”`).join("\n")}
        </Label>
      </Block>

      {/* 7 — the streak, as a footnote */}
      <Block top={space.lg}>
        <Label style={{ color: color.meta }}>{view.streak}</Label>
        <Label style={{ color: color.meta, marginTop: space.xs }}>
          One call added. No verdict on your skill.
        </Label>
      </Block>

      <View style={{ height: space.xxl }} />
    </Screen>
  );
}
