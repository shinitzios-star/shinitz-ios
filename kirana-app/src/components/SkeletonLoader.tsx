import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { RADIUS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = RADIUS.md,
  style,
}) => {
  const { colors } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const backgroundColor = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surface, colors.surfaceLight],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor,
        },
        style,
      ]}
    />
  );
};

export const ProductCardSkeleton: React.FC = () => {
  const { colors } = useTheme();
  return (
  <View style={[skeletonStyles.productCard, { backgroundColor: colors.card }]}>
    <Skeleton height={120} borderRadius={0} />
    <View style={skeletonStyles.productContent}>
      <Skeleton width="80%" height={14} />
      <Skeleton width="50%" height={12} style={{ marginTop: 8 }} />
      <View style={skeletonStyles.productFooter}>
        <Skeleton width={50} height={18} />
        <Skeleton width={60} height={30} borderRadius={RADIUS.md} />
      </View>
    </View>
  </View>
  );
};

export const ProductGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <View style={skeletonStyles.grid}>
    {Array.from({ length: count }).map((_, i) => (
      <ProductCardSkeleton key={i} />
    ))}
  </View>
);

export const OrderCardSkeleton: React.FC = () => {
  const { colors } = useTheme();
  return (
  <View style={[skeletonStyles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={skeletonStyles.orderHeader}>
      <Skeleton width={100} height={14} />
      <Skeleton width={70} height={24} borderRadius={RADIUS.full} />
    </View>
    <View style={{ gap: 8, marginTop: 12 }}>
      <Skeleton width="70%" height={12} />
      <Skeleton width="50%" height={12} />
    </View>
    <View style={[skeletonStyles.orderFooter, { borderTopColor: colors.border }]}>
      <Skeleton width={60} height={16} />
      <Skeleton width={80} height={12} />
    </View>
  </View>
  );
};

export const OrderListSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <View style={{ gap: 12 }}>
    {Array.from({ length: count }).map((_, i) => (
      <OrderCardSkeleton key={i} />
    ))}
  </View>
);

export const ProfileSkeleton: React.FC = () => (
  <View style={skeletonStyles.profile}>
    <View style={skeletonStyles.profileHeader}>
      <Skeleton width={70} height={70} borderRadius={35} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="60%" height={18} />
        <Skeleton width="40%" height={14} />
        <Skeleton width={80} height={20} borderRadius={RADIUS.sm} />
      </View>
    </View>
    <View style={{ gap: 16, marginTop: 24 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} width="100%" height={48} />
      ))}
    </View>
  </View>
);

const skeletonStyles = StyleSheet.create({
  productCard: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    width: '48%',
    marginBottom: 16,
  },
  productContent: {
    padding: 8,
    gap: 4,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  orderCard: {
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  profile: {
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
});
