import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { StatusBar } from 'expo-status-bar';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useState } from 'react';

const identityStorageKey = 'kliks.development-identity.v1';
const defaultApiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl).replace(/\/+$/, '');

type Screen =
  | 'loading'
  | 'identity'
  | 'verification'
  | 'home'
  | 'recipient'
  | 'amount'
  | 'review'
  | 'authorization'
  | 'result'
  | 'activity';
type RecipientMode = 'phone' | 'username';
type PaymentState =
  | 'CREATED'
  | 'REQUIRES_AUTHORIZATION'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'REJECTED'
  | 'FAILED'
  | 'CANCELLED';
type MockOutcome = 'SUCCESS' | 'PENDING' | 'INSUFFICIENT_FUNDS' | 'PROVIDER_FAILURE';

interface Identity {
  id: string;
  username: string;
  phoneVerified: boolean;
  directoryListingEnabled: boolean;
}

interface VerificationChallenge {
  challengeId: string;
  developmentCode: string;
  expiresAt: string;
  simulation: true;
}

interface RecipientPreview {
  id: string;
  username: string;
  phoneVerified: true;
  createdAt: string;
}

interface LinkedAccount {
  id: string;
  connectorId: string;
  displayName: string;
  status: 'PENDING_AUTHORIZATION' | 'CONNECTED' | 'REJECTED' | 'DISCONNECTED';
  isDefault: boolean;
  createdAt: string;
  simulation: true;
}

interface Payment {
  id: string;
  payerId: string;
  payeeId: string;
  amountMinor: number;
  currency: 'EUR';
  state: PaymentState;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
  simulation: true;
}

async function apiRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? (payload as { message: unknown }).message
        : undefined;
    throw new Error(
      Array.isArray(message) ? message.join(', ') : String(message ?? 'Request failed.'),
    );
  }
  return payload as T;
}

function parseEuroMinorUnits(value: string): number | undefined {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return undefined;
  }

  const [wholeText, fractionText = ''] = normalized.split('.');
  const minorDigits = `${wholeText}${fractionText.padEnd(2, '0')}`.replace(/^0+(?=\d)/, '');
  const amountMinor = Number(minorDigits);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    return undefined;
  }
  return amountMinor;
}

function formatEuroMinorUnits(amountMinor: number): string {
  const digits = String(amountMinor).padStart(3, '0');
  return `€${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

function newIdempotencyKey(): string {
  return `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function ActionButton({
  label,
  onPress,
  disabled = false,
  kind = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${kind}`],
        (disabled || pressed) && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, kind === 'secondary' && styles.buttonTextSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

function BrandHeader({ label = 'DEVELOPMENT PREVIEW' }: { label?: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Text style={styles.brandMark}>k</Text>
        <Text style={styles.wordmark}>
          KLIKS<Text style={styles.wordmarkDot}>.</Text>
        </Text>
      </View>
      <View style={styles.previewPill}>
        <View style={styles.previewDot} />
        <Text style={styles.previewText}>{label}</Text>
      </View>
    </View>
  );
}

function SimulationNotice({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.notice, compact && styles.noticeCompact]}>
      <Text style={styles.noticeMark}>!</Text>
      <View style={styles.noticeCopy}>
        <Text style={styles.noticeTitle}>Simulation only</Text>
        <Text style={styles.noticeBody}>No real money moves. Mock Bank is development-only.</Text>
      </View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const [screen, setScreen] = useState<Screen>('loading');
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [username, setUsername] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('username');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipient, setRecipient] = useState<RecipientPreview | null>(null);
  const [amountText, setAmountText] = useState('');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [mockOutcome, setMockOutcome] = useState<MockOutcome>('SUCCESS');
  const [history, setHistory] = useState<Payment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(identityStorageKey)
      .then((storedIdentity) => {
        if (!active) return;
        if (!storedIdentity) {
          setScreen('identity');
          return;
        }
        const savedIdentity = JSON.parse(storedIdentity) as Identity;
        if (!savedIdentity.phoneVerified) {
          setScreen('identity');
          return;
        }
        setIdentity(savedIdentity);
        setScreen('home');
        void loadAccounts(savedIdentity.id).catch((loadError) => {
          if (active) {
            setError(loadError instanceof Error ? loadError.message : 'Could not load accounts.');
          }
        });
      })
      .catch(() => {
        if (active) setScreen('identity');
      });
    return () => {
      active = false;
    };
  }, []);

  async function runAction(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function loadAccounts(userId: string): Promise<void> {
    const result = await apiRequest<LinkedAccount[]>(
      `/banking/accounts?userId=${encodeURIComponent(userId)}`,
    );
    setAccounts(result);
  }

  async function loadHistory(userId: string): Promise<void> {
    const result = await apiRequest<Payment[]>(`/payments?userId=${encodeURIComponent(userId)}`);
    setHistory(result);
  }

  async function createDevelopmentIdentity(): Promise<void> {
    await runAction(async () => {
      const created = await apiRequest<Omit<Identity, 'directoryListingEnabled'>>(
        '/identity/users',
        'POST',
        { phoneNumber, username },
      );
      const newChallenge = await apiRequest<VerificationChallenge>(
        `/identity/users/${created.id}/phone-verification`,
        'POST',
      );
      setIdentity({ ...created, directoryListingEnabled: false });
      setChallenge(newChallenge);
      setVerificationCode('');
      setScreen('verification');
    });
  }

  async function confirmDevelopmentIdentity(): Promise<void> {
    if (!identity || !challenge) return;
    await runAction(async () => {
      const confirmed = await apiRequest<Omit<Identity, 'directoryListingEnabled'>>(
        `/identity/users/${identity.id}/phone-verification/confirm`,
        'POST',
        { challengeId: challenge.challengeId, code: verificationCode },
      );
      const verifiedIdentity: Identity = { ...confirmed, directoryListingEnabled: false };
      await AsyncStorage.setItem(identityStorageKey, JSON.stringify(verifiedIdentity));
      setIdentity(verifiedIdentity);
      setChallenge(null);
      setScreen('home');
      await loadAccounts(verifiedIdentity.id);
    });
  }

  async function toggleDirectoryVisibility(): Promise<void> {
    if (!identity) return;
    await runAction(async () => {
      const enabled = !identity.directoryListingEnabled;
      await apiRequest('/directory/visibility', 'POST', { userId: identity.id, enabled });
      const updatedIdentity = { ...identity, directoryListingEnabled: enabled };
      setIdentity(updatedIdentity);
      await AsyncStorage.setItem(identityStorageKey, JSON.stringify(updatedIdentity));
    });
  }

  async function connectMockBank(): Promise<void> {
    if (!identity) return;
    await runAction(async () => {
      await apiRequest('/banking/accounts', 'POST', { userId: identity.id });
      await loadAccounts(identity.id);
    });
  }

  async function authorizeMockAccount(account: LinkedAccount, decision: 'APPROVE' | 'REJECT') {
    if (!identity) return;
    await runAction(async () => {
      await apiRequest(`/banking/accounts/${account.id}/authorize`, 'POST', {
        userId: identity.id,
        decision,
      });
      await loadAccounts(identity.id);
    });
  }

  async function setDefaultAccount(account: LinkedAccount) {
    if (!identity) return;
    await runAction(async () => {
      await apiRequest(`/banking/accounts/${account.id}/default`, 'POST', { userId: identity.id });
      await loadAccounts(identity.id);
    });
  }

  async function disconnectAccount(account: LinkedAccount) {
    if (!identity) return;
    await runAction(async () => {
      await apiRequest(`/banking/accounts/${account.id}/disconnect`, 'POST', {
        userId: identity.id,
      });
      await loadAccounts(identity.id);
    });
  }

  async function resolveRecipient() {
    if (!identity) return;
    await runAction(async () => {
      const result = await apiRequest<RecipientPreview>(
        `/directory/resolve/${recipientMode}`,
        'POST',
        recipientMode === 'phone' ? { phoneNumber: recipientQuery } : { username: recipientQuery },
      );
      if (result.id === identity.id) {
        throw new Error('Choose a different recipient.');
      }
      setRecipient(result);
      setScreen('amount');
    });
  }

  function continueToReview() {
    const parsedAmount = parseEuroMinorUnits(amountText);
    if (!parsedAmount) {
      setError('Enter an amount greater than €0.00 with up to two decimals.');
      return;
    }
    setError('');
    setScreen('review');
  }

  async function createSimulatedPayment() {
    if (!identity || !recipient) return;
    const amountMinor = parseEuroMinorUnits(amountText);
    if (!amountMinor) {
      setError('Enter a valid EUR amount.');
      return;
    }
    await runAction(async () => {
      const created = await apiRequest<Payment>('/payments', 'POST', {
        payerId: identity.id,
        payeeId: recipient.id,
        amountMinor,
        currency: 'EUR',
        idempotencyKey: newIdempotencyKey(),
      });
      setPayment(created);
      setScreen('authorization');
    });
  }

  async function authorizeSimulatedPayment(decision: 'APPROVE' | 'REJECT') {
    if (!identity || !payment) return;
    await runAction(async () => {
      const updated = await apiRequest<Payment>(`/payments/${payment.id}/authorize`, 'POST', {
        payerId: identity.id,
        decision,
        outcome: mockOutcome,
      });
      setPayment(updated);
      setScreen('result');
    });
  }

  function startSend() {
    const defaultAccount = accounts.find(
      (account) => account.isDefault && account.status === 'CONNECTED',
    );
    if (!defaultAccount) {
      setError('Connect and choose a Mock Bank account before starting a simulation.');
      setScreen('home');
      return;
    }
    setError('');
    setRecipient(null);
    setRecipientQuery('');
    setAmountText('');
    setScreen('recipient');
  }

  function openActivity() {
    if (!identity) return;
    setScreen('activity');
    void runAction(() => loadHistory(identity.id));
  }

  async function signOutDevelopmentIdentity(): Promise<void> {
    await AsyncStorage.removeItem(identityStorageKey);
    setIdentity(null);
    setAccounts([]);
    setHistory([]);
    setScreen('identity');
    setError('');
  }

  const defaultAccount = accounts.find(
    (account) => account.isDefault && account.status === 'CONNECTED',
  );
  const fontRegular = fontsLoaded ? styles.fontRegular : undefined;
  const fontMedium = fontsLoaded ? styles.fontMedium : undefined;
  const fontSemibold = fontsLoaded ? styles.fontSemibold : undefined;
  const fontBold = fontsLoaded ? styles.fontBold : undefined;

  if (screen === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.loading}>
          <Text style={[styles.brandMark, fontBold]}>k</Text>
          <Text style={[styles.loadingText, fontMedium]}>Opening your preview...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
          <BrandHeader />
          {error ? <Text style={[styles.error, fontMedium]}>{error}</Text> : null}

          {screen === 'identity' ? (
            <IdentityScreen
              phoneNumber={phoneNumber}
              username={username}
              busy={busy}
              fontRegular={fontRegular}
              fontSemibold={fontSemibold}
              fontBold={fontBold}
              onChangePhone={setPhoneNumber}
              onChangeUsername={setUsername}
              onCreate={createDevelopmentIdentity}
            />
          ) : null}

          {screen === 'verification' && identity && challenge ? (
            <VerificationScreen
              identity={identity}
              challenge={challenge}
              code={verificationCode}
              busy={busy}
              fontRegular={fontRegular}
              fontMedium={fontMedium}
              fontSemibold={fontSemibold}
              fontBold={fontBold}
              onChangeCode={setVerificationCode}
              onConfirm={confirmDevelopmentIdentity}
              onBack={() => setScreen('identity')}
            />
          ) : null}

          {screen === 'home' && identity ? (
            <HomeScreen
              identity={identity}
              accounts={accounts}
              defaultAccount={defaultAccount}
              busy={busy}
              fontRegular={fontRegular}
              fontMedium={fontMedium}
              fontSemibold={fontSemibold}
              fontBold={fontBold}
              onToggleDirectory={toggleDirectoryVisibility}
              onConnect={connectMockBank}
              onAuthorize={authorizeMockAccount}
              onSetDefault={setDefaultAccount}
              onDisconnect={disconnectAccount}
              onSend={startSend}
              onActivity={openActivity}
              onSignOut={signOutDevelopmentIdentity}
            />
          ) : null}

          {screen === 'recipient' ? (
            <RecipientScreen
              mode={recipientMode}
              query={recipientQuery}
              busy={busy}
              fontRegular={fontRegular}
              onMode={setRecipientMode}
              onQuery={setRecipientQuery}
              onResolve={resolveRecipient}
              onBack={() => setScreen('home')}
            />
          ) : null}

          {screen === 'amount' && recipient ? (
            <AmountScreen
              recipient={recipient}
              amount={amountText}
              fontRegular={fontRegular}
              fontMedium={fontMedium}
              fontSemibold={fontSemibold}
              onAmount={setAmountText}
              onContinue={continueToReview}
              onBack={() => setScreen('recipient')}
            />
          ) : null}

          {screen === 'review' && recipient ? (
            <ReviewScreen
              recipient={recipient}
              amountMinor={parseEuroMinorUnits(amountText) ?? 0}
              payerAccount={defaultAccount}
              busy={busy}
              fontRegular={fontRegular}
              fontSemibold={fontSemibold}
              fontBold={fontBold}
              onCreate={createSimulatedPayment}
              onBack={() => setScreen('amount')}
            />
          ) : null}

          {screen === 'authorization' && payment ? (
            <AuthorizationScreen
              payment={payment}
              outcome={mockOutcome}
              busy={busy}
              fontRegular={fontRegular}
              fontSemibold={fontSemibold}
              fontBold={fontBold}
              onOutcome={setMockOutcome}
              onApprove={() => authorizeSimulatedPayment('APPROVE')}
              onReject={() => authorizeSimulatedPayment('REJECT')}
            />
          ) : null}

          {screen === 'result' && payment ? (
            <ResultScreen
              payment={payment}
              recipient={recipient}
              fontRegular={fontRegular}
              fontMedium={fontMedium}
              fontSemibold={fontSemibold}
              fontBold={fontBold}
              onHome={() => setScreen('home')}
              onActivity={openActivity}
              onSendAnother={startSend}
            />
          ) : null}

          {screen === 'activity' && identity ? (
            <ActivityScreen
              payments={history}
              busy={busy}
              fontRegular={fontRegular}
              fontSemibold={fontSemibold}
              fontBold={fontBold}
              onRefresh={() => runAction(() => loadHistory(identity.id))}
              onHome={() => setScreen('home')}
              onSend={startSend}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function IdentityScreen({
  phoneNumber,
  username,
  busy,
  fontRegular,
  fontSemibold,
  fontBold,
  onChangePhone,
  onChangeUsername,
  onCreate,
}: {
  phoneNumber: string;
  username: string;
  busy: boolean;
  fontRegular: object | undefined;
  fontSemibold: object | undefined;
  fontBold: object | undefined;
  onChangePhone: (value: string) => void;
  onChangeUsername: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <View style={styles.content}>
      <Text style={[styles.eyebrow, fontSemibold]}>PHASE 06 / MOBILE MVP</Text>
      <Text style={[styles.title, styles.titleLight, fontBold]}>Start with your identity.</Text>
      <Text style={[styles.body, styles.bodyLight, fontRegular]}>
        Create a development identity to explore the simulated KLIKS flow.
      </Text>
      <SimulationNotice compact />
      <Text style={[styles.label, fontSemibold]}>KOSOVO PHONE NUMBER</Text>
      <TextInput
        accessibilityLabel="Kosovo phone number"
        autoComplete="tel"
        autoCapitalize="none"
        keyboardType="phone-pad"
        onChangeText={onChangePhone}
        placeholder="044 123 456"
        placeholderTextColor="#8b948d"
        style={[styles.input, fontRegular]}
        value={phoneNumber}
      />
      <Text style={[styles.label, fontSemibold]}>USERNAME</Text>
      <TextInput
        accessibilityLabel="Username"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeUsername}
        placeholder="arta_7"
        placeholderTextColor="#8b948d"
        style={[styles.input, fontRegular]}
        value={username}
      />
      <ActionButton
        disabled={busy}
        label={busy ? 'Creating identity...' : 'Create development identity'}
        onPress={onCreate}
      />
      <Text style={[styles.helper, fontRegular]}>
        A verification code appears in this app. No SMS is sent.
      </Text>
    </View>
  );
}

function VerificationScreen({
  identity,
  challenge,
  code,
  busy,
  fontRegular,
  fontMedium,
  fontSemibold,
  fontBold,
  onChangeCode,
  onConfirm,
  onBack,
}: {
  identity: Identity;
  challenge: VerificationChallenge;
  code: string;
  busy: boolean;
  fontRegular: object | undefined;
  fontMedium: object | undefined;
  fontSemibold: object | undefined;
  fontBold: object | undefined;
  onChangeCode: (value: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.content}>
      <StepHeader title="Verify your phone" step="01 / 03" onBack={onBack} />
      <Text style={[styles.body, fontRegular]}>
        Confirm the development code for <Text style={fontSemibold}>@{identity.username}</Text>.
      </Text>
      <View style={styles.codeCard}>
        <Text style={[styles.label, fontSemibold]}>SIMULATED CODE · NO SMS SENT</Text>
        <Text style={[styles.codeValue, fontBold]}>{challenge.developmentCode}</Text>
      </View>
      <Text style={[styles.label, fontSemibold]}>ENTER THE CODE</Text>
      <TextInput
        accessibilityLabel="Development verification code"
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={onChangeCode}
        placeholder="6-digit code"
        placeholderTextColor="#8b948d"
        style={[styles.input, styles.codeInput, fontMedium]}
        value={code}
      />
      <ActionButton
        disabled={busy || code.length !== 6}
        label={busy ? 'Verifying...' : 'Confirm development code'}
        onPress={onConfirm}
      />
    </View>
  );
}

function HomeScreen({
  identity,
  accounts,
  defaultAccount,
  busy,
  fontRegular,
  fontMedium,
  fontSemibold,
  fontBold,
  onToggleDirectory,
  onConnect,
  onAuthorize,
  onSetDefault,
  onDisconnect,
  onSend,
  onActivity,
  onSignOut,
}: {
  identity: Identity;
  accounts: LinkedAccount[];
  defaultAccount: LinkedAccount | undefined;
  busy: boolean;
  fontRegular: object | undefined;
  fontMedium: object | undefined;
  fontSemibold: object | undefined;
  fontBold: object | undefined;
  onToggleDirectory: () => void;
  onConnect: () => void;
  onAuthorize: (account: LinkedAccount, decision: 'APPROVE' | 'REJECT') => void;
  onSetDefault: (account: LinkedAccount) => void;
  onDisconnect: (account: LinkedAccount) => void;
  onSend: () => void;
  onActivity: () => void;
  onSignOut: () => void;
}) {
  return (
    <View style={styles.content}>
      <View style={styles.homeHeading}>
        <View>
          <Text style={[styles.eyebrow, fontSemibold]}>YOUR KLIKS</Text>
          <Text style={[styles.sectionTitle, fontBold]}>Përshëndetje, @{identity.username}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onSignOut}>
          <Text style={[styles.link, fontSemibold]}>Sign out</Text>
        </Pressable>
      </View>

      <SimulationNotice />

      <View style={styles.section}>
        <SectionHeading title="Recipient discovery" caption="PRIVATE BY DEFAULT" />
        <Text style={[styles.secondaryBody, fontRegular]}>
          Let verified people find you by phone or username.
        </Text>
        <View style={styles.inlineRow}>
          <Text style={[styles.stateText, fontMedium]}>
            {identity.directoryListingEnabled ? 'Discoverable' : 'Hidden from directory'}
          </Text>
          <ActionButton
            kind="secondary"
            disabled={busy}
            label={identity.directoryListingEnabled ? 'Turn off' : 'Opt in'}
            onPress={onToggleDirectory}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading title="Connected accounts" caption="MOCK BANK ONLY" />
        <Text style={[styles.secondaryBody, fontRegular]}>
          No banking credentials are requested or stored.
        </Text>
        {accounts.map((account) => (
          <View style={styles.accountRow} key={account.id}>
            <View style={styles.accountMain}>
              <Text style={[styles.accountName, fontSemibold]}>{account.displayName}</Text>
              <Text style={[styles.accountMeta, fontRegular]}>
                {account.status.replaceAll('_', ' ')}
                {account.isDefault ? ' · DEFAULT' : ''}
              </Text>
            </View>
            {account.status === 'PENDING_AUTHORIZATION' ? (
              <View style={styles.accountActions}>
                <ActionButton
                  disabled={busy}
                  label="Approve"
                  onPress={() => onAuthorize(account, 'APPROVE')}
                />
                <ActionButton
                  kind="secondary"
                  disabled={busy}
                  label="Reject"
                  onPress={() => onAuthorize(account, 'REJECT')}
                />
              </View>
            ) : null}
            {account.status === 'CONNECTED' ? (
              <View style={styles.accountActions}>
                {!account.isDefault ? (
                  <ActionButton
                    kind="secondary"
                    disabled={busy}
                    label="Set default"
                    onPress={() => onSetDefault(account)}
                  />
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => onDisconnect(account)}
                >
                  <Text style={[styles.dangerLink, fontSemibold]}>Disconnect</Text>
                </Pressable>
              </View>
            ) : null}
            <Text style={[styles.simulationTag, fontSemibold]}>SIMULATED</Text>
          </View>
        ))}
        <ActionButton
          kind="secondary"
          disabled={busy}
          label={busy ? 'Connecting...' : 'Connect Mock Bank'}
          onPress={onConnect}
        />
      </View>

      <View style={styles.section}>
        <SectionHeading title="Ready to send" caption="NO BALANCE STORED" />
        <Text style={[styles.secondaryBody, fontRegular]}>
          {defaultAccount
            ? 'Choose a verified recipient and review every detail before the simulation.'
            : 'Connect and set a Mock Bank account as default to start a payment simulation.'}
        </Text>
        <ActionButton disabled={busy || !defaultAccount} label="Send with KLIKS" onPress={onSend} />
        <Pressable accessibilityRole="button" onPress={onActivity} style={styles.secondaryAction}>
          <Text style={[styles.link, fontSemibold]}>View activity</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RecipientScreen({
  mode,
  query,
  busy,
  fontRegular,
  onMode,
  onQuery,
  onResolve,
  onBack,
}: {
  mode: RecipientMode;
  query: string;
  busy: boolean;
  fontRegular: object | undefined;
  onMode: (value: RecipientMode) => void;
  onQuery: (value: string) => void;
  onResolve: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.content}>
      <StepHeader title="Find your person" step="01 / 03" onBack={onBack} />
      <Text style={[styles.secondaryBody, fontRegular]}>
        Your recipient must have opted in to discovery.
      </Text>
      <View style={styles.segmented}>
        <SegmentButton
          label="Username"
          selected={mode === 'username'}
          onPress={() => onMode('username')}
        />
        <SegmentButton label="Phone" selected={mode === 'phone'} onPress={() => onMode('phone')} />
      </View>
      <TextInput
        accessibilityLabel={mode === 'phone' ? 'Recipient phone number' : 'Recipient username'}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={mode === 'phone' ? 'phone-pad' : 'default'}
        onChangeText={onQuery}
        placeholder={mode === 'phone' ? '044 123 456' : '@username'}
        placeholderTextColor="#8b948d"
        style={[styles.input, fontRegular]}
        value={query}
      />
      <ActionButton
        disabled={busy || query.trim().length === 0}
        label={busy ? 'Finding recipient...' : 'Find recipient'}
        onPress={onResolve}
      />
      <SimulationNotice compact />
    </View>
  );
}

function AmountScreen({
  recipient,
  amount,
  fontRegular,
  fontMedium,
  fontSemibold,
  onAmount,
  onContinue,
  onBack,
}: {
  recipient: RecipientPreview;
  amount: string;
  fontRegular: object | undefined;
  fontMedium: object | undefined;
  fontSemibold: object | undefined;
  onAmount: (value: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.content}>
      <StepHeader title="Choose an amount" step="02 / 03" onBack={onBack} />
      <RecipientCard recipient={recipient} fontRegular={fontRegular} fontSemibold={fontSemibold} />
      <Text style={[styles.label, fontSemibold]}>AMOUNT · EUR</Text>
      <TextInput
        accessibilityLabel="Amount in euros"
        keyboardType="decimal-pad"
        onChangeText={onAmount}
        placeholder="0.00"
        placeholderTextColor="#a5ada6"
        style={[styles.amountInput, fontMedium]}
        value={amount}
      />
      <Text style={[styles.helper, fontRegular]}>
        EUR cents are calculated exactly. No rounding.
      </Text>
      <ActionButton label="Review payment" onPress={onContinue} />
    </View>
  );
}

function ReviewScreen({
  recipient,
  amountMinor,
  payerAccount,
  busy,
  fontRegular,
  fontSemibold,
  fontBold,
  onCreate,
  onBack,
}: {
  recipient: RecipientPreview;
  amountMinor: number;
  payerAccount: LinkedAccount | undefined;
  busy: boolean;
  fontRegular: object | undefined;
  fontSemibold: object | undefined;
  fontBold: object | undefined;
  onCreate: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.content}>
      <StepHeader title="Review before authorizing" step="03 / 03" onBack={onBack} />
      <View style={styles.reviewCard}>
        <ReviewRow
          label="TO"
          value={`@${recipient.username}`}
          fontRegular={fontRegular}
          fontSemibold={fontSemibold}
        />
        <ReviewRow
          label="FROM"
          value={payerAccount?.displayName ?? 'Mock Bank'}
          fontRegular={fontRegular}
          fontSemibold={fontSemibold}
        />
        <ReviewRow
          label="AMOUNT"
          value={formatEuroMinorUnits(amountMinor)}
          prominent
          fontRegular={fontRegular}
          fontSemibold={fontSemibold}
          fontBold={fontBold}
        />
        <View style={styles.reviewDivider} />
        <Text style={[styles.reviewFootnote, fontRegular]}>
          Simulated transfer. No funds are held or moved by KLIKS.
        </Text>
      </View>
      <ActionButton
        disabled={busy}
        label={busy ? 'Creating simulation...' : 'Continue to Mock Bank'}
        onPress={onCreate}
      />
    </View>
  );
}

function AuthorizationScreen({
  payment,
  outcome,
  busy,
  fontRegular,
  fontSemibold,
  fontBold,
  onOutcome,
  onApprove,
  onReject,
}: {
  payment: Payment;
  outcome: MockOutcome;
  busy: boolean;
  fontRegular: object | undefined;
  fontSemibold: object | undefined;
  fontBold: object | undefined;
  onOutcome: (value: MockOutcome) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.content}>
      <Text style={[styles.eyebrow, fontSemibold]}>MOCK BANK · SIMULATION</Text>
      <Text style={[styles.sectionTitle, fontBold]}>Authorize this payment</Text>
      <View style={styles.reviewCard}>
        <Text style={[styles.recipientName, fontSemibold]}>Payment {payment.id.slice(0, 8)}</Text>
        <Text style={[styles.amountSummary, fontBold]}>
          {formatEuroMinorUnits(payment.amountMinor)}
        </Text>
        <Text style={[styles.secondaryBody, fontRegular]}>No money will move.</Text>
      </View>
      <Text style={[styles.label, fontSemibold]}>SIMULATED OUTCOME</Text>
      <View style={styles.outcomeList}>
        {outcomeOptions.map((option) => (
          <SegmentButton
            key={option.value}
            label={option.label}
            selected={outcome === option.value}
            onPress={() => onOutcome(option.value)}
          />
        ))}
      </View>
      <ActionButton
        disabled={busy}
        label={busy ? 'Authorizing...' : 'Approve in Mock Bank'}
        onPress={onApprove}
      />
      <ActionButton kind="secondary" disabled={busy} label="Reject payment" onPress={onReject} />
      <SimulationNotice compact />
    </View>
  );
}

function ResultScreen({
  payment,
  recipient,
  fontRegular,
  fontMedium,
  fontSemibold,
  fontBold,
  onHome,
  onActivity,
  onSendAnother,
}: {
  payment: Payment;
  recipient: RecipientPreview | null;
  fontRegular: object | undefined;
  fontMedium: object | undefined;
  fontSemibold: object | undefined;
  fontBold: object | undefined;
  onHome: () => void;
  onActivity: () => void;
  onSendAnother: () => void;
}) {
  const resultCopy: Record<PaymentState, { title: string; detail: string }> = {
    CREATED: { title: 'Payment created', detail: 'Waiting for Mock Bank authorization.' },
    REQUIRES_AUTHORIZATION: { title: 'Authorization required', detail: 'No money has moved.' },
    PROCESSING: { title: 'Simulation processing', detail: 'This simulated payment is pending.' },
    SUCCEEDED: { title: 'Simulation complete', detail: 'Mock Bank reported a simulated success.' },
    REJECTED: { title: 'Payment rejected', detail: 'The simulated authorization was rejected.' },
    FAILED: {
      title: 'Simulation failed',
      detail:
        payment.failureCode === 'INSUFFICIENT_FUNDS'
          ? 'Mock Bank simulated insufficient funds.'
          : 'Mock Bank simulated a provider failure.',
    },
    CANCELLED: { title: 'Payment cancelled', detail: 'This simulated payment was cancelled.' },
  };
  const result = resultCopy[payment.state];

  return (
    <View style={styles.content}>
      <Text style={[styles.eyebrow, fontSemibold]}>SIMULATED RESULT</Text>
      <Text style={[styles.sectionTitle, fontBold]}>{result.title}</Text>
      <View style={styles.resultCard}>
        <Text style={[styles.amountSummary, fontBold]}>
          {formatEuroMinorUnits(payment.amountMinor)}
        </Text>
        {recipient ? (
          <Text style={[styles.recipientName, fontMedium]}>To @{recipient.username}</Text>
        ) : null}
        <Text style={[styles.secondaryBody, fontRegular]}>{result.detail}</Text>
        <Text style={[styles.stateBadge, fontSemibold]}>{payment.state.replaceAll('_', ' ')}</Text>
      </View>
      <SimulationNotice />
      <ActionButton label="View activity" onPress={onActivity} />
      <ActionButton kind="secondary" label="Send another simulation" onPress={onSendAnother} />
      <Pressable accessibilityRole="button" onPress={onHome} style={styles.secondaryAction}>
        <Text style={[styles.link, fontSemibold]}>Back home</Text>
      </Pressable>
    </View>
  );
}

function ActivityScreen({
  payments,
  busy,
  fontRegular,
  fontSemibold,
  fontBold,
  onRefresh,
  onHome,
  onSend,
}: {
  payments: Payment[];
  busy: boolean;
  fontRegular: object | undefined;
  fontSemibold: object | undefined;
  fontBold: object | undefined;
  onRefresh: () => void;
  onHome: () => void;
  onSend: () => void;
}) {
  return (
    <View style={styles.content}>
      <View style={styles.homeHeading}>
        <View>
          <Text style={[styles.eyebrow, fontSemibold]}>SIMULATED PAYMENTS</Text>
          <Text style={[styles.sectionTitle, fontBold]}>Activity</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onRefresh}>
          <Text style={[styles.link, fontSemibold]}>{busy ? 'Loading...' : 'Refresh'}</Text>
        </Pressable>
      </View>
      <SimulationNotice compact />
      {payments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, fontSemibold]}>No simulated payments yet</Text>
          <Text style={[styles.secondaryBody, fontRegular]}>
            Your payment history appears here after a simulation.
          </Text>
        </View>
      ) : (
        payments.map((item) => (
          <View key={item.id} style={styles.historyRow}>
            <View style={styles.historyMain}>
              <Text style={[styles.accountName, fontSemibold]}>
                {item.payerId === item.payeeId ? 'Payment' : 'Simulated transfer'}
              </Text>
              <Text style={[styles.accountMeta, fontRegular]}>
                {new Date(item.createdAt).toLocaleDateString()} · {item.state.replaceAll('_', ' ')}
              </Text>
            </View>
            <Text style={[styles.historyAmount, fontSemibold]}>
              {formatEuroMinorUnits(item.amountMinor)}
            </Text>
          </View>
        ))
      )}
      <ActionButton kind="secondary" label="Back home" onPress={onHome} />
      <ActionButton label="Send with KLIKS" onPress={onSend} />
    </View>
  );
}

function StepHeader({ title, step, onBack }: { title: string; step: string; onBack: () => void }) {
  return (
    <View style={styles.stepHeader}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backArrow}>‹</Text>
      </Pressable>
      <View style={styles.stepTitleWrap}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepNumber}>{step}</Text>
      </View>
    </View>
  );
}

function RecipientCard({
  recipient,
  fontRegular,
  fontSemibold,
}: {
  recipient: RecipientPreview;
  fontRegular: object | undefined;
  fontSemibold: object | undefined;
}) {
  return (
    <View style={styles.recipientCard}>
      <View style={styles.recipientAvatar}>
        <Text style={[styles.recipientAvatarText, fontSemibold]}>
          {recipient.username.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={styles.recipientText}>
        <Text style={[styles.recipientName, fontSemibold]}>@{recipient.username}</Text>
        <Text style={[styles.accountMeta, fontRegular]}>Verified KLIKS identity</Text>
      </View>
      <Text style={styles.verifiedCheck}>✓</Text>
    </View>
  );
}

function SectionHeading({ title, caption }: { title: string; caption: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCaption}>{caption}</Text>
    </View>
  );
}

function ReviewRow({
  label,
  value,
  prominent = false,
  fontRegular,
  fontSemibold,
  fontBold,
}: {
  label: string;
  value: string;
  prominent?: boolean;
  fontRegular: object | undefined;
  fontSemibold: object | undefined;
  fontBold?: object | undefined;
}) {
  return (
    <View style={styles.reviewRow}>
      <Text style={[styles.reviewLabel, fontSemibold]}>{label}</Text>
      <Text
        style={[
          prominent ? styles.reviewAmount : styles.reviewValue,
          prominent ? fontBold : fontRegular,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function SegmentButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.segmentButton, selected && styles.segmentButtonSelected]}
    >
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const outcomeOptions: { value: MockOutcome; label: string }[] = [
  { value: 'SUCCESS', label: 'Success' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'INSUFFICIENT_FUNDS', label: 'Insufficient funds' },
  { value: 'PROVIDER_FAILURE', label: 'Provider failure' },
];

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f2ea' },
  flex: { flex: 1 },
  screen: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#64716b', fontSize: 14 },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 17,
    borderBottomWidth: 1,
    borderBottomColor: '#d9dbd1',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: {
    width: 32,
    height: 32,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#173c2e',
    color: '#d9fa68',
    fontSize: 21,
    lineHeight: 32,
    textAlign: 'center',
  },
  wordmark: { color: '#18251f', fontSize: 19, fontFamily: 'SpaceGrotesk_700Bold' },
  wordmarkDot: { color: '#e16d4b' },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#d9dbd1',
    borderRadius: 100,
  },
  previewDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#e16d4b' },
  previewText: { color: '#173c2e', fontSize: 9, fontFamily: 'SpaceGrotesk_500Medium' },
  content: { gap: 14, paddingBottom: 24 },
  eyebrow: {
    marginBottom: 4,
    color: '#e16d4b',
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  title: { color: '#18251f', fontSize: 34, lineHeight: 39 },
  titleLight: { marginBottom: 1, color: '#fffef9' },
  sectionTitle: { color: '#18251f', fontSize: 22, fontFamily: 'SpaceGrotesk_600SemiBold' },
  body: { color: '#64716b', fontSize: 14, lineHeight: 21 },
  bodyLight: { marginBottom: 3, color: 'rgba(255, 254, 249, 0.76)' },
  secondaryBody: { color: '#64716b', fontSize: 12, lineHeight: 18 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginVertical: 4,
    padding: 14,
    borderWidth: 1,
    borderColor: '#d9dbd1',
    borderRadius: 6,
    backgroundColor: '#fffef9',
  },
  noticeCompact: { marginVertical: 0 },
  noticeMark: {
    width: 27,
    height: 27,
    overflow: 'hidden',
    borderRadius: 7,
    backgroundColor: '#e16d4b',
    color: '#fffef9',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    lineHeight: 27,
    textAlign: 'center',
  },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: '#18251f', fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12 },
  noticeBody: {
    marginTop: 2,
    color: '#64716b',
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 10,
    lineHeight: 15,
  },
  error: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 6,
    backgroundColor: '#f8e6df',
    color: '#a04a35',
    fontSize: 12,
  },
  label: { marginTop: 4, color: '#64716b', fontSize: 9, fontFamily: 'SpaceGrotesk_600SemiBold' },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#d9dbd1',
    borderRadius: 6,
    backgroundColor: '#fffef9',
    color: '#18251f',
    fontSize: 15,
  },
  codeInput: { fontSize: 20, letterSpacing: 4 },
  amountInput: {
    minHeight: 76,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#173c2e',
    color: '#18251f',
    fontSize: 38,
    textAlign: 'center',
  },
  helper: { color: '#64716b', fontSize: 10, lineHeight: 15 },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  button_primary: { backgroundColor: '#173c2e' },
  button_secondary: { borderWidth: 1, borderColor: '#cbd2c8', backgroundColor: '#fffef9' },
  button_danger: { backgroundColor: '#a04a35' },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#fffef9', fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13 },
  buttonTextSecondary: { color: '#173c2e' },
  codeCard: {
    alignItems: 'center',
    gap: 9,
    padding: 20,
    borderRadius: 8,
    backgroundColor: '#173c2e',
  },
  codeValue: { color: '#d9fa68', fontSize: 32, letterSpacing: 5 },
  section: { gap: 10, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#d9dbd1' },
  homeHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionCaption: { color: '#e16d4b', fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 8 },
  link: {
    color: '#245c46',
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 11,
    textDecorationLine: 'underline',
    textDecorationColor: '#245c46',
  },
  dangerLink: { color: '#a04a35', fontSize: 10 },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  stateText: { color: '#18251f', fontSize: 12 },
  accountRow: { gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e0e2d9' },
  accountMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  accountName: { flexShrink: 1, color: '#18251f', fontSize: 12 },
  accountMeta: { color: '#64716b', fontSize: 10 },
  accountActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  simulationTag: { alignSelf: 'flex-start', color: '#8d5b10', fontSize: 8 },
  secondaryAction: { alignItems: 'center', paddingVertical: 8 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d9dbd1',
    borderRadius: 6,
    backgroundColor: '#fffef9',
  },
  backArrow: { color: '#173c2e', fontSize: 26, lineHeight: 28 },
  stepTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepTitle: {
    flexShrink: 1,
    color: '#18251f',
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 19,
  },
  stepNumber: { color: '#64716b', fontFamily: 'SpaceGrotesk_500Medium', fontSize: 9 },
  segmented: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: 7,
    backgroundColor: '#e4e6dc',
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  segmentButtonSelected: { backgroundColor: '#173c2e' },
  segmentText: { color: '#526057', fontFamily: 'SpaceGrotesk_500Medium', fontSize: 10 },
  segmentTextSelected: { color: '#fffef9' },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 14,
    borderWidth: 1,
    borderColor: '#d9dbd1',
    borderRadius: 7,
    backgroundColor: '#fffef9',
  },
  recipientAvatar: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#d9fa68',
  },
  recipientAvatarText: { color: '#173c2e', fontSize: 16 },
  recipientText: { flex: 1 },
  recipientName: { color: '#18251f', fontSize: 14 },
  verifiedCheck: { color: '#286d4b', fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16 },
  reviewCard: {
    gap: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#d9dbd1',
    borderRadius: 7,
    backgroundColor: '#fffef9',
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reviewLabel: { color: '#64716b', fontSize: 9 },
  reviewValue: { color: '#18251f', fontSize: 12, textAlign: 'right' },
  reviewAmount: { color: '#173c2e', fontSize: 23, textAlign: 'right' },
  reviewDivider: { height: 1, backgroundColor: '#d9dbd1' },
  reviewFootnote: { color: '#64716b', fontSize: 10, lineHeight: 15 },
  outcomeList: { gap: 6 },
  resultCard: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: 8,
    backgroundColor: '#fffef9',
  },
  amountSummary: { color: '#173c2e', fontSize: 31 },
  stateBadge: {
    marginTop: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: '#e4e6dc',
    color: '#173c2e',
    fontSize: 9,
  },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  emptyTitle: { color: '#18251f', fontSize: 14 },
  historyRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d9dbd1',
  },
  historyMain: { flex: 1, gap: 4 },
  historyAmount: { color: '#18251f', fontSize: 12 },
  fontRegular: { fontFamily: 'SpaceGrotesk_400Regular' },
  fontMedium: { fontFamily: 'SpaceGrotesk_500Medium' },
  fontSemibold: { fontFamily: 'SpaceGrotesk_600SemiBold' },
  fontBold: { fontFamily: 'SpaceGrotesk_700Bold' },
});
