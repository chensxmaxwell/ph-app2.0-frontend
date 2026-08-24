import { useNavigation } from "@react-navigation/native";
import { NavigationType } from "../../../../App";
import { useContext, useState } from "react";
import { SCREENS } from "@common/constant";
import { GlobalContext, RegisterState } from "../../../store";
import { useStore } from "../../../store/hooks";

export const useRegister = () => {
  const navigation = useNavigation<NavigationType>();
  const { globalState } = useContext(GlobalContext);
  const { email } = globalState.register;

  const { updateRegisterState } = useStore();
  const setEmail = (currEmail: RegisterState["email"]) =>
    updateRegisterState({ email: currEmail });
  const handleNavigateToLogin = () => navigation.navigate(SCREENS.LOGIN);
  const handleNavigateToVerification = () =>
    navigation.navigate(SCREENS.REGISTER_VERIFY_CODE);
  return {
    email,
    setEmail,
    handleNavigateToLogin,
    handleNavigateToVerification,
  };
};
