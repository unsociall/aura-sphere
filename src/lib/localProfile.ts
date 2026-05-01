import type { LocalProfile } from "@/lib/types";

const STORAGE_KEY_PREFIX = "aura-sphere-profile";

export function getProfileStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

export function loadLocalProfile(userId: string): LocalProfile {
  if (typeof window === "undefined") {
    return {
      tone: "friendly",
      interests: "",
      personality: "",
      autoMode: true,
    };
  }

  try {
    const raw = window.localStorage.getItem(getProfileStorageKey(userId));
    if (!raw) {
      return {
        tone: "friendly",
        interests: "",
        personality: "",
        autoMode: true,
      };
    }
    return JSON.parse(raw) as LocalProfile;
  } catch {
    return {
      tone: "friendly",
      interests: "",
      personality: "",
      autoMode: true,
    };
  }
}

export function saveLocalProfile(userId: string, profile: LocalProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getProfileStorageKey(userId), JSON.stringify(profile));
}
