export const MAX_GROUP_MEMBER_COUNT = 100;

export const GROUP_NAME_COLOR_OPTIONS = ['#e63946', '#ff6b6b', '#f97316', '#ff9f1c', '#ffd166', '#f1fa8c', '#a3e635', '#06d6a0', '#2ec4b6', '#14b8a6', '#118ab2', '#3a86ff', '#073b4c', '#8b5cf6', '#8338ec', '#c77dff', '#b5179e', '#ff4fa3', '#ef476f', '#eeeeee'];

export const GROUP_NAME_FONT_OPTIONS = [
  { id: 'space-grotesk', label: 'Space Grotesk' },
  { id: 'nunito', label: 'Nunito' },
  { id: 'pacifico', label: 'Pacifico' },
  { id: 'playfair', label: 'Playfair' },
  { id: 'bebas-neue', label: 'Bebas Neue' },
  { id: 'oswald', label: 'Oswald' },
  { id: 'raleway', label: 'Raleway' },
  { id: 'merriweather', label: 'Merriweather' },
  { id: 'cinzel', label: 'Cinzel' },
  { id: 'rubik', label: 'Rubik' },
  { id: 'outfit', label: 'Outfit' },
  { id: 'manrope', label: 'Manrope' },
  { id: 'comfortaa', label: 'Comfortaa' },
  { id: 'caveat', label: 'Caveat' },
  { id: 'lobster', label: 'Lobster' },
  { id: 'anton', label: 'Anton' },
  { id: 'fira-code', label: 'Fira Code' },
  { id: 'ibm-plex-serif', label: 'IBM Plex Serif' },
  { id: 'josefin-sans', label: 'Josefin Sans' },
  { id: 'orbitron', label: 'Orbitron' }
];

export const DEFAULT_GROUP_NAME_COLOR = '#ffffff';
export const DEFAULT_GROUP_NAME_FONT = GROUP_NAME_FONT_OPTIONS[0].id;

export function normalizeGroupNameColor(value) {
  if (typeof value !== 'string') {
    return DEFAULT_GROUP_NAME_COLOR;
  }

  const color = value.trim().toLowerCase();
  return GROUP_NAME_COLOR_OPTIONS.includes(color) ? color : DEFAULT_GROUP_NAME_COLOR;
}

export function normalizeGroupNameFont(value) {
  if (typeof value !== 'string') {
    return DEFAULT_GROUP_NAME_FONT;
  }

  const font = value.trim().toLowerCase();
  return GROUP_NAME_FONT_OPTIONS.some((option) => option.id === font) ? font : DEFAULT_GROUP_NAME_FONT;
}

export function groupNameFontFamily(fontId) {
  switch (normalizeGroupNameFont(fontId)) {
    case 'nunito':
      return '"Nunito", "Segoe UI", sans-serif';
    case 'pacifico':
      return '"Pacifico", "Segoe UI", cursive';
    case 'playfair':
      return '"Playfair Display", Georgia, serif';
    case 'bebas-neue':
      return '"Bebas Neue", "Segoe UI", sans-serif';
    case 'oswald':
      return '"Oswald", "Segoe UI", sans-serif';
    case 'raleway':
      return '"Raleway", "Segoe UI", sans-serif';
    case 'merriweather':
      return '"Merriweather", Georgia, serif';
    case 'cinzel':
      return '"Cinzel", Georgia, serif';
    case 'rubik':
      return '"Rubik", "Segoe UI", sans-serif';
    case 'outfit':
      return '"Outfit", "Segoe UI", sans-serif';
    case 'manrope':
      return '"Manrope", "Segoe UI", sans-serif';
    case 'comfortaa':
      return '"Comfortaa", "Segoe UI", sans-serif';
    case 'caveat':
      return '"Caveat", "Segoe UI", cursive';
    case 'lobster':
      return '"Lobster", "Segoe UI", cursive';
    case 'anton':
      return '"Anton", "Segoe UI", sans-serif';
    case 'fira-code':
      return '"Fira Code", "Consolas", monospace';
    case 'ibm-plex-serif':
      return '"IBM Plex Serif", Georgia, serif';
    case 'josefin-sans':
      return '"Josefin Sans", "Segoe UI", sans-serif';
    case 'orbitron':
      return '"Orbitron", "Segoe UI", sans-serif';
    case 'space-grotesk':
    default:
      return '"Space Grotesk", "Segoe UI", sans-serif';
  }
}

export function getGroupNameStyle(thread) {
  return {
    color: normalizeGroupNameColor(thread?.nameColor),
    fontFamily: groupNameFontFamily(thread?.nameFont)
  };
}