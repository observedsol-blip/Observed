import React from 'react';
import { Text, TextProps, View } from 'react-native';
import { color, space, type } from '../tokens';

type Props = TextProps & { children: React.ReactNode };

export const Kicker = ({ children, style, ...rest }: Props) => (
  <Text {...rest} style={[type.kicker, { color: color.meta, textTransform: 'uppercase' }, style]}>
    {children}
  </Text>
);

export const Label = ({ children, style, ...rest }: Props) => (
  <Text {...rest} style={[type.label, { color: color.meta }, style]}>
    {children}
  </Text>
);

export const Body = ({ children, style, ...rest }: Props) => (
  <Text {...rest} style={[type.body, { color: color.ink }, style]}>
    {children}
  </Text>
);

export const Question = ({ children, style, ...rest }: Props) => (
  <Text {...rest} style={[type.question, { color: color.ink }, style]}>
    {children}
  </Text>
);

export const QuestionSmall = ({ children, style, ...rest }: Props) => (
  <Text {...rest} style={[type.questionSmall, { color: color.ink }, style]}>
    {children}
  </Text>
);

/** Yesterday's own sentence: Literata italic, the real cut — never `fontStyle: 'italic'`. */
export const Sentence = ({ children, style, ...rest }: Props) => (
  <Text {...rest} style={[type.sentence, { color: color.ink }, style]}>
    {children}
  </Text>
);

export const Reading = ({ children, style, ...rest }: Props) => (
  <Text {...rest} style={[type.reading, { color: color.ink }, style]}>
    {children}
  </Text>
);

export const Mono = ({ children, style, ...rest }: Props) => (
  <Text {...rest} style={[type.mono, { color: color.ink }, style]}>
    {children}
  </Text>
);

/** Probabilities and Brier values — Plex Sans, never Plex Mono (dotted zero). */
export const Figures = ({ children, style, ...rest }: Props) => (
  <Text {...rest} style={[type.figures, { color: color.ink }, style]}>
    {children}
  </Text>
);

export const FiguresMeta = ({ children, style, ...rest }: Props) => (
  <Text {...rest} style={[type.figuresSmall, { color: color.meta }, style]}>
    {children}
  </Text>
);

export const MonoMeta = ({ children, style, ...rest }: Props) => (
  <Text {...rest} style={[type.monoSmall, { color: color.meta }, style]}>
    {children}
  </Text>
);

/** Vertical rhythm helper — no card, no border, no radius. */
/** The name of the app, once, on the first screen it ever shows (Figma 11, 131:9). */
export const Wordmark = ({ children, style, ...rest }: Props) => (
  <Text style={[type.reading, { color: color.ink }, style]} {...rest}>
    {children}
  </Text>
);

export const Block = ({
  children,
  top = space.xl,
}: {
  children: React.ReactNode;
  top?: number;
}) => <View style={{ marginTop: top }}>{children}</View>;
