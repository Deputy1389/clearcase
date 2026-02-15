import React from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import type { AppLanguage } from "../types";

type Props = {
  selectInitialLanguage: (lang: AppLanguage) => void;
  styles: any;
};

export default function LanguageScreen({ selectInitialLanguage, styles }: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.centerWrap}>
        <LinearGradient
          colors={["#F8FAFC", "#E2E8F0"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.onboardingCard}
        >
          <View style={[styles.brandPill, { backgroundColor: "#EFF6FF" }]}>
            <Feather name="globe" size={32} color="#1D4ED8" />
          </View>
          <Text style={styles.heroTitle}>Choose app language</Text>
          <Text style={styles.heroCopy}>English or Espanol. You can change this later in Account settings.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => void selectInitialLanguage("en")}>
            <Text style={styles.primaryBtnText}>English</Text>
          </Pressable>
          <Pressable style={styles.outlineBtn} onPress={() => void selectInitialLanguage("es")}>
            <Text style={styles.outlineBtnText}>Espanol</Text>
          </Pressable>
          <Text style={styles.subtleCenterText}>Informational guidance only. Not legal advice.</Text>
        </LinearGradient>
      </View>
    </View>
  );
}
