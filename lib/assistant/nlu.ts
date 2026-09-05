import { detectCourseInText } from "./tools";

export type AgentIntent =
  | {
      type: "top_student";
      courseCode?: string | null;
      year?: number | null;
      position: number;
      limit: number;
    }
  | { type: "find_student"; query: string }
  | { type: "find_course"; query: string }
  | { type: "stats" }
  | { type: "howto"; query: string }
  | { type: "unknown"; query: string };

const STOP_WORDS = new Set([
  "unamjuwa",
  "unajua",
  "unamjua",
  "je",
  "do",
  "you",
  "know",
  "who",
  "is",
  "nani",
  "ni",
  "find",
  "tafuta",
  "show",
  "get",
  "student",
  "mwanafunzi",
  "about",
  "habari",
  "za",
  "ya",
  "wa",
  "na",
  "the",
  "a",
  "an",
  "me",
  "please",
  "tafadhali",
]);

/** Pull a person name / army number out of conversational Swahili/English. */
export function extractPersonQuery(raw: string): string | null {
  const text = raw.trim().replace(/[?؟!.]+$/g, "").trim();
  if (!text) return null;

  const patterns = [
    /(?:unamjuwa|unajua|unamjua|je\s*unamjua|do\s*you\s*know|who\s*is|nani\s*ni|habari\s*za|tafuta|find|show|get)\s+(.+)/i,
    /(?:student|mwanafunzi|army\s*number)\s+(.+)/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const cleaned = m[1]
        .replace(/[?؟!.]+$/g, "")
        .replace(/\b(huyo|yule|that|person|mwanafunzi|student)\b/gi, "")
        .trim();
      if (cleaned.length >= 2) return cleaned;
    }
  }

  // Bare name / army number (2+ chars, not a how-to question)
  if (
    !/(how|wapi|where|jinsi|import|certificate|bora|kwanza|ufaulu|top\s*student)/i.test(
      text
    ) &&
    /^[A-Za-z0-9][A-Za-z0-9\s.\-]{1,80}$/.test(text)
  ) {
    const tokens = text.split(/\s+/).filter((t) => !STOP_WORDS.has(t.toLowerCase()));
    if (tokens.length >= 1 && tokens.join(" ").length >= 2) {
      return tokens.join(" ");
    }
  }

  return null;
}

/**
 * Local NLU for academic Swahili/English.
 * Person lookup is checked BEFORE top-student so
 * "unamjuwa KS ABDALLAH?" never becomes "best student".
 */
export function parseUserIntent(raw: string): AgentIntent {
  const text = raw.trim();
  const q = text.toLowerCase();

  if (
    /^(help|hi|hello|habari|mambo|nini unaweza|what can you)\b/.test(q) ||
    q === "?"
  ) {
    return { type: "howto", query: text };
  }

  if (
    /(how many|idadi|jumla|stats|overview|statistics)/i.test(q) &&
    /(student|course|enrollment|wanafunzi|kozi)/i.test(q)
  ) {
    return { type: "stats" };
  }

  // 1) Person / student lookup first
  const isPersonAsk =
    /(unamjuwa|unajua|unamjua|do\s*you\s*know|who\s*is|nani\s*(ni|yuko)|habari\s*za|tafuta|find\s+student|mwanafunzi|army\s*number)/i.test(
      q
    ) ||
    (/^(ks|mt|sn|p)\s*[\d\w]/i.test(q) &&
      !/(bora|kwanza|ufaulu|top|best)/i.test(q));

  if (isPersonAsk || extractPersonQuery(text)) {
    // Only skip if it's clearly a ranking question with a course
    const clearlyTop =
      /(wa\s*kwanza\s*katika\s*ufaulu|top\s*student|best\s*student|nafasi\s*ya\s*kwanza|bora\s+(katika|wa|ya)?\s*(kozi|course)?)/i.test(
        q
      ) && detectCourseInText(q);

    if (!clearlyTop) {
      const person = extractPersonQuery(text);
      if (person && person.length >= 2) {
        return { type: "find_student", query: person };
      }
    }
  }

  // Position ordinals (Swahili + English)
  let position = 1;
  if (
    /(wa\s*pili|ya\s*pili|second|nafasi\s*ya\s*2|position\s*2|\b2nd\b)/i.test(q)
  ) {
    position = 2;
  } else if (
    /(wa\s*tatu|ya\s*tatu|third|nafasi\s*ya\s*3|position\s*3|\b3rd\b)/i.test(q)
  ) {
    position = 3;
  } else if (/(position|nafasi)\s*(\d+)/i.test(q)) {
    position = parseInt(q.match(/(?:position|nafasi)\s*(\d+)/i)![1], 10);
  }

  const yearMatch = q.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
  const courseCode = detectCourseInText(q);

  const isTopQuery =
    /(mwanafunzi\s*wa\s*kwanza|wa\s*kwanza\s*katika\s*ufaulu|top\s*student|best\s*student|first\s*position|nafasi\s*ya\s*kwanza|top\s*perform|highest\s*mark)/i.test(
      q
    ) ||
    (/\bbora\b/i.test(q) &&
      /(mwanafunzi|student|kozi|course|ufaulu|intake)/i.test(q)) ||
    (/(kwanza|first|1st)/i.test(q) &&
      /(mwanafunzi|student|ufaulu|kozi|course)/i.test(q)) ||
    (/(wa\s*pili|wa\s*tatu)/i.test(q) &&
      /(mwanafunzi|student|ufaulu|kozi|course)/i.test(q));

  if (isTopQuery) {
    return {
      type: "top_student",
      courseCode,
      year,
      position,
      limit: position <= 3 ? 5 : 10,
    };
  }

  if (
    /(how|wapi|where|jinsi|hatua|step|import|certificate|cheti|notice|notisi|backup|password)/i.test(
      q
    )
  ) {
    return { type: "howto", query: text };
  }

  if (/(course|kozi)\b/i.test(q) && courseCode) {
    return { type: "find_course", query: courseCode };
  }

  // Bare course code only
  if (/^(bcc|rogc?|obgc|rsoc|aat|mgcc)$/i.test(text.trim())) {
    return { type: "find_course", query: courseCode ?? text.trim() };
  }

  // Last: treat leftover name-like text as student search
  const maybePerson = extractPersonQuery(text) ?? text.replace(/[?؟!.]+$/g, "").trim();
  if (
    maybePerson.length >= 3 &&
    !/(how|where|wapi|import|certificate)/i.test(maybePerson)
  ) {
    return { type: "find_student", query: maybePerson };
  }

  return { type: "unknown", query: text };
}
