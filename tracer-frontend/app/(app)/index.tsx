import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { BatchCard } from '@/components/BatchCard';
import { StatusBadge } from '@/components/StatusBadge';
import { batchesApi, usersApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { Batch, BatchStatus } from '@/types';

const STATUS_ORDER: BatchStatus[] = [
  BatchStatus.HARVESTED,
  BatchStatus.PROCESSING,
  BatchStatus.ROASTING,
  BatchStatus.IN_TRANSIT,
  BatchStatus.DELIVERED,
  BatchStatus.CERTIFIED,
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user: storeUser, setUser } = useAuthStore();

  const {
    data: batches = [],
    isLoading: batchesLoading,
    refetch: refetchBatches,
    isRefetching: batchesRefetching,
  } = useQuery<Batch[]>({
    queryKey: ['batches'],
    queryFn: batchesApi.list,
  });

  const { data: user, refetch: refetchUser } = useQuery({
    queryKey: ['user-me'],
    queryFn: async () => {
      const u = await usersApi.me();
      setUser(u);
      return u;
    },
    initialData: storeUser ?? undefined,
  });

  const onRefresh = useCallback(() => {
    refetchBatches();
    refetchUser();
  }, [refetchBatches, refetchUser]);

  const totalBatches = batches.length;
  const certifiedBatches = batches.filter((b) => b.status === BatchStatus.CERTIFIED).length;
  const recentBatches = [...batches]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  const statusCounts = STATUS_ORDER.reduce(
    (acc, status) => {
      acc[status] = batches.filter((b) => b.status === status).length;
      return acc;
    },
    {} as Record<BatchStatus, number>
  );

  const displayName = user?.name ?? storeUser?.name ?? '';
  const firstName = displayName.split(' ')[0] ?? displayName;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={batchesRefetching}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={[Colors.gradientStart, Colors.gradientEnd]}
          style={styles.header}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <View>
                  <Text style={styles.greeting}>{getGreeting()}, {firstName}!</Text>
                  <Text style={styles.headerSubtitle}>
                    Acompanhe sua produção de café
                  </Text>
                </View>
                <View style={styles.headerIcon}>
                  <Text style={styles.headerEmoji}>☕</Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.body}>
          {batchesLoading ? (
            <ActivityIndicator
              color={Colors.primary}
              size="large"
              style={styles.loader}
            />
          ) : (
            <>
              {/* Stats row */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { flex: 1 }]}>
                  <Text style={styles.statValue}>{totalBatches}</Text>
                  <Text style={styles.statLabel}>Total de Lotes</Text>
                  <Ionicons
                    name="layers-outline"
                    size={24}
                    color={Colors.primary}
                    style={styles.statIcon}
                  />
                </View>
                <View style={[styles.statCard, { flex: 1 }]}>
                  <Text style={[styles.statValue, { color: Colors.status.certified }]}>
                    {certifiedBatches}
                  </Text>
                  <Text style={styles.statLabel}>Certificados</Text>
                  <Ionicons
                    name="ribbon-outline"
                    size={24}
                    color={Colors.status.certified}
                    style={styles.statIcon}
                  />
                </View>
              </View>

              {/* Status breakdown */}
              {totalBatches > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Por Status</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.statusRow}
                  >
                    {STATUS_ORDER.filter((s) => statusCounts[s] > 0).map((status) => (
                      <View key={status} style={styles.statusPill}>
                        <StatusBadge status={status} small />
                        <Text style={styles.statusCount}>{statusCounts[status]}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Recent batches */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Lotes Recentes</Text>
                  <TouchableOpacity
                    onPress={() => router.push('/(app)/batches')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.seeAll}>Ver todos</Text>
                  </TouchableOpacity>
                </View>

                {recentBatches.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyEmoji}>🌱</Text>
                    <Text style={styles.emptyText}>Nenhum lote cadastrado ainda</Text>
                    <TouchableOpacity
                      onPress={() => router.push('/(app)/batches')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.emptyAction}>Criar primeiro lote</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  recentBatches.map((batch) => (
                    <BatchCard
                      key={batch.id}
                      batch={batch}
                      onPress={() => router.push(`/(app)/batches/${batch.id}`)}
                    />
                  ))
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingBottom: 32,
  },
  headerContent: {
    padding: 20,
    paddingTop: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textInverted,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEmoji: {
    fontSize: 28,
  },
  body: {
    flex: 1,
    marginTop: -20,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  loader: {
    marginTop: 60,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  statIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
    opacity: 0.6,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusRow: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusCount: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyAction: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 8,
  },
});
