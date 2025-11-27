import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Hook for biometric authentication
 * Note: Requires @capacitor-community/biometric-auth plugin
 * Install after exporting to GitHub with: npm install @capacitor-community/biometric-auth
 */
export const useBiometricAuth = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('none');

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    if (!Capacitor.isNativePlatform()) {
      setIsAvailable(false);
      return;
    }

    // Placeholder for actual biometric check
    // When plugin is installed, use:
    // const { isAvailable } = await BiometricAuth.checkBiometry();
    setIsAvailable(false);
    setBiometricType('fingerprint'); // or 'face' or 'iris'
  };

  const authenticate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!Capacitor.isNativePlatform()) {
      return { success: false, error: 'Not running on native platform' };
    }

    try {
      // Placeholder for actual authentication
      // When plugin is installed, use:
      // await BiometricAuth.authenticate({
      //   reason: 'Login to Shariz',
      //   title: 'Biometric Authentication',
      //   subtitle: 'Use your fingerprint or face to login',
      //   negativeButtonText: 'Cancel'
      // });
      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Authentication failed' };
    }
  };

  return {
    isAvailable,
    biometricType,
    authenticate
  };
};
