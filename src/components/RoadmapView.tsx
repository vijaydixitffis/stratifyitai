import React, { useState } from 'react';
import { RoadmapItem } from '../types/assessPro';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import { List, Grid3X3, ArrowUpDown, Clock, Zap, TrendingUp } from 'lucide-react';

interface RoadmapViewProps {
  items: RoadmapItem[];
}

const LEVEL_MAP: Record<string, number> = { Low: 1, Medium: 2, High: 3 };
const LEVEL_LABEL: Record<number, string> = { 1: 'Low', 2: 'Med', 3: 'High' };

const HORIZON_COLOURS: Record<string, string> = {
  '0-3 months':   'bg-red-100 text-red-800 border-red-200',
  '3-6 months':   'bg-amber-100 text-amber-800 border-amber-200',
  '6-12 months':  'bg-blue-100 text-blue-800 border-blue-200',
  '12+ months':   'bg-gray-100 text-gray-700 border-gray-200',
};

const INITIATIVE_COLOURS: Record<string, string> = {
  Retire:      'bg-red-500',
  Replace:     'bg-blue-500',
  Consolidate: 'bg-purple-500',
  Modernise:   'bg-amber-500',
  Governance:  'bg-indigo-500',
  Process:     'bg-teal-500',
};

const STATUS_COLOURS: Record<string, string> = {
  open:          'bg-blue-100 text-blue-800',
  'in-progress': 'bg-amber-100 text-amber-800',
  completed:     'bg-green-100 text-green-800',
  deferred:      'bg-gray-100 text-gray-600',
};

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: RoadmapItem & { x: number; y: number } }[] }) => {
  if (active && payload?.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs">
        <p className="font-semibold text-gray-900 text-sm mb-1">{d.title}</p>
        <p className="text-xs text-gray-500">Priority: {d.priority_score}/10</p>
        <p className="text-xs text-gray-500">Effort: {LEVEL_LABEL[d.y as number]}</p>
        <p className="text-xs text-gray-500">Impact: {LEVEL_LABEL[d.x as number]}</p>
        {d.time_horizon && <p className="text-xs text-gray-500">Horizon: {d.time_horizon}</p>}
      </div>
    );
  }
  return null;
};

const RoadmapView: React.FC<RoadmapViewProps> = ({ items }) => {
  const [view, setView] = useState<'list' | 'matrix'>('list');
  const [sortKey, setSortKey] = useState<'priority_score' | 'time_horizon' | 'effort'>('priority_score');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: typeof sortKey) => {
    if (key === sortKey) setSortAsc(prev => !prev);
    else { setSortKey(key); setSortAsc(key !== 'priority_score'); }
  };

  const sorted = [...items].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'priority_score') {
      cmp = (b.priority_score ?? 0) - (a.priority_score ?? 0);
    } else if (sortKey === 'effort') {
      cmp = (LEVEL_MAP[a.effort ?? 'Low'] ?? 1) - (LEVEL_MAP[b.effort ?? 'Low'] ?? 1);
    } else {
      const order = ['0-3 months', '3-6 months', '6-12 months', '12+ months'];
      cmp = order.indexOf(a.time_horizon ?? '') - order.indexOf(b.time_horizon ?? '');
    }
    return sortAsc ? -cmp : cmp;
  });

  const scatterData = items.map(item => ({
    ...item,
    x: LEVEL_MAP[item.impact ?? 'Low'] ?? 1,
    y: LEVEL_MAP[item.effort ?? 'Low'] ?? 1,
    z: (item.priority_score ?? 5) * 15,
  }));

  return (
    <div>
      {/* View Toggle */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('list')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <List className="h-4 w-4" />
            <span>List</span>
          </button>
          <button
            onClick={() => setView('matrix')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'matrix' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Grid3X3 className="h-4 w-4" />
            <span>Matrix</span>
          </button>
        </div>
        <span className="text-sm text-gray-500">{items.length} initiatives</span>
      </div>

      {view === 'list' ? (
        <>
          {/* Sort row */}
          <div className="flex items-center space-x-4 text-xs text-gray-500 mb-3 px-1">
            <span>Sort by:</span>
            {(['priority_score', 'time_horizon', 'effort'] as const).map(k => (
              <button
                key={k}
                onClick={() => handleSort(k)}
                className={`flex items-center space-x-1 hover:text-gray-700 transition-colors ${sortKey === k ? 'text-blue-600 font-medium' : ''}`}
              >
                <span>{k === 'priority_score' ? 'Priority' : k === 'time_horizon' ? 'Horizon' : 'Effort'}</span>
                <ArrowUpDown className="h-3 w-3" />
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {sorted.map((item, idx) => {
              const typeColor = INITIATIVE_COLOURS[item.initiative_type ?? ''] ?? 'bg-gray-400';
              return (
                <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-200 hover:shadow-sm transition-all duration-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      {/* Priority badge */}
                      <div className="flex-shrink-0 w-10 h-10 bg-gray-900 text-white rounded-lg flex items-center justify-center">
                        <span className="text-sm font-bold">{item.priority_score ?? idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{item.title}</h4>
                          {item.initiative_type && (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${typeColor}`}>
                              {item.initiative_type}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOURS[item.status]}`}>
                            {item.status}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{item.description}</p>
                        )}
                        {item.affected_assets && item.affected_assets.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.affected_assets.slice(0, 4).map(a => (
                              <span key={a} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{a}</span>
                            ))}
                            {item.affected_assets.length > 4 && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded text-xs">+{item.affected_assets.length - 4} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right space-y-1.5">
                      {item.time_horizon && (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${HORIZON_COLOURS[item.time_horizon] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          <Clock className="h-3 w-3 mr-1" />
                          {item.time_horizon}
                        </span>
                      )}
                      <div className="flex items-center justify-end space-x-2 text-xs text-gray-500">
                        {item.effort && (
                          <span className="flex items-center space-x-1">
                            <Zap className="h-3 w-3" />
                            <span>{item.effort}</span>
                          </span>
                        )}
                        {item.impact && (
                          <span className="flex items-center space-x-1">
                            <TrendingUp className="h-3 w-3" />
                            <span>{item.impact}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div>
          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600 space-y-1">
            <p className="font-medium text-gray-700">Effort vs Impact Matrix</p>
            <p>Bubble size = priority score. <span className="font-medium text-green-700">Bottom-right = Do First</span> · <span className="font-medium text-red-600">Top-left = Avoid</span></p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4" style={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  type="number" dataKey="x" name="Impact"
                  domain={[0.5, 3.5]} ticks={[1, 2, 3]}
                  tickFormatter={v => LEVEL_LABEL[v] ?? ''} label={{ value: 'Impact →', position: 'bottom', offset: -10, fontSize: 12 }}
                />
                <YAxis
                  type="number" dataKey="y" name="Effort"
                  domain={[0.5, 3.5]} ticks={[1, 2, 3]}
                  tickFormatter={v => LEVEL_LABEL[v] ?? ''} label={{ value: 'Effort', angle: -90, position: 'insideLeft', fontSize: 12 }}
                />
                <ZAxis type="number" dataKey="z" range={[40, 400]} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x={2} stroke="#e5e7eb" strokeDasharray="4 4" />
                <ReferenceLine y={2} stroke="#e5e7eb" strokeDasharray="4 4" />
                <Scatter data={scatterData} fill="#3b82f6" fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-center">
            <div className="bg-green-50 border border-green-200 rounded-lg py-2 px-3">
              <p className="font-semibold text-green-800">Do First</p>
              <p className="text-green-600">High impact · Low effort</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg py-2 px-3">
              <p className="font-semibold text-blue-800">Plan Last</p>
              <p className="text-blue-600">High impact · High effort</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg py-2 px-3">
              <p className="font-semibold text-amber-800">Quick Wins</p>
              <p className="text-amber-600">Low impact · Low effort</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg py-2 px-3">
              <p className="font-semibold text-red-800">Avoid</p>
              <p className="text-red-600">Low impact · High effort</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoadmapView;
