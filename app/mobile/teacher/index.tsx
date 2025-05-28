import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  SafeAreaView,
  Image,
  Modal
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, doc, updateDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { app } from '../../assets/firebaseConfig'; // adjust path as needed

const auth = getAuth(app);
const firestore = getFirestore(app);

const QRCodeScanner = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(60); // 60 seconds cooldown
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [lastScanTime, setLastScanTime] = useState(null);
  const navigation = useNavigation();
  
  // Get current user
  const user = auth.currentUser;
  
  useEffect(() => {
    // Request permission when the camera is activated
    if (isCameraActive && !permission?.granted) {
      requestPermission();
    }
  }, [isCameraActive, permission]);
  
  // Cooldown timer
  useEffect(() => {
    let interval;
    if (cooldownActive && cooldownTime > 0) {
      interval = setInterval(() => {
        setCooldownTime((prevTime) => {
          if (prevTime <= 1) {
            setCooldownActive(false);
            return 60; // Reset to 60 seconds for next time
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cooldownActive]);

  const activateCamera = () => {
    if (cooldownActive) {
      Alert.alert(
        'Cooldown Active', 
        `Please wait ${cooldownTime} seconds before scanning again.`
      );
      return;
    }
    setIsCameraActive(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Navigate to login screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Error signing out: ', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned) return; // Prevent multiple scans
    setScanned(true);
    
    try {
      // Parse room code
      let room = '';
      if (data.length === 2) {
        // Simple room mapping (e.g., '10' to 'G110')
        const roomMappings = {
          '10': 'G110',
          '11': 'G111',
          '12': 'G112',
          '20': 'G120',
          '21': 'G121',
          // Add more mappings as needed
        };
        room = roomMappings[data] || `Unknown Room (${data})`;
      } else if (data.length === 3) {
        // Handle 3-digit codes like 410 (4th floor, room 10)
        const floor = data.charAt(0);
        const roomNumber = data.substring(1);
        room = `${floor}${roomNumber}`;
      } else {
        room = `Room ${data}`;
      }

      if (user) {
        // Store the current time for cooldown calculation
        const currentTime = new Date();
        setLastScanTime(currentTime);
        
        // Ask for confirmation
        Alert.alert(
          'Тийм',
          `${room} энэ өрөөнд орох гэж байна уу?`,
          [
            {
              text: 'Үгүй',
              style: 'үгүй',
              onPress: () => setScanned(false)
            },
            {
              text: 'Тийм',
              onPress: async () => {
                try {
                  // Simplified location data - just the room number
                  const locationData = {
                    roomNumber: room,
                    timestamp: serverTimestamp()
                  };
                  
                  // 1. Update the teacher document in the teachers collection
                  // Make sure to preserve name and other fields
                  const teacherDocRef = doc(firestore, 'teachers', user.uid);
                  await setDoc(teacherDocRef, {
                    lastActiveTime: serverTimestamp(),
                    currentLocation: room, // Simplified to just the room string
                    approvalStatus: 'approved', // Ensure status is included
                  }, {merge: true});
                  
                  // 2. Also add to the user's scans subcollection for history tracking
                  const userScansRef = collection(doc(firestore, 'users', user.uid), 'scans');
                  const scanDocRef = await addDoc(userScansRef, {
                    room,
                    timestamp: serverTimestamp()
                  });
                  
                  // 3. Update the scans array in the teacher document directly
                  const now = new Date();
                  await updateDoc(teacherDocRef, {
                    scans: [{
                      room,
                      timestamp: now
                    }]
                  });
                  
                  // Add to local scan history for display
                  setScanHistory(prev => [
                    { 
                      id: scanDocRef.id, 
                      room, 
                      timestamp: currentTime.toLocaleTimeString() 
                    },
                    ...prev.slice(0, 9) // Keep only the last 10 scans
                  ]);
                  
                  Alert.alert('Check-in Successful', `You have entered ${room}.`);
                  setIsCameraActive(false);
                  
                  // Start cooldown
                  setCooldownActive(true);
                } catch (error) {
                  console.error('Error saving scan:', error);
                  Alert.alert('Error', 'Failed to save room check-in');
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', 'No authenticated user found.');
        setScanned(false);
      }
    } catch (error) {
      console.error('Error processing scan:', error);
      Alert.alert('Scan Error', 'Failed to process QR code.');
      setScanned(false);
    }
  };

  // Settings modal
  const SettingsModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={settingsVisible}
      onRequestClose={() => setSettingsVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Тохиргоо</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Унших хугацаа:</Text>
            <Text style={styles.settingValue}>1 минут</Text>
          </View>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Мэдэгдэл:</Text>
            <Text style={styles.settingValue}>Ассан</Text>
          </View>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>QR уншуулсан түүх:</Text>
            <Text style={styles.settingValue}>Сүүлийн 10 уншуулсан анги</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.clearHistoryButton}
            onPress={() => {
              setScanHistory([]);
              Alert.alert('History Cleared', 'Your local scan history has been cleared.');
            }}
          >
            <Text style={styles.clearHistoryText}>Түүхийг цэвэрлэх</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSettingsVisible(false)}
          >
            <Text style={styles.closeButtonText}>Гарах</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // For camera permission screen
  if (isCameraActive && !permission?.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>
            Сайн уу, {user?.email || 'User'}
          </Text>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>Гарах</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.permissionContainer}>
          <Text style={styles.message}>
            Камерын зөвшөөрөл олгох хэрэгтэй
          </Text>
          <TouchableOpacity 
            style={styles.button} 
            onPress={requestPermission}
          >
            <Text style={styles.buttonText}>Зөвшөөрөл олгох</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.cancelButton]} 
            onPress={() => setIsCameraActive(false)}
          >
            <Text style={styles.buttonText}>Буцах</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Hello, {user?.email || 'User'}
        </Text>
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Гарах</Text>
        </TouchableOpacity>
      </View>
      
      {isCameraActive ? (
        <CameraView
          style={styles.camera}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanInstructions}>
              QR-г хүрээн дотор тааруулана уу
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setIsCameraActive(false)}
          >
            <Text style={styles.backButtonText}>Буцах</Text>
          </TouchableOpacity>
          {scanned && (
            <TouchableOpacity
              style={styles.scanAgainButton}
              onPress={() => setScanned(false)}
            >
              <Text style={styles.buttonText}>Дахин уншуулах</Text>
            </TouchableOpacity>
          )}
        </CameraView>
      ) : (
        <View style={styles.mainContent}>
          <Image 
            source={require('../../assets/qr-icon.png')} // Add a QR code icon image
            style={styles.qrIcon}
            defaultSource={require('../../assets/placeholder.png')} // Fallback placeholder
          />
          
          <Text style={styles.mainHeading}>Өрөөний мэдээлэл</Text>
          <Text style={styles.instructions}>
            Хичээл орж буй ангиа мэдэгдэхийн тулд QR уншуулаарай
          </Text>
          
          <TouchableOpacity 
            style={[
              styles.scanButton,
              cooldownActive && styles.disabledButton
            ]} 
            onPress={activateCamera}
            disabled={cooldownActive}
          >
            <Text style={styles.scanButtonText}>
              {cooldownActive 
                ? `Дахин уншуулах ${cooldownTime}s` 
                : "QR Код уншуулах"}
            </Text>
          </TouchableOpacity>
          
          {scanHistory.length > 0 && (
            <View style={styles.historyContainer}>
              <Text style={styles.historyTitle}>Саяхан уншуулсан</Text>
              {scanHistory.map((scan, index) => (
                <View key={index} style={styles.historyItem}>
                  <Text style={styles.historyRoom}>{scan.room}</Text>
                  <Text style={styles.historyTime}>{scan.timestamp}</Text>
                </View>
              ))}
            </View>
          )}
          
          <View style={styles.bottomButtons}>
            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={() => setSettingsVisible(true)}
            >
              <Text style={styles.settingsButtonText}>Тохиргоо</Text>
            </TouchableOpacity>
          </View>
          
          <SettingsModal />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#3498db',
  },
  headerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },
  qrIcon: {
    width: 100,
    height: 100,
    marginVertical: 20,
  },
  mainHeading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  instructions: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  scanButton: {
    backgroundColor: '#3498db',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  historyContainer: {
    width: '100%',
    marginTop: 30,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    maxHeight: '40%',
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyRoom: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  historyTime: {
    fontSize: 14,
    color: '#666',
  },
  bottomButtons: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  settingsButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  settingsButtonText: {
    color: '#3498db',
    fontSize: 16,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  scanInstructions: {
    color: '#fff',
    fontSize: 14,
    marginTop: 20,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  scanAgainButton: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: '#2ecc71',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  button: { 
    backgroundColor: '#3498db',
    paddingVertical: 15, 
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 30,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '80%',
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: { 
    color: '#fff', 
    fontSize: 18,
    fontWeight: '600',
  },
  message: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
    paddingHorizontal: 30,
    color: '#666',
    marginTop: 40,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  settingValue: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '500',
  },
  clearHistoryButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  clearHistoryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  closeButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default QRCodeScanner;