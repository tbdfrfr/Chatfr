import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Modal } from '../../components/ui/Modal.jsx';
import { ProfilePictureEditor } from '../profile/ProfilePictureEditor.jsx';
import { normalizeProfilePicture } from '../../lib/profilePictureUtils.js';

export function SettingsModal({ me, onClose, onSaved, onLogout }) {
  const [tab, setTab] = useState('profile');
  const [profileDraft, setProfileDraft] = useState(me.displayName || '');
  const [profilePictureDraft, setProfilePictureDraft] = useState(() => normalizeProfilePicture(me.profilePicture));
  const [status, setStatus] = useState('');
  const originalDisplayName = me.displayName || '';
  const originalProfilePicture = normalizeProfilePicture(me.profilePicture);
  const hasProfileChanges = profileDraft !== originalDisplayName || !sameProfilePicture(profilePictureDraft, originalProfilePicture);

  useEffect(() => {
    setProfileDraft(me.displayName || '');
    setProfilePictureDraft(normalizeProfilePicture(me.profilePicture));
    setStatus('');
    setTab('profile');
  }, [me.displayName, me.profilePicture]);

  const updateProfile = async () => {
    try {
      await Promise.all([
        api('/api/me/display-name', {
          method: 'PATCH',
          body: { displayName: profileDraft }
        }),
        api('/api/me/profile-picture', {
          method: 'PATCH',
          body: { profilePicture: profilePictureDraft }
        })
      ]);

      const meData = await api('/api/me');
      setProfileDraft(meData.user.displayName || '');
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
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          <button
            className={tab === 'profile' ? 'active' : ''}
            type="button"
            role="tab"
            aria-selected={tab === 'profile'}
            onClick={() => setTab('profile')}
          >
            Profile
          </button>
          <button
            className={tab === 'security' ? 'active' : ''}
            type="button"
            role="tab"
            aria-selected={tab === 'security'}
            onClick={() => setTab('security')}
          >
            Security
          </button>
          <button
            className={tab === 'logout' ? 'active' : ''}
            type="button"
            role="tab"
            aria-selected={tab === 'logout'}
            onClick={() => setTab('logout')}
          >
            Log out
          </button>
        </div>

        {tab === 'profile' ? (
          <div className="settings-tab-panel" role="tabpanel">
            <label className="field settings-field">
              <span>Display name</span>
              <input value={profileDraft} onChange={(event) => setProfileDraft(event.target.value)} placeholder={`#${me.id}`} />
            </label>
            <div className="field settings-field settings-avatar-field">
              <span>Profile picture (7x7)</span>
              <ProfilePictureEditor value={profilePictureDraft} onChange={setProfilePictureDraft} />
            </div>
            <button className={`primary settings-save ${hasProfileChanges ? 'dirty' : ''}`} type="button" onClick={updateProfile}>Save user settings</button>
            {status ? <div className="muted-text settings-status">{status}</div> : null}
          </div>
        ) : null}

        {tab === 'security' ? (
          <div className="settings-tab-panel" role="tabpanel">
            <div className="field settings-field settings-security-field">
              <span>Passkeys</span>
              <div className="settings-security-card">
                <div className="settings-security-copy">
                  <strong>No more passwords coming soon!</strong>
                  <p>Passkeys will replace password-based login here. This feature is coming soon!</p>
                </div>
                <div className="settings-security-actions">
                  <button className="ghost" type="button" disabled>Add passkey</button>
                  <button className="ghost" type="button" disabled>Manage passkeys</button>
                  <button className="ghost" type="button" disabled>Backup codes</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'logout' ? (
          <div className="settings-tab-panel settings-logout-panel" role="tabpanel">
            <div className="settings-logout-card">
              <strong>End this session</strong>
              <p>This will sign you out of Chatfr on this device.</p>
              <button className="ghost settings-logout" type="button" onClick={onLogout}>Log out</button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function sameProfilePicture(left, right) {
  return JSON.stringify(normalizeProfilePicture(left)) === JSON.stringify(normalizeProfilePicture(right));
}
