import React, { useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  Text,
  View,
} from 'react-native';
import { color, space, type } from '../tokens';
import { TICKS } from '../mock';

/**
 * The 21-tick scale — ONE component, two uses.
 *
 *   mode="input"        draggable cursor, snaps to the 21 positions (5% steps)
 *   mode="distribution" the crowd at the SAME 21 coordinates, own bucket in
 *                       pencil, mean as a line
 *
 * Both modes derive every x from `xFor()`, so a value sits at the identical
 * pixel in either mode.
 */

const TRACK_HEIGHT = 56; // ≥48 dp hit area for the drag
const BARS_HEIGHT = 96;
const TICK_HEIGHT = 10;
const CURSOR_HEIGHT = 28;
const EDGE = space.sm;

function snap(value: number): number {
  const clamped = Math.max(0, Math.min(100, value));
  return Math.round(clamped / 5) * 5;
}

function useTrackWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  return { width, onLayout };
}

/** x of a 0–100 value inside a track of `width`. Shared by both modes. */
function xFor(value: number, width: number): number {
  const usable = Math.max(0, width - EDGE * 2);
  return EDGE + (value / 100) * usable;
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

function StepButton({
  label,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        minWidth: 64,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: color.hairline,
      }}
    >
      <Text style={{ ...type.mono, color: color.ink }}>{label}</Text>
    </Pressable>
  );
}

function ScaleInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const { width, onLayout } = useTrackWidth();
  const widthRef = useRef(0);
  widthRef.current = width;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const w = widthRef.current;
          if (w <= 0) return;
          const usable = Math.max(1, w - EDGE * 2);
          onChange(snap(((e.nativeEvent.locationX - EDGE) / usable) * 100));
        },
        onPanResponderMove: (e) => {
          const w = widthRef.current;
          if (w <= 0) return;
          const usable = Math.max(1, w - EDGE * 2);
          onChange(snap(((e.nativeEvent.locationX - EDGE) / usable) * 100));
        },
      }),
    [onChange],
  );

  const cursorX = xFor(value, width);

  return (
    <View>
      <View
        onLayout={onLayout}
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Probability"
        accessibilityValue={{ min: 0, max: 100, now: value, text: `${value}%` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange(snap(value + 5));
          if (e.nativeEvent.actionName === 'decrement') onChange(snap(value - 5));
        }}
        style={{ height: TRACK_HEIGHT, justifyContent: 'center' }}
      >
        {/* baseline */}
        <View
          style={{
            position: 'absolute',
            left: EDGE,
            right: EDGE,
            top: TRACK_HEIGHT / 2,
            height: 1,
            backgroundColor: color.hairline,
          }}
        />
        {width > 0 &&
          TICKS.map((t) => (
            <View
              key={t}
              style={{
                position: 'absolute',
                left: xFor(t, width),
                top: TRACK_HEIGHT / 2 - (t % 25 === 0 ? TICK_HEIGHT : TICK_HEIGHT / 2),
                width: 1,
                height: t % 25 === 0 ? TICK_HEIGHT : TICK_HEIGHT / 2,
                backgroundColor: color.meta,
              }}
            />
          ))}
        {width > 0 && (
          <View
            style={{
              position: 'absolute',
              left: cursorX,
              top: TRACK_HEIGHT / 2 - CURSOR_HEIGHT,
              width: 2,
              height: CURSOR_HEIGHT + 6,
              backgroundColor: color.pencil,
            }}
          />
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>
        <Text style={{ ...type.monoSmall, color: color.meta }}>0</Text>
        <Text style={{ ...type.monoSmall, color: color.meta }}>50</Text>
        <Text style={{ ...type.monoSmall, color: color.meta }}>100</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.lg }}>
        <StepButton
          label="−5"
          accessibilityLabel="Lower by 5"
          onPress={() => onChange(snap(value - 5))}
        />
        <StepButton
          label="+5"
          accessibilityLabel="Raise by 5"
          onPress={() => onChange(snap(value + 5))}
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Distribution                                                        */
/* ------------------------------------------------------------------ */

function ScaleDistribution({
  buckets,
  ownValue,
  mean,
}: {
  buckets: number[];
  ownValue: number;
  mean: number;
}) {
  const { width, onLayout } = useTrackWidth();
  const max = Math.max(1, ...buckets);
  const ownIndex = Math.round(ownValue / 5);

  return (
    <View>
      <View onLayout={onLayout} style={{ height: BARS_HEIGHT, justifyContent: 'flex-end' }}>
        {width > 0 &&
          buckets.map((count, i) => {
            const h = (count / max) * (BARS_HEIGHT - 8);
            const isOwn = i === ownIndex;
            return (
              <View
                key={TICKS[i]}
                style={{
                  position: 'absolute',
                  left: xFor(TICKS[i], width) - 3,
                  bottom: 0,
                  width: 6,
                  height: Math.max(count > 0 ? 2 : 0, h),
                  backgroundColor: isOwn ? color.pencil : color.meta,
                }}
              />
            );
          })}
        {width > 0 && (
          <View
            style={{
              position: 'absolute',
              left: xFor(mean, width),
              bottom: 0,
              width: 1,
              height: BARS_HEIGHT,
              backgroundColor: color.ink,
            }}
          />
        )}
        <View
          style={{
            position: 'absolute',
            left: EDGE,
            right: EDGE,
            bottom: 0,
            height: 1,
            backgroundColor: color.hairline,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>
        <Text style={{ ...type.monoSmall, color: color.meta }}>0</Text>
        <Text style={{ ...type.monoSmall, color: color.meta }}>50</Text>
        <Text style={{ ...type.monoSmall, color: color.meta }}>100</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */

export type ScaleProps =
  | { mode: 'input'; value: number; onChange: (next: number) => void }
  | { mode: 'distribution'; buckets: number[]; ownValue: number; mean: number };

export default function Scale(props: ScaleProps) {
  if (props.mode === 'input') {
    return <ScaleInput value={props.value} onChange={props.onChange} />;
  }
  return (
    <ScaleDistribution buckets={props.buckets} ownValue={props.ownValue} mean={props.mean} />
  );
}
