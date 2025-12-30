'use client';

import React, { useState } from 'react';
import { Button, Modal, Badge, Skeleton, SkeletonListItem, SkeletonCard } from './index';

/**
 * Example usage of UI components
 * This file demonstrates all component variants and can be used for testing
 */
export default function UIComponentsExample() {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLoadingDemo = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            UI Components Library
          </h1>
          <p className="text-sm text-gray-600">
            Following Calm Precision design guidelines
          </p>
        </div>

        {/* Buttons */}
        <section className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Buttons</h2>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Variants</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Sizes</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="primary" size="md">Medium</Button>
                <Button variant="primary" size="lg">Large</Button>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">With Icons</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  icon={
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 4v8M4 8h8" />
                    </svg>
                  }
                >
                  Add Item
                </Button>
                <Button
                  variant="ghost"
                  icon={
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="10" cy="10" r="3" />
                      <path d="M10 1v2M10 17v2M1 10h2M17 10h2" />
                    </svg>
                  }
                  aria-label="Settings"
                />
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">States</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" loading>
                  Loading...
                </Button>
                <Button variant="primary" disabled>
                  Disabled
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Badges</h2>
          <p className="text-sm text-gray-600 mb-4">
            Text color only (no background boxes per Calm Precision)
          </p>

          <div className="flex flex-wrap gap-4">
            <div>
              <Badge variant="match">Match</Badge>
            </div>
            <div>
              <Badge variant="changed">8.2% Changed</Badge>
            </div>
            <div>
              <Badge variant="broken">52% Broken</Badge>
            </div>
            <div>
              <Badge variant="pending">Not Compared</Badge>
            </div>
            <div>
              <Badge variant="expected">Expected Change</Badge>
            </div>
          </div>
        </section>

        {/* Modal */}
        <section className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Modal</h2>
          <p className="text-sm text-gray-600 mb-4">
            Click to open modal. Close with Escape key or click outside.
          </p>

          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Open Modal
          </Button>

          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Example Modal"
            footer={
              <>
                <Button variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => setModalOpen(false)}>
                  Confirm
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
                  placeholder="Enter name..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400 resize-none"
                  rows={3}
                  placeholder="Enter description..."
                />
              </div>
            </div>
          </Modal>
        </section>

        {/* Skeletons */}
        <section className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Loading States</h2>
          <p className="text-sm text-gray-600 mb-4">
            Skeleton components with shimmer animation (1.5s cycle)
          </p>

          <div className="space-y-4">
            <Button variant="secondary" onClick={handleLoadingDemo}>
              Toggle Loading Demo
            </Button>

            {loading ? (
              <div className="space-y-4">
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonCard lines={4} />
              </div>
            ) : (
              <div className="space-y-4">
                {/* List items */}
                <div className="flex gap-2.5 p-2 rounded-lg border border-gray-200">
                  <div className="w-12 h-9 bg-gray-200 rounded flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Dashboard</div>
                    <div className="text-xs text-gray-500">8.2% changed</div>
                  </div>
                </div>

                {/* Card content */}
                <div className="p-4 rounded-lg border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-1">Session Details</h3>
                  <p className="text-sm text-gray-600 mb-1">
                    This is example content that shows when loading is complete.
                  </p>
                  <p className="text-xs text-gray-500">Desktop (1920×1080)</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
