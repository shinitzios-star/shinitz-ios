import React from 'react';
import { PremiumSplash } from './PremiumSplash';

interface Props {
  areaName?: string;
  refreshing?: boolean;
  notified?: boolean;
  onNotify: () => void;
  onRefresh: () => void;
  onBackToFood: () => void;
  onChangeAddress?: () => void;
}

/** Premium full-screen "Kirana Coming Soon" splash (dark + gold). */
export function KiranaComingSoon({ areaName, refreshing, notified, onNotify, onRefresh, onBackToFood, onChangeAddress }: Props) {
  return (
    <PremiumSplash
      badge="COMING SOON"
      title="Kirana Coming Soon"
      area="To Your Area"
      message="We are onboarding trusted stores near you to bring daily essentials to your doorstep!"
      heroIcon="basket"
      areaName={areaName}
      floaters={[
        { icon: 'nutrition-outline', left: 24, top: 14, size: 26, delay: 0 },
        { icon: 'leaf-outline', left: 280, top: 24, size: 24, delay: 250 },
        { icon: 'cart-outline', left: 40, top: 120, size: 26, delay: 500 },
        { icon: 'fast-food-outline', left: 284, top: 126, size: 22, delay: 750 },
        { icon: 'wine-outline', left: 150, top: 2, size: 20, delay: 1000 },
      ]}
      chips={[
        { icon: 'basket-outline', title: 'DAILY ESSENTIALS', sub: 'Groceries, snacks & more' },
        { icon: 'bicycle-outline', title: 'FAST DELIVERY', sub: 'At your doorstep' },
        { icon: 'storefront-outline', title: 'TRUSTED STORES', sub: 'You can rely on' },
        { icon: 'ribbon-outline', title: 'BEST QUALITY', sub: 'Prices you love' },
      ]}
      notified={notified}
      refreshing={refreshing}
      onNotify={onNotify}
      onRefresh={onRefresh}
      onChangeAddress={onChangeAddress}
      secondary={{ label: 'Browse Food', icon: 'restaurant-outline', onPress: onBackToFood }}
    />
  );
}
