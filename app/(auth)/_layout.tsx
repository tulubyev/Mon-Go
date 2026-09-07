import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function AuthLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerBackTitle: t('common.back') }}>
      <Stack.Screen name="login" options={{ title: t('auth.loginTitle') }} />
      <Stack.Screen name="register" options={{ title: t('auth.registerTitle') }} />
      <Stack.Screen name="verify" options={{ title: t('auth.verifyTitle') }} />
    </Stack>
  );
}
