import React from "react";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { hapticTap } from "../utils/haptics";
import { palette, font } from "../theme";
import { DRAFT_TEMPLATES } from "../data/draft-templates";
import type { DraftTemplate } from "../data/draft-templates";
import type { AppLanguage, Screen } from "../types";

type Props = {
  language: AppLanguage;
  selectedTemplate: DraftTemplate | null;
  setSelectedTemplate: (t: DraftTemplate | null) => void;
  setScreen: (s: Screen) => void;
  styles: any;
};

export default function DraftingScreen({
  language,
  selectedTemplate,
  setSelectedTemplate,
  setScreen,
  styles,
}: Props) {
  return (
    <View style={styles.screenSoft}>
      <View style={styles.verdictHead}>
        <Pressable onPress={() => { setSelectedTemplate(null); setScreen("workspace"); }} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="chevron-left" size={24} color={palette.muted} />
        </Pressable>
        <View>
          <Text style={styles.formTitleSmall}>{language === "es" ? "Asistente de Redaccion" : "Drafting Assistant"}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 11, color: palette.muted }}>
            {language === "es" ? "Plantillas de respuesta" : "Response templates"}
          </Text>
        </View>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollBody}>
        {!selectedTemplate ? (
          <>
            <View style={{ backgroundColor: "#EFF6FF", padding: 16, borderRadius: 14, borderWidth: 1, borderColor: "#DBEAFE", marginBottom: 16 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 14, color: "#1E3A5F", marginBottom: 4 }}>
                {language === "es" ? "Elija un punto de partida" : "Pick a starting point"}
              </Text>
              <Text style={{ fontFamily: font.regular, fontSize: 13, color: "rgba(30,58,95,0.7)", lineHeight: 19 }}>
                {language === "es"
                  ? "Elija una plantilla. Estan escritas en lenguaje sencillo para mantener las cosas profesionales y claras."
                  : "Choose a template below. We've written these in plain English to keep things professional and clear."}
              </Text>
            </View>

            {DRAFT_TEMPLATES.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => { hapticTap(); setSelectedTemplate(t); }}
                style={[styles.card, { marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
                accessibilityRole="button"
                accessibilityLabel={language === "es" ? t.titleEs : t.title}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 15, color: palette.text, marginBottom: 2 }}>
                    {language === "es" ? t.titleEs : t.title}
                  </Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 12, color: palette.muted }}>
                    {language === "es" ? t.descriptionEs : t.description}
                  </Text>
                </View>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: palette.surfaceSoft, alignItems: "center", justifyContent: "center" }}>
                  <Feather name="send" size={14} color={palette.subtle} />
                </View>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <Pressable onPress={() => setSelectedTemplate(null)} style={{ marginBottom: 12 }} accessibilityRole="button" accessibilityLabel={language === "es" ? "Regresar a la lista" : "Back to list"}>
              <Text style={{ fontFamily: font.bold, fontSize: 12, color: "#2563EB", textTransform: "uppercase", letterSpacing: 1 }}>
                {language === "es" ? "\u2190 Regresar a la lista" : "\u2190 Back to list"}
              </Text>
            </Pressable>

            <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
              <View style={{ backgroundColor: palette.surfaceSoft, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line }}>
                <Text style={{ fontFamily: font.bold, fontSize: 9, color: palette.subtle, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  {language === "es" ? "Asunto" : "Subject"}
                </Text>
                <Text style={{ fontFamily: font.medium, fontSize: 14, color: palette.text }}>
                  {language === "es" ? selectedTemplate.subjectEs : selectedTemplate.subject}
                </Text>
              </View>
              <View style={{ padding: 16 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 9, color: palette.subtle, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                  {language === "es" ? "Cuerpo del mensaje" : "Message Body"}
                </Text>
                <View style={{ backgroundColor: "rgba(248,250,252,0.5)", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.surfaceSoft }}>
                  <Text style={{ fontFamily: font.regular, fontSize: 13, color: "#334155", lineHeight: 20 }}>
                    {language === "es" ? selectedTemplate.bodyEs : selectedTemplate.body}
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => {
                const text = language === "es" ? selectedTemplate.bodyEs : selectedTemplate.body;
                Share.share({ message: text });
              }}
              style={[styles.primaryBtn, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 }]}
              accessibilityRole="button"
              accessibilityLabel={language === "es" ? "Copiar y compartir" : "Copy and share"}
            >
              <Feather name="copy" size={16} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>{language === "es" ? "Copiar y compartir" : "Copy & Share"}</Text>
            </Pressable>

            <View style={{ backgroundColor: "#FEF3C7", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#FDE68A", flexDirection: "row", gap: 10, marginTop: 12, alignItems: "flex-start" }}>
              <Feather name="alert-circle" size={16} color="#A16207" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 12, color: "#78350F", marginBottom: 2 }}>
                  {language === "es" ? "Tip: Edite el texto entre corchetes" : "Tip: Edit bracketed text"}
                </Text>
                <Text style={{ fontFamily: font.regular, fontSize: 11, color: "rgba(120,53,15,0.7)", lineHeight: 16 }}>
                  {language === "es"
                    ? "Asegurese de reemplazar cosas como [Nombre del Arrendador] con los datos reales antes de enviar."
                    : "Make sure to replace things like [Landlord Name] with the actual details before sending."}
                </Text>
              </View>
            </View>
          </>
        )}

        <View style={{ marginTop: 16, paddingVertical: 12 }}>
          <Text style={{ fontFamily: font.regular, fontSize: 10, color: palette.subtle, textAlign: "center", lineHeight: 15 }}>
            {language === "es"
              ? "Estas plantillas son solo orientativas y no constituyen asesoria legal."
              : "These templates are for guidance only and do not constitute legal advice."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
