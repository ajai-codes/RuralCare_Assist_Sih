import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock-ruralcare-api.supabase.co';
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

const isMock = supabaseUrl.includes('mock') || supabaseKey === 'mock-anon-key';

// Mock Supabase service for frontend demo fallback
const mockSupabase = {
  auth: {
    getUser: async () => ({
      data: { user: { id: 'demo-user-id', email: 'healthworker@ruralcare.org' } },
      error: null,
    }),
    signOut: async () => ({ error: null }),
  },
  from: (_table: string) => ({
    select: () => ({
      data: [],
      error: null,
      order: () => ({ data: [], error: null }),
      single: () => ({ data: null, error: null }),
    }),
    insert: (data: any) => ({
      data: [data],
      error: null,
    }),
    update: (data: any) => ({
      eq: (_key: string, _value: any) => ({
        data: [data],
        error: null,
      }),
    }),
  }),
  channel: (name: string) => {
    const mockChan = {
      on: (_event: string, _filter: any, _callback: (payload: any) => void) => mockChan,
      subscribe: () => {
        console.log(`[Realtime] Mock subscribed to channel: ${name}`);
        return mockChan;
      },
      unsubscribe: () => console.log(`[Realtime] Mock unsubscribed from channel: ${name}`),
    };
    return mockChan;
  },
};

export const supabase = isMock ? (mockSupabase as any) : createClient(supabaseUrl, supabaseKey);
