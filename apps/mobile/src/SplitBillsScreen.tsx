import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { allocateSplitBill, type SplitAllocation, type SplitMode } from '@kliks/shared';

type Api = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
interface Person {
  id: string;
  username: string;
}
interface DraftPerson extends Person {
  amount: string;
}
interface BillShare {
  id: string;
  user: Person;
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
  creator: Person;
  title: string;
  totalMinor: number;
  mode: SplitMode;
  state: string;
  status: string;
  requestedMinor: number;
  settledMinor: number;
  canCancel: boolean;
  shares: BillShare[];
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

export default function SplitBillsScreen({
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
  onRequest: (requestId: string) => Promise<void>;
}) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [bill, setBill] = useState<Bill | null>(null);
  const [screen, setScreen] = useState<'list' | 'edit' | 'review' | 'detail'>('list');
  const [title, setTitle] = useState('');
  const [total, setTotal] = useState('');
  const [mode, setMode] = useState<SplitMode>('EQUAL');
  const [participants, setParticipants] = useState<DraftPerson[]>([{ ...identity, amount: '' }]);
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
      setError(failure instanceof Error ? failure.message : 'Bill action failed.');
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

  function allocations(): SplitAllocation[] {
    const totalMinor = parseAmount(total);
    if (!totalMinor) throw new Error('Enter a positive EUR total with at most two decimal places.');
    return allocateSplitBill(
      totalMinor,
      mode,
      participants.map((entry) => {
        if (mode === 'EQUAL') return { userId: entry.id };
        const amountMinor = parseAmount(entry.amount);
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

  async function add() {
    await run(async () => {
      if (participants.length >= 20) throw new Error('A bill supports at most 20 participants.');
      const found = await api<Person>(
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

  async function create() {
    await run(async () => {
      const shares = allocations();
      const body = {
        creatorId: identity.id,
        title: title.trim(),
        totalMinor: parseAmount(total),
        currency: 'EUR',
        mode,
        participants: shares.map((share) => (mode === 'EQUAL' ? { userId: share.userId } : share)),
      };
      const fingerprint = JSON.stringify(body);
      if (key.current?.fingerprint !== fingerprint)
        key.current = {
          fingerprint,
          key: `mobile-bill-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`,
        };
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
    <View style={styles.content}>
      <Text style={styles.title}>
        {screen === 'edit'
          ? 'Create a split bill'
          : screen === 'review'
            ? 'Review split bill'
            : screen === 'detail'
              ? bill?.title
              : 'Split bills'}
      </Text>
      <Text style={styles.notice}>Simulation only. No real money moves.</Text>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {screen === 'list' && (
        <>
          <Action label="New bill" disabled={busy} onPress={start} />
          {bills.map((entry) => (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              key={entry.id}
              style={styles.row}
              onPress={() =>
                run(async () => {
                  setBill(await api<Bill>(`/split-bills/${entry.id}?userId=${identity.id}`));
                  setScreen('detail');
                })
              }
            >
              <Text style={styles.heading}>{entry.title}</Text>
              <Text style={styles.body}>
                {money(entry.totalMinor)} / {entry.status.replaceAll('_', ' ')}
              </Text>
              <Text style={styles.label}>By @{entry.creator.username}</Text>
            </Pressable>
          ))}
          {!bills.length && <Text style={styles.body}>No shared bills yet.</Text>}
        </>
      )}

      {screen === 'edit' && (
        <>
          <Text style={styles.label}>Bill name</Text>
          <TextInput
            accessibilityLabel="Bill name"
            style={styles.input}
            maxLength={80}
            value={title}
            onChangeText={setTitle}
            editable={!busy}
          />
          <Text style={styles.label}>Bill total (EUR)</Text>
          <TextInput
            accessibilityLabel="Bill total"
            style={styles.input}
            keyboardType="decimal-pad"
            value={total}
            onChangeText={setTotal}
            editable={!busy}
          />
          <View style={styles.tabs}>
            {(['EQUAL', 'CUSTOM'] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: mode === value }}
                disabled={busy}
                onPress={() => setMode(value)}
                style={[styles.mode, mode === value && styles.modeSelected]}
              >
                <Text style={styles.body}>
                  {value === 'EQUAL' ? 'Equal shares' : 'Custom amounts'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.heading}>Participants ({participants.length})</Text>
          {participants.map((entry) => (
            <View style={styles.row} key={entry.id}>
              <Text style={styles.body}>
                @{entry.username}
                {entry.id === identity.id ? ' / your share' : ''}
              </Text>
              {mode === 'CUSTOM' ? (
                <TextInput
                  accessibilityLabel={`Share for @${entry.username}`}
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={entry.amount}
                  onChangeText={(value) =>
                    setParticipants((current) =>
                      current.map((person) =>
                        person.id === entry.id ? { ...person, amount: value } : person,
                      ),
                    )
                  }
                  editable={!busy}
                  placeholder="0.00"
                />
              ) : (
                <Text style={styles.body}>
                  {preview.find((share) => share.userId === entry.id)
                    ? money(preview.find((share) => share.userId === entry.id)?.amountMinor ?? 0)
                    : '-'}
                </Text>
              )}
              {entry.id !== identity.id && (
                <Action
                  label={`Remove @${entry.username}`}
                  secondary
                  disabled={busy}
                  onPress={() =>
                    setParticipants((current) => current.filter((person) => person.id !== entry.id))
                  }
                />
              )}
            </View>
          ))}
          <View style={styles.tabs}>
            {(['username', 'phone'] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: lookupMode === value }}
                disabled={busy}
                onPress={() => {
                  setLookupMode(value);
                  setLookup('');
                }}
                style={[styles.mode, lookupMode === value && styles.modeSelected]}
              >
                <Text style={styles.body}>{value === 'username' ? 'Username' : 'Phone'}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="Participant lookup"
            style={styles.input}
            value={lookup}
            onChangeText={setLookup}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={lookupMode === 'phone' ? 'phone-pad' : 'default'}
            editable={!busy}
            placeholder={lookupMode === 'username' ? '@username' : '+38344XXXXXX'}
          />
          <Action
            label="Add participant"
            secondary
            disabled={busy || !lookup.trim() || participants.length >= 20}
            onPress={add}
          />
          <Action
            label="Review bill"
            disabled={busy}
            onPress={() =>
              run(async () => {
                if (!title.trim()) throw new Error('Enter a bill name.');
                allocations();
                setScreen('review');
              })
            }
          />
          <Action
            label="Cancel draft"
            secondary
            disabled={busy}
            onPress={() => setScreen('list')}
          />
        </>
      )}

      {screen === 'review' && (
        <>
          <Text style={styles.heading}>{title}</Text>
          <Text style={styles.amount}>{money(parseAmount(total) ?? 0)}</Text>
          <Text style={styles.label}>
            {mode === 'EQUAL'
              ? 'Equal / remainder cents in participant order'
              : 'Exact custom amounts'}
          </Text>
          {participants.map((entry) => (
            <View style={styles.row} key={entry.id}>
              <Text style={styles.body}>@{entry.username}</Text>
              <Text style={styles.body}>
                {money(preview.find((share) => share.userId === entry.id)?.amountMinor ?? 0)}
              </Text>
              <Text style={styles.label}>
                {entry.id === identity.id ? 'Own share / no request' : 'Simulated payment request'}
              </Text>
            </View>
          ))}
          <Action label="Create bill and requests" disabled={busy} onPress={create} />
          <Action label="Edit bill" secondary disabled={busy} onPress={() => setScreen('edit')} />
        </>
      )}

      {screen === 'detail' && bill && (
        <>
          <Text style={styles.label}>Created by @{bill.creator.username}</Text>
          <Text style={styles.amount}>{money(bill.totalMinor)}</Text>
          <Text style={styles.heading}>{bill.status.replaceAll('_', ' ')}</Text>
          <Text style={styles.body}>Requested shares: {money(bill.requestedMinor)}</Text>
          <Text style={styles.body}>Simulated settled: {money(bill.settledMinor)}</Text>
          {bill.shares.map((share) => (
            <View style={styles.row} key={share.id}>
              <Text style={styles.heading}>@{share.user.username}</Text>
              <Text style={styles.body}>{money(share.amountMinor)}</Text>
              <Text style={styles.label}>
                {share.ownShare ? 'Own share / no request' : `Request: ${share.request?.state}`}
              </Text>
              {share.request?.payment && (
                <Text style={styles.label}>
                  Payment: {share.request.payment.state.replaceAll('_', ' ')}
                </Text>
              )}
              {share.request &&
                (bill.creatorId === identity.id || share.user.id === identity.id) && (
                  <Action
                    label="Open request"
                    secondary
                    disabled={busy}
                    onPress={() => run(() => onRequest(share.request?.id ?? ''))}
                  />
                )}
            </View>
          ))}
          {bill.creatorId === identity.id && bill.canCancel && (
            <Action
              label="Cancel bill"
              secondary
              disabled={busy}
              onPress={() =>
                run(async () => {
                  const updated = await api<Bill>(`/split-bills/${bill.id}/cancel`, 'POST', {
                    userId: identity.id,
                  });
                  setBill(updated);
                  setBills((current) =>
                    current.map((entry) => (entry.id === updated.id ? updated : entry)),
                  );
                })
              }
            />
          )}
          <Action
            label="Back to bills"
            secondary
            disabled={busy}
            onPress={() => {
              setScreen('list');
              void refresh();
            }}
          />
        </>
      )}
      <Action label="Refresh bills" secondary disabled={busy} onPress={refresh} />
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
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  mode: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: '#c4cec5', borderRadius: 4 },
  modeSelected: { backgroundColor: '#d9fa68', borderColor: '#173c2e' },
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
});
