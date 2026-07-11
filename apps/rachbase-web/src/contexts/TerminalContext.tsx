"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface TerminalVM {
  id: string;
  name: string;
}

interface TerminalContextValue {
  terminalVM: TerminalVM | null;
  openTerminal: (vm: TerminalVM) => void;
  closeTerminal: () => void;
}

const TerminalContext = createContext<TerminalContextValue>({
  terminalVM:    null,
  openTerminal:  () => {},
  closeTerminal: () => {},
});

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [terminalVM, setTerminalVM] = useState<TerminalVM | null>(null);

  const openTerminal  = useCallback((vm: TerminalVM) => setTerminalVM(vm), []);
  const closeTerminal = useCallback(() => setTerminalVM(null), []);

  return (
    <TerminalContext.Provider value={{ terminalVM, openTerminal, closeTerminal }}>
      {children}
    </TerminalContext.Provider>
  );
}

export const useTerminal = () => useContext(TerminalContext);
