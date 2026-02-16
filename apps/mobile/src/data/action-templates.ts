import type { ExtractedFields, DocumentFamily } from "../types";

type Lang = "en" | "es";

export type ActionTemplateStrings = {
  title: string;
  explanation: string;
  consequence: string;
};

export type ActionTemplate = {
  id: string;
  family: DocumentFamily;
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

function deadlineStep(_f: ExtractedFields, lang: Lang): string {
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
    family: "subpoena",
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
    family: "summons",
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
    family: "demand_letter",
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
  {
    id: "debt-collection-respond",
    family: "debt_collection",
    strings: {
      en: {
        title: "Respond to the debt collection notice",
        explanation: "A debt collector is claiming you owe money. You have rights under federal law, including the right to dispute the debt within 30 days.",
        consequence: "Ignoring a debt collection notice does not make the debt go away and may limit your options",
      },
      es: {
        title: "Responder al aviso de cobro de deuda",
        explanation: "Un cobrador de deudas reclama que usted debe dinero. Tiene derechos bajo la ley federal, incluyendo el derecho de disputar la deuda dentro de 30 dias.",
        consequence: "Ignorar un aviso de cobro no elimina la deuda y puede limitar sus opciones",
      },
    },
    buildSteps: (f, lang) => lang === "es"
      ? [
          deadlineStep(f, lang),
          senderStep(f, lang),
          "Verifique que la deuda sea suya y que el monto sea correcto",
          "Si no reconoce la deuda, envie una carta de disputa por escrito dentro de 30 dias",
          seekHelpStep(lang),
        ]
      : [
          deadlineStep(f, lang),
          senderStep(f, lang),
          "Verify the debt is yours and the amount is correct",
          "If you do not recognize the debt, send a written dispute letter within 30 days",
          seekHelpStep(lang),
        ],
  },
  {
    id: "agency-notice-respond",
    family: "agency_notice",
    strings: {
      en: {
        title: "Respond to the government notice",
        explanation: "A government agency has sent you a formal notice. These often have strict deadlines and may require a written response.",
        consequence: "Failing to respond to a government notice may result in fines, penalties, or enforcement action",
      },
      es: {
        title: "Responder al aviso gubernamental",
        explanation: "Una agencia del gobierno le ha enviado un aviso formal. Estos a menudo tienen plazos estrictos y pueden requerir una respuesta por escrito.",
        consequence: "No responder a un aviso gubernamental puede resultar en multas, sanciones o acciones de cumplimiento",
      },
    },
    buildSteps: (f, lang) => lang === "es"
      ? [
          deadlineStep(f, lang),
          senderStep(f, lang),
          "Lea el aviso completo y determine que accion se requiere",
          "Responda por escrito antes de la fecha limite, conservando una copia",
          seekHelpStep(lang),
        ]
      : [
          deadlineStep(f, lang),
          senderStep(f, lang),
          "Read the entire notice and determine what action is required",
          "Respond in writing before the deadline, keeping a copy for your records",
          seekHelpStep(lang),
        ],
  },
  {
    id: "eviction-respond",
    family: "eviction",
    strings: {
      en: {
        title: "Respond to the eviction notice",
        explanation: "Your landlord or property manager has started an eviction process. You may have rights to respond, cure the issue, or contest the eviction.",
        consequence: "Not responding to an eviction notice may result in losing your housing",
      },
      es: {
        title: "Responder al aviso de desalojo",
        explanation: "Su arrendador o administrador de propiedad ha iniciado un proceso de desalojo. Puede tener derecho a responder, remediar el problema o contestar el desalojo.",
        consequence: "No responder a un aviso de desalojo puede resultar en la perdida de su vivienda",
      },
    },
    buildSteps: (f, lang) => lang === "es"
      ? [
          "Determine el tipo de aviso (3 dias, 30 dias, 60 dias) y la fecha limite para responder",
          senderStep(f, lang),
          "Verifique que el aviso fue entregado correctamente segun la ley local",
          "Si tiene derecho a remediar (por ejemplo, pagar renta atrasada), haga el pago antes de la fecha limite",
          seekHelpStep(lang),
        ]
      : [
          "Determine the notice type (3-day, 30-day, 60-day) and the deadline to respond",
          senderStep(f, lang),
          "Verify the notice was properly served according to local law",
          "If you have the right to cure (e.g., pay overdue rent), make the payment before the deadline",
          seekHelpStep(lang),
        ],
  },
  {
    id: "cease-desist-respond",
    family: "cease_and_desist",
    strings: {
      en: {
        title: "Review the cease and desist letter",
        explanation: "Someone is demanding you stop a specific activity. A cease and desist letter is not a court order, but it signals potential legal action.",
        consequence: "Ignoring a cease and desist may lead to a lawsuit if the sender follows through",
      },
      es: {
        title: "Revise la carta de cese y desistimiento",
        explanation: "Alguien exige que deje de realizar una actividad especifica. Una carta de cese y desistimiento no es una orden judicial, pero indica una posible accion legal.",
        consequence: "Ignorar una carta de cese y desistimiento puede resultar en una demanda si el remitente procede",
      },
    },
    buildSteps: (f, lang) => lang === "es"
      ? [
          deadlineStep(f, lang),
          senderStep(f, lang),
          "Lea cuidadosamente que actividad se le pide dejar de hacer",
          "No responda impulsivamente; considere si la demanda tiene merito",
          seekHelpStep(lang),
        ]
      : [
          deadlineStep(f, lang),
          senderStep(f, lang),
          "Read carefully what activity you are being asked to stop",
          "Do not respond impulsively; consider whether the claim has merit",
          seekHelpStep(lang),
        ],
  },
  {
    id: "small_claims-respond",
    family: "small_claims",
    strings: {
      en: {
        title: "Respond to the small claims summons",
        explanation: "Small claims court is for smaller disputes. You must either file a response or appear on the hearing date to avoid losing automatically.",
        consequence: "Failing to appear or respond will likely result in a judgment against you for the amount claimed",
      },
      es: {
        title: "Responder a la citacion de reclamos menores",
        explanation: "El tribunal de reclamos menores es para disputas pequenas. Debe presentar una respuesta o comparecer en la fecha de la audiencia para evitar perder automaticamente.",
        consequence: "No comparecer o no responder probablemente resultara en un fallo en su contra por el monto reclamado",
      },
    },
    buildSteps: (f, lang) => lang === "es"
      ? [
          deadlineStep(f, lang),
          senderStep(f, lang),
          "Verifique la fecha y el lugar de la audiencia en el tribunal",
          "Prepare su defensa y reuna cualquier evidencia (recibos, fotos, mensajes)",
          seekHelpStep(lang),
        ]
      : [
          deadlineStep(f, lang),
          senderStep(f, lang),
          "Verify the hearing date and court location",
          "Prepare your defense and gather any evidence (receipts, photos, messages)",
          seekHelpStep(lang),
        ],
  },
  {
    id: "lien-respond",
    family: "lien",
    strings: {
      en: {
        title: "Respond to the lien notice",
        explanation: "A lien notice means someone intends to record a legal claim against your property. This is a serious matter that can affect your ability to sell or refinance.",
        consequence: "A recorded lien stays on your property title and can lead to foreclosure or collection actions",
      },
      es: {
        title: "Responder al aviso de gravamen",
        explanation: "Un aviso de gravamen (lien) significa que alguien tiene la intencion de registrar un reclamo legal contra su propiedad. Este es un asunto serio que puede afectar su capacidad para vender o refinanciar.",
        consequence: "Un gravamen registrado permanece en el titulo de su propiedad y puede llevar a un juicio hipotecario o acciones de cobro",
      },
    },
    buildSteps: (f, lang) => lang === "es"
      ? [
          deadlineStep(f, lang),
          senderStep(f, lang),
          "Verifique si el reclamo es valido y si se siguieron los procedimientos de entrega",
          "Considere pagar el monto si es correcto para evitar que se registre el gravamen",
          seekHelpStep(lang),
        ]
      : [
          deadlineStep(f, lang),
          senderStep(f, lang),
          "Verify whether the claim is valid and if notice procedures were followed",
          "Consider paying the amount if correct to prevent the lien from being recorded",
          seekHelpStep(lang),
        ],
  },
  {
    id: "collections_validation-respond",
    family: "collections_validation",
    strings: {
      en: {
        title: "Request validation of the debt",
        explanation: "This notice gives you a 30-day window to request proof that the debt is valid and that the collector has the right to collect it.",
        consequence: "If you do not dispute within 30 days, the collector can assume the debt is valid",
      },
      es: {
        title: "Solicitar validacion de la deuda",
        explanation: "Este aviso le da un plazo de 30 dias para solicitar pruebas de que la deuda es valida y que el cobrador tiene derecho a cobrarla.",
        consequence: "Si no disputa dentro de los 30 dias, el cobrador puede asumir que la deuda es valida",
      },
    },
    buildSteps: (f, lang) => lang === "es"
      ? [
          "Envie una carta de solicitud de validacion de deuda por correo certificado dentro de 30 dias",
          "Exija prueba del monto original y la identidad del acreedor original",
          "Mantenga una copia de su carta y el recibo de correo certificado",
          "No realice ningun pago parcial si planea disputar la deuda completa",
          seekHelpStep(lang),
        ]
      : [
          "Send a debt validation request letter via certified mail within 30 days",
          "Demand proof of the original amount and the identity of the original creditor",
          "Keep a copy of your letter and the certified mail receipt",
          "Do not make any partial payments if you plan to dispute the entire debt",
          seekHelpStep(lang),
        ],
  },
];

export function findTemplateByFamily(family: DocumentFamily): ActionTemplate | null {
  if (family === "other") return null;
  return ACTION_TEMPLATES.find((t) => t.family === family) ?? null;
}
