import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";

const TEAL = "#4bc3c8";

// Required for OAuth session completion on iOS
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      // redirectTo must match what's in Supabase → Auth → URL Configuration
      const redirectTo = Linking.createURL("/");

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error || !data.url) throw error ?? new Error("No auth URL returned");

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === "success") {
        // supabase-js exchanges the PKCE code and writes the session to AsyncStorage
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
        if (sessionError) throw sessionError;
        // AuthContext detects the new session and re-renders automatically
      }
    } catch (err: unknown) {
      setError((err as Error).message ?? "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  const anyLoading = loading || googleLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.logo}>lever</Text>
      <Text style={styles.subtitle}>AI-powered retirement planning</Text>

      <View style={styles.form}>
        {/* Google */}
        <TouchableOpacity
          style={[styles.googleButton, anyLoading && styles.buttonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={anyLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#3c4043" />
          ) : (
            <>
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.googleText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email / password */}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#a1a1aa"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#a1a1aa"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, anyLoading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={anyLoading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Sign in</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 40,
    fontWeight: "900",
    color: "#09090b",
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#71717a",
    marginBottom: 48,
  },
  form: {
    width: "100%",
    gap: 12,
  },
  googleButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleG: {
    fontSize: 16,
    fontWeight: "900",
    color: "#4285F4",
    lineHeight: 20,
  },
  googleText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3c4043",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e4e4e7",
  },
  dividerText: {
    fontSize: 12,
    color: "#a1a1aa",
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#09090b",
    backgroundColor: "#fafafa",
  },
  error: {
    fontSize: 13,
    color: "#ef4444",
    textAlign: "center",
  },
  button: {
    height: 48,
    borderRadius: 12,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
