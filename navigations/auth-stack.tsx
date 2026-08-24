import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { COMMON_HEADER_OPTIONS_CONFIG, SCREENS } from '../src/common/constant';
import { Login } from '../src/screens/auth/login';
import { Register } from '../src/screens/auth/register';
import { RegisterVerifyOTP } from '../src/screens/auth/register/register-otp';
import { RegisterPassword } from '../src/screens/auth/register/register-password';
import { PasswordSet } from '../src/screens/auth/register/register-password/password-set';
import { EmailVerified } from '../src/screens/auth/register/register-otp/email-verified';
import { RegisterProfile } from '../src/screens/auth/register/register-profile';
import { RegisterBio } from '../src/screens/auth/register/register-bio';
import { RegisterSkipProfile } from '../src/screens/auth/register/register-profile/skip-profile';
import { RegisterSkipBio } from '../src/screens/auth/register/register-bio/skip-bio';
import ForgotPasswordScreen from '../src/screens/auth/resetpassword/ForgotPassword';
import EmailVerificationScreen from '../src/screens/auth/resetpassword/EmailVerification';
import ResetPasswordScreen from '../src/screens/auth/resetpassword/ResetPassword';
import ResetConfirmScreen from '../src/screens/auth/resetpassword/ResetConfirm';


const Stack = createNativeStackNavigator();

export const AuthStack = () => (
  <Stack.Navigator
    initialRouteName={SCREENS.LOGIN}
    screenOptions={COMMON_HEADER_OPTIONS_CONFIG}>
    <Stack.Screen name={SCREENS.LOGIN} component={Login} />
    <Stack.Screen name={SCREENS.REGISTER} component={Register} />
    <Stack.Screen
      name={SCREENS.REGISTER_PASSWORD}
      component={RegisterPassword}
    />
    <Stack.Screen
      name={SCREENS.PASSWORD_SET}
      component={PasswordSet}
    />
    <Stack.Screen
      name={SCREENS.REGISTER_PROFILE}
      component={RegisterProfile}
    />
    <Stack.Screen
      name={SCREENS.REGISTER_SKIP_PROFILE}
      component={RegisterSkipProfile}
    />
    <Stack.Screen
      name={SCREENS.REGISTER_BIO}
      component={RegisterBio}
    />
    <Stack.Screen
      name={SCREENS.REGISTER_SKIP_BIO}
      component={RegisterSkipBio}
    />
    <Stack.Screen
      name={SCREENS.REGISTER_VERIFY_CODE}
      component={RegisterVerifyOTP}
    />
    <Stack.Screen
      name={SCREENS.EMAIL_VERIFIED}
      component={EmailVerified}
    />
    <Stack.Screen
      name={SCREENS.FORGOT_PASSWORD}
      component={ForgotPasswordScreen}
    />
    <Stack.Screen
      name={SCREENS.VERIFY_CODE}
      component={EmailVerificationScreen}
    />
    <Stack.Screen
      name={SCREENS.UPDATE_PASSWORD}
      component={ResetPasswordScreen}
    />
    <Stack.Screen
      name={SCREENS.PASSWORD_RESET_CONFIRM}
      component={ResetConfirmScreen}
    />
  </Stack.Navigator>
);
