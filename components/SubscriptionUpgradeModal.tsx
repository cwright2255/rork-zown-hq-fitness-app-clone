import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { X, Check, Crown, Star, Zap } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from './Card';
import Button from './Button';
import Badge from './Badge';
import { SubscriptionTier } from '@/types';
import { subscriptionPlans, getSubscriptionPlan } from '@/constants/subscriptionPlans';

interface SubscriptionUpgradeModalProps {
  visible: boolean;
  currentTier: SubscriptionTier;
  onClose: () => void;
  onUpgrade: (tier: SubscriptionTier) => void;
}

const SubscriptionUpgradeModal: React.FC<SubscriptionUpgradeModalProps> = ({
  visible,
  currentTier,
  onClose,
  onUpgrade,
}) => {
  const [selectedBilling, setSelectedBilling] = useState<'monthly' | 'yearly'>('monthly');
  
  const getFeatureIcon = (iconName: string) => {
    const iconProps = { size: 16, color: Colors.success };
    
    switch (iconName) {
      case 'crown':
        return <Crown {...iconProps} />;
      case 'star':
        return <Star {...iconProps} />;
      case 'zap':
        return <Zap {...iconProps} />;
      default:
        return <Check {...iconProps} />;
    }
  };
  
  const formatPrice = (price: number) => {
    return price === 0 ? 'Free' : `$${price.toFixed(2)}`;
  };
  
  const getYearlySavings = (monthlyPrice: number, yearlyPrice: number) => {
    if (monthlyPrice === 0) return 0;
    const monthlyCost = monthlyPrice * 12;
    const savings = monthlyCost - yearlyPrice;
    return Math.round((savings / monthlyCost) * 100);
  };
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Choose Your Plan</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.billingToggle}>
          <TouchableOpacity
            style={[
              styles.billingOption,
              selectedBilling === 'monthly' && styles.billingOptionActive
            ]}
            onPress={() => setSelectedBilling('monthly')}
          >
            <Text style={[
              styles.billingOptionText,
              selectedBilling === 'monthly' && styles.billingOptionTextActive
            ]}>
              Monthly
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.billingOption,
              selectedBilling === 'yearly' && styles.billingOptionActive
            ]}
            onPress={() => setSelectedBilling('yearly')}
          >
            <Text style={[
              styles.billingOptionText,
              selectedBilling === 'yearly' && styles.billingOptionTextActive
            ]}>
              Yearly
            </Text>
            <Badge
              label="Save up to 20%"
              variant="success"
              size="small"
              style={styles.savingsBadge}
            />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.plansContainer} showsVerticalScrollIndicator={false}>
          {subscriptionPlans.map((plan) => {
            const isCurrentPlan = plan.tier === currentTier;
            const price = selectedBilling === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const yearlyPrice = plan.yearlyPrice;
            const monthlyPrice = plan.monthlyPrice;
            const savings = getYearlySavings(monthlyPrice, yearlyPrice);
            
            return (
              <Card
                key={plan.id}
                variant={isCurrentPlan ? "outlined" : "elevated"}
                style={[
                  styles.planCard,
                  isCurrentPlan && styles.currentPlanCard
                ]}
              >
                <View style={styles.planHeader}>
                  <View style={styles.planHeaderLeft}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Badge
                      label={plan.badge.label}
                      variant="neutral"
                      style={[styles.planBadge, { backgroundColor: plan.badge.color }]}
                      textStyle={{ color: plan.badge.textColor }}
                    />
                  </View>
                  
                  <View style={styles.planPricing}>
                    <Text style={styles.planPrice}>
                      {formatPrice(price)}
                    </Text>
                    {price > 0 && (
                      <Text style={styles.planPeriod}>
                        /{selectedBilling === 'monthly' ? 'month' : 'year'}
                      </Text>
                    )}
                    {selectedBilling === 'yearly' && savings > 0 && (
                      <Text style={styles.savingsText}>
                        Save {savings}%
                      </Text>
                    )}
                  </View>
                </View>
                
                <Text style={styles.planDescription}>{plan.description}</Text>
                
                <View style={styles.featuresContainer}>
                  {plan.features.slice(0, 4).map((feature) => (
                    <View key={feature.id} style={styles.feature}>
                      {getFeatureIcon(feature.icon)}
                      <Text style={[
                        styles.featureText,
                        feature.highlight && styles.featureTextHighlight
                      ]}>
                        {feature.name}
                      </Text>
                    </View>
                  ))}
                  
                  {plan.features.length > 4 && (
                    <Text style={styles.moreFeatures}>
                      +{plan.features.length - 4} more features
                    </Text>
                  )}
                </View>
                
                {isCurrentPlan ? (
                  <View style={styles.currentPlanButton}>
                    <Text style={styles.currentPlanButtonText}>Current Plan</Text>
                  </View>
                ) : (
                  <Button
                    title={plan.tier === 'free' ? 'Downgrade' : 'Upgrade'}
                    onPress={() => onUpgrade(plan.tier)}
                    variant={plan.tier === 'elite' ? 'primary' : 'outline'}
                    style={styles.upgradeButton}
                  />
                )}
              </Card>
            );
          })}
        </ScrollView>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            • Cancel anytime • No hidden fees • 30-day money-back guarantee
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Colors.spacing.lg,
    paddingVertical: Colors.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  closeButton: {
    padding: Colors.spacing.sm,
  },
  billingToggle: {
    flexDirection: 'row',
    margin: Colors.spacing.lg,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Colors.radius.medium,
    padding: Colors.spacing.xs,
  },
  billingOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Colors.spacing.md,
    borderRadius: Colors.radius.small,
    gap: Colors.spacing.sm,
  },
  billingOptionActive: {
    backgroundColor: Colors.card,
    ...Colors.shadow.small,
  },
  billingOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  billingOptionTextActive: {
    color: Colors.text.primary,
  },
  savingsBadge: {
    marginLeft: Colors.spacing.xs,
  },
  plansContainer: {
    flex: 1,
    paddingHorizontal: Colors.spacing.lg,
  },
  planCard: {
    marginBottom: Colors.spacing.lg,
  },
  currentPlanCard: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Colors.spacing.md,
  },
  planHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Colors.spacing.md,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  planBadge: {
    paddingHorizontal: Colors.spacing.md,
    paddingVertical: Colors.spacing.xs,
  },
  planPricing: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  planPeriod: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: -4,
  },
  savingsText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600',
    marginTop: 2,
  },
  planDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Colors.spacing.lg,
    lineHeight: 20,
  },
  featuresContainer: {
    marginBottom: Colors.spacing.lg,
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
    flex: 1,
  },
  featureTextHighlight: {
    fontWeight: '600',
    color: Colors.primary,
  },
  moreFeatures: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    marginTop: Colors.spacing.xs,
  },
  upgradeButton: {
    width: '100%',
  },
  currentPlanButton: {
    paddingVertical: Colors.spacing.md,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Colors.radius.medium,
    alignItems: 'center',
  },
  currentPlanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  footer: {
    paddingHorizontal: Colors.spacing.lg,
    paddingVertical: Colors.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerText: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default SubscriptionUpgradeModal;