"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Binary,
  KeyRound,
  ShieldAlert,
  ArrowRightLeft,
  Copy,
  Check,
  Zap,
  Sparkles,
  Search,
  Code,
  FileCode,
  Globe,
  Lock,
  Layers,
  Cpu,
  Activity,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Download
} from "lucide-react";

interface CipherLabProps {
  onSendToGraph?: (text: string) => void;
}

type TabType = "encoders" | "ciphers" | "hashes" | "entropy" | "defang" | "jwt" | "subnet";

// English letter frequency table (ETAOIN SHRDLU) for automated cryptanalysis
const ENGLISH_FREQS: Record<string, number> = {
  E: 12.02, T: 9.10, A: 8.12, O: 7.68, I: 7.31, N: 6.95, S: 6.28, R: 6.02, H: 5.92,
  D: 4.32, L: 3.98, U: 2.88, C: 2.71, M: 2.61, F: 2.30, Y: 2.11, W: 2.09, G: 2.03,
  P: 1.82, B: 1.49, V: 1.11, K: 0.69, X: 0.17, Q: 0.11, J: 0.10, Z: 0.07,
};

export function CipherLab({ onSendToGraph }: CipherLabProps) {
  const [activeTab, setActiveTab] = useState<TabType>("encoders");
  const [input, setInput] = useState<string>(
    "Suspicious connection to hxxps://c2-darknode[.]ru:8443/payload.bin with hash 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
  );
  const [copied, setCopied] = useState(false);

  // Sub-states
  const [encoderMode, setEncoderMode] = useState<
    | "base64_enc"
    | "base64_dec"
    | "base64url_enc"
    | "base64url_dec"
    | "hex_enc"
    | "hex_dec"
    | "url_enc"
    | "url_dec"
    | "binary_enc"
    | "binary_dec"
    | "html_enc"
    | "html_dec"
  >("base64_enc");
  const [caesarShift, setCaesarShift] = useState<number>(13);
  const [xorKey, setXorKey] = useState<string>("secret");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const swapInput = (text: string) => {
    setInput(text);
  };

  const downloadOutput = (text: string, filename = "cyber_lab_output.txt") => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------------- Transformations ----------------
  const encoderOutput = useMemo(() => {
    if (!input) return "";
    try {
      switch (encoderMode) {
        case "base64_enc":
          return btoa(unescape(encodeURIComponent(input)));
        case "base64_dec":
          return decodeURIComponent(escape(atob(input.trim())));
        case "base64url_enc":
          return btoa(unescape(encodeURIComponent(input)))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
        case "base64url_dec": {
          let b64 = input.trim().replace(/-/g, "+").replace(/_/g, "/");
          while (b64.length % 4) b64 += "=";
          return decodeURIComponent(escape(atob(b64)));
        }
        case "hex_enc":
          return Array.from(new TextEncoder().encode(input))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" ");
        case "hex_dec": {
          const cleanHex = input.replace(/[\s:]/g, "");
          if (cleanHex.length % 2 !== 0) return "[Invalid Hex Length]";
          const bytes = new Uint8Array(
            cleanHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
          );
          return new TextDecoder().decode(bytes);
        }
        case "url_enc":
          return encodeURIComponent(input);
        case "url_dec":
          return decodeURIComponent(input);
        case "binary_enc":
          return Array.from(new TextEncoder().encode(input))
            .map((b) => b.toString(2).padStart(8, "0"))
            .join(" ");
        case "binary_dec": {
          const cleanBin = input.replace(/\s+/g, "");
          if (cleanBin.length % 8 !== 0) return "[Invalid 8-bit Binary stream]";
          const bytes = new Uint8Array(
            cleanBin.match(/.{1,8}/g)!.map((b) => parseInt(b, 2))
          );
          return new TextDecoder().decode(bytes);
        }
        case "html_enc":
          return input.replace(
            /[&<>"']/g,
            (m) =>
              ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;",
              }[m] || m)
          );
        case "html_dec": {
          const doc = new DOMParser().parseFromString(input, "text/html");
          return doc.documentElement.textContent || "";
        }
        default:
          return input;
      }
    } catch (e: any) {
      return `[ERROR]: ${e.message}`;
    }
  }, [input, encoderMode]);

  // Ciphers & Automated Frequency Analysis
  const cipherOutput = useMemo(() => {
    if (!input) return { caesar: "", xorResult: "", reversed: "", bestCaesarShift: 0, caesarCandidates: [] };
    try {
      // Caesar shift helper
      const shiftText = (text: string, shift: number) =>
        text.replace(/[a-zA-Z]/g, (c) => {
          const base = c <= "Z" ? 65 : 97;
          return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26) + base);
        });

      const caesar = shiftText(input, caesarShift);

      // Automated frequency ranking for all 25 shifts
      const candidates: { shift: number; text: string; score: number }[] = [];
      for (let s = 1; s <= 25; s++) {
        const candidate = shiftText(input, s);
        let score = 0;
        const upper = candidate.toUpperCase();
        for (let i = 0; i < upper.length; i++) {
          const ch = upper[i];
          if (ENGLISH_FREQS[ch]) score += ENGLISH_FREQS[ch];
        }
        candidates.push({ shift: s, text: candidate, score });
      }
      candidates.sort((a, b) => b.score - a.score);

      // XOR
      let xorResult = "";
      if (xorKey) {
        for (let i = 0; i < input.length; i++) {
          xorResult += String.fromCharCode(input.charCodeAt(i) ^ xorKey.charCodeAt(i % xorKey.length));
        }
      }

      // Reverse
      const reversed = input.split("").reverse().join("");

      return {
        caesar,
        xorResult,
        reversed,
        bestCaesarShift: candidates[0]?.shift || 13,
        caesarCandidates: candidates.slice(0, 3),
      };
    } catch {
      return { caesar: "", xorResult: "", reversed: "", bestCaesarShift: 13, caesarCandidates: [] };
    }
  }, [input, caesarShift, xorKey]);

  // Shannon Entropy Engine
  const entropyAnalysis = useMemo(() => {
    if (!input) {
      return {
        entropy: 0,
        category: "Empty Payload",
        color: "text-white/40",
        printablePercent: 0,
        byteCount: 0,
        uniqueBytes: 0,
        assessment: "Enter data to compute Shannon entropy.",
      };
    }

    const bytes = new TextEncoder().encode(input);
    const totalBytes = bytes.length;
    if (totalBytes === 0) return { entropy: 0, category: "Empty", color: "text-white/40", printablePercent: 0, byteCount: 0, uniqueBytes: 0, assessment: "" };

    const frequencies: Record<number, number> = {};
    let printableCount = 0;

    for (let i = 0; i < totalBytes; i++) {
      const b = bytes[i];
      frequencies[b] = (frequencies[b] || 0) + 1;
      // ASCII Printable: 32-126 or \n, \r, \t
      if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
        printableCount++;
      }
    }

    let entropy = 0;
    const uniqueBytes = Object.keys(frequencies).length;

    for (const byteVal in frequencies) {
      const p = frequencies[byteVal] / totalBytes;
      entropy -= p * Math.log2(p);
    }

    const roundedEntropy = Number(entropy.toFixed(4));
    const printablePercent = Number(((printableCount / totalBytes) * 100).toFixed(1));

    let category = "Plaintext Text";
    let color = "text-emerald-400";
    let assessment = "Low entropy typical of human-readable text, source code, or configuration files.";

    if (roundedEntropy > 7.5) {
      category = "High Entropy (Encrypted / Random)";
      color = "text-red-400";
      assessment = "High probability of AES/ChaCha encrypted payload, packed shellcode, or cryptographic keys.";
    } else if (roundedEntropy > 6.0) {
      category = "Compressed / Packed Binary";
      color = "text-amber-400";
      assessment = "Moderate-high entropy consistent with compressed streams (gzip/zlib) or compiled binaries.";
    } else if (roundedEntropy > 4.5) {
      category = "Encoded / Obfuscated Data";
      color = "text-cyan-400";
      assessment = "Entropy profile typical of Base64, Hex, or obfuscated script commands.";
    }

    return {
      entropy: roundedEntropy,
      category,
      color,
      printablePercent,
      byteCount: totalBytes,
      uniqueBytes,
      assessment,
    };
  }, [input]);

  // Hashes (Web Crypto API)
  const [hashes, setHashes] = useState<{ sha1: string; sha256: string; sha512: string }>({
    sha1: "",
    sha256: "",
    sha512: "",
  });

  useMemo(() => {
    if (!input || typeof window === "undefined" || !window.crypto?.subtle) return;
    const enc = new TextEncoder().encode(input);
    Promise.all([
      crypto.subtle.digest("SHA-1", enc),
      crypto.subtle.digest("SHA-256", enc),
      crypto.subtle.digest("SHA-512", enc),
    ])
      .then(([s1, s256, s512]) => {
        const hex = (buf: ArrayBuffer) =>
          Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        setHashes({
          sha1: hex(s1),
          sha256: hex(s256),
          sha512: hex(s512),
        });
      })
      .catch(() => {});
  }, [input]);

  // Hash ID with candidate confidence
  const identifiedHashCandidates = useMemo(() => {
    const trimmed = input.trim();
    const candidates: { type: string; confidence: string; bitLength: number }[] = [];

    if (/^[a-fA-F0-9]{32}$/.test(trimmed)) {
      candidates.push({ type: "MD5 (Message Digest)", confidence: "High", bitLength: 128 });
      candidates.push({ type: "NTLM / MD4", confidence: "Medium", bitLength: 128 });
    } else if (/^[a-fA-F0-9]{40}$/.test(trimmed)) {
      candidates.push({ type: "SHA-1", confidence: "High", bitLength: 160 });
      candidates.push({ type: "RIPEMD-160", confidence: "Medium", bitLength: 160 });
    } else if (/^[a-fA-F0-9]{56}$/.test(trimmed)) {
      candidates.push({ type: "SHA-224 / SHA3-224", confidence: "High", bitLength: 224 });
    } else if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
      candidates.push({ type: "SHA-256 (Secure Hash Algorithm 256)", confidence: "High", bitLength: 256 });
      candidates.push({ type: "SHA3-256 / BLAKE2s", confidence: "Medium", bitLength: 256 });
    } else if (/^[a-fA-F0-9]{96}$/.test(trimmed)) {
      candidates.push({ type: "SHA-384 / SHA3-384", confidence: "High", bitLength: 384 });
    } else if (/^[a-fA-F0-9]{128}$/.test(trimmed)) {
      candidates.push({ type: "SHA-512 / SHA3-512", confidence: "High", bitLength: 512 });
      candidates.push({ type: "Whirlpool", confidence: "Low", bitLength: 512 });
    } else if (/^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(trimmed)) {
      candidates.push({ type: "bcrypt Password Hash", confidence: "Certain", bitLength: 184 });
    } else if (/^\$6\$[./A-Za-z0-9]+\$[./A-Za-z0-9]{86}$/.test(trimmed)) {
      candidates.push({ type: "SHA-512 Linux Crypt ($6$)", confidence: "Certain", bitLength: 512 });
    } else if (/^\$argon2(id|i|d)\$/.test(trimmed)) {
      candidates.push({ type: "Argon2 Key Derivation Hash", confidence: "Certain", bitLength: 256 });
    } else {
      candidates.push({ type: "Unrecognized / Natural Text", confidence: "None", bitLength: 0 });
    }

    return candidates;
  }, [input]);

  // Defang / Refang
  const defangOutput = useMemo(() => {
    let defanged = input
      .replace(/https?:\/\//gi, (m) => m.toLowerCase().replace("http", "hxxp"))
      .replace(/\./g, "[.]")
      .replace(/:/g, "[:]")
      .replace(/@/g, "[@]");

    let refanged = input
      .replace(/hxxps?:\/\//gi, (m) => m.toLowerCase().replace("hxxp", "http"))
      .replace(/\[\.\]|\(dot\)|\{dot\}|\[dot\]/gi, ".")
      .replace(/\[\:\]|\(colon\)/gi, ":")
      .replace(/\[@\]|\(at\)/gi, "@")
      .replace(/\[\/\]|\(slash\)/gi, "/");

    return { defanged, refanged };
  }, [input]);

  // JWT Token Inspector with Security Audit
  const jwtDecoded = useMemo(() => {
    const trimmed = input.trim();
    const parts = trimmed.split(".");
    if (parts.length !== 3) {
      return { valid: false, header: null, payload: null, signature: null, issues: [] };
    }
    try {
      const headerStr = decodeURIComponent(escape(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/"))));
      const payloadStr = decodeURIComponent(escape(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))));
      const header = JSON.parse(headerStr);
      const payload = JSON.parse(payloadStr);

      const issues: { level: "CRITICAL" | "WARNING" | "INFO"; text: string }[] = [];

      // Check algorithm
      if (header.alg === "none" || header.alg === "NONE") {
        issues.push({ level: "CRITICAL", text: "Algorithm 'none' detected! Vulnerable to signature bypass." });
      } else if (header.alg === "HS256") {
        issues.push({ level: "INFO", text: "HMAC-SHA256 signature. Ensure server secret is high-entropy." });
      }

      // Check expiration
      let expStatus = "No expiration claim (exp)";
      if (payload.exp) {
        const now = Math.floor(Date.now() / 1000);
        const diff = payload.exp - now;
        const expDate = new Date(payload.exp * 1000).toLocaleString();
        if (diff < 0) {
          expStatus = `EXPIRED on ${expDate} (${Math.abs(Math.round(diff / 60))} mins ago)`;
          issues.push({ level: "WARNING", text: `Token is expired (${expDate}).` });
        } else {
          expStatus = `Valid until ${expDate} (in ${Math.round(diff / 60)} mins)`;
        }
      } else {
        issues.push({ level: "WARNING", text: "No 'exp' (expiration) claim found in payload." });
      }

      return {
        valid: true,
        header,
        payload,
        signature: parts[2],
        expStatus,
        issues,
      };
    } catch (e: any) {
      return { valid: false, error: e.message, header: null, payload: null, signature: null, issues: [] };
    }
  }, [input]);

  // Subnet Calculator
  const subnetCalc = useMemo(() => {
    const trimmed = input.trim();
    const match = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
    if (!match) return null;

    const [_, ipStr, cidrStr] = match;
    const cidr = parseInt(cidrStr, 10);
    if (cidr < 0 || cidr > 32) return null;

    const octets = ipStr.split(".").map(Number);
    if (octets.some((o) => o < 0 || o > 255)) return null;

    const ipNum = ((octets[0] << 24) >>> 0) + ((octets[1] << 16) >>> 0) + ((octets[2] << 8) >>> 0) + (octets[3] >>> 0);
    const maskNum = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
    const netNum = (ipNum & maskNum) >>> 0;
    const bcastNum = (netNum | ~maskNum) >>> 0;

    const numToIp = (num: number) =>
      [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join(".");

    const totalHosts = cidr === 32 ? 1 : cidr === 31 ? 2 : Math.pow(2, 32 - cidr) - 2;
    const firstHost = cidr >= 31 ? numToIp(netNum) : numToIp(netNum + 1);
    const lastHost = cidr >= 31 ? numToIp(bcastNum) : numToIp(bcastNum - 1);

    return {
      ip: ipStr,
      cidr: `/${cidr}`,
      network: numToIp(netNum),
      netmask: numToIp(maskNum),
      broadcast: numToIp(bcastNum),
      firstHost,
      lastHost,
      totalHosts: totalHosts.toLocaleString(),
      binary: octets.map((o) => o.toString(2).padStart(8, "0")).join("."),
    };
  }, [input]);

  return (
    <div className="w-full h-full flex flex-col apple-glass rounded-3xl overflow-hidden shadow-2xl border border-white/10 text-white">
      {/* Header Bar */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/30 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Binary className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Cyber Matrix & Cipher Lab
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-mono rounded uppercase tracking-wider border border-indigo-500/30">
                CyberChef Edition
              </span>
            </h2>
            <p className="text-xs text-white/50">
              Shannon entropy, JWT vulnerability inspection, automated Caesar cracker & IOC defanger
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto custom-scrollbar">
          {[
            { id: "encoders", label: "Encoders", icon: Code },
            { id: "ciphers", label: "Ciphers", icon: KeyRound },
            { id: "entropy", label: "Entropy", icon: Activity },
            { id: "hashes", label: "Hashes", icon: Lock },
            { id: "jwt", label: "JWT Audit", icon: Layers },
            { id: "defang", label: "Defanger", icon: ShieldAlert },
            { id: "subnet", label: "CIDR / IP", icon: Globe },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 divide-y md:divide-y-0 md:divide-x divide-white/10">
        {/* Left Side: Input Workspace */}
        <div className="flex-1 flex flex-col p-5 min-h-0 bg-black/20">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-mono font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
              <FileCode className="w-3.5 h-3.5 text-indigo-400" />
              Source Input Payload
            </label>
            <button
              onClick={() => setInput("")}
              className="text-xs text-white/40 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or paste text, encoded strings, hashes, JWT tokens, CIDR subnets, hex dumps..."
            className="flex-1 w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-mono text-white/90 placeholder:text-white/20 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 resize-none transition-all custom-scrollbar shadow-inner"
          />

          {/* Quick Payload Starters */}
          <div className="mt-3 flex flex-wrap gap-2 items-center text-xs text-white/40">
            <span className="font-mono">Samples:</span>
            <button
              onClick={() => setInput("U3VzcGljaW91cyBjb25uZWN0aW9uIGZyb20gMTkyLjE2OC4xLjUw")}
              className="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white/70 text-[11px] font-mono"
            >
              Base64
            </button>
            <button
              onClick={() => setInput("68 74 74 70 73 3a 2f 2f 65 76 69 6c 2e 63 6f 6d")}
              className="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white/70 text-[11px] font-mono"
            >
              Hex
            </button>
            <button
              onClick={() => setInput("5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8")}
              className="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white/70 text-[11px] font-mono"
            >
              SHA-256
            </button>
            <button
              onClick={() =>
                setInput(
                  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjg0OTMiLCJuYW1lIjoiQWRtaW4gQW5hbHlzdCIsImFkbWluIjp0cnVlLCJleHAiOjE5MTY3NDAwMDB9.4PnpGQgqepm-G..."
                )
              }
              className="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white/70 text-[11px] font-mono"
            >
              JWT Sample
            </button>
            <button
              onClick={() => setInput("192.168.5.0/24")}
              className="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white/70 text-[11px] font-mono"
            >
              CIDR Subnet
            </button>
          </div>
        </div>

        {/* Right Side: Transformation Output */}
        <div className="flex-1 flex flex-col p-5 min-h-0 bg-black/40 overflow-y-auto custom-scrollbar">
          {/* TAB 1: ENCODERS & DECODERS */}
          {activeTab === "encoders" && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={encoderMode}
                  onChange={(e) => setEncoderMode(e.target.value as any)}
                  className="bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <optgroup label="Base64" className="bg-black">
                    <option value="base64_enc">Base64 Standard Encode</option>
                    <option value="base64_dec">Base64 Standard Decode</option>
                    <option value="base64url_enc">Base64 URL-Safe Encode (- _)</option>
                    <option value="base64url_dec">Base64 URL-Safe Decode</option>
                  </optgroup>
                  <optgroup label="Hexadecimal" className="bg-black">
                    <option value="hex_enc">Hex Encode (ASCII to Hex)</option>
                    <option value="hex_dec">Hex Decode (Hex to ASCII)</option>
                  </optgroup>
                  <optgroup label="URL Encoding" className="bg-black">
                    <option value="url_enc">URL Encode (Percent-encoding)</option>
                    <option value="url_dec">URL Decode</option>
                  </optgroup>
                  <optgroup label="Binary (8-bit)" className="bg-black">
                    <option value="binary_enc">Binary Encode</option>
                    <option value="binary_dec">Binary Decode</option>
                  </optgroup>
                  <optgroup label="HTML Entities" className="bg-black">
                    <option value="html_enc">HTML Entity Encode</option>
                    <option value="html_dec">HTML Entity Decode</option>
                  </optgroup>
                </select>
              </div>

              <div className="flex-1 bg-black/50 border border-white/10 rounded-2xl p-4 flex flex-col">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                  <span className="text-xs font-mono text-white/50 uppercase tracking-wider">Converted Result</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => swapInput(encoderOutput)}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white/80 flex items-center gap-1.5 transition-all"
                      title="Set Output as Input"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      Swap
                    </button>
                    <button
                      onClick={() => copyToClipboard(encoderOutput)}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white/80 flex items-center gap-1.5 transition-all"
                    >
                      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button
                      onClick={() => downloadOutput(encoderOutput)}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white/80 flex items-center gap-1.5 transition-all"
                      title="Download file"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <pre className="flex-1 font-mono text-sm text-green-400 whitespace-pre-wrap break-all overflow-y-auto custom-scrollbar leading-relaxed">
                  {encoderOutput || "[ Enter text on the left to view converted output ]"}
                </pre>
              </div>

              {onSendToGraph && (
                <button
                  onClick={() => onSendToGraph(encoderOutput || input)}
                  className="h-10 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 uppercase tracking-wider shrink-0"
                >
                  <Zap className="w-4 h-4" />
                  Pipe Result to 3D Threat Graph
                </button>
              )}
            </div>
          )}

          {/* TAB 2: CIPHERS & FREQUENCY ANALYSIS */}
          {activeTab === "ciphers" && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4">
                {/* Caesar Slider */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-yellow-400" />
                      Caesar / ROT Cipher (Shift: {caesarShift})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCaesarShift(cipherOutput.bestCaesarShift)}
                        className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded font-bold hover:bg-indigo-500/30"
                      >
                        Auto-Crack (Shift {cipherOutput.bestCaesarShift})
                      </button>
                      <button
                        onClick={() => setCaesarShift(13)}
                        className="text-[10px] px-2 py-0.5 bg-white/10 rounded text-white/70 hover:text-white"
                      >
                        ROT13
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="25"
                    value={caesarShift}
                    onChange={(e) => setCaesarShift(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <pre className="font-mono text-xs text-yellow-300 bg-black/40 p-3 rounded-xl whitespace-pre-wrap break-all mt-1">
                    {cipherOutput.caesar || "[ Waiting for text ]"}
                  </pre>
                </div>

                {/* XOR Cipher */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                      XOR Cipher
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/50">Key:</span>
                      <input
                        type="text"
                        value={xorKey}
                        onChange={(e) => setXorKey(e.target.value)}
                        className="bg-black/60 border border-white/10 rounded px-2 py-0.5 text-xs font-mono text-white w-24 outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <pre className="font-mono text-xs text-cyan-300 bg-black/40 p-3 rounded-xl whitespace-pre-wrap break-all">
                    {cipherOutput.xorResult || "[ Waiting for text ]"}
                  </pre>
                </div>

                {/* Reverse */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Reverse String</span>
                  <pre className="font-mono text-xs text-white/80 bg-black/40 p-3 rounded-xl whitespace-pre-wrap break-all">
                    {cipherOutput.reversed}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SHANNON ENTROPY ENGINE */}
          {activeTab === "entropy" && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-bold">
                    Shannon Entropy Calculation
                  </div>
                  <div className="text-2xl font-bold font-mono text-white mt-1 flex items-baseline gap-2">
                    {entropyAnalysis.entropy} <span className="text-xs font-normal text-white/40">bits / byte (Max 8.0)</span>
                  </div>
                  <div className={`text-xs font-bold mt-1 ${entropyAnalysis.color}`}>
                    {entropyAnalysis.category}
                  </div>
                </div>
                <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-indigo-400" />
                </div>
              </div>

              {/* Assessment Card */}
              <div className="p-4 bg-black/50 border border-white/10 rounded-2xl text-xs text-white/80 leading-relaxed">
                <span className="font-bold text-white">Analysis Assessment:</span> {entropyAnalysis.assessment}
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-black/50 border border-white/10 rounded-xl">
                  <div className="text-[10px] font-mono text-white/50">Byte Count</div>
                  <div className="font-mono text-sm text-white font-bold mt-0.5">{entropyAnalysis.byteCount} B</div>
                </div>
                <div className="p-3 bg-black/50 border border-white/10 rounded-xl">
                  <div className="text-[10px] font-mono text-white/50">Unique Bytes</div>
                  <div className="font-mono text-sm text-white font-bold mt-0.5">{entropyAnalysis.uniqueBytes} / 256</div>
                </div>
                <div className="p-3 bg-black/50 border border-white/10 rounded-xl">
                  <div className="text-[10px] font-mono text-white/50">Printable ASCII</div>
                  <div className="font-mono text-sm text-green-400 font-bold mt-0.5">
                    {entropyAnalysis.printablePercent}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HASHES & HASH IDENTIFIER */}
          {activeTab === "hashes" && (
            <div className="flex-1 flex flex-col gap-4">
              {/* Hash ID Badge */}
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex flex-col gap-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-bold flex items-center justify-between">
                  <span>Candidate Hash Identification</span>
                  <Search className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="space-y-1.5 mt-1">
                  {identifiedHashCandidates.map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                      <span className="font-semibold text-white">{c.type}</span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/80">
                        {c.confidence} Confidence {c.bitLength > 0 ? `(${c.bitLength}-bit)` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hash Generations */}
              <div className="space-y-3">
                {[
                  { label: "SHA-256 Digest", val: hashes.sha256, color: "text-emerald-400" },
                  { label: "SHA-1 Digest", val: hashes.sha1, color: "text-amber-400" },
                  { label: "SHA-512 Digest", val: hashes.sha512, color: "text-blue-400" },
                ].map((item, idx) => (
                  <div key={idx} className="p-3 bg-black/50 border border-white/10 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-mono text-white/50">{item.label}</span>
                      <button
                        onClick={() => copyToClipboard(item.val)}
                        className="text-[10px] text-white/40 hover:text-white flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                    </div>
                    <div className={`font-mono text-xs ${item.color} break-all select-all`}>
                      {item.val || "..."}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: JWT TOKEN INSPECTOR */}
          {activeTab === "jwt" && (
            <div className="flex-1 flex flex-col gap-4">
              {jwtDecoded.valid ? (
                <>
                  {/* Security Notice Banner */}
                  <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl flex items-center justify-between text-xs text-amber-300">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-bold">SIGNATURE UNVERIFIED (Decoded Read-Only)</span>
                    </div>
                    <span className="font-mono text-[10px] text-white/60">{jwtDecoded.expStatus}</span>
                  </div>

                  {/* Security Issues if any */}
                  {jwtDecoded.issues.length > 0 && (
                    <div className="space-y-1">
                      {jwtDecoded.issues.map((iss, idx) => (
                        <div
                          key={idx}
                          className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
                            iss.level === "CRITICAL"
                              ? "bg-red-500/20 border-red-500/40 text-red-300"
                              : "bg-amber-500/10 border-amber-500/20 text-amber-200"
                          }`}
                        >
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                          <span>{iss.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <span className="text-xs font-bold text-red-400 uppercase tracking-wider">JWT Header</span>
                    <pre className="font-mono text-xs text-red-300 bg-black/40 p-3 rounded-xl whitespace-pre-wrap mt-1">
                      {JSON.stringify(jwtDecoded.header, null, 2)}
                    </pre>
                  </div>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                      JWT Payload (Claims)
                    </span>
                    <pre className="font-mono text-xs text-purple-300 bg-black/40 p-3 rounded-xl whitespace-pre-wrap mt-1">
                      {JSON.stringify(jwtDecoded.payload, null, 2)}
                    </pre>
                  </div>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Raw Signature</span>
                    <div className="font-mono text-xs text-cyan-300 bg-black/40 p-3 rounded-xl break-all mt-1">
                      {jwtDecoded.signature}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-white/40 font-mono text-xs">
                  [ Paste a valid 3-part JWT token (header.payload.signature) into the input on the left ]
                </div>
              )}
            </div>
          )}

          {/* TAB 6: DEFANG / REFANG */}
          {activeTab === "defang" && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Defanged Threat Indicator (Safe for Sharing)
                  </span>
                  <button
                    onClick={() => copyToClipboard(defangOutput.defanged)}
                    className="text-xs text-white/40 hover:text-white flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <pre className="font-mono text-xs text-white/90 bg-black/40 p-3 rounded-xl whitespace-pre-wrap break-all">
                  {defangOutput.defanged}
                </pre>
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Refanged Indicator (Ready for Scanning)
                  </span>
                  <button
                    onClick={() => copyToClipboard(defangOutput.refanged)}
                    className="text-xs text-white/40 hover:text-white flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <pre className="font-mono text-xs text-white/90 bg-black/40 p-3 rounded-xl whitespace-pre-wrap break-all">
                  {defangOutput.refanged}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 7: CIDR / SUBNET CALCULATOR */}
          {activeTab === "subnet" && (
            <div className="flex-1 flex flex-col gap-4">
              {subnetCalc ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-black/50 border border-white/10 rounded-xl">
                    <div className="text-[10px] font-mono text-white/50">Network Address</div>
                    <div className="font-mono text-sm text-indigo-400 font-bold mt-0.5">{subnetCalc.network}</div>
                  </div>
                  <div className="p-3 bg-black/50 border border-white/10 rounded-xl">
                    <div className="text-[10px] font-mono text-white/50">Subnet Mask</div>
                    <div className="font-mono text-sm text-white font-bold mt-0.5">{subnetCalc.netmask}</div>
                  </div>
                  <div className="p-3 bg-black/50 border border-white/10 rounded-xl">
                    <div className="text-[10px] font-mono text-white/50">First Usable Host</div>
                    <div className="font-mono text-sm text-green-400 font-bold mt-0.5">{subnetCalc.firstHost}</div>
                  </div>
                  <div className="p-3 bg-black/50 border border-white/10 rounded-xl">
                    <div className="text-[10px] font-mono text-white/50">Last Usable Host</div>
                    <div className="font-mono text-sm text-green-400 font-bold mt-0.5">{subnetCalc.lastHost}</div>
                  </div>
                  <div className="p-3 bg-black/50 border border-white/10 rounded-xl">
                    <div className="text-[10px] font-mono text-white/50">Broadcast Address</div>
                    <div className="font-mono text-sm text-amber-400 font-bold mt-0.5">{subnetCalc.broadcast}</div>
                  </div>
                  <div className="p-3 bg-black/50 border border-white/10 rounded-xl">
                    <div className="text-[10px] font-mono text-white/50">Total Usable Hosts</div>
                    <div className="font-mono text-sm text-white font-bold mt-0.5">{subnetCalc.totalHosts}</div>
                  </div>
                  <div className="col-span-2 p-3 bg-black/50 border border-white/10 rounded-xl">
                    <div className="text-[10px] font-mono text-white/50">Binary Representation</div>
                    <div className="font-mono text-xs text-white/80 break-all mt-0.5">{subnetCalc.binary}</div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-white/40 font-mono text-xs">
                  [ Enter a valid CIDR subnet like `192.168.1.0/24` or `10.0.0.0/16` into the input ]
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

