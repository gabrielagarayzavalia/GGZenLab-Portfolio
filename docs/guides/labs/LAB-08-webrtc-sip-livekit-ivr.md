# LAB-08 — SIP, WebRTC, LiveKit & contact center / IVR — planned

**Estado:** outline · **Track:** job-skills (avisos de empleo)  
**Gap en portfolio:** Background in SIP, WebRTC, LiveKit, or contact center / IVR testing

**Stack previsto:** LiveKit · SIP trunk · WebRTC · IVR sim (Twilio u open source)

---

## Objetivo

Validar flujos de voz en tiempo real: establecimiento de llamada, calidad de audio, DTMF/IVR y handoff agente-bot.

---

## Prerrequisitos (cuando arranques)

- LAB-00 OK
- Cuenta o stack local LiveKit / SIP lab
- Headset y entorno sin eco para pruebas manuales

---

## Outline de pasos (instructor completará en sesión)

1. Levantar room LiveKit o trunk SIP de lab
2. Casos manuales: call setup time, reconexión, mute/unmute
3. IVR: menú DTMF, timeout, fallback
4. Automatización parcial: WebRTC stats, métricas de jitter/packet loss
5. Evidencia: logs SIP + captura de sesión

---

## Para arrancar en chat

> **Lab LAB-08, paso 1** — modo instructor, LiveKit local.

**Variantes:** `livekit-sip` · `webrtc-puppeteer` · `ivr-twilio`
