// A stand-in for `react-native`, so the screens can be rendered in plain node.
//
// Why a stand-in at all: react-native's own index.js is Flow-typed, and node cannot parse it
// ("Unexpected token 'typeof'"). The usual answer is jest with the react-native preset — a
// second test runner, a second config and a transform pipeline, for tests whose whole job is
// "is the button still there". This is the smaller answer.
//
// Plain .mjs on purpose: it is loaded through a resolve hook, and a hook that short-circuits
// has to hand node a file it can read without being told how.
//
// Every component here is a HOST component, i.e. a plain string. react-test-renderer accepts
// those and puts them in the tree under exactly that name. Nothing is simulated: a Pressable's
// `onPress` is called by the test, not by a synthetic event system.
//
// This is NOT a fidelity claim. These tests say a screen renders and carries the right words.
// Layout, styling, gestures and fonts are the device's answer, and the hand check on the
// Seeker is where that is settled.
export const View = "View";
export const Text = "Text";
export const Pressable = "Pressable";
export const TouchableOpacity = "TouchableOpacity";
export const Switch = "Switch";
export const TextInput = "TextInput";
export const ScrollView = "ScrollView";
export const SafeAreaView = "SafeAreaView";
export const StatusBar = "StatusBar";
export const Image = "Image";
export const ActivityIndicator = "ActivityIndicator";

export const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) => style,
  hairlineWidth: 1,
  absoluteFill: {},
};

/** The scale drags with a PanResponder; the tests only need it to exist. */
export const PanResponder = {
  create: (config) => ({ panHandlers: {}, config }),
};

export const Platform = { OS: "android", select: (o) => o.android ?? o.default };
export const Dimensions = { get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }) };
export const Linking = { openURL: async () => undefined };
export const Alert = { alert: () => undefined };
export const Keyboard = { dismiss: () => undefined };
export const AppState = {
  currentState: "active",
  addEventListener: () => ({ remove: () => undefined }),
};

export default { View, Text, Pressable, StyleSheet, PanResponder, Platform, Dimensions };
