import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const TEAL = "#4bc3c8";
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "https://lever-claude.vercel.app";

type Plan = {
  id: string;
  name: string;
  retirement_age: number;
  monthly_contribution: number;
  projected_balance: number;
  success_probability: number;
};

function fmtBalance(n: number): string {
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${Math.round(n / 1000)}K`;
}

export default function PlansScreen() {
  const { session, signOut } = useAuth();
  const [plans, setPlans]       = useState<Plan[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, retirement_age, monthly_contribution, projected_balance, success_probability")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPlans(data ?? []);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? "Failed to load plans");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadPlans(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadPlans();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>lever</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.greeting}>
        {session?.user?.email?.split("@")[0] ?? "Your"} plans
      </Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={plans}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
        ListEmptyComponent={
          <Text style={styles.empty}>No plans yet. Create one on the web.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardProb}>{item.success_probability}%</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardMeta}>Retire at {item.retirement_age}</Text>
              <Text style={styles.cardMeta}>
                {fmtBalance(item.projected_balance)} projected
              </Text>
            </View>
            <Text style={styles.cardContrib}>
              ${item.monthly_contribution.toLocaleString()}/mo
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  logo: { fontSize: 24, fontWeight: "900", color: "#09090b", letterSpacing: -0.5 },
  signOut: { fontSize: 14, color: "#71717a" },
  greeting: { fontSize: 22, fontWeight: "800", color: "#09090b", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  list: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  errorBox: { marginHorizontal: 24, marginBottom: 12, backgroundColor: "#fef2f2", borderRadius: 12, padding: 12 },
  errorText: { color: "#ef4444", fontSize: 13 },
  empty: { color: "#a1a1aa", textAlign: "center", marginTop: 48, fontSize: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f4f4f5",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 4,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardName: { fontSize: 16, fontWeight: "700", color: "#09090b", flex: 1 },
  cardProb: { fontSize: 16, fontWeight: "800", color: TEAL },
  cardRow: { flexDirection: "row", justifyContent: "space-between" },
  cardMeta: { fontSize: 13, color: "#71717a" },
  cardContrib: { fontSize: 13, color: "#a1a1aa", marginTop: 4 },
});
