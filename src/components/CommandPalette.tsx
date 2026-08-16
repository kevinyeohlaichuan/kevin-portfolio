import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface PaletteItem {
  title: string;
  href: string;
  section: string;
  hint?: string;
}

interface Props {
  items: PaletteItem[];
}

/**
 * Ranked match. Substring beats initials beats subsequence, and a
 * subsequence only counts inside the title — matching stray letters across
 * the hint made "nls" return half the site.
 */
function score(query: string, item: PaletteItem): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const title = item.title.toLowerCase();

  if (title.startsWith(q)) return 1200;

  const inTitle = title.indexOf(q);
  if (inTitle !== -1) return 1000 - inTitle;

  // Initials, e.g. "nls" -> Nasi Lemak Survivors.
  const initials = item.title
    .split(/\s+/)
    .map((word) => word[0]?.toLowerCase() ?? "")
    .join("");
  if (initials.startsWith(q)) return 900;

  const inMeta = `${item.section} ${item.hint ?? ""}`.toLowerCase().indexOf(q);
  if (inMeta !== -1) return 700 - inMeta;

  // Ordered subsequence, title only, and only when it stays tight enough to
  // be intentional rather than coincidental.
  let cursor = 0;
  let first = -1;
  for (const char of q) {
    cursor = title.indexOf(char, cursor);
    if (cursor === -1) return -1;
    if (first === -1) first = cursor;
    cursor += 1;
  }
  const span = cursor - first;
  if (span > q.length * 3) return -1;
  return 400 - span;
}

export function CommandPalette({ items }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const searching = query.trim().length > 0;

  const results = useMemo(() => {
    if (!searching) return items;
    return items
      .map((item) => ({ item, rank: score(query.trim(), item) }))
      .filter((entry) => entry.rank >= 0)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 8)
      .map((entry) => entry.item);
  }, [items, query, searching]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const inField =
        event.target instanceof HTMLElement &&
        /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.key === "/" && !inField && !open) {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) {
      // Focus after the dialog paints so the caret lands correctly.
      const id = window.requestAnimationFrame(() => inputRef.current?.focus());
      document.documentElement.style.overflow = "hidden";
      return () => {
        window.cancelAnimationFrame(id);
        document.documentElement.style.overflow = "";
      };
    }
    document.documentElement.style.overflow = "";
    return undefined;
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (href: string) => {
    close();
    window.location.href = href;
  };

  const onFieldKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => (results.length ? (value + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) =>
        results.length ? (value - 1 + results.length) % results.length : 0,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = results[active];
      if (target) go(target.href);
    }
  };

  let lastSection = "";

  return (
    <>
      <button
        className="palette-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search the site"
      >
        <span aria-hidden="true">⌘</span>
        <span>K</span>
      </button>

      {open && (
        <div className="palette-scrim">
          {/*
            Pointer-only convenience. The keyboard path out is Escape, handled
            globally above, plus the explicit close button below — so this is
            not the sole way to dismiss the dialog.
          */}
          <button
            className="palette-dismiss"
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onMouseDown={close}
          />
          <div
            className="palette"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
          >
            <div className="palette-field">
              <span aria-hidden="true">⌕</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onFieldKey}
                placeholder="Search work, games and the universe…"
                aria-label="Search work, games and the universe"
                aria-controls="palette-results"
                aria-activedescendant={results[active] ? `palette-${active}` : undefined}
                autoComplete="off"
                spellCheck={false}
              />
              <kbd>esc</kbd>
            </div>

            <ul className="palette-results" id="palette-results" role="listbox" ref={listRef}>
              {results.length === 0 && (
                <li className="palette-empty">Nothing matches “{query}”.</li>
              )}
              {results.map((item, index) => {
                // Grouping headers only make sense on the unfiltered list.
                // Ranked results interleave sections, which made the same
                // header repeat down the list.
                const showSection = !searching && item.section !== lastSection;
                lastSection = item.section;
                return (
                  <li key={item.href}>
                    {showSection && <p className="palette-section">{item.section}</p>}
                    <a
                      id={`palette-${index}`}
                      href={item.href}
                      role="option"
                      aria-selected={index === active}
                      data-active={index === active}
                      onMouseEnter={() => setActive(index)}
                      onClick={(event) => {
                        event.preventDefault();
                        go(item.href);
                      }}
                    >
                      <strong>{item.title}</strong>
                      {item.hint && <span>{item.hint}</span>}
                    </a>
                  </li>
                );
              })}
            </ul>

            <div className="palette-footer">
              <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span><kbd>↵</kbd> open</span>
              <span><kbd>/</kbd> search</span>
              <button className="palette-close" type="button" onClick={close}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
