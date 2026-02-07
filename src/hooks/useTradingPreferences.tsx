import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";

type OddsFormat = "cents" | "american";

interface TradingPreferencesContextType {
  oddsFormat: OddsFormat;
  setOddsFormat: (format: OddsFormat) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  quickPredictAmount: number;
  setQuickPredictAmount: (amount: number) => void;
  predictionStreak: number;
  incrementStreak: () => void;
  resetStreak: () => void;
  formatOdds: (probability: number) => string;
}

const TradingPreferencesContext = createContext<TradingPreferencesContextType | undefined>(undefined);

// Convert probability to American odds
function probabilityToAmerican(probability: number): string {
  if (probability >= 0.5) {
    const odds = Math.round(-(probability / (1 - probability)) * 100);
    return `${odds}`;
  } else {
    const odds = Math.round(((1 - probability) / probability) * 100);
    return `+${odds}`;
  }
}

export const TradingPreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [oddsFormat, setOddsFormatState] = useState<OddsFormat>(() => {
    return (localStorage.getItem("odds_format") as OddsFormat) || "cents";
  });
  
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    return localStorage.getItem("sound_enabled") !== "false";
  });
  
  const [quickPredictAmount, setQuickPredictAmountState] = useState<number>(() => {
    return parseInt(localStorage.getItem("quick_predict_amount") || "10", 10);
  });
  
  const [predictionStreak, setPredictionStreak] = useState<number>(() => {
    const saved = sessionStorage.getItem("prediction_streak");
    return saved ? parseInt(saved, 10) : 0;
  });

  const setOddsFormat = (format: OddsFormat) => {
    setOddsFormatState(format);
    localStorage.setItem("odds_format", format);
  };

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled);
    localStorage.setItem("sound_enabled", enabled.toString());
  };

  const setQuickPredictAmount = (amount: number) => {
    setQuickPredictAmountState(amount);
    localStorage.setItem("quick_predict_amount", amount.toString());
  };

  const incrementStreak = useCallback(() => {
    setPredictionStreak((prev) => {
      const newStreak = prev + 1;
      sessionStorage.setItem("prediction_streak", newStreak.toString());
      return newStreak;
    });
  }, []);

  const resetStreak = useCallback(() => {
    setPredictionStreak(0);
    sessionStorage.removeItem("prediction_streak");
  }, []);

  const formatOdds = useCallback((probability: number): string => {
    if (oddsFormat === "american") {
      return probabilityToAmerican(probability);
    }
    return `${Math.round(probability * 100)}¢`;
  }, [oddsFormat]);

  return (
    <TradingPreferencesContext.Provider
      value={{
        oddsFormat,
        setOddsFormat,
        soundEnabled,
        setSoundEnabled,
        quickPredictAmount,
        setQuickPredictAmount,
        predictionStreak,
        incrementStreak,
        resetStreak,
        formatOdds,
      }}
    >
      {children}
    </TradingPreferencesContext.Provider>
  );
};

export const useTradingPreferences = () => {
  const context = useContext(TradingPreferencesContext);
  if (!context) {
    throw new Error("useTradingPreferences must be used within TradingPreferencesProvider");
  }
  return context;
};
