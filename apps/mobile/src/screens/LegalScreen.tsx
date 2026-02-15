import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { palette, font } from "../theme";
import type { AppLanguage, Screen } from "../types";

type Props = {
  language: AppLanguage;
  setScreen: (s: Screen) => void;
  legalReturnScreen: Screen;
  styles: any;
};

export default function LegalScreen({ language, setScreen, legalReturnScreen, styles }: Props) {
  return (
    <View style={styles.screenSoft}>
      <View style={styles.verdictHead}>
        <Pressable onPress={() => setScreen(legalReturnScreen)} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="chevron-left" size={24} color={palette.muted} />
        </Pressable>
        <Text style={styles.formTitleSmall}>{language === "es" ? "Aviso legal y privacidad" : "Legal & Privacy"}</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollBody}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{language === "es" ? "Terminos de servicio" : "Terms of Service"}</Text>
          <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4 }]}>
            {language === "es" ? "1. Naturaleza del servicio" : "1. Nature of Service"}
          </Text>
          <Text style={styles.cardBody}>
            {language === "es"
              ? "ClearCase es una herramienta informativa. No es un bufete de abogados y no proporciona asesoramiento legal. Los resultados son de contexto general y pueden estar incompletos."
              : "ClearCase is an informational tool. It is not a law firm and does not provide legal advice. Results are for general context and may be incomplete."}
          </Text>
          <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
            {language === "es" ? "2. Sin relacion abogado-cliente" : "2. No Attorney-Client Relationship"}
          </Text>
          <Text style={styles.cardBody}>
            {language === "es"
              ? "El uso de ClearCase no crea una relacion abogado-cliente. Para asesoria especifica de su situacion, consulte con un abogado con licencia en su jurisdiccion."
              : "Using ClearCase does not create an attorney-client relationship. For advice specific to your situation, consult a licensed attorney in your jurisdiction."}
          </Text>
          <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
            {language === "es" ? "3. Uso aceptable" : "3. Acceptable Use"}
          </Text>
          <Text style={styles.cardBody}>
            {language === "es"
              ? "Usted acepta usar ClearCase solo para fines legales y personales. No debe cargar contenido que viole leyes aplicables o derechos de terceros."
              : "You agree to use ClearCase only for lawful, personal purposes. You must not upload content that violates applicable laws or third-party rights."}
          </Text>
          <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
            {language === "es" ? "4. Limitacion de responsabilidad" : "4. Limitation of Liability"}
          </Text>
          <Text style={styles.cardBody}>
            {language === "es"
              ? "ClearCase se proporciona \"tal cual\" sin garantias de ninguna clase. No somos responsables por decisiones tomadas basandose en los resultados de la aplicacion."
              : "ClearCase is provided \"as is\" without warranties of any kind. We are not liable for decisions made based on the application's output."}
          </Text>
          <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
            {language === "es" ? "5. Cambios en los terminos" : "5. Changes to Terms"}
          </Text>
          <Text style={styles.cardBody}>
            {language === "es"
              ? "Podemos actualizar estos terminos en cualquier momento. El uso continuado de la aplicacion constituye aceptacion de los terminos actualizados."
              : "We may update these terms at any time. Continued use of the application constitutes acceptance of the updated terms."}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{language === "es" ? "Politica de privacidad" : "Privacy Policy"}</Text>
          <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4 }]}>
            {language === "es" ? "Datos que recopilamos" : "Data We Collect"}
          </Text>
          <Text style={styles.cardBody}>
            {language === "es"
              ? "Recopilamos la informacion de cuenta que usted proporciona (nombre, correo electronico, idioma) y los documentos que carga para su analisis."
              : "We collect the account information you provide (name, email, language preference) and the documents you upload for analysis."}
          </Text>
          <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
            {language === "es" ? "Como usamos sus datos" : "How We Use Your Data"}
          </Text>
          <Text style={styles.cardBody}>
            {language === "es"
              ? "Sus documentos se procesan exclusivamente para generar analisis de documentos, senales de cronologia y claridad situacional. No vendemos sus datos a terceros."
              : "Your documents are processed exclusively to generate document insights, timeline signals, and situational clarity. We do not sell your data to third parties."}
          </Text>
          <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
            {language === "es" ? "Almacenamiento y seguridad" : "Storage & Security"}
          </Text>
          <Text style={styles.cardBody}>
            {language === "es"
              ? "Los documentos se almacenan de forma cifrada en servidores seguros. Utilizamos HTTPS para todas las transmisiones y controles de acceso para proteger su informacion."
              : "Documents are stored encrypted on secure servers. We use HTTPS for all transmissions and access controls to protect your information."}
          </Text>
          <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
            {language === "es" ? "Retencion de datos" : "Data Retention"}
          </Text>
          <Text style={styles.cardBody}>
            {language === "es"
              ? "Puede solicitar la eliminacion de su cuenta y datos asociados en cualquier momento contactandonos a support@clearcase.com."
              : "You may request deletion of your account and associated data at any time by contacting us at support@clearcase.com."}
          </Text>
          <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
            {language === "es" ? "Notificaciones push" : "Push Notifications"}
          </Text>
          <Text style={styles.cardBody}>
            {language === "es"
              ? "Si habilita notificaciones push, almacenamos un token de dispositivo para enviar recordatorios de plazos. Puede desactivar las notificaciones en cualquier momento."
              : "If you enable push notifications, we store a device token to deliver deadline reminders. You can disable notifications at any time."}
          </Text>
          <Text style={[styles.cardBody, { fontFamily: font.semibold, marginBottom: 4, marginTop: 8 }]}>
            {language === "es" ? "Contacto" : "Contact"}
          </Text>
          <Text style={styles.cardBody}>
            {language === "es"
              ? "Para preguntas sobre privacidad, contactenos en support@clearcase.com."
              : "For privacy questions, contact us at support@clearcase.com."}
          </Text>
        </View>

        <Pressable onPress={() => setScreen(legalReturnScreen)} style={styles.primaryBtn} accessibilityRole="button" accessibilityLabel={language === "es" ? "Regresar a la app" : "Back to app"}>
          <Text style={styles.primaryBtnText}>{language === "es" ? "Regresar a la app" : "Back to app"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
