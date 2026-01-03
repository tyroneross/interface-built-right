'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

type TabType = 'image' | 'url';

interface UploadReferenceFormData {
  type: TabType;
  name: string;
  framework: string;
  componentLibrary: string;
  targetPath: string;
  notes: string;
  // For image upload
  file?: File;
  // For URL extraction
  url?: string;
}

interface UploadReferenceModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormData | { type: 'url'; url: string; metadata: Record<string, string> }) => void | Promise<void>;
  isLoading?: boolean;
}

const FRAMEWORKS = [
  { value: '', label: 'Auto-detect from project' },
  { value: 'react', label: 'React' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'vue', label: 'Vue' },
  { value: 'nuxt', label: 'Nuxt' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'angular', label: 'Angular' },
  { value: 'html', label: 'Vanilla HTML/CSS' },
];

const COMPONENT_LIBRARIES = [
  { value: '', label: 'Auto-detect from project' },
  { value: 'tailwind', label: 'Tailwind CSS' },
  { value: 'shadcn', label: 'shadcn/ui' },
  { value: 'mui', label: 'Material UI' },
  { value: 'chakra', label: 'Chakra UI' },
  { value: 'antd', label: 'Ant Design' },
  { value: 'radix', label: 'Radix UI' },
  { value: 'none', label: 'None / Custom' },
];

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function UploadReferenceModal({
  open,
  onClose,
  onSubmit,
  isLoading = false,
}: UploadReferenceModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('image');
  const [name, setName] = useState('');
  const [framework, setFramework] = useState('');
  const [componentLibrary, setComponentLibrary] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [notes, setNotes] = useState('');

  // Image upload state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL state
  const [url, setUrl] = useState('');

  // Validation state
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setActiveTab('image');
      setName('');
      setFramework('');
      setComponentLibrary('');
      setTargetPath('');
      setNotes('');
      setFile(null);
      setPreview(null);
      setUrl('');
      setError(null);
    }
  }, [open]);

  // Handle file selection
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

      // Generate preview
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);

      // Auto-generate name from filename if empty
      if (!name) {
        const baseName = selectedFile.name.replace(/\.[^.]+$/, '');
        setName(baseName.replace(/[-_]/g, ' '));
      }
    },
    [name]
  );

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (activeTab === 'image') {
      if (!file) {
        setError('Please select an image file');
        return;
      }

      const formData = new FormData();
      formData.append('image', file);
      formData.append('name', name.trim());
      if (framework) formData.append('framework', framework);
      if (componentLibrary) formData.append('componentLibrary', componentLibrary);
      if (targetPath) formData.append('targetPath', targetPath);
      if (notes) formData.append('notes', notes);

      await onSubmit(formData);
    } else {
      if (!url.trim()) {
        setError('URL is required');
        return;
      }

      try {
        new URL(url.trim());
      } catch {
        setError('Please enter a valid URL');
        return;
      }

      await onSubmit({
        type: 'url',
        url: url.trim(),
        metadata: {
          name: name.trim(),
          framework,
          componentLibrary,
          targetPath,
          notes,
        },
      });
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!open) return null;

  const isValid = name.trim() && (activeTab === 'image' ? file : url.trim());

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Upload Reference Design
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l8 8M14 6l-8 8" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            type="button"
            onClick={() => setActiveTab('image')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'image'
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Upload Image
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'url'
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            From URL
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-4 py-4 space-y-4">
            {/* Tab Content */}
            {activeTab === 'image' ? (
              /* Image Upload Drop Zone */
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}
                  ${preview ? 'h-48' : 'h-32'}
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                  onChange={(e) =>
                    e.target.files?.[0] && handleFileSelect(e.target.files[0])
                  }
                  className="hidden"
                />

                {preview ? (
                  <div className="relative w-full h-full">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setPreview(null);
                      }}
                      className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full shadow flex items-center justify-center text-gray-500 hover:text-gray-700"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4l6 6M10 4l-6 6" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <svg
                      className="w-8 h-8 text-gray-400 mb-2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                      />
                    </svg>
                    <p className="text-sm text-gray-600">
                      Drag and drop or click to upload
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      PNG, JPG, WebP, SVG (max 10MB)
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* URL Input */
              <div>
                <label
                  htmlFor="url"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  URL
                </label>
                <input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/design-page"
                  className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
                />
                <p className="text-xs text-gray-400 mt-1">
                  IBR will capture a screenshot and extract HTML/CSS
                </p>
              </div>
            )}

            {/* Name Field - Required */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Dashboard Header Design"
                required
                className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
              />
            </div>

            {/* Framework Dropdown */}
            <div>
              <label
                htmlFor="framework"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Target Framework
              </label>
              <select
                id="framework"
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-gray-400"
              >
                {FRAMEWORKS.map((fw) => (
                  <option key={fw.value} value={fw.value}>
                    {fw.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Component Library Dropdown */}
            <div>
              <label
                htmlFor="componentLibrary"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Component Library
              </label>
              <select
                id="componentLibrary"
                value={componentLibrary}
                onChange={(e) => setComponentLibrary(e.target.value)}
                className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-gray-400"
              >
                {COMPONENT_LIBRARIES.map((lib) => (
                  <option key={lib.value} value={lib.value}>
                    {lib.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Path */}
            <div>
              <label
                htmlFor="targetPath"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Target File/Folder
              </label>
              <input
                id="targetPath"
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder="e.g., src/components/Header.tsx"
                className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
              />
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional context for Claude..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400 resize-none"
              />
            </div>

            {/* Error Message */}
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="min-w-20 h-9 px-4 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || isLoading}
              className="min-w-20 h-9 px-4 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    className="animate-spin"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="8" cy="8" r="6" strokeDasharray="10 30" />
                  </svg>
                  {activeTab === 'image' ? 'Uploading...' : 'Extracting...'}
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  {activeTab === 'image' ? 'Upload Reference' : 'Extract & Save'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
