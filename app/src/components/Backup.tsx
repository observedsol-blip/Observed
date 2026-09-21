// Backup and restore of the season secret (E2), in Settings.
//
// The honest half of a decision: the secret is random and lives on this phone, so an uninstall
// forfeits answers that are still open. This is the way out — and the copy says both what it
// buys and what happens without it. Strings are proposed in docs/COPY-NEUE-TEILE.md §D and are
// NOT yet approved; they live in copy.ts so a single edit changes them everywhere.
import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import Hairline from "./Hairline";
import PrimaryButton from "./PrimaryButton";
import { Block, Body, Kicker, Label } from "./Type";
import { copy } from "../copy.ts";
import { color, space, type } from "../tokens";

export type BackupActions = {
  onExport: () => Promise<string | null>;
  onImport: (hex: string) => Promise<{ recovered: number[]; lost: number[] }>;
};

export default function Backup({ actions }: { actions: BackupActions | null }) {
  const [key, setKey] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState<string | null>(null);

  if (!actions) return null;

  const show = async () => {
    const secret = await actions.onExport();
    setKey(secret);
    if (secret) {
      await Clipboard.setStringAsync(secret);
      setNote(copy.backup.copied);
    }
  };

  const restore = async () => {
    try {
      const { recovered, lost } = await actions.onImport(paste);
      setPaste("");
      setNote(
        [copy.backup.restored(recovered.length), lost.length > 0 ? copy.backup.lost(lost) : null]
          .filter(Boolean)
          .join(" "),
      );
    } catch {
      setNote(copy.backup.bad);
    }
  };

  return (
    <View>
      <Hairline />
      <Kicker>{copy.backup.heading}</Kicker>
      <Block top={space.md}>
        <Body>{copy.backup.body}</Body>
      </Block>
      {key ? (
        <Block top={space.md}>
          <Text selectable style={[type.monoSmall, { color: color.ink }]}>
            {key}
          </Text>
        </Block>
      ) : null}
      <Block top={space.md}>
        <PrimaryButton label={copy.backup.copyButton} onPress={show} />
      </Block>

      <Block top={space.xl}>
        <Kicker>{copy.backup.restoreHeading}</Kicker>
        <Body style={{ marginTop: space.sm }}>{copy.backup.restoreBody}</Body>
        <TextInput
          value={paste}
          onChangeText={setPaste}
          placeholder={copy.backup.placeholder}
          placeholderTextColor={color.meta}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            ...type.monoSmall,
            color: color.ink,
            borderBottomWidth: 1,
            borderBottomColor: color.hairline,
            paddingVertical: space.sm,
            marginTop: space.md,
          }}
        />
        <View style={{ marginTop: space.md }}>
          <PrimaryButton label="Restore" disabled={paste.trim().length === 0} onPress={restore} />
        </View>
      </Block>

      {note ? (
        <Block top={space.md}>
          <Label style={{ color: color.meta }}>{note}</Label>
        </Block>
      ) : null}
    </View>
  );
}
