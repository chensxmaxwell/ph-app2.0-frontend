import { useNavigation } from "@react-navigation/native";
import { gql, useMutation } from "@apollo/client";

import { SCREENS } from "@common/constant";
import { NavigationType } from "../../../../../App";
import { useContext, useState } from "react";
import { GlobalContext, RegisterState } from "../../../../store";
import { useStore } from "../../../../store/hooks";
import { useCustomAlert, validatePassword } from "@common/util";
import { writeSessionUser } from "../../../../backend/session";

export const useRegisterPassword = () => {
  const navigation = useNavigation<NavigationType>();
  const { showAlert } = useCustomAlert();

  const { globalState } = useContext(GlobalContext);
  const { email, password } = globalState.register;

  const { updateRegisterState } = useStore();
  const setPassword = (currPassword: RegisterState["password"]) =>
    updateRegisterState({ password: currPassword });

  const [confirmPassword, setConfirmPassword] = useState("");

  const REGISTER_USER = gql`
    mutation RegisterUser($registerInput: RegisterInput!) {
      registerUser(registerInput: $registerInput) {
        id
        email
        token
        nickName
      }
    }
  `;
  const [registerUser] = useMutation(REGISTER_USER);

  const handleNavigateToLogin = () =>
    navigation.reset({
      index: 0,
      routes: [{ name: SCREENS.LOGIN }],
    });
  const handleNavigateToPasswordSet = async () => {
    if (password !== confirmPassword)
      return showAlert({
        title: "Password does not match",
        message: "Please enter password again",
      });

    if (!validatePassword(password)) {
      return showAlert({
        title: "Incorrect Password format",
        message: "Please enter password again",
      });
    }

    if (!email) {
      return showAlert({
        title: "Email is required",
        message: "Please go back and enter your email",
      });
    }

    try {
      const { data } = await registerUser({
        variables: { registerInput: { email, password } },
      });
      if (data?.registerUser) {
        await writeSessionUser(data.registerUser);
      }
      navigation.navigate(SCREENS.PASSWORD_SET);
    } catch (error: any) {
      const message =
        error?.graphQLErrors?.[0]?.message ||
        "Could not create this account. Please try again.";
      showAlert({
        title: "Registration failed",
        message,
      });
    }
  };
  const handleNavigateToRegisterProfile = () =>
    navigation.reset({
      index: 0,
      routes: [{ name: SCREENS.REGISTER_PROFILE }],
    });

  return {
    password,
    confirmPassword,
    setPassword,
    setConfirmPassword,
    handleNavigateToLogin,
    handleNavigateToPasswordSet,
    handleNavigateToRegisterProfile,
  };
};
