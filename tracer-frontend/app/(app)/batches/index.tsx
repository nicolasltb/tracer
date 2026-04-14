import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { BatchCard } from '@/components/BatchCard';
import { batchesApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { Batch, BatchStatus, UserRole } from '@/types';

interface FilterChip {
  label: string;
  value: BatchStatus | null;
}

const FILTER_CHIPS: FilterChip[] = [
  { label: 'Todos', value: null },
  { label: 'Colhido', value: BatchStatus.HARVESTED },
  { label: 'Em Processo', value: BatchStatus.PROCESSING },
  { label: 'Em Torra', value: BatchStatus.ROASTING },
  { label: 'Em Trânsito', value: BatchStatus.IN_TRANSIT },
  { label: 'Entregue', value: BatchStatus.DELIVERED },
  { label: 'Certificado', value: BatchStatus.CERTIFIED },
];

const CAN_CREATE_ROLES: UserRole[] = [UserRole.FARMER, UserRole.ADMIN];

export default function BatchListScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<BatchStatus | null>(null);

  const {
    data: batches = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Batch[]>({
    queryKey: ['batches'],
    queryFn: batchesApi.list,
  });

  const canCreate = user ? CAN_CREATE_ROLES.includes(user.role) : false;

  const filteredBatches = useMemo(() => {
    let result = batches;

    if (activeFilter) {
      result = result.filter((b) => b.status === activeFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (b) =>
          b.code.toLowerCase().includes(q) ||
          b.origin_farm.toLowerCase().includes(q) ||
          b.origin_city.toLowerCase().includes(q)
      );
    }

    return result;
  }, [batches, activeFilter, search]);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>📦</Text>
        <Text style={styles.emptyTitle}>Nenhum lote encontrado</Text>
        <Text style={styles.emptySubtitle}>
          {search || activeFilter
            ? 'Tente ajustar os filtros de busca'
            : 'Crie seu primeiro lote de café'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.gradientStart, Colors.gradientEnd]}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Meus Lotes</Text>
            <TouchableOpacity style={styles.headerIcon} activeOpacity={0.7}>
              <Ionicons name="search" size={22} color={Colors.textInverted} />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchWrapper}>
            <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por código ou fazenda..."
              placeholderTextColor={Colors.textMuted}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Filter chips */}
      <View style={styles.filterContainer}>
        <FlatList
          data={FILTER_CHIPS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.value ?? 'all'}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                activeFilter === item.value && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(item.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === item.value && styles.filterChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Batch list */}
      {isLoading ? (
        <ActivityIndicator
          color={Colors.primary}
          size="large"
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={filteredBatches}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BatchCard
              batch={item}
              onPress={() => router.push(`/(app)/batches/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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

      {/* FAB */}
      {canCreate && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(app)/batches/create')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color={Colors.textInverted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textInverted,
  },
  headerIcon: {
    padding: 4,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    padding: 0,
  },
  filterContainer: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterList: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.textInverted,
  },
  loader: {
    marginTop: 60,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 96,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
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
