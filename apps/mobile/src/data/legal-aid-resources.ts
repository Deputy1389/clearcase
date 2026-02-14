export interface LegalAidResource {
  name: string;
  nameEs: string;
  type: string;
  typeEs: string;
  phone: string;
  website: string;
  description: string;
  descriptionEs: string;
}

export const LEGAL_AID_RESOURCES: LegalAidResource[] = [
  {
    name: "National Tenant Network",
    nameEs: "Red Nacional de Inquilinos",
    type: "Housing Rights",
    typeEs: "Derechos de Vivienda",
    phone: "1-800-555-0123",
    website: "https://www.tenantrights.org",
    description: "Free legal advice for renters facing eviction or rent increases.",
    descriptionEs: "Asesoria legal gratuita para inquilinos que enfrentan desalojo o aumento de renta."
  },
  {
    name: "Justice For All",
    nameEs: "Justicia Para Todos",
    type: "Pro-Bono Legal Aid",
    typeEs: "Ayuda Legal Pro-Bono",
    phone: "1-888-222-9900",
    website: "https://www.justiceforall.org",
    description: "Connecting low-income individuals with volunteer lawyers for civil cases.",
    descriptionEs: "Conecta personas de bajos ingresos con abogados voluntarios para casos civiles."
  },
  {
    name: "Employment Law Center",
    nameEs: "Centro de Derecho Laboral",
    type: "Worker Rights",
    typeEs: "Derechos del Trabajador",
    phone: "1-877-333-1122",
    website: "https://www.workrights.com",
    description: "Help with workplace discrimination, wage theft, and wrongful termination.",
    descriptionEs: "Ayuda con discriminacion laboral, robo de salario y despido injustificado."
  },
  {
    name: "Legal Aid Society",
    nameEs: "Sociedad de Ayuda Legal",
    type: "General Legal Aid",
    typeEs: "Ayuda Legal General",
    phone: "1-800-649-9125",
    website: "https://www.legalaid.org",
    description: "Free civil legal services for low-income families and individuals.",
    descriptionEs: "Servicios legales civiles gratuitos para familias e individuos de bajos ingresos."
  }
];
