"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  searchText?: string;
}

interface SearchableSelectProps {
  name: string;
  options: SearchableSelectOption[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

export function SearchableSelect({
  name,
  options,
  defaultValue,
  value: valueProp,
  onValueChange,
  placeholder = "Select...",
  emptyText = "No results",
  disabled,
  required,
  id,
}: SearchableSelectProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const isControlled = valueProp !== undefined;
  const value = isControlled ? valueProp : internal;
  const setValue = React.useCallback(
    (v: string) => {
      if (!isControlled) setInternal(v);
      onValueChange?.(v);
    },
    [isControlled, onValueChange],
  );
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selected = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      (o.searchText ?? o.label).toLowerCase().includes(q),
    );
  }, [options, query]);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  React.useEffect(() => {
    if (open) {
      setHighlight(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${highlight}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function pick(val: string) {
    setValue(val);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) pick(opt.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "border-input bg-background ring-offset-background flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm",
          "focus:ring-ring focus:outline-none focus:ring-2 focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span
          className={cn(
            "truncate text-left",
            !selected && "text-muted-foreground",
          )}
        >
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {selected && !disabled && (
            <X
              className="text-muted-foreground hover:text-foreground h-4 w-4"
              onClick={(e) => {
                e.stopPropagation();
                setValue("");
              }}
            />
          )}
          <ChevronsUpDown className="text-muted-foreground h-4 w-4 shrink-0" />
        </div>
      </button>

      {open && (
        <div className="bg-popover text-popover-foreground absolute z-50 mt-1 w-full overflow-hidden rounded-md border shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="text-muted-foreground mr-2 h-4 w-4 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search..."
              className="placeholder:text-muted-foreground flex h-10 w-full bg-transparent py-3 text-sm outline-none"
            />
          </div>
          <div ref={listRef} className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="text-muted-foreground py-6 text-center text-sm">
                {emptyText}
              </div>
            ) : (
              filtered.map((opt, i) => (
                <div
                  key={opt.value}
                  data-idx={i}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(opt.value)}
                  className={cn(
                    "relative flex cursor-pointer items-center rounded-sm py-1.5 pl-8 pr-2 text-sm",
                    i === highlight && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
                    {opt.value === value && <Check className="h-4 w-4" />}
                  </span>
                  {opt.label}
                </div>
              ))
            )}
          </div>
          <div className="text-muted-foreground border-t px-3 py-1.5 text-xs">
            {filtered.length} of {options.length}
          </div>
        </div>
      )}
    </div>
  );
}
