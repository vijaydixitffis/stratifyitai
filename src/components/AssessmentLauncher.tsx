import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { createAssignment } from '../services/assessProApiClient';
import { Organization } from '../services/organizationService';
import {
  X, Users, Calendar, Loader2, CheckCircle, AlertCircle, Building
} from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AssessmentLauncherProps {
  paAssessmentId: string;
  assessmentTitle: string;
  assessproAssessmentId: string;
  orgs: Organization[];
  defaultOrgId?: number | null;
  defaultOrgCode?: string | null;
  onClose: () => void;
  onAssigned: () => void;
}

const AssessmentLauncher: React.FC<AssessmentLauncherProps> = ({
  paAssessmentId,
  assessmentTitle,
  assessproAssessmentId,
  orgs,
  defaultOrgId,
  defaultOrgCode,
  onClose,
  onAssigned,
}) => {
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(defaultOrgId ?? null);
  const [selectedOrgCode, setSelectedOrgCode] = useState<string>(defaultOrgCode ?? '');
  const [orgUsers, setOrgUsers] = useState<UserProfile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (selectedOrgId) loadOrgUsers(selectedOrgId);
    else setOrgUsers([]);
  }, [selectedOrgId]);

  const loadOrgUsers = async (orgId: number) => {
    if (!supabase) return;
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('org_id', orgId)
        .order('name');
      if (error) throw error;
      setOrgUsers(data ?? []);
    } catch {
      setOrgUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOrgChange = (orgId: number) => {
    const org = orgs.find(o => o.org_id === orgId);
    setSelectedOrgId(orgId);
    setSelectedOrgCode(org?.org_code ?? '');
    setSelectedUserIds([]);
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleAssign = async () => {
    if (!selectedOrgId || selectedUserIds.length === 0) {
      setError('Please select an organization and at least one user.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const selectedUsers = orgUsers
        .filter(u => selectedUserIds.includes(u.id))
        .map(u => ({ id: u.id, email: u.email, name: u.name }));

      await createAssignment({
        assessment_id:    assessproAssessmentId,
        assessment_title: assessmentTitle,
        users:            selectedUsers,
        org_id:           selectedOrgId,
        org_code:         selectedOrgCode,
        due_date:         dueDate || null,
        pa_assessment_id: paAssessmentId,
      });
      setSuccess(true);
      setTimeout(() => {
        onAssigned();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign assessment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Assign Assessment</h2>
            <p className="text-sm text-gray-500 mt-1">{assessmentTitle}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {success && (
            <div className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-800 font-medium">Assessment assigned successfully!</span>
            </div>
          )}

          {error && (
            <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {/* Organization Selector */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
              <Building className="h-4 w-4" />
              <span>Client Organization *</span>
            </label>
            <select
              value={selectedOrgId ?? ''}
              onChange={e => handleOrgChange(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select organization...</option>
              {orgs.map(org => (
                <option key={org.org_id} value={org.org_id}>
                  {org.org_name} ({org.org_code})
                </option>
              ))}
            </select>
          </div>

          {/* User Selector */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
              <Users className="h-4 w-4" />
              <span>Assign To *</span>
            </label>
            {loadingUsers ? (
              <div className="flex items-center space-x-2 py-3 text-gray-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading users...</span>
              </div>
            ) : !selectedOrgId ? (
              <p className="text-sm text-gray-400 py-2">Select an organization first</p>
            ) : orgUsers.length === 0 ? (
              <p className="text-sm text-yellow-600 py-2">No users found in this organization</p>
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
                {orgUsers.map(u => (
                  <label key={u.id} className="flex items-center space-x-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email} · {u.role}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4" />
              <span>Due Date (optional)</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex space-x-3 p-6 pt-0">
          <button
            onClick={handleAssign}
            disabled={loading || success || !selectedOrgId || selectedUserIds.length === 0}
            className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /><span>Assigning...</span></>
            ) : (
              <><Users className="h-4 w-4" /><span>Assign to {selectedUserIds.length > 0 ? `${selectedUserIds.length} user${selectedUserIds.length > 1 ? 's' : ''}` : 'Users'}</span></>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssessmentLauncher;
