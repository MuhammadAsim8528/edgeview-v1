import React from 'react';
import { Building2, Users, Archive, SearchCheck, CircleHelp } from 'lucide-react';

interface SummaryData {
  total_companies: number;
  contacts_found: number;
  researched_companies?: number;
  unresolved_after_research?: number;
  not_researched?: number;
  excluded_exporters?: number;
  research_scope?: number;
  source_records?: number;
}

interface SummaryCardsProps {
  data: SummaryData;
  onFilterClick?: (filterType: string) => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ data, onFilterClick }) => {
  const calcPercent = (val: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((val / total) * 100);
  };

  const cards = [
    {
      label: 'Unique Companies',
      value: data.total_companies,
      subtext: data.source_records ? `from ${data.source_records.toLocaleString()} trade rows` : 'deduplicated entities',
      icon: <Building2 className="w-5 h-5 text-gray-400" />,
      filterKey: 'ALL',
      bgColor: 'bg-[#262626]',
      borderColor: 'border-[#333333]',
      valueColor: 'text-white'
    },
    {
      label: 'Importers Researched',
      value: data.researched_companies || 0,
      subtext: `${calcPercent(data.researched_companies || 0, data.research_scope || 0)}% of importer scope`,
      icon: <SearchCheck className="w-5 h-5 text-indigo-400" />,
      filterKey: 'RESEARCHED',
      bgColor: 'bg-indigo-950/20',
      borderColor: 'border-indigo-900/50',
      valueColor: 'text-indigo-400'
    },
    {
      label: 'Contact Details Found',
      value: data.contacts_found,
      subtext: `${calcPercent(data.contacts_found, data.researched_companies || 0)}% of researched importers`,
      icon: <Users className="w-5 h-5 text-sky-400" />,
      filterKey: 'ENRICHED',
      bgColor: 'bg-sky-950/20',
      borderColor: 'border-sky-900/50',
      valueColor: 'text-sky-400'
    },
    {
      label: 'Needs Deeper Research',
      value: data.unresolved_after_research || 0,
      subtext: 'Research captured; candidates remain viewable',
      icon: <CircleHelp className="w-5 h-5 text-amber-400" />,
      filterKey: 'UNRESOLVED',
      bgColor: 'bg-amber-950/20',
      borderColor: 'border-amber-900/50',
      valueColor: 'text-amber-400'
    },
    {
      label: 'Excluded Exporters',
      value: data.excluded_exporters || 0,
      subtext: 'Pakistan exporters; outside importer scope',
      icon: <Archive className="w-5 h-5 text-gray-400" />,
      filterKey: 'EXCLUDED',
      bgColor: 'bg-slate-950/20',
      borderColor: 'border-slate-800/60',
      valueColor: 'text-gray-300'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
      {cards.map((card, idx) => (
        <button
          type="button"
          key={idx}
          aria-label={card.label}
          disabled={!onFilterClick}
          onClick={() => onFilterClick && onFilterClick(card.filterKey)}
          className={`${card.bgColor} ${card.borderColor} border rounded-xl p-4 flex flex-col text-left cursor-pointer hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 transition-all`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider">{card.label}</span>
            <div className="p-2 rounded-lg bg-[#1a1a1a] shadow-inner">
              {card.icon}
            </div>
          </div>
          <div className="flex items-end space-x-2">
            <span className={`text-2xl font-bold ${card.valueColor}`}>{card.value}</span>
            {card.subtext && (
              <span className="text-xs text-[#6b7280] font-medium mb-1">({card.subtext})</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};
