import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  query, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { useRouter } from 'expo-router';
import { app } from '@/app/assets/firebaseConfig'; // adjust path as needed

const auth = getAuth(app);
const firestore = getFirestore(app);

const UsersScreen = () => {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('all'); // 'all', 'students', 'teachers'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'date', 'activity'
  
  // Fetch all users
  const fetchUsers = async () => {
    try {
      // Get all approved students
      const studentsQuery = query(collection(firestore, 'students'));
      const studentsSnapshot = await getDocs(studentsQuery);
      const studentsList = studentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'student'
      }));
      
      // Get all teachers
      const teachersQuery = query(collection(firestore, 'teachers'));
      const teachersSnapshot = await getDocs(teachersQuery);
      const teachersList = teachersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'teacher'
      }));
      
      // Combine and sort users
      const allUsers = [...studentsList, ...teachersList];
      
      // Sort users based on current sort method
      const sortedUsers = sortUsers(allUsers, sortBy);
      
      setUsers(sortedUsers);
      setFilteredUsers(sortedUsers);
      
      // Apply filters if any
      filterUsers(sortedUsers, searchQuery, selectedTab);
      
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Sort users based on selected criteria
  const sortUsers = (usersList, criteria) => {
    switch (criteria) {
      case 'name':
        return [...usersList].sort((a, b) => 
          (a.name || '').localeCompare(b.name || ''));
      case 'date':
        return [...usersList].sort((a, b) => 
          b.createdAt?.toDate() - a.createdAt?.toDate());
      case 'activity':
        return [...usersList].sort((a, b) => {
          // Sort by last active time (if available)
          const aTime = a.lastActiveTime?.toDate() || a.createdAt?.toDate() || new Date(0);
          const bTime = b.lastActiveTime?.toDate() || b.createdAt?.toDate() || new Date(0);
          return bTime - aTime;
        });
      default:
        return usersList;
    }
  };

  // Filter users based on search and tab
  const filterUsers = (allUsers, query, tab) => {
    let filtered = allUsers;
    
    // Filter by tab
    if (tab !== 'all') {
      filtered = filtered.filter(user => user.type === tab);
    }
    
    // Filter by search query
    if (query) {
      const lowercaseQuery = query.toLowerCase();
      filtered = filtered.filter(user => 
        (user.name && user.name.toLowerCase().includes(lowercaseQuery)) ||
        (user.email && user.email.toLowerCase().includes(lowercaseQuery))
      );
    }
    
    setFilteredUsers(filtered);
  };

  // Handle search input
  const handleSearch = (text) => {
    setSearchQuery(text);
    filterUsers(users, text, selectedTab);
  };

  // Handle tab change
  const handleTabChange = (tab) => {
    setSelectedTab(tab);
    filterUsers(users, searchQuery, tab);
  };

  // Handle sort change
  const handleSortChange = (sortCriteria) => {
    setSortBy(sortCriteria);
    const sorted = sortUsers(users, sortCriteria);
    setUsers(sorted);
    filterUsers(sorted, searchQuery, selectedTab);
  };

  // Handle pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // Format date for display
  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    const now = new Date();
    const diff = now - date;
    
    // Less than 24 hours
    if (diff < 86400000) {
      return 'Today';
    }
    
    // Less than 48 hours
    if (diff < 172800000) {
      return 'Yesterday';
    }
    
    // Format date
    return date.toLocaleDateString();
  };

  // Format activity status
  const getActivityStatus = (user) => {
    if (!user.lastActiveTime) {
      return 'Never active';
    }
    
    const lastActive = user.lastActiveTime.toDate();
    const now = new Date();
    const diff = now - lastActive;
    
    // Less than 1 hour
    if (diff < 3600000) {
      return 'Active now';
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
      return 'Today';
    }
    
    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
    
    // Format date
    return lastActive.toLocaleDateString();
  };

  // Handle user status change
  const handleUserStatusChange = async (userId, userType, newStatus) => {
    try {
      await updateDoc(doc(firestore, `${userType}s`, userId), {
        approval: newStatus
      });
      
      // Update local state
      const updatedUsers = users.map(user => {
        if (user.id === userId && user.type === userType) {
          return { ...user, approval: newStatus };
        }
        return user;
      });
      
      setUsers(updatedUsers);
      filterUsers(updatedUsers, searchQuery, selectedTab);
      
      Alert.alert(
        'Success', 
        `The ${userType}'s status has been updated to ${newStatus}.`
      );
    } catch (error) {
      console.error('Error updating user status:', error);
      Alert.alert('Error', `Failed to update the ${userType}'s status`);
    }
  };

  // Handle user deletion
  const confirmDeleteUser = (userId, userType, userName) => {
    Alert.alert(
      'Confirm Deletion',
      `Are you sure you want to delete ${userName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteUser(userId, userType)
        }
      ]
    );
  };
  
  const deleteUser = async (userId, userType) => {
    try {
      await deleteDoc(doc(firestore, `${userType}s`, userId));
      
      // Update local state
      const updatedUsers = users.filter(
        user => !(user.id === userId && user.type === userType)
      );
      
      setUsers(updatedUsers);
      filterUsers(updatedUsers, searchQuery, selectedTab);
      
      Alert.alert('Success', 'User has been deleted successfully.');
    } catch (error) {
      console.error('Error deleting user:', error);
      Alert.alert('Error', 'Failed to delete the user');
    }
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
          // User is admin, load users
          fetchUsers();
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        router.replace('/mobile/admin/login');
      }
    };
    
    checkAdminAndFetchData();
  }, []);

  // Go back to dashboard
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
        <Text style={styles.headerTitle}>Хэрэглэгч удирдах</Text>
        <View style={styles.placeholder}></View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity 
            style={[styles.tab, selectedTab === 'all' && styles.activeTab]}
            onPress={() => handleTabChange('all')}
          >
            <Text style={[styles.tabText, selectedTab === 'all' && styles.activeTabText]}>
              Бүгд ({users.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, selectedTab === 'student' && styles.activeTab]}
            onPress={() => handleTabChange('student')}
          >
            <Text style={[styles.tabText, selectedTab === 'student' && styles.activeTabText]}>
              Оюутан ({users.filter(u => u.type === 'student').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, selectedTab === 'teacher' && styles.activeTab]}
            onPress={() => handleTabChange('teacher')}
          >
            <Text style={[styles.tabText, selectedTab === 'teacher' && styles.activeTabText]}>
              Багш ({users.filter(u => u.type === 'teacher').length})
            </Text>
          </TouchableOpacity>
          
          {/* Sort options */}
          <View style={styles.sortContainer}>
            <Text style={styles.sortLabel}>Ангилах:</Text>
            <TouchableOpacity 
              style={[styles.sortOption, sortBy === 'name' && styles.activeSortOption]}
              onPress={() => handleSortChange('name')}
            >
              <Text style={[styles.sortText, sortBy === 'name' && styles.activeSortText]}>Нэр</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.sortOption, sortBy === 'date' && styles.activeSortOption]}
              onPress={() => handleSortChange('date')}
            >
              <Text style={[styles.sortText, sortBy === 'date' && styles.activeSortText]}>Огноо</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.sortOption, sortBy === 'activity' && styles.activeSortOption]}
              onPress={() => handleSortChange('activity')}
            >
              <Text style={[styles.sortText, sortBy === 'activity' && styles.activeSortText]}>Идэвхи</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
            <Ionicons name="people-outline" size={50} color="#3498db" />
            <Text style={styles.emptyText}>Хэрэглэгч олдсонгүй</Text>
            <Text style={styles.emptySubtext}>
              Өөр аргаар хайж үзнэ үү
            </Text>
          </View>
        ) : (
          <View style={styles.userList}>
            {filteredUsers.map((user) => (
              <View key={`${user.type}-${user.id}`} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={[
                    styles.userTypeTag, 
                    user.type === 'teacher' ? styles.teacherTag : styles.studentTag
                  ]}>
                    <Text style={styles.userTypeText}>
                      {user.type === 'teacher' ? 'Teacher' : 'Student'}
                    </Text>
                  </View>
                  
                  <View style={[
                    styles.statusTag,
                    user.approval === 'approved' ? styles.approvedTag :
                    user.approval === 'pending' ? styles.pendingTag : styles.declinedTag
                  ]}>
                    <Text style={styles.statusText}>
                      {user.approval === 'approved' ? 'Approved' :
                       user.approval === 'pending' ? 'Pending' : 'Declined'}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.userName}>{user.name || 'Unnamed User'}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                
                {user.type === 'teacher' && (
                  <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Утас: </Text>
                      <Text style={styles.detailValue}>{user.phoneNumber || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Мэргэжил: </Text>
                      <Text style={styles.detailValue}>{user.profession || 'N/A'}</Text>
                    </View>
                  </View>
                )}
                
                <View style={styles.activityRow}>
                  <View style={styles.activityItem}>
                    <Text style={styles.activityLabel}>Огноо: </Text>
                    <Text style={styles.activityValue}>
                      {user.createdAt ? formatDate(user.createdAt.toDate()) : 'N/A'}
                    </Text>
                  </View>
                  
                  {user.type === 'teacher' && (
                    <View style={styles.activityItem}>
                      <Text style={styles.activityLabel}>Last Active: </Text>
                      <Text style={[
                        styles.activityValue,
                        user.lastActiveTime && 
                          new Date() - user.lastActiveTime.toDate() < 86400000 && 
                          styles.activeNowText
                      ]}>
                        {user.lastActiveTime ? getActivityStatus(user) : 'Never'}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.actionButtons}>
                  {user.approval !== 'approved' && (
                    <TouchableOpacity 
                      style={styles.approveButton}
                      onPress={() => handleUserStatusChange(user.id, user.type, 'approved')}
                    >
                      <Ionicons name="checkmark-outline" size={16} color="#fff" />
                      <Text style={styles.buttonText}>Зөвшөөрөх</Text>
                    </TouchableOpacity>
                  )}
                  
                  {user.approval !== 'declined' && (
                    <TouchableOpacity 
                      style={styles.declineButton}
                      onPress={() => handleUserStatusChange(user.id, user.type, 'declined')}
                    >
                      <Ionicons name="close-outline" size={16} color="#fff" />
                      <Text style={styles.buttonText}>Цуцлах</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => confirmDeleteUser(user.id, user.type, user.name || 'this user')}
                  >
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                    <Text style={styles.buttonText}>Устгах</Text>
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
    width: 34,
  },
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  tabContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginHorizontal: 5,
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
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 15,
    paddingLeft: 15,
    borderLeftWidth: 1,
    borderLeftColor: '#eeeeee',
  },
  sortLabel: {
    color: '#666',
    fontSize: 13,
    marginRight: 10,
  },
  sortOption: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 5,
  },
  activeSortOption: {
    backgroundColor: '#e3f2fd',
  },
  sortText: {
    color: '#666',
    fontSize: 13,
  },
  activeSortText: {
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  userTypeTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
  },
  teacherTag: {
    backgroundColor: '#e3f2fd',
  },
  studentTag: {
    backgroundColor: '#f0f9ff',
  },
  userTypeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3498db',
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
  },
  approvedTag: {
    backgroundColor: '#e8f5e9',
  },
  pendingTag: {
    backgroundColor: '#fff8e1',
  },
  declinedTag: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
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
    marginBottom: 10,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingTop: 10,
    marginBottom: 10,
  },
  detailItem: {
    flexDirection: 'row',
    marginRight: 20,
    marginBottom: 5,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingTop: 10,
    marginBottom: 10,
  },
  activityItem: {
    flexDirection: 'row',
  },
  activityLabel: {
    fontSize: 14,
    color: '#666',
  },
  activityValue: {
    fontSize: 14,
    color: '#333',
  },
  activeNowText: {
    color: '#4caf50',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingTop: 10,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4caf50',
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 10,
  },
  declineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff5722',
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 10,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f44336',
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 5,
  }
});

export default UsersScreen;