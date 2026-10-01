/**
 * MockMate — useUsage
 * Live plan usage from GET /interview/usage: interviews left today, which modes
 * are open / on free trial, and the authoritative questions-per-mode counts.
 * Returns usage = null until the first response, so callers can avoid flashing
 * lock states before they actually know (the server enforces regardless).
 */
import { useCallback, useEffect, useState } from 'react';
import { getUsage } from '../Services/interviewService';
import useAuth from './useAuth';

export default function useUsage() {
  const { user } = useAuth() || {};
  const uid  = user?._id ?? user?.id;
  const plan = user?.plan;

  const [usage, setUsage]     = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUsage(await getUsage());
    } catch {
      // Keep the last known usage; a failed refresh must never break the page.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (uid) refresh();
    else setLoading(false);
  }, [uid, plan, refresh]);

  return { usage, loading, refresh };
}
