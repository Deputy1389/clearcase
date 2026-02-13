# Paywall Copy Gold (EN/ES)

Use this as the default copy set for Prompt L implementation.
Positioning: one paid plan (Plus), legal clarity not legal advice, calm non-directive tone.

Price token:
- Use `{{PLUS_PRICE_MONTHLY}}` in UI.
- Example render: `$15/month`.

---

## 1) Onboarding Plan Step

### EN
- Headline: `Choose your plan`
- Subhead: `Free gives basic clarity. Plus adds continuity tools that help you stay prepared over time.`
- Bullets:
  - `Deadline reminders for detected dates`
  - `Case memory timeline across uploads`
  - `Plain-meaning translation for legal wording`
  - `Consultation-ready packet with source references`
- Price line: `ClearCase Plus: {{PLUS_PRICE_MONTHLY}}`
- Boundary line: `ClearCase provides legal clarity, not legal advice.`
- CTA primary: `Start Plus`
- CTA secondary: `Continue on Free`

### ES
- Headline: `Elija su plan`
- Subhead: `Free ofrece claridad basica. Plus agrega herramientas de continuidad para mantenerse preparado con el tiempo.`
- Bullets:
  - `Recordatorios para fechas detectadas`
  - `Memoria del caso entre cargas`
  - `Traduccion a significado simple`
  - `Paquete listo para consulta con referencias`
- Price line: `ClearCase Plus: {{PLUS_PRICE_MONTHLY}}`
- Boundary line: `ClearCase ofrece claridad legal, no asesoria legal.`
- CTA primary: `Iniciar Plus`
- CTA secondary: `Continuar con Free`

---

## 2) Free Limit Reached Modal

### EN
- Title: `Free monthly limit reached`
- Body: `You can still review your case. Plus re-enables new processing now and keeps reminders, memory, and consultation prep active.`
- Helper: `Resets at month end on Free.`
- CTA primary: `Unlock Plus`
- CTA secondary: `Not now`

### ES
- Title: `Se alcanzo el limite mensual de Free`
- Body: `Aun puede revisar su caso. Plus reactiva procesamiento ahora y mantiene recordatorios, memoria y preparacion para consulta.`
- Helper: `En Free se reinicia al final del mes.`
- CTA primary: `Activar Plus`
- CTA secondary: `Ahora no`

---

## 3) Plus Required Gate (Feature Locked)

### EN
- Title: `This feature is on Plus`
- Body: `Plus helps many people avoid repeat explanation time by keeping one timeline, reminders, and a consultation-ready packet.`
- Feature labels:
  - `Watch mode`
  - `Plain meaning view`
  - `Consult packet sharing`
- CTA primary: `Upgrade to Plus`
- CTA secondary: `Back`

### ES
- Title: `Esta funcion esta en Plus`
- Body: `Plus ayuda a muchas personas a reducir tiempo de explicaciones repetidas con una cronologia, recordatorios y paquete listo para consulta.`
- Feature labels:
  - `Modo de seguimiento`
  - `Vista de significado simple`
  - `Compartir paquete de consulta`
- CTA primary: `Subir a Plus`
- CTA secondary: `Volver`

---

## 4) Account Billing Card

### EN
- Header: `ClearCase Plus`
- Status active: `Active`
- Status inactive: `Not active`
- Value summary: `Reminders, timeline memory, plain-meaning translation, and consultation packet tools in one plan.`
- Price line: `{{PLUS_PRICE_MONTHLY}}`
- CTA when inactive: `Start Plus`
- CTA when active: `Manage billing`

### ES
- Header: `ClearCase Plus`
- Status active: `Activo`
- Status inactive: `No activo`
- Value summary: `Recordatorios, memoria de cronologia, traduccion simple y herramientas de paquete de consulta en un solo plan.`
- Price line: `{{PLUS_PRICE_MONTHLY}}`
- CTA when inactive: `Iniciar Plus`
- CTA when active: `Administrar cobro`

---

## 5) Checkout Screen

### EN
- Title: `Start ClearCase Plus`
- Body: `One plan for continuity: track dates, keep case memory, understand legal wording, and prepare faster for consultations.`
- Confirmation note: `You can cancel from account settings.`
- CTA primary: `Subscribe`
- CTA secondary: `Back`

### ES
- Title: `Iniciar ClearCase Plus`
- Body: `Un plan para continuidad: seguir fechas, mantener memoria del caso, entender lenguaje legal y preparar consultas con menos friccion.`
- Confirmation note: `Puede cancelar desde configuracion de cuenta.`
- CTA primary: `Suscribirse`
- CTA secondary: `Volver`

---

## 6) Purchase Success

### EN
- Title: `Plus is active`
- Body: `You now have continuity tools for this case: reminders, memory timeline, plain-meaning view, and consultation packet sharing.`
- CTA primary: `Continue`

### ES
- Title: `Plus esta activo`
- Body: `Ahora tiene herramientas de continuidad para este caso: recordatorios, cronologia, vista de significado simple y compartir paquete de consulta.`
- CTA primary: `Continuar`

---

## 7) Microcopy Rules (Do/Do Not)

Do:
- Use calm probability framing: `often`, `many people choose`, `can help`.
- Keep legal boundary visible near conversion points.
- Keep EN/ES feature names consistent across onboarding, lock modals, and account.

Do not:
- Use directive legal phrasing in Spanish (`debe`, `tiene que`).
- Use alarm language (`urgent`, `immediately`) in paywall copy.
- Sell with vague AI claims (`smarter AI`, `better intelligence`).

