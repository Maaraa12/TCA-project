import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput, 
  ScrollView
} from 'react-native';
import { getAuth, signOut } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  where,
  onSnapshot
} from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { app } from '../../assets/firebaseConfig'; // adjust path as needed

const auth = getAuth(app);
const firestore = getFirestore(app);

// List of professions - same as in LoginScreen
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

const TeacherLocationTracker = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [selectedProfession, setSelectedProfession] = useState('');
  const navigation = useNavigation();
  
  // Get current user
  const user = auth.currentUser;

  const fetchTeacherData = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      setError(null);
      
      // Reference to teachers collection directly
      const teachersRef = collection(firestore, 'teachers');
      
      // Get only approved teachers
      const q = query(teachersRef, where("approval", "==", "approved"));
      const querySnapshot = await getDocs(q);
      
      // Process each teacher document
      const teachersList = querySnapshot.docs.map(doc => {
        const teacherData = doc.data();
        return {
          id: doc.id,
          name: teacherData.name || 'Багшийн нэр байхгүй',
          email: teacherData.email || 'И-мейл байхгүй',
          phoneNumber: teacherData.phoneNumber || 'Утасны дугаар байхгүй',
          profession: teacherData.profession || 'Тэнхим сонгоогүй',
          lastActiveTime: teacherData.lastActiveTime ? new Date(teacherData.lastActiveTime.seconds * 1000) : null,
          currentLocation: teacherData.currentLocation ? {
            roomNumber: teacherData.currentLocation.roomNumber || null,
            timestamp: teacherData.currentLocation.timestamp ? 
              new Date(teacherData.currentLocation.timestamp.seconds * 1000) : null
          } : null,
          approval: teacherData.approval || 'хүлээгдэж буй',
          scans: teacherData.scans ? teacherData.scans.map(scan => ({
            room: scan.room || null,
            timestamp: scan.timestamp ? new Date(scan.timestamp.seconds * 1000) : null
          })) : []
        };
      });
      
      console.log(`Fetched ${teachersList.length} teachers`);
      
      // Sort teachers by lastActiveTime if available
      teachersList.sort((a, b) => {
        if (!a.lastActiveTime) return 1;
        if (!b.lastActiveTime) return -1;
        return b.lastActiveTime - a.lastActiveTime;
      });
      
      setTeachers(teachersList);
      setLoading(false);
      setRefreshing(false);
      
      // Set up real-time listener for updates
      setupRealtimeListener();
      
    } catch (err) {
      console.error('Error fetching teacher data:', err);
      setError('Failed to load teacher data. Please try again.');
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const setupRealtimeListener = () => {
    try {
      // Reference to teachers collection
      const teachersRef = collection(firestore, 'teachers');
      
      // Query to get only approved teachers
      const q = query(teachersRef, where("approval", "==", "approved"));
      
      // Set up the listener to the teachers collection
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const teachersList = snapshot.docs.map(doc => {
          const teacherData = doc.data();
          return {
            id: doc.id,
            name: teacherData.name || 'Unnamed Teacher',
            email: teacherData.email || 'No email',
            phoneNumber: teacherData.phoneNumber || 'No phone number', 
            profession: teacherData.profession || 'Not specified',
            lastActiveTime: teacherData.lastActiveTime ? new Date(teacherData.lastActiveTime.seconds * 1000) : null,
            location: teacherData.currentLocation ? {
              roomNumber: teacherData.currentLocation.roomNumber || null,
              timestamp: teacherData.currentLocation.timestamp ? 
                new Date(teacherData.currentLocation.timestamp.seconds * 1000) : null
            } : null,
            approval: teacherData.approval || 'pending',
            scans: teacherData.scans ? teacherData.scans.map(scan => ({
              room: scan.room || null,
              timestamp: scan.timestamp ? new Date(scan.timestamp.seconds * 1000) : null
            })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 5) : []
          };
        });
        
        // Sort teachers by lastActiveTime
        teachersList.sort((a, b) => {
          if (!a.lastActiveTime) return 1;
          if (!b.lastActiveTime) return -1;
          return b.lastActiveTime - a.lastActiveTime;
        });
        
        console.log(`Real-time update: ${teachersList.length} teachers`);
        setTeachers(teachersList);
        setLoading(false);
        setRefreshing(false);
      }, (err) => {
        console.error('Error in teacher snapshot listener:', err);
        // Don't set error here, as we already have data from the initial fetch
      });
      
      // Return the unsubscribe function
      return unsubscribe;
    } catch (err) {
      console.error('Error setting up listener:', err);
    }
  };
  
  useEffect(() => {
    // Initial data fetch
    fetchTeacherData();
    
    // Clean up the listener on component unmount
    return () => {
      // Unsubscribe function will be called if setupRealtimeListener has been called
    };
  }, []);
  
  const handleRefresh = () => {
    fetchTeacherData(true);
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
  
  const formatLastActive = (timestamp) => {
    if (!timestamp) return 'Never active';
    
    const now = new Date();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    
    return timestamp.toLocaleDateString();
  };
  
  // Filter teachers based on search query and profession filter
  const filteredTeachers = teachers.filter(teacher => {
    const matchesSearch = searchQuery === '' || 
      (teacher.name && teacher.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (teacher.email && teacher.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (teacher.profession && teacher.profession.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesProfession = selectedProfession === '' || 
      (teacher.profession === selectedProfession);
      
    if (showOnlyActive) {
      // Show only teachers active in the last 2 hours
      const isActive = teacher.lastActiveTime && 
        (new Date() - teacher.lastActiveTime) < (2 * 60 * 60 * 1000);
      return matchesSearch && matchesProfession && isActive;
    }
    
    return matchesSearch && matchesProfession;
  });
  
  const renderTeacherItem = ({ item }) => (
    <View style={styles.teacherCard}>
      <View style={styles.teacherHeader}>
        <View>
          <Text style={styles.teacherName}>{item.name}</Text>
          <Text style={styles.teacherEmail}>{item.email}</Text>
        </View>
        <View style={[
          styles.statusIndicator, 
          item.lastActiveTime && new Date() - item.lastActiveTime < 3600000 ? styles.activeStatus : styles.inactiveStatus
        ]} />
      </View>
      
      {/* Profession and Contact Info */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Тэнхим:</Text>
          <Text style={styles.infoValue}>{item.profession}</Text>
        </View>
        {item.phoneNumber && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Утасны дугаар:</Text>
            <Text style={styles.infoValue}>{item.phoneNumber}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Сүүлд идэвхитэй байсан:</Text>
          <Text style={styles.infoValue}>{formatLastActive(item.lastActiveTime)}</Text>
        </View>
      </View>

      {/* Current Location - Simplified */}
      {item.location && item.location.roomNumber && (
        <View style={styles.locationContainer}>
          <Text style={styles.locationHeader}>Сүүлийн байршил</Text>
          <View style={styles.locationDetails}>
            <View style={styles.locationItem}>
              <Text style={styles.locationLabel}>Анги:</Text>
              <Text style={styles.locationValue}>{item.location.roomNumber}</Text>
            </View>
            {item.location.timestamp && (
              <View style={styles.locationItem}>
                <Text style={styles.locationLabel}>оноос хойш:</Text>
                <Text style={styles.locationValue}>{formatLastActive(item.location.timestamp)}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Recent Scans */}
      {item.scans && item.scans.length > 0 && (
        <View style={styles.scansContainer}>
          <Text style={styles.scansHeader}>Сүүлд идэвхитэй байсан</Text>
          {item.scans.map((scan, index) => (
            <View key={index} style={styles.scanItem}>
              <Text style={styles.scanRoom}>{scan.room || 'Unknown Room'}</Text>
              <Text style={styles.scanTime}>{formatLastActive(scan.timestamp)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // Render profession filter buttons
  const renderProfessionFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.professionFiltersContainer}
    >
      <TouchableOpacity
        style={[styles.professionButton, selectedProfession === '' && styles.selectedProfessionButton]}
        onPress={() => setSelectedProfession('')}
      >
        <Text style={[styles.professionButtonText, selectedProfession === '' && styles.selectedProfessionText]}>
          Бүгд
        </Text>
      </TouchableOpacity>
      
      {professions.map(profession => (
        <TouchableOpacity
          key={profession}
          style={[styles.professionButton, selectedProfession === profession && styles.selectedProfessionButton]}
          onPress={() => setSelectedProfession(profession)}
        >
          <Text style={[styles.professionButtonText, selectedProfession === profession && styles.selectedProfessionText]}>
            {profession}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Багшийн байршил</Text>
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Гарах</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity 
          style={[styles.filterButton, showOnlyActive && styles.filterButtonActive]} 
          onPress={() => setShowOnlyActive(!showOnlyActive)}
        >
          <Text style={[styles.filterButtonText, showOnlyActive && styles.filterButtonTextActive]}>
            {showOnlyActive ? 'Бүх багш нар' : 'Идэвхитэй'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Profession filter row */}
      {renderProfessionFilters()}

      <View style={styles.debugContainer}>
        <Text style={styles.debugText}>
          Бүх багш нар: {teachers.length} | Хайлт: {filteredTeachers.length}
        </Text>
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Багшийн мэдээллийг хайж байна...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Дахин ачааллуулах</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredTeachers}
          renderItem={renderTeacherItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh} 
              colors={['#3498db']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery || selectedProfession ? 'Хайлт олдсонгүй' : 'Багшийн мэдээлэл байхгүй'}
              </Text>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={handleRefresh}
              >
                <Text style={styles.refreshButtonText}>Мэдээлэл шинэчлэх</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

// Updated styles with new additions for profession filters
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
    fontSize: 18,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  filterButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  filterButtonActive: {
    backgroundColor: '#3498db',
  },
  filterButtonText: {
    color: '#3498db',
    fontSize: 12,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  professionFiltersContainer: {
    paddingVertical: 10,
    paddingHorizontal: 5,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  professionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#bdc3c7',
    marginHorizontal: 4,
    backgroundColor: '#f8f8f8',
  },
  selectedProfessionButton: {
    borderColor: '#3498db',
    backgroundColor: '#e3f2fd',
  },
  professionButtonText: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  selectedProfessionText: {
    color: '#3498db',
    fontWeight: '600',
  },
  debugContainer: {
    padding: 5,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  refreshButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 15,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  listContainer: {
    padding: 10,
  },
  teacherCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flex:1,
  },
  teacherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  teacherName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  teacherEmail: {
    fontSize: 14,
    color: '#3498db',
    marginTop: 2,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  activeStatus: {
    backgroundColor: '#2ecc71',
  },
  inactiveStatus: {
    backgroundColor: '#95a5a6',
  },
  infoSection: {
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  infoLabel: {
    width: 100,
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  locationContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  locationHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  locationDetails: {
    backgroundColor: '#f8f8f8',
    borderRadius: 5,
    padding: 10,
  },
  locationItem: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  locationLabel: {
    width: 80,
    fontSize: 14,
    color: '#666',
  },
  locationValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  scansContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  scansHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  scanItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f8f8f8',
    borderRadius: 5,
    marginBottom: 5,
  },
  scanRoom: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  scanTime: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    padding: 50,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  }
});

export default TeacherLocationTracker;