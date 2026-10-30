import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parseQrPaymentPayload } from '@kliks/shared';
import type { Payment } from './App';

type Api = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
interface Recipient {
  id: string;
  username: string;
  phoneVerified: true;
  createdAt: string;
}
interface Session {
  id: string;
  amountMinor: number | null;
  state: 'AVAILABLE' | 'EXPIRED' | 'USED' | 'UNAVAILABLE';
  expiresAt: string;
  createdAt: string;
}
interface Code extends Session {
  payload: string;
  imageDataUrl: string;
}
interface Preview {
  id: string;
  recipient: Recipient;
  amountMinor: number | null;
  expiresAt: string;
}

function amountText(amountMinor: number) {
  const digits = String(amountMinor).padStart(3, '0');
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
function parseAmount(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  const [whole, fraction = ''] = normalized.split('.');
  const amount = Number(`${whole}${fraction.padEnd(2, '0')}`);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined;
}
function Action({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

export default function QrPaymentsScreen({
  identity,
  api,
  onBack,
  onPayment,
  onBusyChange,
}: {
  identity: { id: string; username: string };
  api: Api;
  onBack: () => void;
  onPayment: (payment: Payment, recipient: Recipient) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [tab, setTab] = useState<'receive' | 'scan'>('receive');
  const [codes, setCodes] = useState<Session[]>([]);
  const [code, setCode] = useState<Code | null>(null);
  const [proposed, setProposed] = useState('');
  const [payload, setPayload] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [amount, setAmount] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [camera, setCamera] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const inFlight = useRef(false);
  const scanned = useRef(false);
  const key = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    let active = true;
    api<Session[]>(`/qr-payments?userId=${identity.id}`)
      .then((result) => {
        if (active) setCodes(result);
      })
      .catch((failure) => {
        if (active)
          setError(failure instanceof Error ? failure.message : 'Could not load QR codes.');
      });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [api, identity.id]);

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    onBusyChange(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'QR action failed.');
    } finally {
      inFlight.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  async function generate() {
    await run(async () => {
      const amountMinor = proposed.trim() ? parseAmount(proposed) : undefined;
      if (proposed.trim() && !amountMinor)
        throw new Error('Enter a positive EUR amount with at most two decimal places.');
      const fingerprint = String(amountMinor ?? 'open');
      if (key.current?.fingerprint !== fingerprint)
        key.current = {
          fingerprint,
          key: `mobile-qr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`,
        };
      const created = await api<Code>('/qr-payments', 'POST', {
        ownerId: identity.id,
        currency: 'EUR',
        ...(amountMinor === undefined ? {} : { amountMinor }),
        idempotencyKey: key.current.key,
      });
      key.current = null;
      setCode(created);
      setCodes((current) => [created, ...current.filter((entry) => entry.id !== created.id)]);
    });
  }

  async function resolve(value: string) {
    setCamera(false);
    setReviewing(false);
    setPreview(null);
    await run(async () => {
      if (!parseQrPaymentPayload(value))
        throw new Error('Unsupported QR code. Only KLIKS payment codes are accepted.');
      const result = await api<Preview>('/qr-payments/resolve', 'POST', {
        payerId: identity.id,
        payload: value,
      });
      setPayload(value);
      setPreview(result);
      setAmount(result.amountMinor === null ? '' : amountText(result.amountMinor));
    });
  }

  async function startCamera() {
    setError('');
    try {
      const result = permission?.granted ? permission : await requestPermission();
      if (!result.granted) {
        setError(
          'Camera permission is disabled. Enable it in system settings or paste a QR payload.',
        );
        return;
      }
      scanned.current = false;
      setCamera(true);
    } catch {
      setError('Camera unavailable. Paste a QR payload instead.');
    }
  }

  async function refresh() {
    await run(async () => {
      setCodes(await api<Session[]>(`/qr-payments?userId=${identity.id}`));
      if (code) setCode(await api<Code>(`/qr-payments/${code.id}?userId=${identity.id}`));
      setNow(Date.now());
    });
  }

  const codeState =
    code?.state === 'AVAILABLE' && new Date(code.expiresAt).getTime() <= now
      ? 'EXPIRED'
      : code?.state;
  const expired = preview ? new Date(preview.expiresAt).getTime() <= now : false;

  return (
    <View style={styles.content}>
      <Text style={styles.title}>QR payments</Text>
      <Text style={styles.notice}>Simulation only. No real money moves.</Text>
      <View style={styles.tabs}>
        <Action
          label="My codes"
          secondary={tab !== 'receive'}
          disabled={busy}
          onPress={() => {
            setTab('receive');
            setCamera(false);
          }}
        />
        <Action
          label="Scan / pay"
          secondary={tab !== 'scan'}
          disabled={busy}
          onPress={() => setTab('scan')}
        />
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {tab === 'receive' ? (
        <>
          {code && (
            <>
              <Image
                source={{ uri: code.imageDataUrl }}
                style={styles.image}
                accessibilityLabel={`Payment QR for @${identity.username}`}
              />
              <Text style={styles.label}>
                {codeState} /{' '}
                {code.amountMinor === null
                  ? 'Amount chosen by payer'
                  : `EUR ${amountText(code.amountMinor)}`}
              </Text>
              <Text style={styles.body}>Expires {new Date(code.expiresAt).toLocaleString()}</Text>
              <Text selectable style={styles.reference}>
                {code.payload}
              </Text>
              <Action
                label="Share QR payload"
                secondary
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await Share.share({ message: code.payload });
                  })
                }
              />
            </>
          )}
          <Text style={styles.label}>Proposed amount (EUR, optional)</Text>
          <TextInput
            accessibilityLabel="Proposed QR amount"
            style={styles.input}
            keyboardType="decimal-pad"
            value={proposed}
            onChangeText={setProposed}
            placeholder="Any amount"
            editable={!busy}
          />
          <Action label="Generate QR" disabled={busy} onPress={generate} />
          <Text style={styles.heading}>Recent codes</Text>
          {codes.map((entry) => (
            <Pressable
              accessibilityRole="button"
              key={entry.id}
              disabled={busy}
              style={styles.codeRow}
              onPress={() =>
                run(async () => {
                  setCode(await api<Code>(`/qr-payments/${entry.id}?userId=${identity.id}`));
                })
              }
            >
              <Text style={styles.body}>
                {entry.amountMinor === null
                  ? 'Open amount'
                  : `EUR ${amountText(entry.amountMinor)}`}
              </Text>
              <Text style={styles.label}>
                {entry.state === 'AVAILABLE' && new Date(entry.expiresAt).getTime() <= now
                  ? 'EXPIRED'
                  : entry.state}
              </Text>
            </Pressable>
          ))}
          <Action label="Refresh codes" secondary disabled={busy} onPress={refresh} />
        </>
      ) : preview ? (
        <>
          <Text style={styles.heading}>
            {reviewing ? 'Confirm QR payment' : 'Resolved recipient'}
          </Text>
          <Text style={styles.body}>Verified recipient: @{preview.recipient.username}</Text>
          <Text style={styles.body}>Expires {new Date(preview.expiresAt).toLocaleString()}</Text>
          {expired && <Text style={styles.error}>This QR code has expired.</Text>}
          {reviewing ? (
            <>
              <Text style={styles.amount}>EUR {amountText(parseAmount(amount) ?? 0)}</Text>
              <Action
                label="Continue to Mock Bank"
                disabled={busy || expired}
                onPress={() =>
                  run(async () => {
                    const amountMinor = parseAmount(amount);
                    if (!amountMinor) throw new Error('Enter a valid EUR amount.');
                    const payment = await api<Payment>('/qr-payments/pay', 'POST', {
                      payload,
                      payerId: identity.id,
                      amountMinor,
                    });
                    onPayment(payment, preview.recipient);
                  })
                }
              />
              <Action
                label="Edit amount"
                secondary
                disabled={busy}
                onPress={() => setReviewing(false)}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>QR payment amount (EUR)</Text>
              <TextInput
                accessibilityLabel="QR payment amount"
                style={styles.input}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                editable={preview.amountMinor === null && !busy}
              />
              <Action
                label="Review QR payment"
                disabled={busy || expired}
                onPress={() => {
                  if (!parseAmount(amount)) {
                    setError('Enter a valid positive EUR amount.');
                    return;
                  }
                  setError('');
                  setReviewing(true);
                }}
              />
            </>
          )}
          <Action
            label="Scan another code"
            secondary
            disabled={busy}
            onPress={() => {
              setPreview(null);
              setPayload('');
              setReviewing(false);
            }}
          />
        </>
      ) : (
        <>
          {camera && (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                if (!scanned.current) {
                  scanned.current = true;
                  setPayload(data);
                  void resolve(data);
                }
              }}
              onMountError={() => {
                setCamera(false);
                setError('Camera unavailable. Paste a QR payload instead.');
              }}
            />
          )}
          <Action
            label={camera ? 'Stop camera' : 'Start camera'}
            secondary
            disabled={busy}
            onPress={() => (camera ? setCamera(false) : void startCamera())}
          />
          <Text style={styles.label}>QR payload</Text>
          <TextInput
            accessibilityLabel="QR payload"
            style={[styles.input, styles.payload]}
            value={payload}
            onChangeText={setPayload}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            editable={!busy}
            placeholder="kliks:pay:v1:..."
          />
          <Action label="Resolve QR" disabled={busy || !payload} onPress={() => resolve(payload)} />
        </>
      )}
      <Action label="Back home" secondary disabled={busy} onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingVertical: 16 },
  title: { fontSize: 26, color: '#18251f', fontFamily: 'SpaceGrotesk_700Bold' },
  heading: {
    fontSize: 18,
    color: '#18251f',
    fontFamily: 'SpaceGrotesk_600SemiBold',
    marginTop: 16,
  },
  body: { fontSize: 14, color: '#18251f', fontFamily: 'SpaceGrotesk_400Regular', flexShrink: 1 },
  label: { fontSize: 12, color: '#64716b', fontFamily: 'SpaceGrotesk_500Medium', flexShrink: 1 },
  notice: {
    color: '#173c2e',
    backgroundColor: '#eaf2d8',
    padding: 14,
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    color: '#8b3d2c',
    backgroundColor: '#fbe5df',
    padding: 14,
    fontSize: 13,
    lineHeight: 19,
  },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  button: {
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 4,
    backgroundColor: '#173c2e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#173c2e',
  },
  buttonText: { color: '#ffffff', fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold' },
  secondary: { backgroundColor: 'transparent', borderColor: '#c4cec5' },
  secondaryText: { color: '#173c2e' },
  disabled: { opacity: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: '#c4cec5',
    borderRadius: 4,
    padding: 14,
    backgroundColor: '#ffffff',
    fontSize: 16,
    color: '#18251f',
  },
  image: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 1,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
  },
  camera: { width: '100%', aspectRatio: 1 },
  payload: { minHeight: 90 },
  reference: { fontSize: 12, color: '#64716b' },
  amount: { fontSize: 32, color: '#18251f', fontFamily: 'SpaceGrotesk_600SemiBold' },
  codeRow: { paddingVertical: 18, borderTopWidth: 1, borderTopColor: '#d9dbd1', gap: 6 },
});
