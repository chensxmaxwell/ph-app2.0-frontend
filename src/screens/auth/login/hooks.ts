import { gql, useMutation } from "@apollo/client";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { googleSigninInit } from "@common/utils/GoogleSignInConfig";
import { writeSessionUser } from "../../../backend/session";

import { NavigationType } from "../../../../App";
import { SCREENS } from "../../../common/constant";
import { useCustomAlert } from "@common/util";
// import { useHomeScreen } from '../../../hooks/HomeScreenContext';

export const useLogin = () => {
  useEffect(() => {
    googleSigninInit();
  }, []);
  const { showAlert, hideAlert } = useCustomAlert();

  const googleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      // Send userInfo.idToken to your backend for verification and get JWT
      loginGoogleUser({
        variables: {
          loginGoogleInput: { token: userInfo.idToken, platform: Platform.OS },
        },
      });
    } catch (error) {
      console.log({ error });
      // if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      //   // user cancelled the login flow
      // } else if (error.code === statusCodes.IN_PROGRESS) {
      //   // operation (e.g. sign in) is in progress already
      // } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      //   // play services not available or outdated
      // } else {
      //   // some other error happened
      // }
    }
  };

  const LOGIN_USER = gql`
    mutation LoginUser($loginInput: LoginInput!) {
      loginUser(loginInput: $loginInput) {
        id
        email
        token
      }
    }
  `;

  const LOGIN_USER_WITH_GOOGLE = gql`
    mutation LoginGoogleUser($loginGoogleInput: LoginGoogleInput!) {
      loginGoogleUser(loginGoogleInput: $loginGoogleInput) {
        id
        email
        token
      }
    }
  `;
  const navigation = useNavigation<NavigationType>();

  // const { setUserId } = useHomeScreen();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginUser] = useMutation(LOGIN_USER, {
    onCompleted: async (data) => {
      try {
        await writeSessionUser(data.loginUser);
        // setUserId(data.loginUser.id);
        // Use navigation 'reset' rather than 'navigate' prevent user returning back to login page after logged in
        navigation.reset({
          index: 0,
          routes: [{ name: SCREENS.MAIN }],
        });
      } catch (e) {
        console.error("Error saving login user into LocalStorage.", e);
      }
    },
    onError: (error) => {
      console.log(error);
      // Check if error is a GraphQL error
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        // Extract the first GraphQL error
        const gqlError = error.graphQLErrors[0];
        // Use the custom error code if available
        if (gqlError.extensions && gqlError.extensions.code) {
          const errorCode = gqlError.extensions.code;
          // Check if the errorCode is INCORRECT_PASSWORD
          if (errorCode === "INCORRECT_PASSWORD") {
            showAlert({
              title: "Login failed: Incorrect password or user does not exist.",
            });
          } else {
            // Handle other error codes or general errors
            showAlert({
              title: `Login failed. Please try again. Error: ${gqlError.message}`,
            });
          }
        } else {
          // If there's no custom error code, fall back to a generic error message
          showAlert({
            title: "Login failed. Please try again.",
          });
        }
      } else {
        // If the error is not a GraphQL error (network error, etc.), handle it generically
        console.error(error);
        showAlert({
          title: "An unexpected error occurred. Please try again.",
        });
      }
    },
  });

  const [loginGoogleUser] = useMutation(LOGIN_USER_WITH_GOOGLE, {
    onCompleted: async (data) => {
      try {
        await writeSessionUser(data.loginGoogleUser);
        // setUserId(data.loginGoogleUser.id);
        // Use navigation 'reset' rather than 'navigate' prevent user returning back to login page after logged in
        navigation.reset({
          index: 0,
          routes: [{ name: SCREENS.MAIN }],
        });
      } catch (e) {
        console.error("Error saving login user into LocalStorage.", e);
      }
    },
    onError: (error) => {
      console.log(error);
      // Check if error is a GraphQL error
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        // Extract the first GraphQL error
        const gqlError = error.graphQLErrors[0];
        // Use the custom error code if available
        if (gqlError.extensions && gqlError.extensions.code) {
          const errorCode = gqlError.extensions.code;
          // Check if the errorCode is INCORRECT_PASSWORD
          if (errorCode === "INCORRECT_PASSWORD") {
            showAlert({
              title: "Login failed: Incorrect password or user does not exist.",
            });
          } else {
            // Handle other error codes or general errors
            showAlert({
              title: `Login failed. Please try again. Error: ${gqlError.message}`,
            });
          }
        } else {
          // If there's no custom error code, fall back to a generic error message
          showAlert({
            title: "Login failed. Please try again.",
          });
        }
      } else {
        // If the error is not a GraphQL error (network error, etc.), handle it generically
        console.error(error);
        showAlert({
          title: "An unexpected error occurred. Please try again.",
        });
      }
    },
  });
  const handleLogin = () =>
    loginUser({
      variables: { loginInput: { email, password } },
    });

  const handleNavigateToRegister = () => navigation.navigate(SCREENS.REGISTER);
  const handleNavigateToAccount = () => navigation.navigate(SCREENS.MAINAPPTAB);
  const handleNavigateToForgotPassword = () =>
    navigation.navigate(SCREENS.FORGOT_PASSWORD);

  const handleBypassLogin = async () => {
    await writeSessionUser({
      id: "bypass",
      email: "bypass@local",
      token: "bypass",
    });
    const rootNavigation = navigation.getParent() ?? navigation;
    rootNavigation.reset({
      index: 0,
      routes: [{ name: SCREENS.MAIN }],
    });
  };

  return {
    email,
    password,
    handleLogin,
    setEmail,
    setPassword,
    navigation,
    handleNavigateToRegister,
    handleNavigateToAccount,
    handleNavigateToForgotPassword,
    handleBypassLogin,
    googleSignIn,
  };
};
