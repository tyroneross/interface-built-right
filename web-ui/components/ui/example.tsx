'use client';

import React, { useState } from 'react';
import { Button, Modal, Badge, Skeleton, SkeletonListItem } from './index';

/**
 * Example usage of Aurora Deep UI components
 */
export default function UIComponentsExample() {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLoadingDemo = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="glass p-6">
          <h1 className="text-xl font-semibold text-[#f0f0f5] mb-2">
            UI Components — Aurora Deep
          </h1>
          <p className="text-[13px] text-[#9d9db5]">
            Calm Precision design system
          </p>
        </div>

        {/* Buttons */}
        <section className="glass p-6">
          <h2 className="text-[15px] font-semibold text-[#f0f0f5] mb-4">Buttons</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="primary">Primary</Button>
              <Button variant="glass">Glass</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" loading>Loading...</Button>
              <Button variant="primary" disabled>Disabled</Button>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section className="glass p-6">
          <h2 className="text-[15px] font-semibold text-[#f0f0f5] mb-4">Badges</h2>
          <div className="flex flex-wrap gap-4">
            <Badge variant="match">Match</Badge>
            <Badge variant="changed">8.2% Changed</Badge>
            <Badge variant="broken">52% Broken</Badge>
            <Badge variant="pending">Not Compared</Badge>
            <Badge variant="active">Active</Badge>
          </div>
        </section>

        {/* Modal */}
        <section className="glass p-6">
          <h2 className="text-[15px] font-semibold text-[#f0f0f5] mb-4">Modal</h2>
          <Button variant="primary" onClick={() => setModalOpen(true)}>Open Modal</Button>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Example Modal"
            footer={
              <>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={() => setModalOpen(false)}>Confirm</Button>
              </>
            }
          >
            <div className="space-y-4">
              <input type="text" className="glass-input w-full" placeholder="Enter name..." />
              <textarea className="glass-input w-full min-h-20 resize-none" placeholder="Enter description..." />
            </div>
          </Modal>
        </section>

        {/* Skeletons */}
        <section className="glass p-6">
          <h2 className="text-[15px] font-semibold text-[#f0f0f5] mb-4">Loading States</h2>
          <Button variant="glass" onClick={handleLoadingDemo}>Toggle Loading</Button>
          {loading && (
            <div className="mt-4 space-y-4">
              <SkeletonListItem />
              <SkeletonListItem />
              <Skeleton variant="block" height={120} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
