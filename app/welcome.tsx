import { router } from 'expo-router';
import WelcomeScreen from '@/components/WelcomeScreen';

// Reachable by double-tapping the Home tab (see (tabs)/_layout.tsx) — same
// splash/language screen shown once at app start, but as a normal pushed
// route here, so onContinue just pops back to wherever the user was.
export default function WelcomeRoute() {
  return <WelcomeScreen onContinue={() => router.back()} />;
}
