import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { normalizeProfilePicture, ProfilePictureEditor } from '../profile/ProfilePictureEditor.jsx';
import { Modal } from '../../components/ui/Modal.jsx';

export function SettingsModal({ token, me, onClose, onSaved, onLogout }) {
  const [profileDraft, setProfileDraft] = useState(me.displayName || '');
  const [profilePictureDraft, setProfilePictureDraft] = useState(() => normalizeProfilePicture(me.profilePicture));
  const [status, setStatus] = useState('');

  useEffect(() => {
    setProfileDraft(me.displayName || '');
    setProfilePictureDraft(normalizeProfilePicture(me.profilePicture));
    setStatus('');
  }, [me.displayName, me.profilePicture]);

  const updateProfile = async () => {
    try {
      await Promise.all([
        api('/api/me/display-name', {
          token,
          method: 'PATCH',
          body: { displayName: profileDraft }
        }),
        api('/api/me/profile-picture', {
          token,
          method: 'PATCH',
          body: { profilePicture: profilePictureDraft }
        })
      ]);

      const meData = await api('/api/me', { token });
      setProfilePictureDraft(normalizeProfilePicture(meData.user.profilePicture));
      setStatus('Saved.');
      onSaved(meData.user);
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="stack settings-stack">
        <label className="field settings-field">
          <span>Display name</span>
          <input value={profileDraft} onChange={(event) => setProfileDraft(event.target.value)} placeholder={`#${me.id}`} />
        </label>
        <div className="field settings-field settings-avatar-field">
          <span>Profile picture (7x7)</span>
          <ProfilePictureEditor value={profilePictureDraft} onChange={setProfilePictureDraft} />
        </div>
        <button className="primary settings-save" type="button" onClick={updateProfile}>Save user settings</button>
        {status ? <div className="muted-text settings-status">{status}</div> : null}
        <div className="divider" />
        <div className="settings-card">
          <strong>Theme settings</strong>
          <div className="muted-text">NOT Coming soon.</div>
        </div>
        <div className="divider" />
        <button className="ghost settings-logout" type="button" onClick={onLogout}>Log out</button>
      </div>
    </Modal>
  );
}
