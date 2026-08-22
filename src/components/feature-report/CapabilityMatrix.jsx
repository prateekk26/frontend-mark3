import { useState } from 'react';
import { Tooltip } from 'antd';
import { ChevronRight, ExternalLink, Quote, FileSearch, AlertTriangle } from 'lucide-react';

/*
 * Capability Matrix — Feature Matrix v2 (evidence-first).
 *
 * Renders the v2 payload: every yes/partial cell references a verbatim quote
 * the backend verified as an exact substring of its source page.
 *
 * Two distinctions this UI must never blur, because they are the reason the
 * data is trustworthy:
 *   not_marketed  we read the page and the capability was not there
 *   unverifiable  we could not read the vendor's pages at all
 * Collapsing them would turn "we didn't look" into "they don't have it".
 */

const COVERAGE = {
  yes:          { label: 'Yes',        glyph: 'Y', cls: 'cm-yes' },
  partial:      { label: 'Partial',    glyph: '~', cls: 'cm-part' },
  not_marketed: { label: 'Not marketed', glyph: '–', cls: 'cm-no' },
  unverifiable: { label: 'Unverifiable', glyph: '?', cls: 'cm-unk' },
};
const WEIGHT = { yes: 1, partial: 0.5, not_marketed: 0, unverifiable: 0 };

const SOURCE_LABEL = {
  product: 'Product page', docs: 'Documentation', pricing: 'Pricing',
  blog: 'Blog / resource', marketing: 'Marketing page',
};

function CoverageDot({ coverage, beatsSubject, onClick, title }) {
  const c = COVERAGE[coverage] || COVERAGE.not_marketed;
  return (
    <Tooltip title={title}>
      <button
        type="button"
        onClick={onClick}
        className={`cm-dot ${c.cls}${beatsSubject ? ' cm-dot-beats' : ''}`}
        aria-label={`${title} — ${c.label}`}
      >
        {c.glyph}
      </button>
    </Tooltip>
  );
}

function EvidenceDrawer({ check, subjectId, onClose }) {
  if (!check) return null;
  return (
    <div className="cm-drawer-backdrop" onClick={onClose} role="presentation">
      <aside className="cm-drawer" onClick={e => e.stopPropagation()} role="dialog" aria-label="Evidence">
        <header className="cm-drawer-head">
          <div>
            <p className="cm-drawer-eyebrow">Evidence</p>
            <h4>{check.check_name}</h4>
          </div>
          <button type="button" className="cm-drawer-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="cm-drawer-body">
          {(check.vendors || []).map(v => {
            const c = COVERAGE[v.coverage] || COVERAGE.not_marketed;
            const hasQuote = Boolean(v.evidence_quote);
            return (
              <div key={v.company_id} className={`cm-ev${v.company_id === subjectId ? ' cm-ev-subject' : ''}`}>
                <p className="cm-ev-who">
                  {v.name}
                  <span className={`cm-ev-state ${c.cls}`}>{c.label}</span>
                  {v.source_type && <span className="cm-ev-src">{SOURCE_LABEL[v.source_type] || v.source_type}</span>}
                </p>
                {hasQuote
                  ? <blockquote className="cm-ev-quote">{v.evidence_quote}</blockquote>
                  : <p className="cm-ev-none">
                      {v.coverage === 'unverifiable'
                        ? 'Vendor pages could not be read, so this is unverified — not evidence of absence.'
                        : 'Page read; the capability was not marketed on it.'}
                    </p>}
                {v.evidence_url && (
                  <a href={v.evidence_url} target="_blank" rel="noopener noreferrer" className="cm-ev-link">
                    {hasQuote ? <Quote size={11} /> : <FileSearch size={11} />}
                    <span>{hasQuote ? 'Source' : 'Page checked'}</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

export default function CapabilityMatrix({ report, subjectCompanyId }) {
  const [drawer, setDrawer] = useState(null);
  const [filter, setFilter] = useState('all');
  const [openCats, setOpenCats] = useState(null);

  const { meta, verdict, scoreboard = [], shared_whitespace = [] } = report || {};
  const vendors = meta?.vendors || [];
  const subjectId = subjectCompanyId ?? vendors[0]?.id;

  // Row-level flags. Derived here rather than in the payload so the UI stays
  // correct if the caller filters the vendor set.
  // Row-level flags, derived on render. The React Compiler memoizes this;
  // hand-rolled useMemo here trips react-hooks/preserve-manual-memoization.
  const flagged = scoreboard.map(group => {
    const checks = (group.checks || []).map(check => {
      const cells = check.vendors || [];
      const subject = cells.find(c => c.company_id === subjectId);
      const sw = WEIGHT[subject?.coverage] ?? 0;
      const bestRival = Math.max(0, ...cells.filter(c => c.company_id !== subjectId).map(c => WEIGHT[c.coverage] ?? 0));
      return { ...check, trails: bestRival > sw, leadsAlone: sw > bestRival, subjectWeight: sw };
    });
    return { ...group, checks, gapCount: checks.filter(c => c.trails).length };
  });

  const counts = {
    all: flagged.reduce((n, g) => n + g.checks.length, 0),
    trails: flagged.reduce((n, g) => n + g.checks.filter(c => c.trails).length, 0),
    leads: flagged.reduce((n, g) => n + g.checks.filter(c => c.leadsAlone).length, 0),
    whitespace: shared_whitespace.length,
  };

  // Default-open only where there are gaps; once the user touches a category we
  // track the open set explicitly.
  const isOpen = (cat, gapCount) => (openCats ? openCats.has(cat) : gapCount > 0);

  const toggle = (cat) => {
    setOpenCats(prev => {
      const next = new Set(prev ?? flagged.filter(g => g.gapCount > 0).map(g => g.category));
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  if (!report) return null;

  const visible = (check) =>
    filter === 'all' ? true : filter === 'trails' ? check.trails : filter === 'leads' ? check.leadsAlone : true;

  return (
    <div className="card cm-root">
      <h3 className="section-title">Capability Matrix</h3>
      <p className="cm-sub">
        {meta?.total_checks} checks across {meta?.total_categories} categories, {vendors.length} vendors.
        Every <em>yes</em> or <em>partial</em> is backed by a verbatim quote the pipeline verified against its
        source page. <strong>Taxonomy v{meta?.taxonomy_version}</strong> — scores stay comparable across runs.
      </p>

      {verdict?.headline && <p className="cm-verdict">{verdict.headline}</p>}

      {/* vendor coverage strip */}
      <div className="cm-strip">
        {(verdict?.vendor_coverage || []).slice().sort((a, b) => b.coverage_pct - a.coverage_pct).map(v => (
          <div key={v.company_id} className={`cm-strip-item${v.company_id === subjectId ? ' cm-strip-subject' : ''}`}>
            <span className="cm-strip-name">{v.name}</span>
            <span className="cm-strip-pct">{v.coverage_pct}%</span>
            <span className="cm-strip-meter"><i style={{ width: `${v.coverage_pct}%` }} /></span>
          </div>
        ))}
      </div>

      {/* filters */}
      <div className="cm-filters" role="group" aria-label="Filter checks">
        {[
          ['all', `All ${counts.all}`],
          ['trails', `Trails · ${counts.trails}`],
          ['leads', `Leads alone · ${counts.leads}`],
        ].map(([k, label]) => (
          <button key={k} type="button"
            className={`cm-filter${filter === k ? ' cm-filter-on' : ''}`}
            onClick={() => setFilter(k)} aria-pressed={filter === k}>
            {label}
          </button>
        ))}
        {counts.whitespace > 0 && (
          <span className="cm-whitespace">
            <AlertTriangle size={12} /> {counts.whitespace} checks no vendor markets
          </span>
        )}
      </div>

      {flagged.map(group => {
        const rows = group.checks.filter(visible);
        if (!rows.length) return null;
        const open = isOpen(group.category, group.gapCount);
        return (
          <section key={group.category} className="cm-cat">
            <button type="button" className="cm-cat-head" onClick={() => toggle(group.category)}
              aria-expanded={open}>
              <ChevronRight size={14} className={`cm-caret${open ? ' cm-caret-open' : ''}`} />
              <span className="cm-cat-name">{group.category}</span>
              <span className="cm-cat-count">{group.checks.length} checks</span>
              {group.gapCount > 0
                ? <span className="cm-cat-gaps">{group.gapCount} gap{group.gapCount === 1 ? '' : 's'}</span>
                : <span className="cm-cat-clear">no gaps</span>}
              {group.edge?.name && <span className="cm-cat-edge">Edge · {group.edge.name}</span>}
            </button>

            {open && (
              <div className="cm-scroll">
                <table className="cm-table">
                  <thead>
                    <tr>
                      <th className="cm-th-cap">Capability</th>
                      {vendors.map(v => (
                        <th key={v.id} className={v.id === subjectId ? 'cm-th-subject' : ''}>{v.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(check => (
                      <tr key={check.check_id}
                        className={check.trails ? 'cm-row-trails' : check.leadsAlone ? 'cm-row-leads' : ''}>
                        <td className="cm-td-cap">
                          <button type="button" className="cm-cap-btn" onClick={() => setDrawer(check)}>
                            {check.check_name}
                          </button>
                        </td>
                        {vendors.map(v => {
                          const cell = (check.vendors || []).find(c => c.company_id === v.id);
                          const cov = cell?.coverage || 'not_marketed';
                          const beats = v.id !== subjectId && (WEIGHT[cov] ?? 0) > check.subjectWeight;
                          return (
                            <td key={v.id}>
                              <CoverageDot
                                coverage={cov}
                                beatsSubject={beats}
                                title={`${v.name}: ${(COVERAGE[cov] || COVERAGE.not_marketed).label}`}
                                onClick={() => setDrawer(check)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      <div className="cm-legend">
        {Object.entries(COVERAGE).map(([k, c]) => (
          <span key={k} className="cm-legend-item">
            <span className={`cm-dot ${c.cls} cm-dot-static`}>{c.glyph}</span>{c.label}
          </span>
        ))}
        <span className="cm-legend-note">
          <strong>Not marketed</strong> means the page was read and the capability was absent.
          <strong> Unverifiable</strong> means the vendor's pages could not be read — never read it as absence.
        </span>
      </div>

      <EvidenceDrawer check={drawer} subjectId={subjectId} onClose={() => setDrawer(null)} />
    </div>
  );
}
