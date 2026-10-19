import React, { useRef, useState } from 'react';
import { Upload, FileCode, Table, FileSpreadsheet, FileText, CheckCircle, Loader2, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { ParsedFile } from '../types';

interface UploadAreaProps {
  onFileUpload: (file: File) => Promise<any>;
  uploading: boolean;
  error: string | null;
  existingFiles?: ParsedFile[];
}

export const UploadArea: React.FC<UploadAreaProps> = ({
  onFileUpload,
  uploading,
  error,
  existingFiles = [],
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [duplicateFile, setDuplicateFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const compact = existingFiles.length > 0;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const checkAndProcessFile = async (file: File) => {
    // Check if a file with exact name already exists in existingFiles
    const isDup = existingFiles.some(
      (f) => f.name.toLowerCase().trim() === file.name.toLowerCase().trim()
    );

    if (isDup) {
      setDuplicateFile(file);
      return;
    }

    await executeUpload(file);
  };

  const executeUpload = async (file: File) => {
    try {
      setDuplicateFile(null);
      await onFileUpload(file);
      setUploadSuccess(`Successfully parsed ${file.name}`);
      setTimeout(() => setUploadSuccess(null), 4000);
    } catch (err) {
      // Error handled in store state
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await checkAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await checkAndProcessFile(e.target.files[0]);
    }
  };

  return (
    <div className={compact ? 'w-full' : 'w-full mb-6'}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`${compact ? 'min-h-12 px-4 py-2 flex-row justify-between' : 'h-36 p-4 flex-col justify-center'} border-2 border-dashed rounded-xl flex items-center transition-colors cursor-pointer group ${
          isDragging
            ? 'border-[#10b981] bg-[#10b981]/10'
            : 'border-[#262626] bg-[#1a1a1a] hover:border-[#10b981]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".nvl,.dbf,.csv,.xlsx,.docx,.txt"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload-input"
        />

        {uploading ? (
          <div className={`flex items-center ${compact ? 'space-x-2' : 'flex-col space-y-2'}`}>
            <Loader2 className={`${compact ? 'w-4 h-4' : 'w-7 h-7'} text-[#10b981] animate-spin`} />
            <p className="text-sm font-medium text-[#e5e7eb]">Parsing file…</p>
          </div>
        ) : compact ? (
          <>
            <div className="flex min-w-0 items-center gap-2 text-left">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#10b981]" />
              <div className="min-w-0"><p className="truncate text-xs font-semibold text-[#e5e7eb]">Dataset loaded</p><p className="text-[10px] text-[#9ca3af]">Drop a file here to add or replace it</p></div>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#3a3a3a] bg-[#252525] px-3 py-1.5 text-xs font-semibold text-[#e5e7eb] group-hover:border-[#10b981]">
              <Upload className="h-3.5 w-3.5" /> Add file
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <Upload className="w-7 h-7 text-[#9ca3af] group-hover:text-[#10b981] mb-2 transition-colors" />
            <p className="text-sm text-[#e5e7eb] font-medium">
              Drag & drop or <span className="text-[#10b981] underline">browse</span>
            </p>
            <p className="text-[10px] text-[#9ca3af] mt-1 uppercase tracking-wider font-semibold">
              NVL, DBF, CSV, XLSX, DOCX
            </p>
          </div>
        )}
      </div>

      {/* Duplicate File Modal */}
      {duplicateFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#141b26] border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-left">
            <button
              onClick={() => setDuplicateFile(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Duplicate File Detected</h3>
                <p className="text-xs text-amber-300 font-medium">
                  "{duplicateFile.name}" already exists
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed mb-6">
              A file with the name <span className="font-mono text-amber-200">{duplicateFile.name}</span> is already in your workspace. Do you want to re-parse and update this file?
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDuplicateFile(null)}
                className="px-4 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 text-xs text-gray-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => executeUpload(duplicateFile)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-xs text-black font-semibold shadow-md transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-upload & Update</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadSuccess && (
        <div className="mt-2.5 p-3 bg-[#10b981]/10 border border-[#10b981]/30 rounded-lg flex items-center space-x-2 text-xs text-[#10b981] font-medium">
          <CheckCircle className="w-4 h-4 text-[#10b981] shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {error && (
        <div className="mt-2.5 p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-xs text-red-300 font-medium">
          Error parsing file: {error}
        </div>
      )}
    </div>
  );
};
