const PROFILE_PICTURE_GRID_SIZE = 7;
const PROFILE_PICTURE_CELL_COUNT = PROFILE_PICTURE_GRID_SIZE * PROFILE_PICTURE_GRID_SIZE;
export const MAX_GROUP_MEMBER_COUNT = 100;
const GROUP_NAME_FONT_OPTIONS = new Set(['space-grotesk', 'nunito', 'pacifico', 'playfair', 'bebas-neue', 'oswald', 'raleway', 'merriweather', 'cinzel', 'rubik', 'outfit', 'manrope', 'comfortaa', 'caveat', 'lobster', 'anton', 'fira-code', 'ibm-plex-serif', 'josefin-sans', 'orbitron']);
const GROUP_NAME_COLOR_OPTIONS = new Set(['#e63946', '#ff6b6b', '#f97316', '#ff9f1c', '#ffd166', '#f1fa8c', '#a3e635', '#06d6a0', '#2ec4b6', '#14b8a6', '#118ab2', '#3a86ff', '#073b4c', '#8b5cf6', '#8338ec', '#c77dff', '#b5179e', '#ff4fa3', '#ef476f', '#eeeeee']);
const DEFAULT_GROUP_NAME_FONT = 'space-grotesk';
const DEFAULT_GROUP_NAME_COLOR = '#eeeeee';
export const TBD_ACCOUNT_ID = 1;

export function isImageProfilePicture(value) {
  return typeof value === 'string' && value.trim().startsWith('data:image/');
}

export function normalizeProfilePictureInput(value, { allowImage = false } = {}) {
  if (isImageProfilePicture(value)) {
    if (!allowImage) {
      throw new Error('Only the tbd account can use image avatars.');
    }

    return value.trim();
  }

  if (!Array.isArray(value) || value.length !== PROFILE_PICTURE_CELL_COUNT) {
    throw new Error(`Profile picture must be a ${PROFILE_PICTURE_GRID_SIZE}x${PROFILE_PICTURE_GRID_SIZE} grid.`);
  }

  return value.map((cell) => {
    if (cell === null || cell === '') {
      return null;
    }

    if (typeof cell !== 'string') {
      throw new Error('Profile picture cells must be a hex color or blank.');
    }

    const color = cell.trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(color)) {
      throw new Error('Profile picture colors must use 6-digit hex format like #1a2b3c.');
    }

    return color;
  });
}

export function normalizeStoredProfilePicture(value) {
  if (isImageProfilePicture(value)) {
    return value.trim();
  }

  if (!Array.isArray(value) || value.length !== PROFILE_PICTURE_CELL_COUNT) {
    return null;
  }

  return value.map((cell) => {
    if (typeof cell !== 'string') {
      return null;
    }

    const color = cell.trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(color) ? color : null;
  });
}

export function normalizeGroupNameColor(value) {
  if (typeof value !== 'string') {
    return DEFAULT_GROUP_NAME_COLOR;
  }

  const color = value.trim().toLowerCase();
  return GROUP_NAME_COLOR_OPTIONS.has(color) ? color : DEFAULT_GROUP_NAME_COLOR;
}

export function normalizeGroupNameFont(value) {
  if (typeof value !== 'string') {
    return DEFAULT_GROUP_NAME_FONT;
  }

  const font = value.trim().toLowerCase();
  return GROUP_NAME_FONT_OPTIONS.has(font) ? font : DEFAULT_GROUP_NAME_FONT;
}
