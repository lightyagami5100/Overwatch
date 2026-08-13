


 OVERWATCH PROTOCOL (Project FLUX)
**Your Local Incident Command & OSINT Platform**

![Next.js](https://img.shields.io/badge/Next.js-16.3.0-black?style=for-the-badge&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-009688?style=for-the-badge&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python)
![Ollama](https://img.shields.io/badge/Ollama-Local_LLM-white?style=for-the-badge&logo=ollama)
![Arch Linux](https://img.shields.io/badge/EndeavourOS-Optimized-1793d1?style=for-the-badge&logo=arch-linux)

Ever tried running half a dozen reconnaissance tools during an investigation and ended up drowning in unstructured terminal noise? That is exactly why I built **Overwatch Protocol** (internally codenamed Flux). 

It is a completely decentralized, high-performance Incident Command Center designed to run 100% locally on your machine. No cloud APIs, no data leaks, and absolute data sovereignty. It takes raw CLI output, figures out the entity relationships, maps them in 3D space, and gives you an AI threat briefing—all without your data ever leaving your device.

---

## ⚡ What It Actually Does

*   **🕸️ Visualizing the Chaos:** Instead of reading text logs, Overwatch extracts IPs, domains, and emails using Regex and `spaCy` NLP, and instantly plots them on an interactive 3D WebGL knowledge graph.
*   **⚙️ Native OSINT Execution:** It safely runs real Linux binaries (like `dig`, `nmap`, or `sherlock`) asynchronously under the hood using Python's `asyncio`.
*   **🧠 Local AI Brain:** It pipes the reconnaissance data into an offline Ollama LLM (running locally on port 11435) to stream a real-time executive threat briefing straight to your dashboard.
*   **🔒 Bulletproof Evidence:** Every investigation is sealed into a local SQLite vault and stamped with a SHA-256 cryptographic hash so you can prove the data was not tampered with.
*   **🌑 Command Center UI:** A sleek, dark-mode glassmorphism interface built from the ground up using Next.js 16 App Router, Tailwind CSS v4, and Framer Motion.

---

## 💻 The Tech Stack

I wanted this stack to be fast, modern, and highly concurrent. 

**Frontend:**
*   **Next.js (16.3.0) & React (19.2.8):** For the core UI and routing.
*   **react-force-graph (1.29.1) & Three.js:** To power the 3D entity mapping.
*   **Tailwind CSS (4.0.0) & Framer Motion (13.1.0):** For styling and liquid UI transitions.

**Backend:**
*   **FastAPI (≥0.115.0) & Uvicorn (≥0.34.0):** To handle high-throughput async endpoints and Server-Sent Events (SSE) streaming.
*   **SQLAlchemy (≥2.0.0) & aiosqlite (≥0.20.0):** For non-blocking database I/O.
*   **Pydantic & spaCy:** For strict data validation and Named Entity Recognition.

---

## 🚀 Getting Started

If you want to spin this up on your own machine, you will need a solid Linux environment (I recommend Arch Linux or EndeavourOS), at least 16GB of RAM (32GB if you want the local LLM to really fly), and your native OSINT tools installed globally.

**1. Clone the repo**
```bash
git clone [https://github.com/lightyagami5100/Flux.git](https://github.com/lightyagami5100/Flux.git)
cd Flux

```

**2. Set up the Python Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
cd ..

```

**3. Set up the Next.js Frontend**

```bash
cd overwatch
npm install
cd ..

```

**4. Launch the Swarm**
Make sure Ollama is running on your system, then execute the orchestration script:

```bash
chmod +x run.sh
./run.sh

```

Hit `http://localhost:3000` in your browser and you are good to go.

---

## 🛡️ The Zero-Trust Promise

I built this with a paranoid security mindset:

* **No Cloud LLMs:** The system does not rely on external AI APIs to synthesize threats.


* **Total Local Isolation:** FastAPI and Uvicorn bind strictly to `127.0.0.1` so your API isn't exposed to the local network.


* **Zero Telemetry:** No tracking, no external font loads, and no analytics. Your case files stay in `overwatch.db` on your hard drive.



---

## 👨‍💻 Built By

**Abdul Rahman Gilani**


This platform was engineered as an intensive research initiative into zero-trust architectures and local AI orchestration.

```
