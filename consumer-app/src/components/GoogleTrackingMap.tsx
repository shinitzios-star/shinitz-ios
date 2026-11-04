/**
 * GoogleTrackingMap — the same tracking map, drawn by the native Google Maps SDK.
 *
 * Drop-in for TrackingMap: identical props, identical markers (store / customer
 * / rider) and the same optional route polyline. Native rather than a WebView,
 * so panning is smooth and there is no page to reload when a coordinate moves.
 *
 * REQUIRES "Maps SDK for Android" to be enabled on the Google Cloud project that
 * owns the key in app.json (android.config.googleMaps.apiKey), with billing
 * active. Until it is, the Google SDK renders a blank grey tile and there is no
 * reliable runtime signal to detect that — which is why TrackingMap chooses
 * between this and the Leaflet version from a single explicit switch rather than
 * trying to fall back automatically.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, LayoutAnimation,
  UIManager, Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../constants/theme';
import type { MapCoord } from './TrackingMap';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  storeLat: number;
  storeLng: number;
  destLat: number;
  destLng: number;
  riderLat?: number | null;
  riderLng?: number | null;
  route?: MapCoord[] | null;
  height?: number;
  showRecenter?: boolean;
  expandable?: boolean;
  etaLabel?: string;
  etaMinutes?: number | null;
  distanceKm?: number | null;
}

/** Region that contains every point, with a margin so no pin sits on the edge. */
function regionFor(points: MapCoord[]): Region {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    // 1.6x padding, with a floor so a single point isn't zoomed to street level.
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.008),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.008),
  };
}

export default function GoogleTrackingMap({
  storeLat, storeLng, destLat, destLng, riderLat, riderLng, route,
  height = 220, showRecenter = true, expandable = false,
  etaLabel, etaMinutes, distanceKm,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const [expanded, setExpanded] = useState(false);

  const points = useMemo(() => {
    const pts: MapCoord[] = [
      { latitude: storeLat, longitude: storeLng },
      { latitude: destLat, longitude: destLng },
    ];
    if (riderLat != null && riderLng != null) {
      pts.push({ latitude: riderLat, longitude: riderLng });
    }
    return pts;
  }, [storeLat, storeLng, destLat, destLng, riderLat, riderLng]);

  const initialRegion = useMemo(() => regionFor(points), []); // eslint-disable-line react-hooks/exhaustive-deps

  const recenter = () => {
    mapRef.current?.fitToCoordinates(points, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  };

  // Keep every pin in view as the rider moves, without yanking the camera on
  // each GPS ping — animateToRegion eases rather than jumping.
  useEffect(() => {
    if (riderLat == null || riderLng == null) return;
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [riderLat, riderLng]); // eslint-disable-line react-hooks/exhaustive-deps

  const mapHeight = expanded ? Math.round(Dimensions.get('window').height * 0.75) : height;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
    setTimeout(recenter, 320);
  };

  const eta = etaLabel
    || (etaMinutes != null ? `${etaMinutes} min` : null)
    || (distanceKm != null ? `${distanceKm} km` : null);

  return (
    <View style={[styles.wrap, { height: mapHeight }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        loadingEnabled
        loadingIndicatorColor={COLORS.primary}
      >
        <Marker coordinate={{ latitude: storeLat, longitude: storeLng }}
                title="Restaurant" anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.pin, { backgroundColor: '#fff' }]}>
            <Text style={styles.pinEmoji}>🏪</Text>
          </View>
        </Marker>

        <Marker coordinate={{ latitude: destLat, longitude: destLng }}
                title="Delivery address" anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.pin, { backgroundColor: '#fff' }]}>
            <Text style={styles.pinEmoji}>📍</Text>
          </View>
        </Marker>

        {riderLat != null && riderLng != null && (
          <Marker coordinate={{ latitude: riderLat, longitude: riderLng }}
                  title="Your delivery partner" anchor={{ x: 0.5, y: 0.5 }}
                  // Redrawing on every ping keeps the marker in step with the
                  // coordinate on Android, which otherwise lags behind.
                  tracksViewChanges={false}>
            <View style={[styles.pin, styles.riderPin]}>
              <Text style={styles.pinEmoji}>🏍️</Text>
            </View>
          </Marker>
        )}

        {route && route.length > 1 && (
          <Polyline coordinates={route} strokeWidth={4} strokeColor={COLORS.primary} />
        )}
      </MapView>

      {eta && (
        <View style={styles.etaPill}>
          <Text style={styles.etaText}>{eta}</Text>
        </View>
      )}

      {expandable && (
        <TouchableOpacity style={[styles.ctrl, styles.ctrlTopRight]} onPress={toggle}
                          accessibilityLabel={expanded ? 'Collapse map' : 'Expand map'}>
          <Ionicons name={expanded ? 'contract' : 'expand'} size={18} color="#111" />
        </TouchableOpacity>
      )}

      {showRecenter && (
        <TouchableOpacity style={[styles.ctrl, styles.ctrlBottomRight]} onPress={recenter}
                          accessibilityLabel="Recenter map">
          <Ionicons name="locate" size={18} color="#111" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: '#e9eef2' },
  pin: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  riderPin: { backgroundColor: COLORS.primary },
  pinEmoji: { fontSize: 17 },
  etaPill: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(17,17,17,0.85)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14,
  },
  etaText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  ctrl: {
    position: 'absolute', width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  ctrlTopRight: { top: 10, right: 10 },
  ctrlBottomRight: { bottom: 10, right: 10 },
});
