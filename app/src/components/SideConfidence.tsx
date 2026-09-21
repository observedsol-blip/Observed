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
import { color, space, type } from "../tokens";

export type Side = "up" | "down" | null;

/** p_bps for a side and a confidence in percent: Up 80 → 8000, Down 80 → 2000. */
export function toPBps(side: Side, confidence: number): number {
  if (side === null) return 5_000;
  return side === "up" ? confidence * 100 : 10_000 - confidence * 100;
}

/** The other direction, for a record that was already sealed. */
export function fromPBps(pBps: number): { side: Side; confidence: number } {
  if (pBps === 5_000) return { side: null, confidence: 50 };
  const up = pBps > 5_000;
  return { side: up ? "up" : "down", confidence: (up ? pBps : 10_000 - pBps) / 100 };
}

export default function SideConfidence({
  side,
  confidence,
  /** False until the player has moved the scale — the label depends on it. */
  confidenceTouched = false,
  onChange,
}: {
  side: Side;
  confidence: number;
  confidenceTouched?: boolean;
  onChange: (side: Side, confidence: number) => void;
}) {
  const pBps = toPBps(side, confidence);
  // Three states, and the last two are not the same thing: a scale nobody has moved must not
  // read as if the player had deliberately chosen 50 (owner, 22.09.2026).
  const label =
    side === null ? copy.pickSideFirst : confidenceTouched ? copy.confidence(pBps) : copy.howSure;
  return (
    <View>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <SideButton label={copy.side.up} active={side === "up"} onPress={() => onChange("up", confidence)} />
        <SideButton label={copy.side.down} active={side === "down"} onPress={() => onChange("down", confidence)} />
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
            onChange={(next) => onChange(side ?? "up", clampToStep(next))}
          />
        </View>
      </View>
    </View>
  );
}

/** The program only accepts steps of 5 percentage points, and never below 50 on the chosen
 *  side — 45 % Up is 55 % Down, and saying it twice would be two names for one answer. */
function clampToStep(percent: number): number {
  const stepped = Math.round(percent / 5) * 5;
  return Math.min(100, Math.max(50, stepped));
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
