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
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { authAPI, msg91API } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

// This is the Consumer app — registration is hard-locked to the consumer role.
// There is no role picker; Rider / Restaurant / Kirana sign up in their own apps.
// (Admins are pre-provisioned and sign IN here via login, they never register.)
const APP_ROLE = 'consumer' as const;

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; ref?: string }>();
  const { login } = useAuthStore();

  // Steps: 1 = details, 2 = phone + OTP
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  // Optional referral code — prefilled from a share/deep-link if present.
  const [referralCode, setReferralCode] = useState((params.ref || '').toUpperCase());

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

    setLoading(true);
    try {
      const otpResponse = await msg91API.verifyOTP(phone, otpString);
      if (otpResponse.data.type !== 'success') {
        Alert.alert('Error', otpResponse.data.message || 'Invalid OTP');
        setLoading(false);
        return;
      }

      // Role is always consumer in this app.
      const registerData: any = {
        phone,
        name: name.trim(),
        role: APP_ROLE,
      };
      if (referralCode.trim()) {
        registerData.referral_code = referralCode.trim().toUpperCase();
      }

      const response = await authAPI.register(registerData);

      if (response.data.success) {
        await login(response.data.user, response.data.token);
        router.replace('/(consumer)/home');
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

  const renderStep2 = () => (
    <View>
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
          <Button title="Send OTP" onPress={handleSendOTP} loading={otpLoading}
            disabled={phone.length < 10} size="lg" style={styles.button} />
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
          <Button title="Verify & Register" onPress={handleVerifyAndRegister} loading={loading}
            disabled={otp.join('').length !== 4} size="lg" style={styles.button} />
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

          <View style={styles.progressContainer}>
            {[1, 2].map((s) => (
              <View key={s} style={[styles.progressDot, step >= s && styles.progressDotActive]} />
            ))}
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              {step === 1 ? 'Just a couple of details to get started' : 'Verify your phone number'}
            </Text>
          </View>

          {step === 1 && (
            <>
              <Input label="Full Name" placeholder="Enter your full name" value={name} onChangeText={setName}
                leftIcon={<Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />} />

              <Input
                label="Referral Code (Optional)"
                placeholder="Enter a friend's code"
                value={referralCode}
                onChangeText={(t) => setReferralCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
                autoCapitalize="characters"
                leftIcon={<Ionicons name="gift-outline" size={20} color={COLORS.textSecondary} />}
              />

              <Button title="Next" onPress={() => {
                if (!name.trim()) { Alert.alert('Error', 'Please enter your name'); return; }
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
