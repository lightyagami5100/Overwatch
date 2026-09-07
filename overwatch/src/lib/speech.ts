/**
 * Native Browser Speech Synthesis for Overwatch Protocol.
 * Provides instantaneous, zero-latency tactical audio briefings.
 */

const STORAGE_KEY = "overwatch_voice_briefings";

export function isSpeechEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

export function setSpeechEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, String(enabled));
  if (!enabled && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakCustom(text: string, priority = false): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!isSpeechEnabled() && !priority) return;

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    utterance.volume = 0.85;

    // Pick best English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        (v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Daniel"))) ||
        v.lang === "en-US" ||
        v.lang === "en-GB"
    );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.debug("[Overwatch Speech] Synthesis skipped:", err);
  }
}

export async function speakSummary(
  threatLevel: string,
  nodeCount: number,
  linkCount: number
): Promise<void> {
  if (!isSpeechEnabled()) return;

  let threatAnnouncement = "";
  if (threatLevel === "CRITICAL") {
    threatAnnouncement = "Warning: Critical Threat Level detected.";
  } else if (threatLevel === "SUSPICIOUS") {
    threatAnnouncement = "Notice: Elevated Threat Indicators discovered.";
  } else {
    threatAnnouncement = "Telemetry normal. Scope classified as benign.";
  }

  const message = `Overwatch Protocol. Threat analysis complete. ${threatAnnouncement} Indexed ${nodeCount} indicators and ${linkCount} correlation links.`;
  speakCustom(message);
}

