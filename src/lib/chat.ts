import type { ContactMessage, UserRole } from '../../shared/contracts';

export function getLatestMessage(contact: ContactMessage) {
  return contact.messages[contact.messages.length - 1] ?? null;
}

export function getConversationPeerName(contact: ContactMessage, role: UserRole) {
  return role === 'freelancer' ? contact.clientName : contact.freelancerName;
}

export function isConversationUnread(
  contact: ContactMessage,
  role: UserRole,
  seenMessageId?: string,
) {
  const latestMessage = getLatestMessage(contact);
  if (!latestMessage) {
    return false;
  }

  return latestMessage.senderRole !== role && latestMessage.id !== seenMessageId;
}

export function sortContactsByLatest(left: ContactMessage, right: ContactMessage) {
  const leftTimestamp = Date.parse(getLatestMessage(left)?.createdAt ?? left.createdAt);
  const rightTimestamp = Date.parse(getLatestMessage(right)?.createdAt ?? right.createdAt);

  return rightTimestamp - leftTimestamp;
}
