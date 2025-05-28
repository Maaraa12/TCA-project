import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  SafeAreaView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { useRouter } from 'expo-router';
import { app } from '@/app/assets/firebaseConfig'; // adjust path as needed

const auth = getAuth(app);
const firestore = getFirestore(app);

const AdminLoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleAdminLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Sign in the admin
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Check if user is an admin
      const adminDoc = await getDoc(doc(firestore, 'admins', user.uid));
      
      if (adminDoc.exists()) {
        // Navigate to admin dashboard
        router.replace('../../mobile/admin/dashboard/AdminDashboard');
      } else {
        // User is not an admin
        setError('Access denied. This interface is for administrators only.');
        auth.signOut(); // Sign out the non-admin user
      }
    } catch (err) {
      setError('Invalid email or password');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Navigate back to main login
  const goToMainLogin = () => {
    router.replace('/mobile/login/LoginScreen');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/logo.png')}
              style={styles.logo}
              defaultSource={require('../../assets/logo-placeholder.png')}
            />
            <Text style={styles.appName}>Багшийн байршил тогтоогч</Text>
            <Text style={styles.adminLabel}>Админ хэсэг</Text>
          </View>
          
          <View style={styles.formContainer}>
            <Text style={styles.header}>Админ нэвтрэх хэсэг</Text>
            <Text style={styles.subHeader}>Багшийн байршил тогтоогчыг удирдахын тулд нэвтэрнэ үү.</Text>
            
            {error !== '' && (
              <View style={styles.errorContainer}>
                <Text style={styles.error}>{error}</Text>
              </View>
            )}
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>И-мейл</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter admin email"
                value={email}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Нууц үг</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
            
            <TouchableOpacity 
              style={styles.button} 
              onPress={handleAdminLogin} 
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Нэвтрэх</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={goToMainLogin}
              style={styles.toggleContainer}
            >
              <Text style={styles.toggleTextBold}>
                Үндсэн нэвтрэх <Text style={styles.toggleText}>хэсэг рүү буцах</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#3498db',
  },
  adminLabel: {
    fontSize: 16,
    color: '#e74c3c',
    fontWeight: '600',
    marginTop: 5,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  header: { 
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  subHeader: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  error: { 
    color: '#d32f2f',
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    fontWeight: '500',
  },
  input: { 
    height: 55,
    borderWidth: 1, 
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    fontSize: 16,
  },
  button: { 
    backgroundColor: '#e74c3c',
    paddingVertical: 15, 
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: { 
    color: '#fff', 
    fontSize: 18,
    fontWeight: '600',
  },
  toggleContainer: {
    alignItems: 'center',
    marginTop: 25,
  },
  toggleText: { 
    color: '#666',
    fontSize: 14,
  },
  toggleTextBold: {
    color: '#3498db',
    fontWeight: 'bold',
  }
});

export default AdminLoginScreen;