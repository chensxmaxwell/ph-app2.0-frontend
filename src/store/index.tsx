import React, {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useState,
} from "react";
import { Asset } from "react-native-image-picker";
import { CardType } from "../screens/control/sub-screens/sub-components/cards-list";

const DEFAULT_STATE: GlobalState = {
  register: {},
  message: {},
  popup: {
    visible: false,
    title: "",
    content: null,
    cancelable: false,
  },
  tmp_pattern: [],
};

// Create a context
const GlobalContext = createContext({
  globalState: DEFAULT_STATE,
  setGlobalState: (() => {}) as SetGlobalState, // Cast to the correct type
  socketState: null,
  setSocketState: (() => {}) as unknown,
});
console.log({ GlobalContext });

// Create a provider
const GlobalProvider = ({ children }: GlobalProviderProps) => {
  const [globalState, setGlobalState] = useState(DEFAULT_STATE);
  const [socketState, setSocketState] = useState(null);

  return (
    <GlobalContext.Provider
      value={{ globalState, setGlobalState, socketState, setSocketState }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

export { GlobalContext, GlobalProvider };

type GlobalProviderProps = {
  children: ReactNode | ReactNode[];
};

export type RegisterState = {
  email?: string;
  password?: string;
  nickname?: string;
  profileImage?: Asset | null;
  gender?: string;
  sexOrientation?: string;
  birthYear?: number | undefined;
  birthMonth?: number | undefined;
  birthDay?: number | undefined;
};

export type MessageState = {
  socketState?: unknown;
};

export type ButtonType = {
  text: string;
  onPress: () => void;
};

export type PopupState = {
  visible?: boolean;
  title?: string;
  content?: ReactNode;
  message?: string | ReactNode;
  primaryButton?: ButtonType;
  secondaryButton?: ButtonType;
  cancelable?: boolean;
};

export type GlobalState = {
  register: RegisterState;
  message: MessageState;
  popup: PopupState;
  tmp_pattern: CardType[];
};

// export type GlobalContext = keyof typeof DEFAULT_STATE;

// Define the type for setGlobalState
type SetGlobalState = Dispatch<SetStateAction<typeof DEFAULT_STATE>>;
