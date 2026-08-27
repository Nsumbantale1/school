"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Search,
  User,
  BookOpen,
  Calendar,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  type: "student" | "course" | "intake";
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
        setSelectedIndex(0);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results[selectedIndex]) {
          navigateTo(results[selectedIndex].url);
        }
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  };

  const navigateTo = (url: string) => {
    setOpen(false);
    router.push(url);
  };

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "student":
        return <User className="h-4 w-4" />;
      case "course":
        return <BookOpen className="h-4 w-4" />;
      case "intake":
        return <Calendar className="h-4 w-4" />;
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border bg-background hover:bg-muted"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Search...</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Search dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">Global Search</DialogTitle>
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by name or army number..."
              className="border-0 focus-visible:ring-0 px-3"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>

          {/* Results */}
          <div className="max-h-[300px] overflow-y-auto">
            {query && results.length === 0 && !loading && (
              <div className="p-6 text-center text-muted-foreground">
                No results found for &quot;{query}&quot;
              </div>
            )}

            {results.length > 0 && (
              <div className="py-2">
                {results.map((result, index) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => navigateTo(result.url)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors",
                      index === selectedIndex && "bg-muted"
                    )}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-sm text-muted-foreground truncate">
                          {result.subtitle}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {!query && (
              <div className="p-6 text-center text-muted-foreground">
                <p>Type a student name or army number</p>
              </div>
            )}
          </div>

          {/* Footer with keyboard hints */}
          <div className="flex items-center justify-end gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <kbd className="rounded border px-1.5 py-0.5">↑</kbd>
              <kbd className="rounded border px-1.5 py-0.5">↓</kbd>
              <span>to navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="rounded border px-1.5 py-0.5">↵</kbd>
              <span>to select</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="rounded border px-1.5 py-0.5">esc</kbd>
              <span>to close</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
