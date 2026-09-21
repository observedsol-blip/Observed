// Today — draws what the session says, decides nothing itself.
//
// Every string comes from docs/03-SCREEN-MAP.md (§2 for the states, §11 for the input), and
// every state comes from `TodayView`, which is derived from the chain plus the local record.
// The screen has exactly one job beyond drawing: it must not let a seal start before the player
// has decided BOTH halves — the side and how sure. A 50/50 nobody chose is not an answer, and
// until 22.09.2026 a tap on `Up` alone was enough to arm the button (`core/answer.ts`).
import React, { useState } from "react";
import { Text, View } from "react-native";
import Screen from "../components/Screen";
import Hairline from "../components/Hairline";
import PrimaryButton from "../components/PrimaryButton";
import SentenceField from "../components/SentenceField";
import SideConfidence from "../components/SideConfidence";
import { type Side, canSeal, fromPBps, toPBps } from "../core/answer.ts";
import { Block, Body, Kicker, Label, Mono, MonoMeta, Question } from "../components/Type";
import type { TodayView } from "../core/day.ts";
import { copy } from "../copy.ts";
import { color, space, type } from "../tokens";

export type ReminderOffer = {
  offer: boolean;
  onEnable: () => Promise<{ granted: boolean; scheduled: number }> | void;
  onDecline: () => Promise<void> | void;
};

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
  reminders = null,
}: {
  view: TodayView;
  actions: TodayActions;
  busy?: boolean;
  error?: string | null;
  /** E3: shown only after something has actually been sealed, and only once. */
  reminders?: ReminderOffer | null;
}) {
  const initial = view.phase === "open" && view.pBps !== null ? fromPBps(view.pBps) : null;
  const [side, setSide] = useState<Side>(initial?.side ?? null);
  const [confidence, setConfidence] = useState<number>(initial?.confidence ?? 50);
  // A record that already carries a side was decided on an earlier visit. A record of exactly
  // 50/50 does not count: it carries no side, so the scale has to be set again — otherwise the
  // very hole this rule closes would reopen for anyone who once sealed a 50.
  const [confidenceTouched, setConfidenceTouched] = useState(initial?.side != null);
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
        {reminders?.offer ? <RemindOffer reminders={reminders} /> : null}
        <OpenReveals view={view} actions={actions} busy={busy} />
      </Screen>
    );
  }

  // --- open for sealing
  const pBps = toPBps(side, confidence);
  // Both halves have to be a decision: a side AND a confidence somebody actually set.
  const ready = canSeal({ side, confidenceTouched });
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
            <Block top={0}>
              <Label>{copy.openReveals(view.openReveals)}</Label>
              <Label style={{ marginTop: space.xs, marginBottom: space.md }}>
                {copy.revealsRideAlong}
              </Label>
            </Block>
          ) : null}
          <PrimaryButton
            label="Seal today"
            disabled={!ready || busy}
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

/** The offer, after the first seal. Tapping it is the only thing that may ask for permission. */
function RemindOffer({ reminders }: { reminders: ReminderOffer }) {
  return (
    <Block top={space.xl}>
      <PrimaryButton label={copy.remindMe} onPress={() => void reminders.onEnable()} />
      <Label
        onPress={() => void reminders.onDecline()}
        style={{ marginTop: space.md, color: color.meta, textDecorationLine: "underline" }}
      >
        {copy.notNow}
      </Label>
    </Block>
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
