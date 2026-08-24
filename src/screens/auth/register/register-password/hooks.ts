import { useNavigation } from "@react-navigation/native";

import { SCREENS } from "@common/constant";
import { NavigationType } from "../../../../../App";
import { useContext, useState } from "react";
import { GlobalContext, RegisterState } from "../../../../store";
import { useStore } from "../../../../store/hooks";
import { useCustomAlert, validatePassword } from "@common/util";

export const useRegisterPassword = () => {
  const navigation = useNavigation<NavigationType>();
  const { showAlert } = useCustomAlert();

  // global states
  const { globalState } = useContext(GlobalContext);
  const { email, password } = globalState.register;

  // global state setters
  const { updateRegisterState } = useStore();
  const setPassword = (currPassword: RegisterState["password"]) =>
    updateRegisterState({ password: currPassword });

  // local state
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleNavigateToLogin = () =>
    navigation.reset({
      index: 0,
      routes: [{ name: SCREENS.LOGIN }],
    });
  const handleNavigateToPasswordSet = () => {
    if (password !== confirmPassword)
      return showAlert({
        title: "Password does not match",
        message: "Please enter password again",
      });

    validatePassword(password)
      ? navigation.navigate(SCREENS.PASSWORD_SET)
      : showAlert({
          title: "Incorrect Password format",
          message: "Please enter password again",
        });
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
