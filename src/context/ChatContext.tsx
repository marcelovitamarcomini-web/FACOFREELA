import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { ContactMessage } from '../../shared/contracts';
import { useAppSession } from './AppSessionContext';
import { api } from '../lib/api';
import { getLatestMessage, isConversationUnread, sortContactsByLatest } from '../lib/chat';

type SeenMap = Record<string, string>;

interface ChatContextValue {
  contacts: ContactMessage[];
  notifications: ContactMessage[];
  loading: boolean;
  error: string | null;
  activeChatId: string | null;
  dockChatId: string | null;
  pendingContactIds: string[];
  refresh: () => Promise<void>;
  selectChat: (contactId: string) => void;
  openDockChat: (contactId: string) => void;
  closeDockChat: () => void;
  markAsRead: (contactId: string) => void;
  sendMessage: (contactId: string, message: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

function getSeenStorageKey(userId: string) {
  return `facofreela.chat-seen.v2.${userId}`;
}

function clearLegacySeenStorage(userId: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const keysToRemove: string[] = [];
  const currentKey = getSeenStorageKey(userId);

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith('facofreela.chat-seen.') && key !== currentKey) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}

function readSeenMap(userId: string): SeenMap {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(getSeenStorageKey(userId));
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue) as SeenMap;
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeSeenMap(userId: string, value: SeenMap) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getSeenStorageKey(userId), JSON.stringify(value));
}

function orderContacts(contacts: ContactMessage[]) {
  return [...contacts].sort(sortContactsByLatest);
}

function upsertContact(currentContacts: ContactMessage[], updatedContact: ContactMessage) {
  return orderContacts([
    updatedContact,
    ...currentContacts.filter((contact) => contact.id !== updatedContact.id),
  ]);
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { loading: sessionLoading, session } = useAppSession();
  const [contacts, setContacts] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [dockChatId, setDockChatId] = useState<string | null>(null);
  const [pendingContactIds, setPendingContactIds] = useState<string[]>([]);
  const [seenByContact, setSeenByContact] = useState<SeenMap>({});

  async function refresh() {
    if (!session) {
      return;
    }

    setLoading(true);

    try {
      const response = await api.getInbox();
      const nextContacts = orderContacts(response.contacts);

      setContacts(nextContacts);
      setError(null);
      setActiveChatId((current) => {
        if (current && nextContacts.some((contact) => contact.id === current)) {
          return current;
        }

        return nextContacts[0]?.id ?? null;
      });
      setDockChatId((current) => {
        if (current && nextContacts.some((contact) => contact.id === current)) {
          return current;
        }

        return null;
      });
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Não foi possível carregar a central de mensagens.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (!session) {
      setContacts([]);
      setError(null);
      setActiveChatId(null);
      setDockChatId(null);
      setPendingContactIds([]);
      setSeenByContact({});
      setLoading(false);
      return;
    }

    clearLegacySeenStorage(session.id);
    setSeenByContact(readSeenMap(session.id));

    void refresh();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [session, sessionLoading]);

  useEffect(() => {
    if (!session) {
      return;
    }

    writeSeenMap(session.id, seenByContact);
  }, [seenByContact, session]);

  function markAsRead(contactId: string) {
    setSeenByContact((current) => {
      const contact = contacts.find((item) => item.id === contactId);
      const latestMessage = contact ? getLatestMessage(contact) : null;

      if (!latestMessage || current[contactId] === latestMessage.id) {
        return current;
      }

      return {
        ...current,
        [contactId]: latestMessage.id,
      };
    });
  }

  function selectChat(contactId: string) {
    setActiveChatId(contactId);
    markAsRead(contactId);
  }

  function openDockChat(contactId: string) {
    setDockChatId(contactId);
    setActiveChatId(contactId);
    markAsRead(contactId);
  }

  function closeDockChat() {
    setDockChatId(null);
  }

  async function sendMessage(contactId: string, message: string) {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    setPendingContactIds((current) =>
      current.includes(contactId) ? current : [...current, contactId],
    );

    try {
      const updatedContact = await api.sendContactMessage(contactId, {
        message: trimmedMessage,
      });

      setContacts((current) => upsertContact(current, updatedContact));
      setActiveChatId(updatedContact.id);
      setSeenByContact((current) => {
        const latestMessage = getLatestMessage(updatedContact);
        if (!latestMessage) {
          return current;
        }

        return {
          ...current,
          [updatedContact.id]: latestMessage.id,
        };
      });
      setError(null);
    } finally {
      setPendingContactIds((current) => current.filter((id) => id !== contactId));
    }
  }

  const notifications =
    session?.role && contacts.length > 0
      ? contacts.filter((contact) =>
          isConversationUnread(contact, session.role, seenByContact[contact.id]),
        )
      : [];

  return (
    <ChatContext.Provider
      value={{
        contacts,
        notifications,
        loading: sessionLoading || loading,
        error,
        activeChatId,
        dockChatId,
        pendingContactIds,
        refresh,
        selectChat,
        openDockChat,
        closeDockChat,
        markAsRead,
        sendMessage,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider.');
  }

  return context;
}
