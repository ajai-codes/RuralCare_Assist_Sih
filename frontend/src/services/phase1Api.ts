import type { Appointment, Teleconsultation } from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

export function getSignalingWsUrl(roomId: string): string {
  const wsHost = window.location.hostname || 'localhost';
  return `ws://${wsHost}:8000/api/ws/teleconsultation/${roomId}`;
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      throw new Error((errBody && errBody.detail) || `HTTP error ${res.status}`);
    }
    const data = await res.json();
    return (data && data.data !== undefined) ? data.data : data;
  } catch (e: any) {
    clearTimeout(timeoutId);
    console.warn(`[Phase1Api] Call to ${url} failed or timed out:`, e.message || e);
    return null;
  }
}

export const appointmentApi = {
  list: async (params?: { patient_id?: string; facility_id?: string; doctor_id?: string; appointment_date?: string }): Promise<Appointment[]> => {
    const cleanParams: any = {};
    if (params) {
      Object.keys(params).forEach(k => {
        if ((params as any)[k]) cleanParams[k] = (params as any)[k];
      });
    }
    const q = new URLSearchParams(cleanParams).toString();
    const res = await fetchJSON<Appointment[]>(`${API_BASE_URL}/appointments?${q}`);
    return res || [];
  },

  get: async (id: string): Promise<Appointment | null> => {
    return fetchJSON<Appointment>(`${API_BASE_URL}/appointments/${id}`);
  },

  create: async (data: Partial<Appointment>): Promise<Appointment | null> => {
    return fetchJSON<Appointment>(`${API_BASE_URL}/appointments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getQueueStatus: async (id: string): Promise<any> => {
    return fetchJSON<any>(`${API_BASE_URL}/appointments/${id}/queue`);
  },

  updateStatus: async (id: string, status: string): Promise<Appointment | null> => {
    return fetchJSON<Appointment>(`${API_BASE_URL}/appointments/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  checkIn: async (id: string): Promise<Appointment | null> => {
    return fetchJSON<Appointment>(`${API_BASE_URL}/appointments/${id}/check-in`, {
      method: 'PUT'
    });
  },

  markNoShow: async (id: string): Promise<Appointment | null> => {
    return fetchJSON<Appointment>(`${API_BASE_URL}/appointments/${id}/no-show`, {
      method: 'PUT'
    });
  },

  reschedule: async (id: string, newDate: string, newTimeSlot: string): Promise<Appointment | null> => {
    return fetchJSON<Appointment>(`${API_BASE_URL}/appointments/${id}/reschedule`, {
      method: 'PUT',
      body: JSON.stringify({ new_date: newDate, new_time_slot: newTimeSlot })
    });
  },

  cancel: async (id: string): Promise<Appointment | null> => {
    return fetchJSON<Appointment>(`${API_BASE_URL}/appointments/${id}`, {
      method: 'DELETE'
    });
  }
};

export const teleconsultationApi = {
  list: async (params?: { patient_id?: string; doctor_id?: string }): Promise<Teleconsultation[]> => {
    const cleanParams: any = {};
    if (params) {
      Object.keys(params).forEach(k => {
        if ((params as any)[k]) cleanParams[k] = (params as any)[k];
      });
    }
    const q = new URLSearchParams(cleanParams).toString();
    const res = await fetchJSON<Teleconsultation[]>(`${API_BASE_URL}/teleconsultations?${q}`);
    return res || [];
  },

  create: async (data: Partial<Teleconsultation>): Promise<Teleconsultation | null> => {
    return fetchJSON<Teleconsultation>(`${API_BASE_URL}/teleconsultations`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  get: async (id: string): Promise<Teleconsultation | null> => {
    return fetchJSON<Teleconsultation>(`${API_BASE_URL}/teleconsultations/${id}`);
  },

  updateStatus: async (id: string, status: string, duration_seconds?: number): Promise<Teleconsultation | null> => {
    return fetchJSON<Teleconsultation>(`${API_BASE_URL}/teleconsultations/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, duration_seconds })
    });
  },

  addNotes: async (id: string, notes: string, clinical_priority?: string, priority_reason?: string): Promise<Teleconsultation | null> => {
    return fetchJSON<Teleconsultation>(`${API_BASE_URL}/teleconsultations/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ notes, clinical_priority, priority_reason })
    });
  },

  reassessPriority: async (id: string, clinical_priority: string, priority_reason: string): Promise<Teleconsultation | null> => {
    return fetchJSON<Teleconsultation>(`${API_BASE_URL}/teleconsultations/${id}/reassess-priority`, {
      method: 'PUT',
      headers: { 'x-user-role': 'doctor' },
      body: JSON.stringify({ clinical_priority, priority_reason })
    });
  }
};

