import { useEffect, useId, useMemo, useRef, useState } from "react";

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function customerFullName(c) {
  return `${c.first_name || ""} ${c.last_name || ""}`.trim();
}

function customerDisplayLabel(c) {
  const name = customerFullName(c);
  const mobile = String(c.mobile || "").trim();
  return mobile ? `${name} — ${mobile}` : name;
}

export function filterCustomers(customers, query) {
  const q = String(query || "").trim();
  if (!q) return customers;

  const lower = q.toLowerCase();
  const qDigits = normalizeDigits(q);

  return customers.filter((c) => {
    const first = String(c.first_name || "").toLowerCase();
    const last = String(c.last_name || "").toLowerCase();
    const full = `${first} ${last}`.trim();
    const mobile = String(c.mobile || "").toLowerCase();
    const mobileDigits = normalizeDigits(c.mobile);
    const city = String(c.city || "").toLowerCase();

    return (
      first.includes(lower) ||
      last.includes(lower) ||
      full.includes(lower) ||
      mobile.includes(lower) ||
      (qDigits.length > 0 && mobileDigits.includes(qDigits)) ||
      city.includes(lower)
    );
  });
}

export default function CustomerSearchSelect({
  customers = [],
  value = "",
  onChange,
  disabled = false,
  error = "",
  onBlurValidate,
  inputId,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const selected = useMemo(
    () => customers.find((c) => String(c.id) === String(value)) || null,
    [customers, value]
  );

  const filtered = useMemo(() => filterCustomers(customers, query), [customers, query]);

  useEffect(() => {
    if (selected) {
      setQuery(customerDisplayLabel(selected));
    } else if (!value) {
      setQuery("");
    }
  }, [selected, value]);

  useEffect(() => {
    const onDocPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setHighlightIndex(-1);
      }
    };
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("touchstart", onDocPointer, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("touchstart", onDocPointer);
    };
  }, []);

  const selectCustomer = (c) => {
    onChange?.(String(c.id));
    setQuery(customerDisplayLabel(c));
    setOpen(false);
    setHighlightIndex(-1);
  };

  const handleInputChange = (e) => {
    const next = e.target.value;
    setQuery(next);
    setOpen(true);
    setHighlightIndex(-1);
    if (selected && next !== customerDisplayLabel(selected)) {
      onChange?.("");
    }
  };

  const handleFocus = () => {
    setOpen(true);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      if (!open) onBlurValidate?.(query, value);
    }, 150);
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      setHighlightIndex(-1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && open && highlightIndex >= 0 && filtered[highlightIndex]) {
      e.preventDefault();
      selectCustomer(filtered[highlightIndex]);
    }
  };

  const showList = open && !disabled;
  const showEmpty = showList && query.trim() && filtered.length === 0;

  return (
    <div ref={rootRef} className="relative mt-1">
      <input
        id={inputId}
        ref={inputRef}
        type="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        disabled={disabled}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={error ? "true" : undefined}
        placeholder="Search by name, mobile, or city…"
        className={`block w-full rounded-lg border px-3 py-3 text-base text-slate-900 sm:py-2 sm:text-sm ${
          error ? "border-red-400 focus:border-red-500 focus:ring-red-500" : "border-slate-300"
        }`}
        value={query}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filtered.length ? (
            filtered.map((c, idx) => {
              const active = idx === highlightIndex;
              return (
                <li key={c.id} role="option" aria-selected={String(c.id) === String(value)}>
                  <button
                    type="button"
                    className={`flex w-full flex-col gap-0.5 px-3 py-3 text-left sm:py-2.5 ${
                      active ? "bg-emerald-50" : "hover:bg-slate-50 active:bg-slate-100"
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectCustomer(c)}
                  >
                    <span className="text-sm font-semibold text-slate-900">{customerFullName(c)}</span>
                    <span className="text-xs text-slate-600">
                      {c.mobile || "No mobile"}
                      {c.city ? ` · ${c.city}` : ""}
                    </span>
                  </button>
                </li>
              );
            })
          ) : null}
          {showEmpty ? (
            <li className="px-3 py-3 text-sm text-slate-500 sm:py-2.5">No customers found</li>
          ) : null}
          {!query.trim() && !filtered.length ? (
            <li className="px-3 py-3 text-sm text-slate-500 sm:py-2.5">No customers yet</li>
          ) : null}
        </ul>
      ) : null}

      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
