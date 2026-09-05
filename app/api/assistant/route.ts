import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { askAssistant, isOllamaReady } from "@/lib/assistant/agent";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ollama = await isOllamaReady();
  return NextResponse.json({
    offline: true,
    ollamaReady: ollama.ok,
    model: ollama.model,
    models: ollama.models,
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (message.length > 800) {
    return NextResponse.json(
      { error: "Message is too long (max 800 characters)." },
      { status: 400 }
    );
  }

  try {
    const result = await askAssistant(message, user);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Assistant error:", error);
    return NextResponse.json(
      {
        offline: true,
        source: "help",
        engine: "local-nlu",
        answer:
          "Hitilafu ya database. Hakikisha DATABASE_URL inafanya kazi. Kwa PC offline kabisa, tumia PostgreSQL ya local.",
        references: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Backup", href: "/settings/backup" },
        ],
      },
      { status: 200 }
    );
  }
}
