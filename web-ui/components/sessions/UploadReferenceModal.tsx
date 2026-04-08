'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface UploadReferenceModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData | { type: 'url'; url: string; metadata: Record<string, string> }) => void | Promise<void>;
  isLoading?: boolean;
}

/**
 * Simplified Upload Reference modal — dropzone + name only.
 * Framework/component library/notes omitted (add as metadata after upload).
 */
export function UploadReferenceModal({
  open,
  onClose,
  onSubmit,
  isLoading = false,
}: UploadReferenceModalProps) {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setName('');
      setFile(null);
      setPreview(null);
      setError(null);
    }
  }, [open]);

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      setError(null);
      if (!ACCEPTED_IMAGE_TYPES.includes(selectedFile.type)) {
        setError('Please select a PNG, JPG, WebP, or SVG image');
        return;
      }
      if (selectedFile.size > MAX_FILE_SIZE) {
        setError('File size must be less than 10MB');
        return;
      }
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
      if (!name) {
        const baseName = selectedFile.name.replace(/\.[^.]+$/, '');
        setName(baseName.replace(/[-_]/g, ' '));
      }
    },
    [name]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Name is required'); return; }
    if (!file) { setError('Please select an image file'); return; }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('name', name.trim());
    await onSubmit(formData);
  };

  const isValid = name.trim() && file;

  return (
    <Modal open={open} onClose={onClose} title="Upload Reference" maxWidth="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            loading={isLoading}
          >
            Upload
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Drop zone */}
        <div
          onDragEnter={(e) => { e.preventDefault(); setIsDragActive(true); }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false); }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragActive(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFileSelect(f);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-colors duration-200
            ${isDragActive
              ? 'border-[#818cf8] bg-[rgba(129,140,248,0.06)]'
              : 'border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]'
            }
            ${preview ? 'h-40' : 'h-28'}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
          />
          {preview ? (
            <div className="relative w-full h-full">
              <img src={preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-[#9d9db5] hover:text-[#f0f0f5]"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l6 6M10 4l-6 6" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <svg className="w-6 h-6 text-[#5a5a72] mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-[13px] text-[#9d9db5]">Drop image or click to browse</p>
              <p className="text-[11px] text-[#5a5a72] mt-0.5">PNG, JPG, WebP, SVG</p>
            </div>
          )}
        </div>

        {/* Name */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="glass-input w-full"
          placeholder="e.g., Dashboard mockup"
        />

        {/* Error */}
        {error && <p className="text-[13px] text-[#fb7185]">{error}</p>}
      </form>
    </Modal>
  );
}
