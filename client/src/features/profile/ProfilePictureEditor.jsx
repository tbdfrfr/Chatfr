import { useState } from 'react';
import {
  DEFAULT_PROFILE_PICTURE_COLOR,
  PROFILE_PICTURE_EMPTY,
  normalizeProfilePicture
} from '../../lib/profilePictureUtils.js';

export function ProfilePictureEditor({ value, onChange }) {
  const [selectedHsv, setSelectedHsv] = useState(() => hexToHsv(DEFAULT_PROFILE_PICTURE_COLOR));
  const [isErasing, setIsErasing] = useState(false);

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
  const selectedColor = hsvToHex(selectedHsv.hue, selectedHsv.saturation, selectedHsv.value);
  const fullValueColor = hsvToHex(selectedHsv.hue, selectedHsv.saturation, 100);
  const darkness = Math.round(100 - selectedHsv.value);
  const shadeThumbStyle = { left: `${darkness}%` };
  const markerStyle = {
    left: `${50 + Math.cos(degreesToRadians(selectedHsv.hue)) * selectedHsv.saturation * 0.5}%`,
    top: `${50 + Math.sin(degreesToRadians(selectedHsv.hue)) * selectedHsv.saturation * 0.5}%`
  };

  const setCell = (index, color) => {
    const next = [...normalized];
    next[index] = color;
    onChange(next);
  };

  const chooseColor = (hue, saturation, valueLevel = selectedHsv.value) => {
    setSelectedHsv({
      hue: (hue + 360) % 360,
      saturation: clamp(saturation, 0, 100),
      value: clamp(valueLevel, 0, 100)
    });
    setIsErasing(false);
  };

  const pickWheelColor = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = rect.width / 2;
    const x = event.clientX - rect.left - radius;
    const y = event.clientY - rect.top - radius;
    const distance = Math.min(Math.hypot(x, y), radius);
    const hue = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    const saturation = Math.round((distance / radius) * 100);

    chooseColor(hue, saturation);
  };

  const moveWheelColor = (event) => {
    if (event.buttons === 1) {
      pickWheelColor(event);
    }
  };

  const handleWheelKeyDown = (event) => {
    const step = event.shiftKey ? 10 : 5;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      chooseColor((selectedHsv.hue - step + 360) % 360, selectedHsv.saturation);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      chooseColor((selectedHsv.hue + step) % 360, selectedHsv.saturation);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      chooseColor(selectedHsv.hue, Math.max(0, selectedHsv.saturation - step));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      chooseColor(selectedHsv.hue, Math.min(100, selectedHsv.saturation + step));
    }
  };

  return (
    <div className="profile-picture-editor">
      <div className="profile-picture-grid-panel">
        <div className="pixel-editor-grid" role="grid" aria-label="Profile picture editor">
          {normalized.map((color, index) => (
            <button
              key={index}
              type="button"
              className={`pixel-editor-cell ${color ? 'filled' : ''}`}
              style={color ? { background: color } : undefined}
              onClick={() => setCell(index, isErasing ? null : selectedColor)}
              onContextMenu={(event) => {
                event.preventDefault();
                setCell(index, null);
              }}
              title="Click to paint, right-click to erase"
            />
          ))}
        </div>
      </div>
      <div className="profile-picture-picker-panel">
        <div
          className="profile-color-wheel"
          role="slider"
          aria-label="Color wheel"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(selectedHsv.hue)}
          aria-valuetext={selectedColor}
          tabIndex={0}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            pickWheelColor(event);
          }}
          onPointerMove={moveWheelColor}
          onKeyDown={handleWheelKeyDown}
        >
          <span className="profile-color-wheel-marker" style={markerStyle} />
        </div>
        <div className="profile-shade-control" style={{ '--shade-gradient': `linear-gradient(90deg, ${fullValueColor}, #000000)` }}>
          <span className="profile-shade-track" aria-hidden="true" />
          <span className="profile-shade-thumb" style={shadeThumbStyle} aria-hidden="true" />
          <input
            className="profile-shade-slider"
            type="range"
            min="0"
            max="100"
            value={darkness}
            onChange={(event) => chooseColor(selectedHsv.hue, selectedHsv.saturation, 100 - Number(event.target.value))}
            aria-label="Color darkness"
          />
        </div>
      </div>
      <div className="profile-picture-controls">
        <div className="profile-picture-tool-row">
          <button className={`ghost ${isErasing ? 'active-tool' : ''}`} type="button" onClick={() => setIsErasing(true)} aria-label="Use eraser">
            Eraser
          </button>
          <button className="ghost" type="button" onClick={() => onChange([...PROFILE_PICTURE_EMPTY])}>Clear</button>
        </div>
      </div>
    </div>
  );
}

function hexToHsv(color) {
  const red = parseInt(color.slice(1, 3), 16) / 255;
  const green = parseInt(color.slice(3, 5), 16) / 255;
  const blue = parseInt(color.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  return {
    hue: (hue + 360) % 360,
    saturation: max === 0 ? 0 : (delta / max) * 100,
    value: max * 100
  };
}

function hsvToHex(hue, saturation, value) {
  const chroma = (value / 100) * (saturation / 100);
  const huePrime = hue / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = value / 100 - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime >= 0 && huePrime < 1) {
    red = chroma;
    green = x;
  } else if (huePrime < 2) {
    red = x;
    green = chroma;
  } else if (huePrime < 3) {
    green = chroma;
    blue = x;
  } else if (huePrime < 4) {
    green = x;
    blue = chroma;
  } else if (huePrime < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return `#${[red, green, blue].map((channel) => (
    Math.round((channel + match) * 255).toString(16).padStart(2, '0')
  )).join('')}`;
}

function degreesToRadians(degrees) {
  return degrees * Math.PI / 180;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
