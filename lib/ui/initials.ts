const AVATAR_COLORS = [
  { bg: "#fed7aa", text: "#c2410c" },
  { bg: "#fbbf24", text: "#78350f" },
  { bg: "#fecaca", text: "#991b1b" },
  { bg: "#d4c4a8", text: "#44403c" },
  { bg: "#fde68a", text: "#78350f" },
  { bg: "#fcd34d", text: "#92400e" },
] as const;

export function initialsFor(displayName: string | null, username: string): string {
  const source = (displayName ?? username).trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function colorFor(username: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
