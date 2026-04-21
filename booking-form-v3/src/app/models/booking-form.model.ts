export interface Applicant {
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  relation: string;
  dob: string;
  anniversary: string;
  pan: string;
  aadharNumber: string;
  passportNumber: string;
  phoneNumber: string;
  whatsappNumber: string;
  email: string;
  residenceAddress: string;
  correspondenceAddress: string;
  occupation: string;
  designation: string;
  residentialStatus?: string;
  nriCountry?: string;
  localContactNo?: string;
  localContactPerson?: string;
}

export interface FlatDetails {
  projectName: string;
  wing: string;
  flatNo: string;
  floor: string;
  configuration: string;
  bhkType: string;
  reraCarpet: string;
  alongWithArea: string;
  cpNo: string;
  cpLevel: string;
  cpType: string;
  saleValue: string;
  saleValueWords: string;
  endUse: 'Self Use' | 'Investment' | '';
}

export interface PaymentDetails {
  chequeNo: string;
  dated: string;
  amount: string;
  amountWords: string;
  drawnOn: string;
  costSheetRef: string;
}

export interface FundingDetails {
  loanOpted: 'Yes' | 'No' | 'Not Yet Decided' | '';
  bankName: string;
  bankContact: string;
  ownContrib: string;
  homeLoan: string;
}

export interface ChannelPartner {
  applicable: boolean;
  name: string;
  contact: string;
  mobile: string;
  landline: string;
  email: string;
  remarks: string;
  rera: string;
  gst: string;
  brokerage: string;
  sig?: string | null;
}

export interface Reference {
  type: string;
  name: string;
  contact: string;
  email: string;
  property: string;
  apartment: string;
}

export interface Section1 {
  applicationDate: string;
  applicants: Applicant[];
  residenceAddress: string;
  correspondenceAddress: string;
  ownership: string;
  otherProp: string;
  otherPropCity: string;
  profession: string;
  organization: string;
  designation: string;
  officeAddress: string;
  businessCard: boolean;
  mobile: string;
  whatsappNumber: string;
  residencePhone: string;
  officePhone: string;
  email: string;
  residentialStatus: string;
  nriCountry: string;
  localContactNo: string;
  localContactPerson: string;
  flat: FlatDetails;
  payment: PaymentDetails;
  funding: FundingDetails;
  source: string[];
  sourceOther: string;
  channelPartner: ChannelPartner;
  reference: Reference;
  tncAccepted: boolean;
  signatures: Record<string, string>;
  photos: Record<string, string>;
}

export interface FamilyMember {
  relation: string;
  name: string;
  age: string;
  livingTogether: string;
  maritalStatus: string;
  occupation: string;
  placeOfOccupation: string;
}

export interface Section3 {
  householdCount: string;
  family: FamilyMember[];
  fitness: string[];
  fitnessOther: string;
  sports: string[];
  sportsOther: string;
  events: string[];
  eventsOther: string;
  music: string[];
  musicOther: string;
  internet: string[];
  internetOther: string;
  lastApps: string;
  kidsActivities: string[];
  kidsOther: string;
  travelAbroad: string;
  carsDriven: string;
  clubMembership: string;
  clubNames: string;
  socialMedia: string[];
  socialOther: string;
}

export interface KycDocument {
  ticked: boolean;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  fileData?: string;
}

export interface ApplicantKyc {
  pan?: KycDocument;
  aadhar?: KycDocument;
  dl?: KycDocument;
  passport?: KycDocument;
  voter?: KycDocument;
  addrPassport?: KycDocument;
  addrAadhar?: KycDocument;
  addrDl?: KycDocument;
  addrVoter?: KycDocument;
  electricity?: KycDocument;
  mtnl?: KycDocument;
  bank?: KycDocument;
  nriPassport?: KycDocument;
  pio?: KycDocument;
  oci?: KycDocument;
  companyPan?: KycDocument;
  boardResolution?: KycDocument;
  incorporation?: KycDocument;
  moaAoa?: KycDocument;
}

export interface Section4 {
  applicants: ApplicantKyc[];
}

export interface BookingFormPayload {
  section1: Section1;
  section3: Section3;
  section4: Section4;
  existingFiles?: ExistingKycFiles;
  submittedAt: string;
  formVersion: string;
  editBookingId?: string;
  displayLabel?: string;
  customerName?: string;
  mobile?: string;
  email?: string;
  projectName?: string;
  wing?: string;
  flatNo?: string;
  [key: string]: unknown;
}

export interface NetSuiteAttachment {
  uid: string;
  label: string;
  applicantIndex: number;
  documentType: string;
  fileName: string;
  fileType: string;
  fileData: string;
}

export interface NSConfig {
  suiteletUrl: string;
  userId: string;
  userName: string;
  role: string;
  subsidiary: string;
}

export interface BookingRecord {
  bookingId: string;
  displayLabel: string;
  customerName: string;
  mobile: string;
  email: string;
  projectName: string;
  wing: string;
  flatNo: string;
  section1?: Section1;
  section3?: Section3;
  existingFiles?: ExistingKycFiles;
  nsData?: NetSuiteRecord;
}

export interface KycFileIds {
  pan?: string | null;
  aadhar?: string | null;
  dl?: string | null;
  passport?: string | null;
  voter?: string | null;
  addr?: string | null;
  sig?: string | null;
  photo?: string | null;
  aadharcard?: string | null;
  drivinglicense?: string | null;
  voterIid?: string | null;
  electricitybill?: string | null;
  mtnlbill?: string | null;
  bankstatement?: string | null;
  companypan?: string | null;
  boardresolution?: string | null;
  inccertificate?: string | null;
  moaaoa?: string | null;
}

export interface ExistingKycFiles {
  applicants: KycFileIds[];
}

export interface NetSuiteCustomer {
  firstName: string;
  middleName: string;
  lastName: string;
  email?: string;
  title?: string;
  relation?: string;
  dob?: string;
  anniversary?: string;
  pan?: string;
  aadharNumber?: string;
  passportNumber?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  occupation?: string;
  designation?: string;
  mobile?: string;
  residenceAddress?: string;
  correspondenceAddress?: string;
  residentialStatus?: string;
  nriCountry?: string;
  localContactNo?: string;
  localContactPerson?: string;
  profession?: string;
  organization?: string;
}

export interface NetSuiteCarPark {
  level: string;
  number: string;
  type: string;
}

export interface NetSuiteArea {
  sqMeter: string;
  sqFeet: string;
}

export interface NetSuiteRecord {
  costsheetId: string;
  project: string;
  wing: string;
  flatNo: string;
  floor: string;
  amount: number | string;
  customers: NetSuiteCustomer[];
  carParks: NetSuiteCarPark[];
  areas: NetSuiteArea[];
  configuration?: string;
  bhkType?: string;
  endUse?: string;
  saleValueWords?: string;
  mobile?: string;
  whatsappNumber?: string;
  email?: string;
  residenceAddress?: string;
  correspondenceAddress?: string;
  ownership?: string;
  profession?: string;
  organization?: string;
  designation?: string;
  residentialStatus?: string;
  nriCountry?: string;
  localContactNo?: string;
  localContactPerson?: string;
  chequeNo?: string;
  paymentDate?: string;
  paymentAmountWords?: string;
  drawnOn?: string;
  loanOpted?: string;
  bankName?: string;
  ownContrib?: string;
  homeLoan?: string;
  source?: string[];
  sourceOther?: string;
  channelPartner?: {
    applicable: boolean;
    name: string;
    contact: string;
    mobile: string;
    landline: string;
    email: string;
    remarks: string;
    rera: string;
    gst: string;
    brokerage: string;
    sig: string | null;
  };
  tncAccepted?: boolean;
}
