import { useContext } from 'react';

import { GlobalContext, RegisterState } from '.';

export const useStore = () => {
  const { globalState, setGlobalState, socketState } =
    useContext(GlobalContext);

  const updateGlobalState = (props: Partial<RegisterState>) =>
    setGlobalState({
      ...globalState,
      ...props,
    });

  const updateRegisterState = (props: Partial<RegisterState>) =>
    setGlobalState({
      ...globalState,
      register: {
        ...globalState.register,
        ...props,
      },
    });

  const updateMessageState = (props: Partial<RegisterState>) =>
    setGlobalState({
      ...globalState,
      message: {
        ...globalState.message,
        ...props,
      },
    });

  return {
    globalState,
    updateGlobalState,
    updateRegisterState,
    socketState,
    updateMessageState,
  };
};