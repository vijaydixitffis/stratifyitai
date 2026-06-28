import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AssignmentCache } from '../types/assessPro';
import {
  FileText, Clock, CheckCircle, Play, RefreshCw,
  Calendar, User, AlertCircle, Loader2, ChevronRight, Brain
} from 'lucide-react';

const isAssetReview = (title: string) => title?.startsWith('Architecture Review:');

interface MyAssessmentsProps {
  onStart: (assignment: AssignmentCache) => void;
  onViewResults: (assignment: AssignmentCache) => void;
}

const STATUS_CONFIG = {
  ASSIGNED: {
    label: 'Ready to Start',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Play,
    action: 'Start',
    actionClass: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  STARTED: {
    label: 'In Progress',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: Clock,
    action: 'Continue',
    actionClass: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  COMPLETED: {
    label: 'Completed',
    badge: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
    action: 'View Results',
    actionClass: 'bg-green-600 hover:bg-green-700 text-white',
  },
};

const MyAssessments: React.FC<MyAssessmentsProps> = ({ onStart, onViewResults }) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentCache[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('assessment_assignments_cache')
        .select('*')
        .eq('assigned_to_user_id', user.id)
        .order('assigned_at', { ascending: false });

      if (dbError) throw dbError;
      setAssignments(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleAction = (assignment: AssignmentCache) => {
    if (assignment.status === 'COMPLETED') {
      onViewResults(assignment);
    } else {
      onStart(assignment);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 py-6 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading your assessments...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <FileText className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No assessments assigned yet</p>
        <p className="text-sm text-gray-500 mt-1">Your consultant will assign assessments here</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">My Assessments</h3>
        <button
          onClick={loadAssignments}
          className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="space-y-3">
        {assignments.map(assignment => {
          const config = STATUS_CONFIG[assignment.status] ?? STATUS_CONFIG.ASSIGNED;
          const StatusIcon = config.icon;

          return (
            <div
              key={assignment.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900 truncate">{assignment.assessment_title}</h4>
                    {isAssetReview(assignment.assessment_title) && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
                        <Brain className="h-3 w-3" />
                        <span>Asset Review</span>
                      </span>
                    )}
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.badge}`}>
                      <StatusIcon className="h-3 w-3" />
                      <span>{config.label}</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    {assignment.assigned_at && (
                      <span className="flex items-center space-x-1">
                        <User className="h-3 w-3" />
                        <span>Assigned {new Date(assignment.assigned_at).toLocaleDateString()}</span>
                      </span>
                    )}
                    {assignment.due_date && (
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>Due {new Date(assignment.due_date).toLocaleDateString()}</span>
                      </span>
                    )}
                    {assignment.completed_at && (
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Completed {new Date(assignment.completed_at).toLocaleDateString()}</span>
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleAction(assignment)}
                  className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${config.actionClass}`}
                >
                  <span>{config.action}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyAssessments;
