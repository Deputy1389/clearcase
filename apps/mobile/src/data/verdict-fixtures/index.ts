import summonsFull from "./summons-full.json";
import summonsMinimal from "./summons-minimal.json";
import demandLetterFull from "./demand-letter-full.json";
import demandLetterSparse from "./demand-letter-sparse.json";
import subpoenaRecords from "./subpoena-records.json";
import debtCollection from "./debt-collection.json";
import agencyNotice from "./agency-notice.json";
import eviction3day from "./eviction-3day.json";
import unknownOther from "./unknown-other.json";
import ceaseDesist from "./cease-desist.json";

export type VerdictFixture = {
  name: string;
  data: Record<string, unknown>;
};

export const VERDICT_FIXTURES: VerdictFixture[] = [
  { name: "summons-full", data: summonsFull as Record<string, unknown> },
  { name: "summons-minimal", data: summonsMinimal as Record<string, unknown> },
  { name: "demand-letter-full", data: demandLetterFull as Record<string, unknown> },
  { name: "demand-letter-sparse", data: demandLetterSparse as Record<string, unknown> },
  { name: "subpoena-records", data: subpoenaRecords as Record<string, unknown> },
  { name: "debt-collection", data: debtCollection as Record<string, unknown> },
  { name: "agency-notice", data: agencyNotice as Record<string, unknown> },
  { name: "eviction-3day", data: eviction3day as Record<string, unknown> },
  { name: "unknown-other", data: unknownOther as Record<string, unknown> },
  { name: "cease-desist", data: ceaseDesist as Record<string, unknown> },
];
