import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon, Smartphone } from 'lucide-react-native';

export default function ThemeToggle() {
  const { theme, setTheme, isDark } = useTheme();
  
  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <Text style={[styles.title, isDark && styles.darkText]}>Appearance</Text>
      <View style={styles.options}>
        <ThemeOption 
          title="Light" 
          icon={<Sun size={24} color={theme === 'light' ? '#E53935' : (isDark ? '#999' : '#666')} />}
          isActive={theme === 'light'}
          onPress={() => setTheme('light')}
          isDark={isDark}
        />
        <ThemeOption 
          title="Dark" 
          icon={<Moon size={24} color={theme === 'dark' ? '#E53935' : (isDark ? '#999' : '#666')} />}
          isActive={theme === 'dark'}
          onPress={() => setTheme('dark')}
          isDark={isDark}
        />
        <ThemeOption 
          title="System" 
          icon={<Smartphone size={24} color={theme === 'system' ? '#E53935' : (isDark ? '#999' : '#666')} />}
          isActive={theme === 'system'}
          onPress={() => setTheme('system')}
          isDark={isDark}
        />
      </View>
    </View>
  );
}

interface ThemeOptionProps {
  title: string;
  icon: React.ReactNode;
  isActive: boolean;
  onPress: () => void;
  isDark: boolean;
}

function ThemeOption({ title, icon, isActive, onPress, isDark }: ThemeOptionProps) {
  return (
    <TouchableOpacity 
      style={[
        styles.option, 
        isActive && (isDark ? styles.activeOptionDark : styles.activeOption)
      ]} 
      onPress={onPress}
    >
      <View style={styles.optionContent}>
        {icon}
        <Text style={[
          styles.optionText, 
          isDark && styles.darkText,
          isActive && styles.activeText
        ]}>
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
  },
  darkContainer: {
    backgroundColor: '#222',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000',
  },
  darkText: {
    color: '#fff',
  },
  options: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  option: {
    padding: 12,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  activeOption: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
  },
  activeOptionDark: {
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
  },
  optionContent: {
    alignItems: 'center',
  },
  optionText: {
    marginTop: 8,
    fontSize: 14,
    color: '#444',
    fontWeight: '500',
  },
  activeText: {
    color: '#E53935',
    fontWeight: '600',
  },
}); 