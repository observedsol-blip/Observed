import React, { useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  Text,
  View,
} from 'react-native';
import { color, space, type } from '../tokens';
import {
  DISTRIBUTION_TICKS,
  INPUT_LABELLED,
  INPUT_MIN,
  INPUT_TICKS,
  snapInput,
  valueAtInput,
  xFor as xForValue,
  xForInput as xForInputValue,
} from '../core/scale.ts';

/**
 * One component, two scales — and since 22.09.2026 they are deliberately NOT the same.
 *
 *   mode="input"        how sure you are, 50–100 in 5-point steps: 11 positions,
 *                       labels 50 · 75 · 100
 *   mode="distribution" what the crowd answered, 0–100 in 5-point steps: 21 positions,
 *                       own bucket in pencil, mean as a line
 *
 * The old rule was "input and distribution share one geometry", and it was wrong. The input
 * cannot go below 50: a side is chosen first, and 45 % Up is 55 % Down — two names for one
 * answer (SideConfidence.tsx). Drawing that on a 0–100 track left the whole left half dead and
 * invited a gesture the code then silently undid. E11 asks for exactly 50–100, so the input now
 * draws what it accepts. The distribution keeps 0–100, because the crowd's probabilities really
 * do span the whole range (owner decision, 22.09.2026).
 */

const TRACK_HEIGHT = 56; // ≥48 dp hit area for the drag
const BARS_HEIGHT = 96;
const TICK_HEIGHT = 10;
const CURSOR_HEIGHT = 28;
const EDGE = space.sm;

function useTrackWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  return { width, onLayout };
}

/** The geometry lives in core/scale.ts; these two only bind the edge padding. */
const xFor = (value: number, width: number) => xForValue(value, width, EDGE);
const xForInput = (value: number, width: number) => xForInputValue(value, width, EDGE);

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
          onChange(snapInput(valueAtInput(e.nativeEvent.locationX, w, EDGE)));
        },
        onPanResponderMove: (e) => {
          const w = widthRef.current;
          if (w <= 0) return;
          onChange(snapInput(valueAtInput(e.nativeEvent.locationX, w, EDGE)));
        },
      }),
    [onChange],
  );

  const cursorX = xForInput(value, width);

  return (
    <View>
      <View
        onLayout={onLayout}
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="How sure"
        accessibilityValue={{ min: INPUT_MIN, max: 100, now: value, text: `${value}%` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange(snapInput(value + 5));
          if (e.nativeEvent.actionName === 'decrement') onChange(snapInput(value - 5));
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
          INPUT_TICKS.map((t) => {
            const long = INPUT_LABELLED.includes(t);
            return (
              <View
                key={t}
                style={{
                  position: 'absolute',
                  left: xForInput(t, width),
                  top: TRACK_HEIGHT / 2 - (long ? TICK_HEIGHT : TICK_HEIGHT / 2),
                  width: 1,
                  height: long ? TICK_HEIGHT : TICK_HEIGHT / 2,
                  backgroundColor: color.meta,
                }}
              />
            );
          })}
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
        {INPUT_LABELLED.map((t) => (
          <Text key={t} style={{ ...type.monoSmall, color: color.meta }}>
            {t}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.lg }}>
        <StepButton
          label="−5"
          accessibilityLabel="Lower by 5"
          onPress={() => onChange(snapInput(value - 5))}
        />
        <StepButton
          label="+5"
          accessibilityLabel="Raise by 5"
          onPress={() => onChange(snapInput(value + 5))}
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
                key={DISTRIBUTION_TICKS[i]}
                style={{
                  position: 'absolute',
                  left: xFor(DISTRIBUTION_TICKS[i], width) - 3,
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
