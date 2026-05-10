import React from 'react';

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

export function PixelAvatar({ profilePicture, size = 'small' }) {
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

function normalizeProfilePicture(profilePicture) {
  if (typeof profilePicture === 'string' && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(profilePicture.trim())) {
    return profilePicture.trim();
  }

  if (!Array.isArray(profilePicture) || profilePicture.length !== 49) {
    return Array.from({ length: 49 }, () => null);
  }

  return profilePicture.map((cell) => {
    if (typeof cell !== 'string') {
      return null;
    }

    const color = cell.trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(color) ? color : null;
  });
}