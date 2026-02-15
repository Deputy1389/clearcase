import { useState, useMemo } from "react";
import type { CaseSummary, CaseDetail, CaseAsset, MeResponse } from "../api";

export interface UseCaseListState {
  // List state
  cases: CaseSummary[];
  setCases: React.Dispatch<React.SetStateAction<CaseSummary[]>>;
  caseSearch: string;
  setCaseSearch: React.Dispatch<React.SetStateAction<string>>;
  caseFilter: "all" | "active" | "urgent" | "archived";
  setCaseFilter: React.Dispatch<React.SetStateAction<"all" | "active" | "urgent" | "archived">>;
  selectedCaseId: string | null;
  setSelectedCaseId: React.Dispatch<React.SetStateAction<string | null>>;
  // Loading states
  loadingDashboard: boolean;
  setLoadingDashboard: React.Dispatch<React.SetStateAction<boolean>>;
  refreshing: boolean;
  setRefreshing: React.Dispatch<React.SetStateAction<boolean>>;
  creatingCase: boolean;
  setCreatingCase: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface UseCaseListDerived {
  selectedCaseSummary: CaseSummary | null;
  latestCase: CaseSummary | null;
  filteredCases: CaseSummary[];
  userFirstName: string;
}

export function useCaseListState(email: string): UseCaseListState & UseCaseListDerived {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseSearch, setCaseSearch] = useState("");
  const [caseFilter, setCaseFilter] = useState<"all" | "active" | "urgent" | "archived">("all");
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingCase, setCreatingCase] = useState(false);

  const [me, setMe] = useState<MeResponse | null>(null);

  // Derived values
  const selectedCaseSummary = useMemo(
    () => cases.find((row) => row.id === selectedCaseId) ?? null,
    [cases, selectedCaseId]
  );

  const latestCase = useMemo(() => cases[0] ?? null, [cases]);

  const userFirstName = useMemo(() => {
    const fullName = me?.user.fullName?.trim();
    if (fullName) return fullName.split(/\s+/)[0];
    const emailName = email.split("@")[0]?.trim();
    return emailName || "there";
  }, [me, email]);

  const filteredCases = useMemo(() => {
    const q = caseSearch.trim().toLowerCase();
    return cases.filter((row) => {
      const status = (row.status ?? "").toLowerCase();
      const title = (row.title ?? "").toLowerCase();
      const docType = (row.documentType ?? "").toLowerCase();
      const matchesSearch = !q || title.includes(q) || docType.includes(q) || status.includes(q);
      const matchesFilter =
        caseFilter === "all"
          ? true
          : caseFilter === "active"
            ? !status.includes("archived") && !status.includes("closed")
            : caseFilter === "urgent"
              ? row.timeSensitive || Boolean(row.earliestDeadline)
              : status.includes("archived") || status.includes("closed");
      return matchesSearch && matchesFilter;
    });
  }, [cases, caseFilter, caseSearch]);

  return {
    cases,
    setCases,
    caseSearch,
    setCaseSearch,
    caseFilter,
    setCaseFilter,
    selectedCaseId,
    setSelectedCaseId,
    loadingDashboard,
    setLoadingDashboard,
    refreshing,
    setRefreshing,
    creatingCase,
    setCreatingCase,
    // Derived
    selectedCaseSummary,
    latestCase,
    filteredCases,
    userFirstName,
  };
}
