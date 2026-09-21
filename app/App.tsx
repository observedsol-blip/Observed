import React, { useState } from 'react';
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
import { useObservedFonts } from './src/fonts';
import { color } from './src/tokens';
import { RecordState } from './src/mock';
import { mockResult, mockToday, type DesignState, type ResultDesignState } from './src/mockViews';
import { useDay, type LiveConfig } from './src/useDay';
import season from './src/season1.json';

/** True only in the build made with APP_VARIANT=diagnostics (app.config.js). */
const IS_DIAGNOSTICS = Constants.expoConfig?.extra?.diagnostics === true;

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
  const [recordState, setRecordState] = useState<RecordState>('default');
  const [showSampleRecord, setShowSampleRecord] = useState(false);

  const live = useDay(LIVE);

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

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.ground }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: color.ground }}>
        <StatusBar barStyle="light-content" backgroundColor={color.ground} />
        <Header onSettings={() => setOnSettings((v) => !v)} settingsActive={onSettings} />
        <Hairline marginVertical={0} />

        <View style={{ flex: 1 }}>
          {onSettings ? (
            <Settings
              backup={LIVE ? live.backup : null}
              todayState={todayState}
              onTodayState={setTodayState}
              resultState={resultState}
              onResultState={setResultState}
              recordState={recordState}
              onRecordState={setRecordState}
            />
          ) : area === 'Today' ? (
            <Today
              view={todayView}
              busy={live.busy}
              error={LIVE ? live.error : null}
              actions={{
                onSave: (pBps, sentence, share) => live.save(pBps, sentence, share),
                onSeal: () => live.seal(),
                onConnect: () => live.connect(),
              }}
            />
          ) : area === 'Result' ? (
            <Result view={resultView} />
          ) : (
            <Record
              state={recordState}
              showSample={showSampleRecord}
              onToggleSample={() => setShowSampleRecord((v) => !v)}
            />
          )}
        </View>

        <TabBar
          active={onSettings ? null : area}
          onChange={(next) => {
            setOnSettings(false);
            setArea(next);
          }}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
