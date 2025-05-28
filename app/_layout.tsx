// app/mobile/_layout.tsx
import { Stack } from 'expo-router';

export default function MobileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login/LoginScreen" />
      <Stack.Screen name="student/index" />
      <Stack.Screen name="teacher/index" />
    </Stack>
  );
}