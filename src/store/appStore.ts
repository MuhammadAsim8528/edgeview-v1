import { useState, useEffect, useCallback } from 'react';
import { ParsedFile, CompanyContact, EdgeViewReport, ActiveTab } from '../types';
import { ToastMessage } from '../components/Toast';
import { safeFetchJson, fetchAllFileRows } from '../utils/safeFetch';
import { GlobalExportPayload } from '../components/GlobalExportModal';

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

  // Toast notification state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch file list
  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const { ok, data } = await safeFetchJson<ParsedFile[]>('/api/files');
      if (ok && Array.isArray(data)) {
        setFiles(data);

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
      console.error('Error fetching file list:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch full details of selected file
  const fetchFileDetails = useCallback(async (fileId: string) => {
    try {
      setLoading(true);
      const { ok, data, error: fetchErr } = await safeFetchJson<ParsedFile>(`/api/files/${encodeURIComponent(fileId)}`);

      if (!ok || !data) {
        throw new Error(fetchErr || 'Failed to load file content');
      }

      setSelectedFile(data);
    } catch (err: any) {
      console.error('Error fetching file details:', err);
      // Do NOT silently switch to a different file. Keep the requested selection
      // but surface the error so the user knows the requested file could not load.
      setError(err?.message || 'Failed to load file content');
      setSelectedFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

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
      setSelectedFile(null);
    }
  }, [selectedFileId, fetchFileDetails]);

  // Actions
  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  const selectFile = (id: string) => {
    setError(null);
    setSelectedFileId(id);
    setActiveTab('files');
  };

  const uploadFile = async (file: File) => {
    try {
      setUploading(true);
      setError(null);
      const formData = new FormData();
      formData.append('file', file);

      const { ok, data, error: uploadErr } = await safeFetchJson<any>('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!ok || !data) {
        throw new Error(uploadErr || 'File upload failed or returned an invalid server response.');
      }

      if (data.success === false) {
        const errorMsg = data.error || data.message || data.details || 'Upload failed.';
        throw new Error(errorMsg);
      }

      const newFile: ParsedFile = data.data || data;
      await fetchFiles();
      await fetchContacts();

      if (newFile && newFile.id) {
        setSelectedFileId(newFile.id);
        setSelectedFile(newFile);
      }
      // Upload starts in Files. Completion may update its selected dataset, but
      // must not override a tab the user chose while parsing/persistence finished.
      showToast(`Successfully uploaded ${file.name}`, 'success');
      return newFile;
    } catch (err: any) {
      const msg = err?.message || 'Failed to upload file';
      setError(msg);
      showToast(msg, 'error');
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (fileId: string) => {
    try {
      setLoading(true);
      const targetFile = files.find((f) => f.id === fileId);
      const { ok, error: delErr } = await safeFetchJson(`/api/files/${fileId}`, { method: 'DELETE' });
      if (!ok) throw new Error(delErr || 'Failed to delete file');

      await fetchFiles();
      await fetchContacts();

      if (selectedFileId === fileId) {
        const remaining = files.filter((f) => f.id !== fileId);
        if (remaining.length > 0) {
          setSelectedFileId(remaining[0].id);
        } else {
          setSelectedFileId(null);
          setSelectedFile(null);
        }
      }
      showToast(`Deleted ${targetFile?.name || 'file'}`, 'info');
    } catch (err: any) {
      setError(err?.message || 'Failed to delete file');
      showToast(err?.message || 'Failed to delete file', 'error');
    } finally {
      setLoading(false);
    }
  };

  const seedSampleData = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  const toggleMessageSent = async (contactId: string) => {
    try {
      const { ok } = await safeFetchJson(`/api/companies/${contactId}/sent`, { method: 'POST' });
      if (ok) {
        await fetchContacts();
      }
    } catch (err) {
      console.error('Error toggling message sent:', err);
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
      showToast(`V1 enrichment ${feedback} for ${companyName}${data.reused_evidence ? ' (saved evidence rechecked)' : ''}`, feedbackType);
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
    let exportRecords = selectedFile.rows || [];
    if (exportRecords.length === 0) {
      try {
        const { ok, data } = await fetchAllFileRows(selectedFile.id);
        if (ok && data) {
          exportRecords = data.rows;
        }
      } catch (err) {
        console.warn('Failed to load full dataset for CSV export:', err);
      }
    }
    openGlobalExport({
      dataset: 'files',
      title: selectedFile.name,
      records: exportRecords,
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
    toasts,
    showToast,
    dismissToast,
    uploadFile,
    saveCurrentFileToHistory,
    deleteFile,
    seedSampleData,
    toggleMessageSent,
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
