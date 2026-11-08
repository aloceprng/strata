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

// the first section that takes a title; SiteHeader, usually first, does not
function titledIndex(screen: Screen) {
  return screen.sections.findIndex((section) => typeof section.props?.title === "string");
}

function editHome(layouts: Layouts, edit: (screen: Screen) => Screen): Layouts {
  return layouts.home ? { ...layouts, home: edit(layouts.home) } : layouts;
}

export const EXAMPLES: { label: string; change: (layouts: Layouts) => Layouts }[] = [
  { label: "Reset", change: (layouts) => layouts },
  {
    label: "Edit copy",
    change: (layouts) =>
      editHome(layouts, (home) => ({
        ...home,
        sections: home.sections.map((section, index) =>
          index === titledIndex(home)
            ? { ...section, props: { ...section.props, title: "New headline" } }
            : section,
        ),
      })),
  },
  {
    label: "Add section",
    change: (layouts) =>
      editHome(layouts, (home) => ({
        ...home,
        sections: [
          ...home.sections,
          {
            id: "added-section",
            type: "Intro",
            props: { title: "A section added by data", body: "No frontend deploy needed." },
          },
        ],
      })),
  },
  {
    label: "Remove section",
    change: (layouts) => editHome(layouts, (home) => ({ ...home, sections: [] })),
  },
  {
    label: "Use unknown section",
    change: (layouts) =>
      editHome(layouts, (home) => ({
        ...home,
        sections: [...home.sections, { id: "carousel", type: "Carousel" }],
      })),
  },
];
