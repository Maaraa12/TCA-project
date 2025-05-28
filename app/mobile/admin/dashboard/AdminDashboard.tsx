import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from "firebase/auth";
import { getFirestore, collection, query, getDocs, doc, getDoc } from "firebase/firestore";
import { useRouter } from 'expo-router';
import { app } from '@/app/assets/firebaseConfig'; // adjust path as needed

const auth = getAuth(app);
const firestore = getFirestore(app);

const AdminDashboard = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    pendingApprovals: 0,
    activeUsers: 0
  });
  
  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      // Get all students
      const studentsQuery = query(collection(firestore, 'students'));
      const studentsSnapshot = await getDocs(studentsQuery);
      const totalStudents = studentsSnapshot.size;
      
      // Get pending students
      const pendingStudents = studentsSnapshot.docs.filter(
        doc => doc.data().approval === 'pending'
      ).length;
      
      // Get all teachers
      const teachersQuery = query(collection(firestore, 'teachers'));
      const teachersSnapshot = await getDocs(teachersQuery);
      const totalTeachers = teachersSnapshot.size;
      
      // Get pending teachers
      const pendingTeachers = teachersSnapshot.docs.filter(
        doc => doc.data().approval === 'pending'
      ).length;
      
      // Calculate active users (those who logged in within the last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const activeTeachers = teachersSnapshot.docs.filter(doc => {
        const lastActiveTime = doc.data().lastActiveTime?.toDate();
        return lastActiveTime && lastActiveTime > sevenDaysAgo;
      }).length;
      
      setDashboardData({
        totalStudents,
        totalTeachers,
        pendingApprovals: pendingStudents + pendingTeachers,
        activeUsers: activeTeachers // Currently only tracking active teachers
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  useEffect(() => {
    // Check if current user is admin
    const checkAdminStatus = async () => {
      const user = auth.currentUser;
      
      if (!user) {
        router.replace('/mobile/admin/login/AdminLoginScreen');
        return;
      }
      
      try {
        const adminDoc = await getDoc(doc(firestore, 'admins', user.uid));
        if (!adminDoc.exists()) {
          // Not an admin, redirect to login
          auth.signOut();
          router.replace('/mobile/admin/login/AdminLoginScreen');
        } else {
          // User is admin, load dashboard data
          fetchDashboardData();
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        router.replace('/mobile/admin/login/AdminLoginScreen');
      }
    };
    
    checkAdminStatus();
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace('/mobile/admin/login/AdminLoginScreen');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Navigate to different sections
  const navigateTo = (screen) => {
    if (screen === 'approval' || screen === 'approvals') {
      router.push('/mobile/admin/zuw/ApprovalScreen2');
    } else if (screen === 'users') {
      router.push('/mobile/admin/users/goto');
    } else {
      // Default to dashboard if not recognized
      console.log(`Navigation to ${screen} not implemented`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Хянах хэсэг</Text>
          <Text style={styles.headerSubtitle}>Багшийн байршил тогтоогчын удирдах хэсэг</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#e74c3c" />
          <Text style={styles.logoutText}>Гарах</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color="#3498db" style={styles.loader} />
        ) : (
          <>
            {/* Stats Cards */}
            <View style={styles.statsContainer}>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>{dashboardData.totalStudents}</Text>
                <Text style={styles.statsLabel}>Нийт оюутан</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>{dashboardData.totalTeachers}</Text>
                <Text style={styles.statsLabel}>Нийт багш</Text>
              </View>
              <View style={[styles.statsCard, dashboardData.pendingApprovals > 0 && styles.highlightCard]}>
                <Text style={[styles.statsNumber, dashboardData.pendingApprovals > 0 && styles.highlightText]}>
                  {dashboardData.pendingApprovals}
                </Text>
                <Text style={[styles.statsLabel, dashboardData.pendingApprovals > 0 && styles.highlightText]}>
                  Хүлээгдэж буй хүсэлтүүд
                </Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>{dashboardData.activeUsers}</Text>
                <Text style={styles.statsLabel}>Идэвхитэй хэрэглэгчид</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Хялбарчилсан үйлдэл</Text>
            <View style={styles.quickActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigateTo('approvals')}
              >
                <Ionicons name="people-outline" size={24} color="#fff" />
                <Text style={styles.actionButtonText}>Хүсэлтүүдийг удирдах</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigateTo('users')}
              >
                <Ionicons name="list-outline" size={24} color="#fff" />
                <Text style={styles.actionButtonText}>Хэрэглэгчидийн жагсаалт</Text>
              </TouchableOpacity>
            </View>

            {/* Recent Activity Section - Placeholder */}
            <Text style={styles.sectionTitle}>Өмнөх үйлдлүүд</Text>
            <View style={styles.activityContainer}>
              {[1, 2, 3].map((item) => (
                <View key={item} style={styles.activityItem}>
                  <View style={styles.activityIconContainer}>
                    <Ionicons name="time-outline" size={20} color="#3498db" />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>Шинэ хэрэглэгчийн хүсэлт</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'dashboard' && styles.activeNavItem]}
          onPress={() => setActiveTab('dashboard')}
        >
          <Ionicons 
            name={activeTab === 'dashboard' ? "home" : "home-outline"} 
            size={24} 
            color={activeTab === 'dashboard' ? "#3498db" : "#666"} 
          />
          <Text style={[
            styles.navText, 
            activeTab === 'dashboard' && styles.activeNavText
          ]}>Dashboard</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'approvals' && styles.activeNavItem]}
          onPress={() => {
            setActiveTab('approvals');
            navigateTo('approvals');
          }}
        >
          <Ionicons 
            name={activeTab === 'approvals' ? "checkmark-circle" : "checkmark-circle-outline"} 
            size={24} 
            color={activeTab === 'approvals' ? "#3498db" : "#666"} 
          />
          <Text style={[
            styles.navText, 
            activeTab === 'approvals' && styles.activeNavText
          ]}>Approvals</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'users' && styles.activeNavItem]}
          onPress={() => {
            setActiveTab('users');
            navigateTo('users');
          }}
        >
          <Ionicons 
            name={activeTab === 'users' ? "people" : "people-outline"} 
            size={24} 
            color={activeTab === 'users' ? "#3498db" : "#666"} 
          />
          <Text style={[
            styles.navText, 
            activeTab === 'users' && styles.activeNavText
          ]}>Users</Text>
        </TouchableOpacity>
      </View>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutText: {
    marginLeft: 5,
    color: '#e74c3c',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  loader: {
    marginTop: 50,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statsCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  highlightCard: {
    backgroundColor: '#fef5f5',
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  statsNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statsLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  highlightText: {
    color: '#e74c3c',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    marginTop: 10,
    color: '#333',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#3498db',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    width: '45%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  actionButtonText: {
    color: '#fff',
    marginTop: 5,
    fontSize: 12,
    textAlign: 'center',
  },
  activityContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 3,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 15,
  },
  activeNavItem: {
    borderRadius: 20,
    backgroundColor: '#f0f7fc',
  },
  navText: {
    fontSize: 12,
    marginTop: 3,
    color: '#666',
  },
  activeNavText: {
    color: '#3498db',
    fontWeight: '500',
  },
});

export default AdminDashboard;