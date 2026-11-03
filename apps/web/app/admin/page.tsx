'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Icon from '../ui-icon';
import { formatEuro } from '../payment-utils';
import './admin.css';

const resources = [
  ['users', 'users', 'Users'],
  ['accounts', 'landmark', 'Accounts'],
  ['payments', 'arrow-up-right', 'Payments'],
  ['requests', 'arrow-down-left', 'Requests'],
  ['merchants', 'store', 'Merchants'],
  ['bills', 'receipt-text', 'Split bills'],
  ['qr', 'qr-code', 'QR sessions'],
  ['audit', 'shield-check', 'Audit'],
] as const;
type Kind = (typeof resources)[number][0];
interface Row {
  id: string;
  label: string;
  description: string;
  state: string;
  createdAt: string;
  amountMinor?: number;
  details: Record<string, string | number | boolean | null>;
  actions: string[];
}
interface Records {
  items: Row[];
  nextCursor: string | null;
}
interface Overview {
  counts: Record<string, number>;
}
const resourceDescriptions: Record<Kind, string> = {
  users: 'Development identities and directory settings',
  accounts: 'Mock Bank connections and default account status',
  payments: 'Simulated payment records, shown read-only',
  requests: 'Incoming and outgoing payment requests',
  merchants: 'Merchant profiles and staff access',
  bills: 'Shared bills and participant settlement',
  qr: 'Expiring payment sessions and usage state',
  audit: 'Append-only operational event history',
};
const summaryMetrics = [
  ['users', 'People'],
  ['accounts', 'Bank links'],
  ['payments', 'Payments'],
  ['audit', 'Audit events'],
] as const;
const labels: Record<string, string> = {
  directory: 'Change directory visibility',
  'connect-account': 'Connect Mock Bank',
  'approve-account': 'Approve Mock Bank connection',
  'reject-account': 'Reject connection',
  'default-account': 'Set default account',
  'disconnect-account': 'Disconnect account',
  'cancel-request': 'Cancel request',
  'reject-request': 'Reject request',
  'cancel-bill': 'Cancel split bill',
  'rename-merchant': 'Rename merchant',
  'merchant-member': 'Update merchant staff',
};
async function api<T>(path: string, signal?: AbortSignal, body?: unknown): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, {
    method: body ? 'POST' : 'GET',
    cache: 'no-store',
    signal: signal ?? null,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message;
    throw new Error(
      response.status === 401 || response.status === 404
        ? 'Administrator access is unavailable. Separate administrator credentials are required.'
        : Array.isArray(message)
          ? message.join(', ')
          : (message ?? 'The operation failed.'),
    );
  }
  return data as T;
}

export default function Administration() {
  const [kind, setKind] = useState<Kind>('users');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [records, setRecords] = useState<Records | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [action, setAction] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [overviewRevision, setOverviewRevision] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cursor = cursors[cursors.length - 1];

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ kind, q: query });
    if (cursor) params.set('cursor', cursor);
    setLoading(true);
    setRecords(null);
    setSelected(null);
    setAction('');
    setError('');
    void api<Records>(`records?${params}`, controller.signal)
      .then((next) => {
        setRecords(next);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Unable to load records.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [kind, query, cursor, revision]);

  useEffect(() => {
    const controller = new AbortController();
    void api<Overview>('overview', controller.signal)
      .then(setOverview)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Unable to load dashboard counts.');
      });
    return () => controller.abort();
  }, [overviewRevision]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditing =
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      if (event.key === '/' && !isEditing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') {
        closeInspector();
        searchRef.current?.blur();
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function keepFocusInInspector(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const focusable = detailRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', keepFocusInInspector);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keepFocusInInspector);
    };
  }, [selected]);

  function navigate(next: Kind) {
    setKind(next);
    setSearch('');
    setQuery('');
    setCursors([null]);
    setNotice('');
  }
  function closeInspector() {
    setSelected(null);
    setAction('');
    requestAnimationFrame(() => triggerRef.current?.focus());
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !action || busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('actions', AbortSignal.timeout(20000), {
        action,
        id: selected.id,
        ...(action === 'directory' ? { enabled: data.get('enabled') === 'on' } : {}),
        ...(action === 'rename-merchant' ? { name: data.get('name') } : {}),
        ...(action === 'merchant-member'
          ? { memberId: data.get('memberId'), role: data.get('role') }
          : {}),
      });
      setNotice('Change recorded.');
      closeInspector();
      setRevision((value) => value + 1);
      setOverviewRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <a className="brand" href="/" aria-label="KLIKS workspace">
            <span className="brand-mark">k</span>
            <span className="brand-name">
              KLIKS<span>.</span>
            </span>
            <span className="admin-brand-divider" />
            <span className="admin-brand-label">ADMIN</span>
          </a>
          <div className="admin-environment">
            <span className="admin-environment-dot" />
            <span>Protected demo</span>
            <span className="admin-simulation-tag">SIMULATION</span>
          </div>
          <a href="/" className="admin-back">
            <Icon name="arrow-left" />
            <span>Workspace</span>
          </a>
        </div>
      </header>
      <div className="admin-layout">
        <aside className="admin-rail">
          <p className="admin-rail-label">DATA</p>
          <nav className="admin-nav" aria-label="Administration">
            {resources.map(([key, icon, label]) => (
              <button
                key={key}
                className={`admin-nav-item ${key === kind ? 'admin-current' : ''}`}
                aria-current={key === kind ? 'page' : undefined}
                disabled={busy}
                onClick={() => navigate(key)}
              >
                <Icon name={icon} />
                <span>{label}</span>
                <small>{overview?.counts[key] ?? '-'}</small>
              </button>
            ))}
          </nav>
          <div className="admin-rail-note">
            <Icon name="database" />
            <div>
              <strong>Server records</strong>
              <span>PostgreSQL · synthetic data</span>
            </div>
          </div>
        </aside>
        <main className="admin-main" aria-busy={loading || busy}>
          <div className="admin-page-heading">
            <div>
              <p className="admin-kicker">ADMINISTRATION / {kind.toUpperCase()}</p>
              <h1>{resources.find(([key]) => key === kind)?.[2]}</h1>
              <p className="admin-description">{resourceDescriptions[kind]}</p>
            </div>
            <button
              className="admin-refresh"
              title="Refresh records"
              aria-label="Refresh records"
              disabled={busy || loading}
              onClick={() => {
                setRevision((value) => value + 1);
                setOverviewRevision((value) => value + 1);
              }}
            >
              <Icon name="refresh-cw" />
            </button>
          </div>
          <section className="admin-summary" aria-label="System summary">
            {summaryMetrics.map(([key, label]) => (
              <div className="admin-summary-item" key={key}>
                <span>{label}</span>
                <strong>{overview?.counts[key] ?? '—'}</strong>
              </div>
            ))}
            <span className="admin-summary-caption">LIVE COUNTS</span>
          </section>
          {error && (
            <p className="message error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="message success" role="status">
              {notice}
            </p>
          )}
          <form
            className="admin-search"
            onSubmit={(event) => {
              event.preventDefault();
              setCursors([null]);
              setQuery(search.trim());
              setRevision((value) => value + 1);
            }}
          >
            <label className="sr-only" htmlFor="admin-search">
              Search{' '}
              {kind === 'audit'
                ? 'event type'
                : kind === 'bills'
                  ? 'title'
                  : kind === 'merchants'
                    ? 'merchant name'
                    : 'username'}
            </label>
            <div className="admin-search-control">
              <Icon name="search" />
              <input
                id="admin-search"
                ref={searchRef}
                value={search}
                maxLength={64}
                placeholder={`Search ${kind === 'audit' ? 'event type' : kind === 'bills' ? 'bill title' : kind === 'merchants' ? 'merchant name' : 'username'}...`}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  className="admin-clear-search"
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearch('');
                    setQuery('');
                    setCursors([null]);
                    setRevision((value) => value + 1);
                  }}
                >
                  <Icon name="x" />
                </button>
              )}
              <kbd aria-hidden="true">/</kbd>
            </div>
            <button className="sr-only" type="submit" disabled={busy || loading}>
              Search records
            </button>
          </form>
          <div className="admin-list-heading">
            <span>Records</span>
            {records && (
              <span>{records.items.length ? `Showing ${records.items.length}` : 'No results'}</span>
            )}
          </div>
          {loading && (
            <div className="admin-loading" role="status">
              <span className="admin-spinner" /> Loading server records
            </div>
          )}
          {records && (
            <>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Record</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Created</th>
                      <th>
                        <span className="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.items.map((row) => (
                      <tr key={row.id} className={selected?.id === row.id ? 'admin-selected' : ''}>
                        <td>
                          <div className="admin-record-cell">
                            <span className="admin-record-icon">
                              <Icon
                                name={resources.find(([key]) => key === kind)?.[1] ?? 'circle'}
                              />
                            </span>
                            <span className="admin-record-copy">
                              <strong>{row.label}</strong>
                              <small>{row.description}</small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`admin-status state-${row.state.toLowerCase().replaceAll('_', '-')}`}
                          >
                            <span />
                            {row.state.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td className="admin-amount">
                          {row.amountMinor === undefined ? '—' : formatEuro(row.amountMinor)}
                        </td>
                        <td>
                          <time dateTime={row.createdAt}>
                            {new Date(row.createdAt).toLocaleString()}
                          </time>
                        </td>
                        <td>
                          <button
                            className="admin-open-record"
                            title={`Open ${row.label}`}
                            aria-label={`Open ${row.label}`}
                            disabled={busy}
                            onClick={(event) => {
                              triggerRef.current = event.currentTarget;
                              setSelected(row);
                              setAction('');
                            }}
                          >
                            <Icon name="arrow-up-right" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {records.items.length === 0 && <p role="status">No matching records.</p>}
              <div className="admin-list-footer">
                <span>
                  {records.items.length ? `${records.items.length} on this page` : 'End of list'}
                </span>
                <div className="admin-pagination">
                  <button
                    className="admin-page-button"
                    disabled={busy || cursors.length < 2}
                    onClick={() => setCursors((value) => value.slice(0, -1))}
                  >
                    <Icon name="chevron-left" />
                    Previous
                  </button>
                  <span>Page {cursors.length}</span>
                  <button
                    className="admin-page-button"
                    disabled={busy || !records.nextCursor}
                    onClick={() => setCursors((value) => [...value, records.nextCursor])}
                  >
                    Next
                    <Icon name="chevron-right" />
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
      {selected && (
        <div
          className="admin-detail-scrim"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeInspector();
          }}
        >
          <aside
            ref={detailRef}
            className="admin-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-detail-title"
          >
            <div className="admin-detail-header">
              <div>
                <p className="admin-kicker">RECORD INSPECTOR</p>
                <h2 id="admin-detail-title">{selected.label}</h2>
              </div>
              <button
                className="admin-close-detail"
                title="Close details"
                aria-label="Close details"
                autoFocus
                disabled={busy}
                onClick={closeInspector}
              >
                <Icon name="x" />
              </button>
            </div>
            <div className="admin-detail-scroll">
              <div className="admin-detail-state">
                <span
                  className={`admin-status state-${selected.state.toLowerCase().replaceAll('_', '-')}`}
                >
                  <span />
                  {selected.state.replaceAll('_', ' ')}
                </span>
                {selected.amountMinor !== undefined && (
                  <strong>{formatEuro(selected.amountMinor)}</strong>
                )}
              </div>
              <dl className="admin-detail-list">
                <div className="admin-detail-field">
                  <dt>ID</dt>
                  <dd>{selected.id}</dd>
                </div>
                {Object.entries(selected.details).map(([key, value]) => (
                  <div className="admin-detail-field" key={key}>
                    <dt>{key.replaceAll(/([A-Z])/g, ' $1')}</dt>
                    <dd>{value === null ? 'None' : String(value)}</dd>
                  </div>
                ))}
              </dl>
              {selected.actions.length > 0 && (
                <form className="admin-action-form" onSubmit={submit}>
                  <div>
                    <p className="admin-kicker">MANAGE RECORD</p>
                    <label htmlFor="admin-operation">Choose an operation</label>
                  </div>
                  <select
                    id="admin-operation"
                    value={action}
                    disabled={busy}
                    required
                    onChange={(event) => setAction(event.target.value)}
                  >
                    <option value="">Choose an operation</option>
                    {selected.actions.map((operation) => (
                      <option key={operation} value={operation}>
                        {labels[operation]}
                      </option>
                    ))}
                  </select>
                  {action && (
                    <fieldset key={`${selected.id}-${action}`} disabled={busy}>
                      {action === 'directory' && (
                        <label>
                          <input
                            type="checkbox"
                            name="enabled"
                            defaultChecked={selected.details.directoryEnabled === true}
                          />
                          Listed in directory
                        </label>
                      )}
                      {action === 'rename-merchant' && (
                        <label>
                          Merchant name
                          <input
                            name="name"
                            required
                            maxLength={80}
                            defaultValue={selected.label}
                          />
                        </label>
                      )}
                      {action === 'merchant-member' && (
                        <>
                          <label>
                            Staff user ID
                            <input name="memberId" required pattern="[0-9a-fA-F-]{36}" />
                          </label>
                          <label>
                            Staff role
                            <select name="role">
                              <option value="VIEWER">Viewer</option>
                              <option value="MANAGER">Manager</option>
                              <option value="REMOVE">Remove access</option>
                            </select>
                          </label>
                        </>
                      )}
                      <label className="admin-confirm">
                        <input type="checkbox" required />
                        Confirm {labels[action]?.toLowerCase()} for {selected.label}
                      </label>
                      <button className="admin-apply-action" type="submit">
                        <Icon name="check" />
                        {busy ? 'Saving...' : 'Apply change'}
                      </button>
                    </fieldset>
                  )}
                </form>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
