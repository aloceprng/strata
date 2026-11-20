import type { Section, Screen } from "../sections/ScreenRenderer";
import type { Catalogue } from "../store/catalogue";
import { SAMPLE_ASSET, SAMPLE_TEXT, sampleProps, type Layouts, type PropRule, type Reference } from "./model";

// the product screen is a template, so links point at product/<id> instead
const PRODUCT_SCREEN = "product";
export const ASSET_PATH = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|jpg|webp|svg)$/;

/** "logoAlt" -> "Logo alt", "gap-loose" -> "Gap loose" */
export function humanize(name: string) {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_.]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const labelOf = (name: string, rule: { label?: string }) => rule.label ?? humanize(name);

/** a token without its group: space.stack.gap-loose -> "Gap loose" */
export function tokenLabel(token: string, group: string) {
  return humanize(token.startsWith(`${group}.`) ? token.slice(group.length + 1) : token);
}

/** section types the add menu may offer here */
export function addableTypes(reference: Reference, screen: string) {
  const supported = reference.supported ?? Object.keys(reference.sections);
  return supported.filter((type) => {
    const definition = reference.sections[type];
    return definition && (definition.context !== PRODUCT_SCREEN || screen === PRODUCT_SCREEN);
  });
}

/** screens a link may name */
export function linkableScreens(layouts: Layouts) {
  return Object.keys(layouts).filter((screen) => screen !== PRODUCT_SCREEN);
}

const kebab = (type: string) => type.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

/** an unused section id, never shown */
export function newSectionId(type: string, sections: Section[]) {
  const taken = new Set(sections.map((section) => section.id));
  const base = kebab(type);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

/** starting props: a copy of the brand's own instance if any, else valid placeholders */
export function seedProps(
  type: string,
  reference: Reference,
  published: Layouts,
  catalogue?: Catalogue,
): Record<string, unknown> {
  for (const screen of Object.values(published)) {
    const found = screen.sections.find((section) => section.type === type);
    if (found) return clone(found.props ?? {});
  }
  const props = sampleProps(reference.sections[type]?.props ?? {}, reference.tokenOptions);
  const ids = Object.keys(catalogue?.products ?? {});
  for (const [name, rule] of Object.entries(reference.sections[type]?.props ?? {})) {
    if (rule.type === "products" && name in props) props[name] = ids.slice(0, Math.max(rule.min ?? 0, 1));
  }
  return props;
}

export function newSection(type: string, screen: Screen, reference: Reference, published: Layouts, catalogue?: Catalogue): Section {
  return { id: newSectionId(type, screen.sections), type, props: seedProps(type, reference, published, catalogue) };
}

export const isPlaceholder = (value: unknown) => value === SAMPLE_ASSET || value === SAMPLE_TEXT;

export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** collapsed card text, so same-type sections can be told apart */
export function summaryOf(section: Section) {
  const props = section.props ?? {};
  for (const key of ["title", "headline", "eyebrow", "newsletterTitle", "wordmarkAlt", "logoAlt"]) {
    const value = props[key];
    if (typeof value === "string" && value.trim()) return value.replace(/\s+/g, " ").trim();
  }
  return "";
}

export type Issue = { path: string[]; message: string };

/** client-side checks: empty required text, out-of-range numbers, bad paths */
export function issuesOf(values: Record<string, unknown>, rules: Record<string, PropRule>, path: string[] = []): Issue[] {
  const issues: Issue[] = [];
  for (const [name, rule] of Object.entries(rules)) {
    const value = values[name];
    const here = [...path, labelOf(name, rule)];
    if (value === undefined) {
      if (rule.required) issues.push({ path: here, message: "is required" });
      continue;
    }
    if (rule.type === "string" && rule.required && typeof value === "string" && !value.trim()) {
      issues.push({ path: here, message: "can't be empty" });
    } else if (rule.type === "number" && typeof value === "number") {
      if ((rule.min !== undefined && value < rule.min) || (rule.max !== undefined && value > rule.max)) {
        issues.push({ path: here, message: `must be between ${rule.min} and ${rule.max}` });
      }
    } else if (rule.type === "asset" && (typeof value !== "string" || !ASSET_PATH.test(value))) {
      issues.push({ path: here, message: "must be an image path such as /products/brand/name.png" });
    } else if (rule.type === "list" && Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === "object") {
          issues.push(...issuesOf(item as Record<string, unknown>, rule.items ?? {}, [...here, `${index + 1}`]));
        }
      });
    }
  }
  return issues;
}

/** every image path the brand uses, for the asset picker */
export function knownAssets(layouts: Layouts, catalogue?: Catalogue) {
  const found = new Set<string>();
  const walk = (value: unknown) => {
    if (typeof value === "string" && ASSET_PATH.test(value) && value !== SAMPLE_ASSET) found.add(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(layouts);
  Object.values(catalogue?.products ?? {}).forEach((product) => walk(product.image));
  return [...found].sort();
}

/** if the draft only reorders the checked preview, show the new order now */
export function inDraftOrder(preview: Screen | null, draft: Screen | null): Screen | null {
  if (!preview || !draft || preview.sections.length !== draft.sections.length) return preview;
  const byId = new Map(preview.sections.map((section) => [section.id, JSON.stringify(section)]));
  const same = draft.sections.every((section) => byId.get(section.id) === JSON.stringify(section));
  return same ? { ...preview, sections: draft.sections } : preview;
}
