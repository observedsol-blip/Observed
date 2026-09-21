// The backup code (E2), in Settings — and the restore screen after a reinstall.
//
// Every string is the owner's, approved 21.09.2026. The word is "backup code": never "key",
// never "recovery". A field that asks for a key or a recovery phrase is exactly the pattern
// people are robbed with, and an app that trains it has no business asking for trust.
//
// That is also why the paste field refuses anything that looks like a wallet phrase (12 or 24
// words) with the warning instead of a format error — the rule lives in core/secret.ts, so it
// holds even if this screen is ever rewritten.
import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import Hairline from "./Hairline";
import PrimaryButton from "./PrimaryButton";
import { Block, Body, Kicker, Label } from "./Type";
import { copy } from "../copy.ts";
import { looksLikeSeedPhrase } from "../core/secret.ts";
import { color, space, type } from "../tokens";

export type BackupActions = {
  onExport: () => Promise<string | null>;
  onImport: (code: string) => Promise<{ recovered: number[]; lost: number[] }>;
};

export default function Backup({
  actions,
  /** Shown as the restore screen instead of the settings row. */
  restoreMode = false,
  onSkip,
}: {
  actions: BackupActions | null;
  restoreMode?: boolean;
  onSkip?: () => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  if (!actions) return null;

  const show = async () => {
    const secret = await actions.onExport();
    setCode(secret);
    if (secret) {
      await Clipboard.setStringAsync(secret);
      setNote(copy.backup.copied);
    }
  };

  const onPaste = (text: string) => {
    setPaste(text);
    // The warning appears while typing, not after pressing Restore: by then the phrase would
    // already be in the field, and telling someone afterwards is too late to matter.
    setWarning(looksLikeSeedPhrase(text) ? copy.backup.notYourPhrase : null);
  };

  const restore = async () => {
    if (looksLikeSeedPhrase(paste)) {
      setWarning(copy.backup.notYourPhrase);
      return;
    }
    try {
      const { recovered, lost } = await actions.onImport(paste);
      setPaste("");
      setNote(
        `${recovered.length} restored${lost.length > 0 ? `, ${lost.length} could not be opened` : ""}.`,
      );
    } catch (e) {
      setNote(e instanceof Error && e.name === "SeedPhrasePasted" ? null : copy.backup.bad);
      if (e instanceof Error && e.name === "SeedPhrasePasted") setWarning(copy.backup.notYourPhrase);
    }
  };

  const field = (
    <>
      <TextInput
        value={paste}
        onChangeText={onPaste}
        placeholder={copy.backup.placeholder}
        placeholderTextColor={color.meta}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        style={{
          ...type.monoSmall,
          color: color.ink,
          borderBottomWidth: 1,
          borderBottomColor: warning ? color.pencil : color.hairline,
          paddingVertical: space.sm,
          marginTop: space.md,
        }}
      />
      {warning ? (
        <Body style={{ color: color.pencil, marginTop: space.sm }}>{warning}</Body>
      ) : null}
      <View style={{ marginTop: space.md }}>
        <PrimaryButton
          label={copy.backup.restoreButton}
          disabled={paste.trim().length === 0 || warning !== null}
          onPress={restore}
        />
      </View>
    </>
  );

  if (restoreMode) {
    return (
      <View>
        <Kicker>{copy.backup.restoreTitle}</Kicker>
        <Block top={space.md}>
          <Body>{copy.backup.restoreBody}</Body>
        </Block>
        {field}
        {onSkip ? (
          <Block top={space.lg}>
            <Label onPress={onSkip} style={{ color: color.meta, textDecorationLine: "underline" }}>
              {copy.backup.skip}
            </Label>
          </Block>
        ) : null}
        {note ? (
          <Block top={space.md}>
            <Label style={{ color: color.meta }}>{note}</Label>
          </Block>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <Hairline />
      <Kicker>{copy.backup.line}</Kicker>
      <Block top={space.xs}>
        <Label style={{ color: color.meta }}>{copy.backup.sub}</Label>
      </Block>
      {code ? (
        <Block top={space.md}>
          <Text selectable style={[type.monoSmall, { color: color.ink }]}>
            {code}
          </Text>
        </Block>
      ) : null}
      <Block top={space.md}>
        <PrimaryButton label={copy.backup.copyButton} onPress={show} />
      </Block>
      {note ? (
        <Block top={space.md}>
          <Body style={{ color: color.meta }}>{note}</Body>
        </Block>
      ) : null}

      <Block top={space.xl}>
        <Kicker>{copy.backup.restoreTitle}</Kicker>
        <Body style={{ marginTop: space.sm }}>{copy.backup.restoreBody}</Body>
        {field}
      </Block>
    </View>
  );
}
