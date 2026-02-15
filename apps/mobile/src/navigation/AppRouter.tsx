import React, { useMemo, useRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  ScrollView,
  Animated,
  UIManager,
  PanResponder
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Newsreader_600SemiBold, Newsreader_700Bold } from "@expo-google-fonts/newsreader";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold
} from "@expo-google-fonts/plus-jakarta-sans";

import { AuthRoutes } from "./routes/AuthRoutes";
import { HomeRoutes } from "./routes/HomeRoutes";
import { WorkspaceRoutes } from "./routes/WorkspaceRoutes";
import { SettingsRoutes } from "./routes/SettingsRoutes";
import { styles } from "./routes/styleUtils";
import { palette } from "../theme";

import {
  clamp,
  fmtDate,
  fmtDateTime,
  titleize
} from "../utils/formatting";
import {
  casePriorityLevel,
  casePriorityLabel
} from "../utils/case-logic";

// Helper for router selection logic
const AUTH_SCREENS = ["auth", "onboarding", "language"];
const SETTINGS_SCREENS = ["account", "legal", "legalAid"];

function formatUploadStage(stage: string, language: string = "en"): string {
  if (language === "es") {
    if (stage === "picking") return "Elegir archivo";
    if (stage === "preparing") return "Preparando carga";
    if (stage === "sending") return "Cargando de forma segura";
    if (stage === "processing") return "Generando analisis";
    return "Listo para cargar";
  }
  if (stage === "picking") return "Choose file";
  if (stage === "preparing") return "Preparing upload";
  if (stage === "sending") return "Uploading securely";
  if (stage === "processing") return "Generating insight";
  return "Ready to upload";
}

function localizedCaseStatus(value: string | null | undefined, language: string = "en"): string {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return language === "es" ? "Abierto" : "Open";
  if (language === "es") {
    if (normalized === "open") return "Abierto";
    if (normalized === "closed") return "Cerrado";
    if (normalized === "archived") return "Archivado";
    if (normalized === "pending") return "Pendiente";
    if (normalized === "in_progress") return "En progreso";
  }
  return titleize(normalized);
}

const subtleSpring = {
  duration: 250,
  update: { type: "spring" as const, springDamping: 0.85 },
  create: { type: "easeInEaseOut" as const, property: "opacity" as const },
  delete: { type: "easeInEaseOut" as const, property: "opacity" as const }
};

export function AppRouter({ controller }: { controller: any }) {
  const [fontsLoaded] = useFonts({
    Newsreader_600SemiBold,
    Newsreader_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold
  });

  const uploadStatusText = controller.uploading
    ? formatUploadStage(controller.uploadStage, controller.language)
    : controller.language === "es" ? "Listo para cargar" : "Ready to upload";

  const canOpenDrawer =
    controller.screen === "home" ||
    controller.screen === "workspace" ||
    controller.screen === "cases" ||
    controller.screen === "account" ||
    controller.screen === "legal";

  const drawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!canOpenDrawer || controller.drawerOpen) return false;
          const startedAtEdge = gestureState.x0 <= 24 || gestureState.moveX <= 24;
          const horizontalSwipe =
            gestureState.dx > 14 &&
            Math.abs(gestureState.dy) < 20 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
          return startedAtEdge && horizontalSwipe;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (!canOpenDrawer || controller.drawerOpen) return;
          if (gestureState.dx > 55) controller.setDrawerOpen(true);
        }
      }),
    [canOpenDrawer, controller.drawerOpen]
  );

  const assetViewerImagePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => controller.assetViewerIsImage && controller.assetViewerImageZoom > 1,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          controller.assetViewerIsImage &&
          controller.assetViewerImageZoom > 1 &&
          (Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3),
        onPanResponderGrant: () => {
          controller.assetViewerImagePanStartRef.current = controller.assetViewerImagePanRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          const maxX = ((Math.max(controller.assetViewerImageZoom, 1) - 1) * controller.assetViewerImageBounds.width) / 2;
          const maxY = ((Math.max(controller.assetViewerImageZoom, 1) - 1) * controller.assetViewerImageBounds.height) / 2;
          controller.setAssetViewerImagePan({
            x: clamp(controller.assetViewerImagePanStartRef.current.x + gestureState.dx, -maxX, maxX),
            y: clamp(controller.assetViewerImagePanStartRef.current.y + gestureState.dy, -maxY, maxY)
          });
        }
      }),
    [controller.assetViewerImageBounds.height, controller.assetViewerImageBounds.width, controller.assetViewerImageZoom, controller.assetViewerIsImage]
  );

  if (!fontsLoaded || controller.isBootstrapping) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loading}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.loadingText}>Loading app...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const renderContent = () => {
    // 1. Auth Flow
    if (!controller.me || AUTH_SCREENS.includes(controller.screen)) {
      return <AuthRoutes controller={controller} />;
    }

    // 2. Workspace Flow
    if (controller.screen === "workspace") {
      return (
        <WorkspaceRoutes
          controller={controller}
          assetViewerImagePanResponder={assetViewerImagePanResponder}
          uploadStatusText={uploadStatusText}
          localizedCaseStatus={localizedCaseStatus}
          fmtDate={fmtDate}
          fmtDateTime={fmtDateTime}
          casePriorityLevel={casePriorityLevel}
          casePriorityLabel={casePriorityLabel}
        />
      );
    }

    // 3. Settings Flow
    if (SETTINGS_SCREENS.includes(controller.screen)) {
      return <SettingsRoutes controller={controller} />;
    }

    // 4. Main Home/Tab Flow
    return (
      <HomeRoutes
        controller={controller}
        uploadStatusText={uploadStatusText}
        localizedCaseStatus={localizedCaseStatus}
        fmtDate={fmtDate}
        fmtDateTime={fmtDateTime}
        casePriorityLevel={casePriorityLevel}
        casePriorityLabel={casePriorityLabel}
      />
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          {...drawerPanResponder.panHandlers}
        >
          {controller.banner ? (
            <View
              style={[
                styles.banner,
                controller.banner.tone === "good" ? styles.bannerGood : null,
                controller.banner.tone === "bad" ? styles.bannerBad : null
              ]}
            >
              <Text style={styles.bannerText}>{controller.banner.text}</Text>
            </View>
          ) : null}

          {renderContent()}

          <Modal
            visible={controller.drawerOpen}
            transparent
            animationType="none"
            onRequestClose={() => controller.setDrawerOpen(false)}
          >
            <View style={styles.drawerOverlay}>
              <Pressable style={styles.drawerBackdrop} onPress={() => controller.setDrawerOpen(false)} accessibilityRole="button" accessibilityLabel="Close" />
              <Animated.View style={styles.drawerCard}>
                <SafeAreaView style={styles.fill}>
                  <View style={styles.drawerHeader}>
                    <Text style={styles.drawerBrand}>ClearCase</Text>
                    <Pressable onPress={() => controller.setDrawerOpen(false)} style={styles.drawerClose}>
                      <Feather name="x" size={20} color={palette.subtle} />
                    </Pressable>
                  </View>

                  <ScrollView style={styles.drawerBody}>
                    <Pressable
                      style={[styles.drawerItem, controller.screen === "home" ? styles.drawerItemActive : null]}
                      onPress={() => { controller.setDrawerOpen(false); controller.setScreen("home"); }}
                    >
                      <Feather name="home" size={18} color={controller.screen === "home" ? palette.primary : palette.subtle} />
                      <Text style={[styles.drawerItemText, controller.screen === "home" ? styles.drawerItemTextActive : null]}>{controller.language === "es" ? "Inicio" : "Home"}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.drawerItem, controller.screen === "cases" ? styles.drawerItemActive : null]}
                      onPress={() => { controller.setDrawerOpen(false); controller.setScreen("cases"); }}
                    >
                      <Feather name="briefcase" size={18} color={controller.screen === "cases" ? palette.primary : palette.subtle} />
                      <Text style={[styles.drawerItemText, controller.screen === "cases" ? styles.drawerItemTextActive : null]}>{controller.language === "es" ? "Casos" : "Cases"}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.drawerItem, controller.screen === "account" ? styles.drawerItemActive : null]}
                      onPress={() => { controller.setDrawerOpen(false); controller.setScreen("account"); }}
                    >
                      <Feather name="user" size={18} color={controller.screen === "account" ? palette.primary : palette.subtle} />
                      <Text style={[styles.drawerItemText, controller.screen === "account" ? styles.drawerItemTextActive : null]}>{controller.language === "es" ? "Cuenta" : "Account"}</Text>
                    </Pressable>

                    <View style={styles.drawerDivider} />

                    <Pressable
                      style={styles.drawerItem}
                      onPress={() => { controller.setDrawerOpen(false); controller.openPaywall("drawer_plus_link"); }}
                    >
                      <Feather name="star" size={18} color="#EAB308" />
                      <Text style={styles.drawerItemText}>ClearCase Plus</Text>
                    </Pressable>
                    <Pressable
                      style={styles.drawerItem}
                      onPress={() => { controller.setDrawerOpen(false); controller.setLegalReturnScreen(controller.screen); controller.setScreen("legal"); }}
                    >
                      <Feather name="file-text" size={18} color={palette.subtle} />
                      <Text style={styles.drawerItemText}>{controller.language === "es" ? "Legal y privacidad" : "Legal & Privacy"}</Text>
                    </Pressable>
                  </ScrollView>

                  <View style={styles.drawerFooter}>
                    <Pressable style={styles.drawerSignOut} onPress={() => { controller.setDrawerOpen(false); void controller.signOut(); }}>
                      <Feather name="log-out" size={16} color={palette.subtle} />
                      <Text style={styles.drawerSignOutText}>{controller.language === "es" ? "Cerrar sesion" : "Sign out"}</Text>
                    </Pressable>
                    <Text style={styles.drawerVersion}>v1.0.0-mvp</Text>
                  </View>
                </SafeAreaView>
              </Animated.View>
            </View>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
