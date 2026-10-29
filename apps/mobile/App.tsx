import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.wordmark}>KLIKS<Text style={styles.wordmarkDot}>.</Text></Text>
        <Text style={styles.environment}>DEV PREVIEW</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.kicker}>PHASE 01 / FOUNDATION</Text>
        <Text style={styles.title}>A simpler way to pay starts here.</Text>
        <Text style={styles.body}>
          KLIKS is being built to connect people with the banks they already use.
        </Text>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Simulation only</Text>
          <Text style={styles.noticeBody}>
            No payment has been made. Real banking and payment flows are not enabled.
          </Text>
        </View>

        <View style={styles.availability}>
          <Text style={styles.availabilityLabel}>CURRENT AVAILABILITY</Text>
          <Text style={styles.availabilityValue}>Payment initiation · Disabled</Text>
          <View style={styles.divider} />
          <Text style={styles.availabilityValue}>Mock connector · Pending-only</Text>
        </View>
      </View>

      <Text style={styles.footer}>Veç kliko. U kry.  ·  Kosovo · EUR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: '#f5f4ed',
  },
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#d7d9ce',
  },
  wordmark: {
    color: '#17251f',
    fontSize: 23,
    fontWeight: '800',
  },
  wordmarkDot: {
    color: '#b94d35',
  },
  environment: {
    color: '#64736a',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 36,
  },
  kicker: {
    marginBottom: 14,
    color: '#245c46',
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    maxWidth: 360,
    marginBottom: 16,
    color: '#17251f',
    fontFamily: 'Georgia',
    fontSize: 44,
    lineHeight: 48,
  },
  body: {
    maxWidth: 360,
    marginBottom: 30,
    color: '#64736a',
    fontSize: 16,
    lineHeight: 24,
  },
  notice: {
    padding: 18,
    borderLeftWidth: 3,
    borderLeftColor: '#b94d35',
    backgroundColor: '#fffdf6',
  },
  noticeTitle: {
    marginBottom: 6,
    color: '#17251f',
    fontSize: 16,
    fontWeight: '700',
  },
  noticeBody: {
    color: '#64736a',
    fontSize: 13,
    lineHeight: 20,
  },
  availability: {
    paddingTop: 28,
  },
  availabilityLabel: {
    marginBottom: 14,
    color: '#245c46',
    fontSize: 10,
    fontWeight: '700',
  },
  availabilityValue: {
    paddingVertical: 12,
    color: '#17251f',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#d7d9ce',
  },
  footer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#d7d9ce',
    color: '#64736a',
    fontSize: 12,
  },
});