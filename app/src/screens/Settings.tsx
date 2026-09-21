// Settings (03 §7) — every address on this screen is read from an account, none from a fixture.
//
// Until 22.09.2026 the wallet, the mint and all three authorities were invented strings in
// `app/src/mock.ts`. On a screen whose whole job is "here is who could change the rules", that
// was the worst possible place for made-up data.
import React from 'react';
import { Pressable, View } from 'react-native';
import Screen from '../components/Screen';
import Hairline from '../components/Hairline';
import { Block, Body, Kicker, Label, MonoMeta } from '../components/Type';
import { color, space } from '../tokens';
import Backup, { type BackupActions } from '../components/Backup';
import {
  RESULT_STATES,
  TODAY_STATES,
  type DesignState,
  type ResultDesignState,
} from '../mockViews';
import { type SettingsView, settingsCopy, shortAddress } from '../core/settings.ts';
import { copy } from '../copy.ts';

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{
        minHeight: 48,
        justifyContent: 'center',
        paddingHorizontal: space.md,
        borderWidth: 1,
        borderColor: selected ? color.ink : color.hairline,
      }}
    >
      <Label style={{ color: selected ? color.ink : color.meta }}>{label}</Label>
    </Pressable>
  );
}

/** An address row: the label from §7, the address as data. `—` when nothing could be read. */
function Address({ label, value }: { label: string; value: string | null }) {
  return <MonoMeta>{`${label} · ${value === null ? '—' : shortAddress(value)}`}</MonoMeta>;
}

export default function Settings({
  view,
  backup = null,
  todayState,
  onTodayState,
  resultState,
  onResultState,
}: {
  /** null while the app draws design states: there is no chain to ask then. */
  view: SettingsView | null;
  /** null while the app draws design states — there is no secret to export then. */
  backup?: BackupActions | null;
  todayState: DesignState;
  onTodayState: (s: DesignState) => void;
  resultState: ResultDesignState;
  onResultState: (s: ResultDesignState) => void;
}) {
  return (
    <Screen>
      <Kicker>Wallet</Kicker>
      <Block top={space.sm}>
        <Address label="Wallet" value={view?.wallet ?? null} />
        {view?.genesis ? (
          <MonoMeta style={{ marginTop: space.xs }}>{view.genesis}</MonoMeta>
        ) : null}
        <View style={{ marginTop: space.xs }}>
          <Address label="Mint" value={view?.sgtMint ?? null} />
        </View>
      </Block>

      <Block>
        <Kicker>Authorities</Kicker>
        <View style={{ marginTop: space.sm, gap: space.xs }}>
          <Address label="calendar" value={view?.authorities.calendar ?? null} />
          <Address label="pause" value={view?.authorities.pause ?? null} />
          <Address label="upgrade" value={view?.authorities.upgrade ?? null} />
        </View>
      </Block>

      <Hairline />

      <MonoMeta>{view?.cost ?? ''}</MonoMeta>
      <Block top={space.lg}>
        <Body>{settingsCopy.ownership}</Body>
        <Body style={{ marginTop: space.sm }}>{settingsCopy.noCharge}</Body>
      </Block>

      {view ? (
        <Block>
          <Kicker>{copy.headings.reminders}</Kicker>
          <MonoMeta style={{ marginTop: space.xs }}>
            {`${view.push.outcome} · ${view.push.lastHour}`}
          </MonoMeta>
        </Block>
      ) : null}

      <Backup actions={backup} />

      <Hairline />

      {/* ---------------------------------------------------------------- */}
      {/* DEV / MOCK ONLY — not product copy, not part of Today/Result.     */}
      {/* ---------------------------------------------------------------- */}
      <Kicker>Mock state · development only</Kicker>
      <Block top={space.md}>
        <Label>Today</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          {TODAY_STATES.map((s) => (
            <Choice
              key={s.key}
              label={s.label}
              selected={s.key === todayState}
              onPress={() => onTodayState(s.key)}
            />
          ))}
        </View>
      </Block>

      <Block top={space.lg}>
        <Label>Result</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          {RESULT_STATES.map((s) => (
            <Choice
              key={s.key}
              label={s.label}
              selected={s.key === resultState}
              onPress={() => onResultState(s.key)}
            />
          ))}
        </View>
      </Block>
    </Screen>
  );
}
