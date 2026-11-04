import React from 'react';
import { PremiumSplash } from './PremiumSplash';

interface Props {
  areaName?: string;
  refreshing?: boolean;
  notified?: boolean;
  onBrowseMenu: () => void;
  onNotify: () => void;
  onRefresh: () => void;
  onChangeAddress?: () => void;
}

/** Premium full-screen "Restaurant Not Available In Your Area" splash (dark + gold). */
export function RestaurantUnavailable({ areaName, refreshing, notified, onBrowseMenu, onNotify, onRefresh, onChangeAddress }: Props) {
  return (
    <PremiumSplash
      badge="SORRY!"
      title="Not Available"
      area="In Your Area"
      message="We're working hard to bring your favorite restaurants to your area soon!"
      heroIcon="restaurant"
      areaName={areaName}
      floaters={[
        { icon: 'pizza-outline', left: 24, top: 14, size: 26, delay: 0 },
        { icon: 'fast-food-outline', left: 282, top: 22, size: 24, delay: 250 },
        { icon: 'cafe-outline', left: 40, top: 122, size: 24, delay: 500 },
        { icon: 'ice-cream-outline', left: 284, top: 126, size: 22, delay: 800 },
      ]}
      chips={[
        { icon: 'compass-outline', title: 'MORE CHOICES', sub: 'Amazing restaurants' },
        { icon: 'notifications-outline', title: 'GET NOTIFIED', sub: 'When we launch' },
        { icon: 'bicycle-outline', title: 'FAST DELIVERY', sub: 'At your doorstep' },
        { icon: 'shield-checkmark-outline', title: 'TRUSTED SERVICE', sub: 'Safe & reliable' },
      ]}
      primary={{ label: 'Browse Menu', icon: 'restaurant', onPress: onBrowseMenu }}
      notified={notified}
      refreshing={refreshing}
      onNotify={onNotify}
      onRefresh={onRefresh}
      onChangeAddress={onChangeAddress}
    />
  );
}
