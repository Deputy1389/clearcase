export interface DraftTemplate {
  id: string;
  title: string;
  titleEs: string;
  description: string;
  descriptionEs: string;
  subject: string;
  subjectEs: string;
  body: string;
  bodyEs: string;
}

export const DRAFT_TEMPLATES: DraftTemplate[] = [
  {
    id: "repair-request",
    title: "Request Repairs",
    titleEs: "Solicitar Reparaciones",
    description: "A formal but polite request for maintenance or repairs.",
    descriptionEs: "Una solicitud formal pero amable para mantenimiento o reparaciones.",
    subject: "Request for Maintenance - [Property Address]",
    subjectEs: "Solicitud de Mantenimiento - [Direccion de Propiedad]",
    body: "Dear [Landlord Name],\n\nI am writing to formally request repairs at my residence. Specifically, the [Issue] needs attention. According to our lease agreement, maintenance of this item is the landlord's responsibility.\n\nPlease let me know when a contractor can be scheduled to look at this. Thank you for your prompt attention.\n\nBest regards,\n[Your Name]",
    bodyEs: "Estimado/a [Nombre del Arrendador],\n\nLe escribo para solicitar formalmente reparaciones en mi residencia. Especificamente, el [Problema] necesita atencion. Segun nuestro contrato de arrendamiento, el mantenimiento de este elemento es responsabilidad del arrendador.\n\nPor favor hagame saber cuando se puede programar a un contratista para revisar esto. Gracias por su pronta atencion.\n\nAtentamente,\n[Su Nombre]"
  },
  {
    id: "extension-request",
    title: "Extension Request",
    titleEs: "Solicitud de Prorroga",
    description: "Ask for more time to respond or move out.",
    descriptionEs: "Solicitar mas tiempo para responder o mudarse.",
    subject: "Request for Extension - Notice dated [Date]",
    subjectEs: "Solicitud de Prorroga - Aviso con fecha [Fecha]",
    body: "Dear [Name],\n\nI am writing regarding the notice I received on [Date]. Due to [Reason], I would like to request an extension of [Number] days to [Action Required].\n\nI appreciate your understanding and look forward to your confirmation.\n\nSincerely,\n[Your Name]",
    bodyEs: "Estimado/a [Nombre],\n\nLe escribo respecto al aviso que recibi el [Fecha]. Debido a [Razon], me gustaria solicitar una prorroga de [Numero] dias para [Accion Requerida].\n\nAgradezco su comprension y espero su confirmacion.\n\nAtentamente,\n[Su Nombre]"
  },
  {
    id: "clarification",
    title: "Clarification Request",
    titleEs: "Solicitud de Aclaracion",
    description: "Ask for more details about a notice you received.",
    descriptionEs: "Solicitar mas detalles sobre un aviso que recibio.",
    subject: "Question regarding [Document Name]",
    subjectEs: "Pregunta sobre [Nombre del Documento]",
    body: "Hello,\n\nI received your notice regarding [Topic] but I am unclear on [Specific Point]. Could you please provide more detail or a copy of [Reference Document] so I can better understand my obligations?\n\nThank you,\n[Your Name]",
    bodyEs: "Hola,\n\nRecibi su aviso sobre [Tema] pero no me queda claro [Punto Especifico]. Podria proporcionarme mas detalles o una copia de [Documento de Referencia] para poder entender mejor mis obligaciones?\n\nGracias,\n[Su Nombre]"
  },
  {
    id: "dispute-response",
    title: "Dispute a Charge",
    titleEs: "Disputar un Cargo",
    description: "Formally dispute an incorrect charge or fee.",
    descriptionEs: "Disputar formalmente un cargo o tarifa incorrecta.",
    subject: "Dispute of [Charge/Fee] - [Date]",
    subjectEs: "Disputa de [Cargo/Tarifa] - [Fecha]",
    body: "Dear [Name],\n\nI am writing to formally dispute the [Charge/Fee] of [Amount] dated [Date]. I believe this charge is incorrect because [Reason].\n\nPlease review and provide a written response within [Number] days. I have attached supporting documentation for your reference.\n\nThank you,\n[Your Name]",
    bodyEs: "Estimado/a [Nombre],\n\nLe escribo para disputar formalmente el [Cargo/Tarifa] de [Monto] con fecha [Fecha]. Creo que este cargo es incorrecto porque [Razon].\n\nPor favor revise y proporcione una respuesta por escrito dentro de [Numero] dias. He adjuntado documentacion de respaldo para su referencia.\n\nGracias,\n[Su Nombre]"
  }
];
