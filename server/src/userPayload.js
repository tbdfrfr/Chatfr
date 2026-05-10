import { normalizeStoredProfilePicture } from './chatFormatting.js';

export function toUserPayload(user) {
  if (!user) {
    return null;
  }

  const userNumber = user.user_id ?? user.id;

  return {
    id: Number(userNumber),
    displayName: user.display_name,
    profilePicture: normalizeStoredProfilePicture(user.profile_picture),
    label: user.display_name || `#${userNumber}`
  };
}