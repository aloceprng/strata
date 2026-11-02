import type { ComponentType } from "react";

import { Intro } from "./Intro";

export type Section = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
};

export type Screen = {
  schemaVersion: number;
  screen: string;
  sections: Section[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SECTIONS: Record<string, ComponentType<any>> = { Intro };

export function ScreenRenderer({ screen }: { screen: Screen }) {
  return screen.sections.map((section) => {
    const Component = SECTIONS[section.type];
    if (!Component) {
      console.error(`[strata] ${screen.screen}: skipped unknown section ${section.type}`);
      return null;
    }
    return <Component key={section.id} {...section.props} />;
  });
}
