import React, { createContext, useContext } from "react";
import type { EmergencyCallContext } from "../types/guardian";

interface EmergencyCallController {
  openEmergencyCall: (ctx?: EmergencyCallContext) => void;
}

const EmergencyCallCtx = createContext<EmergencyCallController>({
  openEmergencyCall: () => {},
});

export const EmergencyCallProvider: React.FC<{
  onOpen: (ctx?: EmergencyCallContext) => void;
  children: React.ReactNode;
}> = ({ onOpen, children }) => {
  return (
    <EmergencyCallCtx.Provider value={{ openEmergencyCall: onOpen }}>
      {children}
    </EmergencyCallCtx.Provider>
  );
};

export function useEmergencyCall() {
  return useContext(EmergencyCallCtx);
}
