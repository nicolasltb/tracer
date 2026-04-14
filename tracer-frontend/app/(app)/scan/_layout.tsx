import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function ScanLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="process" />
      <Stack.Screen name="trace" />
    </Stack>
  );
}
