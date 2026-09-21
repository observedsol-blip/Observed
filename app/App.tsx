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
import { RecordState, ResultState, TodayState } from './src/mock';

/** True only in the build made with APP_VARIANT=diagnostics (app.config.js). */
const IS_DIAGNOSTICS = Constants.expoConfig?.extra?.diagnostics === true;

export default function App() {
  const fontsLoaded = useObservedFonts();

  const [area, setArea] = useState<Area>('Today');
  const [onSettings, setOnSettings] = useState(false);
  /** Debug builds only: long-press the wordmark to open the diagnostics screen. */
  const [onDiagnostics, setOnDiagnostics] = useState(false);
  const [todayState, setTodayState] = useState<TodayState>('open');
  const [resultState, setResultState] = useState<ResultState>('resolved_final');
  /** Default stays the 8-revealed lock; the early read is an opt-in mock state. */
  const [recordState, setRecordState] = useState<RecordState>('default');
  const [showSampleRecord, setShowSampleRecord] = useState(false);

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

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.ground }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: color.ground }}>
        <StatusBar barStyle="light-content" backgroundColor={color.ground} />
        <Header
          onSettings={() => setOnSettings((v) => !v)}
          settingsActive={onSettings}
          onLongPressWordmark={__DEV__ ? () => setOnDiagnostics((v) => !v) : undefined}
        />
        <Hairline marginVertical={0} />

        <View style={{ flex: 1 }}>
          {onDiagnostics ? (
            <Diagnostics />
          ) : onSettings ? (
            <Settings
              todayState={todayState}
              onTodayState={setTodayState}
              resultState={resultState}
              onResultState={setResultState}
              recordState={recordState}
              onRecordState={setRecordState}
            />
          ) : area === 'Today' ? (
            <Today state={todayState} />
          ) : area === 'Result' ? (
            <Result state={resultState} />
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
