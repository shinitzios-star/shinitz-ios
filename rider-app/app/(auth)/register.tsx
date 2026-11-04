import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { ensureLocationAccess } from '../../src/delivery/locationConsent';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { authAPI, msg91API } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { VehicleIcon, VEHICLE_TYPES, isMotorized, isValidVehicleNumber } from '../../src/utils/vehicleIcon';

// This is the Rider app — registration is hard-locked to the delivery role.
// There is no role picker here; Consumer / Restaurant / Kirana flows live in
// their own apps and must never appear in rider onboarding.
const APP_ROLE = 'delivery' as const;

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const { login } = useAuthStore();

  // Steps: 1 = rider details, 2 = phone + OTP
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Rider-specific fields
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [upiId, setUpiId] = useState('');

  // Phone + OTP fields
  const [phone, setPhone] = useState(params.phone || '');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const getLocation = async () => {
    setLocationLoading(true);
    try {
      // Through the consent gate: the prominent disclosure first, then the
      // system dialog. A refusal is explained there (with a Settings link), so
      // no second alert is needed here.
      const access = await ensureLocationAccess({ background: false, mode: 'explicit' });
      if (!access.foreground) return;
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      const [addressResult] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (addressResult) {
        const addr = [
          addressResult.streetNumber,
          addressResult.street,
          addressResult.district,
          addressResult.city,
          addressResult.postalCode,
        ].filter(Boolean).join(', ');
        setAddress(addr);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get location');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }
    setOtpLoading(true);
    try {
      const response = await msg91API.sendOTP(phone);
      if (response.data.type === 'success') {
        setOtpSent(true);
        setResendTimer(30);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to send OTP');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyAndRegister = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 4) {
      Alert.alert('Error', 'Please enter the complete 4-digit OTP');
      return;
    }
    // Riders must provide a valid UPI ID — earnings are paid here.
    if (!upiId.trim() || !upiId.includes('@')) {
      Alert.alert('UPI required', 'Please enter a valid UPI ID (e.g. name@okhdfcbank) to receive your earnings.');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Verify OTP with MSG91
      const otpResponse = await msg91API.verifyOTP(phone, otpString);
      if (otpResponse.data.type !== 'success') {
        Alert.alert('Error', otpResponse.data.message || 'Invalid OTP');
        setLoading(false);
        return;
      }

      // Step 2: Register with backend — role is always delivery in this app.
      const registerData: any = {
        phone,
        name: name.trim(),
        role: APP_ROLE,
        location: location ? { lat: location.lat, lng: location.lng } : null,
        address: address.trim(),
        vehicle_type: vehicleType,
        vehicle_number: isMotorized(vehicleType) ? vehicleNumber.trim() : '',
        upi_id: upiId.trim(),
      };

      const response = await authAPI.register(registerData);

      if (response.data.success) {
        await login(response.data.user, response.data.token);
        router.replace('/(delivery)/home');
      } else {
        Alert.alert('Error', response.data.message || 'Registration failed');
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      let msg = 'Registration failed';
      if (Array.isArray(detail)) {
        msg = detail.map((e: any) => `${e.loc?.join('.')} - ${e.msg}`).join('\n');
      } else if (typeof detail === 'string') {
        msg = detail;
      } else if (error.message) {
        msg = error.message;
      }
      Alert.alert('Registration Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const renderRiderFields = () => (
    <View style={styles.vehicleContainer}>
      <Text style={styles.fieldLabel}>Vehicle Type</Text>
      <View style={styles.vehicleOptions}>
        {VEHICLE_TYPES.map((type) => (
          <TouchableOpacity key={type}
            style={[styles.vehicleOption, vehicleType === type && styles.vehicleOptionSelected]}
            onPress={() => { setVehicleType(type); if (type === 'Bicycle') setVehicleNumber(''); }}>
            <VehicleIcon type={type} size={26} color={vehicleType === type ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[styles.vehicleText, vehicleType === type && styles.vehicleTextSelected]}>{type}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Bicycles have no registration number → hide the field; motor vehicles require it. */}
      {isMotorized(vehicleType) ? (
        <View style={{ marginTop: SPACING.md }}>
          <Input label="Vehicle Number" placeholder="e.g. MH12AB1234"
            value={vehicleNumber}
            onChangeText={(t) => setVehicleNumber(t.toUpperCase())}
            autoCapitalize="characters"
            leftIcon={<VehicleIcon type={vehicleType} size={20} color={COLORS.textSecondary} />} />
        </View>
      ) : vehicleType === 'Bicycle' ? (
        <Text style={styles.bicycleHint}>Vehicle registration number is not required for bicycles.</Text>
      ) : null}
      <View style={{ marginTop: SPACING.md }}>
        <Input label="UPI ID (for payouts)" placeholder="e.g. yourname@okhdfcbank"
          value={upiId}
          onChangeText={(t) => setUpiId(t.trim())}
          autoCapitalize="none"
          keyboardType="email-address"
          leftIcon={<Ionicons name="wallet-outline" size={20} color={COLORS.textSecondary} />} />
        <Text style={styles.upiHint}>We send ₹1 to verify your account is real. Earnings are paid to this UPI.</Text>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View>
      {/* Phone Input */}
      {!otpSent ? (
        <>
          <Text style={styles.stepTitle}>Verify your phone</Text>
          <Text style={styles.stepSubtitle}>We'll send an OTP to confirm your number</Text>
          <Input
            label="Phone Number"
            placeholder="Enter 10-digit phone number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, '').slice(0, 10))}
            maxLength={10}
            leftIcon={<Text style={styles.countryCode}>+91 </Text>}
          />
          <Button
            title="Send OTP"
            onPress={handleSendOTP}
            loading={otpLoading}
            disabled={phone.length < 10}
            size="lg"
            style={styles.button}
          />
        </>
      ) : (
        <>
          <Text style={styles.stepTitle}>Enter OTP</Text>
          <Text style={styles.stepSubtitle}>Sent to +91 {phone}</Text>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[styles.otpInput, digit && styles.otpInputFilled]}
                maxLength={1}
                keyboardType="number-pad"
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                autoFocus={index === 0}
              />
            ))}
          </View>

          <Button
            title="Verify & Register"
            onPress={handleVerifyAndRegister}
            loading={loading}
            disabled={otp.join('').length !== 4}
            size="lg"
            style={styles.button}
          />

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive code? </Text>
            {resendTimer > 0 ? (
              <Text style={styles.timerText}>Resend in {resendTimer}s</Text>
            ) : (
              <TouchableOpacity onPress={handleSendOTP}>
                <Text style={styles.resendLink}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity onPress={() => { setOtpSent(false); setOtp(['', '', '', '']); }} style={styles.changePhone}>
            <Text style={styles.changePhoneText}>Change phone number</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backBtn} onPress={() => step > 1 ? setStep(step - 1) : router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            {[1, 2].map((s) => (
              <View key={s} style={[styles.progressDot, step >= s && styles.progressDotActive]} />
            ))}
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Become a Delivery Partner</Text>
            <Text style={styles.subtitle}>
              {step === 1 ? 'Tell us about you and your vehicle' : 'Verify your phone number'}
            </Text>
          </View>

          {step === 1 && (
            <>
              <Input label="Full Name" placeholder="Enter your full name" value={name} onChangeText={setName}
                leftIcon={<Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />} />

              {renderRiderFields()}

              <View style={styles.locationContainer}>
                <Text style={styles.fieldLabel}>Your Location</Text>
                <TouchableOpacity style={styles.locationBtn} onPress={getLocation} disabled={locationLoading}>
                  <Ionicons name={location ? 'checkmark-circle' : 'location'} size={24}
                    color={location ? COLORS.success : COLORS.primary} />
                  <Text style={styles.locationBtnText}>
                    {locationLoading ? 'Getting location...' : location ? 'Location set' : 'Set Current Location'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Input label="Address" placeholder="Enter your address" value={address} onChangeText={setAddress}
                multiline numberOfLines={2}
                leftIcon={<Ionicons name="home-outline" size={20} color={COLORS.textSecondary} />} />

              <Button title="Next" onPress={() => {
                if (!name.trim()) { Alert.alert('Error', 'Please enter your name'); return; }
                if (!vehicleType) { Alert.alert('Error', 'Please select your vehicle type'); return; }
                if (isMotorized(vehicleType)) {
                  if (!vehicleNumber.trim()) { Alert.alert('Error', 'Please enter your vehicle number'); return; }
                  if (!isValidVehicleNumber(vehicleNumber)) { Alert.alert('Error', 'Please enter a valid vehicle number (e.g. MH12AB1234)'); return; }
                }
                setStep(2);
              }} size="lg" style={styles.button} />
            </>
          )}

          {step === 2 && renderStep2()}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.sm },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  progressDotActive: { backgroundColor: COLORS.primary, width: 24 },
  header: { marginTop: SPACING.md, marginBottom: SPACING.lg },
  title: { fontSize: FONTS.sizes.xxxl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  subtitle: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
  stepTitle: { fontSize: FONTS.sizes.xxl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  stepSubtitle: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  button: { width: '100%', marginTop: SPACING.md },
  fieldLabel: { fontSize: FONTS.sizes.md, color: COLORS.text, marginBottom: SPACING.xs, fontWeight: '500' },
  vehicleContainer: { marginBottom: SPACING.md },
  vehicleOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  vehicleOption: { width: '30%', flexGrow: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md, paddingHorizontal: 4, alignItems: 'center', borderWidth: 2, borderColor: COLORS.border },
  vehicleOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  vehicleText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  vehicleTextSelected: { color: COLORS.primary, fontWeight: '600' },
  upiHint: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: SPACING.xs, lineHeight: 16 },
  bicycleHint: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: SPACING.md, lineHeight: 18, fontStyle: 'italic' },
  locationContainer: { marginBottom: SPACING.md },
  locationBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  locationBtnText: { fontSize: FONTS.sizes.md, color: COLORS.text },
  countryCode: { fontSize: FONTS.sizes.lg, color: COLORS.text, fontWeight: '600' },
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xl },
  otpInput: { width: 65, height: 65, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, fontSize: FONTS.sizes.xxl, fontWeight: '700',
    color: COLORS.text, textAlign: 'center' },
  otpInputFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  resendContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg },
  resendText: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
  timerText: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
  resendLink: { fontSize: FONTS.sizes.md, color: COLORS.primary, fontWeight: '600' },
  changePhone: { alignItems: 'center', marginTop: SPACING.md },
  changePhoneText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textDecorationLine: 'underline' },
});
