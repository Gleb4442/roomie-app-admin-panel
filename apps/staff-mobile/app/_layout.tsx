import '../src/i18n';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../src/stores/authStore';
import { savePushToken } from '../src/api/staffApi';
import { useRouter, useSegments } from 'expo-router';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
  },
});

async function registerForPushNotifications() {
  if (Platform.OS === 'web') return null;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;
  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { staff, isLoading, loadFromStorage } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const pushRegistered = useRef(false);

  useEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    if (!staff && !inAuth) router.replace('/(auth)/login');
    if (staff && inAuth) router.replace('/(staff)/tasks');
  }, [staff, isLoading]);

  // Register push token when authenticated
  useEffect(() => {
    if (!staff || pushRegistered.current) return;
    pushRegistered.current = true;

    registerForPushNotifications().then(token => {
      if (token) {
        savePushToken(token).catch(() => {
          // Silently ignore — not critical
        });
      }
    }).catch(() => {});
  }, [staff]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthGate>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
