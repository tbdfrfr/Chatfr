import { useEffect, useMemo, useState } from 'react';
import { api } from './lib/api.js';
import { clearStoredSession, getStoredUser, saveStoredUser } from './lib/storage.js';
import { AuthScreen, SignupUserNumberNotice } from './features/auth/AuthScreen.jsx';
import { ThreadSidebar } from './features/threads/ThreadSidebar.jsx';
import { threadMatchesSearch } from './features/threads/threadUtils.js';
import { GroupEditorModal } from './features/groups/GroupEditorModal.jsx';
import { ChatThread } from './features/chat/ChatThread.jsx';
import { CreateConversationModal } from './features/chat/CreateConversationModal.jsx';
import { useChatSocket } from './features/chat/useChatSocket.js';
import { SettingsModal } from './features/settings/SettingsModal.jsx';

export default function App() {
  const [me, setMe] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);
  const [signupNoticeUserNumber, setSignupNoticeUserNumber] = useState(null);

  useEffect(() => {
    let cancelled = false;

    api('/api/me')
      .then((data) => {
        if (!cancelled) {
          setMe(data.user);
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearStoredSession();
          setMe(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!me) {
      return;
    }

    saveStoredUser(me);
  }, [me]);

  const onAuth = (user, options = {}) => {
    saveStoredUser(user);
    setMe(user);

    if (options.showUserNumberNotice) {
      setSignupNoticeUserNumber(user?.id ?? null);
    }
  };

  const logout = () => {
    api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearStoredSession();
    setMe(null);
    setSignupNoticeUserNumber(null);
  };

  if (loading) {
    return <Shell><div>Loading session...</div></Shell>;
  }

  if (!me) {
    return <AuthScreen onAuth={onAuth} />;
  }

  return (
    <>
      <ChatApp me={me} onMeChange={setMe} onLogout={logout} />
      {signupNoticeUserNumber ? (
        <SignupUserNumberNotice
          userNumber={signupNoticeUserNumber}
          onContinue={() => setSignupNoticeUserNumber(null)}
        />
      ) : null}
    </>
  );
}

function ChatApp({ me, onMeChange, onLogout }) {
  const [threads, setThreads] = useState([]);
  const [currentThreadId, setCurrentThreadId] = useState('global');
  const [threadSearch, setThreadSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupEditorThread, setGroupEditorThread] = useState(null);
  const [groupEditorCanEdit, setGroupEditorCanEdit] = useState(false);
  const [threadActionError, setThreadActionError] = useState('');

  useEffect(() => {
    loadThreads();
  }, []);

  useChatSocket({
    meId: me.id,
    onMeChange,
    onMessage: (payload) => {
      setThreads((previous) => bumpThread(previous, payload.threadId, payload.message));
      window.dispatchEvent(new CustomEvent('chatfr:new-message', { detail: payload }));
    },
    onUserUpdate: (user) => {
      setThreads((previous) => updateUserInThreads(previous, user));
      window.dispatchEvent(new CustomEvent('chatfr:user-updated', { detail: user }));
    }
  });

  async function loadThreads() {
    const data = await api('/api/threads');
    setThreads(data.threads);
  }

  const openCreateDialog = () => {
    setCreateOpen(true);
  };

  const closeCreateDialog = () => {
    setCreateOpen(false);
  };

  const handleThreadCreated = (thread) => {
    setThreads((previous) => upsertThread(previous, thread));
    setCurrentThreadId(thread.id);
  };

  const handleSettingsSaved = (user) => {
    onMeChange(user);
    loadThreads();
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
      <ThreadSidebar
          me={me}
          currentThreadId={currentThreadId}
          threadSearch={threadSearch}
          filteredThreads={filteredThreads}
          onCreateThread={openCreateDialog}
          onOpenSettings={() => setSettingsOpen(true)}
          onSelectThread={setCurrentThreadId}
          onLeaveThread={leaveThread}
          onThreadSearchChange={setThreadSearch}
          threadActionError={threadActionError}
        />

      <main className="chat-shell">
        <ChatThread thread={currentThread} me={me} onEditGroup={openGroupEditor} />
      </main>

      {createOpen ? (
        <CreateConversationModal
          me={me}
          onClose={closeCreateDialog}
          onCreated={handleThreadCreated}
        />
      ) : null}

      {groupEditorOpen && groupEditorThread ? (
        <GroupEditorModal
          me={me}
          thread={groupEditorThread}
          canEdit={groupEditorCanEdit}
          onClose={closeGroupEditor}
          onSaved={handleGroupSaved}
          onDeleted={handleGroupDeleted}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsModal
          me={me}
          onClose={() => setSettingsOpen(false)}
          onSaved={handleSettingsSaved}
          onLogout={onLogout}
        />
      ) : null}
    </Shell>
  );
}

function Shell({ children, wide = false }) {
  return (
    <div className={`shell ${wide ? 'wide' : ''}`}>
      <div className="frame">{children}</div>
    </div>
  );
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
