import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAssets } from '../contexts/AssetContext';
import { useSelectedOrg } from '../contexts/SelectedOrgContext';
import { supabase } from '../lib/supabase';
import {
  AIAnalysis, AssetDisposition, RoadmapItem, APTopicScore
} from '../types/assessPro';
import { runRationalization, getPortfolioReviewSummary, PortfolioReviewSummary } from '../services/assetReviewService';
import RationalizationView from './RationalizationView';
import RoadmapView from './RoadmapView';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  BarChart3, TrendingUp, AlertTriangle, CheckCircle, Clock,
  Loader2, RefreshCw, Brain, Target, Map, Database,
  ArrowRight, Zap, Server, Cloud, Play
} from 'lucide-react';

const ASSET_TYPE_COLORS: Record<string, string> = {
  application:           '#3b82f6',
  database:              '#22c55e',
  infrastructure:        '#8b5cf6',
  middleware:            '#f59e0b',
  'cloud-service':       '#06b6d4',
  'third-party-service': '#ef4444',
};

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  application: BarChart3,
  database: Database,
  infrastructure: Server,
  'cloud-service': Cloud,
};

const HEATMAP_CELL = (criticality: string, status: string): string => {
  if (criticality === 'high' && (status === 'deprecated' || status === 'inactive')) return 'bg-red-200 text-red-900 font-bold';
  if (criticality === 'high' && status === 'active')     return 'bg-orange-100 text-orange-800';
  if (criticality === 'medium' && status === 'deprecated') return 'bg-amber-100 text-amber-800';
  if (criticality === 'medium' && status === 'inactive')  return 'bg-amber-50 text-amber-700';
  if (criticality === 'low' && status === 'deprecated')   return 'bg-yellow-50 text-yellow-700';
  return 'bg-green-50 text-green-700';
};

type DashboardTab = 'overview' | 'rationalization' | 'roadmap';

const StrategyInsightsDashboard: React.FC = () => {
  const { user, isAdmin, canRationalize } = useAuth();
  const { assets } = useAssets();
  const { selectedOrg } = useSelectedOrg();

  const [latestAnalysis, setLatestAnalysis] = useState<AIAnalysis | null>(null);
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItem[]>([]);
  const [topicScores, setTopicScores] = useState<APTopicScore[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioReviewSummary | null>(null);
  const [rationalizationRunning, setRationalizationRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  const orgId = selectedOrg?.org_id ?? (user?.org_id ?? null);
  const orgCode = selectedOrg?.org_code ?? (user?.org_code ?? '');

  const loadAnalysis = useCallback(async () => {
    if (!supabase || !orgId) { setLoading(false); return; }
    setLoading(true);
    try {
      // Load latest completed AI analysis for this org
      const { data: analysis } = await supabase
        .from('ai_analyses')
        .select('*')
        .eq('org_id', orgId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setLatestAnalysis(analysis ?? null);

      if (analysis) {
        // Load roadmap items
        const { data: roadmap } = await supabase
          .from('roadmap_items')
          .select('*')
          .eq('analysis_id', analysis.id)
          .order('priority_score', { ascending: false });
        setRoadmapItems(roadmap ?? []);

        // Load topic scores from linked result cache
        if (analysis.result_cache_id) {
          const { data: result } = await supabase
            .from('assessment_results_cache')
            .select('topic_scores, assessment_title, percentage')
            .eq('id', analysis.result_cache_id)
            .single();
          if (result?.topic_scores) {
            setTopicScores(result.topic_scores as APTopicScore[]);
          }
        }
      }
    } catch {
      // No analysis yet — that's fine
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadAnalysis(); }, [loadAnalysis]);

  useEffect(() => {
    if (orgId && assets.length > 0) {
      getPortfolioReviewSummary(orgId, assets.length).then(s => setPortfolioSummary(s)).catch(() => {});
    }
  }, [orgId, assets.length]);

  const handleRunRationalization = async () => {
    if (!orgId || !orgCode || rationalizationRunning) return;
    setRationalizationRunning(true);
    try {
      await runRationalization(orgId, orgCode);
      setTimeout(() => loadAnalysis(), 3000);
    } catch (e) {
      console.error('Rationalization trigger failed:', e);
    } finally {
      setRationalizationRunning(false);
    }
  };

  // Asset stats
  const totalAssets = assets.length;
  const activeAssets = assets.filter(a => a.status === 'active').length;
  const highCritical = assets.filter(a => a.criticality === 'high').length;
  const deprecated = assets.filter(a => a.status === 'deprecated').length;

  // Pie chart data
  const assetsByType = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(assetsByType).map(([type, count]) => ({ name: type, value: count }));

  // Heatmap data
  const CRITICALITIES = ['high', 'medium', 'low'];
  const STATUSES = ['active', 'inactive', 'deprecated', 'planned'];
  const heatmap = CRITICALITIES.reduce<Record<string, Record<string, number>>>((acc, crit) => {
    acc[crit] = STATUSES.reduce<Record<string, number>>((row, status) => {
      row[status] = assets.filter(a => a.criticality === crit && a.status === status).length;
      return row;
    }, {});
    return acc;
  }, {});

  // Topic scores bar chart data
  const topicBarData = topicScores.map(t => ({
    name: t.topic_title.length > 20 ? t.topic_title.substring(0, 20) + '…' : t.topic_title,
    score: t.percentage,
  }));

  const dispositions = (latestAnalysis?.rationalization_results as AssetDisposition[]) ?? [];

  const TABS: { id: DashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'rationalization', label: 'Rationalization', icon: Target },
    { id: 'roadmap', label: 'Roadmap', icon: Map },
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center min-h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading strategy insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Strategy Insights</h1>
          <p className="mt-1 text-gray-500">
            {selectedOrg ? `${selectedOrg.org_name} · ` : ''}
            AI-powered portfolio analysis and transformation roadmap
          </p>
        </div>
        <button
          onClick={loadAnalysis}
          className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW TAB ────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Assets', value: totalAssets, icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Active', value: activeAssets, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'High Criticality', value: highCritical, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: 'Deprecated', value: deprecated, icon: Clock, color: 'text-red-600', bg: 'bg-red-50' },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                      <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.bg}`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Asset Distribution Pie */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Asset Distribution by Type</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {pieData.map((entry, index) => (
                        <Cell key={entry.name} fill={ASSET_TYPE_COLORS[entry.name] ?? `hsl(${index * 50}, 65%, 55%)`} />
                      ))}
                    </Pie>
                    <ReTooltip />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-gray-700 capitalize">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-40 text-gray-400">No assets to display</div>
              )}
            </div>

            {/* Assessment Scores Bar (if available) */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Assessment Topic Scores</h3>
              {topicBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topicBarData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={11} />
                    <YAxis type="category" dataKey="name" width={120} fontSize={10} />
                    <ReTooltip formatter={(v: number) => [`${v}%`, 'Score']} />
                    <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                      {topicBarData.map((entry, index) => (
                        <Cell key={index} fill={entry.score >= 75 ? '#22c55e' : entry.score >= 50 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <Zap className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No assessment scores yet</p>
                  <p className="text-xs text-gray-400 mt-1">Complete an assessment to see topic scores here</p>
                </div>
              )}
            </div>
          </div>

          {/* Tech Debt Heatmap */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Tech Debt Heatmap</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-4 font-medium text-gray-600 w-28">Criticality</th>
                    {STATUSES.map(s => <th key={s} className="px-4 py-2 font-medium text-gray-600 capitalize text-center">{s}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {CRITICALITIES.map(crit => (
                    <tr key={crit}>
                      <td className="py-2 pr-4 font-semibold text-gray-700 capitalize">{crit}</td>
                      {STATUSES.map(status => {
                        const count = heatmap[crit]?.[status] ?? 0;
                        return (
                          <td key={status} className="px-4 py-2 text-center">
                            {count > 0 ? (
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${HEATMAP_CELL(crit, status)}`}>
                                {count}
                              </span>
                            ) : (
                              <span className="text-gray-200">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Summary */}
          {latestAnalysis?.summary_text ? (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-600 rounded-lg flex-shrink-0">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-blue-900">AI Portfolio Analysis</h3>
                    <span className="text-xs text-blue-600">
                      {latestAnalysis.created_at ? new Date(latestAnalysis.created_at).toLocaleString() : ''}
                    </span>
                  </div>
                  <p className="text-blue-800 leading-relaxed">{latestAnalysis.summary_text}</p>
                  <div className="flex items-center space-x-4 mt-4">
                    <button
                      onClick={() => setActiveTab('rationalization')}
                      className="flex items-center space-x-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors"
                    >
                      <Target className="h-4 w-4" />
                      <span>View Rationalization</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setActiveTab('roadmap')}
                      className="flex items-center space-x-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors"
                    >
                      <Map className="h-4 w-4" />
                      <span>View Roadmap</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
              <Brain className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No AI Analysis Yet</h3>
              <p className="text-gray-500 text-sm max-w-sm mx-auto">
                Complete a portfolio assessment to trigger AI-powered rationalization. Claude will analyze your assets and generate a prioritized transformation roadmap.
              </p>
              <button
                onClick={() => {}}
                className="mt-4 inline-flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <TrendingUp className="h-4 w-4" />
                <span>Go to Portfolio Analysis to get started</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── RATIONALIZATION TAB ──────────────────────────────────────── */}
      {activeTab === 'rationalization' && (
        <div>
          {/* Readiness Summary Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-700 mb-1">Last Rationalization</p>
                <p className="text-sm text-gray-500">
                  {latestAnalysis?.created_at
                    ? new Date(latestAnalysis.created_at).toLocaleString()
                    : 'No rationalization run yet'}
                </p>
                {portfolioSummary && (
                  <p className="text-xs text-gray-400 mt-1">
                    Based on {portfolioSummary.addressed} of {portfolioSummary.total} assets reviewed
                    ({Math.round(portfolioSummary.addressed / Math.max(portfolioSummary.total, 1) * 100)}%)
                    {portfolioSummary.addressed < portfolioSummary.total && (
                      <span className="text-amber-500"> — {portfolioSummary.total - portfolioSummary.addressed} not yet reviewed</span>
                    )}
                  </p>
                )}
              </div>
              {canRationalize && (
                <button
                  onClick={handleRunRationalization}
                  disabled={rationalizationRunning || !orgId || !orgCode}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                >
                  {rationalizationRunning
                    ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Running...</span></>
                    : <><Play className="h-4 w-4" /><span>{latestAnalysis ? 'Re-run' : 'Run'} Rationalization</span></>
                  }
                </button>
              )}
            </div>
          </div>

          {dispositions.length > 0 ? (
            <>
              {latestAnalysis?.summary_text && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <p className="text-blue-800 text-sm leading-relaxed">{latestAnalysis.summary_text}</p>
                </div>
              )}
              <RationalizationView dispositions={dispositions} />
            </>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
              <Target className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Rationalization Data</h3>
              <p className="text-sm text-gray-500">Complete a portfolio assessment to generate asset disposition recommendations.</p>
            </div>
          )}
        </div>
      )}

      {/* ── ROADMAP TAB ─────────────────────────────────────────────── */}
      {activeTab === 'roadmap' && (
        <div>
          {roadmapItems.length > 0 ? (
            <RoadmapView items={roadmapItems} />
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
              <Map className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Roadmap Available</h3>
              <p className="text-sm text-gray-500">Complete a portfolio assessment to generate your transformation roadmap.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StrategyInsightsDashboard;
