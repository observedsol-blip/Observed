// The sentence (E13) and the switch that decides whether anybody else ever sees it (E8).
//
// Default is off. A sentence that stays on the phone costs nothing and risks nothing; a shared
// one is public and permanent, and the subline says exactly that before the switch is touched.
import React from "react";
import { Switch, Text, TextInput, View } from "react-native";
import { Label } from "./Type";
import { copy } from "../copy.ts";
import { SENTENCE_LIMIT, checkSentence } from "../core/sentence.ts";
import { color, space, type } from "../tokens";

export default function SentenceField({
  pBps,
  sentence,
  share,
  onSentence,
  onShare,
}: {
  pBps: number;
  sentence: string;
  share: boolean;
  onSentence: (text: string) => void;
  onShare: (on: boolean) => void;
}) {
  const { bytes, ok } = checkSentence(sentence);
  return (
    <View>
      <Label style={{ color: color.ink }}>{copy.sentence.headingFor(pBps)}</Label>
      <TextInput
        value={sentence}
        onChangeText={onSentence}
        placeholder={copy.sentence.hint}
        placeholderTextColor={color.meta}
        multiline
        style={{
          ...type.body,
          color: color.ink,
          borderBottomWidth: 1,
          borderBottomColor: color.hairline,
          paddingVertical: space.sm,
          marginTop: space.sm,
          minHeight: 44,
        }}
      />
      {/* The counter only appears when it starts to matter. */}
      {bytes > SENTENCE_LIMIT - 20 ? (
        <Text style={{ ...type.monoSmall, color: ok ? color.meta : color.pencil, marginTop: space.xs }}>
          {bytes} / {SENTENCE_LIMIT}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg }}>
        <Switch
          value={share}
          onValueChange={onShare}
          trackColor={{ false: color.hairline, true: color.pencil }}
          thumbColor={color.ink}
        />
        <View style={{ flex: 1 }}>
          <Label style={{ color: color.ink }}>{copy.sentence.share}</Label>
          <Text style={{ ...type.monoSmall, color: color.meta, marginTop: space.xs }}>
            {copy.sentence.shareHint}
          </Text>
        </View>
      </View>
    </View>
  );
}
