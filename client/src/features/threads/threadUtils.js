export function threadMatchesSearch(thread, query, meId) {
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

export function getDmOtherUser(thread, meId) {
  const members = Array.isArray(thread.members) ? thread.members : [];
  return members.find((member) => Number(member.id) !== Number(meId)) || null;
}

export function userLabelText(user) {
  if (!user) {
    return 'Unknown';
  }

  if (user.displayName) {
    return `${user.displayName} #${user.id}`;
  }

  return `#${user.id}`;
}