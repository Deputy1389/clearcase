import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { 
  STORAGE_API_BASE, 
  STORAGE_SUBJECT, 
  STORAGE_EMAIL, 
  STORAGE_ONBOARDED, 
  STORAGE_OFFLINE_SESSION, 
  STORAGE_PLAN_TIER, 
  STORAGE_LANGUAGE,
  DEFAULT_SUBJECT,
  DEFAULT_EMAIL
} from "../../constants";
import { 
  ENV_API_BASE, 
  DEFAULT_API_BASE,
  isPrivateIpv4Host, 
  extractHostFromApiBase, 
  isLocalApiBase, 
  isLoopbackApiBase,
  isLoopbackHost,
  extractMetroHost
} from "../../utils/network";
import { parsePlanTier, parseLanguage } from "../../utils/parsing";
import { getMe, getCases } from "../../api";
import { buildHeaders } from "../../utils/network";
import { withNetworkHint, isNetworkErrorLike } from "../../utils/error-helpers";

export function useAppBootstrap(ui: any, auth: any, cases: any) {
  useEffect(() => {
    async function hydrate(): Promise<void> {
      try {
        const [
          savedBase, savedSubject, savedEmail, savedOnboarded, 
          savedOfflineSession, savedPlanTier, savedLanguage
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_API_BASE),
          AsyncStorage.getItem(STORAGE_SUBJECT),
          AsyncStorage.getItem(STORAGE_EMAIL),
          AsyncStorage.getItem(STORAGE_ONBOARDED),
          AsyncStorage.getItem(STORAGE_OFFLINE_SESSION),
          AsyncStorage.getItem(STORAGE_PLAN_TIER),
          AsyncStorage.getItem(STORAGE_LANGUAGE)
        ]);

        const parsedPlanTier = parsePlanTier(savedPlanTier);
        if (parsedPlanTier) ui.setPlanTier(parsedPlanTier);

        const parsedLanguage = parseLanguage(savedLanguage);
        if (parsedLanguage) ui.setLanguage(parsedLanguage);

        let nextBase = DEFAULT_API_BASE;
        if (ENV_API_BASE) {
          nextBase = ENV_API_BASE;
          await AsyncStorage.setItem(STORAGE_API_BASE, ENV_API_BASE);
        } else if (savedBase?.trim()) {
          const trimmedSaved = savedBase.trim();
          if (
            (isPrivateIpv4Host(extractHostFromApiBase(DEFAULT_API_BASE) ?? "") && !isLocalApiBase(trimmedSaved)) ||
            (!isLoopbackApiBase(DEFAULT_API_BASE) && isLoopbackApiBase(trimmedSaved))
          ) {
            nextBase = DEFAULT_API_BASE;
            await AsyncStorage.setItem(STORAGE_API_BASE, DEFAULT_API_BASE);
          } else {
            nextBase = trimmedSaved;
          }
        }
        ui.setApiBase(nextBase);
        ui.setApiBaseInput(nextBase);

        const nextSubject = savedSubject?.trim() || DEFAULT_SUBJECT;
        const nextEmail = savedEmail?.trim() || DEFAULT_EMAIL;
        ui.setSubject(nextSubject);
        ui.setSubjectInput(nextSubject);
        ui.setEmail(nextEmail);
        ui.setEmailInput(nextEmail);
        auth.setAuthEmail(nextEmail);

        const onboardingDone = savedOnboarded === "1";
        if (!onboardingDone) {
          ui.setScreen("onboarding");
          auth.setIsBootstrapping(false);
          return;
        }

        if (nextSubject === DEFAULT_SUBJECT) {
          ui.setScreen("auth");
          auth.setIsBootstrapping(false);
          return;
        }

        // Try to restore session
        const nextHeaders = buildHeaders(nextSubject, nextEmail);
        try {
          const meData = await getMe(nextBase, nextHeaders);
          cases.setMe(meData);
          ui.setPlanTier(meData.entitlement?.isPlus ? "plus" : "free");
          
          const caseData = await getCases(nextBase, nextHeaders);
          cases.setCases(caseData.cases);
          cases.setSelectedCaseId(caseData.cases[0]?.id ?? null);
          ui.setScreen("home");
        } catch (error) {
          const message = withNetworkHint(error, nextBase);
          if (isNetworkErrorLike(message) && savedOfflineSession) {
            const parsed = JSON.parse(savedOfflineSession);
            cases.setMe(parsed.me);
            cases.setCases(parsed.cases);
            cases.setSelectedCaseId(parsed.cases[0]?.id ?? null);
            ui.setOfflineMode(true);
            ui.setScreen("home");
          } else {
            ui.setScreen("auth");
          }
        }
      } catch (e) {
        ui.setScreen("auth");
      } finally {
        auth.setIsBootstrapping(false);
      }
    }
    void hydrate();
  }, []);

  // Loopback upgrade effect
  useEffect(() => {
    async function upgradeLoopbackBaseForDevice(): Promise<void> {
      if (ENV_API_BASE) return;
      if (Platform.OS === "web") return;
      const metroHost = extractMetroHost();
      if (!metroHost || isLoopbackHost(metroHost)) return;
      const suggestedBase = `http://${metroHost}:3001`;

      ui.setApiBase((current: string) => (!isLocalApiBase(current) ? suggestedBase : current));
      ui.setApiBaseInput((current: string) => (!isLocalApiBase(current) ? suggestedBase : current));

      try {
        const savedBase = await AsyncStorage.getItem(STORAGE_API_BASE);
        if (!savedBase || !isLocalApiBase(savedBase)) {
          await AsyncStorage.setItem(STORAGE_API_BASE, suggestedBase);
        }
      } catch {}
    }
    void upgradeLoopbackBaseForDevice();
  }, []);
}
