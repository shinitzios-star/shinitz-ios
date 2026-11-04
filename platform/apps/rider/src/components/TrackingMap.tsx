/**
 * TrackingMap — OpenStreetMap via Leaflet inside a WebView.
 *
 * Why WebView+Leaflet instead of react-native-maps:
 *   react-native-maps on Android uses the Google Maps SDK, which REQUIRES a
 *   Google Maps API key in the manifest AND "Maps SDK for Android" enabled on an
 *   unrestricted key. Without that it renders blank. Leaflet in a WebView needs
 *   no key, no Google, no native map module — pure OSM tiles. It just works.
 *
 * Markers: 🏪 store · 📍 customer · 🏍️ rider (moves smoothly via injected JS).
 * Optional `route` draws an OSRM polyline (used on the rider nav screen).
 */

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../constants/theme';

export interface MapCoord { latitude: number; longitude: number; }

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
  etaLabel?: string;
  etaMinutes?: number | null;
  distanceKm?: number | null;
}

function buildHtml(
  storeLat: number, storeLng: number,
  destLat: number, destLng: number,
  riderLat: number | null, riderLng: number | null,
  route: MapCoord[] | null,
): string {
  const routeJson = route && route.length > 1
    ? JSON.stringify(route.map((c) => [c.latitude, c.longitude]))
    : 'null';
  const rider = riderLat != null && riderLng != null ? `[${riderLat},${riderLng}]` : 'null';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{height:100%;width:100%;margin:0;padding:0;background:#e8e8e8}
  .emoji-pin{font-size:22px;line-height:30px;text-align:center;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}
  .leaflet-control-attribution{font-size:8px}
</style>
</head>
<body>
<div id="map"></div>
<script>
  function pin(emoji){ return L.divIcon({html:'<div class="emoji-pin">'+emoji+'</div>', className:'', iconSize:[30,30], iconAnchor:[15,15]}); }
  // attributionControl:false → no clickable link that could open an external
  // browser. We show a static "© OpenStreetMap" label as a native overlay.
  var map = L.map('map', { zoomControl:false, attributionControl:false, preferCanvas:true });

  // CartoDB Voyager: clean, fast, free, no key — more app-reliable than the
  // main OSM tile server. Falls back to OSM if a tile errors.
  var tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom:20, subdomains:'abcd', crossOrigin:true
  }).addTo(map);
  tiles.on('tileerror', function(){
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, subdomains:'abc' }).addTo(map);
  });

  var store = L.marker([${storeLat},${storeLng}], {icon:pin('🏪')}).addTo(map);
  var dest  = L.marker([${destLat},${destLng}], {icon:pin('📍')}).addTo(map);
  var bounds = L.latLngBounds([[${storeLat},${storeLng}],[${destLat},${destLng}]]);

  var routeData = ${routeJson};
  if (routeData) { L.polyline(routeData, {color:'#0F3D2E', weight:5, opacity:.85}).addTo(map); }

  var riderPos = ${rider};
  var riderMarker = null;
  if (riderPos) { riderMarker = L.marker(riderPos, {icon:pin('🏍️')}).addTo(map); bounds.extend(riderPos); }

  map.fitBounds(bounds, { padding:[45,45], maxZoom:16 });

  // Smoothly slide the rider marker to a new position (no teleport jumps),
  // then keep it inside the viewport.
  var anim = null;
  window.updateRider = function(lat, lng){
    if (!riderMarker) {
      riderMarker = L.marker([lat,lng], {icon:pin('🏍️')}).addTo(map);
      map.panInside([lat,lng], { padding:[60,60] });
      return;
    }
    var start = riderMarker.getLatLng();
    var t0 = Date.now(); var dur = 800;
    if (anim) cancelAnimationFrame(anim);
    function step(){
      var k = Math.min(1, (Date.now()-t0)/dur);
      riderMarker.setLatLng([start.lat + (lat-start.lat)*k, start.lng + (lng-start.lng)*k]);
      if (k < 1) { anim = requestAnimationFrame(step); }
      else { map.panInside([lat,lng], { padding:[60,60] }); }
    }
    anim = requestAnimationFrame(step);
  };
  window.recenterRider = function(){ if (riderMarker) map.setView(riderMarker.getLatLng(), 16, {animate:true}); };

  // Tell React Native the map is ready (hide the loading overlay)
  setTimeout(function(){
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('ready');
  }, 300);
  true;
</script>
</body>
</html>`;
}

export function TrackingMap({
  storeLat, storeLng, destLat, destLng,
  riderLat, riderLng, route,
  height = 220, showRecenter = false,
  etaLabel, etaMinutes, distanceKm,
}: Props) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  // Rebuild HTML only when the *static* geometry changes (store/dest/route).
  // Rider movement is pushed via injectJavaScript so the map never reloads.
  const html = useMemo(
    () => buildHtml(storeLat, storeLng, destLat, destLng, riderLat ?? null, riderLng ?? null, route ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeLat, storeLng, destLat, destLng, route],
  );

  useEffect(() => {
    if (riderLat != null && riderLng != null) {
      webRef.current?.injectJavaScript(`window.updateRider && window.updateRider(${riderLat},${riderLng}); true;`);
    }
  }, [riderLat, riderLng]);

  const recenter = () => {
    webRef.current?.injectJavaScript('window.recenterRider && window.recenterRider(); true;');
  };

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webRef}
        source={{ html }}
        style={styles.web}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        cacheEnabled
        androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
        mixedContentMode="always"
        // Keep the map 100% INSIDE the app: the inline document + tiles/Leaflet
        // (sub-resources) load fine, but any attempt to navigate the main frame
        // to an external URL is blocked — nothing ever opens a browser.
        onShouldStartLoadWithRequest={(req) => !/^https?:\/\//i.test(req.url)}
        setSupportMultipleWindows={false}
        onMessage={(e) => { if (e.nativeEvent.data === 'ready') setReady(true); }}
        onLoadEnd={() => setTimeout(() => setReady(true), 600)}
      />

      {/* Loading overlay until the map signals ready */}
      {!ready && (
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      )}

      {/* Static OSM attribution (non-clickable — satisfies tile usage policy) */}
      <View style={styles.attribution} pointerEvents="none">
        <Text style={styles.attributionText}>© OpenStreetMap</Text>
      </View>

      {(etaMinutes != null || distanceKm != null) && (
        <View style={styles.etaBadge}>
          {etaMinutes != null && <Text style={styles.etaTime}>{etaMinutes} min</Text>}
          {distanceKm != null && <Text style={styles.etaDist}>{distanceKm} km away</Text>}
          {etaLabel && <Text style={styles.etaLabel}>{etaLabel}</Text>}
        </View>
      )}

      {showRecenter && (
        <TouchableOpacity style={styles.recenterBtn} onPress={recenter} activeOpacity={0.8}>
          <Ionicons name="locate" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: '#e8e8e8', position: 'relative' },
  web: { flex: 1, backgroundColor: 'transparent' },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: '#e8e8e8', justifyContent: 'center', alignItems: 'center' },
  etaBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 6,
  },
  etaTime: { color: '#fff', fontWeight: '800', fontSize: 14 },
  etaDist: { color: '#ddd', fontSize: 11, marginTop: 1 },
  etaLabel: { color: '#aaa', fontSize: 10, marginTop: 1 },
  recenterBtn: {
    position: 'absolute', bottom: 12, right: 10, width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 4,
  },
  attribution: {
    position: 'absolute', bottom: 3, left: 5,
    backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 4, borderRadius: 3,
  },
  attributionText: { fontSize: 8, color: '#333' },
});
