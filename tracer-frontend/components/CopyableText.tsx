import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '@/constants/colors';

interface TruncateConfig {
  head: number;
  tail: number;
}

function truncateMiddle(value: string, { head, tail }: TruncateConfig): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

interface CopyableTextProps {
  /** String completa — é sempre essa que vai pra área de transferência. */
  value: string;
  /** Trunca o que é exibido. `true` usa head=10, tail=8. Default: não trunca. */
  truncate?: boolean | TruncateConfig;
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  iconSize?: number;
  /** Label opcional anunciado em alerta após copiar (ex: "Endereço copiado"). */
  copiedLabel?: string;
}

const DEFAULT_TRUNCATE: TruncateConfig = { head: 10, tail: 8 };

export function CopyableText({
  value,
  truncate,
  textStyle,
  containerStyle,
  iconSize = 14,
  copiedLabel,
}: CopyableTextProps) {
  const [copied, setCopied] = useState(false);

  const display = (() => {
    if (!truncate) return value;
    const cfg = truncate === true ? DEFAULT_TRUNCATE : truncate;
    return truncateMiddle(value, cfg);
  })();

  async function handleCopy() {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.text, textStyle]} numberOfLines={1} ellipsizeMode="middle">
        {display}
      </Text>
      <TouchableOpacity
        onPress={handleCopy}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={copiedLabel ?? 'Copiar'}
        style={styles.iconButton}
      >
        <Ionicons
          name={copied ? 'checkmark' : 'copy-outline'}
          size={iconSize}
          color={copied ? Colors.success : Colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  text: {
    flexShrink: 1,
  },
  iconButton: {
    padding: 2,
  },
});
