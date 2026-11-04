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
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { authAPI, msg91API } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

type Role = 'consumer' | 'kirana' | 'delivery' | 'restaurant';

const ROLES: { id: Role; label: string; icon: keyof typeof Ionicons.glyphMap; description: string }[] = [
  { id: 'consumer', label: 'Consumer', icon: 'person', description: 'Order groceries & food' },
  { id: 'kirana', label: 'Kirana Partner', icon: 'storefront', description: 'Sell your products' },
  { id: 'delivery', label: 'Delivery Partner', icon: 'bicycle', description: 'Earn by delivering' },
  { id: 'restaurant', label: 'Restaurant', icon: 'restaurant', description: 'List your restaurant' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; role?: string; ref?: string }>();
  const { login } = useAuthStore();

  // Steps: 1 = role, 2 = details, 3 = phone+OTP
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<Role | null>((params.role as Role) || null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  // Optional referral code — prefilled from a share/deep-link if present.
  const [referralCode, setReferralCode] = useState((params.ref || '').toUpperCase());
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Role-specific fields
  const [storeName, setStoreName] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [upiId, setUpiId] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [fssaiNumber, setFssaiNumber] = useState('');
  const [gstNumber, setGstNumber] = useState('');

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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location to continue');
        return;
      }
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

  const handleRoleSelect = (roleId: Role) => {
    setSelectedRole(roleId);
    setTimeout(() => setStep(2), 300);
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
    if (selectedRole === 'delivery' && (!upiId.trim() || !upiId.includes('@'))) {
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

      // Step 2: Register with backend
      const registerData: any = {
        phone,
        name: name.trim(),
        role: selectedRole,
        location: location ? { lat: location.lat, lng: location.lng } : null,
        address: address.trim(),
      };

      // Optional referral code (consumers) — backend validates & links it.
      if (selectedRole === 'consumer' && referralCode.trim()) {
        registerData.referral_code = referralCode.trim().toUpperCase();
      }

      if (selectedRole === 'kirana') {
        registerData.store_name = storeName.trim();
        registerData.aadhaar = aadhaar.trim();
      } else if (selectedRole === 'delivery') {
        registerData.vehicle_type = vehicleType;
        registerData.vehicle_number = vehicleNumber.trim();
        registerData.upi_id = upiId.trim();
      } else if (selectedRole === 'restaurant') {
        registerData.restaurant_name = restaurantName.trim();
        registerData.fssai_number = fssaiNumber.trim();
        registerData.gst_number = gstNumber.trim();
      }

      console.log('Registering with data:', JSON.stringify(registerData));
      const response = await authAPI.register(registerData);
      console.log('Register response:', JSON.stringify(response.data));

      if (response.data.success) {
        await login(response.data.user, response.data.token);
        redirectToRoleScreen(selectedRole!);
      } else {
        Alert.alert('Error', response.data.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Register error:', JSON.stringify(error.response?.data));
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

  const redirectToRoleScreen = (role: string) => {
    switch (role) {
      case 'consumer': router.replace('/(consumer)/home'); break;
      case 'kirana': router.replace('/(kirana)/dashboard'); break;
      case 'delivery': router.replace('/(delivery)/available'); break;
      case 'restaurant': router.replace('/(restaurant)/dashboard'); break;
      default: router.replace('/(consumer)/home');
    }
  };

  const renderRoleSelection = () => (
    <View style={styles.roleGrid}>
      {ROLES.map((role) => {
        const isSelected = selectedRole === role.id;
        return (
          <TouchableOpacity
            key={role.id}
            style={[styles.roleCard, isSelected && styles.roleCardSelected]}
            onPress={() => handleRoleSelect(role.id)}
            activeOpacity={0.7}
          >
            {isSelected && (
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark" size={14} color="#ffffff" />
              </View>
            )}
            <View style={[styles.roleIconWrap, isSelected && styles.roleIconWrapSelected]}>
              <Ionicons name={role.icon} size={28} color={isSelected ? '#ffffff' : COLORS.textSecondary} />
            </View>
            <Text style={[styles.roleLabel, isSelected && styles.roleLabelSelected]}>{role.label}</Text>
            <Text style={[styles.roleDescription, isSelected && styles.roleDescSelected]}>{role.description}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderRoleFields = () => {
    switch (selectedRole) {
      case 'kirana':
        return (
          <>
            <Input label="Store Name" placeholder="Enter your store name" value={storeName} onChangeText={setStoreName}
              leftIcon={<Ionicons name="storefront-outline" size={20} color={COLORS.textSecondary} />} />
            <Input label="Aadhaar Number" placeholder="Enter 12-digit Aadhaar" value={aadhaar}
              onChangeText={(text) => setAadhaar(text.replace(/[^0-9]/g, '').slice(0, 12))}
              keyboardType="number-pad" maxLength={12}
              leftIcon={<Ionicons name="card-outline" size={20} color={COLORS.textSecondary} />} />
          </>
        );
      case 'delivery':
        return (
          <View style={styles.vehicleContainer}>
            <Text style={styles.fieldLabel}>Vehicle Type</Text>
            <View style={styles.vehicleOptions}>
              {['Bicycle', 'Bike', 'Scooter'].map((type) => (
                <TouchableOpacity key={type}
                  style={[styles.vehicleOption, vehicleType === type && styles.vehicleOptionSelected]}
                  onPress={() => setVehicleType(type)}>
                  <Ionicons name={type === 'Bicycle' ? 'bicycle' : 'car-sport'} size={24}
                    color={vehicleType === type ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={[styles.vehicleText, vehicleType === type && styles.vehicleTextSelected]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ marginTop: SPACING.md }}>
              <Input label="Vehicle Number" placeholder="e.g. MH12AB1234"
                value={vehicleNumber}
                onChangeText={(t) => setVehicleNumber(t.toUpperCase())}
                autoCapitalize="characters"
                leftIcon={<Ionicons name="car-outline" size={20} color={COLORS.textSecondary} />} />
            </View>
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
      case 'restaurant':
        return (
          <>
            <Input label="Restaurant Name" placeholder="Enter restaurant name" value={restaurantName} onChangeText={setRestaurantName}
              leftIcon={<Ionicons name="restaurant-outline" size={20} color={COLORS.textSecondary} />} />
            <Input label="FSSAI Number" placeholder="Enter FSSAI license number" value={fssaiNumber} onChangeText={setFssaiNumber}
              leftIcon={<Ionicons name="document-text-outline" size={20} color={COLORS.textSecondary} />} />
            <Input label="GST Number (Optional)" placeholder="Enter GST number" value={gstNumber} onChangeText={setGstNumber}
              leftIcon={<Ionicons name="receipt-outline" size={20} color={COLORS.textSecondary} />} />
          </>
        );
      default: return null;
    }
  };

  const renderStep3 = () => (
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
            {[1, 2, 3].map((s) => (
              <View key={s} style={[styles.progressDot, step >= s && styles.progressDotActive]} />
            ))}
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              {step === 1 ? 'Choose how you want to use Shinitz'
                : step === 2 ? 'Complete your profile'
                : 'Verify your phone number'}
            </Text>
          </View>

          {step === 1 && (
            <>
              {renderRoleSelection()}
              <Button title="Continue" onPress={() => {
                if (selectedRole) setStep(2);
                else Alert.alert('Select Role', 'Please choose how you want to use Shinitz');
              }} size="lg" style={StyleSheet.flatten([styles.button, selectedRole ? null : styles.buttonDisabled])} />
            </>
          )}

          {step === 2 && (
            <>
              <Input label="Full Name" placeholder="Enter your full name" value={name} onChangeText={setName}
                leftIcon={<Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />} />

              {selectedRole === 'consumer' && (
                <Input
                  label="Referral Code (Optional)"
                  placeholder="Enter a friend's code"
                  value={referralCode}
                  onChangeText={(t) => setReferralCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                  autoCapitalize="characters"
                  leftIcon={<Ionicons name="gift-outline" size={20} color={COLORS.textSecondary} />}
                />
              )}

              {renderRoleFields()}

              {(selectedRole === 'kirana' || selectedRole === 'delivery' || selectedRole === 'restaurant') && (
                <>
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
                </>
              )}

              <View style={styles.buttonRow}>
                <Button title="Back" onPress={() => setStep(1)} variant="outline" style={styles.backButton} />
                <Button title="Next" onPress={() => {
                  if (!name.trim()) { Alert.alert('Error', 'Please enter your name'); return; }
                  setStep(3);
                }} style={styles.registerButton} />
              </View>
            </>
          )}

          {step === 3 && renderStep3()}

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
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.xl },
  roleCard: { width: '47%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    alignItems: 'center', borderWidth: 2, borderColor: COLORS.border, position: 'relative', ...SHADOWS.sm },
  roleCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15', ...SHADOWS.md },
  checkBadge: { position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  roleIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center', alignItems: 'center' },
  roleIconWrapSelected: { backgroundColor: COLORS.primary },
  roleLabel: { fontSize: FONTS.sizes.md, fontWeight: '600', color: COLORS.text, marginTop: SPACING.sm },
  roleLabelSelected: { color: COLORS.primary, fontWeight: '700' },
  roleDescription: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: 'center' },
  roleDescSelected: { color: COLORS.primary, opacity: 0.7 },
  button: { width: '100%' },
  buttonDisabled: { opacity: 0.5 },
  fieldLabel: { fontSize: FONTS.sizes.md, color: COLORS.text, marginBottom: SPACING.xs, fontWeight: '500' },
  vehicleContainer: { marginBottom: SPACING.md },
  vehicleOptions: { flexDirection: 'row', gap: SPACING.sm },
  vehicleOption: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    alignItems: 'center', borderWidth: 2, borderColor: COLORS.border },
  vehicleOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  vehicleText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  vehicleTextSelected: { color: COLORS.primary, fontWeight: '600' },
  upiHint: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: SPACING.xs, lineHeight: 16 },
  locationContainer: { marginBottom: SPACING.md },
  locationBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  locationBtnText: { fontSize: FONTS.sizes.md, color: COLORS.text },
  buttonRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  backButton: { flex: 1 },
  registerButton: { flex: 2 },
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