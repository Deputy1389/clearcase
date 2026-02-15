import React from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { hapticTap } from "../utils/haptics";
import { palette } from "../theme";
import { languageLabel } from "../utils/parsing";
import type { MeResponse } from "../api";
import type { AppLanguage, Screen, PaywallConfigState } from "../types";

type Props = {
  language: AppLanguage;
  me: MeResponse | null;
  accountInitials: string;
  email: string;
  completion: number;
  plusEnabled: boolean;
  paywallConfig: PaywallConfigState;
  profileName: string;
  setProfileName: (value: string) => void;
  profileZip: string;
  setProfileZip: (value: string) => void;
  savingProfile: boolean;
  saveProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  setScreen: (s: Screen) => void;
  setDrawerOpen: (open: boolean) => void;
  applyLanguageFromSettings: (lang: AppLanguage) => Promise<void>;
  pushEnabled: boolean;
  pushQuietHoursEnabled: boolean;
  savingPushPreferences: boolean;
  togglePushNotifications: () => Promise<void>;
  togglePushQuietHours: () => Promise<void>;
  openPaywall: (source: string) => void;
  setLegalReturnScreen: (s: Screen) => void;
  refreshing: boolean;
  refreshWorkspace: () => Promise<void>;
  deleteAccount: () => void;
  styles: any;
};

export default function AccountScreen({
  language,
  me,
  accountInitials,
  email,
  completion,
  plusEnabled,
  paywallConfig,
  profileName,
  setProfileName,
  profileZip,
  setProfileZip,
  savingProfile,
  saveProfile,
  signOut,
  setScreen,
  setDrawerOpen,
  applyLanguageFromSettings,
  pushEnabled,
  pushQuietHoursEnabled,
  savingPushPreferences,
  togglePushNotifications,
  togglePushQuietHours,
  openPaywall,
  setLegalReturnScreen,
  refreshing,
  refreshWorkspace,
  deleteAccount,
  styles,
}: Props) {
  return (
    <View style={styles.screenSoft}>
      <ScrollView contentContainerStyle={styles.scrollBody} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshWorkspace()} />}>
        <View style={styles.accountHeaderCard}>
          <View style={styles.accountHeaderTop}>
            <View style={styles.accountHeaderLeft}>
              <Pressable onPress={() => setDrawerOpen(true)} style={styles.info}>
                <Feather name="menu" size={16} color={palette.subtle} />
              </Pressable>
              <Text style={styles.dashboardTitle}>Account</Text>
            </View>
          </View>
          <View style={styles.accountProfileRow}>
            <View style={styles.accountAvatar}>
              <Text style={styles.accountAvatarText}>{accountInitials}</Text>
            </View>
            <View style={styles.accountIdentity}>
              <Text style={styles.accountName}>{me?.user.fullName ?? "Complete your profile"}</Text>
              <Text style={styles.accountMeta}>{email}</Text>
              <Text style={styles.accountMeta}>
                {me?.user.jurisdictionState ?? "Jurisdiction pending"} | {completion}% complete
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, styles.accountPlanCard]}>
          <Text style={styles.planLabel}>ClearCase Plus</Text>
          <View style={styles.planTitleRow}>
            <Text style={styles.planTitle}>
              {plusEnabled
                ? language === "es" ? "Activo" : "Active"
                : language === "es" ? "No activo" : "Not active"}
            </Text>
            <View style={styles.planTierPill}>
              <Text style={styles.planTierPillText}>
                {plusEnabled
                  ? language === "es" ? "Plus" : "Plus"
                  : language === "es" ? "Free" : "Free"}
              </Text>
            </View>
          </View>
          <Text style={styles.planBody}>
            {language === "es"
              ? "Recordatorios, memoria de cronologia, traduccion simple y herramientas de paquete de consulta en un solo plan."
              : "Reminders, timeline memory, plain-meaning translation, and consultation packet tools in one plan."}
          </Text>
          <Text style={styles.planBodyMuted}>{paywallConfig.plusPriceMonthly}</Text>
          <Text style={styles.planBodyMuted}>
            {language === "es"
              ? "ClearCase ofrece claridad legal, no asesoria legal."
              : "ClearCase provides legal clarity, not legal advice."}
          </Text>
          <Pressable style={styles.accountUpgradeBtn} onPress={() => openPaywall("account_billing_card")}>
            <Text style={styles.accountUpgradeBtnText}>
              {plusEnabled
                ? language === "es" ? "Administrar cobro" : "Manage billing"
                : language === "es" ? "Iniciar Plus" : "Start Plus"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile</Text>
          <TextInput
            style={styles.input}
            value={profileName}
            onChangeText={setProfileName}
            placeholder="Full name"
            placeholderTextColor={palette.subtle}
            accessibilityLabel="Full name"
          />
          <TextInput
            style={styles.input}
            value={profileZip}
            onChangeText={setProfileZip}
            placeholder="ZIP code"
            placeholderTextColor={palette.subtle}
            keyboardType="number-pad"
            accessibilityLabel="ZIP code"
          />
          <Pressable onPress={() => { hapticTap(); void saveProfile(); }} style={styles.primaryBtn} disabled={savingProfile}>
            <Text style={styles.primaryBtnText}>{savingProfile ? "Saving..." : "Save profile"}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{language === "es" ? "Configuracion personal" : "Personal settings"}</Text>
          <View style={styles.settingRow}>
            <Feather name="globe" size={16} color={palette.subtle} />
            <Text style={styles.settingText}>{language === "es" ? "Idioma" : "Language"}</Text>
            <Text style={styles.optionDesc}>{languageLabel(language)}</Text>
          </View>
          <View style={styles.languageToggleRow}>
            <Pressable
              style={[styles.languageTogglePill, language === "en" ? styles.languageTogglePillActive : null]}
              onPress={() => void applyLanguageFromSettings("en")}
              accessibilityRole="radio"
              accessibilityState={{ selected: language === "en" }}
              accessibilityLabel="English"
            >
              <Text style={[styles.languageToggleText, language === "en" ? styles.languageToggleTextActive : null]}>
                English
              </Text>
            </Pressable>
            <Pressable
              style={[styles.languageTogglePill, language === "es" ? styles.languageTogglePillActive : null]}
              onPress={() => void applyLanguageFromSettings("es")}
              accessibilityRole="radio"
              accessibilityState={{ selected: language === "es" }}
              accessibilityLabel="Espanol"
            >
              <Text style={[styles.languageToggleText, language === "es" ? styles.languageToggleTextActive : null]}>
                Espanol
              </Text>
            </Pressable>
          </View>
          <Pressable style={styles.settingRow} onPress={() => void togglePushNotifications()} disabled={savingPushPreferences} accessibilityRole="switch" accessibilityState={{ checked: pushEnabled }} accessibilityLabel={language === "es" ? "Notificaciones push" : "Push notifications"}>
            <Feather name="bell" size={16} color={palette.subtle} />
            <Text style={styles.settingText}>{language === "es" ? "Notificaciones" : "Notifications"}</Text>
            <Text style={styles.optionDesc}>
              {pushEnabled
                ? language === "es" ? "Activadas" : "Enabled"
                : language === "es" ? "Desactivadas" : "Disabled"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.settingRow}
            onPress={() => void togglePushQuietHours()}
            disabled={savingPushPreferences}
          >
            <Feather name="moon" size={16} color={palette.subtle} />
            <Text style={styles.settingText}>{language === "es" ? "Horas de silencio" : "Quiet hours"}</Text>
            <Text style={styles.optionDesc}>
              {pushQuietHoursEnabled
                ? language === "es" ? "22:00-07:00 UTC" : "10pm-7am UTC"
                : language === "es" ? "Sin horario" : "No schedule"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.settingRow}
            onPress={() => {
              Alert.alert(
                language === "es" ? "Dispositivos push" : "Push Devices",
                language === "es"
                  ? `Tienes ${me?.pushDevices?.activeCount ?? 0} dispositivo(s) registrado(s). Para eliminar un dispositivo, desactiva las notificaciones y vuelve a activarlas.`
                  : `You have ${me?.pushDevices?.activeCount ?? 0} registered device(s). To remove a device, disable notifications and re-enable them.`,
                [{ text: "OK" }]
              );
            }}
            accessibilityRole="button"
            accessibilityLabel={language === "es" ? "Dispositivos push" : "Push devices"}
          >
            <Feather name="smartphone" size={16} color={palette.subtle} />
            <Text style={styles.settingText}>{language === "es" ? "Dispositivos push" : "Push devices"}</Text>
            <Text style={styles.optionDesc}>
              {me?.pushDevices?.activeCount ?? 0}
            </Text>
          </Pressable>
          <Pressable style={styles.settingRow} onPress={() => openPaywall("account_settings_billing")} accessibilityRole="button" accessibilityLabel={language === "es" ? "Facturacion y planes" : "Billing and plans"}>
            <Feather name="credit-card" size={16} color={palette.subtle} />
            <Text style={styles.settingText}>{language === "es" ? "Facturacion y planes" : "Billing and plans"}</Text>
            <Feather name="chevron-right" size={14} color={palette.subtle} />
          </Pressable>
          <Pressable
            style={styles.settingRow}
            accessibilityRole="button"
            accessibilityLabel={language === "es" ? "Seguridad" : "Security"}
            onPress={() => {
              Alert.alert(
                language === "es" ? "Seguridad" : "Security",
                language === "es"
                  ? "Bloqueo biometrico: Usa Face ID o huella dactilar para proteger la app.\n\nEsta funcion estara disponible en una proxima actualizacion."
                  : "Biometric Lock: Use Face ID or fingerprint to protect the app.\n\nThis feature will be available in an upcoming update.",
                [{ text: "OK" }]
              );
            }}
          >
            <Feather name="shield" size={16} color={palette.subtle} />
            <Text style={styles.settingText}>{language === "es" ? "Seguridad" : "Security"}</Text>
            <Feather name="chevron-right" size={14} color={palette.subtle} />
          </Pressable>
          <Pressable
            style={styles.settingRow}
            accessibilityRole="button"
            accessibilityLabel={language === "es" ? "Aviso legal y privacidad" : "Legal and privacy"}
            onPress={() => { setLegalReturnScreen("account"); setScreen("legal"); }}
          >
            <Feather name="file-text" size={16} color={palette.subtle} />
            <Text style={styles.settingText}>{language === "es" ? "Legal y privacidad" : "Legal & Privacy"}</Text>
            <Feather name="chevron-right" size={14} color={palette.subtle} />
          </Pressable>
        </View>

        <Pressable onPress={() => void signOut()} style={[styles.outlineSoftBtn, styles.accountSignOutBtn]} accessibilityRole="button" accessibilityLabel={language === "es" ? "Cerrar sesion" : "Sign out"}>
          <Text style={styles.outlineSoftText}>{language === "es" ? "Cerrar sesion" : "Sign out"}</Text>
        </Pressable>

        <Pressable
          onPress={deleteAccount}
          style={[styles.outlineSoftBtn, { borderColor: "#FCA5A5", marginBottom: 32 }]}
          accessibilityRole="button"
          accessibilityLabel={language === "es" ? "Eliminar cuenta" : "Delete account"}
        >
          <Text style={[styles.outlineSoftText, { color: "#DC2626" }]}>{language === "es" ? "Eliminar cuenta" : "Delete Account"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
