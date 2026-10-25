export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

// The smallest single splice that turns `before` into `after`. Used to apply
// React state updates (draft restore, Pinned) without replacing the whole
// document, so the caret and undo history stay useful.
export function minimalChange(before: string, after: string): TextChange {
  if (before === after) return { from: 0, to: 0, insert: "" };

  const shortest = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < shortest && before[prefix] === after[prefix]) prefix++;

  let suffix = 0;
  while (
    suffix < shortest - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix++;
  }

  return {
    from: prefix,
    to: before.length - suffix,
    insert: after.slice(prefix, after.length - suffix),
  };
}
