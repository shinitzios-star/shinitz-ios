import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../../src/constants/theme';
import { msg91API } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

const ShinitzLogo = require('../../assets/images/rider-logo.png');

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { login } = useAuthStore();

  const handleSendOTP = async () => {
    setErrorMsg('');
    if (phone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      console.log('Sending OTP via MSG91 to:', phone);
      const response = await msg91API.sendOTP(phone);
      console.log('MSG91 Send OTP response:', JSON.stringify(response.data));

      // MSG91 returns type: "success" on success
      if (response.data.type === 'success' || response.data.message === 'OTP sent successfully') {
        router.push({
          pathname: '/(auth)/verify-otp',
          params: {
            phone,
            role: params.role || 'delivery',
          },
        });
      } else {
        const msg = response.data.message || 'Failed to send OTP';
        setErrorMsg(msg);
        Alert.alert('Error', msg);
      }
    } catch (error: any) {
      console.error('MSG91 Send OTP error:', error);
      const msg =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        error.message ||
        'Failed to send OTP. Please try again.';
      setErrorMsg(msg);
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image source={ShinitzLogo} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.title}>Partner Login</Text>
            <Text style={styles.subtitle}>Enter your phone number to start delivering</Text>
          </View>

          <View style={styles.form}>
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
              title="Login with OTP"
              onPress={handleSendOTP}
              loading={loading}
              disabled={phone.length < 10}
              size="lg"
              style={styles.button}
            />

            {errorMsg ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#ef4444" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <Text style={styles.registerText}>
              Don't have an account?{' '}
              <Text
                style={styles.registerLink}
                onPress={() => router.push('/(auth)/register')}
              >
                Register
              </Text>
            </Text>
          </View>

          <View style={styles.features}>
            <View style={styles.featureItem}>
              <Ionicons name="time" size={20} color={COLORS.primary} />
              <Text style={styles.featureText}>Flexible hours</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.success} />
              <Text style={styles.featureText}>Secure</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="wallet" size={20} color={COLORS.primary} />
              <Text style={styles.featureText}>Daily payouts</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  header: {
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  logoContainer: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    marginBottom: SPACING.md,
  },
  logo: {
    width: 150,
    height: 75,
  },
  title: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  form: {
    flex: 1,
  },
  countryCode: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.text,
    fontWeight: '600',
  },
  button: {
    marginTop: SPACING.md,
  },
  registerText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  registerLink: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  featureItem: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  featureText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef444420',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  errorText: {
    fontSize: FONTS.sizes.sm,
    color: '#ef4444',
    flex: 1,
  },
});