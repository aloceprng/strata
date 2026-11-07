import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PipelinePage from "./page";
import { EXAMPLES, outcomeOf, parseDraft, type Check, type Pipeline } from "./model";

const HOME = {
  schemaVersion: 1,
  screen: "home",
  sections: [{ id: "intro", type: "Intro", props: { title: "Published title" } }],
};
const PIPELINE: Pipeline = {
  brand: "clementine",
  versions: [{ version: 2, status: "published", severity: "minor", note: "Layouts" }],
  layouts: { home: HOME },
  reference: {
    schemaVersion: 1,
    fits: ["scroll", "viewport"],
    sections: {
      Intro: {
        props: {
          title: { type: "string", required: true },
          tone: { type: "enum", values: ["secondary", "accent"] },
          gap: { type: "token", group: "space.stack" },
        },
      },
      Shelf: {
        props: {
          items: { type: "list", min: 1, max: 4, required: true, items: { image: { type: "asset", required: true } } },
        },
      },
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

beforeEach(() => {
  respond({ verdict: "ready", severity: "", comparedTo: 2, changes: [] });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the pipeline page", () => {
  it("lists every key a layout can use, starting with a type in the draft", async () => {
    render(<PipelinePage />);
    await screen.findByText("Published title");
    expect(screen.getByRole("tab", { name: /Intro/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText('"accent"')).toBeTruthy();
    expect(screen.getByText('"space.stack.gap"')).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Shelf" }));
    expect(screen.getByText(/a list, 1–4 items/)).toBeTruthy();
    expect(screen.getByText(/"image": "\/products\/brand\/name.png"/)).toBeTruthy();
  });

  it("previews the published screen and lists its versions", async () => {
    render(<PipelinePage />);
    expect(await screen.findByText("Published title")).toBeTruthy();
    expect(screen.getByText("v2")).toBeTruthy();
    expect(screen.getByText("Matches published v2.")).toBeTruthy();
  });

  it("shows why a draft was refused and keeps the last valid preview", async () => {
    render(<PipelinePage />);
    await screen.findByText("Published title");

    respond({ verdict: "refused", error: "unknown section type 'Carousel'", changes: [] });
    fireEvent.click(screen.getByRole("button", { name: "Use unknown section" }));

    expect(await screen.findByText("Publish refused")).toBeTruthy();
    expect(screen.getByText("unknown section type 'Carousel'")).toBeTruthy();
    expect(screen.getByText("Published title")).toBeTruthy();
  });

  it("reports invalid JSON without asking the server", async () => {
    render(<PipelinePage />);
    await screen.findByText("Published title");
    const calls = vi.mocked(fetch).mock.calls.length;

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "{" } });

    expect(await screen.findByText(/Not valid JSON/)).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.length).toBe(calls);
  });

  it("says when the API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
    render(<PipelinePage />);
    expect((await screen.findByRole("alert")).textContent).toContain("the API returned 500");
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
    const before = JSON.stringify(PIPELINE.layouts);
    EXAMPLES.forEach((example) => example.change(PIPELINE.layouts));
    expect(JSON.stringify(PIPELINE.layouts)).toBe(before);
  });
});
