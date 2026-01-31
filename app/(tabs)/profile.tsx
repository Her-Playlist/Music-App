import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
import { Settings, Share2, Bell } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import ThemeToggle from '../components/ThemeToggle';

const stats = [
  { label: 'Followers', value: '2,345' },
  { label: 'Following', value: '1,234' },
  { label: 'Playlists', value: '45' },
];

export default function ProfileScreen() {
  const { isDark } = useTheme();

  return (
    <ScrollView style={[styles.container, isDark && styles.darkContainer]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, isDark && styles.darkText]}>Profile</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}>
              <Bell size={24} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Settings size={24} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profile}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop' }}
            style={styles.profileImage}
          />
          <Text style={[styles.name, isDark && styles.darkText]}>John Doe</Text>
          <Text style={[styles.handle, isDark && styles.darkSubtext]}>@johndoe</Text>

          <View style={styles.statsContainer}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.stat}>
                <Text style={[styles.statValue, isDark && styles.darkText]}>{stat.value}</Text>
                <Text style={[styles.statLabel, isDark && styles.darkSubtext]}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.shareButton, isDark && styles.darkShareButton]}>
            <Share2 size={20} color={isDark ? '#fff' : '#000'} />
            <Text style={[styles.shareButtonText, isDark && styles.darkText]}>Share Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Theme Toggle Section */}
      <View style={styles.settingsSection}>
        <ThemeToggle />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  header: {
    padding: 16,
    paddingTop: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  darkText: {
    color: '#fff',
  },
  darkSubtext: {
    color: '#999',
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 16,
  },
  profile: {
    alignItems: 'center',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  handle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 24,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  editButton: {
    backgroundColor: '#E53935',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 12,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  darkShareButton: {
    backgroundColor: '#282828',
  },
  shareButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#000',
  },
  settingsSection: {
    padding: 16,
  },
});