import { useState, useEffect, useRef } from 'react';
import { featureMatrixV2Api } from '../services/api';

const POLL_MS = 3000;

/**
 * Feature Matrix v2 (evidence-first) loader.
 *
 * Kept separate from useFeatureReportData on purpose: v2 is flag-gated behind
 * FEATURE_MATRIX_V2 on the backend and returns a different payload. When the
 * flag is off the endpoint 404s, which surfaces as `unavailable` rather than an
 * error so the rest of the report keeps working.
 *
 * State is only ever set from async continuations, never synchronously inside
 * the effect body.
 */
export default function useCapabilityMatrixData(projectId, { enabled = true } = {}) {
  const active = Boolean(projectId && enabled);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(active);
  const [generating, setGenerating] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearInterval(pollRef.current); };
  }, []);

  const fetchOnce = async () => {
    const report = await featureMatrixV2Api.getData(projectId);
    if (!mounted.current) return null;
    if (report) { setData(report); setLoading(false); setGenerating(false); }
    return report;
  };

  const handleFailure = (e) => {
    if (!mounted.current) return;
    const msg = String(e?.message || e);
    if (msg.includes('404') || /not found/i.test(msg)) setUnavailable(true);
    else setError(msg);
    setLoading(false);
    setGenerating(false);
  };

  // Initial read. Promise continuations only — no synchronous setState here.
  useEffect(() => {
    if (!active) return undefined;
    fetchOnce()
      .then((report) => { if (mounted.current && !report) setLoading(false); })
      .catch(handleFailure);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, active]);

  // Explicit user action: kick off a generation and poll until it lands.
  const reload = ({ refresh = false } = {}) => {
    if (!active) return;
    setError(''); setUnavailable(false);
    if (!refresh) { setLoading(true); fetchOnce().catch(handleFailure); return; }
    setGenerating(true);
    featureMatrixV2Api.generate(projectId, { refresh: true })
      .then(() => {
        clearInterval(pollRef.current);
        pollRef.current = setInterval(() => {
          fetchOnce()
            .then((r) => { if (r) clearInterval(pollRef.current); })
            .catch(() => { /* generation is long-running; keep polling */ });
        }, POLL_MS);
      })
      .catch(handleFailure);
  };

  return { data, loading, generating, unavailable, error, reload };
}
