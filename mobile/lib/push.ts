import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "https://lever-claude.vercel.app";
const EAS_PROJECT_ID = "125e292a-5534-4a3a-9fcb-9b208cb292cb";

export async function registerPushToken(): Promise<void> {
  // Push tokens only work on physical devices; web export does not support them
  if (Platform.OS === "web") return;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return;

  let expoPushToken: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    expoPushToken = result.data;
  } catch (err) {
    console.warn("[push] getExpoPushTokenAsync failed:", err);
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData.session?.access_token;
  if (!jwt) {
    console.warn("[push] No session when registering push token");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/push-tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ token: expoPushToken }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[push] Token registration failed: ${res.status}`, body);
    }
  } catch (err) {
    console.warn("[push] Token registration network error:", err);
  }
}
