import { useRef, useState } from "react";
import { Linking } from "react-native";
import type { AuthHeaders } from "../api";
import { getPaywallConfig, createBillingCheckout } from "../api";
import { DEFAULT_PLUS_PRICE_MONTHLY } from "../constants";
import { withNetworkHint, plusUpgradeExplainer } from "../utils/error-helpers";
import type { PaywallConfigState, PlanTier, PlusFeatureGate, AppLanguage, BannerTone } from "../types";

// ---------------------------------------------------------------------------
// usePaywall — paywall state, config loading, checkout, upgrade prompts
// ---------------------------------------------------------------------------

export interface UsePaywallDeps {
  apiBase: string;
  headers: AuthHeaders;
  language: AppLanguage;
  offlineMode: boolean;
  showBanner: (tone: BannerTone, text: string) => void;
}

export interface UsePaywallCallbacks {
  sendTrackedEvent: (event: string, source?: string, properties?: Record<string, unknown>) => Promise<void>;
  loadDashboard: () => Promise<void>;
}

export interface UsePaywallReturn {
  paywallConfig: PaywallConfigState;
  setPaywallConfig: React.Dispatch<React.SetStateAction<PaywallConfigState>>;
  planTier: PlanTier;
  setPlanTier: React.Dispatch<React.SetStateAction<PlanTier>>;
  startingCheckout: boolean;
  planSheetOpen: boolean;
  setPlanSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  loadPaywallConfigState: (base?: string, auth?: AuthHeaders) => Promise<void>;
  startPlusCheckout: (triggerSource: string) => Promise<void>;
  openPaywall: (triggerSource: string) => void;
  promptPlusUpgrade: (feature: PlusFeatureGate) => void;
  /** Wire up callbacks that depend on hook output (breaks circular deps). */
  callbacks: React.MutableRefObject<UsePaywallCallbacks>;
}

export function usePaywall(deps: UsePaywallDeps): UsePaywallReturn {
  const { apiBase, headers, language, offlineMode, showBanner } = deps;

  const [paywallConfig, setPaywallConfig] = useState<PaywallConfigState>({
    plusPriceMonthly: DEFAULT_PLUS_PRICE_MONTHLY,
    paywallVariant: "gold_v1",
    showAlternatePlan: false,
    billingEnabled: true
  });
  const [planTier, setPlanTier] = useState<PlanTier>("free");
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);

  // Refs for callbacks that create circular deps with App.tsx.
  // App.tsx assigns these after defining sendTrackedEvent / loadDashboard.
  const callbacks = useRef<UsePaywallCallbacks>({
    sendTrackedEvent: async () => {},
    loadDashboard: async () => {}
  });

  // -- Load remote paywall config -----------------------------------------
  async function loadPaywallConfigState(base = apiBase, auth = headers): Promise<void> {
    if (offlineMode) return;
    try {
      const config = await getPaywallConfig(base, auth);
      setPaywallConfig({
        plusPriceMonthly: config.plusPriceMonthly || DEFAULT_PLUS_PRICE_MONTHLY,
        paywallVariant: config.paywallVariant || "gold_v1",
        showAlternatePlan: config.showAlternatePlan === true,
        billingEnabled: config.billingEnabled !== false
      });
    } catch {
      // Keep local defaults when config endpoint is unavailable.
    }
  }

  // -- Open paywall sheet (with tracking) ---------------------------------
  function openPaywall(triggerSource: string): void {
    setPlanSheetOpen(true);
    void callbacks.current.sendTrackedEvent("paywall_viewed", triggerSource);
  }

  // -- Show upgrade banner + open paywall ---------------------------------
  function promptPlusUpgrade(feature: PlusFeatureGate): void {
    showBanner("info", plusUpgradeExplainer(language, feature));
    openPaywall(feature === "watch_mode" ? "watch_mode_lock" : "consult_links_lock");
  }

  // -- Start Stripe checkout flow -----------------------------------------
  async function startPlusCheckout(triggerSource: string): Promise<void> {
    if (offlineMode) {
      showBanner(
        "info",
        language === "es"
          ? "La facturacion requiere conexion API."
          : "Billing checkout requires API connectivity."
      );
      return;
    }
    if (!paywallConfig.billingEnabled) {
      showBanner(
        "info",
        language === "es"
          ? "La facturacion no esta disponible por ahora."
          : "Billing is not available right now."
      );
      return;
    }

    setStartingCheckout(true);
    try {
      const checkout = await createBillingCheckout(apiBase, headers, {
        plan: "plus_monthly",
        triggerSource,
        locale: language
      });
      setPaywallConfig((current) => ({
        ...current,
        plusPriceMonthly: checkout.plusPriceMonthly || current.plusPriceMonthly,
        paywallVariant: checkout.paywallVariant || current.paywallVariant
      }));
      setPlanSheetOpen(false);
      await Linking.openURL(checkout.checkoutUrl);
      showBanner(
        "info",
        language === "es"
          ? "Se abrio checkout. Puede cancelar desde configuracion de cuenta."
          : "Checkout opened. You can cancel from account settings."
      );
      await callbacks.current.loadDashboard();
    } catch (error) {
      showBanner(
        "bad",
        language === "es"
          ? `No se pudo iniciar checkout: ${withNetworkHint(error, apiBase)}`
          : `Could not start checkout: ${withNetworkHint(error, apiBase)}`
      );
    } finally {
      setStartingCheckout(false);
    }
  }

  return {
    paywallConfig,
    setPaywallConfig,
    planTier,
    setPlanTier,
    startingCheckout,
    planSheetOpen,
    setPlanSheetOpen,
    loadPaywallConfigState,
    startPlusCheckout,
    openPaywall,
    promptPlusUpgrade,
    callbacks
  };
}
