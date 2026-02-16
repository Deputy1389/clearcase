import React, { useState } from "react";
import { Text, View, Pressable, Modal, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fmtDate } from "../../../utils/formatting";
import MissingInfoCard from "./MissingInfoCard";
import type { ActionInstruction, ResponseOutline } from "../../../hooks/controllers/workspace/workspaceDerived";
import type { AppLanguage } from "../../../types";

type Props = {
  instruction: ActionInstruction;
  language: AppLanguage;
  styles: any;
  palette: any;
  responseOutline?: ResponseOutline;
  toggleStepCompletion: (id: string, index: number) => void;
  isStepCompleted: (id: string, index: number) => boolean;
};

export default function ActionLayerCard({ instruction, language, styles, palette, responseOutline, toggleStepCompletion, isStepCompleted }: Props) {
  const [outlineVisible, setOutlineVisible] = useState(false);
  const ai = instruction;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{language === "es" ? "Como responder" : "How to respond"}</Text>
      <Text style={styles.actionInstructionTitle}>{ai.title}</Text>
      <Text style={styles.cardBody}>{ai.explanation}</Text>
      {ai.deadlineISO ? (
        <View style={styles.actionDeadlineRow}>
          <Feather name="clock" size={13} color={palette.primary} />
          <Text style={styles.actionDeadlineText}>
            {ai.deadlineLabel ?? (language === "es" ? "Fecha limite" : "Deadline")}: {fmtDate(ai.deadlineISO, language)}
          </Text>
        </View>
      ) : null}
      {ai.steps.slice(0, 8).map((step, i) => {
        const done = isStepCompleted(ai.id, i);
        return (
          <Pressable 
            key={`action-step-${i}`} 
            style={styles.actionStepRow}
            onPress={() => toggleStepCompletion(ai.id, i)}
          >
            <View style={[styles.actionStepDot, done ? { backgroundColor: "#BBF7D0", borderColor: "#86EFAC" } : null]}>
              {done ? (
                <Feather name="check" size={10} color="#166534" />
              ) : (
                <Text style={styles.actionStepDotText}>{i + 1}</Text>
              )}
            </View>
            <Text style={[styles.actionStepText, done ? { color: palette.subtle, textDecorationLine: "line-through" } : null]}>{step}</Text>
          </Pressable>
        );
      })}
      {ai.contact ? (
        <View style={styles.actionContactCard}>
          <Text style={styles.miniLabel}>{language === "es" ? "CONTACTO" : "CONTACT"}</Text>
          {ai.contact.name ? <Text style={styles.actionContactLine}>{ai.contact.name}</Text> : null}
          {ai.contact.email ? <Text style={styles.actionContactLine}>{ai.contact.email}</Text> : null}
          {ai.contact.phone ? <Text style={styles.actionContactLine}>{ai.contact.phone}</Text> : null}
          {ai.contact.address ? <Text style={styles.actionContactLine}>{ai.contact.address}</Text> : null}
        </View>
      ) : null}
      {ai.missingInfo && ai.missingInfo.length > 0 ? (
        <MissingInfoCard missingInfo={ai.missingInfo} language={language} styles={styles} />
      ) : null}
      {ai.consequences && ai.consequences.length > 0 ? (
        <View style={styles.actionConsequenceRow}>
          <Feather name="alert-circle" size={13} color="#B45309" />
          <Text style={styles.actionConsequenceText}>{ai.consequences[0]}</Text>
        </View>
      ) : null}

      {responseOutline && (
        <View style={{ marginTop: 16 }}>
          <Pressable 
            style={styles.outlineSoftBtn} 
            onPress={() => setOutlineVisible(true)}
          >
            <Feather name="list" size={14} color={palette.primary} style={{ marginRight: 8 }} />
            <Text style={styles.outlineSoftText}>
              {language === "es" ? "Generar esquema de respuesta" : "Generate response outline"}
            </Text>
          </Pressable>
        </View>
      )}

      <Modal
        visible={outlineVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOutlineVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setOutlineVisible(false)} />
          <View style={[styles.sheetCard, { maxHeight: "80%" }]}>
            <View style={styles.sheetHeaderLine} />
            <Text style={styles.sheetTitle}>
              {language === "es" ? "Esquema de respuesta" : "Response outline"}
            </Text>
            <Text style={styles.sheetSub}>
              {language === "es" 
                ? "Este es un esquema sugerido para su respuesta. No es un documento legal final." 
                : "This is a suggested outline for your response. It is not a final legal document."}
            </Text>
            
            <ScrollView style={{ marginTop: 16 }}>
              {responseOutline?.subject && (
                <View style={{ marginBottom: 16, padding: 12, backgroundColor: "#F8FAFC", borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0" }}>
                  <Text style={[styles.miniLabel, { marginBottom: 4 }]}>
                    {language === "es" ? "ASUNTO" : "SUBJECT"}
                  </Text>
                  <Text style={{ fontFamily: "PlusJakartaSans_600SemiBold", color: palette.text }}>
                    {responseOutline.subject}
                  </Text>
                </View>
              )}
              
              {responseOutline?.sections.map((section, idx) => (
                <View key={idx} style={{ marginBottom: 12, flexDirection: "row", gap: 12 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "bold" }}>{idx + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, color: palette.text, fontSize: 14, lineHeight: 20 }}>
                    {section}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <Pressable 
              style={[styles.primaryBtn, { marginTop: 24 }]} 
              onPress={() => setOutlineVisible(false)}
            >
              <Text style={styles.primaryBtnText}>
                {language === "es" ? "Entendido" : "Got it"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
