'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { allocateSplitBill, type SplitAllocation, type SplitMode } from '@kliks/shared';
import { formatEuro, parseEuroMinorUnits, type SavedIdentity } from './payment-utils';
import Icon from './ui-icon';

type Api = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
interface BillShare {
  id: string;
  user: SavedIdentity;
  amountMinor: number;
  ownShare: boolean;
  request: {
    id: string;
    state: string;
    payment: { id: string; state: string; failureCode: string | null } | null;
  } | null;
}
interface Bill {
  id: string;
  creatorId: string;
  creator: SavedIdentity;
  title: string;
  totalMinor: number;
  currency: 'EUR';
  mode: SplitMode;
  state: 'OPEN' | 'CANCELLED';
  status: string;
  requestedMinor: number;
  settledMinor: number;
  canCancel: boolean;
  shares: BillShare[];
  createdAt: string;
}
interface DraftParticipant extends SavedIdentity {
  amount: string;
}

export default function SplitBills({
  identity,
  saved,
  api,
  onBusyChange,
  onRequest,
}: {
  identity: SavedIdentity;
  saved: SavedIdentity[];
  api: Api;
  onBusyChange: (busy: boolean) => void;
  onRequest: (requestId: string) => Promise<void>;
}) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [bill, setBill] = useState<Bill | null>(null);
  const [screen, setScreen] = useState<'list' | 'edit' | 'review' | 'detail'>('list');
  const [title, setTitle] = useState('');
  const [total, setTotal] = useState('');
  const [mode, setMode] = useState<SplitMode>('EQUAL');
  const [participants, setParticipants] = useState<DraftParticipant[]>([
    { ...identity, amount: '' },
  ]);
  const [lookupMode, setLookupMode] = useState<'username' | 'phone'>('username');
  const [lookup, setLookup] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false);
  const key = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    api<Bill[]>(`/split-bills?userId=${identity.id}`)
      .then((result) => {
        if (mounted) setBills(result);
      })
      .catch((failure) => {
        if (mounted) setError(failure instanceof Error ? failure.message : 'Could not load bills.');
      });
    return () => {
      mounted = false;
    };
  }, [api, identity.id]);

  async function run(action: () => Promise<void>) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    onBusyChange(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not complete the bill action.');
    } finally {
      active.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  function start() {
    setTitle('');
    setTotal('');
    setMode('EQUAL');
    setParticipants([{ ...identity, amount: '' }]);
    setLookup('');
    setBill(null);
    setError('');
    key.current = null;
    setScreen('edit');
  }

  async function addParticipant(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (participants.length >= 20) throw new Error('A bill supports at most 20 participants.');
      const found = await api<SavedIdentity>(
        `/directory/resolve/${lookupMode}`,
        'POST',
        lookupMode === 'username'
          ? { username: lookup.replace(/^@/, '').trim() }
          : { phoneNumber: lookup.trim() },
      );
      if (participants.some((entry) => entry.id === found.id))
        throw new Error('That participant is already in this bill.');
      setParticipants((current) => [...current, { ...found, amount: '' }]);
      setLookup('');
    });
  }

  function allocations(): SplitAllocation[] {
    const totalMinor = parseEuroMinorUnits(total);
    if (!totalMinor) throw new Error('Enter a positive EUR total with at most two decimal places.');
    return allocateSplitBill(
      totalMinor,
      mode,
      participants.map((entry) => {
        if (mode === 'EQUAL') return { userId: entry.id };
        const amountMinor = parseEuroMinorUnits(entry.amount);
        if (!amountMinor) throw new Error('Enter a positive custom share for every participant.');
        return { userId: entry.id, amountMinor };
      }),
    );
  }

  let preview: SplitAllocation[] = [];
  try {
    preview = allocations();
  } catch {
    preview = [];
  }

  async function create() {
    await run(async () => {
      const shares = allocations();
      const body = {
        creatorId: identity.id,
        title: title.trim(),
        totalMinor: parseEuroMinorUnits(total),
        currency: 'EUR',
        mode,
        participants: shares.map((share) => (mode === 'EQUAL' ? { userId: share.userId } : share)),
      };
      const fingerprint = JSON.stringify(body);
      if (key.current?.fingerprint !== fingerprint)
        key.current = { fingerprint, key: `web-bill-${crypto.randomUUID()}` };
      const created = await api<Bill>('/split-bills', 'POST', {
        ...body,
        idempotencyKey: key.current.key,
      });
      setBill(created);
      setBills((current) => [created, ...current.filter((entry) => entry.id !== created.id)]);
      setScreen('detail');
    });
  }

  async function refresh() {
    await run(async () => {
      setBills(await api<Bill[]>(`/split-bills?userId=${identity.id}`));
      if (bill) setBill(await api<Bill>(`/split-bills/${bill.id}?userId=${identity.id}`));
    });
  }

  return (
    <section className="bills-workspace">
      <div className="section-title">
        <div>
          <p className="eyebrow">SIMULATED / SHARED EXPENSES</p>
          <h1>
            {screen === 'edit'
              ? 'Create a split bill'
              : screen === 'review'
                ? 'Review split bill'
                : screen === 'detail'
                  ? bill?.title
                  : 'Split bills'}
          </h1>
        </div>
        <div className="flow-actions">
          <button
            className="icon-button"
            title="Refresh bills"
            aria-label="Refresh bills"
            disabled={busy}
            onClick={() => void refresh()}
          >
            <Icon name="refresh-cw" />
          </button>
          {screen === 'list' && (
            <button className="action" disabled={busy} onClick={start}>
              <Icon name="plus" />
              New bill
            </button>
          )}
        </div>
      </div>
      {error && (
        <div role="alert" className="message error">
          <Icon name="circle-alert" />
          {error}
        </div>
      )}
      {busy && (
        <p role="status" className="working">
          Working...
        </p>
      )}
      {screen === 'list' && (
        <>
          {bills.length ? (
            bills.map((entry) => (
              <button
                className="bill-row"
                key={entry.id}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    setBill(await api<Bill>(`/split-bills/${entry.id}?userId=${identity.id}`));
                    setScreen('detail');
                  })
                }
              >
                <span>
                  <strong>{entry.title}</strong>
                  <small>
                    By @{entry.creator.username} / {new Date(entry.createdAt).toLocaleDateString()}
                  </small>
                </span>
                <strong>{formatEuro(entry.totalMinor)}</strong>
                <span className={`state state-${entry.status.toLowerCase()}`}>
                  {entry.status.replaceAll('_', ' ').toLowerCase()}
                </span>
                <Icon name="chevron-right" />
              </button>
            ))
          ) : (
            <div className="empty-state">
              <Icon name="users" />
              <h3>No shared bills yet</h3>
            </div>
          )}
        </>
      )}

      {screen === 'edit' && (
        <div className="bill-composer">
          <div className="bill-fields">
            <label>
              Bill name
              <input
                maxLength={80}
                value={title}
                disabled={busy}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Lunch"
              />
            </label>
            <label>
              Bill total (EUR)
              <input
                inputMode="decimal"
                value={total}
                disabled={busy}
                onChange={(event) => setTotal(event.target.value)}
                placeholder="0.00"
              />
            </label>
          </div>
          <fieldset className="segmented">
            <legend className="sr-only">Split mode</legend>
            {(['EQUAL', 'CUSTOM'] as const).map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="split-mode"
                  disabled={busy}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                />
                <span>{value === 'EQUAL' ? 'Equal shares' : 'Custom amounts'}</span>
              </label>
            ))}
          </fieldset>
          <h2>
            Participants <span className="count">{participants.length}</span>
          </h2>
          {participants.map((entry) => (
            <div className="bill-participant-row" key={entry.id}>
              <span className="bill-person">
                <strong>@{entry.username}</strong>
                <small>
                  {entry.id === identity.id ? 'Your share / no request' : 'Payment request'}
                </small>
              </span>
              {mode === 'CUSTOM' ? (
                <label>
                  <span className="sr-only">Share for @{entry.username}</span>
                  <input
                    aria-label={`Share for @${entry.username}`}
                    inputMode="decimal"
                    value={entry.amount}
                    disabled={busy}
                    onChange={(event) =>
                      setParticipants((current) =>
                        current.map((item) =>
                          item.id === entry.id ? { ...item, amount: event.target.value } : item,
                        ),
                      )
                    }
                    placeholder="0.00"
                  />
                </label>
              ) : (
                <strong className="bill-share-amount">
                  {preview.find((share) => share.userId === entry.id)
                    ? formatEuro(
                        preview.find((share) => share.userId === entry.id)?.amountMinor ?? 0,
                      )
                    : '-'}
                </strong>
              )}
              {entry.id !== identity.id ? (
                <button
                  className="icon-button"
                  title={`Remove @${entry.username}`}
                  aria-label={`Remove @${entry.username}`}
                  disabled={busy}
                  onClick={() =>
                    setParticipants((current) => current.filter((item) => item.id !== entry.id))
                  }
                >
                  <Icon name="trash-2" />
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          <form className="bill-lookup" onSubmit={addParticipant}>
            <label>
              Lookup by
              <select
                value={lookupMode}
                disabled={busy}
                onChange={(event) => {
                  setLookupMode(event.target.value as 'username' | 'phone');
                  setLookup('');
                }}
              >
                <option value="username">Username</option>
                <option value="phone">Phone number</option>
              </select>
            </label>
            <label>
              {lookupMode === 'username' ? 'Participant username' : 'Participant phone number'}
              <input
                value={lookup}
                required
                disabled={busy}
                onChange={(event) => setLookup(event.target.value)}
                placeholder={lookupMode === 'username' ? '@username' : '+38344XXXXXX'}
              />
            </label>
            {lookupMode === 'username' && (
              <label>
                Saved test participant
                <select
                  value=""
                  disabled={busy}
                  onChange={(event) => setLookup(event.target.value)}
                >
                  <option value="">Choose a local identity</option>
                  {saved
                    .filter((entry) => !participants.some((person) => person.id === entry.id))
                    .map((entry) => (
                      <option key={entry.id} value={entry.username}>
                        @{entry.username}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <button className="action secondary" disabled={busy || participants.length >= 20}>
              <Icon name="user-plus" />
              Add participant
            </button>
          </form>
          <div className="flow-actions">
            <button
              className="action"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (!title.trim()) throw new Error('Enter a bill name.');
                  allocations();
                  setScreen('review');
                })
              }
            >
              <Icon name="arrow-right" />
              Review bill
            </button>
            <button className="action secondary" disabled={busy} onClick={() => setScreen('list')}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {screen === 'review' && (
        <div className="flow-section">
          <dl className="payment-details">
            <div>
              <dt>Bill</dt>
              <dd>{title}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd className="large-amount">{formatEuro(parseEuroMinorUnits(total) ?? 0)}</dd>
            </div>
            <div>
              <dt>Split</dt>
              <dd>
                {mode === 'EQUAL'
                  ? 'Equal / remainder cents in participant order'
                  : 'Exact custom amounts'}
              </dd>
            </div>
          </dl>
          {participants.map((entry) => (
            <div className="bill-review-share" key={entry.id}>
              <span>
                @{entry.username}
                <small>
                  {entry.id === identity.id
                    ? 'Own share / no request'
                    : 'Simulated payment request'}
                </small>
              </span>
              <strong>
                {formatEuro(preview.find((share) => share.userId === entry.id)?.amountMinor ?? 0)}
              </strong>
            </div>
          ))}
          <div className="flow-actions">
            <button className="action" disabled={busy} onClick={() => void create()}>
              <Icon name="check" />
              Create bill and requests
            </button>
            <button className="action secondary" disabled={busy} onClick={() => setScreen('edit')}>
              Edit bill
            </button>
          </div>
        </div>
      )}

      {screen === 'detail' && bill && (
        <>
          <dl className="payment-details bill-summary">
            <div>
              <dt>Created by</dt>
              <dd>@{bill.creator.username}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd className="large-amount">{formatEuro(bill.totalMinor)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className="state">{bill.status.replaceAll('_', ' ').toLowerCase()}</span>
              </dd>
            </div>
            <div>
              <dt>Requested shares</dt>
              <dd>{formatEuro(bill.requestedMinor)}</dd>
            </div>
            <div>
              <dt>Simulated settled</dt>
              <dd>{formatEuro(bill.settledMinor)}</dd>
            </div>
          </dl>
          <h2>Participant shares</h2>
          {bill.shares.map((share) => (
            <div className="bill-detail-share" key={share.id}>
              <span className="bill-person">
                <strong>@{share.user.username}</strong>
                <small>
                  {share.ownShare
                    ? 'Own share / no request'
                    : `Request: ${share.request?.state.toLowerCase()}`}
                </small>
                {share.request?.payment && (
                  <small>
                    Payment: {share.request.payment.state.replaceAll('_', ' ').toLowerCase()}
                  </small>
                )}
              </span>
              <strong className="bill-share-amount">{formatEuro(share.amountMinor)}</strong>
              {share.request &&
                (bill.creatorId === identity.id || share.user.id === identity.id) && (
                  <button
                    className="action secondary"
                    disabled={busy}
                    onClick={() => void run(() => onRequest(share.request?.id ?? ''))}
                  >
                    <Icon name="arrow-right" />
                    Open request
                  </button>
                )}
            </div>
          ))}
          <div className="flow-actions">
            {bill.creatorId === identity.id && bill.canCancel && (
              <button
                className="action secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const updated = await api<Bill>(`/split-bills/${bill.id}/cancel`, 'POST', {
                      userId: identity.id,
                    });
                    setBill(updated);
                    setBills((current) =>
                      current.map((entry) => (entry.id === updated.id ? updated : entry)),
                    );
                  })
                }
              >
                <Icon name="x" />
                Cancel bill
              </button>
            )}
            <button
              className="action secondary"
              disabled={busy}
              onClick={() => {
                setScreen('list');
                void refresh();
              }}
            >
              Back to bills
            </button>
          </div>
        </>
      )}
    </section>
  );
}
