import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Lock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Badge } from '@/types';

interface BadgeItemProps {
  badge: Badge;
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
}

const BadgeItem: React.FC<BadgeItemProps> = ({
  badge,
  onPress,
  size = 'medium',
}) => {
  const getBadgeColor = (rarity: string) => {
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
  
  const getBadgeSize = () => {
    switch (size) {
      case 'small':
        return { containerWidth: 60, containerHeight: 60, image: 40 };
      case 'large':
        return { containerWidth: 120, containerHeight: 140, image: 80 };
      default: // medium
        return { containerWidth: 90, containerHeight: 110, image: 60 };
    }
  };
  
  const sizeStyles = getBadgeSize();
  const badgeColor = getBadgeColor(badge.rarity);
  
  return (
    <TouchableOpacity
      style={[
        styles.container,
        { 
          width: sizeStyles.containerWidth, 
          height: size === 'small' ? sizeStyles.containerHeight : 'auto',
          minHeight: sizeStyles.containerHeight
        },
        { borderColor: badge.isUnlocked ? badgeColor : Colors.border }
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      {badge.isUnlocked ? (
        <Image
          source={{ uri: badge.imageUrl }}
          style={[styles.image, { width: sizeStyles.image, height: sizeStyles.image }]}
        />
      ) : (
        <View style={[styles.lockedContainer, { width: sizeStyles.image, height: sizeStyles.image }]}>
          <Lock size={sizeStyles.image * 0.4} color={Colors.text.tertiary} />
        </View>
      )}
      
      {size !== 'small' && (
        <Text 
          style={[
            styles.name, 
            { color: badge.isUnlocked ? badgeColor : Colors.text.tertiary }
          ]}
          numberOfLines={2}
        >
          {badge.name}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 8,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: Colors.card,
    margin: 4,
  },
  image: {
    borderRadius: 8,
  },
  lockedContainer: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 4,
    lineHeight: 16,
    flexShrink: 1,
    width: '100%',
  },
});

export default BadgeItem;