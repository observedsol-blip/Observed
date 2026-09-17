import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Screen from '../components/Screen';
import Scale from '../components/Scale';
import Hairline from '../components/Hairline';
import PrimaryButton from '../components/PrimaryButton';
import SealMoment from '../components/SealMoment';
import { Block, Body, Kicker, Label, Mono, MonoMeta, Question } from '../components/Type';
import { color, space, type } from '../tokens';
import { today, TodayState } from '../mock';

/**
 * Today — all six states from 03 §2. Which state is shown is chosen on the
 * Settings stub; no state-switching copy appears on this screen.
 */
export default function Today({ state }: { state: TodayState }) {
  const [probability, setProbability] = useState<number>(today.defaultProbability);
  const [sealed, setSealed] = useState(false);

  const isOpen = state === 'open' || state === 'open_busy';

  if (state === 'no_round') {
    return (
      <Screen>
        <Kicker>{today.roundLine}</Kicker>
        <Block>
          <Question>{today.noRound}</Question>
        </Block>
      </Screen>
    );
  }

  if (state === 'not_eligible') {
    return (
      <Screen>
        <Kicker>{today.roundLine}</Kicker>
        <Block>
          <Question>{today.notEligible}</Question>
        </Block>
        <Block top={space.lg}>
          <Body>{today.notEligibleDetail}</Body>
        </Block>
        <Block top={space.lg}>
          <Label style={{ color: color.ink, textDecorationLine: 'underline' }}>
            {today.notEligibleLink}
          </Label>
        </Block>
      </Screen>
    );
  }

  if (state === 'missed') {
    return (
      <Screen>
        <Kicker>{today.roundLine}</Kicker>
        <Block>
          <Question>{today.question}</Question>
        </Block>
        <Hairline />
        <Mono style={{ color: color.meta }}>{today.missed}</Mono>
      </Screen>
    );
  }

  if (state === 'pending') {
    // Pending, afternoon: the question is small and now carries the number.
    // The user's own value is deliberately NOT repeated here.
    return (
      <Screen>
        <Kicker>{today.roundLine}</Kicker>
        <Block top={space.md}>
          <Body>{today.question}</Body>
          <MonoMeta style={{ marginTop: space.xs }}>{today.questionResolvedDetail}</MonoMeta>
        </Block>
        <Hairline />
        <Mono style={{ color: color.meta }}>{today.pendingStatus}</Mono>
        <Block top={space.lg}>
          <MonoMeta>{today.pendingNextWindow}</MonoMeta>
        </Block>
        <SealMoment />
      </Screen>
    );
  }

  if (state === 'sealed' || sealed) {
    return (
      <Screen>
        <Kicker>{today.roundLine}</Kicker>
        <Block top={space.md}>
          <MonoMeta>{today.genesis}</MonoMeta>
        </Block>
        <Block top={space.lg}>
          <Question>{today.question}</Question>
        </Block>
        <Hairline />
        <Mono>{today.sealedStatus}</Mono>
        <Block top={space.md}>
          <Label>{today.sealedHint}</Label>
        </Block>
        <SealMoment />
      </Screen>
    );
  }

  // Open, unanswered (and the 11:50 UTC variant).
  return (
    <Screen>
      <Mono style={{ color: state === 'open_busy' ? color.ink : color.meta }}>
        {state === 'open_busy' ? today.windowLineBusy : today.windowLine}
      </Mono>
      <Block top={space.lg}>
        <Kicker>{today.roundLine}</Kicker>
        <MonoMeta style={{ marginTop: space.xs }}>{today.genesis}</MonoMeta>
      </Block>

      <Block>
        <Question>{today.question}</Question>
      </Block>

      <Block>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.md }}>
          <Text style={{ ...type.hero, color: color.pencil }}>{probability}</Text>
          <Text style={{ ...type.numberLarge, color: color.pencil, marginBottom: 6 }}>%</Text>
        </View>
        <Label style={{ marginTop: space.xs }}>{today.chanceLabel}</Label>
      </Block>

      <Block>
        <Scale mode="input" value={probability} onChange={setProbability} />
      </Block>

      <Hairline />

      {isOpen ? (
        <Label style={{ marginBottom: space.md }}>{today.sameSignature}</Label>
      ) : null}
      <PrimaryButton label={today.primary} onPress={() => setSealed(true)} />

      <Block top={space.xl}>
        <MonoMeta>{today.cost}</MonoMeta>
      </Block>
    </Screen>
  );
}
