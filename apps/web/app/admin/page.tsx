'use client';

import { useEffect, useState, type FormEvent } from 'react';
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
    void Promise.all([
      api<Records>(`records?${params}`, controller.signal),
      api<Overview>('overview', controller.signal),
    ])
      .then(([next, counts]) => {
        setRecords(next);
        setOverview(counts);
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

  function navigate(next: Kind) {
    setKind(next);
    setSearch('');
    setQuery('');
    setCursors([null]);
    setNotice('');
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
      setSelected(null);
      setAction('');
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <a className="brand" href="/">
          <span className="brand-mark">k</span>
          <span className="brand-name">
            KLIKS<span>.</span>
          </span>
        </a>
        <span>
          Administration <span className="state">SIMULATION</span>
        </span>
        <a href="/" className="admin-back">
          <Icon name="arrow-left" />
          Workspace
        </a>
      </header>
      <div className="admin-layout">
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
        <main className="admin-main" aria-busy={loading || busy}>
          <div className="admin-heading">
            <div>
              <p className="admin-kicker">SERVER RECORDS</p>
              <h1>{resources.find(([key]) => key === kind)?.[2]}</h1>
            </div>
            <button
              className="action secondary"
              title="Refresh records"
              aria-label="Refresh records"
              disabled={busy || loading}
              onClick={() => setRevision((value) => value + 1)}
            >
              <Icon name="refresh-cw" />
            </button>
          </div>
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
            <label htmlFor="admin-search">
              Search{' '}
              {kind === 'audit'
                ? 'event type'
                : kind === 'bills'
                  ? 'title'
                  : kind === 'merchants'
                    ? 'merchant name'
                    : 'username'}
            </label>
            <div>
              <input
                id="admin-search"
                value={search}
                maxLength={64}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button
                className="action"
                type="submit"
                disabled={busy || loading}
                title="Search records"
                aria-label="Search records"
              >
                <Icon name="search" />
              </button>
            </div>
          </form>
          {loading && <p role="status">Loading records...</p>}
          {records && (
            <>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Record</th>
                      <th>Status</th>
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
                          <strong>{row.label}</strong>
                          <small>{row.description}</small>
                          {row.amountMinor !== undefined && (
                            <span>{formatEuro(row.amountMinor)}</span>
                          )}
                        </td>
                        <td>
                          <span className="state">{row.state.replaceAll('_', ' ')}</span>
                        </td>
                        <td>
                          <time dateTime={row.createdAt}>
                            {new Date(row.createdAt).toLocaleString()}
                          </time>
                        </td>
                        <td>
                          <button
                            className="action secondary"
                            title={`Inspect ${row.label}`}
                            aria-label={`Inspect ${row.label}`}
                            disabled={busy}
                            onClick={() => {
                              setSelected(row);
                              setAction('');
                            }}
                          >
                            <Icon name="panel-right-open" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {records.items.length === 0 && <p role="status">No matching records.</p>}
              <div className="admin-pagination">
                <button
                  className="action secondary"
                  disabled={busy || cursors.length < 2}
                  onClick={() => setCursors((value) => value.slice(0, -1))}
                >
                  <Icon name="chevron-left" />
                  Previous
                </button>
                <span>Page {cursors.length}</span>
                <button
                  className="action secondary"
                  disabled={busy || !records.nextCursor}
                  onClick={() => setCursors((value) => [...value, records.nextCursor])}
                >
                  Next
                  <Icon name="chevron-right" />
                </button>
              </div>
            </>
          )}
          {selected && (
            <section className="admin-detail" aria-label="Record details">
              <div className="admin-heading">
                <h2>{selected.label}</h2>
                <button
                  className="action secondary"
                  title="Close details"
                  aria-label="Close details"
                  disabled={busy}
                  onClick={() => setSelected(null)}
                >
                  <Icon name="x" />
                </button>
              </div>
              <dl>
                <dt>ID</dt>
                <dd>{selected.id}</dd>
                {Object.entries(selected.details).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replaceAll(/([A-Z])/g, ' $1')}</dt>
                    <dd>{value === null ? 'None' : String(value)}</dd>
                  </div>
                ))}
              </dl>
              {selected.actions.length > 0 && (
                <form className="admin-action-form" onSubmit={submit}>
                  <label htmlFor="admin-operation">Operation</label>
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
                      <button className="action" type="submit">
                        <Icon name="check" />
                        {busy ? 'Saving...' : 'Apply change'}
                      </button>
                    </fieldset>
                  )}
                </form>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
