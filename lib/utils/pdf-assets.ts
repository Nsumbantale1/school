const SCHOOL_LOGO_PATH = "/school-of-artillery.png";

/** Load a public asset as a data URL for jsPDF (client-side). */
export async function loadPublicImageDataUrl(
  path: string
): Promise<string | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function loadSchoolLogoDataUrl(): Promise<string | null> {
  return loadPublicImageDataUrl(SCHOOL_LOGO_PATH);
}

export { SCHOOL_LOGO_PATH };
