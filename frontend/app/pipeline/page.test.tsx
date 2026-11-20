import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PipelinePage from "./page";
import { EXAMPLES, outcomeOf, parseDraft, type Check, type Pipeline } from "./model";

const HOME = {
  schemaVersion: 1,
  screen: "home",
  sections: [
    { id: "intro", type: "Intro", props: { title: "Published title" } },
    { id: "promo", type: "Intro", props: { title: "Promo title" } },
  ],
};
const BASKET = {
  schemaVersion: 1,
  screen: "basket",
  sections: [{ id: "title", type: "Intro", props: { title: "Your basket" } }],
};
const PIPELINE: Pipeline = {
  brand: "clementine",
  versions: [{ version: 2, status: "published", severity: "minor", note: "Layouts" }],
  layouts: { home: HOME, basket: BASKET },
  reference: {
    schemaVersion: 1,
    fits: ["scroll", "viewport"],
    supported: ["Intro", "Shelf", "Overview"],
    sections: {
      Intro: {
        label: "Text block",
        props: {
          title: { label: "Title", type: "string", required: true },
          tone: { type: "enum", values: ["secondary", "accent"] },
          gap: { type: "token", group: "space.stack" },
        },
      },
      Shelf: {
        label: "Shelf",
        props: {
          items: {
            label: "Items",
            type: "list",
            min: 1,
            max: 2,
            required: true,
            items: { image: { label: "Image", type: "asset", required: true } },
          },
        },
      },
      Overview: { label: "Product details", context: "product", props: {} },
      Unsupported: { label: "Needs other tokens", props: {} },
    },
    tokenOptions: { "space.stack": ["space.stack.gap"] },
  },
};

function respond(check: Check) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.endsWith("/check") ? check : PIPELINE),
    })),
  );
}

/** layouts sent with the latest check */
function lastChecked() {
  const calls = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith("/check"));
  return JSON.parse(calls.at(-1)![1]!.body as string).layouts;
}

async function loaded() {
  render(<PipelinePage />);
  await screen.findByText("Matches published v2.");
}

const jsonMode = () => fireEvent.click(screen.getByRole("button", { name: "Edit as JSON" }));
const preview = () => screen.getByText(/^Preview/).closest("section")!;
/** card headers, not their move and delete buttons */
const cards = () => [...editor().querySelectorAll<HTMLButtonElement>("button[aria-expanded]")];
const editor = () => screen.getByRole("list", { name: /Sections on/ });

beforeEach(() => {
  respond({ verdict: "ready", severity: "", comparedTo: 2, changes: [] });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the pipeline page", () => {
  it("previews the published screen and lists its versions", async () => {
    await loaded();
    expect(within(preview()).getByText("Published title")).toBeTruthy();
    expect(screen.getByText("v2")).toBeTruthy();
  });

  it("says when the API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
    render(<PipelinePage />);
    expect((await screen.findByRole("alert")).textContent).toContain("the API returned 500");
  });

  it("sends every screen to the check and counts changes per screen", async () => {
    respond({
      verdict: "ready",
      severity: "minor",
      comparedTo: 2,
      changes: [{ path: "layout.basket.added-section", kind: "added", severity: "minor", reason: "section added" }],
    });
    render(<PipelinePage />);
    expect(await screen.findByRole("button", { name: "basket, 1 changes" })).toBeTruthy();
    expect(Object.keys(lastChecked())).toEqual(["home", "basket"]);
  });
});

describe("the section editor", () => {
  it("shows each section as a card with a plain name, and no JSON", async () => {
    await loaded();
    expect(cards().map((card) => card.textContent)).toEqual(["Text blockPublished title", "Text blockPromo title"]);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText("Key reference")).toBeNull();
  });

  it("edits a prop through a labelled field", async () => {
    await loaded();
    fireEvent.click(cards()[1]);
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Spring sale" } });

    await waitFor(() => expect(lastChecked().home.sections[1].props.title).toBe("Spring sale"));
    expect(lastChecked().home.sections[1].id).toBe("promo");
  });

  it("offers token and enum props as selects of plain names", async () => {
    await loaded();
    fireEvent.click(cards()[0]);
    const spacing = screen.getByLabelText("Gap") as HTMLSelectElement;
    expect([...spacing.options].map((o) => o.textContent)).toEqual(["Default", "Gap"]);
    fireEvent.change(spacing, { target: { value: "space.stack.gap" } });
    await waitFor(() => expect(lastChecked().home.sections[0].props.gap).toBe("space.stack.gap"));
  });

  it("blocks publish while a required field is empty, before asking the server", async () => {
    await loaded();
    fireEvent.click(cards()[0]);
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "" } });

    expect(await screen.findByText("Not ready to publish")).toBeTruthy();
    expect(screen.getByText("home › Text block › Title can't be empty")).toBeTruthy();
  });

  it("moves a section with the buttons and announces where it went", async () => {
    await loaded();
    const ups = screen.getAllByRole("button", { name: "Move Text block up" }) as HTMLButtonElement[];
    expect(ups[0].disabled).toBe(true);
    fireEvent.click(ups[1]);
    await waitFor(() => expect(lastChecked().home.sections.map((s: { id: string }) => s.id)).toEqual(["promo", "intro"]));
    expect(screen.getByText("Text block moved to position 1 of 2.")).toBeTruthy();
  });

  it("reorders the preview straight away, before the check returns", async () => {
    await loaded();
    const ups = screen.getAllByRole("button", { name: "Move Text block up" });
    fireEvent.click(ups[1]);
    const titles = within(preview()).getAllByText(/title$/).map((el) => el.textContent);
    expect(titles).toEqual(["Promo title", "Published title"]);
  });

  it("deletes a section and can undo it", async () => {
    await loaded();
    fireEvent.click(screen.getAllByRole("button", { name: "Delete Text block" })[0]);
    await waitFor(() => expect(lastChecked().home.sections).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(lastChecked().home.sections.map((s: { id: string }) => s.id)).toEqual(["intro", "promo"]));
  });

  it("adds only section types the brand supports and that fit the screen", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "+ Add section" }));
    const menu = screen.getByRole("group", { name: "Section types" });
    expect(within(menu).getAllByRole("button").map((b) => b.textContent)).toEqual(["Text block", "Shelf"]);
  });

  it("starts a new section as a copy of the brand's own, with a fresh hidden id", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "+ Add section" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Section types" })).getByRole("button", { name: "Text block" }));

    await waitFor(() => expect(lastChecked().home.sections).toHaveLength(3));
    expect(lastChecked().home.sections[2]).toEqual({ id: "intro-2", type: "Intro", props: { title: "Published title" } });
    expect(document.activeElement?.textContent).toContain("Text block");
  });

  it("fills a type the brand has never used with placeholders and flags them", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "+ Add section" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Section types" })).getByRole("button", { name: "Shelf" }));

    await waitFor(() => expect(lastChecked().home.sections[2].props).toEqual({ items: [{ image: "/products/brand/name.png" }] }));
    expect(screen.getByText("Placeholder: pick a real image")).toBeTruthy();
    // a list at its min can't shrink; at its max it can't grow
    expect((screen.getByRole("button", { name: "Delete item 1" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect((screen.getByRole("button", { name: "Add item" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("At most 2 items")).toBeTruthy();
  });

  it("keeps the cards and the JSON on one draft", async () => {
    await loaded();
    fireEvent.click(screen.getAllByRole("button", { name: "Delete Text block" })[1]);
    jsonMode();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).not.toContain("Promo title");
    fireEvent.click(screen.getByRole("button", { name: "Sections" }));
    expect(cards()).toHaveLength(1);
  });
});

describe("the JSON view", () => {
  it("lists every key a layout can use, starting with a type in the draft", async () => {
    await loaded();
    jsonMode();
    expect(screen.getByRole("tab", { name: /Intro/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText('"accent"')).toBeTruthy();
    expect(screen.getByText('"space.stack.gap"')).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Shelf" }));
    expect(screen.getByText(/a list, 1–2 items/)).toBeTruthy();
    expect(screen.getByText(/"image": "\/products\/brand\/name.png"/)).toBeTruthy();
  });

  it("shows why a draft was refused and keeps the last valid preview", async () => {
    await loaded();
    jsonMode();
    respond({ verdict: "refused", error: "unknown section type 'Carousel'", changes: [] });
    fireEvent.click(screen.getByRole("button", { name: "Use unknown section" }));

    expect(await screen.findByText("Publish refused")).toBeTruthy();
    expect(screen.getByText("unknown section type 'Carousel'")).toBeTruthy();
    expect(within(preview()).getByText("Published title")).toBeTruthy();
  });

  it("reports invalid JSON without asking the server, and the cards say so", async () => {
    await loaded();
    jsonMode();
    const calls = vi.mocked(fetch).mock.calls.length;

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "{" } });

    expect(await screen.findByText(/Not valid JSON/)).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.length).toBe(calls);
    fireEvent.click(screen.getByRole("button", { name: "Sections" }));
    expect(screen.getByText(/JSON has an error/)).toBeTruthy();
  });

  it("switches between screens and keeps each draft", async () => {
    await loaded();
    jsonMode();
    fireEvent.click(screen.getByRole("button", { name: "basket" }));
    expect(await within(preview()).findByText("Your basket")).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain('"screen": "basket"');

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "{" } });
    expect(await screen.findByText(/Not valid JSON in basket/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /home/ }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain('"screen": "home"');
    fireEvent.click(screen.getByRole("button", { name: /basket/ }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("{");
  });
});

describe("outcomeOf", () => {
  it("names the release a draft would be", () => {
    const outcome = outcomeOf({ verdict: "ready", severity: "minor", comparedTo: 2, changes: [] });
    expect(outcome.title).toBe("Ready to publish as a minor release");
  });

  it("flags a major change", () => {
    const outcome = outcomeOf({
      verdict: "needs-approval",
      severity: "major",
      comparedTo: 2,
      changes: [],
    });
    expect(outcome.tone).toBe("warn");
  });
});

describe("parseDraft", () => {
  it("accepts JSON and rejects anything else", () => {
    expect(parseDraft("{}").ok).toBe(true);
    expect(parseDraft("nope").ok).toBe(false);
  });
});

describe("the example edits", () => {
  it("do not modify the published layouts", () => {
    const before = JSON.stringify(HOME);
    EXAMPLES.forEach((example) => example.change(HOME));
    expect(JSON.stringify(HOME)).toBe(before);
  });

  it("edit copy targets a section that has a title, and is off when none does", () => {
    const edit = EXAMPLES.find((example) => example.label === "Edit copy")!;
    const withHeader = { ...HOME, sections: [{ id: "header", type: "SiteHeader" }, ...HOME.sections] };
    expect(edit.change(withHeader).sections[1].props?.title).toBe("New headline");
    expect(edit.change(withHeader).sections[0].props).toBeUndefined();
    expect(edit.appliesTo!({ ...HOME, sections: [{ id: "header", type: "SiteHeader" }] })).toBe(false);
  });
});
