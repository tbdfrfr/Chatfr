import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Modal } from '../../components/ui/Modal.jsx';
import { UserLabel } from '../../components/ui/UserLabel.jsx';
import { DEFAULT_GROUP_NAME_COLOR, DEFAULT_GROUP_NAME_FONT, GROUP_NAME_COLOR_OPTIONS, GROUP_NAME_FONT_OPTIONS, MAX_GROUP_MEMBER_COUNT, groupNameFontFamily, normalizeGroupNameColor, normalizeGroupNameFont } from './groupHelpers.js';

export function GroupEditorModal({ token, me, thread, canEdit, onClose, onSaved, onDeleted }) {
  const [groupName, setGroupName] = useState(thread.name || '');
  const [groupNameColor, setGroupNameColor] = useState(normalizeGroupNameColor(thread.nameColor));
  const [groupNameFont, setGroupNameFont] = useState(normalizeGroupNameFont(thread.nameFont));
  const [groupMemberInput, setGroupMemberInput] = useState('');
  const [groupLookup, setGroupLookup] = useState(null);
  const [groupLookupError, setGroupLookupError] = useState('');
  const [groupLookupLoading, setGroupLookupLoading] = useState(false);
  const [groupMembers, setGroupMembers] = useState(() => (Array.isArray(thread.members) ? thread.members.filter((member) => Number(member.id) !== Number(me.id)) : []));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState('');
  const allMembers = Array.isArray(thread.members) ? thread.members : [];

  useEffect(() => {
    setGroupName(thread.name || '');
    setGroupNameColor(normalizeGroupNameColor(thread.nameColor));
    setGroupNameFont(normalizeGroupNameFont(thread.nameFont));
    setGroupMemberInput('');
    setGroupLookup(null);
    setGroupLookupError('');
    setGroupLookupLoading(false);
    setGroupMembers(Array.isArray(thread.members) ? thread.members.filter((member) => Number(member.id) !== Number(me.id)) : []);
    setSaving(false);
    setDeleting(false);
    setStatus('');
  }, [thread, me.id]);

  useEffect(() => {
    if (!canEdit) {
      return;
    }

    const value = groupMemberInput.trim();
    if (!value) {
      setGroupLookup(null);
      setGroupLookupError('');
      setGroupLookupLoading(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setGroupLookupLoading(true);
      try {
        const data = await api(`/api/users/${value}`, { token });
        const user = data.user;

        if (Number(user.id) === Number(me.id)) {
          setGroupLookup(null);
          setGroupLookupError('You are already in the group.');
        } else {
          setGroupLookup(user);
          setGroupLookupError('');
        }
      } catch {
        setGroupLookup(null);
        setGroupLookupError('User not found.');
      } finally {
        setGroupLookupLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [groupMemberInput, me.id, token, canEdit]);

  const canAddGroupMember = Boolean(groupLookup) && Number(groupLookup.id) !== Number(me.id) && groupMembers.length + 1 < MAX_GROUP_MEMBER_COUNT;

  const addGroupMember = () => {
    if (!groupLookup) {
      return;
    }

    if (Number(groupLookup.id) === Number(me.id)) {
      setGroupLookupError('You are already in the group.');
      return;
    }

    if (groupMembers.some((member) => Number(member.id) === Number(groupLookup.id))) {
      setGroupLookupError('User already added.');
      return;
    }

    if (groupMembers.length + 1 >= MAX_GROUP_MEMBER_COUNT) {
      setGroupLookupError(`Groups can have up to ${MAX_GROUP_MEMBER_COUNT} users.`);
      return;
    }

    setGroupMembers((previous) => [...previous, groupLookup]);
    setGroupMemberInput('');
    setGroupLookup(null);
    setGroupLookupError('');
  };

  const removeGroupMember = (id) => {
    setGroupMembers((previous) => previous.filter((member) => Number(member.id) !== Number(id)));
  };

  const saveGroup = async (event) => {
    event.preventDefault();

    if (!canEdit) {
      onClose();
      return;
    }

    try {
      setSaving(true);
      setStatus('');

      const memberNumbers = groupMembers.map((member) => String(member.id));
      const data = await api(`/api/groups/${encodeURIComponent(thread.id)}`, {
        token,
        method: 'PATCH',
        body: {
          name: groupName.trim(),
          nameColor: normalizeGroupNameColor(groupNameColor),
          nameFont: normalizeGroupNameFont(groupNameFont),
          memberNumbers
        }
      });

      onSaved(data.thread);
      onClose();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async () => {
    if (!canEdit || deleting || saving) {
      return;
    }

    try {
      setDeleting(true);
      setStatus('');

      await api(`/api/groups/${encodeURIComponent(thread.id)}`, {
        token,
        method: 'DELETE'
      });

      onDeleted?.(thread.id);
      onClose();
    } catch (error) {
      setStatus(error.message);
      setDeleting(false);
    }
  };

  const onNumberKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addGroupMember();
    }
  };

  if (!canEdit) {
    return (
      <Modal title="Members" onClose={onClose}>
        <div className="create-shell create-group-shell">
          <div className="create-column create-column-group">
            <div className="create-column-body create-column-body-group">
              <div className="group-members-panel">
                <div className="group-members-head">
                  <strong>Members</strong>
                  <span className="muted-text create-count">{allMembers.length}/{MAX_GROUP_MEMBER_COUNT}</span>
                </div>
                <div className="group-member-list-shell">
                  {allMembers.length ? (
                    <div className="member-list group-member-list">
                      {allMembers.map((member) => (
                        <div key={member.id} className="member-row">
                          <div className="member-row-label">
                            <UserLabel user={member} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state create-empty group-empty-state">No members found.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Edit group" onClose={onClose}>
      <form className="create-shell create-grid create-group-grid" onSubmit={saveGroup}>
        <div className="create-column create-column-group create-column-group-custom">
          <div className="create-column-body create-column-body-group create-column-body-group-custom">
            <label className="field">
              <span>Group name</span>
              <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Optional" type="text" style={{ color: normalizeGroupNameColor(groupNameColor), fontFamily: groupNameFontFamily(groupNameFont) }} />
              <div className="group-style-controls">
                <div className="group-style-control-row">
                  <span className="muted-text">Color</span>
                  <div className="group-color-options">
                    {GROUP_NAME_COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        className={`group-color-option ${groupNameColor === color ? 'active' : ''}`}
                        type="button"
                        style={{ background: color }}
                        onClick={() => setGroupNameColor(color)}
                        aria-label={`Use ${color} for group name`}
                      />
                    ))}
                  </div>
                </div>
                <div className="group-style-control-row">
                  <span className="muted-text">Font</span>
                  <div className="group-font-options">
                    {GROUP_NAME_FONT_OPTIONS.map((font) => (
                      <button
                        key={font.id}
                        className={`ghost group-font-option ${groupNameFont === font.id ? 'active' : ''}`}
                        type="button"
                        style={{ fontFamily: groupNameFontFamily(font.id) }}
                        onClick={() => setGroupNameFont(font.id)}
                      >
                        {font.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="create-column create-column-group create-column-group-members">
          <div className="create-column-body create-column-body-group-members">
            <div className="field">
              <span>Add member by user number</span>
              <div className="inline-input-row">
                <input value={groupMemberInput} onChange={(event) => setGroupMemberInput(event.target.value)} onKeyDown={onNumberKeyDown} type="number" />
                <button className="ghost inline-action" type="button" onClick={addGroupMember} disabled={!canAddGroupMember}>Add</button>
              </div>
            </div>

            <div className="preview-card dm-preview-slot group-preview-slot">
              {groupLookupLoading
                ? <span className="dm-preview-text muted-text">Searching user...</span>
                : groupLookupError
                ? <span className="dm-preview-text error-text dm-error-text">{groupLookupError}</span>
                : groupLookup
                  ? <UserLabel user={groupLookup} className="preview-user-label" />
                  : <span className="dm-preview-text muted-text">No user selected.</span>}
            </div>

            <div className="group-members-panel">
              <div className="group-members-head">
                <strong>Members</strong>
                <span className="muted-text create-count">{groupMembers.length + 1}/{MAX_GROUP_MEMBER_COUNT}</span>
              </div>
              <div className="group-member-list-shell">
                {groupMembers.length ? (
                  <div className="member-list group-member-list">
                    {groupMembers.map((member) => (
                      <div key={member.id} className="member-row">
                        <div className="member-row-label">
                          <UserLabel user={member} />
                        </div>
                        <button className="ghost" type="button" onClick={() => removeGroupMember(member.id)}>Remove</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state create-empty group-empty-state">No members added yet.</div>
                )}
              </div>
            </div>
          </div>

        </div>

        <div className="group-form-wide-foot group-form-wide-foot-actions">
          <button className="ghost group-delete-button" type="button" onClick={deleteGroup} disabled={saving || deleting}>{deleting ? 'Deleting...' : 'Delete group'}</button>
          <button className="primary create-primary" type="submit" disabled={saving || deleting}>{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
        {status ? <div className="error-text">{status}</div> : null}
      </form>
    </Modal>
  );
}
