import type { SessionUser } from "@/lib/auth";
import {
  formatPerformerAnswer,
  performerReferences,
  toolFindCourse,
  toolFindStudent,
  toolFindTopPerformers,
  toolStudentEnrollments,
  toolSystemCounts,
} from "./tools";
import { parseUserIntent } from "./nlu";
import { matchKnowledge } from "./knowledge";
import { studentPath } from "@/lib/utils";

export interface AssistantReference {
  label: string;
  href: string;
  detail?: string;
}

export interface AssistantResponse {
  answer: string;
  references: AssistantReference[];
  offline: true;
  source: "ai" | "database" | "knowledge" | "mixed" | "help";
  engine: "ollama" | "local-nlu";
}

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL ?? "llama3.2:3b";

export async function isOllamaReady(): Promise<{
  ok: boolean;
  model: string;
  models: string[];
}> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return { ok: false, model: OLLAMA_MODEL, models: [] };
    const data = (await res.json()) as {
      models?: { name: string }[];
    };
    const models = (data.models ?? []).map((m) => m.name);
    const hasModel = models.some(
      (n) => n === OLLAMA_MODEL || n.startsWith(`${OLLAMA_MODEL.split(":")[0]}:`)
    );
    return { ok: hasModel || models.length > 0, model: OLLAMA_MODEL, models };
  } catch {
    return { ok: false, model: OLLAMA_MODEL, models: [] };
  }
}

const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "find_top_student",
      description:
        "Find the best / first / second / third student by academic performance for a course or year. Use for questions like mwanafunzi wa kwanza, top student, best in ROGC.",
      parameters: {
        type: "object",
        properties: {
          courseCode: {
            type: "string",
            description: "Course code e.g. ROG, BCC, OBGC (ROGC means ROG)",
          },
          year: { type: "number", description: "Year e.g. 2026" },
          position: {
            type: "number",
            description: "1 = first, 2 = second, 3 = third",
          },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_student",
      description:
        "Search a student by army number or personal name. Use for: unamjuwa X, do you know X, who is X, find student X, KS ABDALLAH, MT 12345.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Name or army number only, e.g. KS ABDALLAH or MT 136983",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_course",
      description: "Find a course by code or name",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "system_counts",
      description: "Count students, courses, enrollments in the database",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function runTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "find_top_student": {
      const position =
        typeof args.position === "number" ? args.position : 1;
      const result = await toolFindTopPerformers({
        courseCode: (args.courseCode as string) || null,
        year: typeof args.year === "number" ? args.year : null,
        position: position <= 3 ? position : null,
        limit: typeof args.limit === "number" ? args.limit : 5,
      });
      // If they asked for position N, pick that row when ranked by position
      let rows = result.rows;
      if (result.rankedBy === "position" && position >= 1) {
        const exact = rows.filter((r) => r.position === position);
        if (exact.length) rows = exact;
        else rows = rows.slice(position - 1, position);
      } else if (result.rankedBy === "average") {
        rows = rows.slice(position - 1, position);
        if (!rows.length) rows = result.rows.slice(0, 1);
      }
      return { ...result, rows, requestedPosition: position };
    }
    case "find_student":
      return toolFindStudent(String(args.query ?? ""));
    case "find_course":
      return toolFindCourse(String(args.query ?? ""));
    case "system_counts":
      return toolSystemCounts();
    default:
      return { error: `Unknown tool ${name}` };
  }
}

async function formatStudentAnswer(
  query: string
): Promise<AssistantResponse | null> {
  const rows = await toolFindStudent(query);
  if (!rows.length) {
    return {
      offline: true,
      source: "database",
      engine: "local-nlu",
      answer: `Sijampata mwanafunzi anayefanana na "${query}" kwenye database.\n\nAngalia eja ya jina/army number, au sajili mwanafunzi kwanza.`,
      references: [{ label: "Sidebar → Students", href: "/students" }],
    };
  }

  const s = rows[0];
  const enrs = await toolStudentEnrollments(s.armyNumber);
  const lines = [
    `Ndiyo — nimepatikana kwenye database:`,
    ``,
    `${s.armyNumber}`,
    `${s.rank} ${s.fullName}`,
    s.unit ? `Unit: ${s.unit}` : null,
    s.phone ? `Phone: ${s.phone}` : null,
    ``,
    enrs.length ? `Enrollments:` : `Hakuna enrollment bado.`,
    ...enrs.map(
      (e) =>
        `• ${e.courseCode} ${e.intakeNumber} (${e.year}) — ${e.status}` +
        (e.position != null ? `, pos ${e.position}` : "") +
        (e.averageMarks ? `, avg ${e.averageMarks}%` : "") +
        (e.grade ? `, grade ${e.grade}` : "")
    ),
    rows.length > 1
      ? `\nWengine wanaofanana: ${rows
          .slice(1)
          .map((r) => `${r.rank} ${r.fullName} (${r.armyNumber})`)
          .join("; ")}`
      : null,
  ].filter(Boolean) as string[];

  return {
    offline: true,
    source: "database",
    engine: "local-nlu",
    answer: lines.join("\n"),
    references: [
      {
        label: `${s.rank} ${s.fullName}`,
        href: studentPath(s.armyNumber),
        detail: s.armyNumber,
      },
      {
        label: "Service Record",
        href: studentPath(s.armyNumber, "/service-record"),
      },
      ...enrs.slice(0, 3).map((e) => ({
        label: `${e.courseCode} ${e.intakeNumber}`,
        href: `/enrollments/${e.enrollmentId}`,
        detail: e.status,
      })),
      ...rows.slice(1, 4).map((r) => ({
        label: `${r.rank} ${r.fullName}`,
        href: studentPath(r.armyNumber),
        detail: r.armyNumber,
      })),
    ],
  };
}

function answerFromToolResult(
  toolName: string,
  result: unknown
): AssistantResponse | null {
  if (toolName === "find_top_student") {
    const data = result as {
      rows: Awaited<ReturnType<typeof toolFindTopPerformers>>["rows"];
      rankedBy: "position" | "average";
      requestedPosition?: number;
    };
    if (!data.rows?.length) {
      return {
        offline: true,
        source: "database",
        engine: "local-nlu",
        answer:
          "Sijapata mwanafunzi wa nafasi hiyo kwenye database kwa kozi/mwaka uliyouliza.\n\nHakikisha matokeo yameingizwa (Results → Import), kisha uliza tena.",
        references: performerReferences([]),
      };
    }
    const best = data.rows[0];
    const body = formatPerformerAnswer(best, {
      rankedBy: data.rankedBy,
      ordinal: data.requestedPosition ?? 1,
    });
    return {
      offline: true,
      source: "ai",
      engine: "local-nlu",
      answer: body,
      references: performerReferences(data.rows),
    };
  }

  if (toolName === "find_course") {
    const rows = result as Awaited<ReturnType<typeof toolFindCourse>>;
    if (!rows.length) return null;
    const c = rows[0];
    return {
      offline: true,
      source: "database",
      engine: "local-nlu",
      answer: `${c.courseCode}\n${c.courseName}\nDuration: ${c.durationWeeks} weeks\nPassing mark: ${c.passingMark}`,
      references: [
        {
          label: c.courseCode,
          href: `/courses/${c.courseId}`,
          detail: c.courseName,
        },
        {
          label: "Course Notices",
          href: `/course-notices/${c.courseId}`,
        },
      ],
    };
  }

  if (toolName === "system_counts") {
    const c = result as Awaited<ReturnType<typeof toolSystemCounts>>;
    return {
      offline: true,
      source: "database",
      engine: "local-nlu",
      answer: `Students: ${c.students}\nCourses: ${c.courses}\nEnrollments: ${c.enrollments}`,
      references: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Students", href: "/students" },
      ],
    };
  }

  return null;
}

async function askWithLocalNlu(
  message: string,
  user: SessionUser
): Promise<AssistantResponse> {
  const intent = parseUserIntent(message);

  if (intent.type === "find_student") {
    return (await formatStudentAnswer(intent.query))!;
  }

  if (intent.type === "top_student") {
    const toolResult = await runTool("find_top_student", {
      courseCode: intent.courseCode,
      year: intent.year,
      position: intent.position,
      limit: intent.limit,
    });
    const formatted = answerFromToolResult("find_top_student", toolResult);
    if (formatted) {
      formatted.engine = "local-nlu";
      return formatted;
    }
  }

  if (intent.type === "find_course") {
    const toolResult = await runTool("find_course", { query: intent.query });
    const formatted = answerFromToolResult("find_course", toolResult);
    if (formatted) return formatted;
  }

  if (intent.type === "stats") {
    const toolResult = await runTool("system_counts", {});
    const formatted = answerFromToolResult("system_counts", toolResult);
    if (formatted) return formatted;
  }

  const knowledge = matchKnowledge(message, user.role);
  if (knowledge.length) {
    const primary = knowledge[0];
    return {
      offline: true,
      source: "knowledge",
      engine: "local-nlu",
      answer: [
        primary.summary,
        primary.steps?.length
          ? `\nSteps:\n${primary.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
          : "",
      ].join("\n"),
      references: knowledge.map((e) => ({
        label: e.locationLabel,
        href: e.href,
        detail: e.title,
      })),
    };
  }

  return {
    offline: true,
    source: "help",
    engine: "local-nlu",
    answer: [
      "Sijaelewa swali hilo kikamilifu, au data haipo kwenye database.",
      "",
      "Jaribu hivi:",
      '• "Unamjuwa KS ABDALLAH?"',
      '• "Mwanafunzi wa kwanza katika ufaulu kozi ya ROGC"',
      '• "Top student BCC 2026"',
    ].join("\n"),
    references: [
      { label: "Students", href: "/students" },
      { label: "Top Performers", href: "/reports/top-performers" },
      { label: "Import Results", href: "/results/import" },
    ],
  };
}

async function askWithOllama(
  message: string,
  user: SessionUser,
  model: string
): Promise<AssistantResponse | null> {
  const system = `You are SOFA AI for School of Field Artillery (offline).
Rules:
- Use tools. Never invent students, ranks, or marks.
- "Unamjuwa X?" / "Do you know X?" / "Who is X?" → ALWAYS call find_student with query X.
- "Mwanafunzi wa kwanza / top student / best in ROGC" → call find_top_student.
- ROGC means course code ROG.
- User role: ${user.role}.`;

  type Msg = {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_calls?: Array<{
      id?: string;
      function: { name: string; arguments: string };
    }>;
  };

  const messages: Msg[] = [
    { role: "system", content: system },
    { role: "user", content: message },
  ];

  try {
    for (let step = 0; step < 4; step++) {
      const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          tools: TOOL_SCHEMAS,
          options: { temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!res.ok) return null;
      const data = (await res.json()) as { message?: Msg };
      const msg = data.message;
      if (!msg) return null;

      if (msg.tool_calls?.length) {
        messages.push(msg);
        for (const call of msg.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = {};
          }

          if (call.function.name === "find_student") {
            const formatted = await formatStudentAnswer(
              String(args.query ?? message)
            );
            if (formatted) {
              formatted.engine = "ollama";
              return formatted;
            }
          }

          const toolResult = await runTool(call.function.name, args);

          if (call.function.name === "find_top_student") {
            const formatted = answerFromToolResult(
              "find_top_student",
              toolResult
            );
            if (formatted) {
              formatted.engine = "ollama";
              formatted.source = "ai";
              return formatted;
            }
          }

          if (call.function.name === "find_course") {
            const formatted = answerFromToolResult("find_course", toolResult);
            if (formatted) {
              formatted.engine = "ollama";
              return formatted;
            }
          }

          messages.push({
            role: "tool",
            content: JSON.stringify(toolResult),
          });
        }
        continue;
      }

      // No tool call — do not return free-form hallucination
      return null;
    }
  } catch {
    return null;
  }

  return null;
}

export async function askAssistant(
  message: string,
  user: SessionUser
): Promise<AssistantResponse> {
  const trimmed = message.trim();
  if (!trimmed) {
    return {
      offline: true,
      source: "help",
      engine: "local-nlu",
      answer:
        'Uliza swali, mfano:\n"Unamjuwa KS ABDALLAH?"\nau\n"Mwanafunzi wa kwanza katika ufaulu kozi ya ROGC"',
      references: [
        { label: "Students", href: "/students" },
        { label: "Top Performers", href: "/reports/top-performers" },
      ],
    };
  }

  // Fact questions answered from DB first (no Ollama hallucination)
  const intent = parseUserIntent(trimmed);
  if (
    intent.type === "find_student" ||
    intent.type === "top_student" ||
    intent.type === "find_course" ||
    intent.type === "stats"
  ) {
    return askWithLocalNlu(trimmed, user);
  }

  const ollama = await isOllamaReady();
  if (ollama.ok) {
    const model =
      ollama.models.find((m) => m.includes("llama3")) ??
      ollama.models[0] ??
      ollama.model;
    const ai = await askWithOllama(trimmed, user, model);
    if (ai) return ai;
  }

  return askWithLocalNlu(trimmed, user);
}
