import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { RefreshCw } from 'lucide-react';
import useProject from '../hooks/useProject';
import useFeatureReportData from '../hooks/useFeatureReportData';
import FeatureMatrix from '../components/feature-report/FeatureMatrix';
import GapAnalysis from '../components/feature-report/GapAnalysis';
import MessagingPlaybook from '../components/feature-report/MessagingPlaybook';
import CapabilityMatrix from '../components/feature-report/CapabilityMatrix';
import useCapabilityMatrixData from '../hooks/useCapabilityMatrixData';
import '../styles/capability-matrix.css';
import Spinner from '../components/report/ui/Spinner';
import PillTabs from '../components/report/ui/PillTabs';

export default function FeatureReport() {
  const { id: paramId } = useParams();
  const { projectId: resolvedId } = useProject();
  const projectId = paramId || resolvedId;

  const printRef = useRef(null);
  const [activeTab, setActiveTab] = useState('matrix');

  const { data, loading, status, statusLabel, error, refreshing, refresh, loadReport } = useFeatureReportData(projectId);
  // Feature Matrix v2 loads independently: it is flag-gated on the backend and
  // must never block or break the v1 report if the flag is off.
  const capability = useCapabilityMatrixData(projectId);

  const reactToPrintFn = useReactToPrint({ contentRef: printRef });

  if (!projectId || loading) {
    return (
      <Spinner
        text="Loading feature report..."
        subtext="Checking for cached report data"
        steps={['Loading project data', 'Checking cache']}
      />
    );
  }

  if (!data && status && status !== 'failed') {
    return (
      <Spinner
        text={statusLabel || 'Generating feature report...'}
        subtext="This may take 20-40 minutes for the first generation. Subsequent loads will be instant."
        steps={[
          'Classifying product pages',
          'Comparing features across competitors',
          'Generating report sections',
        ]}
      />
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <div className="report-error">
          <div className="report-error-title">Failed to generate feature report</div>
          <div className="report-error-desc">{error}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn-primary" onClick={() => loadReport()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Normalize LLM data: unwrap object-wrapped arrays
  const arrayKeys = ['feature_matrix', 'gap_analysis', 'messaging_playbook'];
  for (const key of arrayKeys) {
    const val = data[key];
    if (val && !Array.isArray(val) && typeof val === 'object') {
      const found = Object.values(val).find(v => Array.isArray(v));
      data[key] = found || [];
    }
  }

  const { meta } = data;
  const tabs = [
    { key: 'matrix', label: 'Feature Matrix' },
    { key: 'gaps', label: 'Gap Analysis' },
    { key: 'messaging', label: 'Competitor Messaging Playbook' },
    { key: 'capability', label: 'Capability Matrix' },
  ];

  return (
    <div className="report-root report-container" ref={printRef}>
      <div className="report-header">
        <div className="report-logo"><span>KO</span>MPETE</div>
        <div className="report-actions">
          <button
            className="btn-secondary"
            onClick={refresh}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spinning' : ''} />
            {refreshing ? 'Regenerating...' : 'Regenerate'}
          </button>
          <button className="btn-secondary" onClick={() => reactToPrintFn()}>
            Export PDF
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--navy)', fontSize: '1.8rem', marginBottom: 4 }}>
          Feature Intelligence Report
        </h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>
          {meta.main_company?.name} vs {meta.competitors?.length} Competitors
          &nbsp;&bull;&nbsp;
          {meta.main_features_count} features &bull; {meta.total_comparisons} comparisons
        </p>
      </div>

      <PillTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
      <div className="section">
        <div className={`tab-section${activeTab === 'matrix' ? '' : ' tab-section-hidden'}`}>
          {data.feature_matrix && <FeatureMatrix data={data.feature_matrix} meta={meta} />}
        </div>
        <div className={`tab-section${activeTab === 'gaps' ? '' : ' tab-section-hidden'}`}>
          {data.gap_analysis && <GapAnalysis data={data.gap_analysis} />}
        </div>
        <div className={`tab-section${activeTab === 'messaging' ? '' : ' tab-section-hidden'}`}>
          {data.messaging_playbook?.length > 0
            ? <MessagingPlaybook data={data.messaging_playbook} meta={meta} />
            : <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--gray-400)' }}>
                <p style={{ fontSize: '1rem', fontWeight: 500 }}>Competitor Messaging Playbook data not yet available</p>
                <p style={{ fontSize: '0.85rem' }}>Try regenerating the report to generate this section.</p>
              </div>
          }
        </div>
        <div className={`tab-section${activeTab === 'capability' ? '' : ' tab-section-hidden'}`}>
          {capability.data
            ? <CapabilityMatrix
                report={capability.data}
                subjectCompanyId={meta?.main_company?.id}
              />
            : <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--gray-400)' }}>
                {capability.generating ? (
                  <>
                    <p style={{ fontSize: '1rem', fontWeight: 500 }}>Building the evidence-first matrix…</p>
                    <p style={{ fontSize: '0.85rem' }}>Sweeping vendor pages and verifying quotes. This runs long on first generation.</p>
                  </>
                ) : capability.unavailable ? (
                  <>
                    <p style={{ fontSize: '1rem', fontWeight: 500 }}>Capability Matrix is not enabled for this environment</p>
                    <p style={{ fontSize: '0.85rem' }}>Set <code>FEATURE_MATRIX_V2</code> on the API to turn it on.</p>
                  </>
                ) : capability.error ? (
                  <>
                    <p style={{ fontSize: '1rem', fontWeight: 500 }}>Could not load the Capability Matrix</p>
                    <p style={{ fontSize: '0.85rem' }}>{capability.error}</p>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: '1rem', fontWeight: 500 }}>No capability matrix generated yet</p>
                    <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                      Evidence-first scoring: every yes or partial is backed by a verified verbatim quote.
                    </p>
                    <button className="btn-secondary" onClick={() => capability.reload({ refresh: true })}>
                      Generate Capability Matrix
                    </button>
                  </>
                )}
              </div>
          }
        </div>
      </div>

      <footer className="report-footer">
        <div className="footer-logo"><span style={{ color: 'var(--brand-accent)' }}>KO</span>MPETE</div>
        <div className="footer-text">Feature Intelligence Report &bull; {meta.main_company?.name}</div>
      </footer>
    </div>
  );
}
