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
import { propertiesApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { Property, UserRole } from '@/types';

const CAN_CREATE: UserRole[] = [UserRole.FARMER, UserRole.ADMIN];

export default function PropertiesScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const {
    data: properties = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: propertiesApi.list,
  });

  const canCreate = user ? CAN_CREATE.includes(user.role) : false;

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🌾</Text>
        <Text style={styles.emptyTitle}>Nenhuma propriedade cadastrada</Text>
        <Text style={styles.emptySubtitle}>
          {canCreate
            ? 'Cadastre sua primeira propriedade para iniciar o processo de certificação Certifica Minas.'
            : 'Apenas produtores podem cadastrar propriedades.'}
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
              <Text style={styles.headerTitle}>Propriedades</Text>
              <Text style={styles.headerSubtitle}>
                Certifica Minas
              </Text>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="leaf-outline" size={26} color={Colors.textInverted} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {isLoading ? (
        <ActivityIndicator
          color={Colors.primary}
          size="large"
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PropertyCard
              property={item}
              onPress={() =>
                router.push({
                  pathname: '/(app)/properties/[id]',
                  params: { id: item.id },
                })
              }
            />
          )}
          contentContainerStyle={styles.listContent}
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
          onPress={() => router.push('/(app)/properties/create')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color={Colors.textInverted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function PropertyCard({
  property,
  onPress,
}: {
  property: Property;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      android_ripple={{ color: Colors.borderLight }}
    >
      <View style={styles.cardIcon}>
        <Ionicons name="map-outline" size={22} color={Colors.primary} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {property.name}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {property.municipality}, {property.state} · {property.total_area_ha} ha
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
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textInverted,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: { marginTop: 60 },
  listContent: {
    paddingTop: 16,
    paddingBottom: 96,
    flexGrow: 1,
  },
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
  cardPressed: { opacity: 0.94 },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1 },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
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
