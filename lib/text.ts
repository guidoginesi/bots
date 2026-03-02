const DEFAULT_TAGS = "#dir,@PowBoardBot";

function getTags(): string[] {
  const raw = process.env.FORWARD_TAGS ?? DEFAULT_TAGS;
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function containsAnyTag(text: string): boolean {
  return getTags().some((tag) => text.includes(tag));
}

export function stripTags(text: string): string {
  return getTags()
    .reduce((acc, tag) => acc.replaceAll(tag, ""), text)
    .trim();
}
