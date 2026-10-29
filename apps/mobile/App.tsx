import { SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold, useFonts } from '@expo-google-fonts/space-grotesk';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const regular = fontsLoaded ? styles.fontRegular : undefined;
  const medium = fontsLoaded ? styles.fontMedium : undefined;
  const semibold = fontsLoaded ? styles.fontSemibold : undefined;
  const bold = fontsLoaded ? styles.fontBold : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Text style={[styles.brandMark, bold]}>k</Text>
            <Text style={[styles.wordmark, bold]}>KLIKS<Text style={styles.wordmarkDot}>.</Text></Text>
          </View>
          <View style={styles.previewLabel}>
            <View style={styles.previewDot} />
            <Text style={[styles.environment, medium]}>PRIVATE PREVIEW</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.kicker}>
            <View style={styles.kickerMark} />
            <Text style={[styles.kickerText, semibold]}>THE SIMPLE WAY TO PAY</Text>
          </View>
          <Text style={[styles.title, bold]}>Pay the person.<Text style={styles.titleAccent}>{'\n'}Skip the bank form.</Text></Text>
          <Text style={[styles.body, regular]}>
            KLIKS is building a simpler way to pay anyone, using the bank you already have.
          </Text>
          <Text style={[styles.slogan, medium]}>Veç kliko. U kry.</Text>

          <View style={styles.flow}>
            <View style={styles.flowHeading}>
              <Text style={[styles.flowLabel, semibold]}>THE FUTURE FLOW</Text>
              <Text style={[styles.conceptLabel, medium]}>CONCEPT ONLY</Text>
            </View>
            <View style={styles.flowRow}>
              <Text style={[styles.flowIndex, semibold]}>01</Text>
              <View>
                <Text style={[styles.flowTitle, medium]}>Find your person</Text>
                <Text style={[styles.flowDetail, regular]}>Verified identity</Text>
              </View>
            </View>
            <View style={styles.flowRow}>
              <Text style={[styles.flowIndex, semibold]}>02</Text>
              <View>
                <Text style={[styles.flowTitle, medium]}>Check the details</Text>
                <Text style={[styles.flowDetail, regular]}>Recipient + amount</Text>
              </View>
            </View>
            <View style={styles.flowRow}>
              <Text style={[styles.flowIndex, semibold]}>03</Text>
              <View>
                <Text style={[styles.flowTitle, medium]}>Authorize with your bank</Text>
                <Text style={[styles.flowDetail, regular]}>Nothing held by KLIKS</Text>
              </View>
            </View>
            <Text style={[styles.flowFootnote, regular]}>Not active in this preview.</Text>
          </View>
        </View>

        <View style={styles.notice}>
          <Text style={[styles.noticeSymbol, bold]}>!</Text>
          <View style={styles.noticeCopy}>
            <Text style={[styles.noticeTitle, semibold]}>Nothing moves in this preview.</Text>
            <Text style={[styles.noticeBody, regular]}>
              Payments are disabled. Mock Bank is for development tests only.
            </Text>
          </View>
        </View>

        <View style={styles.foundation}>
          <Text style={[styles.foundationKicker, semibold]}>THE FOUNDATION</Text>
          <Text style={[styles.foundationTitle, semibold]}>What’s real right now</Text>
          <View style={styles.statusList}>
            <View style={styles.statusRow}>
              <Text style={[styles.rowIndex, semibold]}>01</Text>
              <View style={styles.statusMain}>
                <Text style={[styles.statusTitle, medium]}>Money model</Text>
                <Text style={[styles.statusDetail, regular]}>Exact euro cents. No rounding.</Text>
              </View>
              <Text style={[styles.statusReady, semibold]}>READY</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.rowIndex, semibold]}>02</Text>
              <View style={styles.statusMain}>
                <Text style={[styles.statusTitle, medium]}>Mock Bank</Text>
                <Text style={[styles.statusDetail, regular]}>Pending-only simulation.</Text>
              </View>
              <Text style={[styles.statusSimulated, semibold]}>SIMULATED</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.rowIndex, semibold]}>03</Text>
              <View style={styles.statusMain}>
                <Text style={[styles.statusTitle, medium]}>Payment flows</Text>
                <Text style={[styles.statusDetail, regular]}>No connection or money movement.</Text>
              </View>
              <Text style={[styles.statusDisabled, semibold]}>DISABLED</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, medium]}>KLIKS never holds your balance.</Text>
          <Text style={[styles.footerMeta, regular]}>KOSOVO · EUR</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f2ea',
  },
  screen: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#d9dbd1',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
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
  wordmark: {
    color: '#18251f',
    fontSize: 19,
  },
  wordmarkDot: {
    color: '#e16d4b',
  },
  previewLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#d9dbd1',
    borderRadius: 100,
  },
  previewDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#e16d4b',
  },
  environment: {
    color: '#173c2e',
    fontSize: 9,
    letterSpacing: 0,
  },
  hero: {
    padding: 22,
    borderRadius: 8,
    backgroundColor: '#173c2e',
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  kickerText: {
    color: '#a9d8b8',
    fontSize: 9,
  },
  kickerMark: {
    width: 7,
    height: 7,
    marginRight: 8,
    borderRadius: 2,
    backgroundColor: '#d9fa68',
  },
  title: {
    color: '#fffef9',
    fontSize: 38,
    lineHeight: 42,
  },
  titleAccent: {
    color: '#d9fa68',
  },
  body: {
    marginTop: 14,
    color: 'rgba(255, 254, 249, 0.76)',
    fontSize: 14,
    lineHeight: 21,
  },
  slogan: {
    marginTop: 17,
    color: '#a9d8b8',
    fontSize: 12,
  },
  flow: {
    marginTop: 23,
    paddingTop: 17,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.24)',
  },
  flowHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  flowLabel: {
    color: '#a9d8b8',
    fontSize: 9,
  },
  conceptLabel: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    overflow: 'hidden',
    borderRadius: 4,
    color: '#fffef9',
    fontSize: 8,
  },
  flowRow: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flowIndex: {
    width: 29,
    height: 29,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(217, 250, 104, 0.65)',
    borderRadius: 7,
    color: '#d9fa68',
    fontSize: 9,
    lineHeight: 27,
    textAlign: 'center',
  },
  flowTitle: {
    color: '#fffef9',
    fontSize: 12,
  },
  flowDetail: {
    marginTop: 3,
    color: 'rgba(255, 254, 249, 0.62)',
    fontSize: 10,
  },
  flowFootnote: {
    marginTop: 5,
    marginLeft: 41,
    color: 'rgba(255, 254, 249, 0.54)',
    fontSize: 9,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    marginTop: 13,
    padding: 14,
    borderWidth: 1,
    borderColor: '#d9dbd1',
    borderRadius: 6,
    backgroundColor: '#fffef9',
  },
  noticeSymbol: {
    width: 27,
    height: 27,
    overflow: 'hidden',
    borderRadius: 7,
    backgroundColor: '#e16d4b',
    color: '#fffef9',
    fontSize: 15,
    lineHeight: 27,
    textAlign: 'center',
  },
  noticeCopy: {
    flex: 1,
  },
  noticeTitle: {
    color: '#18251f',
    fontSize: 13,
  },
  noticeBody: {
    marginTop: 3,
    color: '#64716b',
    fontSize: 11,
    lineHeight: 16,
  },
  foundation: {
    paddingTop: 36,
  },
  foundationKicker: {
    marginBottom: 7,
    color: '#e16d4b',
    fontSize: 9,
  },
  foundationTitle: {
    marginBottom: 14,
    color: '#18251f',
    fontSize: 24,
  },
  statusList: {
    borderTopWidth: 1,
    borderTopColor: '#d9dbd1',
  },
  statusRow: {
    minHeight: 69,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#d9dbd1',
  },
  rowIndex: {
    width: 22,
    color: '#a4a9a0',
    fontSize: 10,
  },
  statusMain: {
    flex: 1,
  },
  statusTitle: {
    color: '#18251f',
    fontSize: 12,
  },
  statusDetail: {
    marginTop: 3,
    color: '#64716b',
    fontSize: 10,
  },
  statusReady: {
    color: '#286d4b',
    fontSize: 8,
  },
  statusSimulated: {
    color: '#8d5b10',
    fontSize: 8,
  },
  statusDisabled: {
    color: '#a04a35',
    fontSize: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 26,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#d9dbd1',
  },
  footerText: {
    color: '#64716b',
    fontSize: 10,
  },
  footerMeta: {
    color: '#64716b',
    fontSize: 9,
  },
  fontRegular: {
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  fontMedium: {
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  fontSemibold: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  fontBold: {
    fontFamily: 'SpaceGrotesk_700Bold',
  },
});
