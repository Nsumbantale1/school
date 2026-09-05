"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Loader2,
  MapPin,
  MessageCircle,
  Send,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AssistantReference {
  label: string;
  href: string;
  detail?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  references?: AssistantReference[];
  engine?: string;
}

const SUGGESTIONS = [
  "Unamjuwa KS ABDALLAH?",
  "Mwanafunzi wa kwanza katika ufaulu kozi ya ROGC",
  "Top student BCC 2026",
  "How do I import results?",
];

export function SofaAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [ollamaReady, setOllamaReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: [
        "SOFA AI — ninaelewa maelekezo na kutafuta jibu kwenye database ya mfumo huu.",
        "",
        "Mfano:",
        "Mwanafunzi wa kwanza katika ufaulu kozi ya ROGC",
        "",
        "Jibu litakuwa kama:",
        "P 13453",
        "Capt Juma Ally",
        "Position: 1",
        "Course: ROG — ...",
      ].join("\n"),
      references: [
        { label: "Top Performers", href: "/reports/top-performers" },
        { label: "Students", href: "/students" },
      ],
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/assistant")
      .then((r) => r.json())
      .then((d) => setOllamaReady(!!d.ollamaReady))
      .catch(() => setOllamaReady(false));
  }, [open]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages, pending]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text: message },
    ]);
    setPending(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (typeof data.ollamaReady === "boolean") {
        setOllamaReady(data.ollamaReady);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: data.answer ?? data.error ?? "No response.",
          references: data.references ?? [],
          engine: data.engine,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: "Request failed. Keep the app running (npm run dev).",
          references: [],
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="icon"
        className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full shadow-lg"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open SOFA AI"
        title="SOFA AI (Ctrl+Shift+A)"
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </Button>

      <div
        className={cn(
          "fixed bottom-20 right-5 z-50 flex w-[min(100vw-1.5rem,26rem)] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl transition-all",
          open
            ? "h-[min(75vh,36rem)] opacity-100"
            : "pointer-events-none h-0 opacity-0"
        )}
      >
        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2.5">
          <Bot className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">SOFA AI</p>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <WifiOff className="h-3 w-3" />
              {ollamaReady
                ? "Local LLM (Ollama) + database"
                : "Offline NLU + database (install Ollama for full LLM)"}
            </p>
          </div>
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[95%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              <p>{m.text}</p>
              {m.references && m.references.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-border/60 pt-2">
                  <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    Open in system
                  </p>
                  {m.references.map((r, i) => (
                    <Link
                      key={`${m.id}-${i}`}
                      href={r.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-accent"
                    >
                      <span className="font-medium text-primary">{r.label}</span>
                      {r.detail && (
                        <span className="block text-muted-foreground">
                          {r.detail}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          {pending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Inaelewa swali na kutafuta kwenye database…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {!pending && messages.length <= 2 && (
          <div className="flex flex-wrap gap-1.5 border-t px-3 py-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border px-2 py-0.5 text-left text-[11px] hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="flex gap-2 border-t p-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Andika maelekezo yako…"
            disabled={pending}
            className="h-9"
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={pending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </>
  );
}
