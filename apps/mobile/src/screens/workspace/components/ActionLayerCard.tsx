import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fmtDate } from "../../../utils/formatting";
import MissingInfoCard from "./MissingInfoCard";
import type { ActionInstruction } from "../../../hooks/controllers/workspace/workspaceDerived";
import type { AppLanguage } from "../../../types";

type Props = {
  instruction: ActionInstruction;
  language: AppLanguage;
  styles: any;
  palette: any;
};

export default function ActionLayerCard({ instruction, language, styles, palette }: Props) {
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
      {ai.steps.slice(0, 5).map((step, i) => (
        <View key={`action-step-${i}`} style={styles.actionStepRow}>
          <View style={styles.actionStepDot}>
            <Text style={styles.actionStepDotText}>{i + 1}</Text>
          </View>
          <Text style={styles.actionStepText}>{step}</Text>
        </View>
      ))}
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
    </View>
  );
}
