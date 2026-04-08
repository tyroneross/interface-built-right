'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface NewSessionFormData {
  url?: string;
  name: string;
}

interface NewSessionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: NewSessionFormData) => void | Promise<void>;
  isLoading?: boolean;
}

/**
 * Simplified New Session modal — name + url only.
 * Viewport defaults to Desktop, changeable later.
 */
export function NewSessionModal({ open, onClose, onSubmit, isLoading = false }: NewSessionModalProps) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) {
      setUrl('');
      setName('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit({ url: url.trim() || undefined, name: name.trim() });
  };

  return (
    <Modal open={open} onClose={onClose} title="New Session" maxWidth="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!name.trim() || isLoading}
            loading={isLoading}
          >
            Create
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="glass-input w-full"
            placeholder="e.g., Homepage"
            autoFocus
          />
        </div>
        <div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="glass-input w-full"
            placeholder="http://localhost:3000"
          />
        </div>
      </form>
    </Modal>
  );
}
