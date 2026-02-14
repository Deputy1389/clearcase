import type { AppLanguage, OnboardingSlide } from "../types";

export const onboardingSlidesByLanguage: Record<AppLanguage, OnboardingSlide[]> = {
  en: [
    {
      title: "Welcome. You are not expected to remember everything.",
      description: "ClearCase helps reduce missed steps and preparation stress when legal paperwork arrives.",
      icon: "scale",
      iconColor: "#475569",
      iconBg: "#F1F5F9"
    },
    {
      title: "Clarity tool, not legal advice.",
      description: "ClearCase organizes what is visible in your documents and context. For legal advice, many people choose to consult a licensed attorney.",
      icon: "shield",
      iconColor: "#4F46E5",
      iconBg: "#EEF2FF"
    },
    {
      title: "Upload guidance first.",
      description: "Upload a photo or PDF with clear lighting and full pages. Better source quality usually improves extraction quality.",
      icon: "upload",
      iconColor: "#2563EB",
      iconBg: "#EFF6FF"
    },
    {
      title: "Optional context improves continuity.",
      description: "Add what is not visible in the document (what happened, when, where). This can reduce repeat explanations in later uploads.",
      icon: "edit-3",
      iconColor: "#0F766E",
      iconBg: "#ECFEFF"
    },
    {
      title: "Choose your plan",
      description: "Free gives basic clarity. Plus adds continuity tools that help you stay prepared over time. ClearCase Plus: $15/month.",
      icon: "credit-card",
      iconColor: "#7C3AED",
      iconBg: "#F5F3FF"
    },
    {
      title: "Results show receipts and uncertainty.",
      description: "You will see detected dates, confidence levels, and why each signal appears so decisions stay traceable.",
      icon: "search",
      iconColor: "#1D4ED8",
      iconBg: "#DBEAFE"
    },
    {
      title: "Set continuity and reminders.",
      description: "Plus can keep a calm watch on the case over time. Small cost now can help avoid larger expensive misses later.",
      icon: "clock",
      iconColor: "#166534",
      iconBg: "#DCFCE7"
    }
  ],
  es: [
    {
      title: "Bienvenida. No hace falta recordar todo.",
      description: "ClearCase ayuda a reducir pasos omitidos y estres de preparacion cuando llega un documento legal.",
      icon: "scale",
      iconColor: "#475569",
      iconBg: "#F1F5F9"
    },
    {
      title: "Herramienta de claridad, no asesoria legal.",
      description: "ClearCase organiza lo visible en documentos y contexto. Para asesoria legal, muchas personas optan por consultar con un abogado con licencia.",
      icon: "shield",
      iconColor: "#4F46E5",
      iconBg: "#EEF2FF"
    },
    {
      title: "Primero, guia de carga.",
      description: "Sube una foto o PDF con buena luz y paginas completas. Mejor calidad de origen suele mejorar la extraccion.",
      icon: "upload",
      iconColor: "#2563EB",
      iconBg: "#EFF6FF"
    },
    {
      title: "El contexto opcional mejora continuidad.",
      description: "Agrega lo que no se ve en el documento (que paso, cuando, donde). Esto suele reducir explicaciones repetidas en cargas futuras.",
      icon: "edit-3",
      iconColor: "#0F766E",
      iconBg: "#ECFEFF"
    },
    {
      title: "Elija su plan",
      description: "Free ofrece claridad basica. Plus agrega herramientas de continuidad para mantenerse preparado con el tiempo. ClearCase Plus: $15/month.",
      icon: "credit-card",
      iconColor: "#7C3AED",
      iconBg: "#F5F3FF"
    },
    {
      title: "Resultados con comprobantes e incertidumbre.",
      description: "Vas a ver fechas detectadas, niveles de confianza y por que aparece cada senal para mantener trazabilidad.",
      icon: "search",
      iconColor: "#1D4ED8",
      iconBg: "#DBEAFE"
    },
    {
      title: "Configura continuidad y recordatorios.",
      description: "Plus puede mantener seguimiento calmado del caso en el tiempo. Un costo pequeno ahora puede evitar omisiones mas costosas despues.",
      icon: "clock",
      iconColor: "#166534",
      iconBg: "#DCFCE7"
    }
  ]
};
