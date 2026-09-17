import { useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useCase } from './useCase';

export const useRealtime = (caseId: string | null) => {
  const { addNotification, updatePharmacyStatus, refreshCase, cases } = useCase();

  // Log active context to satisfy TS compiler checks
  useEffect(() => {
    if (caseId) {
      console.log(`[Realtime] Initializing updates context for Case ID: ${caseId}`);
    }
  }, [caseId]);

  // 1. Supabase Postgres Changes global subscription
  useEffect(() => {
    let channel: any = null;
    try {
      channel = supabase
        .channel('global-cases-realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'cases' },
          (payload: any) => {
            const newCaseId = payload.new.case_id;
            addNotification(`[Realtime Alert] New case registered: Case ID ${newCaseId}`);
            refreshCase(newCaseId);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'cases' },
          (payload: any) => {
            const updatedCaseId = payload.new.case_id;
            addNotification(`[Realtime Update] Case ${updatedCaseId} status: ${payload.new.status}`);
            refreshCase(updatedCaseId);
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('[Realtime] Subscription skipped or failed:', e);
    }

    return () => {
      try {
        if (channel && typeof channel.unsubscribe === 'function') {
          channel.unsubscribe();
        }
      } catch (e) { /* ignore */ }
    };
  }, [refreshCase, addNotification]);

  // 2. background simulation: periodically progress en-route pharmacy orders
  useEffect(() => {
    const interval = setInterval(() => {
      // Look for any case in 'Preparing' status and mark it 'Ready' after some time
      const preparingCase = cases.find(c => c.status === 'Pharmacy' && c.pharmacyStatus === 'Preparing');
      if (preparingCase && Math.random() > 0.4) {
        updatePharmacyStatus(preparingCase.id, 'Ready');
        addNotification(`[Realtime Alert] Medicines are now READY for collection for Case ${preparingCase.id} (${preparingCase.patient.name})`);
      }

      // Look for a case that is 'Received' and start 'Preparing'
      const receivedCase = cases.find(c => c.status === 'Pharmacy' && c.pharmacyStatus === 'Received');
      if (receivedCase && Math.random() > 0.4) {
        updatePharmacyStatus(receivedCase.id, 'Preparing');
      }
    }, 15000); // check every 15s

    return () => clearInterval(interval);
  }, [cases, updatePharmacyStatus, addNotification]);
};

export default useRealtime;
