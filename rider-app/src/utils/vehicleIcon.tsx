import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Vehicle types a rider can register. Order matters for the selector grid.
export const VEHICLE_TYPES = ['Bicycle', 'Bike', 'Scooter', 'Car', 'Van'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

// MaterialCommunityIcons has dedicated, modern glyphs for each (Ionicons lacks
// motorbike / scooter / van), so vehicle branding is correct and consistent.
const ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  bicycle: 'bicycle',
  bike: 'motorbike',
  motorcycle: 'motorbike',
  motorbike: 'motorbike',
  scooter: 'moped',
  moped: 'moped',
  car: 'car',
  van: 'van-utility',
};

export function vehicleIconName(type?: string): keyof typeof MaterialCommunityIcons.glyphMap {
  return ICONS[(type || '').toLowerCase()] || 'help-circle-outline';
}

// Bicycles have no registration number; every other type is motorized.
export function isMotorized(type?: string): boolean {
  return !!type && type.toLowerCase() !== 'bicycle';
}

// Loose Indian registration-number check (e.g. MH12AB1234, DL8CAF5031).
export function isValidVehicleNumber(v?: string): boolean {
  const s = (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length < 5) return false;
  return /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/.test(s);
}

export function VehicleIcon({ type, size = 24, color }: { type?: string; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={vehicleIconName(type)} size={size} color={color} />;
}
