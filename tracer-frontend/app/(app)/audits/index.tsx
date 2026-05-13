import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { auditsApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { Audit, AuditStatus, UserRole } from '@/types';

const CAN_CREATE: UserRole[] = [UserRole.AUDITOR, UserRole.ADMIN];

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

export default function AuditsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const {
    data: audits = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Audit[]>({
    queryKey: ['audits'],
    queryFn: auditsApi.list,
  });

  const canCreate = user ? CAN_CREATE.includes(user.role) : false;
  const onRefresh = useCallback(() => refetch(), [refetch]);

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>📋</Text>
        <Text style={styles.emptyTitle}>Nenhuma auditoria registrada</Text>
        <Text style={styles.emptySubtitle}>
          {canCreate
            ? 'Inicie uma nova auditoria selecionando uma propriedade.'
            : 'Apenas auditores podem criar auditorias.'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.gradientStart, Colors.gradientEnd]}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Auditorias</Text>
              <Text style={styles.headerSubtitle}>Certifica Minas</Text>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="clipboard-outline" size={24} color={Colors.textInverted} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={audits}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AuditCard
              audit={item}
              onPress={() =>
                router.push({
                  pathname: '/(app)/audits/[id]',
                  params: { id: item.id },
                })
              }
            />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        />
      )}

      {canCreate && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(app)/audits/new')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color={Colors.textInverted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function AuditCard({ audit, onPress }: { audit: Audit; onPress: () => void }) {
  const isSubmitted = audit.status === AuditStatus.SUBMITTED;
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
      onPress={onPress}
      android_ripple={{ color: Colors.borderLight }}
    >
      <View
        style={[
          styles.cardIcon,
          isSubmitted ? styles.iconSubmitted : styles.iconDraft,
        ]}
      >
        <Ionicons
          name={isSubmitted ? 'checkmark-done' : 'pencil-outline'}
          size={20}
          color={Colors.textInverted}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>
          {isSubmitted ? 'Submetida' : 'Rascunho'}
        </Text>
        <Text style={styles.cardSubtitle}>
          Visita: {formatDate(audit.visit_date)} · criada {formatDate(audit.created_at)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingBottom: 24 },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.textInverted },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingTop: 16, paddingBottom: 96, flexGrow: 1 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
    gap: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDraft: { backgroundColor: Colors.warning },
  iconSubmitted: { backgroundColor: Colors.success },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
});
