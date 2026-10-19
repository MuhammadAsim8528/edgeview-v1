import React from 'react';
import { useAppStore } from './store/appStore';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { UploadArea } from './components/UploadArea';
import { FileViewer } from './components/FileViewer';
import { Summary } from './components/Summary';
import { CountryView } from './components/CountryView';
import { StatsTab } from './components/StatsTab';
import { Contacts } from './components/Contacts';
import { Reports } from './components/Reports';
import { SettingsTabV1 as SettingsTab } from './components/SettingsTabV1';
import { ToastContainer } from './components/Toast';
import { GlobalExportModal } from './components/GlobalExportModal';
import { RefreshCw, Download, FileText, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatFullCurrency } from './utils/formatters';
import { safeFetchJson } from './utils/safeFetch';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ResearchWorkspace } from './components/ResearchWorkspace';

export default function App() {
  const store = useAppStore();
  const mainRef = React.useRef<HTMLElement>(null);

  React.useLayoutEffect(() => {
    const saved = Number(localStorage.getItem(`edgeview_scroll_${store.activeTab}`)) || 0;
    const frame = requestAnimationFrame(() => {
      if (mainRef.current) mainRef.current.scrollTop = saved;
    });
    return () => cancelAnimationFrame(frame);
  }, [store.activeTab]);

  return (
    <div className="h-dvh w-screen flex flex-col bg-[#0a0a0a] overflow-hidden font-sans antialiased text-white">
      {/* Toast Overlay */}
      <ToastContainer toasts={store.toasts} onDismiss={store.dismissToast} />

      {/* Top Header Window Bar */}
      <Header
        sidebarOpen={store.sidebarOpen}
        onToggleSidebar={store.toggleSidebar}
        selectedFileName={store.selectedFile?.name}
      />

      {/* Main Body with Sidebar + Main Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Black Sidebar */}
        <Sidebar
          sidebarOpen={store.sidebarOpen}
          onToggleSidebar={store.toggleSidebar}
          activeTab={store.activeTab}
          onTabChange={store.setActiveTab}
          files={store.files}
          selectedFileId={store.selectedFileId}
          onSelectFile={store.selectFile}
          onDeleteFile={store.deleteFile}
        />

        {/* Dark Main Area (#0a0a0a) */}
        <main
          ref={mainRef}
          onScroll={(event) => localStorage.setItem(`edgeview_scroll_${store.activeTab}`, String(event.currentTarget.scrollTop))}
          className="flex-1 bg-[#0a0a0a] overflow-y-auto p-4 md:p-6 custom-scrollbar relative"
        >
          <ErrorBoundary fallbackTitle="Main Shell Error" onReset={store.refreshData}>
            {/* Active View Router */}
            {store.activeTab === 'files' && (
              <div className={`max-w-7xl mx-auto ${store.selectedFile ? 'space-y-3' : 'space-y-6'}`}>
                {/* File Upload Drag & Drop Area */}
                <ErrorBoundary fallbackTitle="Upload Component Error">
                  <UploadArea
                    onFileUpload={store.uploadFile}
                    uploading={store.uploading}
                    error={store.error}
                    existingFiles={store.files}
                  />
                </ErrorBoundary>

                {/* Main File Table / Viewer */}
                <ErrorBoundary fallbackTitle="File Viewer Error">
                  <FileViewer
                    file={store.selectedFile}
                    onExportCSV={store.exportCurrentFileToCSV}
                    onSaveToHistory={store.saveCurrentFileToHistory}
                    onOpenExport={store.openGlobalExport}
                  />
                </ErrorBoundary>

                {/* Quick Summary Strip if file selected */}
                {store.selectedFile && (
                  <ErrorBoundary fallbackTitle="Quick Summary Error">
                    <div className="p-4 bg-[#1a1a1a] border border-[#262626] rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs shadow-xs">
                      <div className="flex items-center space-x-8">
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest">Total Records</span>
                          <span className="font-light text-white font-mono text-xl mt-0.5 block">
                            {store.selectedFile.summary?.total_rows?.toLocaleString() || 0}
                          </span>
                        </div>

                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest">Exporters Found</span>
                          <span className="font-light text-[#10b981] font-mono text-xl mt-0.5 block">
                            {store.selectedFile.summary?.exporters_count || 0}
                          </span>
                        </div>

                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest">Importers Found</span>
                          <span className="font-light text-[#10b981] font-mono text-xl mt-0.5 block">
                            {store.selectedFile.summary?.importers_count || 0}
                          </span>
                        </div>

                        <div className="max-w-[200px]">
                          <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest">Total Value (USD)</span>
                          <span
                            className="font-light text-white font-mono text-xl mt-0.5 block truncate"
                            title={formatFullCurrency(store.selectedFile.summary?.total_cost_usd || 0)}
                          >
                            {formatCurrency(store.selectedFile.summary?.total_cost_usd || 0)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          if (!store.selectedFile) return;
                          let exportRecords = store.selectedFile.rows || [];
                          if (exportRecords.length === 0) {
                            try {
                              const { ok, data } = await safeFetchJson<any>(`/api/files/${encodeURIComponent(store.selectedFile.id)}/data?limit=1000000`);
                              if (ok && data) {
                                exportRecords = data.rows || data.data || [];
                              }
                            } catch (err) {
                              console.warn('Failed to load full dataset for quick export:', err);
                            }
                          }
                          store.openGlobalExport({
                            dataset: 'files',
                            title: store.selectedFile.name,
                            records: exportRecords,
                            filenamePrefix: `EdgeView_${store.selectedFile.name.replace(/\.[^/.]+$/, '')}`,
                          });
                        }}
                        className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-[#10b981] hover:bg-[#0ea5e9] text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-white" />
                        <span>Export Data</span>
                      </button>
                    </div>
                  </ErrorBoundary>
                )}
              </div>
            )}

            {store.activeTab === 'summary' && (
              <div className="max-w-7xl mx-auto">
                <ErrorBoundary fallbackTitle="Summary View Error">
                  <Summary file={store.selectedFile} onOpenExport={store.openGlobalExport} />
                </ErrorBoundary>
              </div>
            )}

            {store.activeTab === 'country' && (
              <div className="max-w-7xl mx-auto">
                <ErrorBoundary fallbackTitle="Country View Error">
                  <CountryView files={store.files} selectedFile={store.selectedFile} onOpenExport={store.openGlobalExport} />
                </ErrorBoundary>
              </div>
            )}

            {store.activeTab === 'stats' && (
              <div className="max-w-7xl mx-auto">
                <ErrorBoundary fallbackTitle="Stats Tab Error">
                  <StatsTab
                    files={store.files}
                    selectedFileId={store.selectedFileId}
                    onOpenExport={store.openGlobalExport}
                    onSelectFile={(fileId) => {
                      store.selectFile(fileId);
                      store.setActiveTab('files');
                    }}
                  />
                </ErrorBoundary>
              </div>
            )}

            {store.activeTab === 'contacts' && (
              <div className="max-w-7xl mx-auto">
                <ErrorBoundary fallbackTitle="Contacts Tab Error" onReset={store.refreshData}>
                  <Contacts
                    contacts={store.contacts || []}
                    onFetchDetailsAutomated={store.enrichCompanyAutomated}
                    onOpenExport={store.openGlobalExport}
                    refreshData={store.refreshData}
                  />
                </ErrorBoundary>
              </div>
            )}

            {store.activeTab === 'research' && (
              <div className="max-w-7xl mx-auto">
                <ErrorBoundary fallbackTitle="Research Workspace Error">
                  <ResearchWorkspace />
                </ErrorBoundary>
              </div>
            )}

            {store.activeTab === 'reports' && (
              <div className="max-w-7xl mx-auto">
                <ErrorBoundary fallbackTitle="Reports Tab Error">
                  <Reports reports={store.reports || []} onOpenExport={store.openGlobalExport} />
                </ErrorBoundary>
              </div>
            )}

            {store.activeTab === 'settings' && (
              <div className="max-w-7xl mx-auto">
                <ErrorBoundary fallbackTitle="Settings Tab Error">
                  <SettingsTab showToast={store.showToast} contacts={store.contacts || []} />
                </ErrorBoundary>
              </div>
            )}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Export Manager Modal */}
      <ErrorBoundary fallbackTitle="Export Modal Error">
        <GlobalExportModal
          isOpen={store.exportModalOpen}
          onClose={store.closeGlobalExport}
          payload={store.exportPayload}
        />
      </ErrorBoundary>
    </div>
  );
}
