/**
 * @store VoiceStore
 * @status COMPLETE
 * @description Cloud PBX / WebRTC softphone state — Twilio device, call state, screen pop, and mic permissions
 * @resetSafe YES — Has reset() method for workspace switching
 * @lastAudit 2026-03-22
 */
import { create } from "zustand";

/* ── Types ──────────────────────────────────────────────── */

export interface ActiveCall {
  callSid: string;
  direction: "inbound" | "outbound";
  fromNumber: string;
  toNumber: string;
  status: "ringing" | "active" | "on_hold" | "ended";
  startedAt: string;
  durationSeconds: number;
  clientName?: string;
  clientId?: string;
  jobId?: string;
}

export interface ScreenPopPayload {
  found: boolean;
  client_id?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  outstanding_balance?: number;
  active_jobs?: Array<{
    id: string;
    display_id: string;
    title: string;
    status: string;
  }>;
  recent_comms?: Array<{
    id: string;
    channel: string;
    direction: string;
    subject?: string;
    created_at: string;
  }>;
}

export type DeviceStatus = "disconnected" | "connecting" | "ready" | "busy" | "error";
export type NetworkQuality = "good" | "fair" | "poor" | "unknown";

interface VoiceState {
  /* Device */
  deviceStatus: DeviceStatus;
  voiceToken: string | null;
  micPermission: "granted" | "denied" | "prompt" | "unknown";

  /* Active Call */
  activeCall: ActiveCall | null;
  screenPop: ScreenPopPayload | null;

  /* Network */
  networkQuality: NetworkQuality;

  /* UI */
  isScreenPopVisible: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  showDialer: boolean;

  /* Actions */
  setDeviceStatus: (status: DeviceStatus) => void;
  setVoiceToken: (token: string | null) => void;
  setMicPermission: (permission: "granted" | "denied" | "prompt" | "unknown") => void;

  incomingCall: (call: ActiveCall, screenPop: ScreenPopPayload) => void;
  acceptCall: () => void;
  endCall: () => void;
  holdCall: () => void;
  resumeCall: () => void;
  muteCall: () => void;
  unmuteCall: () => void;

  updateDuration: (seconds: number) => void;
  setNetworkQuality: (quality: NetworkQuality) => void;
  setScreenPopVisible: (visible: boolean) => void;
  setShowDialer: (show: boolean) => void;

  reset: () => void;
}

/* ── Initial State ──────────────────────────────────────── */
const initialState = {
  deviceStatus: "disconnected" as DeviceStatus,
  voiceToken: null as string | null,
  micPermission: "unknown" as "granted" | "denied" | "prompt" | "unknown",
  activeCall: null as ActiveCall | null,
  screenPop: null as ScreenPopPayload | null,
  networkQuality: "unknown" as NetworkQuality,
  isScreenPopVisible: false,
  isMuted: false,
  isOnHold: false,
  showDialer: false,
};

/* ── Store ──────────────────────────────────────────────── */
export const useVoiceStore = create<VoiceState>((set) => ({
  ...initialState,

  setDeviceStatus: (status) => set({ deviceStatus: status }),
  setVoiceToken: (token) => set({ voiceToken: token }),
  setMicPermission: (permission) => set({ micPermission: permission }),

  incomingCall: (call, screenPop) =>
    set({
      activeCall: call,
      screenPop,
      isScreenPopVisible: true,
      isMuted: false,
      isOnHold: false,
    }),

  acceptCall: () =>
    set((state) => ({
      activeCall: state.activeCall
        ? { ...state.activeCall, status: "active" }
        : null,
    })),

  endCall: () =>
    set((state) => ({
      activeCall: state.activeCall
        ? { ...state.activeCall, status: "ended" }
        : null,
      isScreenPopVisible: false,
      isMuted: false,
      isOnHold: false,
    })),

  holdCall: () =>
    set((state) => ({
      activeCall: state.activeCall
        ? { ...state.activeCall, status: "on_hold" }
        : null,
      isOnHold: true,
    })),

  resumeCall: () =>
    set((state) => ({
      activeCall: state.activeCall
        ? { ...state.activeCall, status: "active" }
        : null,
      isOnHold: false,
    })),

  muteCall: () => set({ isMuted: true }),
  unmuteCall: () => set({ isMuted: false }),

  updateDuration: (seconds) =>
    set((state) => ({
      activeCall: state.activeCall
        ? { ...state.activeCall, durationSeconds: seconds }
        : null,
    })),

  setNetworkQuality: (quality) => set({ networkQuality: quality }),
  setScreenPopVisible: (visible) => set({ isScreenPopVisible: visible }),
  setShowDialer: (show) => set({ showDialer: show }),

  reset: () => set(initialState),
}));
