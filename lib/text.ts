const DEFAULT_TAGS = "#dir,@PowBoardBot";

function getTags(): string[] {
  const raw = process.env.FORWARD_TAGS ?? DEFAULT_TAGS;
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function containsAnyTag(text: string): boolean {
  const lower = text.toLowerCase();
  return getTags().some((tag) => lower.includes(tag.toLowerCase()));
}

export function stripTags(text: string): string {
  return getTags()
    .reduce((acc, tag) => {
      const regex = new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      return acc.replace(regex, "");
    }, text)
    .trim();
}
