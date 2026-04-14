import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { qrApi } from '@/services/api';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const lastScanned = useRef<string | null>(null);

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (!scanning || loading) return;

    // Evita processar o mesmo QR duas vezes seguidas
    if (lastScanned.current === data) return;
    lastScanned.current = data;
    setScanning(false);
    setLoading(true);

    try {
      const info = await qrApi.info(data);

      if (info.is_consumer) {
        router.push({ pathname: '/(app)/scan/trace', params: { token: data } });
      } else if (!info.is_active) {
        Alert.alert('QR Expirado', 'Este QR code já foi utilizado.', [
          { text: 'OK', onPress: resetScanner },
        ]);
      } else {
        router.push({ pathname: '/(app)/scan/process', params: { token: data } });
      }
    } catch {
      Alert.alert('Erro', 'QR code não reconhecido ou inválido.', [
        { text: 'OK', onPress: resetScanner },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function resetScanner() {
    lastScanned.current = null;
    setScanning(true);
  }

  // Permissão não carregada
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  // Permissão negada
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Ionicons name="camera-outline" size={64} color={Colors.textMuted} />
        <Text style={styles.permissionTitle}>Acesso à Câmera</Text>
        <Text style={styles.permissionText}>
          Precisamos de acesso à câmera para escanear os QR codes da cadeia do café.
        </Text>
        <Button title="Permitir Câmera" onPress={requestPermission} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
      >
        <SafeAreaView style={styles.overlay} edges={['top']}>
          <Text style={styles.title}>Escanear QR Code</Text>
          <Text style={styles.subtitle}>
            Aponte a câmera para o QR code do lote
          </Text>
        </SafeAreaView>

        {/* Crosshair frame */}
        <View style={styles.frameContainer}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={Colors.textInverted} size="large" />
            <Text style={styles.loadingText}>Processando...</Text>
          </View>
        )}

        {!scanning && !loading && (
          <View style={styles.bottomActions}>
            <Button title="Escanear Novamente" onPress={resetScanner} />
          </View>
        )}
      </CameraView>
    </View>
  );
}

const CORNER_SIZE = 28;
const CORNER_WIDTH = 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 40,
    gap: 16,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    alignItems: 'center',
    paddingTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textInverted,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  frameContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: Colors.textInverted,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: Colors.textInverted,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: Colors.textInverted,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: Colors.textInverted,
    borderBottomRightRadius: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: Colors.textInverted,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 60,
    left: 24,
    right: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  permissionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
});
