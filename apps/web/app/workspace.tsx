'use client';

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type ButtonHTMLAttributes,
} from 'react';
import {
  formatEuro,
  parseEuroMinorUnits,
  readIdentities,
  type SavedIdentity,
} from './payment-utils';

type Screen =
  | 'signin'
  | 'verify'
  | 'overview'
  | 'accounts'
  | 'send'
  | 'review'
  | 'authorize'
  | 'result'
  | 'activity'
  | 'requests'
  | 'request-detail';
type Outcome = 'SUCCESS' | 'PENDING' | 'INSUFFICIENT_FUNDS' | 'PROVIDER_FAILURE';
interface Challenge {
  challengeId: string;
  developmentCode: string;
  expiresAt: string;
}
interface Account {
  id: string;
  displayName: string;
  isDefault: boolean;
  status: 'PENDING_AUTHORIZATION' | 'CONNECTED' | 'REJECTED' | 'DISCONNECTED';
}
interface Payment {
  id: string;
  payerId: string;
  payeeId: string;
  amountMinor: number;
  currency: 'EUR';
  state:
    | 'CREATED'
    | 'REQUIRES_AUTHORIZATION'
    | 'PROCESSING'
    | 'SUCCEEDED'
    | 'REJECTED'
    | 'FAILED'
    | 'CANCELLED';
  failureCode: string | null;
  createdAt: string;
}
interface PaymentRequest {
  id: string;
  requesterId: string;
  payerId: string;
  requester: SavedIdentity;
  payer: SavedIdentity;
  amountMinor: number;
  currency: 'EUR';
  state: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  payment: Payment | null;
  createdAt: string;
  simulation: true;
}
const storageKey = 'kliks.web.identities.v1';
const activeKey = 'kliks.web.active.v1';

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(
      'The local API is unavailable. Check that the API development server is running, then retry.',
    );
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message;
    throw new Error(
      Array.isArray(message)
        ? message.join(', ')
        : typeof message === 'string'
          ? message
          : 'The API could not complete this request.',
    );
  }
  return payload as T;
}

function Icon({ name }: { name: string }) {
  return (
    <img
      className="icon"
      src={`https://cdn.jsdelivr.net/npm/lucide-static@0.468.0/icons/${name}.svg`}
      width="20"
      height="20"
      alt=""
      aria-hidden="true"
    />
  );
}

function Button({
  children,
  icon,
  secondary = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string; secondary?: boolean }) {
  return (
    <button
      {...props}
      className={`action ${secondary ? 'secondary' : ''} ${props.className ?? ''}`}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

function StateBadge({ state }: { state: string }) {
  return (
    <span className={`state state-${state.toLowerCase()}`}>
      {state.replaceAll('_', ' ').toLowerCase()}
    </span>
  );
}

function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  );
}

export default function Workspace() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('signin');
  const [saved, setSaved] = useState<SavedIdentity[]>([]);
  const [identity, setIdentity] = useState<SavedIdentity | null>(null);
  const [pendingIdentity, setPendingIdentity] = useState<SavedIdentity | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [history, setHistory] = useState<Payment[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [intent, setIntent] = useState<'send' | 'request'>('send');
  const [requestTab, setRequestTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [visibility, setVisibility] = useState<boolean | null>(null);
  const [mode, setMode] = useState<'username' | 'phone'>('username');
  const [query, setQuery] = useState('');
  const [recipient, setRecipient] = useState<SavedIdentity | null>(null);
  const [amount, setAmount] = useState('');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [outcome, setOutcome] = useState<Outcome>('SUCCESS');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  const paymentKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const savedRef = useRef<SavedIdentity[]>([]);

  useEffect(() => {
    try {
      const identities = readIdentities(localStorage.getItem(storageKey));
      savedRef.current = identities;
      setSaved(identities);
      const active = identities.find((entry) => entry.id === localStorage.getItem(activeKey));
      if (active) {
        setIdentity(active);
        setScreen('overview');
      }
    } catch {
      setError('Browser storage is unavailable. Your development identity will not be remembered.');
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!identity) return;
    let active = true;
    setAccounts([]);
    setHistory([]);
    setRequests([]);
    setSelectedRequest(null);
    setVisibility(null);
    Promise.all([
      request<Account[]>(`/banking/accounts?userId=${identity.id}`),
      request<Payment[]>(`/payments?userId=${identity.id}`),
      request<PaymentRequest[]>(`/payment-requests?userId=${identity.id}`),
    ])
      .then(([nextAccounts, nextHistory, nextRequests]) => {
        if (active) {
          setAccounts(nextAccounts);
          setHistory(nextHistory);
          setRequests(nextRequests);
        }
      })
      .catch((failure) => {
        if (active)
          setError(failure instanceof Error ? failure.message : 'Could not load identity.');
      });
    return () => {
      active = false;
    };
  }, [identity]);

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function remember(next: SavedIdentity) {
    const identities = [
      ...savedRef.current.filter((entry) => entry.id !== next.id),
      { id: next.id, username: next.username },
    ];
    savedRef.current = identities;
    setSaved(identities);
    try {
      localStorage.setItem(storageKey, JSON.stringify(identities));
    } catch {
      setNotice('Identity created. Browser storage is unavailable; keep this session open.');
    }
  }

  function activate(next: SavedIdentity) {
    setPendingIdentity(null);
    setChallenge(null);
    setUsername('');
    setPhone('');
    setCode('');
    setIdentity(next);
    setScreen('overview');
    setPayment(null);
    setSelectedRequest(null);
    setRecipient(null);
    setError('');
    setNotice('');
    try {
      localStorage.setItem(activeKey, next.id);
    } catch {
      setNotice('This session will not be remembered after reload.');
    }
  }

  async function refresh() {
    if (!identity) return;
    const [nextAccounts, nextHistory, nextRequests] = await Promise.all([
      request<Account[]>(`/banking/accounts?userId=${identity.id}`),
      request<Payment[]>(`/payments?userId=${identity.id}`),
      request<PaymentRequest[]>(`/payment-requests?userId=${identity.id}`),
    ]);
    setAccounts(nextAccounts);
    setHistory(nextHistory);
    setRequests(nextRequests);
    if (selectedRequest) {
      const latest = nextRequests.find((entry) => entry.id === selectedRequest.id);
      if (latest) setSelectedRequest(latest);
    }
    if (payment) {
      const latest = nextHistory.find((entry) => entry.id === payment.id);
      if (latest) setPayment(latest);
    }
  }

  async function createIdentity(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const created =
        pendingIdentity ??
        (await request<SavedIdentity>('/identity/users', 'POST', { username, phoneNumber: phone }));
      setPendingIdentity(created);
      const verification = await request<Challenge>(
        `/identity/users/${created.id}/phone-verification`,
        'POST',
      );
      setChallenge(verification);
      setCode('');
      setScreen('verify');
    });
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!pendingIdentity || !challenge) return;
    await run(async () => {
      const confirmed = await request<SavedIdentity>(
        `/identity/users/${pendingIdentity.id}/phone-verification/confirm`,
        'POST',
        { challengeId: challenge.challengeId, code },
      );
      remember(confirmed);
      activate(confirmed);
      setPendingIdentity(null);
      setChallenge(null);
      setPhone('');
      setCode('');
    });
  }

  async function createTestPair() {
    await run(async () => {
      const suffix = crypto.randomUUID().slice(0, 8);
      const pair: SavedIdentity[] = [];
      for (const label of ['alex', 'lea']) {
        const digits = Number.parseInt(crypto.randomUUID().slice(0, 6), 16) % 1000000;
        const created = await request<SavedIdentity>('/identity/users', 'POST', {
          username: `${label}_${suffix}`,
          phoneNumber: `+38344${String(digits).padStart(6, '0')}`,
        });
        const verification = await request<Challenge>(
          `/identity/users/${created.id}/phone-verification`,
          'POST',
        );
        const confirmed = await request<SavedIdentity>(
          `/identity/users/${created.id}/phone-verification/confirm`,
          'POST',
          { challengeId: verification.challengeId, code: verification.developmentCode },
        );
        remember(confirmed);
        await request('/directory/visibility', 'POST', { userId: confirmed.id, enabled: true });
        const account = await request<Account>('/banking/accounts', 'POST', {
          userId: confirmed.id,
        });
        await request(`/banking/accounts/${account.id}/authorize`, 'POST', {
          userId: confirmed.id,
          decision: 'APPROVE',
        });
        await request(`/banking/accounts/${account.id}/default`, 'POST', { userId: confirmed.id });
        pair.push(confirmed);
      }
      const [payer, payee] = pair;
      if (!payer || !payee)
        throw new Error('Test pair setup was incomplete. Saved identities remain available.');
      activate(payer);
      setNotice(
        `Test identities ready: @${payer.username} and @${payee.username}. Simulation only.`,
      );
    });
  }

  async function accountAction(
    account: Account,
    action: 'authorize' | 'default' | 'disconnect',
    decision?: 'APPROVE' | 'REJECT',
  ) {
    if (!identity) return;
    await run(async () => {
      await request(`/banking/accounts/${account.id}/${action}`, 'POST', {
        userId: identity.id,
        ...(decision ? { decision } : {}),
      });
      await refresh();
    });
  }

  const defaultAccount = accounts.find(
    (account) => account.isDefault && account.status === 'CONNECTED',
  );

  function startSend() {
    setIntent('send');
    setSelectedRequest(null);
    if (!defaultAccount) {
      setScreen('accounts');
      setError('Connect, authorize, and select a default Mock Bank account first.');
      return;
    }
    setQuery('');
    setAmount('');
    setRecipient(null);
    setPayment(null);
    setOutcome('SUCCESS');
    paymentKey.current = null;
    setError('');
    setNotice('');
    setScreen('send');
  }

  function startRequest() {
    setIntent('request');
    setQuery('');
    setAmount('');
    setRecipient(null);
    setSelectedRequest(null);
    paymentKey.current = null;
    setError('');
    setNotice('');
    setScreen('send');
  }

  async function createRequest() {
    if (!identity || !recipient) return;
    await run(async () => {
      const amountMinor = parseEuroMinorUnits(amount);
      if (!amountMinor) throw new Error('Enter a valid EUR amount.');
      const fingerprint = JSON.stringify(['request', identity.id, recipient.id, amountMinor]);
      if (paymentKey.current?.fingerprint !== fingerprint)
        paymentKey.current = { fingerprint, key: `web-request-${crypto.randomUUID()}` };
      const created = await request<PaymentRequest>('/payment-requests', 'POST', {
        requesterId: identity.id,
        payerId: recipient.id,
        amountMinor,
        currency: 'EUR',
        idempotencyKey: paymentKey.current.key,
      });
      setSelectedRequest(created);
      setRequests((current) => [created, ...current.filter((entry) => entry.id !== created.id)]);
      setScreen('request-detail');
    });
  }

  function openRequestPayment(entry: PaymentRequest) {
    if (!entry.payment) return;
    setPayment(entry.payment);
    setRecipient(entry.requester);
    setOutcome('SUCCESS');
    setScreen(
      entry.payerId === identity?.id && entry.payment.state === 'REQUIRES_AUTHORIZATION'
        ? 'authorize'
        : 'result',
    );
  }

  async function requestAction(action: 'accept' | 'reject' | 'cancel') {
    if (!identity || !selectedRequest) return;
    await run(async () => {
      const updated = await request<PaymentRequest>(
        `/payment-requests/${selectedRequest.id}/${action}`,
        'POST',
        { userId: identity.id },
      );
      setSelectedRequest(updated);
      setRequests((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      if (action === 'accept') openRequestPayment(updated);
    });
  }

  async function review(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (!parseEuroMinorUnits(amount))
        throw new Error('Enter a positive EUR amount with at most two decimal places.');
      const resolved = await request<SavedIdentity>(
        `/directory/resolve/${mode}`,
        'POST',
        mode === 'username'
          ? { username: query.replace(/^@/, '').trim() }
          : { phoneNumber: query.trim() },
      );
      if (resolved.id === identity?.id) throw new Error('Choose a recipient other than yourself.');
      setRecipient(resolved);
      setScreen('review');
    });
  }

  async function createPayment() {
    if (!identity || !recipient) return;
    await run(async () => {
      const amountMinor = parseEuroMinorUnits(amount);
      if (!amountMinor) throw new Error('Enter a valid EUR amount.');
      const fingerprint = JSON.stringify([identity.id, recipient.id, amountMinor]);
      if (paymentKey.current?.fingerprint !== fingerprint)
        paymentKey.current = { fingerprint, key: `web-${crypto.randomUUID()}` };
      const created = await request<Payment>('/payments', 'POST', {
        payerId: identity.id,
        payeeId: recipient.id,
        amountMinor,
        currency: 'EUR',
        idempotencyKey: paymentKey.current.key,
      });
      setPayment(created);
      setScreen(created.state === 'REQUIRES_AUTHORIZATION' ? 'authorize' : 'result');
    });
  }

  async function authorize(decision: 'APPROVE' | 'REJECT') {
    if (!identity || !payment) return;
    await run(async () => {
      const updated = await request<Payment>(`/payments/${payment.id}/authorize`, 'POST', {
        payerId: identity.id,
        decision,
        outcome,
      });
      setPayment(updated);
      setScreen('result');
      setHistory(await request<Payment[]>(`/payments?userId=${identity.id}`));
    });
  }

  function navigate(next: Screen) {
    if (next === 'send') {
      startSend();
      return;
    }
    setScreen(next);
    setError('');
    setNotice('');
    void run(refresh);
  }

  function signOut() {
    setIdentity(null);
    setAccounts([]);
    setHistory([]);
    setRequests([]);
    setSelectedRequest(null);
    setScreen('signin');
    setError('');
    setNotice('');
    try {
      localStorage.removeItem(activeKey);
    } catch {
      setNotice('This browser could not clear the saved active identity.');
    }
  }

  const displayName = (id: string) =>
    saved.find((entry) => entry.id === id)?.username ?? `Identity ${id.slice(0, 8)}`;

  function activityList(payments: Payment[]) {
    return payments.length ? (
      <div className="transaction-list">
        <div className="transaction-head">
          <span>Counterparty / date</span>
          <span>Amount</span>
          <span>Status</span>
          <span />
        </div>
        {payments.map((entry) => (
          <button
            className="transaction"
            key={entry.id}
            disabled={busy}
            onClick={() => {
              setPayment(entry);
              setRecipient(null);
              setScreen(
                entry.payerId === identity?.id && entry.state === 'REQUIRES_AUTHORIZATION'
                  ? 'authorize'
                  : 'result',
              );
            }}
          >
            <span className="transaction-person">
              <span
                className={`direction ${entry.payerId === identity?.id ? 'outgoing' : 'incoming'}`}
              >
                <Icon
                  name={entry.payerId === identity?.id ? 'arrow-up-right' : 'arrow-down-left'}
                />
              </span>
              <span>
                <strong>
                  @{displayName(entry.payerId === identity?.id ? entry.payeeId : entry.payerId)}
                </strong>
                <small>{new Date(entry.createdAt).toLocaleString()}</small>
              </span>
            </span>
            <span className="transaction-amount">
              {entry.payerId === identity?.id ? '-' : '+'}
              {formatEuro(entry.amountMinor)}
            </span>
            <StateBadge state={entry.state} />
            <Icon name="chevron-right" />
          </button>
        ))}
      </div>
    ) : (
      <div className="empty-state">
        <Icon name="receipt-text" />
        <h3>No simulated activity yet</h3>
        <p>Mock Bank transactions will appear here.</p>
        <Button icon="arrow-up-right" disabled={busy} onClick={startSend}>
          New simulation
        </Button>
      </div>
    );
  }

  if (!ready)
    return (
      <div className="opening" role="status">
        Opening KLIKS...
      </div>
    );

  return (
    <div className="workspace">
      <aside className={`sidebar ${!identity ? 'signed-out-sidebar' : ''}`}>
        <a className="brand" href="/" aria-label="KLIKS home">
          <span className="brand-mark">k</span>
          <span className="brand-name">
            KLIKS<span>.</span>
          </span>
        </a>
        <span className="environment">
          <span /> DEVELOPMENT
        </span>
        {identity ? (
          <>
            <nav aria-label="Main navigation">
              {(
                [
                  ['overview', 'layout-dashboard', 'Overview'],
                  ['send', 'arrow-up-right', 'Send'],
                  ['requests', 'arrow-down-left', 'Requests'],
                  ['activity', 'receipt-text', 'Activity'],
                  ['accounts', 'landmark', 'Bank accounts'],
                ] as const
              ).map(([target, icon, label]) => (
                <button
                  key={target}
                  disabled={busy}
                  className={
                    (screen === target && (target !== 'send' || intent === 'send')) ||
                    (target === 'send' &&
                      intent === 'send' &&
                      ['review', 'authorize', 'result'].includes(screen)) ||
                    (target === 'requests' &&
                      (screen === 'request-detail' ||
                        (intent === 'request' && ['send', 'review'].includes(screen))))
                      ? 'nav-item selected'
                      : 'nav-item'
                  }
                  onClick={() => navigate(target)}
                >
                  <Icon name={icon} />
                  {label}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <label htmlFor="identity-switch">Active development identity</label>
              <select
                id="identity-switch"
                disabled={busy}
                value={identity.id}
                onChange={(event) => {
                  const selected = saved.find((entry) => entry.id === event.target.value);
                  if (selected) activate(selected);
                }}
              >
                {saved.map((entry) => (
                  <option value={entry.id} key={entry.id}>
                    @{entry.username}
                  </option>
                ))}
              </select>
              <button className="nav-item" disabled={busy} onClick={signOut}>
                <Icon name="log-out" />
                Switch / create identity
              </button>
            </div>
          </>
        ) : (
          <div className="sidebar-bottom">
            <p className="sidebar-slogan">
              Veç kliko.
              <br />U kry.
            </p>
            <small>KOSOVO / EUR</small>
          </div>
        )}
      </aside>

      <div className="workspace-body">
        <header className="workspace-header">
          <span>{identity ? `@${identity.username}` : 'Development sign-in'}</span>
          <span className="header-meta">
            <span className="status-dot" />
            LOCAL PREVIEW
          </span>
        </header>
        <div className="safety-banner">
          <Icon name="flask-conical" />
          <span>
            <strong>Simulation only.</strong> No real money moves. Mock Bank is development-only.
          </span>
        </div>
        <main className="workspace-main" aria-busy={busy}>
          {error && (
            <div role="alert" className="message error">
              <Icon name="circle-alert" />
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="message success">
              <Icon name="circle-check" />
              {notice}
            </div>
          )}
          {busy && (
            <div className="working" role="status">
              Working...
            </div>
          )}

          {screen === 'signin' && (
            <div className="signin-layout">
              <section>
                <SectionTitle eyebrow="KLIKS / DEVELOPMENT" title="Your people. Your bank." />
                <div className="signin-form">
                  <h2>Create a development identity</h2>
                  <p className="muted">
                    Development-only verification. Not production authentication.
                  </p>
                  <form onSubmit={createIdentity}>
                    <label>
                      Username
                      <input
                        autoComplete="off"
                        required
                        minLength={3}
                        maxLength={30}
                        pattern="[A-Za-z0-9_]+"
                        value={username}
                        disabled={busy || !!pendingIdentity}
                        onChange={(event) => setUsername(event.target.value)}
                        placeholder="e.g. alex_test"
                      />
                    </label>
                    <label>
                      Test phone number
                      <input
                        type="tel"
                        autoComplete="off"
                        required
                        value={phone}
                        disabled={busy || !!pendingIdentity}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+38344XXXXXX"
                      />
                    </label>
                    <Button icon="arrow-right" disabled={busy} type="submit">
                      {pendingIdentity ? 'Retry verification challenge' : 'Continue'}
                    </Button>
                  </form>
                  {pendingIdentity && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        setPendingIdentity(null);
                        setUsername('');
                        setPhone('');
                      }}
                    >
                      Use another identity
                    </button>
                  )}
                </div>
              </section>
              <section className="test-identities">
                <div className="section-heading">
                  <h2>Local test identities</h2>
                  <Icon name="users" />
                </div>
                {saved.length ? (
                  <div className="identity-list">
                    {saved.map((entry) => (
                      <button key={entry.id} disabled={busy} onClick={() => activate(entry)}>
                        <span className="avatar">{entry.username.slice(0, 1).toUpperCase()}</span>
                        <span>
                          <strong>@{entry.username}</strong>
                          <small>Saved on this browser</small>
                        </span>
                        <Icon name="arrow-right" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No saved identities.</p>
                )}
                <Button
                  icon="users"
                  secondary
                  disabled={busy}
                  onClick={() => void createTestPair()}
                >
                  Create test pair
                </Button>
                <p className="fine-print">
                  Test pair: two discoverable development identities with authorized Mock Bank
                  accounts. No real bank connection.
                </p>
              </section>
            </div>
          )}

          {screen === 'verify' && challenge && pendingIdentity && (
            <section className="flow-section">
              <SectionTitle eyebrow="DEVELOPMENT VERIFICATION" title="Verify your test identity" />
              <p className="muted">@{pendingIdentity.username}</p>
              <div className="verification-code">
                <span>Development code</span>
                <strong>{challenge.developmentCode}</strong>
                <small>Expires {new Date(challenge.expiresAt).toLocaleTimeString()}</small>
              </div>
              <form onSubmit={verify}>
                <label>
                  Verification code
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                </label>
                <Button icon="check" disabled={busy}>
                  Verify identity
                </Button>
              </form>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setScreen('signin');
                  setCode('');
                }}
              >
                Back / request another code
              </button>
            </section>
          )}

          {identity && screen === 'overview' && (
            <>
              <SectionTitle
                eyebrow="YOUR WORKSPACE"
                title={`Hello, ${identity.username}.`}
                action={
                  <Button icon="arrow-up-right" disabled={busy} onClick={startSend}>
                    New simulation
                  </Button>
                }
              />
              <div className="overview-summary">
                <section className="bank-summary">
                  <div className="summary-icon">
                    <Icon name="landmark" />
                  </div>
                  <div>
                    <p className="eyebrow">DEFAULT PAYMENT ACCOUNT</p>
                    <h2>{defaultAccount?.displayName ?? 'No default account'}</h2>
                    <p className="muted">
                      {defaultAccount ? 'Mock Bank / connected / EUR' : 'Mock Bank / not ready'}
                    </p>
                  </div>
                  <Button
                    secondary
                    icon="arrow-right"
                    disabled={busy}
                    onClick={() => navigate('accounts')}
                  >
                    Manage
                  </Button>
                </section>
                <section className="directory-section">
                  <Icon name="contact-round" />
                  <h2>Recipient discovery</h2>
                  <label className="visibility-control">
                    <input
                      type="checkbox"
                      aria-label="Visible to recipient lookup"
                      aria-checked={visibility === null ? 'mixed' : visibility}
                      checked={visibility === true}
                      ref={(element) => {
                        if (element) element.indeterminate = visibility === null;
                      }}
                      disabled={busy}
                      onChange={(event) => {
                        const enabled = event.target.checked;
                        void run(async () => {
                          await request('/directory/visibility', 'POST', {
                            userId: identity.id,
                            enabled,
                          });
                          setVisibility(enabled);
                        });
                      }}
                    />
                    <span>Visible to recipient lookup</span>
                  </label>
                  {visibility === null && (
                    <p className="fine-print">Visibility not confirmed in this session.</p>
                  )}
                </section>
              </div>
              <section className="activity-section">
                <div className="section-heading">
                  <h2>
                    Recent activity <span className="count">{history.length}</span>
                  </h2>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => navigate('activity')}
                  >
                    View all activity <Icon name="arrow-right" />
                  </button>
                </div>
                {activityList(history.slice(0, 5))}
              </section>
            </>
          )}

          {identity && screen === 'accounts' && (
            <>
              <SectionTitle
                eyebrow="BANKING / SIMULATED"
                title="Bank accounts"
                action={
                  <Button
                    icon="plus"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await request('/banking/accounts', 'POST', { userId: identity.id });
                        await refresh();
                      })
                    }
                  >
                    Connect Mock Bank
                  </Button>
                }
              />
              <div className="accounts-list">
                {accounts.length ? (
                  accounts.map((account) => (
                    <article className="account-row" key={account.id}>
                      <div className="account-info">
                        <span className="bank-symbol">
                          <Icon name="landmark" />
                        </span>
                        <div>
                          <h2>{account.displayName}</h2>
                          <span className="muted">Mock Bank / simulation only</span>
                          <div className="account-status">
                            <StateBadge state={account.status} />
                            {account.isDefault && <span className="default-label">Default</span>}
                          </div>
                        </div>
                      </div>
                      <div className="account-actions">
                        {account.status === 'PENDING_AUTHORIZATION' && (
                          <>
                            <Button
                              icon="check"
                              disabled={busy}
                              onClick={() => void accountAction(account, 'authorize', 'APPROVE')}
                            >
                              Authorize
                            </Button>
                            <Button
                              secondary
                              icon="x"
                              disabled={busy}
                              onClick={() => void accountAction(account, 'authorize', 'REJECT')}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {account.status === 'CONNECTED' && (
                          <>
                            {!account.isDefault && (
                              <Button
                                secondary
                                icon="star"
                                disabled={busy}
                                onClick={() => void accountAction(account, 'default')}
                              >
                                Set default
                              </Button>
                            )}
                            <button
                              className="icon-button"
                              title="Disconnect account"
                              aria-label={`Disconnect ${account.displayName}`}
                              disabled={busy}
                              onClick={() => void accountAction(account, 'disconnect')}
                            >
                              <Icon name="unplug" />
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <Icon name="landmark" />
                    <h3>No linked accounts</h3>
                    <p>No real bank account or credentials are required.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {identity && screen === 'send' && (
            <section className="flow-section">
              <SectionTitle
                eyebrow={intent === 'request' ? '01 / SIMULATED REQUEST' : '01 / SIMULATED PAYMENT'}
                title={
                  intent === 'request' ? 'Who are you requesting from?' : 'Who are you paying?'
                }
              />
              <form onSubmit={review}>
                <fieldset className="segmented">
                  <legend className="sr-only">Recipient lookup mode</legend>
                  {(['username', 'phone'] as const).map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="lookup-mode"
                        value={value}
                        checked={mode === value}
                        onChange={() => {
                          setMode(value);
                          setQuery('');
                        }}
                      />
                      <span>{value === 'username' ? 'Username' : 'Phone number'}</span>
                    </label>
                  ))}
                </fieldset>
                <label>
                  {intent === 'request'
                    ? mode === 'username'
                      ? 'Payer username'
                      : 'Payer phone number'
                    : mode === 'username'
                      ? 'Recipient username'
                      : 'Recipient phone number'}
                  <input
                    required
                    autoComplete="off"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={mode === 'username' ? '@username' : '+38344XXXXXX'}
                  />
                </label>
                {mode === 'username' && saved.some((entry) => entry.id !== identity.id) && (
                  <label>
                    Saved test recipient
                    <select value="" onChange={(event) => setQuery(event.target.value)}>
                      <option value="">Choose a local identity</option>
                      {saved
                        .filter((entry) => entry.id !== identity.id)
                        .map((entry) => (
                          <option key={entry.id} value={entry.username}>
                            @{entry.username}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label>
                  Amount (EUR)
                  <input
                    className="amount-input"
                    required
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                  />
                </label>
                <div className="flow-actions">
                  <Button icon="arrow-right" disabled={busy}>
                    {intent === 'request' ? 'Review request' : 'Review simulation'}
                  </Button>
                  <Button
                    type="button"
                    secondary
                    disabled={busy}
                    onClick={() => navigate('overview')}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </section>
          )}

          {screen === 'review' && recipient && (
            <section className="flow-section">
              <SectionTitle
                eyebrow="02 / REVIEW"
                title={intent === 'request' ? 'Review payment request' : 'Check the details'}
              />
              <dl className="payment-details">
                <div>
                  <dt>{intent === 'request' ? 'Verified payer' : 'Verified recipient'}</dt>
                  <dd>
                    @{recipient.username}
                    <span className="verified">
                      <Icon name="badge-check" />
                      Phone verified
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd className="large-amount">{formatEuro(parseEuroMinorUnits(amount) ?? 0)}</dd>
                </div>
                <div>
                  <dt>{intent === 'request' ? 'Requested by' : 'From'}</dt>
                  <dd>
                    {intent === 'request'
                      ? `@${identity?.username}`
                      : (defaultAccount?.displayName ?? 'Mock Bank')}
                  </dd>
                </div>
                <div>
                  <dt>Payment type</dt>
                  <dd>Simulated / no real money</dd>
                </div>
              </dl>
              <div className="flow-actions">
                <Button
                  icon="arrow-right"
                  disabled={busy}
                  onClick={() => void (intent === 'request' ? createRequest() : createPayment())}
                >
                  {intent === 'request' ? 'Create payment request' : 'Continue to Mock Bank'}
                </Button>
                <Button secondary disabled={busy} onClick={() => setScreen('send')}>
                  Edit details
                </Button>
              </div>
            </section>
          )}

          {identity && screen === 'authorize' && payment && (
            <section className="flow-section">
              <SectionTitle eyebrow="03 / MOCK BANK" title="Authorize simulation" />
              <dl className="payment-details">
                <div>
                  <dt>Recipient</dt>
                  <dd>
                    @
                    {recipient?.id === payment.payeeId
                      ? recipient.username
                      : displayName(payment.payeeId)}
                  </dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd className="large-amount">{formatEuro(payment.amountMinor)}</dd>
                </div>
                <div>
                  <dt>Current state</dt>
                  <dd>
                    <StateBadge state={payment.state} />
                  </dd>
                </div>
              </dl>
              <label>
                Simulated outcome
                <select
                  value={outcome}
                  disabled={busy}
                  onChange={(event) => setOutcome(event.target.value as Outcome)}
                >
                  <option value="SUCCESS">Success</option>
                  <option value="PENDING">Pending / processing</option>
                  <option value="INSUFFICIENT_FUNDS">Insufficient funds</option>
                  <option value="PROVIDER_FAILURE">Provider failure</option>
                </select>
              </label>
              <div className="flow-actions">
                <Button icon="check" disabled={busy} onClick={() => void authorize('APPROVE')}>
                  Authorize simulation
                </Button>
                <Button secondary icon="x" disabled={busy} onClick={() => void authorize('REJECT')}>
                  Reject simulation
                </Button>
              </div>
            </section>
          )}

          {identity && screen === 'result' && payment && (
            <section className="flow-section">
              <div className={`result-symbol ${payment.state === 'SUCCEEDED' ? 'positive' : ''}`}>
                <Icon
                  name={
                    payment.state === 'SUCCEEDED'
                      ? 'circle-check'
                      : payment.state === 'PROCESSING'
                        ? 'clock-3'
                        : 'circle-alert'
                  }
                />
              </div>
              <SectionTitle
                eyebrow="SIMULATION RESULT"
                title={
                  payment.state === 'SUCCEEDED'
                    ? 'Simulation succeeded'
                    : payment.state === 'PROCESSING'
                      ? 'Still processing'
                      : payment.state === 'REQUIRES_AUTHORIZATION'
                        ? 'Awaiting authorization'
                        : payment.state === 'REJECTED'
                          ? 'Simulation rejected'
                          : payment.state === 'FAILED'
                            ? 'Simulation failed'
                            : payment.state === 'CANCELLED'
                              ? 'Simulation cancelled'
                              : 'Simulation created'
                }
              />
              <dl className="payment-details">
                <div>
                  <dt>Amount</dt>
                  <dd className="large-amount">{formatEuro(payment.amountMinor)}</dd>
                </div>
                <div>
                  <dt>From</dt>
                  <dd>@{displayName(payment.payerId)}</dd>
                </div>
                <div>
                  <dt>To</dt>
                  <dd>
                    @
                    {recipient?.id === payment.payeeId
                      ? recipient.username
                      : displayName(payment.payeeId)}
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <StateBadge state={payment.state} />
                  </dd>
                </div>
                {payment.failureCode && (
                  <div>
                    <dt>Failure reason</dt>
                    <dd>{payment.failureCode.replaceAll('_', ' ')}</dd>
                  </div>
                )}
                <div>
                  <dt>Reference</dt>
                  <dd className="reference">{payment.id}</dd>
                </div>
              </dl>
              <div className="flow-actions">
                <Button icon="receipt-text" disabled={busy} onClick={() => navigate('activity')}>
                  View activity
                </Button>
                <Button
                  secondary
                  icon="refresh-cw"
                  disabled={busy}
                  onClick={() => void run(refresh)}
                >
                  Refresh status
                </Button>
              </div>
            </section>
          )}

          {identity && screen === 'requests' && (
            <>
              <SectionTitle
                eyebrow="SIMULATED / PAYMENT REQUESTS"
                title="Requests"
                action={
                  <div className="flow-actions">
                    <button
                      className="icon-button"
                      title="Refresh requests"
                      aria-label="Refresh requests"
                      disabled={busy}
                      onClick={() => void run(refresh)}
                    >
                      <Icon name="refresh-cw" />
                    </button>
                    <Button icon="plus" disabled={busy} onClick={startRequest}>
                      New request
                    </Button>
                  </div>
                }
              />
              <div className="request-tabs" role="tablist" aria-label="Request direction">
                {(['incoming', 'outgoing'] as const).map((tab) => (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={requestTab === tab}
                    onClick={() => setRequestTab(tab)}
                  >
                    {tab === 'incoming' ? 'Incoming' : 'Outgoing'}{' '}
                    <span className="count">
                      {
                        requests.filter(
                          (entry) =>
                            (tab === 'incoming' ? entry.payerId : entry.requesterId) ===
                            identity.id,
                        ).length
                      }
                    </span>
                  </button>
                ))}
              </div>
              <div
                role="tabpanel"
                aria-label={requestTab === 'incoming' ? 'Incoming requests' : 'Outgoing requests'}
              >
                {requests
                  .filter(
                    (entry) =>
                      (requestTab === 'incoming' ? entry.payerId : entry.requesterId) ===
                      identity.id,
                  )
                  .map((entry) => (
                    <button
                      className="transaction request-row"
                      key={entry.id}
                      disabled={busy}
                      onClick={() => {
                        setSelectedRequest(entry);
                        setScreen('request-detail');
                        setError('');
                      }}
                    >
                      <span className="transaction-person">
                        <span className="direction">
                          <Icon
                            name={requestTab === 'incoming' ? 'arrow-down-left' : 'arrow-up-right'}
                          />
                        </span>
                        <span>
                          <strong>
                            @
                            {requestTab === 'incoming'
                              ? entry.requester.username
                              : entry.payer.username}
                          </strong>
                          <small>{new Date(entry.createdAt).toLocaleString()}</small>
                        </span>
                      </span>
                      <span className="transaction-amount">{formatEuro(entry.amountMinor)}</span>
                      <span className="request-status">
                        <StateBadge state={entry.state} />
                        {entry.payment && (
                          <span>
                            Payment: {entry.payment.state.replaceAll('_', ' ').toLowerCase()}
                          </span>
                        )}
                      </span>
                      <Icon name="chevron-right" />
                    </button>
                  ))}
                {!requests.some(
                  (entry) =>
                    (requestTab === 'incoming' ? entry.payerId : entry.requesterId) === identity.id,
                ) && (
                  <div className="empty-state">
                    <Icon name="inbox" />
                    <h3>No {requestTab} requests</h3>
                  </div>
                )}
              </div>
            </>
          )}

          {identity && screen === 'request-detail' && selectedRequest && (
            <section className="flow-section">
              <SectionTitle eyebrow="SIMULATED PAYMENT REQUEST" title="Request details" />
              <dl className="payment-details">
                <div>
                  <dt>Requested by</dt>
                  <dd>@{selectedRequest.requester.username}</dd>
                </div>
                <div>
                  <dt>Payer</dt>
                  <dd>@{selectedRequest.payer.username}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd className="large-amount">{formatEuro(selectedRequest.amountMinor)}</dd>
                </div>
                <div>
                  <dt>Request status</dt>
                  <dd>
                    <StateBadge state={selectedRequest.state} />
                  </dd>
                </div>
                <div>
                  <dt>Payment status</dt>
                  <dd>
                    {selectedRequest.payment ? (
                      <StateBadge state={selectedRequest.payment.state} />
                    ) : (
                      'No payment created'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Reference</dt>
                  <dd className="reference">{selectedRequest.id}</dd>
                </div>
              </dl>
              <div className="flow-actions">
                {selectedRequest.state === 'PENDING' && selectedRequest.payerId === identity.id && (
                  <>
                    <Button
                      icon="check"
                      disabled={busy}
                      onClick={() => void requestAction('accept')}
                    >
                      Accept request
                    </Button>
                    <Button
                      secondary
                      icon="x"
                      disabled={busy}
                      onClick={() => void requestAction('reject')}
                    >
                      Reject request
                    </Button>
                  </>
                )}
                {selectedRequest.state === 'PENDING' &&
                  selectedRequest.requesterId === identity.id && (
                    <Button
                      secondary
                      icon="x"
                      disabled={busy}
                      onClick={() => void requestAction('cancel')}
                    >
                      Cancel request
                    </Button>
                  )}
                {selectedRequest.payment && (
                  <Button
                    icon="arrow-right"
                    disabled={busy}
                    onClick={() => openRequestPayment(selectedRequest)}
                  >
                    {selectedRequest.payerId === identity.id &&
                    selectedRequest.payment.state === 'REQUIRES_AUTHORIZATION'
                      ? 'Continue authorization'
                      : 'View payment'}
                  </Button>
                )}
                <Button
                  secondary
                  icon="refresh-cw"
                  disabled={busy}
                  onClick={() => void run(refresh)}
                >
                  Refresh request
                </Button>
                <Button secondary disabled={busy} onClick={() => navigate('requests')}>
                  Back to requests
                </Button>
              </div>
            </section>
          )}

          {identity && screen === 'activity' && (
            <>
              <SectionTitle
                eyebrow="SIMULATED TRANSACTIONS"
                title="Activity"
                action={
                  <button
                    className="icon-button"
                    title="Refresh activity"
                    aria-label="Refresh activity"
                    disabled={busy}
                    onClick={() => void run(refresh)}
                  >
                    <Icon name="refresh-cw" />
                  </button>
                }
              />
              {activityList(history)}
            </>
          )}
        </main>
        <footer className="workspace-footer">
          <span>KLIKS never holds your balance.</span>
          <span>DEVELOPMENT ONLY / EUR</span>
        </footer>
      </div>
    </div>
  );
}
