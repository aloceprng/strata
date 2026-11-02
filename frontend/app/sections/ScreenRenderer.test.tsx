import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen as view } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { tokenVariable } from "./Intro";
import { ScreenRenderer, SECTIONS, type Screen } from "./ScreenRenderer";

const contract = JSON.parse(
  readFileSync(resolve(process.cwd(), "../contracts/components.json"), "utf-8"),
);

function screenOf(...sections: Screen["sections"]): Screen {
  return { schemaVersion: 1, screen: "home", sections };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the component contract", () => {
  it("has a renderer for every section and a section for every renderer", () => {
    expect(Object.keys(SECTIONS).sort()).toEqual(Object.keys(contract.sections).sort());
  });
});

describe("ScreenRenderer", () => {
  it("renders sections in the published order", () => {
    render(
      <ScreenRenderer
        screen={screenOf(
          { id: "b", type: "Intro", props: { title: "Second" } },
          { id: "a", type: "Intro", props: { title: "First" } },
        )}
      />,
    );
    expect(view.getAllByRole("heading").map((h) => h.textContent)).toEqual(["Second", "First"]);
  });

  it("skips and logs a section it does not know", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ScreenRenderer
        screen={screenOf(
          { id: "x", type: "FromTheFuture" },
          { id: "a", type: "Intro", props: { title: "Still here" } },
        )}
      />,
    );
    expect(view.getByRole("heading").textContent).toBe("Still here");
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("FromTheFuture"));
  });

  it("renders an empty screen", () => {
    const { container } = render(<ScreenRenderer screen={screenOf()} />);
    expect(container.textContent).toBe("");
  });
});

describe("Intro", () => {
  it("omits the body when there is none", () => {
    render(<ScreenRenderer screen={screenOf({ id: "a", type: "Intro", props: { title: "T" } })} />);
    expect(view.queryByRole("paragraph")).toBeNull();
  });

  it("applies its tone and gap", () => {
    render(
      <ScreenRenderer
        screen={screenOf({
          id: "a",
          type: "Intro",
          props: { title: "T", body: "B", tone: "accent", gap: "space.stack.gap" },
        })}
      />,
    );
    expect(view.getByText("B").dataset.tone).toBe("accent");
    expect(view.getByText("B").parentElement?.style.gap).toBe("var(--space-stack-gap)");
  });

  it("turns a token name into its CSS variable", () => {
    expect(tokenVariable("space.stack.gap-loose")).toBe("var(--space-stack-gap-loose)");
  });
});
