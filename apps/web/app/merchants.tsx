'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Icon from './ui-icon';
import { formatEuro, parseEuroMinorUnits, type SavedIdentity } from './payment-utils';

type Api = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
interface Merchant {
  id: string;
  displayName: string;
  owner: SavedIdentity;
  role: 'OWNER' | 'MANAGER' | 'VIEWER';
  members: { user: SavedIdentity; role: 'MANAGER' | 'VIEWER' }[];
  refunds: { available: false; reason: string };
}
interface History {
  requests: {
    id: string;
    payer: SavedIdentity;
    amountMinor: number;
    state: string;
    createdAt: string;
    payment: { id: string; state: string; failureCode: string | null } | null;
  }[];
  codes: {
    id: string;
    amountMinor: number | null;
    state: string;
    createdAt: string;
    payment: { id: string; amountMinor: number; state: string; payer: SavedIdentity } | null;
  }[];
}
interface Code {
  payload: string;
  imageDataUrl: string;
  expiresAt?: string;
  amountMinor?: number | null;
}

export default function Merchants({
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
  onRequest: (id: string) => Promise<void>;
}) {
  const [profiles, setProfiles] = useState<Merchant[]>([]);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [history, setHistory] = useState<History>({ requests: [], codes: [] });
  const [tab, setTab] = useState<'history' | 'request' | 'qr' | 'team'>('history');
  const [name, setName] = useState('');
  const [payer, setPayer] = useState('');
  const [amount, setAmount] = useState('');
  const [review, setReview] = useState<{ payer: SavedIdentity; amountMinor: number } | null>(null);
  const [memberName, setMemberName] = useState('');
  const [role, setRole] = useState<'MANAGER' | 'VIEWER'>('VIEWER');
  const [code, setCode] = useState<Code | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const active = useRef(false);
  const key = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    api<Merchant[]>(`/merchants?userId=${identity.id}`)
      .then((result) => {
        if (mounted) setProfiles(result);
      })
      .catch((failure) => {
        if (mounted)
          setError(failure instanceof Error ? failure.message : 'Could not load merchants.');
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
    setNotice('');
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Merchant action failed.');
    } finally {
      active.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  async function open(id: string) {
    const result = await api<Merchant>(`/merchants/${id}?userId=${identity.id}`);
    setMerchant(result);
    setName(result.displayName);
    setTab('history');
    setCode(null);
    setReview(null);
    setAmount('');
    setHistory(await api<History>(`/merchants/${id}/history?userId=${identity.id}`));
  }
  async function refresh() {
    await run(async () => {
      setProfiles(await api<Merchant[]>(`/merchants?userId=${identity.id}`));
      if (merchant) {
        setMerchant(await api<Merchant>(`/merchants/${merchant.id}?userId=${identity.id}`));
        setHistory(await api<History>(`/merchants/${merchant.id}/history?userId=${identity.id}`));
      }
    });
  }
  function idempotency(fingerprint: string) {
    if (key.current?.fingerprint !== fingerprint)
      key.current = { fingerprint, key: `web-merchant-${crypto.randomUUID()}` };
    return key.current.key;
  }
  async function createProfile(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const created = await api<Merchant>('/merchants', 'POST', {
        userId: identity.id,
        displayName: name,
      });
      setProfiles((current) => [created, ...current.filter((entry) => entry.id !== created.id)]);
      await open(created.id);
    });
  }
  async function reviewRequest(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const amountMinor = parseEuroMinorUnits(amount);
      if (!amountMinor)
        throw new Error('Enter a positive EUR amount with at most two decimal places.');
      const found = await api<SavedIdentity>('/directory/resolve/username', 'POST', {
        username: payer.replace(/^@/, '').trim(),
      });
      if (found.id === merchant?.owner.id)
        throw new Error('Choose a customer other than the receiving owner.');
      setReview({ payer: found, amountMinor });
    });
  }
  async function memberAction(memberId: string, nextRole: 'MANAGER' | 'VIEWER' | 'REMOVE') {
    if (!merchant) return;
    const updated = await api<Merchant>(`/merchants/${merchant.id}/members`, 'POST', {
      userId: identity.id,
      memberId,
      role: nextRole,
    });
    setMerchant(updated);
    setProfiles((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
  }
  const writable = merchant?.role === 'OWNER' || merchant?.role === 'MANAGER';

  return (
    <section className="merchant-workspace">
      <div className="section-title">
        <div>
          <p className="eyebrow">DEVELOPMENT / MOCK BANK ONLY</p>
          <h1>{merchant?.displayName ?? 'Merchants'}</h1>
        </div>
        <button
          className="icon-button"
          title="Refresh merchant"
          aria-label="Refresh merchant"
          disabled={busy}
          onClick={() => void refresh()}
        >
          <Icon name="refresh-cw" />
        </button>
      </div>
      {error && (
        <div className="message error" role="alert">
          <Icon name="circle-alert" />
          {error}
        </div>
      )}
      {notice && (
        <div className="message success" role="status">
          {notice}
        </div>
      )}
      {busy && (
        <p className="working" role="status">
          Working...
        </p>
      )}
      {!merchant ? (
        <>
          <div className="merchant-list">
            {profiles.map((entry) => (
              <button
                className="bill-row"
                key={entry.id}
                disabled={busy}
                onClick={() => void run(() => open(entry.id))}
              >
                <span>
                  <strong>{entry.displayName}</strong>
                  <small>Receiving identity: @{entry.owner.username}</small>
                </span>
                <span className="state">{entry.role.toLowerCase()}</span>
                <Icon name="chevron-right" />
              </button>
            ))}
          </div>
          {!profiles.some((entry) => entry.role === 'OWNER') && (
            <form className="flow-section" onSubmit={createProfile}>
              <h2>Create a development merchant</h2>
              <label>
                Merchant name
                <input
                  required
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <button className="action" disabled={busy}>
                <Icon name="store" />
                Create merchant
              </button>
            </form>
          )}
        </>
      ) : (
        <>
          <div className="merchant-context">
            <span className="state">{merchant.role.toLowerCase()}</span>
            <span>Receiving identity: @{merchant.owner.username}</span>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setMerchant(null);
                setCode(null);
                setReview(null);
                setName('');
              }}
            >
              All merchants
            </button>
          </div>
          <div className="request-tabs merchant-tabs" role="tablist" aria-label="Merchant view">
            {(
              [
                'history',
                ...(writable ? (['request'] as const) : []),
                'qr',
                ...(merchant.role === 'OWNER' ? (['team'] as const) : []),
              ] as const
            ).map((value) => (
              <button
                role="tab"
                key={value}
                aria-selected={tab === value}
                onClick={() => {
                  setTab(value);
                  setError('');
                  setReview(null);
                }}
              >
                {value === 'history'
                  ? 'History'
                  : value === 'request'
                    ? 'Request payment'
                    : value === 'qr'
                      ? 'QR codes'
                      : 'Profile / team'}
              </button>
            ))}
          </div>
          {tab === 'history' && (
            <>
              <h2>Payment requests</h2>
              {history.requests.length ? (
                history.requests.map((entry) => (
                  <div className="merchant-history-row" key={entry.id}>
                    <span className="bill-person">
                      <strong>@{entry.payer.username}</strong>
                      <small>Request: {entry.state.toLowerCase()}</small>
                      <small>
                        Payment:{' '}
                        {entry.payment?.state.replaceAll('_', ' ').toLowerCase() ?? 'not created'}
                      </small>
                    </span>
                    <strong>{formatEuro(entry.amountMinor)}</strong>
                    <div className="flow-actions">
                      {merchant.role === 'OWNER' && (
                        <button
                          className="icon-button"
                          title="Open payment request"
                          aria-label="Open merchant request"
                          disabled={busy}
                          onClick={() => void run(() => onRequest(entry.id))}
                        >
                          <Icon name="arrow-right" />
                        </button>
                      )}
                      {writable && entry.state === 'PENDING' && (
                        <button
                          className="icon-button"
                          title="Cancel merchant request"
                          aria-label="Cancel merchant request"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api(
                                `/merchants/${merchant.id}/requests/${entry.id}/cancel`,
                                'POST',
                                { userId: identity.id },
                              );
                              setHistory(
                                await api<History>(
                                  `/merchants/${merchant.id}/history?userId=${identity.id}`,
                                ),
                              );
                            })
                          }
                        >
                          <Icon name="x" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">No merchant payment requests.</p>
              )}
              <h2 className="merchant-history-heading">QR checkouts</h2>
              {history.codes.length ? (
                history.codes.map((entry) => (
                  <div className="merchant-history-row" key={entry.id}>
                    <span className="bill-person">
                      <strong>
                        {entry.amountMinor === null
                          ? 'Open checkout'
                          : formatEuro(entry.amountMinor)}
                      </strong>
                      <small>QR: {entry.state.toLowerCase()}</small>
                      <small>
                        {entry.payment
                          ? `@${entry.payment.payer.username} / ${entry.payment.state.replaceAll('_', ' ').toLowerCase()}`
                          : 'No payment created'}
                      </small>
                    </span>
                    <strong>{entry.payment ? formatEuro(entry.payment.amountMinor) : '-'}</strong>
                  </div>
                ))
              ) : (
                <p className="muted">No merchant QR checkouts.</p>
              )}
              <div className="merchant-refund">
                <span title={merchant.refunds.reason}>
                  <button className="action secondary" disabled>
                    <Icon name="undo-2" />
                    Refund unavailable
                  </button>
                </span>
                <p className="fine-print">{merchant.refunds.reason}</p>
              </div>
            </>
          )}
          {tab === 'request' && writable && (
            <section className="flow-section">
              {review ? (
                <>
                  <h2>Review merchant request</h2>
                  <dl className="payment-details">
                    <div>
                      <dt>Merchant</dt>
                      <dd>{merchant.displayName}</dd>
                    </div>
                    <div>
                      <dt>Customer</dt>
                      <dd>@{review.payer.username}</dd>
                    </div>
                    <div>
                      <dt>Receiving identity</dt>
                      <dd>@{merchant.owner.username}</dd>
                    </div>
                    <div>
                      <dt>Amount</dt>
                      <dd className="large-amount">{formatEuro(review.amountMinor)}</dd>
                    </div>
                  </dl>
                  <div className="flow-actions">
                    <button
                      className="action"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const request = await api<{ id: string }>(
                            `/merchants/${merchant.id}/requests`,
                            'POST',
                            {
                              userId: identity.id,
                              payerId: review.payer.id,
                              amountMinor: review.amountMinor,
                              currency: 'EUR',
                              idempotencyKey: idempotency(
                                JSON.stringify([
                                  'request',
                                  merchant.id,
                                  review.payer.id,
                                  review.amountMinor,
                                ]),
                              ),
                            },
                          );
                          setHistory(
                            await api<History>(
                              `/merchants/${merchant.id}/history?userId=${identity.id}`,
                            ),
                          );
                          key.current = null;
                          setReview(null);
                          setAmount('');
                          setPayer('');
                          setTab('history');
                          setNotice(`Merchant request created: ${request.id}`);
                        })
                      }
                    >
                      <Icon name="check" />
                      Create merchant request
                    </button>
                    <button
                      className="action secondary"
                      disabled={busy}
                      onClick={() => setReview(null)}
                    >
                      Edit request
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={reviewRequest}>
                  <label>
                    Customer username
                    <input
                      required
                      value={payer}
                      onChange={(event) => setPayer(event.target.value)}
                      placeholder="@username"
                    />
                  </label>
                  <label>
                    Saved test customer
                    <select value="" onChange={(event) => setPayer(event.target.value)}>
                      <option value="">Choose a local identity</option>
                      {saved
                        .filter((entry) => entry.id !== merchant.owner.id)
                        .map((entry) => (
                          <option key={entry.id} value={entry.username}>
                            @{entry.username}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Merchant request amount (EUR)
                    <input
                      required
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </label>
                  <button className="action" disabled={busy}>
                    <Icon name="arrow-right" />
                    Review merchant request
                  </button>
                </form>
              )}
            </section>
          )}
          {tab === 'qr' && (
            <>
              <div className="flow-actions">
                <button
                  className="action secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      setCode(
                        await api<Code>(
                          `/merchants/${merchant.id}/static-qr?userId=${identity.id}`,
                        ),
                      );
                    })
                  }
                >
                  <Icon name="qr-code" />
                  Show static QR
                </button>
              </div>
              {writable && (
                <form
                  className="merchant-dynamic-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      const amountMinor = parseEuroMinorUnits(amount);
                      if (!amountMinor) throw new Error('Enter a positive EUR amount.');
                      const generated = await api<Code>(`/merchants/${merchant.id}/qr`, 'POST', {
                        userId: identity.id,
                        amountMinor,
                        currency: 'EUR',
                        idempotencyKey: idempotency(
                          JSON.stringify(['qr', merchant.id, amountMinor]),
                        ),
                      });
                      setCode(generated);
                      key.current = null;
                      setHistory(
                        await api<History>(
                          `/merchants/${merchant.id}/history?userId=${identity.id}`,
                        ),
                      );
                    });
                  }}
                >
                  <label>
                    Dynamic QR amount (EUR)
                    <input
                      required
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </label>
                  <button className="action" disabled={busy}>
                    <Icon name="plus" />
                    Generate dynamic QR
                  </button>
                </form>
              )}
              {code && (
                <div className="merchant-code">
                  <img
                    className="qr-image"
                    src={code.imageDataUrl}
                    width="320"
                    height="320"
                    alt={`Merchant payment QR for ${merchant.displayName}`}
                  />
                  <strong>
                    {code.amountMinor == null
                      ? 'Amount chosen at checkout'
                      : formatEuro(code.amountMinor)}
                  </strong>
                  <p className="muted">
                    {code.expiresAt
                      ? `Single-use / expires ${new Date(code.expiresAt).toLocaleString()}`
                      : 'Reusable merchant reference / each checkout expires separately'}
                  </p>
                  <label>
                    Merchant QR payload
                    <input readOnly value={code.payload} />
                  </label>
                  <a
                    className="icon-button"
                    href={code.imageDataUrl}
                    download="kliks-merchant-qr.png"
                    title="Download merchant QR"
                    aria-label="Download merchant QR"
                  >
                    <Icon name="download" />
                  </a>
                </div>
              )}
            </>
          )}
          {tab === 'team' && merchant.role === 'OWNER' && (
            <>
              <form
                className="merchant-profile-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    const updated = await api<Merchant>(
                      `/merchants/${merchant.id}/profile`,
                      'POST',
                      { userId: identity.id, displayName: name },
                    );
                    setMerchant(updated);
                    setProfiles((current) =>
                      current.map((entry) => (entry.id === updated.id ? updated : entry)),
                    );
                  });
                }}
              >
                <label>
                  Merchant name
                  <input
                    required
                    maxLength={80}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <button className="action" disabled={busy}>
                  <Icon name="save" />
                  Save profile
                </button>
              </form>
              <h2>Team</h2>
              <div className="merchant-team-row">
                <span>@{merchant.owner.username}</span>
                <span className="state">owner</span>
              </div>
              {merchant.members.map((entry) => (
                <div className="merchant-team-row" key={entry.user.id}>
                  <span>@{entry.user.username}</span>
                  <select
                    aria-label={`Role for @${entry.user.username}`}
                    value={entry.role}
                    disabled={busy}
                    onChange={(event) =>
                      void run(() =>
                        memberAction(
                          entry.user.id,
                          event.target.value as 'MANAGER' | 'VIEWER' | 'REMOVE',
                        ),
                      )
                    }
                  >
                    <option value="MANAGER">Manager</option>
                    <option value="VIEWER">Viewer</option>
                    <option value="REMOVE">Remove access</option>
                  </select>
                </div>
              ))}
              <form
                className="merchant-profile-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    const found = await api<SavedIdentity>('/directory/resolve/username', 'POST', {
                      username: memberName.replace(/^@/, '').trim(),
                    });
                    await memberAction(found.id, role);
                    setMemberName('');
                  });
                }}
              >
                <label>
                  Staff username
                  <input
                    required
                    value={memberName}
                    onChange={(event) => setMemberName(event.target.value)}
                  />
                </label>
                <label>
                  Staff role
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as 'MANAGER' | 'VIEWER')}
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="MANAGER">Manager</option>
                  </select>
                </label>
                <button className="action secondary" disabled={busy}>
                  <Icon name="user-plus" />
                  Add staff
                </button>
              </form>
            </>
          )}
        </>
      )}
    </section>
  );
}
