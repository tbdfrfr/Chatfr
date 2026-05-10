import React from 'react';
import { UserLabel } from '../../components/ui/UserLabel.jsx';
import { getDmOtherUser } from './threadUtils.js';

export function ThreadSidebar({
  me,
  currentThreadId,
  threadSearch,
  filteredThreads,
  onCreateThread,
  onOpenSettings,
  onSelectThread,
  onLeaveThread,
  onThreadSearchChange,
  threadActionError
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-actions">
        <div className="sidebar-actions-left">
          <button className="circle-button" type="button" onClick={onCreateThread}>+</button>
          <button className="circle-button" type="button" aria-label="Settings" title="Settings" onClick={onOpenSettings} style={{ fontSize: '1.8rem' }}>
            {'\u2699'}
          </button>
        </div>
        <a className="sidebar-coffee-link" href="https://buymeacoffee.com/tbdfr" target="_blank" rel="noopener noreferrer">☕ Buy me a coffee</a>
      </div>
      <div className="field thread-search">
        <input aria-label="Search threads" value={threadSearch} onChange={(event) => onThreadSearchChange?.(event.target.value)} placeholder="Find a thread or person" type="search" />
      </div>

      <div className="thread-list">
        <ThreadButton thread={{ id: 'global', type: 'global', name: 'Global' }} meId={me.id} active={currentThreadId === 'global'} onClick={() => onSelectThread('global')} />
        {filteredThreads.map((thread) => (
          thread.id === 'global' ? null : (
            <ThreadButton key={thread.id} thread={thread} meId={me.id} active={currentThreadId === thread.id} onClick={() => onSelectThread(thread.id)} onLeave={() => onLeaveThread(thread.id)} />
          )
        ))}
      </div>
      {threadActionError ? <div className="error-text thread-action-error">{threadActionError}</div> : null}
    </aside>
  );
}

function ThreadButton({ thread, meId, active, onClick, onLeave }) {
  const title = thread.type === 'global'
    ? 'Global'
    : thread.type === 'dm'
      ? <UserLabel user={getDmOtherUser(thread, meId)} />
      : <span className="group-name">{thread.name || `Group ${thread.id.slice(-4)}`}</span>;

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
