// First start — the one screen before anything of this player's own exists (Figma 11, 131:8).
//
// A wordmark, one line, one button. Nothing is read, nothing is asked for, no wallet is opened:
// on a fresh install there is nothing to read and nobody to ask. `Continue` leads to the worked
// example, and after that the app is in normal operation for good.
import React from "react";
import { View } from "react-native";
import Screen from "../components/Screen";
import PrimaryButton from "../components/PrimaryButton";
import { Block, Question, Wordmark } from "../components/Type";
import { copy } from "../copy.ts";
import { space } from "../tokens";

export default function FirstStart({ onContinue }: { onContinue: () => void }) {
  return (
    <Screen>
      <Wordmark>{copy.firstStart.wordmark}</Wordmark>

      <Block top={space.xxl}>
        <Question>{copy.firstStart.intro}</Question>
      </Block>

      <View style={{ flex: 1 }} />

      <Block top={space.xxl}>
        <PrimaryButton label={copy.firstStart.continueButton} onPress={onContinue} />
      </Block>
    </Screen>
  );
}
