// app/index.tsx
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Replace 'mobile/login' with the correct route path based on your file structure
    router.replace('mobile/login');
  }, []);

  return null;
}
