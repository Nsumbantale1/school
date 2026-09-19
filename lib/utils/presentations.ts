export type PresentationCategory = "officers" | "other_ranks" | "external";

export const PRESENTATION_CATEGORIES: Array<{
  key: PresentationCategory;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  tab: string;
  glow: string;
}> = [
  {
    key: "officers",
    title: "Officer Courses",
    subtitle: "Maafisa",
    description:
      "Briefs and lectures delivered on officer courses (FAOC, ROGC, BCC, OBGC…).",
    accent: "from-[#1a5c2e] to-[#2d8a45]",
    tab: "bg-[#1a5c2e]",
    glow: "group-hover:shadow-[0_16px_40px_-12px_rgba(26,92,46,0.55)]",
  },
  {
    key: "other_ranks",
    title: "Other Ranks",
    subtitle: "Askari",
    description:
      "Presentations for other-ranks courses (ARTYMAN, AATC, ARTY-TECH, GT…).",
    accent: "from-[#3d5a1f] to-[#6b8a2f]",
    tab: "bg-[#3d5a1f]",
    glow: "group-hover:shadow-[0_16px_40px_-12px_rgba(61,90,31,0.55)]",
  },
  {
    key: "external",
    title: "External Briefs",
    subtitle: "Nje ya SOFA",
    description:
      "Presentations delivered by SOFA instructors outside the school.",
    accent: "from-[#0f4c5c] to-[#1a7a8c]",
    tab: "bg-[#0f4c5c]",
    glow: "group-hover:shadow-[0_16px_40px_-12px_rgba(15,76,92,0.55)]",
  },
];

export function getPresentationCategory(key: string) {
  return PRESENTATION_CATEGORIES.find((c) => c.key === key) ?? null;
}

export function isPresentationCategory(
  value: string
): value is PresentationCategory {
  return PRESENTATION_CATEGORIES.some((c) => c.key === value);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
