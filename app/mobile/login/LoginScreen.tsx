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
  ScrollView
} from 'react-native';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection } from "firebase/firestore";
import { useRouter } from 'expo-router';
import { app } from '../../assets/firebaseConfig'; // adjust path as needed

const auth = getAuth(app);
const firestore = getFirestore(app);

const professions = [
  'Компьютерийн ухаан',
  'Механик инженер',
  'Барилга инженер',
  'Био инженер',
  'Цахилгаан инженер',
  'Ерөнхий эрдэм',
  'Гадаад хэл',
  'Бусад'
];

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [profession, setProfession] = useState(professions[0]);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Handles both login and signup flows
  const handleAuth = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    if (isSignUp && (!name || (role === 'teacher' && !phoneNumber))) {
      setError('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      if (isSignUp) {
        // Create the user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Prepare user data
        const userData = {
          uid: user.uid,
          email,
          name,
          createdAt: new Date()
        };
        
        if (role === 'teacher') {
          // Save teacher-specific data in the teachers collection
          await setDoc(doc(firestore, 'teachers', user.uid), {
            ...userData,
            phoneNumber,
            profession,
            approval: 'pending',
            lastActiveTime: new Date()
          });
        } else {
          // Save student-specific data in the students collection
          await setDoc(doc(firestore, 'students', user.uid), {
            ...userData,
            approval: 'pending'
          });
        }
  
        // Inform the user that their account is pending approval
        setError('Your account is pending approval. Please wait for admin approval.');
      } else {
        // Sign in the user
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Check if user exists in teachers collection
        const teacherDoc = await getDoc(doc(firestore, 'teachers', user.uid));
        
        if (teacherDoc.exists()) {
          const teacherData = teacherDoc.data();
          
          if (teacherData.approval === 'approved') {
            // Update last active time for teachers
            await setDoc(doc(firestore, 'teachers', user.uid), {
              lastActiveTime: new Date()
            }, { merge: true });
            
            router.replace('/mobile/teacher');
          } else if (teacherData.approval === 'pending') {
            setError('Your teacher account is still pending approval.');
          } else if (teacherData.approval === 'declined') {
            setError('Your teacher account has been declined.');
          }
        } else {
          // Check if user exists in students collection
          const studentDoc = await getDoc(doc(firestore, 'students', user.uid));
          
          if (studentDoc.exists()) {
            const studentData = studentDoc.data();
            
            if (studentData.approval === 'approved') {
              router.replace('/mobile/student');
            } else if (studentData.approval === 'pending') {
              setError('Your student account is still pending approval.');
            } else if (studentData.approval === 'declined') {
              setError('Your student account has been declined.');
            }
          } else {
            setError('Account not found. Please sign up first.');
          }
        }
      }
    } catch (err: any) {
      setError(err.message.includes('auth/') 
        ? 'Invalid email or password' 
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/logo.png')} // Add your app logo or adjust the path
              style={styles.logo}
              defaultSource={require('../../assets/logo-placeholder.png')} // Fallback placeholder
            />
            <Text style={styles.appName}>Багшийн байршил тогтоогч</Text>
          </View>
          
          <View style={styles.formContainer}>
            <Text style={styles.header}>{isSignUp ? 'Бүртгэл үүсгэх' : 'Тавтай морил'}</Text>
            <Text style={styles.subHeader}>
              {isSignUp ? 'Шинэ бүртгэл үүсгэх' : 'Үргэлжлүүлэн нэвтрэх'}
            </Text>
            
            {error !== '' && (
              <View style={styles.errorContainer}>
                <Text style={styles.error}>{error}</Text>
              </View>
            )}
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>И-мейл</Text>
              <TextInput
                style={styles.input}
                placeholder="И-мейлээ оруулана уу"
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
                placeholder="Нууц үгээ оруулана уу"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
            
            {isSignUp && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Бүтэн Нэр</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Бүтэн нэрээ оруулана уу"
                    value={name}
                    onChangeText={setName}
                  />
                </View>
                
                <View style={styles.roleContainer}>
                  <Text style={styles.label}>Эрх сонгох:</Text>
                  <View style={styles.roles}>
                    <TouchableOpacity
                      style={[styles.roleButton, role === 'teacher' && styles.selectedRole]}
                      onPress={() => setRole('teacher')}
                    >
                      <Text style={[styles.roleText, role === 'teacher' && styles.selectedRoleText]}>
                        Багш
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.roleButton, role === 'student' && styles.selectedRole]}
                      onPress={() => setRole('student')}
                    >
                      <Text style={[styles.roleText, role === 'student' && styles.selectedRoleText]}>
                        Оюутан
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {role === 'teacher' && (
                  <>
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Утасны дугаар</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Утасны дугаараа оруулана уу"
                        value={phoneNumber}
                        keyboardType="phone-pad"
                        onChangeText={setPhoneNumber}
                      />
                    </View>
                    
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Тэнхим</Text>
                      <View style={styles.professionList}>
                        {professions.map((prof) => (
                          <TouchableOpacity
                            key={prof}
                            style={[styles.professionButton, profession === prof && styles.selectedProfession]}
                            onPress={() => setProfession(prof)}
                          >
                            <Text 
                              style={[
                                styles.professionText, 
                                profession === prof && styles.selectedProfessionText
                              ]}
                            >
                              {prof}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </>
                )}
              </>
            )}
            
            <TouchableOpacity 
              style={styles.button} 
              onPress={handleAuth} 
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{isSignUp ? 'Бүртгүүлэх' : 'Нэвтрэх'}</Text>
              )}
            </TouchableOpacity>
            
            {!isSignUp && (
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Нууц үг мартсан</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              onPress={() => setIsSignUp(!isSignUp)}
              style={styles.toggleContainer}
            >
              <Text style={styles.toggleText}>
                {isSignUp ? 'Аль хэдийн бүртгүүлсэн ' : "Бүртгэл байхгүй байна "}
                <Text style={styles.toggleTextBold}>
                  {isSignUp ? 'Нэвтрэх' : 'Бүртгүүлэх'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 30
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 30
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
  formContainer: {
    paddingHorizontal: 30,
  },
  header: { 
    fontSize: 28,
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
    backgroundColor: '#3498db',
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
  forgotPassword: {
    alignItems: 'center',
    marginTop: 15,
  },
  forgotPasswordText: {
    color: '#3498db',
    fontSize: 14,
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
  },
  roleContainer: { 
    marginBottom: 15,
  },
  roles: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  roleButton: { 
    flex: 1,
    padding: 15,
    borderWidth: 1, 
    borderColor: '#ddd',
    borderRadius: 10,
    marginHorizontal: 5,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  selectedRole: { 
    borderColor: '#3498db',
    backgroundColor: '#e3f2fd',
  },
  roleText: { 
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  selectedRoleText: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  professionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  professionButton: {
    width: '48%',
    padding: 12,
    margin: '1%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  selectedProfession: {
    borderColor: '#3498db',
    backgroundColor: '#e3f2fd',
  },
  professionText: {
    color: '#666',
    fontSize: 14,
  },
  selectedProfessionText: {
    color: '#3498db',
    fontWeight: 'bold',
  }
});

export default LoginScreen;