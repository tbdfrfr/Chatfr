import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api, websocketUrl } from './api.js';

const tokenKey = 'chatfr.token';
const userKey = 'chatfr.user';
const PROFILE_PICTURE_GRID_SIZE = 7;
const PROFILE_PICTURE_CELL_COUNT = PROFILE_PICTURE_GRID_SIZE * PROFILE_PICTURE_GRID_SIZE;
const PROFILE_PICTURE_EMPTY = Array.from({ length: PROFILE_PICTURE_CELL_COUNT }, () => null);
const PROFILE_PICTURE_PALETTE = ['#0f0f0f', '#ffffff', '#e63946', '#f4a261', '#f1fa8c', '#2a9d8f', '#457b9d', '#8338ec'];
const MAX_GROUP_MEMBER_COUNT = 100;
const GROUP_NAME_COLOR_OPTIONS = ['#e63946', '#ff6b6b', '#f97316', '#ff9f1c', '#ffd166', '#f1fa8c', '#a3e635', '#06d6a0', '#2ec4b6', '#14b8a6', '#118ab2', '#3a86ff', '#073b4c', '#8b5cf6', '#8338ec', '#c77dff', '#b5179e', '#ff4fa3', '#ef476f', '#eeeeee'];
const GROUP_NAME_FONT_OPTIONS = [
  { id: 'space-grotesk', label: 'Space Grotesk' },
  { id: 'nunito', label: 'Nunito' },
  { id: 'pacifico', label: 'Pacifico' },
  { id: 'playfair', label: 'Playfair' },
  { id: 'bebas-neue', label: 'Bebas Neue' },
  { id: 'oswald', label: 'Oswald' },
  { id: 'raleway', label: 'Raleway' },
  { id: 'merriweather', label: 'Merriweather' },
  { id: 'cinzel', label: 'Cinzel' },
  { id: 'rubik', label: 'Rubik' },
  { id: 'outfit', label: 'Outfit' },
  { id: 'manrope', label: 'Manrope' },
  { id: 'comfortaa', label: 'Comfortaa' },
  { id: 'caveat', label: 'Caveat' },
  { id: 'lobster', label: 'Lobster' },
  { id: 'anton', label: 'Anton' },
  { id: 'fira-code', label: 'Fira Code' },
  { id: 'ibm-plex-serif', label: 'IBM Plex Serif' },
  { id: 'josefin-sans', label: 'Josefin Sans' },
  { id: 'orbitron', label: 'Orbitron' }
];
const DEFAULT_GROUP_NAME_COLOR = GROUP_NAME_COLOR_OPTIONS[0];
const DEFAULT_GROUP_NAME_FONT = GROUP_NAME_FONT_OPTIONS[0].id;

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey));
  const [me, setMe] = useState(() => JSON.parse(localStorage.getItem(userKey) || 'null'));
  const [loading, setLoading] = useState(!!token);
  const [signupNoticeUserNumber, setSignupNoticeUserNumber] = useState(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    api('/api/me', { token })
      .then((data) => setMe(data.user))
      .catch(() => {
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
        setToken(null);
        setMe(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !me) {
      return;
    }

    localStorage.setItem(userKey, JSON.stringify(me));
  }, [token, me]);

  const onAuth = (nextToken, user, options = {}) => {
    localStorage.setItem(tokenKey, nextToken);
    localStorage.setItem(userKey, JSON.stringify(user));
    setToken(nextToken);
    setMe(user);

    if (options.showUserNumberNotice) {
      setSignupNoticeUserNumber(user?.id ?? null);
    }
  };

  const logout = () => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    setToken(null);
    setMe(null);
    setSignupNoticeUserNumber(null);
  };

  if (loading) {
    return <Shell><div>Loading session...</div></Shell>;
  }

  if (!token || !me) {
    return <AuthScreen onAuth={onAuth} />;
  }

  return (
    <>
      <ChatApp token={token} me={me} onMeChange={setMe} onLogout={logout} />
      {signupNoticeUserNumber ? (
        <SignupUserNumberNotice
          userNumber={signupNoticeUserNumber}
          onContinue={() => setSignupNoticeUserNumber(null)}
        />
      ) : null}
    </>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');

  return (
    <Shell>
      <div className="auth-card">
        <h1>Chatfr</h1>
        <div className="mode-toggle">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign up</button>
        </div>

        {error ? <div className="error-text">{error}</div> : null}
        {mode === 'login' ? <LoginForm onSuccess={onAuth} setError={setError} /> : null}
        {mode === 'signup' ? <SignupForm onSuccess={onAuth} setError={setError} /> : null}
      </div>
    </Shell>
  );
}

function LoginForm({ onSuccess, setError }) {
  const [userNumber, setUserNumber] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: { userNumber, password }
      });

      onSuccess(data.token, data.user, { showUserNumberNotice: false });
    } catch (error) {
      setError(error.message);
    }
  };

  return <AuthForm submit={submit} fields={[{ label: 'User number', value: userNumber, setValue: setUserNumber, type: 'number' }, { label: 'Password', value: password, setValue: setPassword, type: 'password' }]} cta="Enter" />;
}

function SignupForm({ onSuccess, setError }) {
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const data = await api('/api/auth/signup', {
        method: 'POST',
        body: { displayName, password }
      });

      onSuccess(data.token, data.user, { showUserNumberNotice: true });
    } catch (error) {
      setError(error.message);
    }
  };

  return <AuthForm submit={submit} fields={[{ label: 'Display name', value: displayName, setValue: setDisplayName, type: 'text' }, { label: 'Password', value: password, setValue: setPassword, type: 'password' }]} cta="Create account" />;
}

function AuthForm({ submit, fields, cta }) {
  return (
    <form className="stack" onSubmit={submit}>
      {fields.map((field) => (
        <label key={field.label} className="field">
          <span>{field.label}</span>
          <input value={field.value} onChange={(event) => field.setValue(event.target.value)} type={field.type} />
        </label>
      ))}
      <button className="primary" type="submit">{cta}</button>
    </form>
  );
}

function ChatApp({ token, me, onMeChange, onLogout }) {
  const [threads, setThreads] = useState([]);
  const [currentThreadId, setCurrentThreadId] = useState('global');
  const [threadSearch, setThreadSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState('menu');
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
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupEditorThread, setGroupEditorThread] = useState(null);
  const [groupEditorCanEdit, setGroupEditorCanEdit] = useState(false);
  const [profileDraft, setProfileDraft] = useState(me.displayName || '');
  const [profilePictureDraft, setProfilePictureDraft] = useState(() => normalizeProfilePicture(me.profilePicture));
  const [settingsStatus, setSettingsStatus] = useState('');
  const [threadActionError, setThreadActionError] = useState('');

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    setProfileDraft(me.displayName || '');
    setProfilePictureDraft(normalizeProfilePicture(me.profilePicture));
    setSettingsStatus('');
  }, [settingsOpen, me.displayName, me.profilePicture]);

  useEffect(() => {
    const socket = new WebSocket(websocketUrl('/ws', token));

    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type === 'message:new') {
        setThreads((previous) => bumpThread(previous, payload.threadId, payload.message));
        window.dispatchEvent(new CustomEvent('chatfr:new-message', { detail: payload }));
      } else if (payload.type === 'user:updated' && payload.user) {
        setThreads((previous) => updateUserInThreads(previous, payload.user));
        if (Number(payload.user.id) === Number(me.id)) {
          onMeChange((previous) => ({ ...(previous || {}), ...payload.user }));
        }
        window.dispatchEvent(new CustomEvent('chatfr:user-updated', { detail: payload.user }));
      }
    });

    return () => socket.close();
  }, [token, me.id, onMeChange]);

  async function loadThreads() {
    const data = await api('/api/threads', { token });
    setThreads(data.threads);
  }

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
      onMeChange(meData.user);
      setProfilePictureDraft(normalizeProfilePicture(meData.user.profilePicture));
      setSettingsStatus('Saved.');
      await loadThreads();
    } catch (error) {
      setSettingsStatus(error.message);
    }
  };

  const openDmThread = async () => {
    const userNumber = dmUserNumber.trim();

    if (!userNumber) {
      return;
    }

    const data = await api('/api/dm/start', { token, method: 'POST', body: { userNumber } });
    setThreads((previous) => upsertThread(previous, data.thread));
    setCurrentThreadId(data.thread.id);
    resetCreateDialog();
  };

  const startDm = async (event) => {
    event.preventDefault();
    await openDmThread();
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

    const data = await api('/api/groups', { token, method: 'POST', body: { name, memberNumbers, nameColor, nameFont } });
    setThreads((previous) => upsertThread(previous, data.thread));
    setCurrentThreadId(data.thread.id);
    resetCreateDialog();
  };

  const createGroup = async (event) => {
    event.preventDefault();
    try {
      await createGroupThread();
    } catch (error) {
      setGroupLookupError(error.message);
    }
  };

  const openCreateDialog = () => {
    resetCreateDialog();
    setCreateOpen(true);
  };

  const closeCreateDialog = () => {
    resetCreateDialog();
  };

  const resetCreateDialog = () => {
    setCreateOpen(false);
    setCreateStep('menu');
    setDmUserNumber('');
    setDmLookup(null);
    setDmLookupError('');
    setGroupMemberInput('');
    setGroupLookup(null);
    setGroupLookupError('');
    setGroupMembers([]);
    setGroupName('');
    setGroupNameColor(DEFAULT_GROUP_NAME_COLOR);
    setGroupNameFont(DEFAULT_GROUP_NAME_FONT);
  };

  const lookupUser = async (userNumber) => {
    const value = userNumber.trim();

    if (!value) {
      return null;
    }

    const data = await api(`/api/users/${value}`, { token });
    return data.user;
  };

  useEffect(() => {
    if (createStep !== 'dm') {
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
  }, [dmUserNumber, createStep, me.id]);

  useEffect(() => {
    if (createStep !== 'group') {
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
  }, [groupMemberInput, createStep]);

  const canOpenDm = dmLookup && dmUserNumber.trim() && Number(dmLookup.id) === Number(dmUserNumber.trim()) && Number(dmLookup.id) !== Number(me.id);

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

  const canCreateGroup = groupMembers.length > 0;
  const canAddGroupMember = Boolean(groupLookup) && Number(groupLookup.id) !== Number(me.id) && groupMembers.length + 1 < MAX_GROUP_MEMBER_COUNT;

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

  const openGroupEditor = (thread, canEdit) => {
    setGroupEditorThread(thread);
    setGroupEditorCanEdit(Boolean(canEdit));
    setGroupEditorOpen(true);
  };

  const closeGroupEditor = () => {
    setGroupEditorOpen(false);
    setGroupEditorThread(null);
    setGroupEditorCanEdit(false);
  };

  const handleGroupSaved = (thread) => {
    setThreads((previous) => upsertThread(previous, thread));
    if (currentThreadId === thread.id) {
      setCurrentThreadId(thread.id);
    }
  };

  const handleGroupDeleted = (threadId) => {
    setThreads((previous) => previous.filter((thread) => thread.id !== threadId));
    if (currentThreadId === threadId) {
      setCurrentThreadId('global');
    }
  };

  const leaveThread = async (threadId) => {
    const thread = threads.find((item) => item.id === threadId);

    if (!thread || thread.type === 'global') {
      return;
    }

    try {
      setThreadActionError('');
      await api(`/api/threads/${encodeURIComponent(threadId)}/leave`, {
        token,
        method: 'POST'
      });

      await loadThreads();

      if (currentThreadId === threadId) {
        setCurrentThreadId('global');
      }
    } catch (error) {
      setThreadActionError(error.message);
    }
  };

  const filteredThreads = useMemo(() => {
    const query = threadSearch.trim().toLowerCase();

    if (!query) {
      return threads;
    }

    return threads.filter((thread) => threadMatchesSearch(thread, query, me.id));
  }, [threads, threadSearch, me.id]);

  const currentThread = useMemo(() => {
    return threads.find((thread) => thread.id === currentThreadId) || { id: 'global', type: 'global', name: 'Global' };
  }, [threads, currentThreadId]);

  return (
    <Shell wide>
      <aside className="sidebar">
        <div className="sidebar-actions">
          <button className="circle-button" type="button" onClick={openCreateDialog}>+</button>
          <button className="circle-button" type="button" aria-label="Settings" title="Settings" onClick={() => setSettingsOpen(true)}>
            {'\u2699'}
          </button>
        </div>

        <label className="field thread-search">
          <span>Search threads</span>
          <input value={threadSearch} onChange={(event) => setThreadSearch(event.target.value)} placeholder="Find a thread or person" type="search" />
        </label>

        <div className="thread-list">
          <ThreadButton thread={{ id: 'global', type: 'global', name: 'Global' }} meId={me.id} active={currentThreadId === 'global'} onClick={() => setCurrentThreadId('global')} />
          {filteredThreads.map((thread) => (
            thread.id === 'global' ? null : (
              <ThreadButton key={thread.id} thread={thread} meId={me.id} active={currentThreadId === thread.id} onClick={() => setCurrentThreadId(thread.id)} onLeave={() => leaveThread(thread.id)} />
            )
          ))}
        </div>
        {threadActionError ? <div className="error-text thread-action-error">{threadActionError}</div> : null}
      </aside>

      <main className="chat-shell">
        <ChatThread token={token} thread={currentThread} me={me} onEditGroup={openGroupEditor} />
      </main>

      {createOpen ? (
        <Modal
          title={createStep === 'menu' ? 'Create conversation' : createStep === 'dm' ? 'Direct message' : 'Group chat'}
          onClose={closeCreateDialog}
          onBack={createStep === 'menu' ? null : () => setCreateStep('menu')}
        >
          {createStep === 'menu' ? (
            <div className="create-shell">
              <div className="create-intro">Choose what you want to start.</div>
              <div className="create-kind-grid">
                <button className="create-kind-card" type="button" onClick={() => setCreateStep('dm')}>
                  <strong>Direct message</strong>
                  <span>One person, private thread</span>
                </button>
                <button className="create-kind-card" type="button" onClick={() => setCreateStep('group')}>
                  <strong>Group chat</strong>
                  <span>Add two or more members</span>
                </button>
              </div>
            </div>
          ) : null}

          {createStep === 'dm' ? (
            <form className="create-shell create-dm-shell" onSubmit={startDm}>
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
                        ? <UserLabel user={dmLookup} className="preview-user-label" />
                        : <span className="dm-preview-text muted-text">No user selected.</span>}
                  </div>
                </div>

                <div className="create-column-foot">
                  <button className="primary create-primary" type="submit" disabled={!canOpenDm}>Open DM</button>
                </div>
              </div>
            </form>
          ) : null}

          {createStep === 'group' ? (
            <form className="create-shell create-grid create-group-grid" onSubmit={createGroup}>
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

              <div className="group-form-wide-foot">
                <button className="primary create-primary" type="submit" disabled={!canCreateGroup}>Create group</button>
              </div>
            </form>
          ) : null}
        </Modal>
      ) : null}

      {groupEditorOpen && groupEditorThread ? (
        <GroupEditorModal
          token={token}
          me={me}
          thread={groupEditorThread}
          canEdit={groupEditorCanEdit}
          onClose={closeGroupEditor}
          onSaved={handleGroupSaved}
          onDeleted={handleGroupDeleted}
        />
      ) : null}

      {settingsOpen ? (
        <Modal title="Settings" onClose={() => setSettingsOpen(false)}>
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
            {settingsStatus ? <div className="muted-text settings-status">{settingsStatus}</div> : null}
            <div className="divider" />
            <div className="settings-card">
              <strong>Theme settings</strong>
              <div className="muted-text">NOT Coming soon.</div>
            </div>
            <div className="divider" />
            <button className="ghost settings-logout" type="button" onClick={onLogout}>Log out</button>
          </div>
        </Modal>
      ) : null}
    </Shell>
  );
}

function ThreadButton({ thread, meId, active, onClick, onLeave }) {
  const groupNameStyle = thread.type === 'group' ? getGroupNameStyle(thread) : null;
  const title = thread.type === 'global'
    ? 'Global'
    : thread.type === 'dm'
      ? <UserLabel user={getDmOtherUser(thread, meId)} />
      : <span className="group-name" style={groupNameStyle}>{thread.name || `Group ${thread.id.slice(-4)}`}</span>;

  const subtitle = thread.type === 'group'
    ? `${thread.members?.length || 0} members`
    : thread.type === 'dm'
      ? '1-on-1'
      : 'Public room';

  return (
    <div className={`thread-item ${active ? 'active' : ''}`}>
      <button className={`thread-button ${active ? 'active' : ''}`} type="button" onClick={onClick}>
        <div className="thread-title">{title}</div>
        {thread.type !== 'dm' ? <div className="thread-subtitle">{subtitle}</div> : null}
      </button>
      {thread.type !== 'global' ? (
        <button
          className="thread-leave"
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onMouseEnter={(event) => event.currentTarget.classList.add('thread-leave-visible')}
          onMouseLeave={(event) => event.currentTarget.classList.remove('thread-leave-visible')}
          onClick={(event) => {
            event.stopPropagation();
            onLeave?.();
          }}
        >
          Leave
        </button>
      ) : null}
    </div>
  );
}

function ChatThread({ token, thread, me, onEditGroup }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [composerError, setComposerError] = useState('');
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef(null);
  const composerRef = useRef(null);
  const isNearBottomRef = useRef(true);

  const scrollToBottom = (behavior = 'auto') => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior });
  };

  const updateBottomPinnedState = () => {
    const element = scrollerRef.current;

    if (!element) {
      return;
    }

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;
  };

  const resizeComposer = () => {
    const element = composerRef.current;

    if (!element) {
      return;
    }

    const maxHeight = 144;
    element.style.height = 'auto';
    const nextHeight = Math.min(element.scrollHeight, maxHeight);
    element.style.height = `${nextHeight}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    loadInitial();
  }, [thread.id]);

  useEffect(() => {
    const handler = (event) => {
      if (event.detail.threadId === thread.id) {
        const shouldStickToBottom = isNearBottomRef.current;
        setMessages((previous) => (previous.some((message) => message.id === event.detail.message.id) ? previous : [...previous, event.detail.message]));

        if (shouldStickToBottom) {
          requestAnimationFrame(() => scrollToBottom('smooth'));
        }
      }
    };

    window.addEventListener('chatfr:new-message', handler);
    return () => window.removeEventListener('chatfr:new-message', handler);
  }, [thread.id]);

  useEffect(() => {
    const handler = (event) => {
      const user = event.detail;

      setMessages((previous) => previous.map((message) => (
        Number(message.user?.id) === Number(user.id)
          ? { ...message, user: { ...message.user, ...user } }
          : message
      )));
    };

    window.addEventListener('chatfr:user-updated', handler);
    return () => window.removeEventListener('chatfr:user-updated', handler);
  }, []);

  async function loadInitial() {
    setLoading(true);
    const data = await api(`/api/threads/${thread.id}/messages`, { token });
    setMessages(data.messages);
    setHasMore(data.hasMore);
    setLoading(false);
    requestAnimationFrame(() => {
      scrollToBottom('auto');
      isNearBottomRef.current = true;
    });
  }

  const loadMore = async () => {
    if (!hasMore || loading || !messages.length) {
      return;
    }

    setLoading(true);
    const before = messages[0].id;
    const previousHeight = scrollerRef.current.scrollHeight;
    const previousTop = scrollerRef.current.scrollTop;
    const data = await api(`/api/threads/${thread.id}/messages?before=${before}`, { token });
    setMessages((current) => [...data.messages, ...current]);
    setHasMore(data.hasMore);
    requestAnimationFrame(() => {
      const nextHeight = scrollerRef.current.scrollHeight;
      scrollerRef.current.scrollTop = previousTop + (nextHeight - previousHeight);
    });
    setLoading(false);
  };

  const sendMessage = async () => {
    const content = draft.trim();

    if (!content || sending) {
      return;
    }

    try {
      setSending(true);
      const data = await api(`/api/threads/${thread.id}/messages`, {
        token,
        method: 'POST',
        body: { content }
      });

      setMessages((current) => (current.some((message) => message.id === data.message.id) ? current : [...current, data.message]));
      setDraft('');
      setComposerError('');
      requestAnimationFrame(() => {
        if (isNearBottomRef.current) {
          scrollToBottom('smooth');
        }
      });
    } catch (error) {
      setComposerError(error.message);
    } finally {
      setSending(false);
    }
  };

  const send = async (event) => {
    event.preventDefault();
    await sendMessage();
  };

  const onComposerKeyDown = async (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await sendMessage();
    }
  };

  useLayoutEffect(() => {
    resizeComposer();
  }, [draft]);

  useEffect(() => {
    resizeComposer();
    isNearBottomRef.current = true;
  }, [thread.id]);

  const groupNameStyle = thread.type === 'group' ? getGroupNameStyle(thread) : null;
  const title = thread.type === 'global'
    ? 'Global chat'
    : thread.type === 'dm'
      ? <UserLabel user={getDmOtherUser(thread, me.id)} />
      : <span className="group-name" style={groupNameStyle}>{thread.name || 'Group chat'}</span>;

  const canEditGroup = thread.type === 'group' && Number(thread.createdBy) === Number(me.id);
  const canViewMembers = thread.type === 'group';

  return (
    <section className="thread-view">
      <header className="thread-header">
        <h2>{title}</h2>
        {canViewMembers ? (
          <button className="ghost thread-edit-button" type="button" onClick={() => onEditGroup(thread, canEditGroup)}>
            {canEditGroup ? 'Edit group' : 'Members'}
          </button>
        ) : null}
      </header>

      <div className="message-panel" ref={scrollerRef} onScroll={(event) => {
        updateBottomPinnedState();

        if (event.currentTarget.scrollTop < 40) {
          loadMore();
        }
      }}>
        {messages.map((message) => (
          <div key={message.id} className="message-row">
            <UserLabel user={message.user} className="message-name" />
            <p>{message.content}</p>
          </div>
        ))}
      </div>

      <form className="composer" onSubmit={send}>
        <div className="composer-shell">
          <div className="composer-inner">
            <textarea ref={composerRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onComposerKeyDown} placeholder="Write a message" rows={1} />
            <button className="primary composer-send" type="submit" disabled={sending || !draft.trim()}>{sending ? '...' : 'Send'}</button>
          </div>
        </div>
        {composerError ? <div className="error-text">{composerError}</div> : null}
        <div className="composer-row">
          <div className="muted-text">Enter to send, Shift+Enter for a new line</div>
          <div className="muted-text">{`${messages.length} messages`}</div>
        </div>
      </form>
    </section>
  );
}

function Modal({ title, onClose, children, onBack }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="modal-card">
        <div className="modal-head" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-head-left">
            {onBack ? <button className="modal-nav-button" type="button" onClick={onBack}>Back</button> : null}
            <h3>{title}</h3>
          </div>
          <button className="modal-nav-button" type="button" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body" onMouseDown={(event) => event.stopPropagation()}>
          {children}
        </div>
      </div>
    </div>
  );
}

function GroupEditorModal({ token, me, thread, canEdit, onClose, onSaved, onDeleted }) {
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

function Shell({ children, wide = false }) {
  return (
    <div className={`shell ${wide ? 'wide' : ''}`}>
      <div className="frame">{children}</div>
    </div>
  );
}

function SignupUserNumberNotice({ userNumber, onContinue }) {
  return (
    <div className="signup-notice-overlay" role="dialog" aria-modal="true">
      <div className="signup-notice-card">
        <h2>YOUR USER NUMBER IS</h2>
        <div className="signup-number-shell">
          <div className="signup-number-inner">{`#${userNumber}`}</div>
        </div>
        <p>Remember it. You need this user number to log in again.</p>
        <button className="primary" type="button" onClick={onContinue}>I saved it</button>
      </div>
    </div>
  );
}

function UserLabel({ user, className = '' }) {
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

function ProfilePictureEditor({ value, onChange }) {
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

function getDmOtherUser(thread, meId) {
  const members = Array.isArray(thread.members) ? thread.members : [];
  return members.find((member) => Number(member.id) !== Number(meId)) || null;
}

function userLabelText(user) {
  if (!user) {
    return 'Unknown';
  }

  if (user.displayName) {
    return `${user.displayName} #${user.id}`;
  }

  return `#${user.id}`;
}

function fullUserLabel(user) {
  return <UserLabel user={user} />;
}

function threadMatchesSearch(thread, query, meId) {
  const searchable = [
    thread.id,
    thread.name,
    thread.type,
    thread.directLabel,
    userLabelText(getDmOtherUser(thread, meId)),
    ...(Array.isArray(thread.members) ? thread.members.map((member) => userLabelText(member)) : [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchable.includes(query);
}

function bumpThread(threads, threadId, message) {
  const next = threads.map((thread) => (
    thread.id === threadId ? { ...thread, lastMessage: message } : thread
  ));

  next.sort((left, right) => {
    const leftTime = new Date(left.lastMessage?.createdAt || 0).getTime();
    const rightTime = new Date(right.lastMessage?.createdAt || 0).getTime();
    return rightTime - leftTime;
  });

  return next;
}

function upsertThread(threads, thread) {
  const filtered = threads.filter((item) => item.id !== thread.id);
  return [thread, ...filtered];
}

function updateUserInThreads(threads, user) {
  return threads.map((thread) => {
    const members = Array.isArray(thread.members)
      ? thread.members.map((member) => (Number(member.id) === Number(user.id) ? { ...member, ...user } : member))
      : thread.members;

    let lastMessage = thread.lastMessage;
    if (lastMessage?.user && Number(lastMessage.user.id) === Number(user.id)) {
      lastMessage = { ...lastMessage, user: { ...lastMessage.user, ...user } };
    }

    return { ...thread, members, lastMessage };
  });
}

function normalizeProfilePicture(profilePicture) {
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

function normalizeGroupNameColor(value) {
  if (typeof value !== 'string') {
    return DEFAULT_GROUP_NAME_COLOR;
  }

  const color = value.trim().toLowerCase();
  return GROUP_NAME_COLOR_OPTIONS.includes(color) ? color : DEFAULT_GROUP_NAME_COLOR;
}

function normalizeGroupNameFont(value) {
  if (typeof value !== 'string') {
    return DEFAULT_GROUP_NAME_FONT;
  }

  const font = value.trim().toLowerCase();
  return GROUP_NAME_FONT_OPTIONS.some((option) => option.id === font) ? font : DEFAULT_GROUP_NAME_FONT;
}

function groupNameFontFamily(fontId) {
  switch (normalizeGroupNameFont(fontId)) {
    case 'nunito':
      return '"Nunito", "Segoe UI", sans-serif';
    case 'pacifico':
      return '"Pacifico", "Segoe UI", cursive';
    case 'playfair':
      return '"Playfair Display", Georgia, serif';
    case 'bebas-neue':
      return '"Bebas Neue", "Segoe UI", sans-serif';
    case 'oswald':
      return '"Oswald", "Segoe UI", sans-serif';
    case 'raleway':
      return '"Raleway", "Segoe UI", sans-serif';
    case 'merriweather':
      return '"Merriweather", Georgia, serif';
    case 'cinzel':
      return '"Cinzel", Georgia, serif';
    case 'rubik':
      return '"Rubik", "Segoe UI", sans-serif';
    case 'outfit':
      return '"Outfit", "Segoe UI", sans-serif';
    case 'manrope':
      return '"Manrope", "Segoe UI", sans-serif';
    case 'comfortaa':
      return '"Comfortaa", "Segoe UI", sans-serif';
    case 'caveat':
      return '"Caveat", "Segoe UI", cursive';
    case 'lobster':
      return '"Lobster", "Segoe UI", cursive';
    case 'anton':
      return '"Anton", "Segoe UI", sans-serif';
    case 'fira-code':
      return '"Fira Code", "Consolas", monospace';
    case 'ibm-plex-serif':
      return '"IBM Plex Serif", Georgia, serif';
    case 'josefin-sans':
      return '"Josefin Sans", "Segoe UI", sans-serif';
    case 'orbitron':
      return '"Orbitron", "Segoe UI", sans-serif';
    case 'space-grotesk':
    default:
      return '"Space Grotesk", "Segoe UI", sans-serif';
  }
}

function getGroupNameStyle(thread) {
  return {
    color: normalizeGroupNameColor(thread?.nameColor),
    fontFamily: groupNameFontFamily(thread?.nameFont)
  };
}
