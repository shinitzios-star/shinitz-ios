import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { adminAPI } from '../../src/services/api';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', accepted: 'Accepted', delivery_assigned: 'Rider assigned',
  preparing: 'Preparing', ready_for_pickup: 'Ready', out_for_delivery: 'On the way',
};

const MAP_HTML = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0;background:#0c0c0c}</style></head><body><div id="m"></div>
<script>
var map=L.map('m',{attributionControl:false,zoomControl:true}).setView([20.59,78.96],4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
var layer=L.layerGroup().addTo(map);
function dot(c){return L.divIcon({className:'',html:'<div style="width:12px;height:12px;border-radius:50%;background:'+c+';border:2px solid #fff;box-shadow:0 0 0 2px '+c+'55"></div>',iconSize:[12,12],iconAnchor:[6,6]});}
window.setData=function(pts){layer.clearLayers();var b=[];pts.forEach(function(p){L.marker([p.lat,p.lng],{icon:dot(p.color)}).bindPopup(p.label||'').addTo(layer);b.push([p.lat,p.lng]);});if(b.length){try{map.fitBounds(b,{padding:[30,30],maxZoom:14});}catch(e){}}};
true;
</script></body></html>`;

export default function AdminLiveOrdersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState<any>({ orders: [], summary: {} });
  const webRef = useRef<WebView>(null);
  const mapReady = useRef(false);

  const load = () => {
    adminAPI.liveOrders().then((r) => setData(r.data || { orders: [], summary: {} })).catch(() => {});
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  // Push markers into the map whenever orders change.
  useEffect(() => {
    if (!mapReady.current || !webRef.current) return;
    const pts: any[] = [];
    (data.orders || []).forEach((o: any) => {
      if (o.restaurant_location?.lat != null) pts.push({ lat: o.restaurant_location.lat, lng: o.restaurant_location.lng, color: '#10b981', label: 'Restaurant: ' + (o.restaurant_name || '') });
      if (o.rider_location?.lat != null) pts.push({ lat: o.rider_location.lat, lng: o.rider_location.lng, color: '#3b82f6', label: 'Rider: ' + (o.rider_name || '') });
      if (o.delivery_location?.lat != null) pts.push({ lat: o.delivery_location.lat, lng: o.delivery_location.lng, color: '#ef4444', label: 'Drop: ' + (o.customer_name || '') });
    });
    webRef.current.injectJavaScript(`window.setData && window.setData(${JSON.stringify(pts)}); true;`);
  }, [data]);

  const s = data.summary || {};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Orders</Text>
        <TouchableOpacity onPress={load} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.sumRow}>
          <Sum styles={styles} label="Active" value={s.active || 0} tone={colors.primary} />
          <Sum styles={styles} label="On the way" value={s.out_for_delivery || 0} tone="#3b82f6" />
          <Sum styles={styles} label="Delayed" value={s.delayed || 0} tone="#ef4444" />
          <Sum styles={styles} label="No rider" value={s.unassigned || 0} tone="#D4AF37" />
        </View>

        <View style={styles.mapWrap}>
          <WebView
            ref={webRef}
            source={{ html: MAP_HTML }}
            originWhitelist={['*']}
            onLoadEnd={() => { mapReady.current = true; setData((d: any) => ({ ...d })); }}
            style={{ flex: 1, backgroundColor: '#0c0c0c' }}
          />
        </View>
        <View style={styles.legend}>
          <Legend styles={styles} color="#10b981" label="Restaurant" />
          <Legend styles={styles} color="#3b82f6" label="Rider" />
          <Legend styles={styles} color="#ef4444" label="Customer" />
        </View>

        {(data.orders || []).length === 0 && <Text style={styles.empty}>No active orders right now.</Text>}
        {(data.orders || []).map((o: any) => (
          <View key={o.id} style={[styles.orderCard, o.delayed && { borderColor: '#ef4444' }]}>
            <View style={styles.orderTop}>
              <Text style={styles.orderId}>#{(o.id || '').slice(-8).toUpperCase()}</Text>
              <View style={[styles.statusPill, { backgroundColor: colors.primary + '22' }]}>
                <Text style={[styles.statusText, { color: colors.primary }]}>{STATUS_LABEL[o.status] || o.status}</Text>
              </View>
            </View>
            <View style={styles.orderTop}>
              <Text style={styles.amount}>₹{o.total_amount}</Text>
              <Text style={styles.age}>{o.age_min != null ? `${o.age_min} min ago` : ''}</Text>
            </View>
            <Row styles={styles} label="Restaurant" value={o.restaurant_name} />
            <Row styles={styles} label="Customer" value={o.customer_name} />
            <Row styles={styles} label="Rider" value={o.rider_name || '—'} />
            {o.eta_minutes != null && <Row styles={styles} label="ETA" value={`~${o.eta_minutes} min`} />}
            <View style={styles.flagRow}>
              {o.delayed && <Flag styles={styles} tone="#ef4444" text="Delayed" />}
              {o.stuck_pending && <Flag styles={styles} tone="#D4AF37" text="Not accepted" />}
              {o.unassigned && <Flag styles={styles} tone="#D4AF37" text="No rider" />}
            </View>
          </View>
        ))}
        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Sum({ styles, label, value, tone }: any) {
  return (
    <View style={styles.sumCard}>
      <Text style={[styles.sumValue, { color: tone }]}>{value}</Text>
      <Text style={styles.sumLabel}>{label}</Text>
    </View>
  );
}
function Row({ styles, label, value }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}
function Flag({ styles, tone, text }: any) {
  return <View style={[styles.flag, { backgroundColor: tone + '22' }]}><Text style={[styles.flagText, { color: tone }]}>{text}</Text></View>;
}
function Legend({ styles, color, label }: any) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: colors.text },
  scroll: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
  sumRow: { flexDirection: 'row', gap: SPACING.sm },
  sumCard: { flex: 1, backgroundColor: colors.card, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  sumValue: { fontSize: FONTS.sizes.xl, fontWeight: '900' },
  sumLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  mapWrap: { height: 280, borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACING.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#0c0c0c' },
  legend: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm, marginBottom: SPACING.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: colors.textSecondary },
  empty: { fontSize: FONTS.sizes.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: SPACING.xl },
  orderCard: { backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: colors.border, marginBottom: SPACING.sm },
  orderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  orderId: { fontSize: FONTS.sizes.xs, color: colors.textMuted, fontWeight: '700' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 10, fontWeight: '800' },
  amount: { fontSize: FONTS.sizes.lg, fontWeight: '900', color: colors.text },
  age: { fontSize: FONTS.sizes.xs, color: colors.textSecondary },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm, marginTop: 2 },
  rowLabel: { fontSize: FONTS.sizes.xs, color: colors.textSecondary },
  rowValue: { flex: 1, textAlign: 'right', fontSize: FONTS.sizes.xs, color: colors.text, fontWeight: '600' },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  flag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  flagText: { fontSize: 10, fontWeight: '800' },
});
