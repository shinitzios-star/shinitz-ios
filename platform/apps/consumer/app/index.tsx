import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@shinitz/shared-core';

// This app ONLY serves the "consumer" role. A session for any other role is bounced
// to login — riders can't open restaurant screens, etc. (platform security #7).
const APP_ROLE = 'consumer';

export default function Index() {
  const { isAuthenticated, user, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, []);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/(auth)/login'); return; }
    if (user?.role !== APP_ROLE) { router.replace('/(auth)/login'); return; }
    router.replace('/(consumer)/home');
  }, [isAuthenticated, user]);

  return <View />;
}
