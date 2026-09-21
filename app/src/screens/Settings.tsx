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
import {
  RECORD_STATES,
  RecordState,
  settings,
} from '../mock';

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

/** Settings stub (03 §7) plus the dev-only mock state control. */
export default function Settings({
  backup = null,
  todayState,
  onTodayState,
  resultState,
  onResultState,
  recordState,
  onRecordState,
}: {
  /** null while the app draws design states — there is no secret to export then. */
  backup?: BackupActions | null;
  todayState: DesignState;
  onTodayState: (s: DesignState) => void;
  resultState: ResultDesignState;
  onResultState: (s: ResultDesignState) => void;
  recordState: RecordState;
  onRecordState: (s: RecordState) => void;
}) {
  return (
    <Screen>
      <Kicker>Wallet</Kicker>
      <Block top={space.sm}>
        <MonoMeta>{settings.wallet}</MonoMeta>
        <MonoMeta style={{ marginTop: space.xs }}>{settings.genesis}</MonoMeta>
        <MonoMeta style={{ marginTop: space.xs }}>{settings.genesisMint}</MonoMeta>
      </Block>

      <Block>
        <Kicker>Authorities</Kicker>
        <View style={{ marginTop: space.sm, gap: space.xs }}>
          <MonoMeta>{settings.authorityCalendar}</MonoMeta>
          <MonoMeta>{settings.authorityPause}</MonoMeta>
          <MonoMeta>{settings.authorityUpgrade}</MonoMeta>
        </View>
      </Block>

      <Hairline />

      <MonoMeta>{settings.cost}</MonoMeta>
      <Block top={space.lg}>
        <Body>{settings.ownership}</Body>
        <Body style={{ marginTop: space.sm }}>{settings.noCharge}</Body>
      </Block>

      <Block>
        <MonoMeta>{settings.pushTimes}</MonoMeta>
        <MonoMeta style={{ marginTop: space.xs }}>{settings.backup}</MonoMeta>
      </Block>

      <Block>
        <Kicker>Publication</Kicker>
        <Body style={{ marginTop: space.sm }}>{settings.publication}</Body>
      </Block>

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

      <Block top={space.lg}>
        <Label>Record</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          {RECORD_STATES.map((s) => (
            <Choice
              key={s.key}
              label={s.label}
              selected={s.key === recordState}
              onPress={() => onRecordState(s.key)}
            />
          ))}
        </View>
      </Block>
    </Screen>
  );
}
