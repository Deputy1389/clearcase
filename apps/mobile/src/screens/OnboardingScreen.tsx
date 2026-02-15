import React from "react";
import { LayoutAnimation, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { hapticTap } from "../utils/haptics";
import { palette } from "../theme";
import type { AppLanguage, OnboardingSlide } from "../types";

const subtleSpring = {
  duration: 250,
  update: { type: "spring" as const, springDamping: 0.85 },
  create: { type: "easeInEaseOut" as const, property: "opacity" as const },
  delete: { type: "easeInEaseOut" as const, property: "opacity" as const },
};

type Props = {
  language: AppLanguage;
  slide: number;
  setSlide: React.Dispatch<React.SetStateAction<number>>;
  onboardingSlides: OnboardingSlide[];
  completeOnboarding: () => Promise<void>;
  renderSlideIcon: (slide: OnboardingSlide) => React.ReactNode;
  styles: any;
};

export default function OnboardingScreen({
  language,
  slide,
  setSlide,
  onboardingSlides,
  completeOnboarding,
  renderSlideIcon,
  styles,
}: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.rowTopRight}>
        <Pressable onPress={() => void completeOnboarding()}>
          <Text style={styles.skip}>{language === "es" ? "Saltar" : "Skip"}</Text>
        </Pressable>
      </View>
      <View style={styles.centerWrap}>
        <LinearGradient
          colors={["#F8FAFC", "#E2E8F0"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.onboardingCard}
        >
          <View style={[styles.brandPill, { backgroundColor: onboardingSlides[slide].iconBg }]}>
            {renderSlideIcon(onboardingSlides[slide])}
          </View>
          <Text style={styles.slideStepper}>
            {language === "es" ? "Paso" : "Step"} {slide + 1} {language === "es" ? "de" : "of"} {onboardingSlides.length}
          </Text>
          <Text style={styles.heroTitle}>{onboardingSlides[slide].title}</Text>
          <Text style={styles.heroCopy}>{onboardingSlides[slide].description}</Text>
        </LinearGradient>
      </View>
      <View style={styles.bottomNav}>
        <Pressable
          onPress={() => {
            hapticTap();
            LayoutAnimation.configureNext(subtleSpring);
            setSlide((s) => Math.max(0, s - 1));
          }}
          style={[styles.circle, slide === 0 ? styles.invisible : null]}
        >
          <Feather name="arrow-left" size={20} color={palette.muted} />
        </Pressable>
        <View style={styles.dots}>
          {onboardingSlides.map((_, i) => (
            <View key={i} style={[styles.dot, i === slide ? styles.dotActive : null]} />
          ))}
        </View>
        <Pressable
          onPress={() => {
            hapticTap();
            LayoutAnimation.configureNext(subtleSpring);
            slide < onboardingSlides.length - 1 ? setSlide(slide + 1) : void completeOnboarding();
          }}
          style={styles.circleDark}
        >
          <Feather name="arrow-right" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}
