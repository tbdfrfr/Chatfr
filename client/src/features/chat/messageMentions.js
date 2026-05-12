import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';

const MENTION_PATTERN = /@(\d+)/g;

function buildMessageParts(content) {
  const parts = [];
  let lastIndex = 0;

  for (const match of content.matchAll(MENTION_PATTERN)) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: content.slice(lastIndex, match.index) });
    }

    parts.push({
      type: 'mention',
      text: match[0],
      id: Number(match[1])
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', text: content.slice(lastIndex) });
  }

  return parts;
}

export function useMentionUsers(content, token) {
  const [mentionUsers, setMentionUsers] = useState({});
  const parts = useMemo(() => buildMessageParts(content), [content]);
  const mentionIds = useMemo(() => (
    [...new Set(parts.filter((part) => part.type === 'mention').map((part) => part.id))]
  ), [parts]);

  useEffect(() => {
    const unresolvedMentionIds = mentionIds.filter((id) => !(id in mentionUsers));

    if (!unresolvedMentionIds.length) {
      return undefined;
    }

    let cancelled = false;

    Promise.allSettled(unresolvedMentionIds.map(async (id) => {
      try {
        const data = await api(`/api/users/${id}`, { token });
        return { id, user: data.user || null };
      } catch {
        return { id, user: null };
      }
    })).then((results) => {
      if (cancelled) {
        return;
      }

      setMentionUsers((previous) => {
        const next = { ...previous };

        for (const result of results) {
          if (result.status === 'fulfilled') {
            next[result.value.id] = result.value.user;
          }
        }

        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [mentionIds, mentionUsers, token]);

  return { parts, mentionUsers };
}
