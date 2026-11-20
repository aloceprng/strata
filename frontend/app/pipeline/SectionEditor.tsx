"use client";

import { useEffect, useRef, useState } from "react";

import { BrandProvider } from "../components/BrandProvider";
import { SECTIONS, type Section, type Screen } from "../sections/ScreenRenderer";
import type { Catalogue } from "../store/catalogue";
import { StoreProvider } from "../store/StoreProvider";
import { addableTypes, issuesOf, labelOf, move, newSection, summaryOf } from "./editor";
import { Fields, type FieldContext } from "./Fields";
import type { Layouts, Reference } from "./model";
import styles from "./pipeline.module.css";

const THUMB_WIDTH = 168;
const FRAME_WIDTH = 1280;

type Props = {
  brand: string;
  screen: Screen;
  reference: Reference;
  published: Layouts;
  catalogue?: Catalogue;
  context: FieldContext;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (screen: Screen) => void;
};

export function SectionEditor({ brand, screen, reference, published, catalogue, context, selected, onSelect, onChange }: Props) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{ section: Section; index: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  // the card to focus once it has rendered
  const pendingFocus = useRef<string | null>(null);
  const heads = useRef(new Map<string, HTMLButtonElement>());
  const items = useRef(new Map<string, HTMLLIElement>());

  const sections = screen.sections;
  const nameOf = (section: Section) => labelOf(section.type, reference.sections[section.type] ?? {});
  const setSections = (next: Section[]) => onChange({ ...screen, sections: next });

  useEffect(() => {
    if (!pendingFocus.current) return;
    const head = heads.current.get(pendingFocus.current);
    pendingFocus.current = null;
    head?.focus();
    head?.scrollIntoView?.({ block: "nearest" });
  });

  const moveTo = (from: number, to: number) => {
    const next = move(sections, from, to);
    if (next === sections) return;
    setSections(next);
    setAnnouncement(`${nameOf(sections[from])} moved to position ${to + 1} of ${sections.length}.`);
  };

  // pointer events, not html drag and drop, so touch works too
  // the dragged card moves past each card whose middle is above the pointer
  const dragOver = (id: string, y: number) => {
    const from = sections.findIndex((s) => s.id === id);
    const to = sections.filter((s) => {
      const box = s.id !== id ? items.current.get(s.id)?.getBoundingClientRect() : undefined;
      return box && box.top + box.height / 2 < y;
    }).length;
    if (from >= 0 && to !== from) moveTo(from, to);
  };

  const remove = (index: number) => {
    const section = sections[index];
    setRemoved({ section, index });
    if (selected === section.id) onSelect(null);
    setSections(sections.filter((_, i) => i !== index));
    setAnnouncement(`${nameOf(section)} deleted.`);
  };

  const undo = () => {
    if (!removed) return;
    const next = [...sections];
    next.splice(Math.min(removed.index, next.length), 0, removed.section);
    setSections(next);
    onSelect(removed.section.id);
    pendingFocus.current = removed.section.id;
    setRemoved(null);
  };

  const add = (type: string) => {
    const section = newSection(type, screen, reference, published, catalogue);
    setSections([...sections, section]);
    setMenuOpen(false);
    onSelect(section.id);
    pendingFocus.current = section.id;
    setAnnouncement(`${nameOf(section)} added at the bottom. Use move up to place it.`);
  };

  const types = addableTypes(reference, screen.screen);

  return (
    <div className={styles.cards}>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>

      {sections.length ? null : <p className={styles.empty}>This screen has no sections. Add one below.</p>}

      <ol className={styles.cardList} aria-label={`Sections on ${screen.screen}, top to bottom`}>
        {sections.map((section, index) => {
          const definition = reference.sections[section.type];
          const open = selected === section.id;
          const name = nameOf(section);
          const summary = summaryOf(section);
          const issues = definition ? issuesOf(section.props ?? {}, definition.props) : [];
          const bodyId = `card-${section.id}`;
          return (
            <li
              key={section.id}
              ref={(node) => {
                if (node) items.current.set(section.id, node);
                else items.current.delete(section.id);
              }}
              className={styles.card}
              data-open={open || undefined}
              data-dragging={dragging === section.id || undefined}
            >
              <div className={styles.cardHead}>
                <span
                  className={styles.handle}
                  aria-hidden
                  title="Drag to reorder"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    setDragging(section.id);
                  }}
                  onPointerMove={(event) => {
                    if (dragging === section.id) dragOver(section.id, event.clientY);
                  }}
                  onPointerUp={() => setDragging(null)}
                  onPointerCancel={() => setDragging(null)}
                >
                  ⠿
                </span>
                <button
                  ref={(node) => {
                    if (node) heads.current.set(section.id, node);
                    else heads.current.delete(section.id);
                  }}
                  type="button"
                  className={styles.cardTitle}
                  aria-expanded={open}
                  aria-controls={bodyId}
                  onClick={() => onSelect(open ? null : section.id)}
                >
                  <strong>{name}</strong>
                  {summary ? <span>{summary}</span> : null}
                  {issues.length ? <span className={styles.cardIssue}>{issues.length} to fix</span> : null}
                </button>
                <span className={styles.rowActions}>
                  <button type="button" className={styles.icon} disabled={index === 0} aria-label={`Move ${name} up`} onClick={() => moveTo(index, index - 1)}>
                    ↑
                  </button>
                  <button type="button" className={styles.icon} disabled={index === sections.length - 1} aria-label={`Move ${name} down`} onClick={() => moveTo(index, index + 1)}>
                    ↓
                  </button>
                  <button type="button" className={styles.icon} aria-label={`Delete ${name}`} onClick={() => remove(index)}>
                    ✕
                  </button>
                </span>
              </div>
              {open ? (
                <div id={bodyId} className={styles.cardBody}>
                  {definition ? (
                    <>
                      {issues.length ? (
                        <ul className={styles.issues}>
                          {issues.map((issue) => (
                            <li key={issue.path.join(">") + issue.message}>
                              {issue.path.join(" › ")} {issue.message}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <Fields
                        values={section.props ?? {}}
                        rules={definition.props}
                        context={context}
                        onChange={(props) => setSections(sections.map((s) => (s.id === section.id ? { ...s, props } : s)))}
                      />
                    </>
                  ) : (
                    <p className={styles.fieldError}>
                      {section.type} is not a section this version knows. Delete it, or fix it in the JSON view.
                    </p>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {removed ? (
        <div className={styles.undo} role="status">
          {nameOf(removed.section)} deleted.
          <button type="button" className={styles.example} onClick={undo}>
            Undo
          </button>
        </div>
      ) : null}

      <div className={styles.addMenu}>
        <button type="button" className={styles.addButton} aria-expanded={menuOpen} aria-controls="add-section" onClick={() => setMenuOpen((v) => !v)}>
          + Add section
        </button>
        {menuOpen ? (
          <div id="add-section" className={styles.addPanel} role="group" aria-label="Section types">
            {types.map((type) => (
              // the thumbnail has real links, so it sits beside the button that covers it
              <div key={type} className={styles.addOption}>
                <Thumbnail brand={brand} catalogue={catalogue} section={newSection(type, screen, reference, published, catalogue)} />
                <button type="button" onClick={() => add(type)}>
                  {labelOf(type, reference.sections[type])}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** a miniature of the section, rendered by the real component */
function Thumbnail({ brand, catalogue, section }: { brand: string; catalogue?: Catalogue; section: Section }) {
  const Component = SECTIONS[section.type];
  const current = Object.keys(catalogue?.products ?? {})[0] ?? null;
  if (!Component) return <div className={styles.thumb} />;
  return (
    <div className={styles.thumb} aria-hidden>
      <div className={styles.thumbInner} style={{ width: FRAME_WIDTH, transform: `scale(${THUMB_WIDTH / FRAME_WIDTH})` }} inert>
        <BrandProvider brand={brand}>
          <StoreProvider brand={brand} catalogue={catalogue} current={current}>
            <div className="strata-screen" data-screen="thumbnail">
              <Component {...section.props} />
            </div>
          </StoreProvider>
        </BrandProvider>
      </div>
    </div>
  );
}
