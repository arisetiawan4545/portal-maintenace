import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface MasterData {
  apps: string[];
  programmers: string[];
  branches: string[];
}

const DOC_REF = doc(db, "settings", "master_data");

export async function getMasterData(): Promise<MasterData> {
  const snap = await getDoc(DOC_REF);
  if (snap.exists()) {
    const data = snap.data() as Partial<MasterData>;
    return {
      apps: data.apps && data.apps.length > 0 ? data.apps : getDefaultApps(),
      programmers: data.programmers && data.programmers.length > 0 ? data.programmers : getDefaultProgrammers(),
      branches: data.branches && data.branches.length > 0 ? data.branches : getDefaultBranches(),
    };
  }

  const defaultData: MasterData = {
    apps: getDefaultApps(),
    programmers: getDefaultProgrammers(),
    branches: getDefaultBranches(),
  };

  await setDoc(DOC_REF, defaultData);
  return defaultData;
}

export async function updateMasterData(data: MasterData): Promise<void> {
  await setDoc(DOC_REF, {
    apps: data.apps || [],
    programmers: data.programmers || [],
    branches: data.branches || [],
  });
}

function getDefaultApps(): string[] {
  return [
    "Web Admin CarePlus",
    "Aplikasi CarePlus",
  ];
}

function getDefaultProgrammers(): string[] {
  return ["Noval", "Ari Setiawan"];
}

function getDefaultBranches(): string[] {
  return [
    "HO",
    "Cabang Modern",
    "Cabang Mega",
  ];
}