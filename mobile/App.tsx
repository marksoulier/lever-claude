import { useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginScreen from "./screens/LoginScreen";
import PlansScreen from "./screens/PlansScreen";
import { registerPushToken } from "./lib/push";

// Show notifications as banners when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function Root() {
  const { session, loading } = useAuth();
  const tokenRegistered = useRef(false);

  useEffect(() => {
    if (session && !tokenRegistered.current) {
      tokenRegistered.current = true;
      registerPushToken();
    }
    if (!session) {
      tokenRegistered.current = false;
    }
  }, [session]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#4bc3c8" />
      </View>
    );
  }

  return session ? <PlansScreen /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Root />
    </AuthProvider>
  );
}
