import type { ExtractedFields } from "../types";

type Lang = "en" | "es";

export type ActionTemplateStrings = {
  title: string;
  explanation: string;
  consequence: string;
};

export type ActionTemplate = {
  id: string;
  patterns: RegExp[];
  strings: { en: ActionTemplateStrings; es: ActionTemplateStrings };
  buildSteps: (fields: ExtractedFields, lang: Lang) => string[];
};

// ── Helpers for step generation ─────────────────────────────────────

function senderStep(f: ExtractedFields, lang: Lang): string {
  if (f.senderName) {
    return lang === "es"
      ? `Identifique al remitente: ${f.senderName}`
      : `Identify the sender: ${f.senderName}`;
  }
  return lang === "es"
    ? "Busque en el encabezado o bloque de firma quien lo envio"
    : "Look at the letterhead or signature block to identify who sent it";
}

function contactStep(f: ExtractedFields, lang: Lang): string {
  if (f.senderName) {
    return lang === "es"
      ? `Contacte a la parte emisora: ${f.senderName}`
      : `Contact the issuing party: ${f.senderName}`;
  }
  return lang === "es"
    ? "Contacte a la parte emisora usando la informacion del documento"
    : "Contact the issuing party using the information on the document";
}

function deadlineStep(f: ExtractedFields, lang: Lang): string {
  return lang === "es"
    ? "Localice la fecha limite de respuesta y la fecha de comparecencia (si aplica)"
    : "Locate the response deadline and appearance date (if any)";
}

function gatherStep(lang: Lang): string {
  return lang === "es"
    ? "Reuna los documentos relevantes y conserve prueba de entrega"
    : "Gather relevant documents and keep proof of delivery";
}

function seekHelpStep(lang: Lang): string {
  return lang === "es"
    ? "Si la fecha limite se acerca o las consecuencias son graves, busque asistencia legal"
    : "If the deadline is near or consequences are serious, seek legal help";
}

// ── Templates ───────────────────────────────────────────────────────

export const ACTION_TEMPLATES: ActionTemplate[] = [
  {
    id: "subpoena-respond",
    patterns: [/subpoena/i],
    strings: {
      en: {
        title: "Respond to the subpoena",
        explanation: "A subpoena typically requires you to produce documents and/or appear. Deadlines matter.",
        consequence: "Ignoring a subpoena may lead to court enforcement or sanctions",
      },
      es: {
        title: "Responder a la citacion",
        explanation: "Una citacion generalmente requiere que presente documentos y/o comparezca. Los plazos son importantes.",
        consequence: "Ignorar una citacion puede resultar en sanciones judiciales o aplicacion forzada",
      },
    },
    buildSteps: (f, lang) => lang === "es"
      ? [
          deadlineStep(f, lang),
          "Identifique quien emitio la citacion (abogado, agencia o tribunal)",
          contactStep(f, lang),
          "Si no puede cumplir, prepare una objecion o solicitud de modificacion por escrito",
          gatherStep(lang),
        ]
      : [
          deadlineStep(f, lang),
          "Identify who issued the subpoena (attorney, agency, or court)",
          contactStep(f, lang),
          "If you cannot comply, prepare a written objection or request to modify",
          gatherStep(lang),
        ],
  },
  {
    id: "summons-respond",
    patterns: [/summons/i, /complaint/i, /petition/i],
    strings: {
      en: {
        title: "Respond to the court summons",
        explanation: "A summons means someone has filed a legal action against you. You usually have a limited number of days to file a response.",
        consequence: "Failing to respond may result in a default judgment against you",
      },
      es: {
        title: "Responder a la citacion judicial",
        explanation: "Una citacion judicial significa que alguien presento una accion legal en su contra. Generalmente tiene un numero limitado de dias para responder.",
        consequence: "No responder puede resultar en un fallo en su contra por incumplimiento",
      },
    },
    buildSteps: (f, lang) => lang === "es"
      ? [
          deadlineStep(f, lang),
          senderStep(f, lang),
          "Lea los reclamos cuidadosamente y anote los que necesitan respuesta",
          "Prepare su respuesta por escrito antes de la fecha limite",
          seekHelpStep(lang),
        ]
      : [
          deadlineStep(f, lang),
          senderStep(f, lang),
          "Read the claims carefully and note which ones need a response",
          "Prepare your written response before the deadline",
          seekHelpStep(lang),
        ],
  },
  {
    id: "demand-letter-respond",
    patterns: [/demand/i, /attorney.*letter/i, /letter.*attorney/i, /legal.*notice/i, /notice.*legal/i, /cease.*desist/i, /desist/i],
    strings: {
      en: {
        title: "Review and respond to this letter",
        explanation: "This appears to be a formal legal letter demanding action. Even if it feels threatening, you usually have options.",
        consequence: "Ignoring a demand letter may lead to a lawsuit being filed",
      },
      es: {
        title: "Revise y responda a esta carta",
        explanation: "Esto parece ser una carta legal formal que exige accion. Aunque parezca amenazante, generalmente tiene opciones.",
        consequence: "Ignorar una carta de demanda puede resultar en una demanda formal",
      },
    },
    buildSteps: (f, lang) => lang === "es"
      ? [
          deadlineStep(f, lang),
          senderStep(f, lang),
          "Determine que se le pide hacer y si hay una fecha limite para responder",
          "No firme ni acepte nada bajo presion",
          seekHelpStep(lang),
        ]
      : [
          deadlineStep(f, lang),
          senderStep(f, lang),
          "Determine what you are being asked to do and whether there is a deadline to respond",
          "Do not sign or agree to anything under pressure",
          seekHelpStep(lang),
        ],
  },
];

export function findMatchingTemplate(docType: string | null | undefined): ActionTemplate | null {
  if (!docType) return null;
  const lower = docType.toLowerCase();
  return ACTION_TEMPLATES.find((t) => t.patterns.some((p) => p.test(lower))) ?? null;
}
