"use client";

import { useSyncExternalStore } from "react";
import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PALETTE,
  PALETTES,
  PALETTE_STORAGE_KEY,
  isPaletteId,
  type PaletteId,
} from "@/lib/palettes";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readPalette(): PaletteId {
  const value = document.documentElement.getAttribute("data-palette");
  return isPaletteId(value) ? value : DEFAULT_PALETTE;
}

function applyPalette(id: PaletteId) {
  const root = document.documentElement;
  if (id === DEFAULT_PALETTE) root.removeAttribute("data-palette");
  else root.setAttribute("data-palette", id);
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, id);
  } catch {
    // Private mode: palette still applies for this page view.
  }
  listeners.forEach((l) => l());
}

export function PaletteSwitcher({ className }: { className?: string }) {
  const current = useSyncExternalStore(subscribe, readPalette, () => DEFAULT_PALETTE);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-8", className)}
          title="Change colour theme"
          aria-label="Change colour theme"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-60">
        <DropdownMenuLabel>Colour theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PALETTES.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => applyPalette(p.id)}
            className="gap-3 py-2"
          >
            <span className="flex shrink-0 overflow-hidden rounded-md ring-1 ring-foreground/10">
              {p.swatches.map((c) => (
                <span key={c} className="h-6 w-3" style={{ backgroundColor: c }} />
              ))}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-sm font-medium">{p.label}</span>
              <span className="block text-xs text-muted-foreground">{p.description}</span>
            </span>
            {current === p.id && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
