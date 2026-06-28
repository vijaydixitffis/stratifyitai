import React, { useState } from 'react';
import { AssetDisposition, EightRDisposition } from '../types/assessPro';
import { ArrowUpDown, CircleDot, Circle, AlertTriangle } from 'lucide-react';

interface RationalizationViewProps {
  dispositions: AssetDisposition[];
}

const DISPOSITION_COLOURS: Record<EightRDisposition, string> = {
  Retain:      'bg-green-100 text-green-800 border-green-200',
  Replace:     'bg-blue-100 text-blue-800 border-blue-200',
  Retire:      'bg-red-100 text-red-800 border-red-200',
  Consolidate: 'bg-purple-100 text-purple-800 border-purple-200',
  Modernise:   'bg-amber-100 text-amber-800 border-amber-200',
  Rehost:      'bg-sky-100 text-sky-800 border-sky-200',
  Replatform:  'bg-teal-100 text-teal-800 border-teal-200',
  Rearchitect: 'bg-orange-100 text-orange-800 border-orange-200',
};

const EFFORT_COLOURS: Record<string, string> = {
  Low:    'text-green-600 bg-green-50',
  Medium: 'text-amber-600 bg-amber-50',
  High:   'text-red-600 bg-red-50',
};

const DEP_RISK_COLOURS: Record<string, string> = {
  None: 'text-gray-400',
  Low:  'text-amber-500',
  High: 'text-red-600',
};

const CONFIDENCE_ICONS: Record<string, React.ReactNode> = {
  High:   <CircleDot className="h-4 w-4 text-green-600" />,
  Medium: <CircleDot className="h-4 w-4 text-amber-500 opacity-60" />,
  Low:    <Circle className="h-4 w-4 text-gray-400" />,
};

const DISPOSITION_ORDER: EightRDisposition[] = [
  'Retire', 'Replace', 'Rearchitect', 'Modernise', 'Replatform', 'Rehost', 'Consolidate', 'Retain'
];

type SortKey = 'asset_name' | 'asset_type' | 'disposition' | 'confidence' | 'estimated_effort' | 'time_horizon';

const RationalizationView: React.FC<RationalizationViewProps> = ({ dispositions }) => {
  const [sortKey, setSortKey] = useState<SortKey>('disposition');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterDisposition, setFilterDisposition] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(prev => !prev);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = [...dispositions]
    .filter(d => filterDisposition === 'all' || d.disposition === filterDisposition)
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'disposition') {
        cmp = DISPOSITION_ORDER.indexOf(a.disposition) - DISPOSITION_ORDER.indexOf(b.disposition);
      } else if (sortKey === 'confidence') {
        const order = ['High', 'Medium', 'Low'];
        cmp = order.indexOf(a.confidence) - order.indexOf(b.confidence);
      } else if (sortKey === 'estimated_effort') {
        const order = ['High', 'Medium', 'Low'];
        cmp = order.indexOf(a.estimated_effort ?? 'Low') - order.indexOf(b.estimated_effort ?? 'Low');
      } else if (sortKey === 'time_horizon') {
        const order = ['Immediate', '6-12 months', '12-24 months', '24+ months'];
        cmp = order.indexOf(a.time_horizon ?? '24+ months') - order.indexOf(b.time_horizon ?? '24+ months');
      } else {
        cmp = ((a as any)[sortKey] ?? '').localeCompare((b as any)[sortKey] ?? '');
      }
      return sortAsc ? cmp : -cmp;
    });

  // Count per disposition for filter pills
  const counts = DISPOSITION_ORDER.reduce((acc, d) => {
    acc[d] = dispositions.filter(x => x.disposition === d).length;
    return acc;
  }, {} as Record<string, number>);

  const SortHeader: React.FC<{ label: string; field: SortKey }> = ({ label, field }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 group whitespace-nowrap"
    >
      <span>{label}</span>
      <ArrowUpDown className={`h-3 w-3 transition-colors ${sortKey === field ? 'text-blue-600' : 'text-gray-300 group-hover:text-gray-500'}`} />
    </button>
  );

  return (
    <div>
      {/* Disposition filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilterDisposition('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${filterDisposition === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'}`}
        >
          All ({dispositions.length})
        </button>
        {DISPOSITION_ORDER.map(d => counts[d] > 0 && (
          <button
            key={d}
            onClick={() => setFilterDisposition(filterDisposition === d ? 'all' : d)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${filterDisposition === d ? 'ring-2 ring-offset-1 ring-blue-400 ' : ''} ${DISPOSITION_COLOURS[d]}`}
          >
            {d} ({counts[d]})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">
                <SortHeader label="Asset" field="asset_name" />
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">
                <SortHeader label="Type" field="asset_type" />
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">
                <SortHeader label="Disposition" field="disposition" />
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">
                <SortHeader label="Confidence" field="confidence" />
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">
                <SortHeader label="Effort" field="estimated_effort" />
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">
                <SortHeader label="Timeline" field="time_horizon" />
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((d, idx) => (
              <React.Fragment key={d.asset_id ?? idx}>
                <tr
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setExpandedRow(expandedRow === d.asset_id ? null : d.asset_id)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-1.5">
                      {d.dependency_risk && d.dependency_risk !== 'None' && (
                        <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 ${DEP_RISK_COLOURS[d.dependency_risk]}`} title={`Dependency risk: ${d.dependency_risk}`} />
                      )}
                      {d.asset_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{d.asset_type}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${DISPOSITION_COLOURS[d.disposition] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {d.disposition}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-1.5">
                      {CONFIDENCE_ICONS[d.confidence]}
                      <span className="text-gray-700">{d.confidence}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {d.estimated_effort ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${EFFORT_COLOURS[d.estimated_effort] ?? ''}`}>
                        {d.estimated_effort}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {d.time_horizon ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">
                    <p className="line-clamp-2 text-xs leading-relaxed">{d.rationale}</p>
                  </td>
                </tr>
                {/* Expanded row — full rationale + dependency info */}
                {expandedRow === d.asset_id && (
                  <tr className="bg-indigo-50">
                    <td colSpan={7} className="px-4 py-4">
                      <p className="text-sm text-gray-700 leading-relaxed mb-2">{d.rationale}</p>
                      {d.dependency_risk && d.dependency_risk !== 'None' && (
                        <p className={`text-xs font-medium ${DEP_RISK_COLOURS[d.dependency_risk]}`}>
                          ⚠ Dependency risk: <strong>{d.dependency_risk}</strong>
                          {d.affected_dependents?.length
                            ? ` — ${d.affected_dependents.length} asset(s) depend on this`
                            : ''}
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            No assets match the selected filter
          </div>
        )}
      </div>
    </div>
  );
};

export default RationalizationView;
