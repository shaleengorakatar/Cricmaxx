import { useState, useEffect, createContext, useContext, ReactNode } from "react";

type TradingMode = "simple" | "pro";

interface TradingModeContextType {
  mode: TradingMode;
  setMode: (mode: TradingMode) => void;
  isSimpleMode: boolean;
  isProMode: boolean;
  toggleMode: () => void;
}

const TradingModeContext = createContext<TradingModeContextType | undefined>(undefined);

export const TradingModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<TradingMode>(() => {
    const saved = localStorage.getItem("trading_mode");
    return (saved as TradingMode) || "simple";
  });

  const setMode = (newMode: TradingMode) => {
    setModeState(newMode);
    localStorage.setItem("trading_mode", newMode);
  };

  const toggleMode = () => {
    setMode(mode === "simple" ? "pro" : "simple");
  };

  return (
    <TradingModeContext.Provider
      value={{
        mode,
        setMode,
        isSimpleMode: mode === "simple",
        isProMode: mode === "pro",
        toggleMode,
      }}
    >
      {children}
    </TradingModeContext.Provider>
  );
};

export const useTradingMode = () => {
  const context = useContext(TradingModeContext);
  if (!context) {
    throw new Error("useTradingMode must be used within TradingModeProvider");
  }
  return context;
};
