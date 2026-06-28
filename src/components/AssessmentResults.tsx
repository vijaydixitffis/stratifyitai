import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ResultCache, AIAnalysis, APTopicScore } from '../types/assessPro';
import {
  CheckCircle, TrendingUp, Clock, Loader2, AlertCircle,
  ArrowRight, BarChart3, RefreshCw
} from 'lucide-react';

interface AssessmentResultsProps {
  submissionId: string;
  assessmentTitle: string;
  onViewInsights: () => void;
  onClose: () => void;
}

const ScoreBar: React.FC<{ percentage: number; label: string; color?: string }> = ({
  percentage, label, color = 'bg-blue-500'
}) => (
  <div>
    <div className="flex justify-between text-sm mb-1">
      <span className="text-gray-700 font-medium">{label}</span>
      <span className="text-gray-900 font-semibold">{percentage}%</span>
    </div>
    <div className="w-full bg-gray-100 rounded-full h-2.5">
      <div
        className={`${color} h-2.5 rounded-full transition-all duration-700`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  </div>
);

const getScoreColor = (percentage: number) => {
  if (percentage >= 75) return 'text-green-600';
  if (percentage >= 50) return 'text-amber-600';
  return 'text-red-600';
};

const getBarColor = (percentage: number) => {
  if (percentage >= 75) return 'bg-green-500';
  if (percentage >= 50) return 'bg-amber-500';
  return 'bg-red-500';
};

const AssessmentResults: React.FC<AssessmentResultsProps> = ({
  submissionId, assessmentTitle, onViewInsights, onClose
}) => {
  const [result, setResult] = useState<ResultCache | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AIAnalysis['status']>('pending');
  const [loadingResult, setLoadingResult] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load result from cache
  useEffect(() => {
    const loadResult = async () => {
      if (!supabase) return;
      setLoadingResult(true);
      try {
        const { data, error: dbErr } = await supabase
          .from('assessment_results_cache')
          .select('*')
          .eq('assesspro_sub_id', submissionId)
          .single();
        if (dbErr) throw dbErr;
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load results');
      } finally {
        setLoadingResult(false);
      }
    };
    loadResult();
  }, [submissionId]);

  // Poll ai_analyses status every 5 seconds until completed/failed
  useEffect(() => {
    if (analysisStatus === 'completed' || analysisStatus === 'failed') return;
    if (!supabase) return;

    const poll = async () => {
      const { data } = await supabase!
        .from('ai_analyses')
        .select('status')
        .eq('assesspro_sub_id', submissionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (data?.status) setAnalysisStatus(data.status as AIAnalysis['status']);
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [submissionId, analysisStatus]);

  if (loadingResult) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Results Not Available Yet</h3>
          <p className="text-gray-600 mb-2">{error}</p>
          <p className="text-sm text-gray-500 mb-6">Results are processed by the server. Please check back shortly.</p>
          <div className="flex space-x-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry</span>
            </button>
            <button onClick={onClose} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const topicScores: APTopicScore[] = (result?.topic_scores as APTopicScore[]) ?? [];
  const overallPct = result?.percentage ?? 0;

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-9 w-9 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Assessment Complete!</h1>
          <p className="text-gray-500">{assessmentTitle}</p>

          <div className="mt-6">
            <span className={`text-5xl font-extrabold ${getScoreColor(overallPct)}`}>
              {overallPct}%
            </span>
            <p className="text-gray-500 mt-1 text-sm">
              {result?.total_score ?? 0} / {result?.max_score ?? 0} points
            </p>
          </div>

          {/* Overall bar */}
          <div className="mt-4 mx-auto max-w-xs">
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className={`${getBarColor(overallPct)} h-3 rounded-full transition-all duration-700`}
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Topic Breakdown */}
        {topicScores.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
            <div className="flex items-center space-x-2 mb-5">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Topic Breakdown</h2>
            </div>
            <div className="space-y-4">
              {topicScores.map(ts => (
                <ScoreBar
                  key={ts.topic_id}
                  label={ts.topic_title}
                  percentage={ts.percentage}
                  color={getBarColor(ts.percentage)}
                />
              ))}
            </div>
          </div>
        )}

        {/* AI Analysis Status */}
        <div className={`rounded-2xl border p-6 mb-6 ${
          analysisStatus === 'completed'
            ? 'bg-blue-50 border-blue-200'
            : analysisStatus === 'failed'
            ? 'bg-red-50 border-red-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-center space-x-3">
            {analysisStatus === 'completed' ? (
              <TrendingUp className="h-6 w-6 text-blue-600 flex-shrink-0" />
            ) : analysisStatus === 'failed' ? (
              <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
            ) : (
              <Loader2 className="h-6 w-6 text-amber-600 animate-spin flex-shrink-0" />
            )}
            <div>
              {analysisStatus === 'completed' ? (
                <>
                  <p className="font-semibold text-blue-900">AI Analysis Ready</p>
                  <p className="text-sm text-blue-700">Your portfolio rationalization and roadmap are available</p>
                </>
              ) : analysisStatus === 'failed' ? (
                <>
                  <p className="font-semibold text-red-800">Analysis Unavailable</p>
                  <p className="text-sm text-red-600">The AI analysis encountered an error. Please contact your consultant.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-amber-900">AI Analysis in Progress...</p>
                  <p className="text-sm text-amber-700">
                    {analysisStatus === 'processing'
                      ? 'Claude is analyzing your portfolio — usually takes 20-30 seconds'
                      : 'Analysis will begin shortly'}
                  </p>
                </>
              )}
            </div>
          </div>

          {analysisStatus === 'completed' && (
            <button
              onClick={onViewInsights}
              className="mt-4 w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <span>View Strategy Insights</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Timing info */}
        {result?.completed_at && (
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-400 mb-6">
            <Clock className="h-4 w-4" />
            <span>Completed on {new Date(result.completed_at).toLocaleString()}</span>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full border border-gray-300 text-gray-700 px-4 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
        >
          Back to Portfolio Analysis
        </button>
      </div>
    </div>
  );
};

export default AssessmentResults;
