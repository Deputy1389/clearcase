import React from "react";
import LanguageScreen from "../../screens/LanguageScreen";
import OnboardingScreen from "../../screens/OnboardingScreen";
import AuthScreen from "../../screens/AuthScreen";
import { styles } from "./styleUtils";
import { palette } from "../../theme";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";

function renderSlideIcon(slide: any) {
  if (slide.icon === "scale") {
    return <MaterialCommunityIcons name="scale-balance" size={38} color={slide.iconColor} />;
  }
  return <Feather name={slide.icon} size={32} color={slide.iconColor} />;
}

export function AuthRoutes({ controller }: { controller: any }) {
  if (controller.screen === "language") {
    return <LanguageScreen selectInitialLanguage={controller.selectInitialLanguage} styles={styles} />;
  }

  if (controller.screen === "onboarding") {
    return (
      <OnboardingScreen
        language={controller.language}
        slide={controller.slide}
        setSlide={controller.setSlide}
        onboardingSlides={controller.onboardingSlides}
        completeOnboarding={controller.completeOnboarding}
        renderSlideIcon={renderSlideIcon}
        styles={styles}
      />
    );
  }

  if (controller.screen === "auth") {
    return (
      <AuthScreen
        language={controller.language}
        authMode={controller.authMode}
        setAuthMode={controller.setAuthMode}
        authName={controller.authName}
        setAuthName={controller.setAuthName}
        authZip={controller.authZip}
        setAuthZip={controller.setAuthZip}
        authEmail={controller.authEmail}
        setAuthEmail={controller.setAuthEmail}
        authPassword={controller.authPassword}
        setAuthPassword={controller.setAuthPassword}
        authBusy={controller.authBusy}
        authStage={controller.authStage}
        authIntent={controller.authIntent}
        setAuthIntent={controller.setAuthIntent}
        agreeAndContinue={controller.agreeAndContinue}
        styles={styles}
        palette={palette}
      />
    );
  }

  return null;
}
