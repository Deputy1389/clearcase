import React from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { palette } from "../theme";
import { isValidEmail, isValidUsZip, isStrongPassword } from "../utils/auth-helpers";
import type { AppLanguage, AuthMode } from "../types";

type Props = {
  language: AppLanguage;
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  authName: string;
  setAuthName: (value: string) => void;
  authEmail: string;
  setAuthEmail: (value: string) => void;
  authPassword: string;
  setAuthPassword: (value: string) => void;
  authZip: string;
  setAuthZip: (value: string) => void;
  authIntent: string;
  setAuthIntent: (value: string) => void;
  authBusy: boolean;
  authStage: string;
  agreeAndContinue: () => Promise<void>;
  styles: any;
};

export default function AuthScreen({
  language,
  authMode,
  setAuthMode,
  authName,
  setAuthName,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authZip,
  setAuthZip,
  authIntent,
  setAuthIntent,
  authBusy,
  authStage,
  agreeAndContinue,
  styles,
}: Props) {
  return (
    <>
      {authMode === "selection" ? (
        <View style={styles.screen}>
          <View style={styles.authSelectionBody}>
            <LinearGradient
              colors={["#F8FAFC", "#E2E8F0"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.authSelectionHero}
            >
              <Text style={styles.welcomeMuted}>{language === "es" ? "Bienvenida a" : "Welcome to"}</Text>
              <Pressable style={styles.brandRow}>
                <View style={styles.brandMark}><MaterialCommunityIcons name="scale-balance" size={24} color="#FFFFFF" /></View>
                <Text style={styles.brandText}>ClearCase</Text>
              </Pressable>
              <Text style={styles.formSubtitle}>
                {language === "es"
                  ? "Claridad legal para reducir estres de preparacion y pasos omitidos."
                  : "Legal clarity to reduce preparation stress and missed steps."}
              </Text>
              <Text style={styles.optionDesc}>
                {language === "es"
                  ? "Informacion para orientarte, no asesoria legal."
                  : "Informational guidance for clarity, not legal advice."}
              </Text>
            </LinearGradient>
            <View style={styles.authSelectionActions}>
              <Pressable
                onPress={() => {
                  setAuthIntent("login");
                  setAuthMode("login");
                }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>{language === "es" ? "Iniciar sesion" : "Log in"}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setAuthIntent("signup");
                  setAuthMode("signup");
                }}
                style={styles.outlineBtn}
              >
                <Text style={styles.outlineBtnText}>{language === "es" ? "Crear cuenta" : "Sign up"}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Alert.alert(
                    language === "es" ? "Soporte" : "Support",
                    language === "es"
                      ? "El chat de soporte estara disponible pronto. Puedes continuar con iniciar sesion o crear cuenta."
                      : "Support chat is coming soon. Continue with Log in or Sign up."
                  );
                }}
                style={styles.link}
              >
                <Text style={styles.linkText}>{language === "es" ? "Contactar soporte" : "Contact support"}</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.authFooter}>
            <Text style={styles.authFooterLink}>
              {language === "es" ? "Solo orientacion informativa. No asesoria legal." : "Informational guidance only. Not legal advice."}
            </Text>
          </View>
        </View>
      ) : null}

      {authMode === "login" || authMode === "signup" ? (
        <ScrollView style={styles.scrollScreen} contentContainerStyle={styles.scrollBody}>
          <Pressable onPress={() => setAuthMode("selection")} style={styles.back}><Feather name="chevron-left" size={24} color={palette.muted} /></Pressable>
          <Text style={styles.formTitle}>
            {authMode === "signup" ? (language === "es" ? "Unete a ClearCase" : "Join ClearCase") : language === "es" ? "Bienvenida de regreso" : "Welcome back"}
          </Text>
          <Text style={styles.formSubtitle}>
            {authMode === "signup"
              ? language === "es"
                ? "Empieza con claridad para preparar tu caso."
                : "Start with clarity for case preparation."
              : language === "es"
                ? "Inicia sesion para ver tus casos guardados."
                : "Sign in to access your saved cases."}
          </Text>
          {authMode === "signup" ? (
            <>
              <Text style={styles.fieldLabel}>{language === "es" ? "Nombre completo" : "Full Name"}</Text>
              <TextInput style={styles.input} placeholder="John Doe" placeholderTextColor={palette.subtle} value={authName} onChangeText={setAuthName} accessibilityLabel={language === "es" ? "Nombre completo" : "Full name"} />
              <Text style={styles.fieldLabel}>{language === "es" ? "Codigo postal" : "ZIP Code"}</Text>
              <TextInput style={styles.input} placeholder="90210" placeholderTextColor={palette.subtle} keyboardType="number-pad" value={authZip} onChangeText={setAuthZip} accessibilityLabel={language === "es" ? "Codigo postal" : "ZIP code"} />
            </>
          ) : null}
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput style={styles.input} placeholder="john@example.com" placeholderTextColor={palette.subtle} autoCapitalize="none" value={authEmail} onChangeText={setAuthEmail} accessibilityLabel="Email" textContentType="emailAddress" />
          <Text style={styles.fieldLabel}>{language === "es" ? "Contrasena" : "Password"}</Text>
          <TextInput style={styles.input} placeholder="********" placeholderTextColor={palette.subtle} secureTextEntry autoCapitalize="none" value={authPassword} onChangeText={setAuthPassword} accessibilityLabel={language === "es" ? "Contrasena" : "Password"} textContentType="password" />
          <Pressable
            onPress={() => {
              const trimmedEmail = authEmail.trim();
              if (!trimmedEmail) {
                Alert.alert("Email required", "Enter your email address.");
                return;
              }
              if (!isValidEmail(trimmedEmail)) {
                Alert.alert("Invalid email", "Enter a valid email address.");
                return;
              }
              if (!isStrongPassword(authPassword)) {
                Alert.alert("Weak password", "Password must be at least 8 characters.");
                return;
              }
              if (authMode === "signup" && !authName.trim()) {
                Alert.alert("Name required", "Enter your full name.");
                return;
              }
              if (authMode === "signup" && authZip.trim() && !isValidUsZip(authZip)) {
                Alert.alert("Invalid ZIP", "Use a valid US ZIP code like 90210.");
                return;
              }
              setAuthIntent(authMode);
              setAuthMode("disclaimer");
            }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>
              {authMode === "signup" ? (language === "es" ? "Crear cuenta" : "Create account") : language === "es" ? "Iniciar sesion" : "Sign in"}
            </Text>
          </Pressable>
          <Text style={styles.subtleCenterText}>
            {language === "es"
              ? "ClearCase ofrece orientacion informativa y no reemplaza a un abogado con licencia."
              : "ClearCase provides informational guidance only and does not replace a licensed attorney."}
          </Text>
        </ScrollView>
      ) : null}

      {authMode === "disclaimer" ? (
        <ScrollView style={styles.disclaimerScreen} contentContainerStyle={styles.scrollBody}>
          <View style={styles.disclaimerHeaderRow}>
            <View style={styles.disclaimerShield}>
              <Feather name="shield" size={20} color={palette.primary} />
            </View>
            <Text style={styles.disclaimerTitle}>{language === "es" ? "Antes de continuar" : "Before you continue"}</Text>
          </View>
          <Text style={styles.disclaimerP}>
            {language === "es" ? "ClearCase es un producto informativo y no un despacho legal." : "ClearCase is an informational product and not a law firm."}
          </Text>
          <Text style={styles.disclaimerP}>
            {language === "es"
              ? "Para asesoria legal sobre una situacion especifica, muchas personas optan por consultar con un abogado con licencia."
              : "For legal advice on your specific situation, many people choose to consult a licensed attorney."}
          </Text>
          <View style={styles.disclaimerCard}>
            <Text style={styles.cardTitle}>{language === "es" ? "Reconozco y acepto que:" : "I acknowledge and agree that:"}</Text>
            <View style={styles.disclaimerBulletRow}>
              <View style={styles.disclaimerBulletDot} />
              <Text style={styles.cardBody}>
                {language === "es" ? "Mi informacion y los detalles del caso son confidenciales." : "My information and case details are confidential."}
              </Text>
            </View>
            <View style={styles.disclaimerBulletRow}>
              <View style={styles.disclaimerBulletDot} />
              <Text style={styles.cardBody}>
                {language === "es" ? "Los datos se procesan solo para brindar claridad situacional." : "Data is processed only to provide situational clarity."}
              </Text>
            </View>
            <View style={styles.disclaimerBulletRow}>
              <View style={styles.disclaimerBulletDot} />
              <Text style={styles.cardBody}>
                {language === "es"
                  ? "El uso de esta app no crea una relacion abogado-cliente."
                  : "No attorney-client relationship is created by using this app."}
              </Text>
            </View>
            <Pressable onPress={() => void agreeAndContinue()} style={styles.primaryBtn} disabled={authBusy}>
              <Text style={styles.primaryBtnText}>
                {authBusy
                  ? authStage === "account"
                    ? language === "es"
                      ? "Creando cuenta..."
                      : "Creating account..."
                    : authStage === "profile"
                      ? language === "es"
                        ? "Guardando perfil..."
                        : "Saving profile..."
                      : authStage === "workspace"
                        ? language === "es"
                          ? "Preparando espacio de trabajo..."
                          : "Setting up workspace..."
                        : language === "es"
                          ? "Conectando..."
                          : "Connecting..."
                  : language === "es"
                    ? "Aceptar y continuar a ClearCase"
                    : "Agree and Continue to ClearCase"}
              </Text>
            </Pressable>
            <Pressable onPress={() => setAuthMode(authIntent as AuthMode)} style={styles.link}>
              <Text style={styles.linkText}>{language === "es" ? "Volver" : "Back"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}
    </>
  );
}
