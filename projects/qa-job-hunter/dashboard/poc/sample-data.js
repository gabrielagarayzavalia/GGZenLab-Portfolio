/** Datos de muestra para PoC B38 — reflejan schema Empleos_Tracker. */

export const ESTADO_OPTIONS = [
  "Pendiente",
  "Stand-by",
  "Enviada",
  "Borrador abierto",
  "A-pendiente",
  "A-realizado",
  "Cerrado",
  "Duplicado",
  "Descartado",
];

export const SAMPLE_ROWS = [
  {
    id: "4431984399",
    matchPercent: 87,
    puesto: "QA Automation Engineer",
    empresa: "Globant",
    linkedinUrl: "https://www.linkedin.com/jobs/view/4431984399/",
    canal: "Easy Apply",
    estado: "Pendiente",
    fechaAplicacion: "",
    portalExterno: "",
    proximoPaso: "Easy Apply mañana",
    notas: "",
    misComentarios: "CV automation",
  },
  {
    id: "4444365026",
    matchPercent: 92,
    puesto: "Senior QA Analyst",
    empresa: "Mercado Libre",
    linkedinUrl: "https://www.linkedin.com/jobs/view/4444365026/",
    canal: "Easy Apply",
    estado: "Enviada",
    fechaAplicacion: "2026-07-20",
    portalExterno: "",
    proximoPaso: "Esperar respuesta",
    notas: "Apply OK — 3 preguntas nuevas guardadas",
    misComentarios: "",
  },
  {
    id: "4444717547",
    matchPercent: 74,
    puesto: "Software Tester",
    empresa: "Accenture",
    linkedinUrl: "https://www.linkedin.com/jobs/view/4444717547/",
    canal: "Externo",
    estado: "Stand-by",
    fechaAplicacion: "",
    portalExterno: "https://careers.accenture.com/job/123",
    proximoPaso: "Postular manual en portal",
    notas: "Low match — revisar JD",
    misComentarios: "",
  },
  {
    id: "4443158996",
    matchPercent: 81,
    puesto: "QA Lead",
    empresa: "Despegar",
    linkedinUrl: "https://www.linkedin.com/jobs/view/4443158996/",
    canal: "Easy Apply",
    estado: "A-pendiente",
    fechaAplicacion: "2026-07-18",
    portalExterno: "",
    proximoPaso: "HackerRank pendiente",
    notas: "Assessment enviado por mail",
    misComentarios: "Prioridad media",
  },
  {
    id: "4441533517",
    matchPercent: 68,
    puesto: "QA Manual",
    empresa: "Globant",
    linkedinUrl: "https://www.linkedin.com/jobs/view/4441533517/",
    canal: "Easy Apply",
    estado: "Duplicado",
    fechaAplicacion: "",
    portalExterno: "",
    proximoPaso: "",
    notas: "Mismo puesto+empresa que fila anterior",
    misComentarios: "",
  },
];

/** Mapeo header Excel (lower) → campo interno. */
export const EXCEL_HEADER_MAP = {
  match: "matchPercent",
  "% match": "matchPercent",
  puesto: "puesto",
  empresa: "empresa",
  linkedin: "linkedinUrl",
  canal: "canal",
  estado: "estado",
  "fecha aplicación": "fechaAplicacion",
  "fecha aplicacion": "fechaAplicacion",
  "portal externo": "portalExterno",
  "próximo paso": "proximoPaso",
  "proximo paso": "proximoPaso",
  notas: "notas",
  "mis comentarios": "misComentarios",
};

export function parseMatchPercent(raw) {
  if (raw == null || raw === "") return 0;
  const n = parseInt(String(raw).replace("%", "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}
