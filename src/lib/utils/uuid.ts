/**
 * UUID Utility for PureTools
 * Handles generation, validation, and metadata extraction.
 */

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function getUUIDVersion(uuid: string): number | null {
  if (!validateUUID(uuid)) {
    return null;
  }
  return Number.parseInt(uuid.charAt(14), 10);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Failed to copy text: ", err);
    return false;
  }
}
