import React from 'react';
import { normalizeProfilePicture } from '../../features/profile/profilePictureUtils.js';

function UserAvatar({ profilePicture }) {
  if (typeof profilePicture === 'string') {
    return (
      <span className="pixel-avatar image-avatar" aria-hidden="true">
        <img className="pixel-avatar-image" src={profilePicture} alt="" />
      </span>
    );
  }

  const cells = normalizeProfilePicture(profilePicture);

  return (
    <span className="pixel-avatar" aria-hidden="true">
      {cells.map((color, index) => (
        <span key={index} className={`pixel-cell ${color ? 'filled' : ''}`} style={color ? { background: color } : undefined} />
      ))}
    </span>
  );
}

export function UserLabel({ user, className = '' }) {
  const id = user?.id ?? '?';
  const name = user?.displayName || 'User';
  const classes = className ? `user-label ${className}` : 'user-label';

  return (
    <span className={classes}>
      <UserAvatar profilePicture={user?.profilePicture} />
      <span className="user-label-name">{name}</span>
      <span className="user-label-number">{`#${id}`}</span>
    </span>
  );
}
