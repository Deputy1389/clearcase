import { useState, useMemo } from "react";
import type { CaseDetail, CaseAsset, MeResponse } from "../api";

export interface UseCaseDetailState {
  // Detail state
  selectedCase: CaseDetail | null;
  setSelectedCase: React.Dispatch<React.SetStateAction<CaseDetail | null>>;
  caseAssets: CaseAsset[];
  setCaseAssets: React.Dispatch<React.SetStateAction<CaseAsset[]>>;
  loadingCaseAssets: boolean;
  setLoadingCaseAssets: React.Dispatch<React.SetStateAction<boolean>>;
  loadingCase: boolean;
  setLoadingCase: React.Dispatch<React.SetStateAction<boolean>>;
  // Profile
  profileName: string;
  setProfileName: React.Dispatch<React.SetStateAction<string>>;
  profileZip: string;
  setProfileZip: React.Dispatch<React.SetStateAction<string>>;
  savingProfile: boolean;
  setSavingProfile: React.Dispatch<React.SetStateAction<boolean>>;
  // Me
  me: MeResponse | null;
  setMe: React.Dispatch<React.SetStateAction<MeResponse | null>>;
  // Other
  newCaseTitle: string;
  setNewCaseTitle: React.Dispatch<React.SetStateAction<string>>;
}

export function useCaseDetailState(): UseCaseDetailState {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null);
  const [caseAssets, setCaseAssets] = useState<CaseAsset[]>([]);
  const [loadingCaseAssets, setLoadingCaseAssets] = useState(false);
  const [loadingCase, setLoadingCase] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileZip, setProfileZip] = useState("");
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  return {
    me,
    setMe,
    selectedCase,
    setSelectedCase,
    caseAssets,
    setCaseAssets,
    loadingCaseAssets,
    setLoadingCaseAssets,
    loadingCase,
    setLoadingCase,
    profileName,
    setProfileName,
    profileZip,
    setProfileZip,
    savingProfile,
    setSavingProfile,
    newCaseTitle,
    setNewCaseTitle,
  };
}
