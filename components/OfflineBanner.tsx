import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

/**
 * Thin "no connection" strip. Mount it under a screen's header — it renders
 * nothing at all while online, so it never reflows layout unexpectedly.
 */
export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const { t } = useTranslation();

  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>📡 {t('common.offline')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#78350f',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  text: { color: '#fef3c7', fontSize: 12, fontWeight: '600' },
});
