import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

type Api = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
interface Person {
  id: string;
  username: string;
}
interface Merchant {
  id: string;
  displayName: string;
  owner: Person;
  role: 'OWNER' | 'MANAGER' | 'VIEWER';
  members: { user: Person; role: 'MANAGER' | 'VIEWER' }[];
  refunds: { available: false; reason: string };
}
interface History {
  requests: {
    id: string;
    payer: Person;
    amountMinor: number;
    state: string;
    payment: { id: string; state: string } | null;
  }[];
  codes: {
    id: string;
    amountMinor: number | null;
    state: string;
    payment: { id: string; amountMinor: number; state: string; payer: Person } | null;
  }[];
}
interface Code {
  amountMinor?: number | null;
  payload: string;
  imageDataUrl: string;
  expiresAt?: string;
}
function parseAmount(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  const [whole, fraction = ''] = normalized.split('.');
  const amount = Number(`${whole}${fraction.padEnd(2, '0')}`);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined;
}
function money(amount: number) {
  const digits = String(amount).padStart(3, '0');
  return `EUR ${digits.slice(0, -2)}.${digits.slice(-2)}`;
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

export default function MerchantsScreen({
  identity,
  api,
  onBack,
  onBusyChange,
  onRequest,
}: {
  identity: Person;
  api: Api;
  onBack: () => void;
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
  const [review, setReview] = useState<{ payer: Person; amountMinor: number } | null>(null);
  const [staffName, setStaffName] = useState('');
  const [role, setRole] = useState<'MANAGER' | 'VIEWER'>('VIEWER');
  const [code, setCode] = useState<Code | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
  function idempotency(fingerprint: string) {
    if (key.current?.fingerprint !== fingerprint)
      key.current = {
        fingerprint,
        key: `mobile-merchant-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`,
      };
    return key.current.key;
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
    <View style={styles.content}>
      <Text style={styles.title}>{merchant?.displayName ?? 'Merchants'}</Text>
      <Text style={styles.notice}>Simulation only. No real money moves.</Text>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!merchant ? (
        <>
          {profiles.map((entry) => (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              key={entry.id}
              style={styles.row}
              onPress={() => run(() => open(entry.id))}
            >
              <Text style={styles.heading}>{entry.displayName}</Text>
              <Text style={styles.label}>
                {entry.role} / receiving identity @{entry.owner.username}
              </Text>
            </Pressable>
          ))}
          {!profiles.some((entry) => entry.role === 'OWNER') && (
            <>
              <Text style={styles.heading}>Create a development merchant</Text>
              <TextInput
                accessibilityLabel="Merchant name"
                style={styles.input}
                maxLength={80}
                value={name}
                onChangeText={setName}
                placeholder="Merchant name"
                editable={!busy}
              />
              <Action
                label="Create merchant"
                disabled={busy || !name.trim()}
                onPress={() =>
                  run(async () => {
                    const created = await api<Merchant>('/merchants', 'POST', {
                      userId: identity.id,
                      displayName: name,
                    });
                    setProfiles((current) => [
                      created,
                      ...current.filter((entry) => entry.id !== created.id),
                    ]);
                    await open(created.id);
                  })
                }
              />
            </>
          )}
        </>
      ) : (
        <>
          <Text style={styles.label}>
            {merchant.role} / receiving identity @{merchant.owner.username}
          </Text>
          <View style={styles.tabs}>
            {(
              [
                'history',
                ...(writable ? (['request'] as const) : []),
                'qr',
                ...(merchant.role === 'OWNER' ? (['team'] as const) : []),
              ] as const
            ).map((value) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === value }}
                key={value}
                disabled={busy}
                style={[styles.tab, tab === value && styles.selected]}
                onPress={() => {
                  setTab(value);
                  setError('');
                  setReview(null);
                }}
              >
                <Text style={styles.body}>
                  {value === 'history'
                    ? 'History'
                    : value === 'request'
                      ? 'Request'
                      : value === 'qr'
                        ? 'QR codes'
                        : 'Profile / team'}
                </Text>
              </Pressable>
            ))}
          </View>
          {tab === 'history' && (
            <>
              <Text style={styles.heading}>Payment requests</Text>
              {history.requests.map((entry) => (
                <View style={styles.row} key={entry.id}>
                  <Text style={styles.body}>
                    @{entry.payer.username} / {money(entry.amountMinor)}
                  </Text>
                  <Text style={styles.label}>Request: {entry.state}</Text>
                  <Text style={styles.label}>
                    Payment: {entry.payment?.state.replaceAll('_', ' ') ?? 'not created'}
                  </Text>
                  {merchant.role === 'OWNER' && (
                    <Action
                      label="Open merchant request"
                      secondary
                      disabled={busy}
                      onPress={() => run(() => onRequest(entry.id))}
                    />
                  )}
                  {writable && entry.state === 'PENDING' && (
                    <Action
                      label="Cancel merchant request"
                      secondary
                      disabled={busy}
                      onPress={() =>
                        run(async () => {
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
                    />
                  )}
                </View>
              ))}
              {!history.requests.length && (
                <Text style={styles.label}>No merchant payment requests.</Text>
              )}
              <Text style={styles.heading}>QR checkouts</Text>
              {history.codes.map((entry) => (
                <View style={styles.row} key={entry.id}>
                  <Text style={styles.body}>
                    {entry.amountMinor === null ? 'Open checkout' : money(entry.amountMinor)} /{' '}
                    {entry.state}
                  </Text>
                  <Text style={styles.label}>
                    {entry.payment
                      ? `@${entry.payment.payer.username} / ${money(entry.payment.amountMinor)} / ${entry.payment.state.replaceAll('_', ' ')}`
                      : 'No payment created'}
                  </Text>
                </View>
              ))}
              {!history.codes.length && <Text style={styles.label}>No merchant QR checkouts.</Text>}
              <Action label="Refund unavailable" secondary disabled onPress={() => {}} />
              <Text style={styles.label}>{merchant.refunds.reason}</Text>
            </>
          )}
          {tab === 'request' && writable && (
            <>
              {review ? (
                <>
                  <Text style={styles.heading}>Review merchant request</Text>
                  <Text style={styles.body}>Merchant: {merchant.displayName}</Text>
                  <Text style={styles.body}>Customer: @{review.payer.username}</Text>
                  <Text style={styles.body}>Receiving identity: @{merchant.owner.username}</Text>
                  <Text style={styles.amount}>{money(review.amountMinor)}</Text>
                  <Action
                    label="Create merchant request"
                    disabled={busy}
                    onPress={() =>
                      run(async () => {
                        await api(`/merchants/${merchant.id}/requests`, 'POST', {
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
                        });
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
                      })
                    }
                  />
                  <Action
                    label="Edit request"
                    secondary
                    disabled={busy}
                    onPress={() => setReview(null)}
                  />
                </>
              ) : (
                <>
                  <TextInput
                    accessibilityLabel="Customer username"
                    style={styles.input}
                    value={payer}
                    onChangeText={setPayer}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="@username"
                    editable={!busy}
                  />
                  <TextInput
                    accessibilityLabel="Merchant request amount"
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="Amount (EUR)"
                    editable={!busy}
                  />
                  <Action
                    label="Review merchant request"
                    disabled={busy}
                    onPress={() =>
                      run(async () => {
                        const amountMinor = parseAmount(amount);
                        if (!amountMinor) throw new Error('Enter a positive EUR amount.');
                        const found = await api<Person>('/directory/resolve/username', 'POST', {
                          username: payer.replace(/^@/, '').trim(),
                        });
                        if (found.id === merchant.owner.id)
                          throw new Error('Choose a customer other than the receiving owner.');
                        setReview({ payer: found, amountMinor });
                      })
                    }
                  />
                </>
              )}
            </>
          )}
          {tab === 'qr' && (
            <>
              <Action
                label="Show static QR"
                secondary
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    setCode(
                      await api<Code>(`/merchants/${merchant.id}/static-qr?userId=${identity.id}`),
                    );
                  })
                }
              />
              {writable && (
                <>
                  <TextInput
                    accessibilityLabel="Dynamic QR amount"
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="Dynamic QR amount (EUR)"
                    editable={!busy}
                  />
                  <Action
                    label="Generate dynamic QR"
                    disabled={busy}
                    onPress={() =>
                      run(async () => {
                        const amountMinor = parseAmount(amount);
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
                      })
                    }
                  />
                </>
              )}
              {code && (
                <>
                  <Image
                    source={{ uri: code.imageDataUrl }}
                    style={styles.image}
                    accessibilityLabel={`Merchant QR for ${merchant.displayName}`}
                  />
                  <Text style={styles.heading}>
                    {code.amountMinor == null
                      ? 'Amount chosen at checkout'
                      : money(code.amountMinor)}
                  </Text>
                  <Text style={styles.label}>
                    {code.expiresAt
                      ? `Single-use / expires ${new Date(code.expiresAt).toLocaleString()}`
                      : 'Reusable merchant reference / each checkout expires separately'}
                  </Text>
                  <Text selectable style={styles.label}>
                    {code.payload}
                  </Text>
                  <Action
                    label="Share merchant QR payload"
                    secondary
                    disabled={busy}
                    onPress={() =>
                      run(async () => {
                        await Share.share({ message: code.payload });
                      })
                    }
                  />
                </>
              )}
            </>
          )}
          {tab === 'team' && merchant.role === 'OWNER' && (
            <>
              <TextInput
                accessibilityLabel="Merchant name"
                style={styles.input}
                value={name}
                onChangeText={setName}
                maxLength={80}
                editable={!busy}
              />
              <Action
                label="Save profile"
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    const updated = await api<Merchant>(
                      `/merchants/${merchant.id}/profile`,
                      'POST',
                      { userId: identity.id, displayName: name },
                    );
                    setMerchant(updated);
                    setProfiles((current) =>
                      current.map((entry) => (entry.id === updated.id ? updated : entry)),
                    );
                  })
                }
              />
              <Text style={styles.heading}>Team</Text>
              <Text style={styles.body}>@{merchant.owner.username} / OWNER</Text>
              {merchant.members.map((entry) => (
                <View style={styles.row} key={entry.user.id}>
                  <Text style={styles.body}>
                    @{entry.user.username} / {entry.role}
                  </Text>
                  <View style={styles.tabs}>
                    {(['MANAGER', 'VIEWER'] as const).map((value) => (
                      <Pressable
                        key={value}
                        accessibilityRole="radio"
                        accessibilityLabel={`${value} role for @${entry.user.username}`}
                        accessibilityState={{ checked: entry.role === value }}
                        disabled={busy}
                        style={[styles.tab, entry.role === value && styles.selected]}
                        onPress={() => run(() => memberAction(entry.user.id, value))}
                      >
                        <Text style={styles.body}>{value}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Action
                    label="Remove access"
                    secondary
                    disabled={busy}
                    onPress={() => run(() => memberAction(entry.user.id, 'REMOVE'))}
                  />
                </View>
              ))}
              <TextInput
                accessibilityLabel="Staff username"
                style={styles.input}
                value={staffName}
                onChangeText={setStaffName}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="@staff_username"
                editable={!busy}
              />
              <View style={styles.tabs}>
                {(['MANAGER', 'VIEWER'] as const).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: role === value }}
                    disabled={busy}
                    style={[styles.tab, role === value && styles.selected]}
                    onPress={() => setRole(value)}
                  >
                    <Text style={styles.body}>{value}</Text>
                  </Pressable>
                ))}
              </View>
              <Action
                label="Add staff"
                secondary
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    const found = await api<Person>('/directory/resolve/username', 'POST', {
                      username: staffName.replace(/^@/, '').trim(),
                    });
                    await memberAction(found.id, role);
                    setStaffName('');
                  })
                }
              />
            </>
          )}
          <Action
            label="All merchants"
            secondary
            disabled={busy}
            onPress={() => {
              setMerchant(null);
              setCode(null);
              setReview(null);
              setName('');
            }}
          />
        </>
      )}
      <Action label="Refresh merchant" secondary disabled={busy} onPress={refresh} />
      <Action label="Back home" secondary disabled={busy} onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingVertical: 16 },
  title: { fontSize: 26, color: '#18251f', fontFamily: 'SpaceGrotesk_700Bold' },
  heading: { fontSize: 17, color: '#18251f', fontFamily: 'SpaceGrotesk_600SemiBold' },
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
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tab: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: '#c4cec5', borderRadius: 4 },
  selected: { backgroundColor: '#d9fa68', borderColor: '#173c2e' },
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
  row: { gap: 10, paddingVertical: 18, borderTopWidth: 1, borderTopColor: '#d9dbd1' },
  amount: { fontSize: 30, color: '#18251f', fontFamily: 'SpaceGrotesk_600SemiBold' },
  image: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 1,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
  },
});
