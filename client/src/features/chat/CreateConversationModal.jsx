import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { UserLabel } from '../../components/ui/UserLabel.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import {
  DEFAULT_GROUP_NAME_COLOR,
  DEFAULT_GROUP_NAME_FONT,
  GROUP_NAME_COLOR_OPTIONS,
  GROUP_NAME_FONT_OPTIONS,
  MAX_GROUP_MEMBER_COUNT,
  groupNameFontFamily,
  normalizeGroupNameColor,
  normalizeGroupNameFont
} from '../groups/groupHelpers.js';

export function CreateConversationModal({ me, onClose, onCreated }) {
  const [step, setStep] = useState('menu');
  const [dmUserNumber, setDmUserNumber] = useState('');
  const [dmLookup, setDmLookup] = useState(null);
  const [dmLookupError, setDmLookupError] = useState('');
  const [dmLookupLoading, setDmLookupLoading] = useState(false);
  const [groupMemberInput, setGroupMemberInput] = useState('');
  const [groupLookup, setGroupLookup] = useState(null);
  const [groupLookupError, setGroupLookupError] = useState('');
  const [groupLookupLoading, setGroupLookupLoading] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [groupNameColor, setGroupNameColor] = useState(DEFAULT_GROUP_NAME_COLOR);
  const [groupNameFont, setGroupNameFont] = useState(DEFAULT_GROUP_NAME_FONT);

  useEffect(() => {
    resetDialog();
  }, []);

  const resetDialog = () => {
    setStep('menu');
    setDmUserNumber('');
    setDmLookup(null);
    setDmLookupError('');
    setDmLookupLoading(false);
    setGroupMemberInput('');
    setGroupLookup(null);
    setGroupLookupError('');
    setGroupLookupLoading(false);
    setGroupMembers([]);
    setGroupName('');
    setGroupNameColor(DEFAULT_GROUP_NAME_COLOR);
    setGroupNameFont(DEFAULT_GROUP_NAME_FONT);
  };

  const closeDialog = () => {
    resetDialog();
    onClose();
  };

  const lookupUser = async (userNumber) => {
    const value = userNumber.trim();

    if (!value) {
      return null;
    }

    const data = await api(`/api/users/${value}`);
    return data.user;
  };

  const openDmThread = async () => {
    const userNumber = dmUserNumber.trim();

    if (!userNumber) {
      return;
    }

    const data = await api('/api/dm/start', { method: 'POST', body: { userNumber } });
    onCreated(data.thread);
    closeDialog();
  };

  const createGroupThread = async () => {
    const name = groupName.trim();
    const memberNumbers = groupMembers.map((member) => String(member.id));
    const nameColor = normalizeGroupNameColor(groupNameColor);
    const nameFont = normalizeGroupNameFont(groupNameFont);

    if (groupMembers.length + 1 > MAX_GROUP_MEMBER_COUNT) {
      setGroupLookupError(`Groups can have up to ${MAX_GROUP_MEMBER_COUNT} users.`);
      return;
    }

    const data = await api('/api/groups', { method: 'POST', body: { name, memberNumbers, nameColor, nameFont } });
    onCreated(data.thread);
    closeDialog();
  };

  const addGroupMember = () => {
    if (!groupLookup) {
      return;
    }

    if (groupMembers.length + 1 >= MAX_GROUP_MEMBER_COUNT) {
      setGroupLookupError(`Groups can have up to ${MAX_GROUP_MEMBER_COUNT} users.`);
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

    setGroupMembers((previous) => [...previous, groupLookup]);
    setGroupMemberInput('');
    setGroupLookup(null);
    setGroupLookupError('');
  };

  const removeGroupMember = (id) => {
    setGroupMembers((previous) => previous.filter((member) => Number(member.id) !== Number(id)));
  };

  useEffect(() => {
    if (step !== 'dm') {
      return;
    }

    const value = dmUserNumber.trim();
    if (!value) {
      setDmLookup(null);
      setDmLookupError('');
      setDmLookupLoading(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setDmLookupLoading(true);
      try {
        const user = await lookupUser(value);

        if (!user) {
          setDmLookup(null);
          setDmLookupError('No matching users.');
        } else if (Number(user.id) === Number(me.id)) {
          setDmLookup(null);
          setDmLookupError('You cannot DM yourself.');
        } else {
          setDmLookup(user);
          setDmLookupError('');
        }
      } catch {
        setDmLookup(null);
        setDmLookupError('User not found.');
      } finally {
        setDmLookupLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [dmUserNumber, me.id, step]);

  useEffect(() => {
    if (step !== 'group') {
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
        const user = await lookupUser(value);

        if (!user) {
          setGroupLookup(null);
          setGroupLookupError('No matching users.');
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
  }, [groupMemberInput, step]);

  const canOpenDm = dmLookup && dmUserNumber.trim() && Number(dmLookup.id) === Number(dmUserNumber.trim()) && Number(dmLookup.id) !== Number(me.id);
  const canCreateGroup = groupMembers.length > 0;
  const canAddGroupMember = Boolean(groupLookup) && Number(groupLookup.id) !== Number(me.id) && groupMembers.length + 1 < MAX_GROUP_MEMBER_COUNT;

  const onDmNumberKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (canOpenDm) {
        openDmThread();
      }
    }
  };

  const onGroupNumberKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addGroupMember();
    }
  };

  return (
    <Modal
      title={step === 'menu' ? 'Create conversation' : step === 'dm' ? 'Direct message' : 'Group chat'}
      onClose={closeDialog}
      onBack={step === 'menu' ? null : () => setStep('menu')}
    >
      {step === 'menu' ? (
        <div className="create-shell create-menu-shell">
          <div className="create-intro">
            <strong>Start something new</strong>
            <span>Pick the conversation type.</span>
          </div>
          <div className="create-kind-grid">
            <button className="create-kind-card" type="button" onClick={() => setStep('dm')}>
              <span className="create-kind-mark" aria-hidden="true">1</span>
              <span className="create-kind-copy">
                <strong>Direct message</strong>
                <span>One person, private thread</span>
              </span>
              <span className="create-kind-action">Open DM</span>
            </button>
            <button className="create-kind-card" type="button" onClick={() => setStep('group')}>
              <span className="create-kind-mark" aria-hidden="true">+</span>
              <span className="create-kind-copy">
                <strong>Group chat</strong>
                <span>Add two or more members</span>
              </span>
              <span className="create-kind-action">Create group</span>
            </button>
          </div>
        </div>
      ) : null}

      {step === 'dm' ? (
        <form className="create-shell create-dm-shell" onSubmit={(event) => { event.preventDefault(); openDmThread(); }}>
          <div className="create-column create-column-dm">
            <div className="create-column-body">
              <label className="field">
                <span>User number</span>
                <input value={dmUserNumber} onChange={(event) => setDmUserNumber(event.target.value)} onKeyDown={onDmNumberKeyDown} type="number" required />
              </label>

              <div className="preview-card dm-preview-slot">
                {dmLookupLoading
                  ? <span className="dm-preview-text muted-text">Searching user...</span>
                  : dmLookupError
                  ? <span className="dm-preview-text error-text dm-error-text">{dmLookupError}</span>
                  : dmLookup
                    ? <UserLabel user={dmLookup} />
                    : <span className="dm-preview-text muted-text">No user selected.</span>}
              </div>
            </div>

            <div className="create-column-foot">
              <button className="primary create-primary" type="submit" disabled={!canOpenDm}>Open DM</button>
            </div>
          </div>
        </form>
      ) : null}

      {step === 'group' ? (
        <form className="create-shell create-grid create-group-grid" onSubmit={(event) => { event.preventDefault(); createGroupThread(); }}>
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
                  <input value={groupMemberInput} onChange={(event) => setGroupMemberInput(event.target.value)} onKeyDown={onGroupNumberKeyDown} type="number" />
                  <button className="ghost inline-action" type="button" onClick={addGroupMember} disabled={!canAddGroupMember}>Add</button>
                </div>
              </div>

              <div className="preview-card dm-preview-slot group-preview-slot">
                {groupLookupLoading
                  ? <span className="dm-preview-text muted-text">Searching user...</span>
                  : groupLookupError
                  ? <span className="dm-preview-text error-text dm-error-text">{groupLookupError}</span>
                  : groupLookup
                    ? <UserLabel user={groupLookup} />
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

          <div className="group-form-wide-foot">
            <button className="primary create-primary" type="submit" disabled={!canCreateGroup}>Create group</button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
