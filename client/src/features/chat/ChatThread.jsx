import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import { UserLabel } from '../../components/ui/UserLabel.jsx';
import { getDmOtherUser } from '../threads/threadUtils.js';
import { getGroupNameStyle } from '../groups/groupHelpers.js';

export function ChatThread({ token, thread, me, onEditGroup }) {
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

  const title = thread.type === 'global'
    ? 'Global chat'
    : thread.type === 'dm'
      ? <UserLabel user={getDmOtherUser(thread, me.id)} />
      : <span className="group-name" style={getGroupNameStyle(thread)}>{thread.name || 'Group chat'}</span>;

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
