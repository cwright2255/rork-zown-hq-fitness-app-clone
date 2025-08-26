import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Crown, ChevronRight, Calendar, Award } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from './Card';
import Badge from './Badge';
import { UserSubscription } from '@/types';
import { getSubscriptionPlan } from '@/constants/subscriptionPlans';

interface SubscriptionOverviewCardProps {
  subscription: UserSubscription;
  onUpgradePress: () => void;
}

const SubscriptionOverviewCard: React.FC<SubscriptionOverviewCardProps> = ({
  subscription,
  onUpgradePress,
}) => {
  const plan = getSubscriptionPlan(subscription.tier);
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const getStatusText = () => {
    switch (subscription.status) {
      case 'trial':
        return subscription.trialEndsAt 
          ? `Trial ends ${formatDate(subscription.trialEndsAt)}`
          : 'Trial active';
      case 'cancelled':
        return subscription.nextBillingDate 
          ? `Access until ${formatDate(subscription.nextBillingDate)}`
          : 'Cancelled';
      case 'expired':
        return 'Subscription expired';
      default:
        return subscription.nextBillingDate 
          ? `Next billing: ${formatDate(subscription.nextBillingDate)}`
          : 'Active';
    }
  };
  
  const getStatusColor = () => {
    switch (subscription.status) {
      case 'trial':
        return Colors.warning;
      case 'cancelled':
      case 'expired':
        return Colors.error;
      default:
        return Colors.success;
    }
  };
  
  return (
    <Card variant="elevated" style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Crown size={24} color={plan.badge.textColor} />
          <View style={styles.headerText}>
            <Text style={styles.tierName}>{plan.displayName}</Text>
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
          </View>
        </View>
        
        <Badge
          label={plan.badge.label}
          variant="neutral"
          style={[styles.tierBadge, { backgroundColor: plan.badge.color }]}
          textStyle={{ color: plan.badge.textColor }}
        />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.description}>{plan.description}</Text>
        
        <View style={styles.features}>
          <View style={styles.feature}>
            <Award size={16} color={Colors.primary} />
            <Text style={styles.featureText}>
              {plan.xpMultiplier}x XP Multiplier
            </Text>
          </View>
          
          <View style={styles.feature}>
            <Calendar size={16} color={Colors.primary} />
            <Text style={styles.featureText}>
              Champion Pass {plan.championPassAccess}
            </Text>
          </View>
          
          {plan.aiRecommendations === -1 ? (
            <View style={styles.feature}>
              <Crown size={16} color={Colors.primary} />
              <Text style={styles.featureText}>
                Unlimited AI Recommendations
              </Text>
            </View>
          ) : (
            <View style={styles.feature}>
              <Crown size={16} color={Colors.primary} />
              <Text style={styles.featureText}>
                {plan.aiRecommendations} AI Recommendation{plan.aiRecommendations !== 1 ? 's' : ''}/month
              </Text>
            </View>
          )}
        </View>
      </View>
      
      {subscription.tier !== 'elite' && (
        <TouchableOpacity style={styles.upgradeButton} onPress={onUpgradePress}>
          <Text style={styles.upgradeButtonText}>
            {subscription.tier === 'free' ? 'Upgrade to Premium' : 'Upgrade Plan'}
          </Text>
          <ChevronRight size={20} color={Colors.primary} />
        </TouchableOpacity>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Colors.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Colors.spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: Colors.spacing.md,
    flex: 1,
  },
  tierName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tierBadge: {
    paddingHorizontal: Colors.spacing.md,
    paddingVertical: Colors.spacing.xs,
  },
  content: {
    marginBottom: Colors.spacing.lg,
  },
  description: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Colors.spacing.md,
    lineHeight: 20,
  },
  features: {
    gap: Colors.spacing.sm,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginLeft: Colors.spacing.sm,
    fontWeight: '500',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Colors.spacing.md,
    paddingHorizontal: Colors.spacing.lg,
    backgroundColor: `${Colors.primary}10`,
    borderRadius: Colors.radius.medium,
    borderWidth: 1,
    borderColor: `${Colors.primary}20`,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
});

export default SubscriptionOverviewCard;