import { useState, useEffect, useCallback, useRef } from 'react';
import { ParsedFile, CompanyContact, EdgeViewReport, ActiveTab } from '../types';
import { ToastMessage } from '../components/Toast';
import { safeFetchJson } from '../utils/safeFetch';
import { GlobalExportPayload } from '../components/GlobalExportModal';

export interface LatestRequestToken {
  generation: number;
  controller: AbortController;
}

/** Latest-wins request ownership; aborted/superseded responses cannot commit state. */
export function createLatestRequestGuard() {
  let generation = 0;
  let current: LatestRequestToken | null = null;
  return {
    begin(): LatestRequestToken {
      current?.controller.abort();
      const token = { generation: ++generation, controller: new AbortController() };
      current = token;
      return token;
    },
    isCurrent(token: LatestRequestToken) {
      return current === token;
    },
    finish(token: LatestRequestToken) {
      if (current !== token) return false;
      current = null;
      return true;
    },
    cancel() {
      current?.controller.abort();
      current = null;
    },
  };
}

export function reconcileSelectedFile<T extends { id: string }>(selected: T | null, files: readonly { id: string }[]): T | null {
  return selected && !files.some(file => file.id === selected.id) ? null : selected;
}

export function replacedUploadFileIds(files: readonly Pick<ParsedFile, 'id' | 'name'>[], newFile: Pick<ParsedFile, 'id' | 'name'>, replaceFileId?: string): string[] {
  if (!replaceFileId || replaceFileId === newFile.id) return [];
  const name = newFile.name.trim().toLowerCase();
  return files.filter(file => file.id === replaceFileId && file.name.trim().toLowerCase() === name).map(file => file.id);
}

function supersededRequestError() {
  const error = new Error('The request was superseded by a newer operation.');
  error.name = 'AbortError';
  return error;
}

export function useAppStore() {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => localStorage.getItem('edgeview_sidebarOpen') !== 'false');
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [exportPayload, setExportPayload] = useState<GlobalExportPayload | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const saved = localStorage.getItem('edgeview_activeTab') || sessionStorage.getItem('edgeview_activeTab');
    return ['files', 'summary', 'country', 'stats', 'contacts', 'research', 'reports', 'settings'].includes(saved || '')
      ? saved as ActiveTab
      : 'files';
  });
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(() => {
    return localStorage.getItem('edgeview_selectedFileId') || sessionStorage.getItem('edgeview_selectedFileId') || null;
  });
  const selectedFileIdRef = useRef(selectedFileId);
  selectedFileIdRef.current = selectedFileId;

  useEffect(() => {
    localStorage.setItem('edgeview_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedFileId) {
      localStorage.setItem('edgeview_selectedFileId', selectedFileId);
    } else {
      localStorage.removeItem('edgeview_selectedFileId');
    }
  }, [selectedFileId]);
  const [selectedFile, setSelectedFile] = useState<ParsedFile | null>(null);
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const outreachSummary = null;
  const [reports, setReports] = useState<EdgeViewReport[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const filesRef = useRef(files);
  filesRef.current = files;
  const fileListRequestRef = useRef<ReturnType<typeof createLatestRequestGuard> | null>(null);
  const fileDetailRequestRef = useRef<ReturnType<typeof createLatestRequestGuard> | null>(null);
  const uploadRequestRef = useRef<ReturnType<typeof createLatestRequestGuard> | null>(null);
  const fileListRequests = fileListRequestRef.current ??= createLatestRequestGuard();
  const fileDetailRequests = fileDetailRequestRef.current ??= createLatestRequestGuard();
  const uploadRequests = uploadRequestRef.current ??= createLatestRequestGuard();
  const loadingOperations = useRef(0);
  const mounted = useRef(true);
  const beginLoading = useCallback(() => {
    loadingOperations.current += 1;
    if (mounted.current) setLoading(true);
  }, []);
  const endLoading = useCallback(() => {
    loadingOperations.current = Math.max(0, loadingOperations.current - 1);
    if (mounted.current) setLoading(loadingOperations.current > 0);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      fileListRequests.cancel();
      fileDetailRequests.cancel();
      uploadRequests.cancel();
    };
  }, [fileListRequests, fileDetailRequests, uploadRequests]);

  // Toast notification state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch file list. Only the newest response may reconcile selection/details.
  const fetchFiles = useCallback(async () => {
    const token = fileListRequests.begin();
    beginLoading();
    try {
      const { ok, data } = await safeFetchJson<ParsedFile[]>('/api/files', { signal: token.controller.signal });
      if (!fileListRequests.isCurrent(token)) return;
      if (ok && Array.isArray(data)) {
        setFiles(data);
        setSelectedFile(current => reconcileSelectedFile(current, data));

        if (data.length > 0) {
          setSelectedFileId((currentId) => {
            // Only auto-select the first file when nothing has been selected yet.
            // A stale/unknown selection must NOT silently switch to a different file.
            if (!currentId) {
              return data[0].id;
            }
            return data.some((f) => f.id === currentId) ? currentId : null;
          });
        } else {
          setSelectedFileId(null);
          setSelectedFile(null);
        }
      }
    } catch (err: any) {
      if (fileListRequests.isCurrent(token)) console.error('Error fetching file list:', err);
    } finally {
      fileListRequests.finish(token);
      endLoading();
    }
  }, [beginLoading, endLoading, fileListRequests]);

  // Fetch full details of selected file
  const fetchFileDetails = useCallback(async (fileId: string) => {
    const token = fileDetailRequests.begin();
    beginLoading();
    setSelectedFile(current => current?.id === fileId ? current : null);
    try {
      const { ok, data, error: fetchErr } = await safeFetchJson<ParsedFile>(`/api/files/${encodeURIComponent(fileId)}`, { signal: token.controller.signal });
      if (!fileDetailRequests.isCurrent(token)) return;

      if (!ok || !data || data.id !== fileId) {
        throw new Error(fetchErr || 'Failed to load file content');
      }

      setSelectedFile(data);
    } catch (err: any) {
      if (!fileDetailRequests.isCurrent(token)) return;
      console.error('Error fetching file details:', err);
      // Do NOT silently switch to a different file. Keep the requested selection
      // but surface the error so the user knows the requested file could not load.
      setError(err?.message || 'Failed to load file content');
      setSelectedFile(null);
    } finally {
      fileDetailRequests.finish(token);
      endLoading();
    }
  }, [beginLoading, endLoading, fileDetailRequests]);

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    try {
      const { ok, data } = await safeFetchJson<CompanyContact[]>('/api/companies');
      if (ok && Array.isArray(data)) {
        setContacts((prev) => {
          if (prev.length === data.length && JSON.stringify(prev) === JSON.stringify(data)) {
            return prev;
          }
          return data;
        });
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  }, []);


  // Fetch AI reports
  const fetchReports = useCallback(async () => {
    try {
      const { ok, data } = await safeFetchJson<EdgeViewReport[]>('/api/reports');
      if (ok && Array.isArray(data)) {
        setReports((prev) => {
          if (prev.length === data.length && JSON.stringify(prev) === JSON.stringify(data)) {
            return prev;
          }
          return data;
        });
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    fetchFiles();
    fetchContacts();
    fetchReports();
  }, []);

  // Periodic background sync for real-time updates (every 30 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      fetchContacts();
      fetchReports();
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchContacts, fetchReports]);

  // When selectedFileId changes, fetch full details
  useEffect(() => {
    if (selectedFileId) {
      fetchFileDetails(selectedFileId);
    } else {
      fileDetailRequests.cancel();
      setSelectedFile(null);
    }
  }, [selectedFileId, fetchFileDetails, fileDetailRequests]);

  // Actions
  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  const selectFile = (id: string) => {
    setError(null);
    setSelectedFileId(id);
    setActiveTab('files');
  };

  const uploadFile = async (file: File, replaceFileId?: string) => {
    const token = uploadRequests.begin();
    setUploading(true);
    try {
      setError(null);
      const formData = new FormData();
      formData.append('file', file);

      const { ok, data, error: uploadErr } = await safeFetchJson<any>('/api/files/upload', {
        method: 'POST',
        body: formData,
        signal: token.controller.signal,
      });
      if (!uploadRequests.isCurrent(token)) throw supersededRequestError();

      if (!ok || !data) {
        throw new Error(uploadErr || 'File upload failed or returned an invalid server response.');
      }

      if (data.success === false) {
        const errorMsg = data.error || data.message || data.details || 'Upload failed.';
        throw new Error(errorMsg);
      }

      const newFile: ParsedFile = data.data || data;
      if (newFile && newFile.id) {
        // Publish only the newest upload. Ordinary same-name datasets remain
        // distinct; only an explicit Re-upload & Update target is cleaned up,
        // and only after the server has durably accepted the replacement.
        fileListRequests.cancel();
        setSelectedFileId(newFile.id);
        setSelectedFile(newFile);
        const previousFileIds = replacedUploadFileIds(filesRef.current, { id: newFile.id, name: file.name }, replaceFileId);
        for (const previousFileId of previousFileIds) {
          const deleted = await safeFetchJson(`/api/files/${encodeURIComponent(previousFileId)}?keep_history=true`, {
            method: 'DELETE', signal: token.controller.signal,
          });
          if (!uploadRequests.isCurrent(token)) throw supersededRequestError();
          if (!deleted.ok) throw new Error(`Uploaded ${file.name}, but cleanup of the previous dataset failed: ${deleted.error || 'unknown deletion error'}`);
        }
      }

      await fetchFiles();
      if (!uploadRequests.isCurrent(token)) throw supersededRequestError();
      if (newFile && newFile.id) {
        setSelectedFileId(newFile.id);
        setSelectedFile(newFile);
      }
      await fetchContacts();
      if (!uploadRequests.isCurrent(token)) throw supersededRequestError();

      // Upload starts in Files. Completion may update its selected dataset, but
      // must not override a tab the user chose while parsing/persistence finished.
      showToast(`Successfully uploaded ${file.name}`, 'success');
      return newFile;
    } catch (err: any) {
      if (!uploadRequests.isCurrent(token)) throw err;
      const msg = err?.message || 'Failed to upload file';
      setError(msg);
      showToast(msg, 'error');
      throw err;
    } finally {
      if (uploadRequests.finish(token)) setUploading(false);
    }
  };

  const deleteFile = async (fileId: string) => {
    beginLoading();
    try {
      const targetFile = filesRef.current.find((f) => f.id === fileId);
      const { ok, error: delErr } = await safeFetchJson(`/api/files/${encodeURIComponent(fileId)}?keep_history=true`, { method: 'DELETE' });
      if (!ok) throw new Error(delErr || 'Failed to delete file');

      if (selectedFileIdRef.current === fileId) fileDetailRequests.cancel();
      setFiles(current => current.filter(file => file.id !== fileId));
      setSelectedFile(current => current?.id === fileId ? null : current);
      setSelectedFileId(currentId => {
        if (currentId !== fileId) return currentId;
        return filesRef.current.find(file => file.id !== fileId)?.id || null;
      });
      await fetchFiles();
      await fetchContacts();
      showToast(`Removed ${targetFile?.name || 'file'} from Files. Saved history retained.`, 'info');
    } catch (err: any) {
      setError(err?.message || 'Failed to delete file');
      showToast(err?.message || 'Failed to delete file', 'error');
    } finally {
      endLoading();
    }
  };

  const seedSampleData = async () => {
    beginLoading();
    try {
      const { ok, error: seedErr } = await safeFetchJson('/api/sample-data/seed', { method: 'POST' });
      if (!ok) throw new Error(seedErr || 'Failed to reseed sample data');

      await fetchFiles();
      await fetchContacts();
      await fetchReports();
      showToast('Sample files (NVL, DBF, CSV, Excel, DOCX) loaded', 'success');
    } catch (err: any) {
      setError(err?.message || 'Failed to load sample data');
      showToast(err?.message || 'Failed to load sample data', 'error');
    } finally {
      endLoading();
    }
  };

  // Bounded V1 enrichment. It deliberately never changes the user's active tab.
  const enrichCompanyAutomated = async (companyName: string, contactId?: string, forceFetch: boolean = false, reuseOnly: boolean = false) => {
    try {
      showToast(`Starting bounded V1 enrichment for ${companyName}...`, 'info');
      const { ok, data, error: enrichErr } = await safeFetchJson<any>('/api/enrich/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: companyName, id: contactId, forceFetch, reuseOnly }),
      });

      if (!ok || !data || !data.success) {
        throw new Error(enrichErr || data?.error || 'Failed to fetch company details');
      }

      if (data.run?.id) localStorage.setItem('edgeview_v1_run_id', data.run.id);
      const outcome = data.run?.status;
      const verifiedOutcome = outcome === 'COMPLETED' || outcome === 'PARTIAL' || outcome === 'FAILED' || outcome === 'NOT_FOUND';
      const feedbackType = outcome === 'COMPLETED' ? 'success' : outcome === 'FAILED' ? 'error' : verifiedOutcome ? 'info' : 'warning';
      const feedback = verifiedOutcome ? outcome.toLowerCase().replace('_', ' ') : 'status unverified';
      const capturedAt = data.reuse_assessment?.captured_at;
      const capturedDate = typeof capturedAt === 'string' && Number.isFinite(Date.parse(capturedAt)) ? new Date(capturedAt).toLocaleDateString() : null;
      const savedNote = data.reused_evidence ? ` (saved evidence rechecked; ${capturedDate ? `captured ${capturedDate}` : 'capture date unknown'}; not checked live)` : '';
      showToast(`V1 enrichment ${feedback} for ${companyName}${savedNote}`, feedbackType);
      await fetchContacts();
      return data;
    } catch (err: any) {
      console.error('Error in enrichCompanyAutomated:', err);
      showToast(err?.message || 'Failed to fetch company details', 'error');
      throw err;
    }
  };

  const saveCurrentFileToHistory = useCallback(async (fileId?: string) => {
    const idToSave = fileId || selectedFileId;
    if (!idToSave) throw new Error('No active file to save to History');

    const { ok, data, error: saveErr } = await safeFetchJson<any>(`/api/files/${idToSave}/save-to-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!ok || !data || data.success === false) {
      const err = data?.error || saveErr || 'Failed to save file to History';
      showToast(err, 'error');
      throw new Error(err);
    }

    await fetchFiles();
    showToast(`Saved "${selectedFile?.name || 'file'}" to persistent History!`, 'success');
    return data;
  }, [selectedFileId, selectedFile, fetchFiles, showToast]);

  const openGlobalExport = (payload: GlobalExportPayload) => {
    setExportPayload(payload);
    setExportModalOpen(true);
  };

  const closeGlobalExport = () => {
    setExportModalOpen(false);
    setExportPayload(null);
  };

  const exportCurrentFileToCSV = async () => {
    if (!selectedFile) return;
    openGlobalExport({
      dataset: 'files',
      title: selectedFile.name,
      records: [],
      sourceFileId: selectedFile.id,
      recordCount: selectedFile.summary?.total_rows ?? selectedFile.rows?.length ?? 0,
      filenamePrefix: `EdgeView_${selectedFile.name.replace(/\.[^/.]+$/, '')}`,
    });
  };

  return {
    sidebarOpen,
    toggleSidebar,
    activeTab,
    setActiveTab,
    files,
    selectedFileId,
    selectedFile,
    selectFile,
    contacts,
    outreachSummary,
    reports,
    loading,
    uploading,
    error,
    dismissError: () => setError(null),
    toasts,
    showToast,
    dismissToast,
    uploadFile,
    saveCurrentFileToHistory,
    deleteFile,
    seedSampleData,
    enrichCompanyAutomated,
    exportCurrentFileToCSV,
    exportModalOpen,
    exportPayload,
    openGlobalExport,
    closeGlobalExport,
    refreshData: () => {
      fetchFiles();
      fetchContacts();
      fetchReports();
    },
  };
}
