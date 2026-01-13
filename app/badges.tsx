import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Award,
  Trophy,
  Star,
  Filter,
  X,
  Lock,
  Calendar,
  Target,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import BadgeItem from '@/components/BadgeItem';
import { useBadgeStore } from '@/store/badgeStore';

interface Badge {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  rarity: string;
  isUnlocked: boolean;
  unlockedAt?: string;
}

interface BadgeStore {
  badges: Badge[];
  getUnlockedBadges: () => Badge[];
  initializeDefaultBadges: () => void;
}

const { width } = Dimensions.get('window');
const BADGE_SIZE = (width - 60) / 3;

type FilterType = 'all' | 'unlocked' | 'locked' | 'common' | 'uncommon' | 'rare' | 'legendary';
type CategoryType = 'all' | 'workout' | 'nutrition' | 'consistency' | 'wellness' | 'achievement';

export default function BadgesScreen() {
  const {
    badges,
    getUnlockedBadges,
    initializeDefaultBadges,
  } = useBadgeStore() as BadgeStore;

  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryType>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (badges.length === 0) {
      initializeDefaultBadges();
    }
  }, [badges, initializeDefaultBadges]);

  const filteredBadges = useMemo(() => {
    let filtered: Badge[] = badges;

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((badge: Badge) => badge.category === categoryFilter);
    }

    // Apply type filter
    switch (filterType) {
      case 'unlocked':
        filtered = filtered.filter((badge: Badge) => badge.isUnlocked);
        break;
      case 'locked':
        filtered = filtered.filter((badge: Badge) => !badge.isUnlocked);
        break;
      case 'common':
      case 'uncommon':
      case 'rare':
      case 'legendary':
        filtered = filtered.filter((badge: Badge) => badge.rarity === filterType);
        break;
    }

    return filtered;
  }, [badges, filterType, categoryFilter]);

  const unlockedBadges = getUnlockedBadges();
  const totalBadges = badges.length;
  const completionPercentage = totalBadges > 0 ? Math.round((unlockedBadges.length / totalBadges) * 100) : 0;

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return '#6E6E6E';
      case 'uncommon':
        return '#2ECC71';
      case 'rare':
        return '#3498DB';
      case 'epic':
        return '#9B59B6';
      case 'legendary':
        return '#F1C40F';
      default:
        return Colors.text.tertiary;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'workout':
        return Trophy;
      case 'nutrition':
        return Target;
      case 'consistency':
        return Calendar;
      case 'wellness':
        return Star;
      case 'achievement':
        return Award;
      default:
        return Award;
    }
  };

  const renderFilterChip = (label: string, value: FilterType, isActive: boolean) => (
    <TouchableOpacity
      key={value}
      style={[
        styles.filterChip,
        isActive && styles.filterChipActive,
      ]}
      onPress={() => setFilterType(value)}
    >
      <Text style={[
        styles.filterChipText,
        isActive && styles.filterChipTextActive,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderCategoryChip = (label: string, value: CategoryType, isActive: boolean) => {
    const IconComponent = getCategoryIcon(value);
    return (
      <TouchableOpacity
        key={value}
        style={[
          styles.categoryChip,
          isActive && styles.categoryChipActive,
        ]}
        onPress={() => setCategoryFilter(value)}
      >
        {value !== 'all' && (
          <IconComponent
            size={16}
            color={isActive ? Colors.primary : Colors.text.secondary}
          />
        )}
        <Text style={[
          styles.categoryChipText,
          isActive && styles.categoryChipTextActive,
          value !== 'all' && { marginLeft: 6 },
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderBadgeModal = () => {
    if (!selectedBadge) return null;

    return (
      <Modal
        visible={!!selectedBadge}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBadge(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setSelectedBadge(null)}
            >
              <X size={24} color={Colors.text.primary} />
            </TouchableOpacity>

            <View style={[
              styles.modalBadgeContainer,
              { borderColor: getRarityColor(selectedBadge.rarity) }
            ]}>
              {selectedBadge.isUnlocked ? (
                <Image
                  source={{ uri: selectedBadge.imageUrl }}
                  style={styles.modalBadgeImage}
                />
              ) : (
                <View style={styles.modalLockedContainer}>
                  <Lock size={60} color={Colors.text.tertiary} />
                </View>
              )}
            </View>

            <Text style={[
              styles.modalBadgeName,
              { color: getRarityColor(selectedBadge.rarity) }
            ]}>
              {selectedBadge.name}
            </Text>

            <Text style={styles.modalBadgeRarity}>
              {selectedBadge.rarity.toUpperCase()}
            </Text>

            <Text style={styles.modalBadgeDescription}>
              {selectedBadge.description}
            </Text>

            {selectedBadge.isUnlocked && selectedBadge.unlockedAt && (
              <View style={styles.modalUnlockedInfo}>
                <Calendar size={16} color={Colors.text.secondary} />
                <Text style={styles.modalUnlockedText}>
                  Unlocked on {new Date(selectedBadge.unlockedAt).toLocaleDateString()}
                </Text>
              </View>
            )}

            {!selectedBadge.isUnlocked && (
              <View style={styles.modalLockedInfo}>
                <Lock size={16} color={Colors.text.secondary} />
                <Text style={styles.modalLockedText}>
                  Complete the requirement to unlock this badge
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Badge Collection',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowFilters(!showFilters)}
              style={styles.filterButton}
            >
              <Filter size={20} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }} 
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Stats Header */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{unlockedBadges.length}</Text>
            <Text style={styles.statLabel}>Unlocked</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalBadges}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{completionPercentage}%</Text>
            <Text style={styles.statLabel}>Complete</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { width: `${completionPercentage}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {unlockedBadges.length} of {totalBadges} badges collected
          </Text>
        </View>

        {/* Filters */}
        {showFilters && (
          <View style={styles.filtersContainer}>
            <Text style={styles.filterTitle}>Filter by Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {renderFilterChip('All', 'all', filterType === 'all')}
              {renderFilterChip('Unlocked', 'unlocked', filterType === 'unlocked')}
              {renderFilterChip('Locked', 'locked', filterType === 'locked')}
              {renderFilterChip('Common', 'common', filterType === 'common')}
              {renderFilterChip('Uncommon', 'uncommon', filterType === 'uncommon')}
              {renderFilterChip('Rare', 'rare', filterType === 'rare')}
              {renderFilterChip('Legendary', 'legendary', filterType === 'legendary')}
            </ScrollView>

            <Text style={styles.filterTitle}>Filter by Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {renderCategoryChip('All', 'all', categoryFilter === 'all')}
              {renderCategoryChip('Workout', 'workout', categoryFilter === 'workout')}
              {renderCategoryChip('Nutrition', 'nutrition', categoryFilter === 'nutrition')}
              {renderCategoryChip('Consistency', 'consistency', categoryFilter === 'consistency')}
              {renderCategoryChip('Wellness', 'wellness', categoryFilter === 'wellness')}
              {renderCategoryChip('Achievement', 'achievement', categoryFilter === 'achievement')}
            </ScrollView>
          </View>
        )}

        {/* Badges Grid */}
        <View style={styles.badgesContainer}>
          <Text style={styles.sectionTitle}>
            {filterType === 'all' && categoryFilter === 'all' 
              ? 'All Badges' 
              : `${filterType === 'all' ? '' : filterType.charAt(0).toUpperCase() + filterType.slice(1) + ' '}${categoryFilter === 'all' ? '' : categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1) + ' '}Badges`
            }
          </Text>
          
          <View style={styles.badgesGrid}>
            {filteredBadges.map((badge: Badge) => (
              <View key={badge.id} style={styles.badgeWrapper}>
                <BadgeItem
                  badge={badge}
                  size="large"
                  onPress={() => setSelectedBadge(badge)}
                />
              </View>
            ))}
          </View>

          {filteredBadges.length === 0 && (
            <View style={styles.emptyContainer}>
              <Award size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyTitle}>No Badges Found</Text>
              <Text style={styles.emptyText}>
                Try adjusting your filters or complete more activities to earn badges.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {renderBadgeModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  filterButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  progressContainer: {
    padding: 16,
    marginHorizontal: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  filtersContainer: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  badgesContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  badgeWrapper: {
    width: BADGE_SIZE,
    marginBottom: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
  modalBadgeContainer: {
    width: 120,
    height: 120,
    borderRadius: 20,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: Colors.background,
  },
  modalBadgeImage: {
    width: 100,
    height: 100,
    borderRadius: 16,
  },
  modalLockedContainer: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBadgeName: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalBadgeRarity: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    letterSpacing: 1,
    marginBottom: 16,
  },
  modalBadgeDescription: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  modalUnlockedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  modalUnlockedText: {
    fontSize: 14,
    color: Colors.success,
    marginLeft: 8,
    fontWeight: '500',
  },
  modalLockedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.text.tertiary + '20',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  modalLockedText: {
    fontSize: 14,
    color: Colors.text.tertiary,
    marginLeft: 8,
    fontWeight: '500',
  },
});