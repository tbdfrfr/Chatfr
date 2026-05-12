import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserLabel } from '../../components/ui/UserLabel.jsx';
import { useMentionUsers } from './messageMentions.js';

function MentionToken({ mention, user }) {
  const triggerRef = useRef(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const updateTooltipPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();

    if (!rect) {
      setTooltipPosition(null);
      return;
    }

    setTooltipPosition({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2
    });
  }, []);

  useEffect(() => {
    if (!tooltipPosition) {
      return undefined;
    }

    window.addEventListener('resize', updateTooltipPosition);
    window.addEventListener('scroll', updateTooltipPosition, true);

    return () => {
      window.removeEventListener('resize', updateTooltipPosition);
      window.removeEventListener('scroll', updateTooltipPosition, true);
    };
  }, [tooltipPosition, updateTooltipPosition]);

  const showTooltip = () => {
    if (user) {
      updateTooltipPosition();
    }
  };

  const hideTooltip = () => {
    setTooltipPosition(null);
  };

  return (
    <span
      ref={triggerRef}
      className={user ? 'message-mention has-preview' : undefined}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      tabIndex={user ? 0 : undefined}
    >
      {mention.text}
      {user && tooltipPosition ? createPortal(
        <span
          className="mention-tooltip"
          role="tooltip"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`
          }}
        >
          <UserLabel user={user} className="mention-preview-label" />
        </span>,
        document.body
      ) : null}
    </span>
  );
}

export function MessageContent({ content, token }) {
  const { parts, mentionUsers } = useMentionUsers(content, token);

  return (
    <p>
      {parts.map((part, index) => (
        part.type === 'mention'
          ? <MentionToken key={index} mention={part} user={mentionUsers[part.id] || null} />
          : <span key={index}>{part.text}</span>
      ))}
    </p>
  );
}
