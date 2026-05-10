const PROFILE_PICTURE_GRID_SIZE = 7;
const PROFILE_PICTURE_CELL_COUNT = PROFILE_PICTURE_GRID_SIZE * PROFILE_PICTURE_GRID_SIZE;
export const PROFILE_PICTURE_EMPTY = Array.from({ length: PROFILE_PICTURE_CELL_COUNT }, () => null);
export const DEFAULT_PROFILE_PICTURE_COLOR = '#0f0f0f';

export function normalizeProfilePicture(profilePicture) {
  if (typeof profilePicture === 'string' && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(profilePicture.trim())) {
    return profilePicture.trim();
  }

  if (!Array.isArray(profilePicture) || profilePicture.length !== PROFILE_PICTURE_CELL_COUNT) {
    return [...PROFILE_PICTURE_EMPTY];
  }

  return profilePicture.map(normalizeHexColor);
}

function normalizeHexColor(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const color = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : null;
}
