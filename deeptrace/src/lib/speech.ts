export async function speakSummary(
  threatLevel: string,
  nodeCount: number,
  linkCount: number
) {
  if (typeof window === "undefined") return;

  let intro = "Analysis complete.";
  let threatText = "";

  if (threatLevel === "CRITICAL") {
    threatText = "Warning. Critical threat detected.";
  } else if (threatLevel === "SUSPICIOUS") {
    threatText = "Notice. Suspicious activity detected.";
  } else {
    threatText = "System clear. No active threats.";
  }

  const details = `Extracted ${nodeCount} entities and ${linkCount} relationships.`;
  const textToSpeak = `${intro} ${threatText} ${details}`;

  try {
    const response = await fetch("http://localhost:8000/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: textToSpeak, voice: "default" })
    });

    if (!response.ok) {
      console.error("TTS API error:", response.statusText);
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    
    // Play and cleanup URL after playing
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play().catch(e => console.error("Audio play failed:", e));
  } catch (err) {
    console.error("Failed to play TTS audio:", err);
  }
}
