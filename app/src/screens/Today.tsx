// Today — draws what the session says, decides nothing itself.
//
// Every string comes from docs/03-SCREEN-MAP.md (§2 for the states, §11 for the input), and
// every state comes from `TodayView`, which is derived from the chain plus the local record.
// The screen has exactly one job beyond drawing: it must not let a seal start before the player
// has touched the side, because a 50/50 nobody chose is not an answer.
import React, { useState } from "react";
import { Text, View } from "react-native";
import Screen from "../components/Screen";
import Hairline from "../components/Hairline";
import PrimaryButton from "../components/PrimaryButton";
import SentenceField from "../components/SentenceField";
import SideConfidence, { type Side, fromPBps, toPBps } from "../components/SideConfidence";
import { Block, Body, Kicker, Label, Mono, MonoMeta, Question } from "../components/Type";
import type { TodayView } from "../core/day.ts";
import { copy } from "../copy.ts";
import { color, space, type } from "../tokens";

export type TodayActions = {
  /** Writes the answer down. No wallet, no network. */
  onSave: (pBps: number, sentence?: string, share?: boolean) => Promise<void> | void;
  /** The one approval of the day: reveal everything open, seal today. */
  onSeal: () => Promise<void> | void;
  onConnect?: () => Promise<void> | void;
};

export default function Today({
  view,
  actions,
  busy = false,
  error = null,
}: {
  view: TodayView;
  actions: TodayActions;
  busy?: boolean;
  error?: string | null;
}) {
  const initial = view.phase === "open" && view.pBps !== null ? fromPBps(view.pBps) : null;
  const [side, setSide] = useState<Side>(initial?.side ?? null);
  const [confidence, setConfidence] = useState<number>(initial?.confidence ?? 50);
  // A record that already carries a number was touched on an earlier visit.
  const [confidenceTouched, setConfidenceTouched] = useState(initial !== null);
  const [sentence, setSentence] = useState("");
  const [share, setShare] = useState(false);

  if (view.phase === "no-call") {
    return (
      <Screen>
        <Block>
          <Question>No question today. Open calls can still be revealed.</Question>
        </Block>
        <OpenReveals view={view} actions={actions} busy={busy} />
      </Screen>
    );
  }

  if (view.phase === "closed") {
    return (
      <Screen>
        <Block>
          <Mono style={{ color: color.meta }}>{view.text}</Mono>
        </Block>
        <OpenReveals view={view} actions={actions} busy={busy} />
      </Screen>
    );
  }

  if (view.phase === "sealed") {
    return (
      <Screen>
        <Kicker>{`CALL ${view.roundId}`}</Kicker>
        <Block top={space.lg}>
          <Question>{view.question}</Question>
        </Block>
        <Hairline />
        <Mono>Sealed</Mono>
        <Block top={space.md}>
          <Label>Hidden until you reveal.</Label>
        </Block>
        <OpenReveals view={view} actions={actions} busy={busy} />
      </Screen>
    );
  }

  // --- open for sealing
  const pBps = toPBps(side, confidence);
  const touched = side !== null;
  const blocked = view.blocked;

  return (
    <Screen>
      <Kicker>{`CALL ${view.roundId}`}</Kicker>
      <Block top={space.md}>
        <Question>{view.question}</Question>
        {view.context ? <MonoMeta style={{ marginTop: space.sm }}>{view.context}</MonoMeta> : null}
      </Block>

      <Block>
        <SideConfidence
          side={side}
          confidence={confidence}
          confidenceTouched={confidenceTouched}
          onChange={(nextSide, nextConfidence) => {
            setSide(nextSide);
            if (nextConfidence !== confidence) setConfidenceTouched(true);
            setConfidence(nextConfidence);
          }}
        />
      </Block>

      <Block top={space.xl}>
        <SentenceField
          pBps={pBps}
          sentence={sentence}
          share={share}
          onSentence={setSentence}
          onShare={setShare}
        />
      </Block>

      <Hairline />

      {blocked ? (
        <Block>
          <Body style={{ color: color.ink }}>
            {blocked.kind === "no-sgt" ? blocked.text : blocked.title}
          </Body>
          {blocked.kind === "no-sol" ? (
            <Label style={{ marginTop: space.sm }}>{blocked.body}</Label>
          ) : null}
        </Block>
      ) : (
        <>
          {view.openReveals > 0 ? (
            <Label style={{ marginBottom: space.md }}>
              {`${copy.openReveals(view.openReveals)} — they go out with this signature`}
            </Label>
          ) : null}
          <PrimaryButton
            label="Seal today"
            disabled={!touched || busy}
            onPress={async () => {
              await actions.onSave(pBps, sentence.trim() || undefined, share);
              await actions.onSeal();
            }}
          />
          {/* The wallet sheet is the one moment the app can do nothing but say so. */}
          {busy ? (
            <Label style={{ marginTop: space.sm }}>{copy.waitingForWallet}</Label>
          ) : null}
        </>
      )}

      {error ? (
        <Block top={space.lg}>
          <Text style={[type.monoSmall, { color: color.pencil }]}>{error}</Text>
        </Block>
      ) : null}

      <Block top={space.xl}>
        <MonoMeta>
          No app fees. Network ≈ 0.0001 SOL per day · ≈ 0.002 SOL deposit, refunded when the call
          closes.
        </MonoMeta>
      </Block>
    </Screen>
  );
}

function OpenReveals({
  view,
  actions,
  busy,
}: {
  view: TodayView;
  actions: TodayActions;
  busy: boolean;
}) {
  if (view.openReveals === 0) return null;
  return (
    <Block top={space.xl}>
      <Label>{copy.openReveals(view.openReveals)}</Label>
      <View style={{ marginTop: space.md }}>
        <PrimaryButton label="Reveal" disabled={busy} onPress={() => actions.onSeal()} />
      </View>
      {busy ? <Label style={{ marginTop: space.sm }}>{copy.waitingForWallet}</Label> : null}
    </Block>
  );
}
