import type { Screen } from "../sections/ScreenRenderer";

export type Layouts = Record<string, Screen>;

export type Change = {
  path: string;
  kind: string;
  severity: string;
  reason: string;
};

export type Version = {
  version: number;
  status: string;
  severity: string;
  note: string;
};

export type PropRule = {
  type: "string" | "enum" | "boolean" | "number" | "asset" | "token" | "list" | "products" | "link";
  required?: boolean;
  values?: string[];
  min?: number;
  max?: number;
  group?: string;
  items?: Record<string, PropRule>;
};

export type Reference = {
  schemaVersion: number;
  fits: string[];
  sections: Record<string, { tokens?: string[]; props: Record<string, PropRule> }>;
  tokenOptions: Record<string, string[]>;
  products?: string[];
};

export type Pipeline = {
  brand: string;
  versions: Version[];
  layouts: Layouts;
  reference: Reference;
};

const SAMPLE_ASSET = "/products/brand/name.png";

/** A placeholder value that passes the rule, so a pasted snippet validates. */
export function sampleValue(rule: PropRule, tokens: Record<string, string[]> = {}): unknown {
  switch (rule.type) {
    case "enum":
      return rule.values?.[0];
    case "boolean":
      return true;
    case "number":
      return rule.min ?? 0;
    case "asset":
      return SAMPLE_ASSET;
    case "token":
      return tokens[rule.group ?? ""]?.[0] ?? `${rule.group}.name`;
    case "products":
      return [];
    case "link":
      return "home";
    case "list":
      return Array.from({ length: Math.max(rule.min ?? 1, 1) }, () => sampleProps(rule.items ?? {}, tokens));
    default:
      return "Text";
  }
}

/** Only the required props, filled with placeholders. */
export function sampleProps(props: Record<string, PropRule>, tokens: Record<string, string[]> = {}) {
  return Object.fromEntries(
    Object.entries(props)
      .filter(([, rule]) => rule.required)
      .map(([name, rule]) => [name, sampleValue(rule, tokens)]),
  );
}

export type Check = {
  verdict: "ready" | "needs-approval" | "refused";
  severity?: string;
  comparedTo?: number;
  error?: string;
  changes: Change[];
};

export type Tone = "ok" | "warn" | "bad";

export function outcomeOf(check: Check): { tone: Tone; title: string; detail: string } {
  if (check.verdict === "refused") {
    return { tone: "bad", title: "Publish refused", detail: check.error ?? "" };
  }
  if (check.verdict === "needs-approval") {
    return {
      tone: "warn",
      title: "Major change: needs approval",
      detail: `Breaking against v${check.comparedTo}. Publishing requires allowing major changes.`,
    };
  }
  if (!check.severity) {
    return { tone: "ok", title: "No changes", detail: `Matches published v${check.comparedTo}.` };
  }
  return {
    tone: "ok",
    title: `Ready to publish as a ${check.severity} release`,
    detail: `Against v${check.comparedTo}. The page would update with no frontend deploy.`,
  };
}

export function parseDraft(
  text: string,
): { ok: true; layouts: Layouts } | { ok: false; error: string } {
  try {
    return { ok: true, layouts: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: `Not valid JSON: ${(error as Error).message}` };
  }
}

/** Parse each screen's text, naming the screen whose JSON is broken. */
export function parseDrafts(
  texts: Record<string, string>,
): { ok: true; layouts: Layouts } | { ok: false; error: string; screen: string } {
  const layouts: Layouts = {};
  for (const [screen, text] of Object.entries(texts)) {
    const draft = parseDraft(text);
    if (!draft.ok) return { ok: false, screen, error: draft.error.replace("Not valid JSON", `Not valid JSON in ${screen}`) };
    layouts[screen] = draft.layouts as unknown as Screen;
  }
  return { ok: true, layouts };
}

/** Layout change paths look like layout.<screen>.<section>. */
export function screenOfChange(change: Change): string {
  const [first, second] = change.path.split(".");
  return first === "layout" && second ? second : first;
}

function titledIndex(screen: Screen) {
  return screen.sections.findIndex((section) => typeof section.props?.title === "string");
}

export type Example = {
  label: string;
  change: (screen: Screen) => Screen;
  appliesTo?: (screen: Screen) => boolean;
};

/** Each example edits the published version of the selected screen. */
export const EXAMPLES: Example[] = [
  { label: "Reset", change: (screen) => screen },
  {
    label: "Edit copy",
    appliesTo: (screen) => titledIndex(screen) >= 0,
    change: (screen) => {
      const target = titledIndex(screen);
      return {
        ...screen,
        sections: screen.sections.map((section, index) =>
          index === target ? { ...section, props: { ...section.props, title: "New headline" } } : section,
        ),
      };
    },
  },
  {
    label: "Add section",
    change: (screen) => ({
      ...screen,
      sections: [
        ...screen.sections,
        {
          id: "added-section",
          type: "Intro",
          props: { title: "A section added by data", body: "No frontend deploy needed." },
        },
      ],
    }),
  },
  { label: "Remove sections", change: (screen) => ({ ...screen, sections: [] }) },
  {
    label: "Use unknown section",
    change: (screen) => ({
      ...screen,
      sections: [...screen.sections, { id: "carousel", type: "Carousel" }],
    }),
  },
];
