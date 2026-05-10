import React, { useState } from 'react';

const PROFILE_PICTURE_GRID_SIZE = 7;
const PROFILE_PICTURE_CELL_COUNT = PROFILE_PICTURE_GRID_SIZE * PROFILE_PICTURE_GRID_SIZE;
const PROFILE_PICTURE_EMPTY = Array.from({ length: PROFILE_PICTURE_CELL_COUNT }, () => null);
const PROFILE_PICTURE_PALETTE = ['#0f0f0f', '#ffffff', '#e63946', '#f4a261', '#f1fa8c', '#2a9d8f', '#457b9d', '#8338ec'];

export function ProfilePictureEditor({ value, onChange }) {
  const [selectedColor, setSelectedColor] = useState(PROFILE_PICTURE_PALETTE[0]);

  if (typeof value === 'string') {
    return (
      <div className="profile-picture-editor profile-picture-editor-image">
        <div className="profile-picture-image-frame">
          <img className="profile-picture-image" src={value} alt="Current profile picture" />
        </div>
        <div className="muted-text profile-picture-image-note">This account uses an image profile picture.</div>
        <button className="ghost" type="button" onClick={() => onChange([...PROFILE_PICTURE_EMPTY])}>Use pixel avatar</button>
      </div>
    );
  }

  const normalized = normalizeProfilePicture(value);

  const setCell = (index, color) => {
    const next = [...normalized];
    next[index] = color;
    onChange(next);
  };

  return (
    <div className="profile-picture-editor">
      <div className="editor-controls">
        <div className="palette-row" role="listbox" aria-label="Profile picture colors">
          {PROFILE_PICTURE_PALETTE.map((color) => (
            <button
              key={color}
              className={`color-swatch ${selectedColor === color ? 'active' : ''}`}
              type="button"
              style={{ backgroundColor: color }}
              onClick={() => setSelectedColor(color)}
              aria-label={`Use color ${color}`}
            />
          ))}
          <button className={`ghost ${selectedColor === null ? 'active-tool' : ''}`} type="button" onClick={() => setSelectedColor(null)} aria-label="Use eraser">
            Eraser
          </button>
          <button className="ghost" type="button" onClick={() => onChange([...PROFILE_PICTURE_EMPTY])}>Clear</button>
        </div>

        <div className="pixel-editor-grid" role="grid" aria-label="Profile picture editor">
          {normalized.map((color, index) => (
            <button
              key={index}
              type="button"
              className={`pixel-editor-cell ${color ? 'filled' : ''}`}
              style={color ? { background: color } : undefined}
              onClick={() => setCell(index, selectedColor)}
              onContextMenu={(event) => {
                event.preventDefault();
                setCell(index, null);
              }}
              title="Click to paint, right-click to erase"
            />
          ))}
        </div>

      </div>
    </div>
  );
}

export function normalizeProfilePicture(profilePicture) {
  if (typeof profilePicture === 'string' && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(profilePicture.trim())) {
    return profilePicture.trim();
  }

  if (!Array.isArray(profilePicture) || profilePicture.length !== PROFILE_PICTURE_CELL_COUNT) {
    return [...PROFILE_PICTURE_EMPTY];
  }

  return profilePicture.map((cell) => {
    if (typeof cell !== 'string') {
      return null;
    }

    const color = cell.trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(color) ? color : null;
  });
}