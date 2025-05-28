import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  query, 
  where,
  getDocs,
  doc, 
  updateDoc,
  getDoc
} from "firebase/firestore";
import { useRouter } from 'expo-router';
import { app } from '@/app/assets/firebaseConfig'; // adjust path as needed

const auth = getAuth(app);
const firestore = getFirestore(app);

const ApprovalsScreen = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [selectedTab, setSelectedTab] = useState('all'); // 'all', 'students', 'teachers'

  // Fetch pending users
  const fetchPendingUsers = async () => {
    try {
      // Get pending students
      const studentQuery = query(
        collection(firestore, 'students'),
        where('approval', '==', 'pending')
      );
      const studentSnapshot = await getDocs(studentQuery);
      const pendingStudents = studentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'student'
      }));
      
      // Get pending teachers
      const teacherQuery = query(
        collection(firestore, 'teachers'),
        where('approval', '==', 'pending')
      );
      const teacherSnapshot = await getDocs(teacherQuery);
      const pendingTeachers = teacherSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'teacher'
      }));
      
      // Combine and sort by creation date (newest first)
      const allPendingUsers = [...pendingStudents, ...pendingTeachers].sort((a, b) => {
        return b.createdAt?.toDate() - a.createdAt?.toDate();
      });
      
      setPendingUsers(allPendingUsers);
    } catch (error) {
      console.error('Error fetching pending users:', error);
      Alert.alert('Error', 'Failed to load pending approval requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle approval decision
  const handleApprovalDecision = async (userId, userType, decision) => {
    try {
      setLoading(true);
      
      // Update user document with approval status
      await updateDoc(doc(firestore, `${userType}s`, userId), {
        approval: decision
      });
      
      // Remove the user from the list
      setPendingUsers(pendingUsers.filter(user => user.id !== userId));
      
      Alert.alert(
        'Success', 
        `The ${userType} has been ${decision === 'approved' ? 'approved' : 'declined'}.`
      );
    } catch (error) {
      console.error('Error updating approval status:', error);
      Alert.alert('Error', `Failed to ${decision} the ${userType}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchPendingUsers();
  };

  // Check admin status and fetch data
  useEffect(() => {
    const checkAdminAndFetchData = async () => {
      const user = auth.currentUser;
      
      if (!user) {
        router.replace('/mobile/admin/login');
        return;
      }
      
      try {
        const adminDoc = await getDoc(doc(firestore, 'admins', user.uid));
        if (!adminDoc.exists()) {
          // Not an admin, redirect to login
          auth.signOut();
          router.replace('/mobile/admin/login');
        } else {
          // User is admin, load pending users
          fetchPendingUsers();
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        router.replace('/mobile/admin/login');
      }
    };
    
    checkAdminAndFetchData();
  }, []);

  // Filter users based on selected tab
  const filteredUsers = pendingUsers.filter(user => {
    if (selectedTab === 'all') return true;
    return user.type === selectedTab;
  });

  // Navigate back to dashboard
  const goBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Хүлээгдэж буй Хүсэлтүүд</Text>
        <View style={styles.placeholder}></View> {/* For layout balance */}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, selectedTab === 'all' && styles.activeTab]}
          onPress={() => setSelectedTab('all')}
        >
          <Text style={[styles.tabText, selectedTab === 'all' && styles.activeTabText]}>
            Бүгд ({pendingUsers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, selectedTab === 'student' && styles.activeTab]}
          onPress={() => setSelectedTab('student')}
        >
          <Text style={[styles.tabText, selectedTab === 'student' && styles.activeTabText]}>
            Оюутан ({pendingUsers.filter(u => u.type === 'student').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, selectedTab === 'teacher' && styles.activeTab]}
          onPress={() => setSelectedTab('teacher')}
        >
          <Text style={[styles.tabText, selectedTab === 'teacher' && styles.activeTabText]}>
            Багш ({pendingUsers.filter(u => u.type === 'teacher').length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#3498db" style={styles.loader} />
        ) : filteredUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle" size={50} color="#3498db" />
            <Text style={styles.emptyText}>Хүлээгдэж буй хүсэлт байхгүй</Text>
          </View>
        ) : (
          <View style={styles.userList}>
            {filteredUsers.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <View style={[
                    styles.userTypeTag, 
                    user.type === 'teacher' ? styles.teacherTag : styles.studentTag
                  ]}>
                    <Text style={styles.userTypeText}>
                      {user.type === 'teacher' ? 'Teacher' : 'Student'}
                    </Text>
                  </View>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  
                  {user.type === 'teacher' && (
                    <View style={styles.additionalInfo}>
                      <Text style={styles.infoLabel}>Phone: </Text>
                      <Text style={styles.infoValue}>
                        {user.phoneNumber || 'Not provided'}
                      </Text>
                    </View>
                  )}
                  
                  {user.type === 'teacher' && (
                    <View style={styles.additionalInfo}>
                      <Text style={styles.infoLabel}>Profession: </Text>
                      <Text style={styles.infoValue}>
                        {user.profession || 'Not specified'}
                      </Text>
                    </View>
                  )}
                  
                  <Text style={styles.timeStamp}>
                    Registered: {user.createdAt?.toDate().toLocaleDateString() || 'Unknown date'}
                  </Text>
                </View>
                
                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={styles.approveButton}
                    onPress={() => handleApprovalDecision(user.id, user.type, 'approved')}
                  >
                    <Ionicons name="checkmark-outline" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Approve</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.declineButton}
                    onPress={() => handleApprovalDecision(user.id, user.type, 'declined')}
                  >
                    <Ionicons name="close-outline" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 34, // Match backButton width for balance
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3498db',
  },
  tabText: {
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  loader: {
    marginTop: 50,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  userList: {
    marginBottom: 20,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    marginBottom: 15,
  },
  userTypeTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
  },
  teacherTag: {
    backgroundColor: '#e3f2fd',
  },
  studentTag: {
    backgroundColor: '#f0fdf4',
  },
  userTypeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  additionalInfo: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
  },
  timeStamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  approveButton: {
    backgroundColor: '#2ecc71',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 5,
    flex: 1,
    marginRight: 5,
  },
  declineButton: {
    backgroundColor: '#e74c3c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 5,
    flex: 1,
    marginLeft: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 5,
  }
});

export default ApprovalsScreen;