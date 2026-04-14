import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BatchStatus } from '@/types';
import { Colors } from '@/constants/colors';

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

const STATUS_CONFIG: Record<BatchStatus, StatusConfig> = {
  [BatchStatus.HARVESTED]: {
    label: 'Colhido',
    color: Colors.status.harvested,
    bgColor: Colors.status.harvestedBg,
  },
  [BatchStatus.PROCESSING]: {
    label: 'Em Processo',
    color: Colors.status.processing,
    bgColor: Colors.status.processingBg,
  },
  [BatchStatus.ROASTING]: {
    label: 'Em Torra',
    color: Colors.status.roasting,
    bgColor: Colors.status.roastingBg,
  },
  [BatchStatus.IN_TRANSIT]: {
    label: 'Em Trânsito',
    color: Colors.status.in_transit,
    bgColor: Colors.status.in_transitBg,
  },
  [BatchStatus.DELIVERED]: {
    label: 'Entregue',
    color: Colors.status.delivered,
    bgColor: Colors.status.deliveredBg,
  },
  [BatchStatus.CERTIFIED]: {
    label: 'Certificado',
    color: Colors.status.certified,
    bgColor: Colors.status.certifiedBg,
  },
};

interface StatusBadgeProps {
  status: BatchStatus;
  small?: boolean;
}

export function StatusBadge({ status, small = false }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    color: Colors.textSecondary,
    bgColor: Colors.border,
  };

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bgColor },
        small && styles.badgeSmall,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: config.color },
          small && styles.labelSmall,
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

export { STATUS_CONFIG };

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  labelSmall: {
    fontSize: 11,
  },
});
