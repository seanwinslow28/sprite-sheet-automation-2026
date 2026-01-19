/**
 * React hook for accessing Director Session state
 * Provides session data and update methods
 */

import { useState, useEffect, useCallback } from 'react';
import type { DirectorSession, DirectorFrameState, FrameStatus } from '../types/director-session';

interface UseDirectorSessionReturn {
  session: DirectorSession | null;
  frames: DirectorFrameState[];
  loading: boolean;
  error: string | null;
  selectedFrameIndex: number;
  selectFrame: (index: number) => void;
  updateFrameStatus: (frameIndex: number, status: FrameStatus) => Promise<void>;
  refreshSession: () => Promise<void>;
}

// API base URL - configurable via environment
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

export function useDirectorSession(): UseDirectorSessionReturn {
  const [session, setSession] = useState<DirectorSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);

  // Convert frames record to sorted array
  const frames: DirectorFrameState[] = session
    ? Object.values(session.frames).sort((a, b) => a.frameIndex - b.frameIndex)
    : [];

  // Fetch session from API
  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/session`);
      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.statusText}`);
      }

      const data: DirectorSession = await response.json();
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Select a frame
  const selectFrame = useCallback((index: number) => {
    setSelectedFrameIndex(index);
  }, []);

  // Update frame status
  const updateFrameStatus = useCallback(async (frameIndex: number, status: FrameStatus) => {
    if (!session) return;

    try {
      const response = await fetch(`${API_BASE}/frame/${frameIndex}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update frame status: ${response.statusText}`);
      }

      // Update local state
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          frames: {
            ...prev.frames,
            [String(frameIndex)]: {
              ...prev.frames[String(frameIndex)],
              status,
            },
          },
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [session]);

  return {
    session,
    frames,
    loading,
    error,
    selectedFrameIndex,
    selectFrame,
    updateFrameStatus,
    refreshSession: fetchSession,
  };
}

// Export context for provider pattern (optional)
export type DirectorSessionContextType = UseDirectorSessionReturn;
