import type {
  ApiEnvelope,
  ClientDashboard,
  ContactMessage,
  Freelancer,
  FreelancerDashboard,
  SessionUser,
} from '../../shared/contracts';

interface SearchFilters {
  search?: string;
  category?: string;
  location?: string;
  experience?: string;
  maxPrice?: string;
}

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = (await response.json()) as
    | (ApiEnvelope<T> & {
        errors?: unknown;
      })
    | undefined;

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Não foi possível concluir a operação.');
  }

  return payload?.data as T;
}

export const api = {
  getFreelancers(filters: SearchFilters, init?: RequestInit) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    const query = params.toString();
    return request<Freelancer[]>(`/freelancers${query ? `?${query}` : ''}`, init);
  },
  getFreelancer(slug: string, init?: RequestInit) {
    return request<Freelancer>(`/freelancers/${slug}`, init);
  },
  registerClient(payload: unknown) {
    return request<{ user: SessionUser }>('/auth/register/client', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  registerFreelancer(payload: unknown) {
    return request<{ user: SessionUser }>('/auth/register/freelancer', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  login(payload: unknown) {
    return request<{ user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  getSession() {
    return request<{ user: SessionUser }>('/auth/session');
  },
  logout() {
    return request<null>('/auth/logout', {
      method: 'POST',
    });
  },
  createContact(
    payload: Pick<ContactMessage, 'freelancerId' | 'freelancerName' | 'subject' | 'message' | 'channel'>,
  ) {
    return request<ContactMessage>('/contacts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  sendContactMessage(contactId: string, payload: Pick<ContactMessage, 'message'>) {
    return request<ContactMessage>(`/contacts/${contactId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  getFreelancerDashboard(init?: RequestInit) {
    return request<FreelancerDashboard>('/dashboard/freelancer', init);
  },
  getClientDashboard(init?: RequestInit) {
    return request<ClientDashboard>('/dashboard/client', init);
  },
};
