import React from 'react';
import {
  FileText,
  BarChart3,
  Globe,
  Users,
  FileSpreadsheet,
  Trash2,
  FileCheck,
  Table,
  FileCode,
  FileBox,
  ChevronLeft,
  ChevronRight,
  Settings,
  Activity,
} from 'lucide-react';
import { ActiveTab, ParsedFile } from '../types';
import { useEdgeViewRuntimeState } from '../hooks/useEdgeViewRuntimeState';

interface SidebarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  files: ParsedFile[];
  selectedFileId: string | null;
  onSelectFile: (id: string) => void;
  onDeleteFile: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarOpen,
  onToggleSidebar,
  activeTab,
  onTabChange,
  files,
  selectedFileId,
  onSelectFile,
  onDeleteFile,
}) => {
  const { state } = useEdgeViewRuntimeState();
  const completedCompanies = state.enrichment.completedCompanies || 0;
  const totalCompanies = state.enrichment.totalCompanies || 0;
  const jobPercent = totalCompanies > 0
    ? Math.min(100, Math.round((completedCompanies / totalCompanies) * 100))
    : 0;

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'NVL':
        return <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'DBF':
        return <Table className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'Excel':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'DOCX':
        return <FileText className="w-4 h-4 text-blue-400 shrink-0" />;
      default:
        return <FileBox className="w-4 h-4 text-gray-400 shrink-0" />;
    }
  };

  const navItems = [
    {
      id: 'files' as ActiveTab,
      label: 'Files',
      icon: <FileText className="w-5 h-5" />,
      badge: files.length,
      description: 'Parsed documents',
    },
    {
      id: 'summary' as ActiveTab,
      label: 'Summary',
      icon: <BarChart3 className="w-5 h-5" />,
      badge: null,
      description: 'Metrics & counts',
    },
    {
      id: 'country' as ActiveTab,
      label: 'Country View',
      icon: <Globe className="w-5 h-5 text-emerald-400" />,
      badge: null,
      description: 'Country breakdown',
    },
    {
      id: 'stats' as ActiveTab,
      label: 'History / Stats',
      icon: <BarChart3 className="w-5 h-5 text-blue-400" />,
      badge: null,
      description: 'Analytics & drill-down',
    },
    {
      id: 'contacts' as ActiveTab,
      label: 'Contacts',
      icon: <Users className="w-5 h-5" />,
      badge: null,
      description: 'Company Directory',
    },
    {
      id: 'research' as ActiveTab,
      label: 'Research',
      icon: <Activity className="w-5 h-5 text-emerald-400" />,
      badge: null,
      description: 'Captured evidence',
    },
    {
      id: 'reports' as ActiveTab,
      label: 'Reports',
      icon: <FileCheck className="w-5 h-5" />,
      badge: null,
      description: 'Saved reports',
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Settings',
      icon: <Settings className="w-5 h-5 text-amber-400" />,
      badge: null,
      description: 'API keys & Extraction',
    },
  ];

  return (
    <aside
      className={`bg-[#1a1a1a] text-white flex flex-col transition-all duration-200 ease-in-out border-r border-[#262626] shrink-0 z-20 ${
        sidebarOpen ? 'w-64' : 'w-16'
      }`}
    >
      {/* Sidebar Header Brand Logo */}
      <div className="p-5 flex items-center justify-between border-b border-[#333333]">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/edgeview-mark.png"
            alt=""
            className="w-9 h-9 object-contain shrink-0"
          />
          {sidebarOpen && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold tracking-tight text-lg text-white truncate">
                EdgeView
              </span>
              <span className="text-[10px] text-[#10b981] font-mono tracking-tight -mt-1 truncate">
                Trade Intelligence
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#333333] transition-colors"
          title={sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center rounded-lg transition-colors text-left px-3.5 py-3 text-sm font-medium ${
                isActive
                  ? 'bg-[#333333] text-white font-semibold'
                  : 'text-gray-400 hover:bg-[#333333] hover:text-white'
              } ${!sidebarOpen ? 'justify-center px-0' : 'space-x-3'}`}
              title={item.label}
            >
              <div className="shrink-0">{item.icon}</div>
              {sidebarOpen && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="truncate">{item.label}</span>
                  {item.badge !== null && item.badge > 0 && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                        isActive ? 'bg-[#10b981] text-white' : 'bg-[#262626] text-gray-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}

        {/* Real-time Enrichment Status Monitor inside Sidebar */}
        {sidebarOpen && state.enrichment.status !== 'IDLE' && (
          <div className="pt-4 border-t border-[#333333] mt-4">
            <div className="px-1 pb-2 flex items-center space-x-1.5 text-[10px] font-bold text-[#10b981] uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-ping" />
              <span>Company Research Running</span>
            </div>
            <div className="p-3 bg-[#1e2a22] border border-[#10b981]/30 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white truncate max-w-[140px]" title={state.enrichment.currentCompany || 'Unknown Company'}>
                  {state.enrichment.currentCompany || 'Initializing...'}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded uppercase border border-emerald-800">
                  {state.enrichment.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-300">
                <span>{completedCompanies.toLocaleString()} / {totalCompanies.toLocaleString()}</span>
                <span>{jobPercent}%</span>
              </div>
              <div className="w-full bg-[#141414] h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-[#10b981] rounded-full transition-[width] duration-500" style={{ width: `${jobPercent}%` }} />
              </div>
              <p className="text-[10px] text-gray-300 leading-snug">
                Retrieved evidence is saved after every company, so progress survives refreshes.
              </p>
            </div>
          </div>
        )}

        {/* Uploaded Files Section inside Sidebar */}
        {sidebarOpen && (
          <div className="pt-4 border-t border-[#333333] mt-4">
            <div className="px-1 pb-2 flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <span>Uploaded Files</span>
              <span className="text-gray-500 font-mono">{files.length} items</span>
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
              {files.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-500 italic">
                  No files uploaded yet.
                </div>
              ) : (
                files.map((file) => {
                  const isSelected = selectedFileId === file.id;
                  return (
                    <div
                      key={file.id}
                      onClick={() => onSelectFile(file.id)}
                      className={`group flex items-center justify-between p-2 rounded-md cursor-pointer text-xs transition-colors ${
                        isSelected
                          ? 'bg-[#333333] text-white border-l-2 border-[#10b981]'
                          : 'text-gray-300 hover:bg-[#282828] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0 flex-1 pr-1">
                        {getFileIcon(file.file_type)}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{file.name}</div>
                          <div className="text-[10px] text-gray-500 flex items-center space-x-1.5">
                            <span className="uppercase text-[#10b981] font-mono">{file.file_type}</span>
                            <span>•</span>
                            <span>{file.summary?.total_rows || 0} rows</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFile(file.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-950/40 transition-opacity"
                        title="Delete file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
};
