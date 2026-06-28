import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useSelectedOrg } from './SelectedOrgContext';

interface PhaseContextType {
  currentPhase: number;
  canAccessPhase: (n: number) => boolean;
  advancePhase: () => Promise<void>;
  refreshPhase: () => Promise<void>;
  phaseLoading: boolean;
}

const PhaseContext = createContext<PhaseContextType | undefined>(undefined);

export const PhaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAdmin } = useAuth();
  const { selectedOrg } = useSelectedOrg();
  const [currentPhase, setCurrentPhase] = useState(1);
  const [phaseLoading, setPhaseLoading] = useState(false);

  const getOrgId = useCallback((): number | null => {
    if (isAdmin && selectedOrg) return selectedOrg.org_id;
    if (!isAdmin && user?.org_id) return user.org_id;
    return null;
  }, [isAdmin, selectedOrg, user]);

  const fetchPhase = useCallback(async () => {
    const orgId = getOrgId();
    if (!orgId || !isSupabaseConfigured() || !supabase) {
      setCurrentPhase(1);
      return;
    }
    setPhaseLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_orgs')
        .select('current_phase')
        .eq('org_id', orgId)
        .single();
      if (!error && data) {
        setCurrentPhase(data.current_phase ?? 1);
      }
    } catch {
      setCurrentPhase(1);
    } finally {
      setPhaseLoading(false);
    }
  }, [getOrgId]);

  useEffect(() => {
    fetchPhase();
  }, [fetchPhase]);

  const canAccessPhase = (n: number) => currentPhase >= n;

  const advancePhase = async () => {
    if (!isAdmin) throw new Error('Only admins can advance the phase');
    const orgId = getOrgId();
    if (!orgId || !isSupabaseConfigured() || !supabase) return;

    const nextPhase = currentPhase + 1;
    if (nextPhase > 3) return;

    const approvalField = `phase${currentPhase}_approved_at`;
    const approvedByField = `phase${currentPhase}_approved_by`;

    const { error } = await supabase
      .from('client_orgs')
      .update({
        current_phase: nextPhase,
        [approvalField]: new Date().toISOString(),
        [approvedByField]: user?.id,
      })
      .eq('org_id', orgId);

    if (error) throw error;
    setCurrentPhase(nextPhase);
  };

  return (
    <PhaseContext.Provider value={{
      currentPhase,
      canAccessPhase,
      advancePhase,
      refreshPhase: fetchPhase,
      phaseLoading,
    }}>
      {children}
    </PhaseContext.Provider>
  );
};

export const usePhase = () => {
  const context = useContext(PhaseContext);
  if (!context) throw new Error('usePhase must be used within a PhaseProvider');
  return context;
};
