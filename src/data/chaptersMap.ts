export const CHAPTERS: Record<string, string> = {
  'the-other-side-of-zero': 'The Other Side of Zero',
  'lines-and-angles': 'Lines and Angles',
  'number-play': 'Number Play',
  'patterns-in-mathematics': 'Patterns in Mathematics',
  'prime-time': 'Prime Time',
  'playing-with-constructions': 'Playing with Constructions',
  'fractions': 'Fractions',
  'perimeter-and-area': 'Perimeter and Area',
};

export function toSlug(label: string | null | undefined): string | null {
  const s = (label || '').trim().toLowerCase();
  if (!s) return null;
  // try direct key match
  for (const [slug, disp] of Object.entries(CHAPTERS)) {
    if (disp.toLowerCase() === s) return slug;
  }
  // generic slugify
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function toLabel(input: string | null | undefined): string | null {
  const s = (input || '').trim();
  if (!s) return null;
  const key = s.toLowerCase();
  if (CHAPTERS[key]) return CHAPTERS[key];
  // maybe it's a display label already; try case-insensitive match
  for (const disp of Object.values(CHAPTERS)) {
    if (disp.toLowerCase() === key) return disp;
  }
  // fallback: capitalize words
  return s;
}
