import React, { createContext, useState, useContext } from "react";

const AppContext = createContext();

export function AppProvider({ children }) {
  const [emotion, setEmotion] = useState(null);
  const [intensity, setIntensity] = useState(0);
  const [sensitivity, setSensitivity] = useState(0);
  const [funType, setfunType] = useState("");
  const [kinkName, setkinkName] = useState("");
  const [kinkAvatar, setKinkAvatar] = useState(null);

  return (
    <AppContext.Provider
      value={{
        emotion,
        setEmotion,
        intensity,
        setIntensity,
        sensitivity,
        setSensitivity,
        funType,
        setfunType,
        kinkName,
        setkinkName,
        kinkAvatar,
        setKinkAvatar,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
