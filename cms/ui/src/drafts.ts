export interface LocalDraft {
  version: 1;
  name: string;
  content: string;
  baseSha: string | null;
  isNew: boolean;
  savedAt: string;
}

const PREFIX = "blog-cms:draft:v1:";

function key(name: string): string {
  return `${PREFIX}${window.location.host}:${name}`;
}

function validDraft(value: unknown, name: string): value is LocalDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Partial<LocalDraft>;
  return (
    draft.version === 1 &&
    draft.name === name &&
    typeof draft.content === "string" &&
    draft.content.length <= 1_000_000 &&
    typeof draft.isNew === "boolean" &&
    typeof draft.savedAt === "string" &&
    (draft.baseSha === null ||
      (typeof draft.baseSha === "string" && /^[0-9a-f]{40}$/.test(draft.baseSha)))
  );
}

export function readDraft(name: string): LocalDraft | undefined {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key(name)) ?? "null");
    return validDraft(value, name) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function writeDraft(draft: LocalDraft): boolean {
  try {
    window.localStorage.setItem(key(draft.name), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function removeDraft(name: string): void {
  try {
    window.localStorage.removeItem(key(name));
  } catch {
    // Browser storage is optional; editing must remain available without it.
  }
}
