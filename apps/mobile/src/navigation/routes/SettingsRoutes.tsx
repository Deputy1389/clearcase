import React from "react";
import { View, ScrollView, RefreshControl, Pressable, Text, TextInput, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { styles } from "./styleUtils";
import { palette } from "../../theme";
import { languageLabel } from "../../utils/parsing";
import { hapticTap } from "../../utils/haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LegalScreen from "../../screens/LegalScreen";
import LegalAidScreen from "../../screens/LegalAidScreen";

export function SettingsRoutes({ controller }: { controller: any }) {
  if (controller.screen === "legal") {
    return <LegalScreen language={controller.language} setScreen={controller.setScreen} legalReturnScreen={controller.legalReturnScreen} styles={styles} />;
  }

  if (controller.screen === "legalAid") {
    return <LegalAidScreen language={controller.language} legalAidSearch={controller.legalAidSearch} setLegalAidSearch={controller.setLegalAidSearch} selectedCaseId={controller.selectedCaseId} setLawyerSummaryOpen={controller.setLawyerSummaryOpen} setScreen={controller.setScreen} styles={styles} />;
  }

  if (controller.screen === "account") {
    return (
      <View style={styles.screenSoft}>
        <ScrollView contentContainerStyle={styles.scrollBody} refreshControl={<RefreshControl refreshing={controller.refreshing} onRefresh={() => void controller.refreshWorkspace()} />}>
          <View style={styles.accountHeaderCard}>
            <View style={styles.accountHeaderTop}>
              <View style={styles.accountHeaderLeft}>
                <Pressable onPress={() => controller.setDrawerOpen(true)} style={styles.info}>
                  <Feather name="menu" size={16} color={palette.subtle} />
                </Pressable>
                <Text style={styles.dashboardTitle}>Account</Text>
              </View>
            </View>
            <View style={styles.accountProfileRow}>
              <View style={styles.accountAvatar}>
                <Text style={styles.accountAvatarText}>{controller.accountInitials}</Text>
              </View>
              <View style={styles.accountIdentity}>
                <Text style={styles.accountName}>{controller.me?.user.fullName ?? "Complete your profile"}</Text>
                <Text style={styles.accountMeta}>{controller.email}</Text>
                <Text style={styles.accountMeta}>
                  {controller.me?.user.jurisdictionState ?? "Jurisdiction pending"} | {controller.completion}% complete
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, styles.accountPlanCard]}>
            <Text style={styles.planLabel}>ClearCase Plus</Text>
            <View style={styles.planTitleRow}>
              <Text style={styles.planTitle}>
                {controller.plusEnabled
                  ? controller.language === "es"
                    ? "Activo"
                    : "Active"
                  : controller.language === "es"
                    ? "No activo"
                    : "Not active"}
              </Text>
              <View style={styles.planTierPill}>
                <Text style={styles.planTierPillText}>
                  {controller.plusEnabled
                    ? controller.language === "es"
                      ? "Plus"
                      : "Plus"
                    : controller.language === "es"
                      ? "Free"
                      : "Free"}
                </Text>
              </View>
            </View>
            <Text style={styles.planBody}>
              {controller.language === "es"
                ? "Recordatorios, memoria de cronologia, traduccion simple y herramientas de paquete de consulta en un solo plan."
                : "Reminders, timeline memory, plain-meaning translation, and consultation packet tools in one plan."}
            </Text>
            <Text style={styles.planBodyMuted}>{controller.paywallConfig.plusPriceMonthly}</Text>
            <Text style={styles.planBodyMuted}>
              {controller.language === "es"
                ? "ClearCase ofrece claridad legal, no asesoria legal."
                : "ClearCase provides legal clarity, not legal advice."}
            </Text>
            <Pressable style={styles.accountUpgradeBtn} onPress={() => controller.openPaywall("account_billing_card")}>
              <Text style={styles.accountUpgradeBtnText}>
                {controller.plusEnabled
                  ? controller.language === "es"
                    ? "Administrar cobro"
                    : "Manage billing"
                  : controller.language === "es"
                    ? "Iniciar Plus"
                    : "Start Plus"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Profile</Text>
            <TextInput
              style={styles.input}
              value={controller.profileName}
              onChangeText={controller.setProfileName}
              placeholder="Full name"
              placeholderTextColor={palette.subtle}
              accessibilityLabel="Full name"
            />
            <TextInput
              style={styles.input}
              value={controller.profileZip}
              onChangeText={controller.setProfileZip}
              placeholder="ZIP code"
              placeholderTextColor={palette.subtle}
              keyboardType="number-pad"
              accessibilityLabel="ZIP code"
            />
            <Pressable onPress={() => { hapticTap(); void controller.saveProfile(); }} style={styles.primaryBtn} disabled={controller.savingProfile}>
              <Text style={styles.primaryBtnText}>{controller.savingProfile ? "Saving..." : "Save profile"}</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{controller.language === "es" ? "Configuracion personal" : "Personal settings"}</Text>
            <View style={styles.settingRow}>
              <Feather name="globe" size={16} color={palette.subtle} />
              <Text style={styles.settingText}>{controller.language === "es" ? "Idioma" : "Language"}</Text>
              <Text style={styles.optionDesc}>{languageLabel(controller.language)}</Text>
            </View>
            <View style={styles.languageToggleRow}>
              <Pressable
                style={[styles.languageTogglePill, controller.language === "en" ? styles.languageTogglePillActive : null]}
                onPress={() => void controller.applyLanguageFromSettings("en")}
                accessibilityRole="radio"
                accessibilityState={{ selected: controller.language === "en" }}
                accessibilityLabel="English"
              >
                <Text
                  style={[
                    styles.languageToggleText,
                    controller.language === "en" ? styles.languageToggleTextActive : null
                  ]}
                >
                  English
                </Text>
              </Pressable>
              <Pressable
                style={[styles.languageTogglePill, controller.language === "es" ? styles.languageTogglePillActive : null]}
                onPress={() => void controller.applyLanguageFromSettings("es")}
                accessibilityRole="radio"
                accessibilityState={{ selected: controller.language === "es" }}
                accessibilityLabel="Espanol"
              >
                <Text
                  style={[
                    styles.languageToggleText,
                    controller.language === "es" ? styles.languageToggleTextActive : null
                  ]}
                >
                  Espanol
                </Text>
              </Pressable>
            </View>
            <Pressable style={styles.settingRow} onPress={() => void controller.togglePushNotifications()} disabled={controller.savingPushPreferences} accessibilityRole="switch" accessibilityState={{ checked: controller.pushEnabled }} accessibilityLabel={controller.language === "es" ? "Notificaciones push" : "Push notifications"}>
              <Feather name="bell" size={16} color={palette.subtle} />
              <Text style={styles.settingText}>{controller.language === "es" ? "Notificaciones" : "Notifications"}</Text>
              <Text style={styles.optionDesc}>
                {controller.pushEnabled
                  ? controller.language === "es"
                    ? "Activadas"
                    : "Enabled"
                  : controller.language === "es"
                    ? "Desactivadas"
                    : "Disabled"}
              </Text>
            </Pressable>
            <Pressable
              style={styles.settingRow}
              onPress={() => void controller.togglePushQuietHours()}
              disabled={controller.savingPushPreferences}
            >
              <Feather name="moon" size={16} color={palette.subtle} />
              <Text style={styles.settingText}>{controller.language === "es" ? "Horas de silencio" : "Quiet hours"}</Text>
              <Text style={styles.optionDesc}>
                {controller.pushQuietHoursEnabled
                  ? controller.language === "es"
                    ? "22:00-07:00 UTC"
                    : "10pm-7am UTC"
                  : controller.language === "es"
                    ? "Sin horario"
                    : "No schedule"}
              </Text>
            </Pressable>
            <Pressable
              style={styles.settingRow}
              onPress={() => {
                Alert.alert(
                  controller.language === "es" ? "Dispositivos push" : "Push Devices",
                  controller.language === "es"
                    ? `Tienes ${controller.me?.pushDevices?.activeCount ?? 0} dispositivo(s) registrado(s). Para eliminar un dispositivo, desactiva las notificaciones y vuelve a activarlas.`
                    : `You have ${controller.me?.pushDevices?.activeCount ?? 0} registered device(s). To remove a device, disable notifications and re-enable them.`,
                  [{ text: "OK" }]
                );
              }}
              accessibilityRole="button"
              accessibilityLabel={controller.language === "es" ? "Dispositivos push" : "Push devices"}
            >
              <Feather name="smartphone" size={16} color={palette.subtle} />
              <Text style={styles.settingText}>{controller.language === "es" ? "Dispositivos push" : "Push devices"}</Text>
              <Text style={styles.optionDesc}>
                {controller.me?.pushDevices?.activeCount ?? 0}
              </Text>
            </Pressable>
            <Pressable style={styles.settingRow} onPress={() => controller.openPaywall("account_settings_billing")} accessibilityRole="button" accessibilityLabel={controller.language === "es" ? "Facturacion y planes" : "Billing and plans"}>
              <Feather name="credit-card" size={16} color={palette.subtle} />
              <Text style={styles.settingText}>{controller.language === "es" ? "Facturacion y planes" : "Billing and plans"}</Text>
              <Feather name="chevron-right" size={14} color={palette.subtle} />
            </Pressable>
            <Pressable
              style={styles.settingRow}
              accessibilityRole="button"
              accessibilityLabel={controller.language === "es" ? "Seguridad" : "Security"}
                                  onPress={() => {
                                    Alert.alert(
                                      controller.language === "es" ? "Seguridad" : "Security",
                                      controller.language === "es"
                                        ? "Bloqueo biometrico: Usa Face ID o huella dactilar para proteger la app.\n\nEsta funcion estara disponible en una proxima actualizacion."
                                        : "Biometric Lock: Use Face ID or fingerprint to protect the app.\n\nThis feature will be available in an upcoming update.",
                                      [{ text: "OK" }]
                                    );
                                  }}
              
            >
              <Feather name="shield" size={16} color={palette.subtle} />
              <Text style={styles.settingText}>{controller.language === "es" ? "Seguridad" : "Security"}</Text>
              <Feather name="chevron-right" size={14} color={palette.subtle} />
            </Pressable>
            <Pressable
              style={styles.settingRow}
              accessibilityRole="button"
              accessibilityLabel={controller.language === "es" ? "Aviso legal y privacidad" : "Legal and privacy"}
              onPress={() => { controller.setLegalReturnScreen("account"); controller.setScreen("legal"); }}
            >
              <Feather name="file-text" size={16} color={palette.subtle} />
              <Text style={styles.settingText}>{controller.language === "es" ? "Legal y privacidad" : "Legal & Privacy"}</Text>
              <Feather name="chevron-right" size={14} color={palette.subtle} />
            </Pressable>
          </View>

          <Pressable onPress={() => void controller.signOut()} style={[styles.outlineSoftBtn, styles.accountSignOutBtn]} accessibilityRole="button" accessibilityLabel={controller.language === "es" ? "Cerrar sesion" : "Sign out"}>
            <Text style={styles.outlineSoftText}>{controller.language === "es" ? "Cerrar sesion" : "Sign out"}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Alert.alert(
                controller.language === "es" ? "Eliminar cuenta" : "Delete Account",
                controller.language === "es"
                  ? "Esta accion eliminara permanentemente tu cuenta, todos tus casos y documentos. Esta accion no se puede deshacer."
                  : "This will permanently delete your account, all your cases, and documents. This action cannot be undone.",
                [
                  { text: controller.language === "es" ? "Cancelar" : "Cancel", style: "cancel" },
                  {
                    text: controller.language === "es" ? "Eliminar cuenta" : "Delete Account",
                    style: "destructive",
                    onPress: () => {
                      Alert.alert(
                        controller.language === "es" ? "Confirmar eliminacion" : "Confirm Deletion",
                        controller.language === "es"
                          ? "Escribe ELIMINAR para confirmar."
                          : "Are you absolutely sure? This is irreversible.",
                        [
                          { text: controller.language === "es" ? "Cancelar" : "Cancel", style: "cancel" },
                          {
                            text: controller.language === "es" ? "Si, eliminar todo" : "Yes, delete everything",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                if (!controller.offlineMode) {
                                  await fetch(`${controller.apiBase}/me`, { method: "DELETE", headers: { ...controller.headers, "Content-Type": "application/json" } });
                                }
                              } catch { /* best effort */ }
                              await AsyncStorage.clear();
                              controller.setMe(null);
                              controller.setCases([]);
                              controller.setSelectedCaseId(null);
                              controller.setSelectedCase(null);
                              controller.setEmail("");
                              controller.setSubject("");
                              controller.setPlanTier("free");
                              controller.setScreen("onboarding");
                              controller.showBanner("info", controller.language === "es" ? "Account deleted." : "Account deleted.");
                            }
                          }
                        ]
                      );
                    }
                  }
                ]
              );
            }}
            style={[styles.outlineSoftBtn, { borderColor: "#FCA5A5", marginBottom: 32 }]}
            accessibilityRole="button"
            accessibilityLabel={controller.language === "es" ? "Eliminar cuenta" : "Delete account"}
          >
            <Text style={[styles.outlineSoftText, { color: "#DC2626" }]}>{controller.language === "es" ? "Eliminar cuenta" : "Delete Account"}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return null;
}
