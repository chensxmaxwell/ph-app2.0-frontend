import React, { createContext, useState, useContext } from "react";

const AppContext = createContext();

export function QuickBlissContext({ children }) {
  const [time, setTime] = useState(15);

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

export function useAppContext() {
  return useContext(AppContext);
}
