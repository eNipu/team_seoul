import { createContext, useContext } from "react";
import type { Session } from "./types";

export interface SessionValue {
  session: Session;
  /** The name shown in the shell; updated when the account page saves a new one. */
  displayName: string;
  setDisplayName: (name: string) => void;
  signOut: () => Promise<void>;
  /** After the account is deleted: back to the sign-in screen without calling the server. */
  signedOut: () => void;
}

export const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession outside the signed-in app");
  return value;
}
