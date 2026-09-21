// The input of the day (E11): first the side, then how sure.
//
// Order matters. Asking for a probability first makes people think in numbers they do not have;
// asking for a side first is a judgement anyone can make, and the number then only says how
// firmly. Words come verbatim from docs/03-SCREEN-MAP.md §11.1.
import React from "react";
import { Pressable, Text, View } from "react-native";
import Scale from "./Scale";
import { Label } from "./Type";
import { copy } from "../copy.ts";
import { type Side, clampToStep, toPBps } from "../core/answer.ts";
import { color, space, type } from "../tokens";


export default function SideConfidence({
  side,
  confidence,
  /** False until the player has touched the scale — the label and the seal button depend on it. */
  confidenceTouched = false,
  onSide,
  onConfidence,
}: {
  side: Side;
  confidence: number;
  confidenceTouched?: boolean;
  onSide: (side: Side) => void;
  /**
   * Fires on **every** touch of the scale, even one that lands on the value it already had.
   * That is the point: setting the scale to 50 on purpose has to be possible, and the scale
   * starts at 50 (found while proof-reading the tester guide, 22.09.2026).
   */
  onConfidence: (confidence: number) => void;
}) {
  const pBps = toPBps(side, confidence);
  // Three states, and the last two are not the same thing: a scale nobody has moved must not
  // read as if the player had deliberately chosen 50 (owner, 22.09.2026).
  const label =
    side === null ? copy.pickSideFirst : confidenceTouched ? copy.confidence(pBps) : copy.howSure;
  return (
    <View>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <SideButton label={copy.side.up} active={side === "up"} onPress={() => onSide("up")} />
        <SideButton label={copy.side.down} active={side === "down"} onPress={() => onSide("down")} />
      </View>

      {/* The scale only means something once a side is chosen; until then it is a 50/50. */}
      <View style={{ marginTop: space.xl, opacity: side === null ? 0.45 : 1 }}>
        <Text style={{ ...type.hero, color: color.pencil }}>
          {side === null ? "50" : confidence}
          <Text style={{ ...type.numberLarge, color: color.pencil }}>%</Text>
        </Text>
        <Label style={{ marginTop: space.xs }}>{label}</Label>
        <View style={{ marginTop: space.lg }}>
          <Scale
            mode="input"
            value={side === null ? 50 : confidence}
            onChange={(next) => onConfidence(clampToStep(next))}
          />
        </View>
      </View>
    </View>
  );
}

function SideButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: active ? color.pencil : color.hairline,
        paddingVertical: space.md,
        alignItems: "center",
        minHeight: 48,
        justifyContent: "center",
      }}
    >
      <Text style={{ ...type.body, color: active ? color.pencil : color.ink }}>{label}</Text>
    </Pressable>
  );
}
