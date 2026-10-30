'use client';

import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { parseMerchantQrPayload, parseQrPaymentPayload } from '@kliks/shared';
import Icon from './ui-icon';
import { formatEuro, parseEuroMinorUnits, type SavedIdentity } from './payment-utils';
import type { Payment } from './workspace';

type Api = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
interface QrSession {
  id: string;
  recipient: SavedIdentity;
  amountMinor: number | null;
  currency: 'EUR';
  state: 'AVAILABLE' | 'EXPIRED' | 'USED' | 'UNAVAILABLE';
  expiresAt: string;
  createdAt: string;
  paymentId: string | null;
}
interface QrCode extends QrSession {
  payload: string;
  imageDataUrl: string;
}
interface QrPreview {
  merchant?: { id: string; displayName: string } | null;
  payload?: string;
  id: string;
  recipient: SavedIdentity;
  amountMinor: number | null;
  currency: 'EUR';
  expiresAt: string;
}

function amountInput(amountMinor: number): string {
  const digits = String(amountMinor).padStart(3, '0');
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

export default function QrPayments({
  identity,
  api,
  onPayment,
  onBusyChange,
}: {
  identity: SavedIdentity;
  api: Api;
  onPayment: (payment: Payment, recipient: SavedIdentity) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [tab, setTab] = useState<'receive' | 'scan'>('receive');
  const [codes, setCodes] = useState<QrSession[]>([]);
  const [code, setCode] = useState<QrCode | null>(null);
  const [proposedAmount, setProposedAmount] = useState('');
  const [payload, setPayload] = useState('');
  const [preview, setPreview] = useState<QrPreview | null>(null);
  const [amount, setAmount] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [camera, setCamera] = useState(false);
  const [now, setNow] = useState(Date.now());
  const active = useRef(false);
  const key = useRef<{ fingerprint: string; key: string } | null>(null);
  const checkoutKey = useRef<{ payload: string; key: string } | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let mounted = true;
    api<QrSession[]>(`/qr-payments?userId=${identity.id}`)
      .then((result) => {
        if (mounted) setCodes(result);
      })
      .catch((failure) => {
        if (mounted)
          setError(failure instanceof Error ? failure.message : 'Could not load QR codes.');
      });
    return () => {
      mounted = false;
    };
  }, [api, identity.id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function run(action: () => Promise<void>) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    onBusyChange(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not complete the QR action.');
    } finally {
      active.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  async function resolve(value: string) {
    setCamera(false);
    setPreview(null);
    setReviewing(false);
    await run(async () => {
      const merchantId = parseMerchantQrPayload(value);
      if (!parseQrPaymentPayload(value) && !merchantId)
        throw new Error('Unsupported QR code. Only KLIKS payment QR codes are accepted.');
      if (merchantId && checkoutKey.current?.payload !== value)
        checkoutKey.current = { payload: value, key: `web-checkout-${crypto.randomUUID()}` };
      const result = await api<QrPreview>(
        merchantId ? '/merchants/checkout' : '/qr-payments/resolve',
        'POST',
        {
          payload: value,
          payerId: identity.id,
          ...(merchantId ? { idempotencyKey: checkoutKey.current?.key } : {}),
        },
      );
      setPayload(result.payload ?? value);
      setPreview(result);
      setAmount(result.amountMinor === null ? '' : amountInput(result.amountMinor));
    });
  }

  const decoded = useEffectEvent((value: string) => {
    setPayload(value);
    void resolve(value);
  });

  useEffect(() => {
    if (!camera || tab !== 'scan' || !video.current) return;
    let mounted = true;
    let controls: IScannerControls | undefined;
    const element = video.current;
    void import('@zxing/browser')
      .then(async ({ BrowserQRCodeReader }) => {
        if (!mounted) return;
        controls = await new BrowserQRCodeReader().decodeFromVideoDevice(
          undefined,
          element,
          (result, _failure, scanner) => {
            if (result && mounted) {
              mounted = false;
              scanner.stop();
              decoded(result.getText());
            }
          },
        );
        if (!mounted) controls.stop();
      })
      .catch(() => {
        if (mounted) {
          setCamera(false);
          setError(
            'Camera unavailable. Upload a QR image or paste its payload. Camera access requires localhost or HTTPS.',
          );
        }
      });
    return () => {
      mounted = false;
      controls?.stop();
    };
  }, [camera, tab]);

  async function generate(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const amountMinor = proposedAmount.trim() ? parseEuroMinorUnits(proposedAmount) : undefined;
      if (proposedAmount.trim() && !amountMinor)
        throw new Error('Enter a positive EUR amount with at most two decimal places.');
      const fingerprint = String(amountMinor ?? 'open');
      if (key.current?.fingerprint !== fingerprint)
        key.current = { fingerprint, key: `web-qr-${crypto.randomUUID()}` };
      const generated = await api<QrCode>('/qr-payments', 'POST', {
        ownerId: identity.id,
        currency: 'EUR',
        ...(amountMinor === undefined ? {} : { amountMinor }),
        idempotencyKey: key.current.key,
      });
      key.current = null;
      setCode(generated);
      setNow(Date.now());
      setCodes((current) => [generated, ...current.filter((entry) => entry.id !== generated.id)]);
    });
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setCamera(false);
    setPreview(null);
    setReviewing(false);
    setError('');
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      const value = result.getText();
      setPayload(value);
      await resolve(value);
    } catch {
      setError('No readable KLIKS QR code was found in that image.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function refresh() {
    await run(async () => {
      setCodes(await api<QrSession[]>(`/qr-payments?userId=${identity.id}`));
      if (code) setCode(await api<QrCode>(`/qr-payments/${code.id}?userId=${identity.id}`));
      setNow(Date.now());
    });
  }

  const codeState =
    code?.state === 'AVAILABLE' && new Date(code.expiresAt).getTime() <= now
      ? 'EXPIRED'
      : code?.state;
  const expired = preview ? new Date(preview.expiresAt).getTime() <= now : false;

  return (
    <section className="qr-workspace">
      <div className="section-title">
        <div>
          <p className="eyebrow">SIMULATED / SINGLE-USE</p>
          <h1>QR payments</h1>
        </div>
        <button
          className="icon-button"
          title="Refresh QR codes"
          aria-label="Refresh QR codes"
          disabled={busy}
          onClick={() => void refresh()}
        >
          <Icon name="refresh-cw" />
        </button>
      </div>
      <div className="request-tabs" role="tablist" aria-label="QR mode">
        <button
          role="tab"
          aria-selected={tab === 'receive'}
          onClick={() => {
            setTab('receive');
            setCamera(false);
          }}
        >
          My codes
        </button>
        <button role="tab" aria-selected={tab === 'scan'} onClick={() => setTab('scan')}>
          Scan / pay
        </button>
      </div>
      {error && (
        <div className="message error" role="alert">
          <Icon name="circle-alert" />
          {error}
        </div>
      )}
      {busy && (
        <p className="working" role="status">
          Working...
        </p>
      )}
      {tab === 'receive' ? (
        <>
          <div className="qr-generate-layout">
            <div className="qr-image-area">
              {code ? (
                <>
                  <img
                    className="qr-image"
                    src={code.imageDataUrl}
                    alt={`Payment QR for @${code.recipient.username}`}
                    width="320"
                    height="320"
                  />
                  <span className={`state state-${codeState?.toLowerCase()}`}>
                    {codeState?.toLowerCase()}
                  </span>
                </>
              ) : (
                <div className="qr-placeholder">
                  <Icon name="qr-code" />
                  <span>No code selected</span>
                </div>
              )}
            </div>
            <div>
              <h2>@{identity.username}</h2>
              <form onSubmit={generate}>
                <label>
                  Proposed amount (EUR, optional)
                  <input
                    inputMode="decimal"
                    value={proposedAmount}
                    onChange={(event) => setProposedAmount(event.target.value)}
                    placeholder="Any amount"
                  />
                </label>
                <button className="action" disabled={busy}>
                  <Icon name="plus" />
                  Generate QR
                </button>
              </form>
              {code && (
                <>
                  <dl className="payment-details qr-metadata">
                    <div>
                      <dt>Amount</dt>
                      <dd>
                        {code.amountMinor === null
                          ? 'Chosen by payer'
                          : formatEuro(code.amountMinor)}
                      </dd>
                    </div>
                    <div>
                      <dt>Expires</dt>
                      <dd>{new Date(code.expiresAt).toLocaleString()}</dd>
                    </div>
                  </dl>
                  <label>
                    QR payload
                    <input readOnly value={code.payload} />
                  </label>
                  <div className="flow-actions">
                    <a
                      className="icon-button"
                      href={code.imageDataUrl}
                      download="kliks-qr.png"
                      title="Download QR image"
                      aria-label="Download QR image"
                    >
                      <Icon name="download" />
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="section-heading">
            <h2>Recent codes</h2>
          </div>
          {codes.map((entry) => (
            <button
              key={entry.id}
              className="qr-code-row"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setCode(await api<QrCode>(`/qr-payments/${entry.id}?userId=${identity.id}`));
                })
              }
            >
              <span>
                <strong>
                  {entry.amountMinor === null ? 'Open amount' : formatEuro(entry.amountMinor)}
                </strong>
                <small>{new Date(entry.createdAt).toLocaleString()}</small>
              </span>
              <span className="state">
                {entry.state === 'AVAILABLE' && new Date(entry.expiresAt).getTime() <= now
                  ? 'expired'
                  : entry.state.toLowerCase()}
              </span>
              <Icon name="chevron-right" />
            </button>
          ))}
        </>
      ) : preview ? (
        <div className="flow-section">
          <h2>{reviewing ? 'Confirm QR payment' : 'Resolved recipient'}</h2>
          {preview.merchant && (
            <p className="merchant-recipient">Merchant: {preview.merchant.displayName}</p>
          )}
          <dl className="payment-details">
            <div>
              <dt>Recipient</dt>
              <dd>
                @{preview.recipient.username}
                <span className="verified">
                  <Icon name="badge-check" />
                  Phone verified
                </span>
              </dd>
            </div>
            <div>
              <dt>Expires</dt>
              <dd>{new Date(preview.expiresAt).toLocaleString()}</dd>
            </div>
            {reviewing && (
              <div>
                <dt>Amount</dt>
                <dd className="large-amount">{formatEuro(parseEuroMinorUnits(amount) ?? 0)}</dd>
              </div>
            )}
          </dl>
          {expired && (
            <div className="message error" role="alert">
              This QR code has expired.
            </div>
          )}
          {!reviewing ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!parseEuroMinorUnits(amount)) {
                  setError('Enter a positive EUR amount with at most two decimal places.');
                  return;
                }
                setError('');
                setReviewing(true);
              }}
            >
              <label>
                QR payment amount (EUR)
                <input
                  className="amount-input"
                  required
                  inputMode="decimal"
                  value={amount}
                  readOnly={preview.amountMinor !== null}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
              <button className="action" disabled={busy || expired}>
                <Icon name="arrow-right" />
                Review QR payment
              </button>
            </form>
          ) : (
            <div className="flow-actions">
              <button
                className="action"
                disabled={busy || expired}
                onClick={() =>
                  void run(async () => {
                    const amountMinor = parseEuroMinorUnits(amount);
                    if (!amountMinor) throw new Error('Enter a valid EUR amount.');
                    const payment = await api<Payment>('/qr-payments/pay', 'POST', {
                      payload,
                      payerId: identity.id,
                      amountMinor,
                    });
                    onPayment(payment, preview.recipient);
                  })
                }
              >
                <Icon name="arrow-right" />
                Continue to Mock Bank
              </button>
              <button
                className="action secondary"
                disabled={busy}
                onClick={() => setReviewing(false)}
              >
                Edit amount
              </button>
            </div>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              setPreview(null);
              setReviewing(false);
              setPayload('');
              checkoutKey.current = null;
            }}
          >
            Scan another code
          </button>
        </div>
      ) : (
        <div className="qr-scan-layout">
          <div>
            <h2>Scan a payment QR</h2>
            {camera && (
              <video
                ref={video}
                className="qr-camera"
                autoPlay
                playsInline
                muted
                aria-label="QR camera preview"
              />
            )}
            <button
              className="action secondary"
              disabled={busy}
              onClick={() => {
                setError('');
                setCamera((current) => !current);
              }}
            >
              <Icon name={camera ? 'camera-off' : 'camera'} />
              {camera ? 'Stop camera' : 'Start camera'}
            </button>
            <label>
              QR image
              <input
                aria-label="QR image"
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(event) => {
                  void upload(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void resolve(payload);
            }}
          >
            <label>
              QR payload
              <input
                required
                value={payload}
                onChange={(event) => setPayload(event.target.value)}
                placeholder="kliks:pay:v1:..."
                autoComplete="off"
              />
            </label>
            <button className="action" disabled={busy}>
              <Icon name="scan-line" />
              Resolve QR
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
