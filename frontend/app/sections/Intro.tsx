import { Heading, Stack, Text } from "../components/primitives";

export type IntroProps = {
  title: string;
  body?: string;
  tone?: "secondary" | "accent";
  gap?: string;
};

export function tokenVariable(token: string) {
  return `var(--${token.replaceAll(".", "-")})`;
}

export function Intro({ title, body, tone, gap }: IntroProps) {
  return (
    <Stack style={gap ? { gap: tokenVariable(gap) } : undefined}>
      <Heading level={1}>{title}</Heading>
      {body ? <Text tone={tone}>{body}</Text> : null}
    </Stack>
  );
}
