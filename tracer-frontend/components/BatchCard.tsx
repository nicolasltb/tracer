import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Batch } from '@/types';
import { Colors } from '@/constants/colors';
import { StatusBadge, STATUS_CONFIG } from './StatusBadge';

interface BatchCardProps {
  batch: Batch;
  onPress: () => void;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function BatchCard({ batch, onPress }: BatchCardProps) {
  const statusConfig = STATUS_CONFIG[batch.status];
  const borderColor = statusConfig?.color ?? Colors.border;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      android_ripple={{ color: Colors.borderLight }}
    >
      <View style={[styles.leftBorder, { backgroundColor: borderColor }]} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.code} numberOfLines={1}>
            {batch.code}
          </Text>
          <StatusBadge status={batch.status} small />
        </View>

        <View style={styles.footer}>
          {batch.tx_hash ? (
            <View style={styles.chainBadge}>
              <Ionicons name="cube-outline" size={12} color={Colors.status.in_transit} />
              <Text style={styles.chainText}>On-chain</Text>
            </View>
          ) : (
            <View style={styles.chainBadge}>
              <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.pendingText}>Pendente</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.footerText}>{formatDate(batch.created_at)}</Text>
          </View>
        </View>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={Colors.textMuted}
        style={styles.chevron}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.95,
    shadowOpacity: 0.04,
    elevation: 1,
  },
  leftBorder: {
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  code: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  chainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
  },
  chainText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.status.in_transit,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  chevron: {
    alignSelf: 'center',
    paddingRight: 12,
  },
});
