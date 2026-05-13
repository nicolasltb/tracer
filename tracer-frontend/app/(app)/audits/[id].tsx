import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { auditsApi, documentsApi } from '@/services/api';
import {
  ALL_REQUIREMENTS,
  AuditDetail,
  AuditStatus,
  AuditSubmitResponse,
  ComplianceStatus,
  DocumentType,
  REQUIREMENT_LABELS,
  RequirementCode,
} from '@/types';

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  [ComplianceStatus.CONFORME]: 'Conforme',
  [ComplianceStatus.NAO_CONFORME]: 'Não conforme',
  [ComplianceStatus.NAO_APLICAVEL]: 'Não aplicável',
};

const STATUS_COLORS: Record<ComplianceStatus, string> = {
  [ComplianceStatus.CONFORME]: Colors.success,
  [ComplianceStatus.NAO_CONFORME]: Colors.error,
  [ComplianceStatus.NAO_APLICAVEL]: Colors.textMuted,
};

function statusIcon(s: ComplianceStatus | null): keyof typeof Ionicons.glyphMap {
  if (s === ComplianceStatus.CONFORME) return 'checkmark-circle';
  if (s === ComplianceStatus.NAO_CONFORME) return 'close-circle';
  if (s === ComplianceStatus.NAO_APLICAVEL) return 'remove-circle';
  return 'ellipse-outline';
}

export default function AuditDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [activeCheck, setActiveCheck] = useState<RequirementCode | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitResult, setSubmitResult] = useState<AuditSubmitResponse | null>(null);

  const { data: audit, isLoading } = useQuery<AuditDetail>({
    queryKey: ['audit', id],
    queryFn: () => auditsApi.get(id),
    enabled: !!id,
  });

  const checksByCode = useMemo(() => {
    if (!audit) return {} as Record<RequirementCode, AuditDetail['checks'][number]>;
    return audit.checks.reduce((acc, c) => {
      acc[c.requirement_code] = c;
      return acc;
    }, {} as Record<RequirementCode, AuditDetail['checks'][number]>);
  }, [audit]);

  const isDraft = audit?.status === AuditStatus.DRAFT;
  const completedCount = audit?.checks.length ?? 0;

  if (isLoading || !audit) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Auditoria · {isDraft ? 'Rascunho' : 'Submetida'}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <Text style={styles.summaryNum}>
            {completedCount}/{ALL_REQUIREMENTS.length}
          </Text>
          <Text style={styles.summaryLabel}>requisitos avaliados</Text>
          {audit.latitude && audit.longitude && (
            <Text style={styles.summaryGps}>
              📍 {Number(audit.latitude).toFixed(5)}, {Number(audit.longitude).toFixed(5)}
            </Text>
          )}
        </View>

        {ALL_REQUIREMENTS.map((code) => {
          const check = checksByCode[code];
          const status = check?.status ?? null;
          const color = status ? STATUS_COLORS[status] : Colors.border;
          return (
            <TouchableOpacity
              key={code}
              style={[styles.checkCard, { borderLeftColor: color }]}
              onPress={() => isDraft && setActiveCheck(code)}
              activeOpacity={isDraft ? 0.7 : 1}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.checkCode}>{code}</Text>
                <Text style={styles.checkLabel} numberOfLines={2}>
                  {REQUIREMENT_LABELS[code]}
                </Text>
                {check?.evidence_doc_ids?.length ? (
                  <Text style={styles.evidenceCount}>
                    📎 {check.evidence_doc_ids.length} evidência{check.evidence_doc_ids.length > 1 ? 's' : ''}
                  </Text>
                ) : null}
              </View>
              <Ionicons
                name={statusIcon(status)}
                size={26}
                color={status ? color : Colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}

        {isDraft && (
          <View style={{ marginTop: 16 }}>
            <Button
              title="Submeter Auditoria"
              onPress={() => setSubmitOpen(true)}
              disabled={completedCount < ALL_REQUIREMENTS.length}
            />
            {completedCount < ALL_REQUIREMENTS.length && (
              <Text style={styles.hint}>
                Preencha os {ALL_REQUIREMENTS.length - completedCount} requisito(s) restante(s)
                antes de submeter.
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <CheckEditModal
        visible={activeCheck !== null}
        code={activeCheck}
        auditId={audit.id}
        propertyId={audit.property_id}
        existing={activeCheck ? checksByCode[activeCheck] : undefined}
        onClose={() => setActiveCheck(null)}
      />

      <SubmitAuditModal
        visible={submitOpen}
        auditId={audit.id}
        onClose={() => setSubmitOpen(false)}
        onDone={(res) => {
          setSubmitOpen(false);
          setSubmitResult(res);
        }}
      />

      <SubmitResultModal
        result={submitResult}
        onClose={() => {
          setSubmitResult(null);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.replace({ pathname: '/(app)/audits' as any });
        }}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────
// Check edit modal
// ─────────────────────────────────────────────────────────────────

function CheckEditModal({
  visible,
  code,
  auditId,
  propertyId,
  existing,
  onClose,
}: {
  visible: boolean;
  code: RequirementCode | null;
  auditId: string;
  propertyId: string;
  existing: AuditDetail['checks'][number] | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ComplianceStatus | null>(
    existing?.status ?? null
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [evidenceIds, setEvidenceIds] = useState<string[]>(
    existing?.evidence_doc_ids ?? []
  );
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    setStatus(existing?.status ?? null);
    setNotes(existing?.notes ?? '');
    setEvidenceIds(existing?.evidence_doc_ids ?? []);
  }, [existing, code]);

  const save = useMutation({
    mutationFn: () => {
      if (!code || !status) throw new Error('Estado inválido.');
      return auditsApi.upsertCheck(auditId, {
        requirement_code: code,
        status,
        notes: notes.trim() || null,
        evidence_doc_ids: evidenceIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit', auditId] });
      onClose();
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Não foi possível salvar o check.';
      Alert.alert('Erro', String(detail));
    },
  });

  async function pickAndUpload(source: 'camera' | 'library') {
    try {
      let result;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permissão', 'Acesso à câmera negado.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permissão', 'Acesso à galeria negado.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
        });
      }
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setUploading(true);
      const doc = await documentsApi.upload({
        uri: asset.uri,
        name: asset.fileName ?? `evidence-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
        docType: DocumentType.AUDIT_EVIDENCE,
        propertyId,
        auditId,
      });
      setEvidenceIds((prev) => [...prev, doc.id]);
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Falha ao enviar a foto.';
      Alert.alert('Erro', String(detail));
    } finally {
      setUploading(false);
    }
  }

  function offerSources() {
    Alert.alert('Adicionar evidência', undefined, [
      { text: 'Câmera', onPress: () => pickAndUpload('camera') },
      { text: 'Galeria', onPress: () => pickAndUpload('library') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function removeEvidence(docId: string) {
    setEvidenceIds((prev) => prev.filter((id) => id !== docId));
  }

  if (!code) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetCode}>{code}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sheetLabel}>{REQUIREMENT_LABELS[code]}</Text>

            <Text style={styles.fieldLabel}>Avaliação</Text>
            <View style={styles.statusRow}>
              {(Object.keys(STATUS_LABELS) as ComplianceStatus[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.statusBtn,
                    status === s && { backgroundColor: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] },
                  ]}
                  onPress={() => setStatus(s)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.statusBtnText,
                      status === s && { color: Colors.textInverted, fontWeight: '700' },
                    ]}
                  >
                    {STATUS_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Observações</Text>
            <TextInput
              style={[styles.input, { height: 96, paddingTop: 12 }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Anote o que observou durante a visita..."
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.fieldLabel}>Evidências fotográficas</Text>
            <View style={styles.evidenceGrid}>
              {evidenceIds.map((docId) => (
                <View key={docId} style={styles.thumbWrap}>
                  <Image
                    source={{ uri: documentsApi.fileUrl(docId) }}
                    style={styles.thumb}
                  />
                  <TouchableOpacity
                    style={styles.thumbRemove}
                    onPress={() => removeEvidence(docId)}
                  >
                    <Ionicons name="close" size={14} color={Colors.textInverted} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={styles.thumbAdd}
                onPress={offerSources}
                disabled={uploading}
                activeOpacity={0.7}
              >
                {uploading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <Ionicons name="camera-outline" size={26} color={Colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 12 }}>
              <Button
                title="Salvar"
                onPress={() => {
                  if (!status) {
                    Alert.alert('Atenção', 'Selecione uma avaliação para este requisito.');
                    return;
                  }
                  save.mutate();
                }}
                loading={save.isPending}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// Submit modal — captures GPS and submits
// ─────────────────────────────────────────────────────────────────

function SubmitAuditModal({
  visible,
  auditId,
  onClose,
  onDone,
}: {
  visible: boolean;
  auditId: string;
  onClose: () => void;
  onDone: (res: AuditSubmitResponse) => void;
}) {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: () => {
      if (!coords) throw new Error('GPS não capturado.');
      return auditsApi.submit(auditId, {
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['audit', auditId] });
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      queryClient.invalidateQueries({ queryKey: ['property-cert', res.property_id] });
      onDone(res);
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Falha ao submeter a auditoria.';
      Alert.alert('Erro', String(detail));
    },
  });

  async function captureGps() {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão', 'Acesso à localização negado.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível obter sua posição.');
    } finally {
      setLocating(false);
    }
  }

  React.useEffect(() => {
    if (visible && !coords && !locating) {
      captureGps();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.confirmWrap}>
        <View style={styles.confirmCard}>
          <Ionicons name="navigate-outline" size={36} color={Colors.primary} />
          <Text style={styles.confirmTitle}>Submeter auditoria</Text>
          <Text style={styles.confirmText}>
            A posição GPS abaixo será gravada como prova da auditoria no campo. Após submetida,
            a auditoria torna-se imutável.
          </Text>

          {locating ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 12 }} />
          ) : coords ? (
            <View style={styles.gpsBox}>
              <Ionicons name="location" size={18} color={Colors.success} />
              <Text style={styles.gpsText}>
                {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
              </Text>
            </View>
          ) : (
            <TouchableOpacity onPress={captureGps} style={styles.gpsRetry}>
              <Text style={styles.gpsRetryText}>Tentar capturar GPS novamente</Text>
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <Button
              title="Cancelar"
              variant="outline"
              onPress={onClose}
              fullWidth={false}
              style={{ flex: 1 }}
            />
            <Button
              title="Confirmar"
              onPress={() => submit.mutate()}
              loading={submit.isPending}
              disabled={!coords}
              fullWidth={false}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// Result modal — shows cert outcome
// ─────────────────────────────────────────────────────────────────

function SubmitResultModal({
  result,
  onClose,
}: {
  result: AuditSubmitResponse | null;
  onClose: () => void;
}) {
  if (!result) return null;

  const issued = result.certification_issued;
  return (
    <Modal visible animationType="fade" transparent>
      <View style={styles.overlay} />
      <View style={styles.confirmWrap}>
        <View style={styles.confirmCard}>
          <Ionicons
            name={issued ? 'ribbon' : 'alert-circle'}
            size={48}
            color={issued ? Colors.success : Colors.warning}
          />
          <Text style={styles.confirmTitle}>
            {issued ? 'Certificação emitida' : 'Auditoria submetida'}
          </Text>
          <Text style={styles.confirmText}>
            {issued
              ? 'A propriedade recebeu a certificação Certifica Minas, válida por 12 meses. O hash foi enviado para a blockchain.'
              : result.certification_reason ??
                'A auditoria foi submetida, mas a certificação não foi emitida.'}
          </Text>
          <View style={{ marginTop: 16, width: '100%' }}>
            <Button title="Fechar" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  content: { padding: 16, paddingBottom: 40 },
  summary: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryNum: { fontSize: 32, fontWeight: '800', color: Colors.primary },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  summaryGps: { fontSize: 12, color: Colors.textMuted, marginTop: 6 },

  checkCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkCode: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  checkLabel: { fontSize: 13, color: Colors.textPrimary, marginTop: 4, lineHeight: 18 },
  evidenceCount: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  hint: { fontSize: 12, color: Colors.textMuted, marginTop: 8, textAlign: 'center' },

  // Sheet
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetCode: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  sheetLabel: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20, marginBottom: 4 },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  statusBtnText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },

  evidenceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbWrap: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbAdd: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '08',
  },

  // Submit confirm
  confirmWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    gap: 8,
  },
  confirmTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  confirmText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
  },
  gpsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
  },
  gpsText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: Colors.success,
    fontWeight: '700',
  },
  gpsRetry: { padding: 8 },
  gpsRetryText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
});
