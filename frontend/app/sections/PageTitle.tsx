"use client";

import { Breadcrumb, type Crumb } from "../components/commerce";
import { fill } from "../store/catalogue";
import { useStore } from "../store/StoreProvider";

export type PageTitleProps = {
  title: string;
  /** May use {units} or {lines} from the basket, e.g. "{units} items" or "({lines})". */
  count?: string;
  style?: "inline" | "display";
  breadcrumb?: Crumb[];
};

export function PageTitle({ title, count, style = "inline", breadcrumb = [] }: PageTitleProps) {
  const store = useStore();
  const shown = count
    ? fill(count, { units: store?.totals.units ?? 0, lines: store?.totals.lines.length ?? 0 })
    : undefined;
  return (
    <section className="strata-page-title" data-style={style}>
      {breadcrumb.length ? <Breadcrumb items={breadcrumb} /> : null}
      <h1 className={style === "display" ? "strata-display-title" : "strata-inline-title"}>
        {title}
        {shown ? <span className={style === "display" ? "strata-display-count" : "strata-inline-count"}>{shown}</span> : null}
      </h1>
    </section>
  );
}
