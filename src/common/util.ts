import { useContext } from "react";
import { GlobalContext, PopupState } from "../store";

export const validatePassword = (password?: string) => {
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password!);
};

export const useCustomAlert = () => {
  const { setGlobalState } = useContext(GlobalContext);

  const showAlert = (props: PopupState) => {
    setGlobalState((prevState) => ({
      ...prevState,
      popup: {
        visible: true,
        ...props,
      },
    }));
  };

  const hideAlert = () => {
    setGlobalState((prevState) => ({
      ...prevState,
      popup: {
        ...prevState.popup,
        visible: false,
      },
    }));
  };

  return {
    showAlert,
    hideAlert,
  };
};
