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
// THE NUMBER MUST NOT BE ON THE SCREEN BEFORE THE QUESTION. A screen that shows "You sealed:
// Up, 80% sure." and then asks how sure you were is not asking anything — it is reading the
// answer out first. So: without a sentence the first stage shows the SIDE only, and the
// confidence appears after the question has been answered or waved away.
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
  /** `null` is a skip: the question was put and waved away, which is not the same as unasked. */
  onRemember?: (roundId: number, confidence: number | null) => void | Promise<void>;
}) {
  const roundId = view?.roundId ?? null;
  const [faced, setFaced] = useState(false);
  // No default and no thumb: the answer only counts once the player has touched the scale,
  // the same rule the seal follows.
  const [guess, setGuess] = useState<number | null>(null);

  // A new call is a new reveal: the sentence stands alone again.
  useEffect(() => {
    setFaced(false);
    setGuess(null);
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

  // The question is put once per entry; `memoryAsked` is true after an answer AND after a skip.
  const ask = memoryQuestion && !view.memoryAsked;
  const answered = view.remembered !== null;

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
          ) : ask && view.sealedSide ? (
            // No sentence to stand alone. The SIDE may be shown, the number may not — it is
            // what the memory question is about. GAP: 03 has no line for "you sealed a side"
            // without the percentage, so the bare approved word stands here for now.
            <Body style={{ color: color.ink }}>{view.sealedSide}</Body>
          ) : ask ? (
            // A deliberate 50/50 has no side either, so this stage carries only the question.
            null
          ) : (
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

      {/* 4 — the memory question, if this build asks it and this entry has not been asked */}
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
          {/* Skippable by one tap. "Not now" is the word this app already uses for that, and a
              skip is recorded as such — asked once means asked once. */}
          <Pressable onPress={() => void onRemember?.(view.roundId, null)} accessibilityRole="button">
            <Label style={{ marginTop: space.md, color: color.meta }}>{copy.notNow}</Label>
          </Pressable>
        </Block>
      ) : null}

      {/* 5 — the confidence, and only now: after the question, never before it */}
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
