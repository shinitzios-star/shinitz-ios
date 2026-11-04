import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { authAPI, msg91API } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

export default function VerifyOTPScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone: string; role: string }>();
  const { login } = useAuthStore();

  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleOtpChange = (value: string, index: number) => {
    const digits = value.replace(/\D/g, ''); // digits only — drops spaces/letters
    // SMS auto-fill / paste: the whole code lands in one box → spread it out.
    if (digits.length > 1) {
      const next = [...otp];
      for (let i = 0; i < digits.length && index + i < 4; i++) next[index + i] = digits[i];
      setOtp(next);
      inputRefs.current[Math.min(index + digits.length, 3)]?.focus();
      return;
    }
    const newOtp = [...otp];
    newOtp[index] = digits;
    setOtp(newOtp);
    if (digits && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    if (loading) return; // prevent duplicate submits (double-tap / re-entry)
    const otpString = otp.join('');
    if (otpString.length !== 4) {
      setErrorMsg('Please enter complete OTP');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    try {
      // Backend verifies locally (instant) with an MSG91 fallback.
      const response = await authAPI.verifyOTP(params.phone, otpString);
      const data = response.data;

      if (data.success && data.verified) {
        if (data.user_exists && data.user && data.token) {
          // Existing user — login directly
          await login(data.user, data.token);
          redirectToRoleScreen(data.user.role);
        } else {
          // New user — go to register
          router.replace({
            pathname: '/(auth)/register',
            params: { phone: params.phone, role: params.role || 'consumer' },
          });
        }
      } else {
        const msg = data.message || 'Invalid OTP. Please try again.';
        setErrorMsg(msg);
        Alert.alert('Error', msg);
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        'Failed to verify OTP. Please try again.';
      setErrorMsg(msg);
      Alert.alert('Error', msg);
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
      case 'admin': router.replace('/(admin)/dashboard'); break;
      default: router.replace('/(consumer)/home');
    }
  };

  const handleResendOTP = async () => {
    try {
      setErrorMsg('');
      const response = await msg91API.resendOTP(params.phone);
      const data = response.data;
      if (data.type === 'success') {
        setResendTimer(30);
        Alert.alert('Success', 'OTP resent successfully');
      } else {
        Alert.alert('Error', data.message || 'Failed to resend OTP');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resend OTP. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed-outline" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>
            Enter the 4-digit code sent to{' '}
            <Text style={styles.phone}>+91 {params.phone}</Text>
          </Text>
        </View>

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
          title="Verify & Continue"
          onPress={handleVerifyOTP}
          loading={loading}
          disabled={otp.join('').length !== 4}
          size="lg"
          style={styles.button}
        />

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive code? </Text>
          {resendTimer > 0 ? (
            <Text style={styles.timerText}>Resend in {resendTimer}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResendOTP}>
              <Text style={styles.resendLink}>Resend OTP</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboardView: { flex: 1, paddingHorizontal: SPACING.lg },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.sm },
  header: { alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.xl },
  iconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  title: { fontSize: FONTS.sizes.xxxl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  subtitle: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary, textAlign: 'center' },
  phone: { color: COLORS.text, fontWeight: '600' },
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xl },
  otpInput: { width: 50, height: 60, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, fontSize: FONTS.sizes.xxl, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  otpInputFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  button: { width: '100%' },
  resendContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg },
  resendText: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
  timerText: { fontSize: FONTS.sizes.md, color: COLORS.textMuted },
  resendLink: { fontSize: FONTS.sizes.md, color: COLORS.primary, fontWeight: '600' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ef444420', borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.md, gap: SPACING.sm },
  errorText: { fontSize: FONTS.sizes.sm, color: '#ef4444', flex: 1 },
});