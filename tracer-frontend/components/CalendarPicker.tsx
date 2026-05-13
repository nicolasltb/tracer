import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const CELL_SIZE = 40;

interface CalendarPickerProps {
  value: string; // YYYY-MM-DD ou ''
  onConfirm: (iso: string) => void;
  onClose: () => void;
  disableFuture?: boolean;
}

export function CalendarPicker({
  value,
  onConfirm,
  onClose,
  disableFuture = true,
}: CalendarPickerProps) {
  const today = new Date();
  const initial = value ? new Date(value + 'T12:00:00') : today;
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const [selected, setSelected] = useState(value);

  function daysInMonth(y: number, m: number) {
    return new Date(y, m + 1, 0).getDate();
  }
  function firstDayOfWeek(y: number, m: number) {
    return (new Date(y, m, 1).getDay() + 6) % 7;
  }
  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (disableFuture) {
      const next = new Date(year, month + 1, 1);
      if (next > today) return;
    }
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else setMonth((m) => m + 1);
  }
  function isFuture(d: number) {
    return disableFuture && new Date(year, month, d) > today;
  }
  function toIso(d: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const totalDays = daysInMonth(year, month);
  const offset = firstDayOfWeek(year, month);
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isNextDisabled = disableFuture && new Date(year, month + 1, 1) > today;

  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity
          onPress={nextMonth}
          style={styles.navBtn}
          activeOpacity={0.7}
          disabled={isNextDisabled}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={isNextDisabled ? Colors.border : Colors.primary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
          <Text key={d} style={styles.weekDay}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={styles.cell} />;
          const iso = toIso(day);
          const isSelected = iso === selected;
          const disabled = isFuture(day);
          return (
            <TouchableOpacity
              key={iso}
              style={[
                styles.cell,
                isSelected && styles.cellSelected,
                disabled && styles.cellDisabled,
              ]}
              onPress={() => !disabled && setSelected(iso)}
              activeOpacity={0.7}
              disabled={disabled}
            >
              <Text
                style={[
                  styles.dayText,
                  isSelected && styles.dayTextSelected,
                  disabled && styles.dayTextDisabled,
                ]}
              >
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, !selected && styles.confirmBtnDisabled]}
          onPress={() => selected && onConfirm(selected)}
          activeOpacity={0.7}
          disabled={!selected}
        >
          <Text style={styles.confirmText}>Confirmar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Modal wrapper para uso direto em telas. */
export function CalendarPickerModal({
  visible,
  value,
  onConfirm,
  onClose,
  disableFuture = true,
}: CalendarPickerProps & { visible: boolean }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <CalendarPicker
        value={value}
        onConfirm={onConfirm}
        onClose={onClose}
        disableFuture={disableFuture}
      />
    </Modal>
  );
}

export function formatDisplayDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: { padding: 6 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDay: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CELL_SIZE / 2,
  },
  cellSelected: { backgroundColor: Colors.primary },
  cellDisabled: { opacity: 0.3 },
  dayText: { fontSize: 14, color: Colors.textPrimary },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dayTextDisabled: { color: Colors.textMuted },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
});
