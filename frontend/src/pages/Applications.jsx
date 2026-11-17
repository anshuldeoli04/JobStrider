import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Filter, CheckCircle2, Sparkles, Briefcase, Award } from 'lucide-react';
import Panel from '../components/ui/Panel';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import InterviewPrepModal from '../components/ui/InterviewPrepModal';
import { useAppStore } from '../store/useAppStore';

const PAGE_SIZE = 25;
const gradeRank = { A: 5, B: 4, C: 3, D: 2, F: 1 };

export default function Applications() {
  const applications = useAppStore((state) => state.applications);
  const updateStatus = useAppStore((state) => state.updateStatus);
  const bulkUpdateStatus = useAppStore((state) => state.bulkUpdateStatus);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [prepApp, setPrepApp] = useState(null);

  const gradeCounts = useMemo(() => {
    const counts = { ALL: applications.length, A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const a of applications) {
      if (counts[a.grade] !== undefined) counts[a.grade]++;
    }
    return counts;
  }, [applications]);

  const rows = useMemo(() => {
    return applications
      .filter((item) => {
        const gradeMatch = gradeFilter === 'ALL' || item.grade === gradeFilter;
        const statusMatch = statusFilter === 'ALL' || item.status === statusFilter;
        const searchMatch =
          !search ||
          `${item.company || ''} ${item.role || ''} ${item.location || ''}`.toLowerCase().includes(search.toLowerCase());
        return gradeMatch && statusMatch && searchMatch;
      })
      .sort((a, b) => {
        const gradeDiff = (gradeRank[b.grade] || 0) - (gradeRank[a.grade] || 0);
        if (gradeDiff) return gradeDiff;
        const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
        if (scoreDiff) return scoreDiff;
        return new Date(b.timestamp || b.evaluated_at || 0).getTime() - new Date(a.timestamp || a.evaluated_at || 0).getTime();
      });
  }, [applications, gradeFilter, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + PAGE_SIZE);

  const resetPage = (setter) => (value) => {
    setter(value);
    setPage(1);
    setExpandedId(null);
    setSelectedIds([]);
  };

  return (
    <Panel
      title="🎯 Job Applications Pipeline"
      subtitle={`Tracking ${applications.length} total opportunities • Filtered: ${rows.length}`}
      action={
        <div className="toolbar-inline" style={{ gap: 8 }}>
          <button
            className="secondary-button"
            type="button"
            onClick={() => bulkUpdateStatus(selectedIds, 'applied')}
            disabled={!selectedIds.length}
            style={{
              opacity: selectedIds.length ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <CheckCircle2 size={15} />
            <span>Mark Applied ({selectedIds.length})</span>
          </button>
        </div>
      }
    >
      {/* Interactive Grade Filter Pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {[
          { id: 'ALL', label: `All Roles (${gradeCounts.ALL})`, color: 'var(--text-soft)' },
          { id: 'A', label: `✨ Grade A (${gradeCounts.A})`, color: '#10b981' },
          { id: 'B', label: `Grade B (${gradeCounts.B})`, color: '#6366f1' },
          { id: 'C', label: `Grade C (${gradeCounts.C})`, color: '#f59e0b' },
          { id: 'D', label: `Grade D (${gradeCounts.D})`, color: '#f97316' }
        ].map((pill) => {
          const isActive = gradeFilter === pill.id;
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => resetPage(setGradeFilter)(pill.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                fontSize: '0.82rem',
                fontWeight: isActive ? 600 : 500,
                border: `1px solid ${isActive ? pill.color : 'var(--border)'}`,
                background: isActive ? `${pill.color}20` : 'rgba(255, 255, 255, 0.02)',
                color: isActive ? 'var(--text)' : 'var(--text-soft)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Search and Status Dropdowns */}
      <div className="filter-row" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="text-input"
            placeholder="Search company, role, or city..."
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>

        <select
          className="status-select"
          value={statusFilter}
          onChange={(e) => resetPage(setStatusFilter)(e.target.value)}
          style={{ minWidth: 160 }}
        >
          <option value="ALL">All Statuses</option>
          <option value="evaluated">Evaluated</option>
          <option value="applied">Applied</option>
          <option value="interview">Interview</option>
          <option value="offer">Offer</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
      </div>

      {rows.length ? (
        <div className="paginated-table-shell">
          <DataTable
            rows={pageRows}
            expandedId={expandedId}
            onExpand={setExpandedId}
            selectedIds={selectedIds}
            onSelect={(id, checked) =>
              setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((item) => item !== id)))
            }
            onSelectAll={(checked) =>
              setSelectedIds((prev) => {
                const pageIds = pageRows.map((item) => item.id);
                if (checked) return [...new Set([...prev, ...pageIds])];
                return prev.filter((id) => !pageIds.includes(id));
              })
            }
            onStatusChange={updateStatus}
            onOpenInterviewPrep={(app) => setPrepApp(app)}
          />

          <div className="pagination-bar">
            <span>
              Showing {pageStart + 1} to {Math.min(pageStart + PAGE_SIZE, rows.length)} of {rows.length} matches
            </span>
            <div className="pagination-controls">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No applications match this filter"
          body="Try resetting the grade or status filter, or clearing the search text."
        />
      )}
      {prepApp && (
        <InterviewPrepModal
          open={Boolean(prepApp)}
          onClose={() => setPrepApp(null)}
          application={prepApp}
        />
      )}
    </Panel>
  );
}
