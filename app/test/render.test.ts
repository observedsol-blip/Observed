// Do the screens actually draw? Ten tests, and none of them is about beauty.
//
// Everything else in this folder tests the views — the strings and numbers a screen is handed.
// Nothing tested that the screen puts them on the glass. The RevealSequence refactor on
// 22.09.2026 touched three screens at once, and not one test could have noticed a missing
// button. That is the same gap the E2E matrix closed for transactions, one floor up.
//
// What these do NOT claim: layout, styling, gestures, fonts. `react-native` is a stand-in here
// (test/support/react-native.mjs), so a component is a name in a tree, not a pixel. The device
// is where that is settled.
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import TestRenderer, { type ReactTestRenderer } from "react-test-renderer";
import Today from "../src/screens/Today.tsx";
import Result from "../src/screens/Result.tsx";
import Record from "../src/screens/Record.tsx";
import FirstStart from "../src/screens/FirstStart.tsx";
import SampleBanner from "../src/components/SampleBanner.tsx";
import { mockResult, mockToday } from "../src/mockViews.ts";
import { recordView } from "../src/core/record.ts";
import { copy } from "../src/copy.ts";

// React 19 renders inside `act` or not at all: without it `toJSON()` is null and every
// assertion below would pass for the wrong reason.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function render(element: React.ReactElement) {
  let tree!: ReactTestRenderer;
  TestRenderer.act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

/** Every string the screen put on the glass, in tree order. */
function texts(element: React.ReactElement): string[] {
  const tree = render(element);
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string" || typeof node === "number") {
      out.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const n = node as { children?: unknown; props?: { children?: unknown } } | null;
    if (!n) return;
    if (n.children) walk(n.children);
    else if (n.props?.children) walk(n.props.children);
  };
  walk(tree.toJSON());
  return out;
}

const shows = (element: React.ReactElement, needle: string) =>
  texts(element).some((t) => t.includes(needle));

const NOOP = {
  onSave: async () => {},
  onSeal: async () => {},
  onConnect: async () => {},
  // The quiet side path only appears when the screen is handed something to call.
  onRevealOnly: async () => {},
};

/* ---------------------------------------------------------------- Today */

test("Today, open: the question, the deposit line and the seal button are on the screen", () => {
  const view = mockToday("open");
  const el = React.createElement(Today, { view, busy: false, error: null, reminders: null, actions: NOOP });
  assert.ok(shows(el, "Will SOL be higher"), "the question");
  assert.ok(shows(el, copy.button.sealToday), "the button that costs an approval");
  assert.ok(shows(el, "No stakes."), "what the deposit is, BEFORE the wallet sheet");
  assert.ok(shows(el, copy.pickSideFirst), "and the state the input starts in");
});

test("Today, open: the cost line carries the corrected fee, not the old one", () => {
  const el = React.createElement(Today, {
    view: mockToday("open"),
    busy: false,
    error: null,
    reminders: null,
    actions: NOOP,
  });
  assert.ok(shows(el, "0.000005 SOL per day"), "the measured fee");
  assert.equal(shows(el, "0.0001 SOL per day"), false, "and not the twentyfold one");
});

test("Today, sealed: nothing of the answer is on the screen", () => {
  // The whole point of a sealed call: the app knows the number and does not show it.
  const el = React.createElement(Today, {
    view: mockToday("sealed"),
    busy: false,
    error: null,
    reminders: null,
    actions: NOOP,
  });
  assert.ok(shows(el, "Sealed"));
  assert.ok(shows(el, "Hidden until you reveal."));
  assert.equal(shows(el, "% sure"), false, "no confidence");
  assert.equal(shows(el, copy.button.sealToday), false, "and nothing left to seal");
});

test("Today, open with yesterday pending: the reveal stands above the question", () => {
  const base = mockToday("open");
  assert.equal(base.phase, "open");
  if (base.phase !== "open") return;
  const view = { ...base, openReveals: 1, pending: mockResult("called") };
  const el = React.createElement(Today, { view, busy: false, error: null, reminders: null, actions: NOOP });
  assert.ok(shows(el, "Yesterday you wrote:"), "yesterday is there");
  assert.ok(shows(el, copy.faceIt), "behind the button that faces it");
  assert.ok(shows(el, copy.revealOnly), "and the quiet way out is offered");
  assert.equal(shows(el, "You called the side."), false, "but the outcome is not given away");
});

/* ---------------------------------------------------------------- Result */

test("Result, stage 1: the sentence and Face it, and nothing of the outcome", () => {
  const el = React.createElement(Result, { view: mockResult("called") });
  assert.ok(shows(el, "Yesterday you wrote:"));
  assert.ok(shows(el, copy.faceIt));
  assert.equal(shows(el, "You called the side."), false, "the verdict waits for the tap");
  assert.equal(shows(el, "% sure"), false, "and so does the number");
});

test("Result, stage 2: facing it shows the verdict and the sealed answer", () => {
  const tree = render(React.createElement(Result, { view: mockResult("called") }));
  const button = tree.root.findAll(
    (n: { props?: Record<string, unknown> }) =>
      n.props?.accessibilityRole === "button" || typeof n.props?.onPress === "function",
  );
  assert.ok(button.length > 0, "there is something to press");
  TestRenderer.act(() => {
    (button[0].props.onPress as () => void)();
  });
  const after: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") return void after.push(node);
    if (Array.isArray(node)) return void node.forEach(walk);
    const n = node as { children?: unknown } | null;
    if (n?.children) walk(n.children);
  };
  walk(tree.toJSON());
  assert.ok(after.some((t) => t.includes("You called the side.")), "the verdict");
  assert.ok(after.some((t) => t.includes("% sure")), "and the number it was sealed with");
});

test("Result with the memory question: the number is not on the screen before the question", () => {
  const view = { ...mockResult("called")!, sentence: null, memoryAsked: false };
  const el = React.createElement(Result, { view, memoryQuestion: true });
  assert.ok(shows(el, "You sealed: Up."), "the side may be shown");
  assert.equal(shows(el, "80% sure"), false, "the number may not");
});

test("Result without the memory question: the sealed answer carries its number", () => {
  const view = { ...mockResult("called")!, sentence: null };
  const el = React.createElement(Result, { view, memoryQuestion: false });
  assert.ok(shows(el, "You sealed: Up, 80% sure."));
});

test("Result, nothing yet: the waiting line, and no second wording", () => {
  // One state, two screens: when Today shows yesterday, Result is handed the same call and the
  // line Today uses. Only a truly empty evening says "Nothing revealed yet."
  const empty = React.createElement(Result, { view: null });
  assert.ok(shows(empty, copy.nothingRevealed));

  const pending = React.createElement(Result, {
    view: null,
    pending: mockResult("called"),
    waiting: copy.revealsRideAlong,
  });
  assert.ok(shows(pending, copy.revealsRideAlong), "it says it is not on chain yet");
  assert.equal(shows(pending, copy.nothingRevealed), false, "and does not contradict Today");
});

/* ---------------------------------------------------------------- Record and first start */

test("Record: the side record is there and no Brier is", () => {
  const view = recordView({
    now: 1_790_000_000,
    calendar: [],
    rounds: new Map(),
    entries: new Map(),
    records: [],
    player: null,
  });
  const el = React.createElement(Record, { view });
  assert.ok(shows(el, copy.headings.sideRecord));
  assert.ok(shows(el, "calls"), "the side record line");
  assert.equal(shows(el, copy.headings.seasonScore), false, "the season score left on 22.09.");
});

test("First start: the intro, then the example under its banner", () => {
  const intro = React.createElement(FirstStart, { onContinue: () => {} });
  assert.ok(shows(intro, copy.firstStart.wordmark));
  assert.ok(shows(intro, copy.firstStart.intro));
  assert.ok(shows(intro, copy.firstStart.continueButton));

  const banner = React.createElement(SampleBanner, { text: "Example" });
  assert.ok(shows(banner, "Example"), "and the example says what it is");
});
