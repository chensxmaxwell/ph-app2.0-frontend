import { gql, useMutation } from "@apollo/client";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { googleSigninInit } from "@common/utils/GoogleSignInConfig";
import { writeSessionUser } from "../../../backend/session";
import { ensureSeeded, migrateLegacyStores } from "../../../backend/store";

import { NavigationType } from "../../../../App";
import { SCREENS } from "../../../common/constant";
import { resetToMain } from "../../../common/root-nav";
import { useCustomAlert } from "@common/util";

export const useLogin = () => {
  useEffect(() => {
    googleSigninInit();
  }, []);
  const { showAlert } = useCustomAlert();

  const googleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      loginGoogleUser({
        variables: {
          loginGoogleInput: { token: userInfo.idToken, platform: Platform.OS },
        },
      });
    } catch (error) {
      console.log({ error });
    }
  };

  const LOGIN_USER = gql`
    mutation LoginUser($loginInput: LoginInput!) {
      loginUser(loginInput: $loginInput) {
        id
        email
        token
        nickName
      }
    }
  `;

  const LOGIN_USER_WITH_GOOGLE = gql`
    mutation LoginGoogleUser($loginGoogleInput: LoginGoogleInput!) {
      loginGoogleUser(loginGoogleInput: $loginGoogleInput) {
        id
        email
        token
        nickName
      }
    }
  `;
  const navigation = useNavigation<NavigationType>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const persistAndEnter = async (user: {
    id: string;
    email: string;
    token: string;
    nickName?: string;
  }) => {
    await writeSessionUser(user);
    resetToMain(navigation);
  };

  const [loginUser] = useMutation(LOGIN_USER, {
    onCompleted: async (data) => {
      try {
        await persistAndEnter(data.loginUser);
      } catch (e) {
        console.error("Error saving login user into LocalStorage.", e);
      }
    },
    onError: (error) => {
      console.log(error);
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        const gqlError = error.graphQLErrors[0];
        if (gqlError.extensions && gqlError.extensions.code) {
          const errorCode = gqlError.extensions.code;
          if (errorCode === "INCORRECT_PASSWORD") {
            showAlert({
              title: "Login failed: Incorrect password or user does not exist.",
            });
          } else {
            showAlert({
              title: `Login failed. Please try again. Error: ${gqlError.message}`,
            });
          }
        } else {
          showAlert({
            title: "Login failed. Please try again.",
          });
        }
      } else {
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
        await persistAndEnter(data.loginGoogleUser);
      } catch (e) {
        console.error("Error saving login user into LocalStorage.", e);
      }
    },
    onError: (error) => {
      console.log(error);
      showAlert({
        title: "An unexpected error occurred. Please try again.",
      });
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
    await ensureSeeded();
    await writeSessionUser({
      id: "bypass",
      email: "bypass@local",
      token: "bypass",
      nickName: "Anonymous User",
    });
    await migrateLegacyStores("bypass");
    resetToMain(navigation);
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
