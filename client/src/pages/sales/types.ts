// Shapes returned by Member B's API (BUILD_PLAN §7), plus small shared helpers for B's pages.

export type LeadStage =
  | "NEW" | "CONTACTED" | "QUALIFIED" | "SURVEY_SCHEDULED" | "SURVEY_APPROVED" | "QUOTED" | "WON" | "LOST";
export type LeadSource = "WEB" | "WHATSAPP" | "CALL";
export type SystemType = "ON_GRID" | "OFF_GRID";
export type SurveyStatus = "SCHEDULED" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface LeadListItem {
  id: number; ref: string; name: string; phone: string; source: LeadSource; kw: number;
  systemType: SystemType; stage: LeadStage; salespersonName: string | null; createdAt: string;
}

export interface LeadDetail extends LeadListItem {
  address: string; monthlyBill: number; subsidyInterest: boolean; roofArea: number | null; gridOk: boolean | null;
  callNotes: string | null; lostReason: string | null; canQuote: boolean;
  surveys: { id: number; ref: string; status: SurveyStatus; visitDate: string; technicianName: string }[];
  quotations: { id: number; ref: string; status: string; total: number }[];
}

export interface SurveyListItem {
  id: number; ref: string; leadId: number; leadName: string; address: string;
  technicianName: string; visitDate: string; status: SurveyStatus;
}

export interface SurveyDetail {
  id: number; ref: string; lead: { id: number; name: string; phone: string; address: string };
  technicianId: number; technicianName: string; visitDate: string; direction: string | null; tilt: number | null;
  cableDistance: number | null; area: number | null; photos: string[]; status: SurveyStatus; rejectReason: string | null;
}

export interface PackageItem { id: number; code: string; name: string; type: string; kw: number; subsidy: number; price: number }
export interface UserItem { id: number; name: string; role: string }

export const STAGE_LABEL: Record<LeadStage, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified", SURVEY_SCHEDULED: "Survey scheduled",
  SURVEY_APPROVED: "Survey approved", QUOTED: "Quoted", WON: "Won", LOST: "Lost",
};
export const STAGES: LeadStage[] = ["NEW", "CONTACTED", "QUALIFIED", "SURVEY_SCHEDULED", "SURVEY_APPROVED", "QUOTED", "WON", "LOST"];
export const SOURCE_LABEL: Record<LeadSource, string> = { WEB: "Web form", WHATSAPP: "WhatsApp", CALL: "Call" };
export const SYSTEM_LABEL: Record<SystemType, string> = { ON_GRID: "On-Grid", OFF_GRID: "Off-Grid" };
export const SURVEY_LABEL: Record<SurveyStatus, string> = {
  SCHEDULED: "Scheduled", SUBMITTED: "Submitted", APPROVED: "Approved", REJECTED: "Rejected",
};
export const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Same rule as the server: 10 digits starting 6-9, optional +91, spaces/dashes ignored. Returns null if invalid. */
export function cleanPhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** Shared enquiry-field validation for the staff form and the public form. Returns field → message. */
export function validateEnquiry(f: { name: string; phone: string; address: string; kw: string; monthlyBill: string }) {
  const errors: Record<string, string> = {};
  if (f.name.trim().length < 2) errors.name = "Enter the customer's name";
  if (!cleanPhone(f.phone)) errors.phone = "Enter a valid 10-digit mobile number";
  if (f.address.trim().length < 5) errors.address = "Enter the full address";
  const kw = Number(f.kw);
  if (!(kw >= 1 && kw <= 5)) errors.kw = "System size must be 1 to 5 kW";
  const bill = Number(f.monthlyBill);
  if (!(bill >= 1 && bill <= 1_000_000)) errors.monthlyBill = "Enter the monthly electricity bill";
  return errors;
}
