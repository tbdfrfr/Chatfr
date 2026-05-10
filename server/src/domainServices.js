import { createMessageDomain } from './messageDomain.js';
import { createThreadQueryDomain } from './threadQueryDomain.js';
import { createThreadMutationDomain } from './threadMutationDomain.js';
import { createThreadAccessDomain } from './threadAccessDomain.js';
import { createUserQueryDomain } from './userQueryDomain.js';
import { createGlobalThreadDomain } from './globalThreadDomain.js';
import { createDmThreadDomain } from './dmThreadDomain.js';
import { createRealtimeDomain } from './realtimeDomain.js';
import { createProfileDomain } from './profileDomain.js';

export function createDomainServices({ pool, clientOrigin, clients = new Map() }) {
  const threadAccessDomain = createThreadAccessDomain({ pool });
  const threadQueryDomain = createThreadQueryDomain({ pool });
  const userQueryDomain = createUserQueryDomain({ pool });
  const threadMutationDomain = createThreadMutationDomain({
    pool,
    getThreadRow: threadQueryDomain.getThreadRow
  });
  const globalThreadDomain = createGlobalThreadDomain({ pool });
  const dmThreadDomain = createDmThreadDomain({ pool, getThreadById: threadQueryDomain.getThreadById });
  
  const messageDomain = createMessageDomain({ pool });
  const profileDomain = createProfileDomain({ pool });
  const realtimeDomain = createRealtimeDomain({
    clients,
    clientOrigin,
    canAccessThread: threadAccessDomain.canAccessThread,
    usersShareThread: threadAccessDomain.usersShareThread
  });

  return {
    canAccessThread: threadAccessDomain.canAccessThread,
    joinGlobal: globalThreadDomain.joinGlobal,
    getUser: userQueryDomain.getUser,
    listThreads: threadQueryDomain.listThreads,
    getThreadById: threadQueryDomain.getThreadById,
    leaveThread: threadMutationDomain.leaveThread,
    getThreadRow: threadQueryDomain.getThreadRow,
    getOrCreateDmThread: dmThreadDomain.getOrCreateDmThread,
    hydrateMessage: messageDomain.hydrateMessage,
    formatMessage: messageDomain.formatMessage,
    broadcastThreadUpdate: realtimeDomain.broadcastThreadUpdate,
    broadcastUserUpdate: realtimeDomain.broadcastUserUpdate,
    isAllowedWebSocketOrigin: realtimeDomain.isAllowedWebSocketOrigin,
    seedTbdAccountProfilePicture: profileDomain.seedTbdAccountProfilePicture
  };
}
