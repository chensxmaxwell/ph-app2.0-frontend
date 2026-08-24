import { GoogleSignin } from '@react-native-google-signin/google-signin';

export const googleSigninInit = () =>
  GoogleSignin.configure({
    webClientId: process.env.WEB_CLIENT_ID,
    iosClientId: process.env.IOS_CLIENT_ID,
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  });
