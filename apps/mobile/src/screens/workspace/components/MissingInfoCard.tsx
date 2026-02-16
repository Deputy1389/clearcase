import React from "react";
import { Text, View } from "react-native";
import type { AppLanguage } from "../../../types";

type Props = {
  missingInfo: string[];
  language: AppLanguage;
  styles: any;
};

export default function MissingInfoCard({ missingInfo, language, styles }: Props) {
  if (missingInfo.length === 0) return null;
  return (
    <View style={styles.actionMissingCard}>
      <Text style={styles.miniLabel}>{language === "es" ? "NO ENCONTRADO" : "NOT FOUND"}</Text>
      {missingInfo.map((info, j) => (
        <Text key={`missing-${j}`} style={styles.actionMissingLine}>{info}</Text>
      ))}
    </View>
  );
}
