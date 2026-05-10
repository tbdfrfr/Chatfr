import React from 'react';
import { normalizeProfilePicture } from '../../features/profile/profilePictureUtils.js';

export function UserLabel({ user, className = '' }) {
  const id = user?.id ?? '?';
  const name = user?.displayName || 'User';
  const classes = className ? `user-label ${className}` : 'user-label';

  return (
    <span className={classes}>
      <PixelAvatar profilePicture={user?.profilePicture} size="small" />
      <span className="user-label-name">{name}</span>
      <span className="user-label-number">{`#${id}`}</span>
    </span>
  );
}

function PixelAvatar({ profilePicture, size = 'small' }) {
  const classes = size === 'large' ? 'pixel-avatar large' : 'pixel-avatar';

  if (typeof profilePicture === 'string') {
    return (
      <span className={`${classes} image-avatar`} aria-hidden="true">
        <img className="pixel-avatar-image" src={profilePicture} alt="" />
      </span>
    );
  }

  const cells = normalizeProfilePicture(profilePicture);

  return (
    <span className={classes} aria-hidden="true">
      {cells.map((color, index) => (
        <span key={index} className={`pixel-cell ${color ? 'filled' : ''}`} style={color ? { background: color } : undefined} />
      ))}
    </span>
  );
}

