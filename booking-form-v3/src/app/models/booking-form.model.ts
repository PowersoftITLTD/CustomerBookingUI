// ═══════════════════════════════════════════════════
// 25 SOUTH — BOOKING FORM MODELS
// ═══════════════════════════════════════════════════

export interface Applicant {
  title: string; firstName: string; middleName: string; lastName: string;
  relation: string; dob: string; anniversary: string; pan: string; occupation: string;
}

export interface FlatDetails {
  projectName: string; wing: string; flatNo: string; floor: string;
  configuration: string; bhkType: string; reraCarpet: string; alongWithArea: string;
  cpNo: string; cpLevel: string; cpType: string;
  saleValue: string; saleValueWords: string; endUse: 'Self Use' | 'Investment' | '';
}

export interface PaymentDetails {
  chequeNo: string; dated: string; amount: string;
  amountWords: string; drawnOn: string; costSheetRef: string;
}

export interface FundingDetails {
  loanOpted: 'Yes' | 'No' | 'Not Yet Decided' | '';
  bankName: string; bankContact: string; ownContrib: string; homeLoan: string;
}

export interface ChannelPartner {
  applicable: boolean; name: string; contact: string; mobile: string;
  landline: string; email: string; remarks: string;
  rera: string; gst: string; brokerage: string;
}

export interface Reference {
  type: string; name: string; contact: string;
  email: string; property: string; apartment: string;
}

export interface Section1 {
  applicationDate: string;
  applicants: Applicant[];
  residenceAddress: string; correspondenceAddress: string;
  ownership: string; otherProp: string; otherPropCity: string;
  profession: string; organization: string; designation: string;
  officeAddress: string; businessCard: boolean;
  mobile: string; residencePhone: string; officePhone: string; email: string;
  residentialStatus: string; nriCountry: string;
  localContactNo: string; localContactPerson: string;
  flat: FlatDetails;
  payment: PaymentDetails;
  funding: FundingDetails;
  source: string[]; sourceOther: string;
  channelPartner: ChannelPartner;
  reference: Reference;
  tncAccepted: boolean;
  signatures: { [key: string]: string };
  photos: { [key: string]: string };
}

export interface FamilyMember {
  relation: string; name: string; age: string; livingTogether: string;
  maritalStatus: string; occupation: string; placeOfOccupation: string;
}

export interface Section3 {
  householdCount: string; family: FamilyMember[];
  fitness: string[]; fitnessOther: string;
  sports: string[]; sportsOther: string;
  events: string[]; eventsOther: string;
  music: string[]; musicOther: string;
  internet: string[]; internetOther: string; lastApps: string;
  kidsActivities: string[]; kidsOther: string;
  travelAbroad: string; carsDriven: string;
  clubMembership: string; clubNames: string;
  socialMedia: string[]; socialOther: string;
}

export interface KycDocument {
  ticked: boolean; fileName?: string; fileType?: string;
  fileSize?: number; fileData?: string;
}

export interface ApplicantKyc {
  pan?: KycDocument; aadhar?: KycDocument; dl?: KycDocument;
  passport?: KycDocument; voter?: KycDocument;
  addrPassport?: KycDocument; addrAadhar?: KycDocument; addrDl?: KycDocument;
  addrVoter?: KycDocument; electricity?: KycDocument; mtnl?: KycDocument; bank?: KycDocument;
  nriPassport?: KycDocument; pio?: KycDocument; oci?: KycDocument;
  companyPan?: KycDocument; boardResolution?: KycDocument;
  incorporation?: KycDocument; moaAoa?: KycDocument;
}

export interface Section4 { applicants: ApplicantKyc[]; }

export interface BookingFormPayload {
  section1: Section1; section3: Section3; section4: Section4;
  submittedAt: string; formVersion: string;
  // Set when editing an existing record — triggers UPDATE instead of CREATE
  editBookingId?:  string;
  editCustomerId?: string;
}

export interface NetSuiteAttachment {
  uid: string; label: string; applicantIndex: number;
  documentType: string; fileName: string; fileType: string; fileData: string;
}

// ── NS Config injected by Suitelet ──
export interface NSConfig {
  suiteletUrl: string;
  userId:      string;
  userName:    string;
  role:        string;
  subsidiary:  string;
}

// ── Booking Record — returned by suitelet search & load ──────────────────────
// Used by the CustomerSearch combo to populate the form from an existing record.
export interface BookingRecord {
  // Identifiers
  bookingId:    string;
  customerId:   string;

  // Combo display label — pre-built server-side e.g. "John Doe · Wing A-101"
  displayLabel: string;
  customerName: string;

  // Search-result card fields
  mobile:       string;
  email:        string;
  projectName:  string;
  wing:         string;
  flatNo:       string;

  // Full data — populated by loadBookingRecord()
  section1?: Section1;
  section3?: Section3;

  // File Cabinet IDs of previously uploaded KYC docs — shown in Section4 UI
  existingFiles?: ExistingKycFiles;
}

// ── KYC file IDs stored on the booking record (per applicant) ────────────────
// Populated when loading an existing record — tells Section4 which docs
// were previously uploaded so they can be shown in the UI.
export interface KycFileIds {
  pan?:      string;
  aadhar?:   string;
  dl?:       string;
  passport?: string;
  voter?:    string;
  addr?:     string;   // first address proof on file
  sig?:      string;
  photo?:    string;
}

export interface ExistingKycFiles {
  applicants: KycFileIds[];   // index 0–3
}
