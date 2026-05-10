import { readFile } from 'node:fs/promises';
import {
  TBD_ACCOUNT_ID,
  normalizeProfilePictureInput,
  isImageProfilePicture
} from './chatFormatting.js';

export const TBD_ACCOUNT_IMAGE_URL = new URL('../../IMG_1687.JPG', import.meta.url);

export function createProfileDomain({ pool }) {
  async function seedTbdAccountProfilePicture() {
    const result = await pool.query('SELECT profile_picture FROM users WHERE id = $1', [TBD_ACCOUNT_ID]);
    const current = result.rows[0]?.profile_picture;

    if (isImageProfilePicture(current)) {
      return;
    }

    const imageBytes = await readFile(TBD_ACCOUNT_IMAGE_URL);
    const imageData = `data:image/jpeg;base64,${imageBytes.toString('base64')}`;
    const profilePicture = normalizeProfilePictureInput(imageData, { allowImage: true });

    await pool.query('UPDATE users SET profile_picture = $1::jsonb WHERE id = $2', [JSON.stringify(profilePicture), TBD_ACCOUNT_ID]);
  }

  return {
    seedTbdAccountProfilePicture
  };
}