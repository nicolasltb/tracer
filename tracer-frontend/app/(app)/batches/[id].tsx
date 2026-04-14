import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { StatusBadge } from '@/components/StatusBadge';
import { EventItem } from '@/components/EventItem';
import { batchesApi, qrApi } from '@/services/api';
import { BatchDetail, CoffeeType } from '@/types';

const COFFEE_TYPE_LABEL: Record<CoffeeType, string> = {
  [CoffeeType.ARABICA]: 'Arábica',
  [CoffeeType.ROBUSTA]: 'Robusta',
  [CoffeeType.BLEND]: 'Blend',
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function truncateHash(hash: string): string {
  if (hash.length <= 20) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-10)}`;
}

interface InfoCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

function InfoCard({ icon, label, value }: InfoCardProps) {
  return (
    <View style={styles.infoCard}>
      <Ionicons name={icon} size={18} color={Colors.primary} style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function BatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    data: batch,
    isLoading,
    isError,
    refetch,
  } = useQuery<BatchDetail>({
    queryKey: ['batch', id],
    queryFn: () => batchesApi.get(id),
    enabled: !!id,
  });

  const { data: activeQr } = useQuery({
    queryKey: ['batch-qr', id],
    queryFn: () => qrApi.batchActiveQr(id),
    enabled: !!id,
    retry: false,
  });

  const [shareLoading, setShareLoading] = useState(false);

  async function handleShare(token: string) {
    try {
      setShareLoading(true);
      const localUri = (FileSystem.cacheDirectory ?? '') + `qr_${token}.png`;
      await FileSystem.downloadAsync(qrApi.imageUrl(token), localUri);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Indisponível', 'O compartilhamento não está disponível neste dispositivo.');
        return;
      }
      await Sharing.shareAsync(localUri, {
        mimeType: 'image/png',
        dialogTitle: 'Compartilhar QR Code',
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível compartilhar o QR code.');
    } finally {
      setShareLoading(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (isError || !batch) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Text style={styles.errorText}>Falha ao carregar lote</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[Colors.gradientStart, Colors.gradientEnd]}
          style={styles.header}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.headerContent}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={22} color={Colors.textInverted} />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerCode} numberOfLines={1}>
                  {batch.code}
                </Text>
                <StatusBadge status={batch.status} />
              </View>
              <View style={styles.backButton} />
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.body}>
          {/* Info grid — data read from blockchain */}
          <Text style={styles.sectionTitle}>Informações do Lote</Text>
          {batch.chain ? (
            <View style={styles.infoGrid}>
              <InfoCard
                icon="cafe-outline"
                label="Tipo de Café"
                value={COFFEE_TYPE_LABEL[batch.chain.coffee_type as CoffeeType] ?? batch.chain.coffee_type ?? '-'}
              />
              <InfoCard
                icon="scale-outline"
                label="Peso"
                value={batch.chain.weight_kg ? `${batch.chain.weight_kg} kg` : '-'}
              />
              <InfoCard
                icon="leaf-outline"
                label="Fazenda"
                value={batch.chain.origin_farm ?? '-'}
              />
              <InfoCard
                icon="location-outline"
                label="Cidade/Estado"
                value={batch.chain.origin_city && batch.chain.origin_state
                  ? `${batch.chain.origin_city}, ${batch.chain.origin_state}`
                  : '-'}
              />
              <InfoCard
                icon="calendar-outline"
                label="Data da Colheita"
                value={batch.chain.harvest_date ? formatDate(batch.chain.harvest_date) : '-'}
              />
              <InfoCard
                icon="time-outline"
                label="Criado em"
                value={formatDate(batch.created_at)}
              />
            </View>
          ) : (
            <View style={styles.emptyEvents}>
              <Text style={styles.emptyEventsText}>
                Dados do lote ainda não registrados na blockchain
              </Text>
            </View>
          )}

          {/* Description */}
          {batch.chain?.description ? (
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionTitle}>Descrição</Text>
              <Text style={styles.descriptionText}>{batch.chain.description}</Text>
            </View>
          ) : null}

          {/* Blockchain info */}
          {batch.tx_hash ? (
            <View style={styles.blockchainCard}>
              <View style={styles.blockchainHeader}>
                <Ionicons name="link-outline" size={18} color={Colors.status.in_transit} />
                <Text style={styles.blockchainTitle}>Blockchain</Text>
              </View>
              <Text style={styles.txHash}>{truncateHash(batch.tx_hash)}</Text>
            </View>
          ) : null}

          {/* QR Code ativo */}
          {activeQr && (
            <View style={styles.qrSection}>
              <Text style={styles.sectionTitle}>QR Code</Text>
              <View style={styles.qrCard}>
                <Image
                  source={{ uri: qrApi.imageUrl(activeQr.token) }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
                <Text style={styles.qrDescription}>
                  {activeQr.is_consumer
                    ? 'QR para o consumidor final visualizar o rastreio.'
                    : `Próxima etapa: ${activeQr.next_status ?? ''}`}
                </Text>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => handleShare(activeQr.token)}
                  activeOpacity={0.75}
                  disabled={shareLoading}
                >
                  {shareLoading ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Ionicons name="share-outline" size={18} color={Colors.primary} />
                  )}
                  <Text style={styles.shareButtonText}>
                    {shareLoading ? 'Preparando...' : 'Compartilhar QR Code'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Events timeline — data from blockchain */}
          <View style={styles.eventsSection}>
            <Text style={styles.sectionTitle}>Linha do Tempo</Text>
            {batch.events.length === 0 ? (
              <View style={styles.emptyEvents}>
                <Text style={styles.emptyEventsText}>
                  Nenhum evento registrado na blockchain ainda
                </Text>
              </View>
            ) : (
              batch.events.map((event, index) => (
                <EventItem
                  key={`${event.event_type}-${event.block_number}`}
                  event={event}
                  isLast={index === batch.events.length - 1}
                />
              ))
            )}
          </View>
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
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  retryText: {
    color: Colors.textInverted,
    fontWeight: '600',
  },
  header: {
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  backButton: {
    width: 36,
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  headerCode: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textInverted,
  },
  body: {
    marginTop: -12,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 16,
  },
  infoCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoIcon: {
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  descriptionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.secondary,
  },
  descriptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  descriptionText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  blockchainCard: {
    backgroundColor: Colors.status.in_transitBg,
    borderRadius: 14,
    marginHorizontal: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.status.in_transit + '40',
  },
  blockchainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  blockchainTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.status.in_transit,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  txHash: {
    fontSize: 12,
    color: Colors.status.in_transit,
    fontFamily: 'monospace' as 'monospace',
  },
  qrSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  qrCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  qrDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  eventsSection: {
    marginTop: 8,
  },
  emptyEvents: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyEventsText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
