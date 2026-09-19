/**
 * Display names as TWO INITIALS + SURNAME in capitals.
 * e.g. "Innocent Elihuruma Massay" → "IE MASSAY"
 *      "Kilasa Emmanuel Petro" → "KE PETRO"
 * Already-abbreviated forms like "IE MASSAY" are left as-is (uppercased).
 */
export function displayName(name: string | null | undefined): string {
  if (name == null || String(name).trim() === "") return "—";

  const cleaned = String(name).trim().replace(/\s+/g, " ");
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 0) return "—";

  // Already looks like initials + surname (1–3 letter first token)
  if (
    parts.length === 2 &&
    /^[A-Za-z]{1,3}\.?$/.test(parts[0].replace(/\./g, ""))
  ) {
    const initials = parts[0].replace(/\./g, "").toUpperCase();
    return `${initials} ${parts[1].toUpperCase()}`;
  }

  if (parts.length === 1) {
    return parts[0].toUpperCase();
  }

  if (parts.length === 2) {
    // One given name + surname → one initial + surname
    const initial = parts[0][0]?.toUpperCase() ?? "";
    return `${initial} ${parts[1].toUpperCase()}`.trim();
  }

  // Three or more: first two given-name initials + last surname
  const i1 = parts[0][0]?.toUpperCase() ?? "";
  const i2 = parts[1][0]?.toUpperCase() ?? "";
  const surname = parts[parts.length - 1].toUpperCase();
  return `${i1}${i2} ${surname}`;
}
