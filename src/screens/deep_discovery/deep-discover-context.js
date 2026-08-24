import React, { createContext, useState, useContext } from "react";

const AppContext = createContext();

export function DeepDiscoverContext({ children }) {
  const [time, setTime] = useState(null);

  return (
    <AppContext.Provider
      value={{
        time,
        setTime,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useDeepDiscoverContext() {
  return useContext(AppContext);
}
