import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Organization } from '../services/organizationService';

interface SelectedOrgContextType {
  selectedOrg: Organization | null;
  setSelectedOrg: (org: Organization | null) => void;
}

const SelectedOrgContext = createContext<SelectedOrgContextType | undefined>(undefined);

export const SelectedOrgProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  return (
    <SelectedOrgContext.Provider value={{ selectedOrg, setSelectedOrg }}>
      {children}
    </SelectedOrgContext.Provider>
  );
};

export const useSelectedOrg = () => {
  const context = useContext(SelectedOrgContext);
  if (context === undefined) {
    throw new Error('useSelectedOrg must be used within a SelectedOrgProvider');
  }
  return context;
}; 