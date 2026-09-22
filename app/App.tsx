import React, { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { SafeAreaView, StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Header from './src/components/Header';
import Hairline from './src/components/Hairline';
import TabBar, { Area } from './src/components/TabBar';
import Today from './src/screens/Today';
import Result from './src/screens/Result';
import Record from './src/screens/Record';
import Settings from './src/screens/Settings';
import Diagnostics from './src/screens/Diagnostics';
import SampleBanner from './src/components/SampleBanner';
import FirstStart from './src/screens/FirstStart';
import { useObservedFonts } from './src/fonts';
import { color } from './src/tokens';
import { mockResult, mockToday, type DesignState, type ResultDesignState } from './src/mockViews';
import { recordView } from './src/core/record.ts';
import { useDay, type LiveConfig } from './src/useDay';
import season from './src/season1.json';

/** True only in the build made with APP_VARIANT=diagnostics (app.config.js). */
const IS_DIAGNOSTICS = Constants.expoConfig?.extra?.diagnostics === true;

/**
 * The memory question after a reveal. On in the tester build (APP_VARIANT=tester), off
 * everywhere else, so it can be tried on real evenings without shipping it by default.
 */
const ASK_MEMORY = Constants.expoConfig?.extra?.memoryQuestion === true;

/**
 * The live configuration. Without an endpoint the app draws the design states from mockViews —
 * one screen, two data sources, so the design can be reviewed without a wallet and the screens
 * that ship are the ones that were reviewed.
 */
const LIVE: LiveConfig | null = Constants.expoConfig?.extra?.rpcEndpoint
  ? {
      endpoint: Constants.expoConfig.extra.rpcEndpoint as string,
      cluster: (Constants.expoConfig?.extra?.cluster as LiveConfig['cluster']) ?? 'solana:mainnet',
      calendar: season.rounds as unknown as LiveConfig['calendar'],
    }
  : null;

export default function App() {
  const fontsLoaded = useObservedFonts();

  const [area, setArea] = useState<Area>('Today');
  const [onSettings, setOnSettings] = useState(false);
  const [todayState, setTodayState] = useState<DesignState>('open');
  const [resultState, setResultState] = useState<ResultDesignState>('called');

  const live = useDay(LIVE);

  /**
   * The very first start, in two steps (Figma 11 and owner, 22.09.2026):
   *
   *   1. the intro — a wordmark, one line, `Continue`
   *   2. one worked example — the same Result screen from `mockViews`, under a banner
   *
   * Then normal operation, for good. No chain call and no wallet in either step: on a fresh
   * install there is nothing to read and nobody to ask.
   *
   * The step lives in component state, not in the store: an app that is killed between the two
   * starts at the intro again, and that is the harmless direction to be wrong in.
   */
  const [introStep, setIntroStep] = useState<'intro' | 'example'>('intro');
  const firstRun = LIVE !== null && live.introSeen === false;
  const showIntro = firstRun && introStep === 'intro';
  const showExample = firstRun && introStep === 'example';
  useEffect(() => {
    if (showExample) setArea('Result');
  }, [showExample]);

  // Record and Settings cost their own reads, so they are fetched when their screen opens.
  const { loadRecord, loadSettings } = live;
  useEffect(() => {
    if (!LIVE) return;
    if (area === 'Record') void loadRecord();
    if (onSettings) void loadSettings();
  }, [area, onSettings, loadRecord, loadSettings]);

  // Without a chain there is nothing to show but an empty record — no fixture, no invented data.
  const emptyRecord = recordView({
    now: Math.floor(Date.now() / 1000),
    calendar: [],
    rounds: new Map(),
    entries: new Map(),
    records: [],
    player: null,
  });

  // The diagnostics build has one job and shows it immediately — no long press, no tabs.
  if (IS_DIAGNOSTICS) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.ground }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: color.ground }}>
          <StatusBar barStyle="light-content" backgroundColor={color.ground} />
          <Diagnostics />
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  if (!fontsLoaded) {
    // Nothing is drawn before Literata / Plex are available: no system-font flash.
    return <View style={{ flex: 1, backgroundColor: color.ground }} />;
  }

  const todayView = LIVE && live.day ? live.day.today : mockToday(todayState);
  const resultView = LIVE ? (live.day?.result ?? null) : mockResult(resultState);

  // The intro is the whole screen: no header, no tabs, nothing to press but `Continue`.
  if (showIntro) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.ground }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: color.ground }}>
          <StatusBar barStyle="light-content" backgroundColor={color.ground} />
          <FirstStart onContinue={() => setIntroStep('example')} />
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.ground }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: color.ground }}>
        <StatusBar barStyle="light-content" backgroundColor={color.ground} />
        <Header onSettings={() => setOnSettings((v) => !v)} settingsActive={onSettings} />
        <Hairline marginVertical={0} />

        <View style={{ flex: 1 }}>
          {onSettings ? (
            <Settings
              view={live.settings}
              backup={LIVE ? live.backup : null}
              memoryLog={ASK_MEMORY && LIVE ? live.memoryLog : null}
              todayState={todayState}
              onTodayState={setTodayState}
              resultState={resultState}
              onResultState={setResultState}
            />
          ) : area === 'Today' ? (
            <Today
              view={todayView}
              busy={live.busy}
              error={LIVE ? live.error : null}
              reminders={live.reminders}
              actions={{
                onSave: (pBps, sentence, share) => live.save(pBps, sentence, share),
                onSeal: () => live.seal(),
                onRevealOnly: LIVE ? () => live.revealOnly() : undefined,
                onConnect: () => live.connect(),
              }}
            />
          ) : area === 'Result' ? (
            showExample ? (
              <>
                <SampleBanner text="Example" />
                <Result view={mockResult('called')} />
              </>
            ) : (
              <Result
                view={resultView}
                memoryQuestion={ASK_MEMORY}
                onRemember={LIVE ? live.remember : undefined}
              />
            )
          ) : (
            <Record view={live.record ?? emptyRecord} hideUnrevealedAnswer={ASK_MEMORY} />
          )}
        </View>

        <TabBar
          active={onSettings ? null : area}
          onChange={(next) => {
            // Leaving the example is how it ends — no extra word for "skip", because there is
            // no approved one and the tab bar already says "go somewhere else".
            if (showExample) void live.dismissIntro();
            setOnSettings(false);
            setArea(next);
          }}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
