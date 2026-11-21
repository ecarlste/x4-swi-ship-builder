/** The builder session, read from React. */
import { useSyncExternalStore } from "react";
import type { Session, SessionState } from "./session.ts";

/** The session's state, re-rendering whenever a transition changes it. */
export function useSession(session: Session): SessionState {
  return useSyncExternalStore(session.subscribe, session.getState);
}
