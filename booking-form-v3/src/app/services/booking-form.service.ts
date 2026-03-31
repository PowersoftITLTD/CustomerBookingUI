import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  BookingFormPayload, Section1, Section3, Section4,
  Applicant, FamilyMember, ApplicantKyc, BookingRecord, ExistingKycFiles
} from '../models/booking-form.model';

const EMPTY_APPLICANT = (): Applicant => ({
  title: '', firstName: '', middleName: '', lastName: '',
  relation: '', dob: '', anniversary: '', pan: '', occupation: ''
});

const EMPTY_SECTION1 = (): Section1 => ({
  applicationDate: new Date().toISOString().split('T')[0],
  applicants: [EMPTY_APPLICANT()],
  residenceAddress: '', correspondenceAddress: '',
  ownership: '', otherProp: '', otherPropCity: '',
  profession: '', organization: '', designation: '',
  officeAddress: '', businessCard: false,
  mobile: '', residencePhone: '', officePhone: '', email: '',
  residentialStatus: 'Resident Indian', nriCountry: '', localContactNo: '', localContactPerson: '',
  flat: {
    projectName: '', wing: '', flatNo: '', floor: '', configuration: '', bhkType: '',
    reraCarpet: '', alongWithArea: '', cpNo: '', cpLevel: '', cpType: '',
    saleValue: '', saleValueWords: '', endUse: ''
  },
  payment: { chequeNo: '', dated: '', amount: '', amountWords: '', drawnOn: '', costSheetRef: '' },
  funding: { loanOpted: '', bankName: '', bankContact: '', ownContrib: '', homeLoan: '' },
  source: [], sourceOther: '',
  channelPartner: {
    applicable: false, name: '', contact: '', mobile: '', landline: '',
    email: '', remarks: '', rera: '', gst: '', brokerage: ''
  },
  reference: { type: '', name: '', contact: '', email: '', property: '', apartment: '' },
  tncAccepted: false,
  signatures: {}, photos: {}
});

const EMPTY_SECTION3 = (): Section3 => ({
  householdCount: '1',
  family: [
    { relation: 'Self',     name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
    { relation: 'Spouse',   name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
    { relation: 'Child 1',  name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
    { relation: 'Child 2',  name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
    { relation: 'Parent 1', name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
    { relation: 'Parent 2', name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
  ],
  fitness: [], fitnessOther: '', sports: [], sportsOther: '',
  events: [], eventsOther: '', music: [], musicOther: '',
  internet: [], internetOther: '', lastApps: '',
  kidsActivities: [], kidsOther: '',
  travelAbroad: '', carsDriven: '',
  clubMembership: '', clubNames: '',
  socialMedia: [], socialOther: ''
});

const EMPTY_SECTION4 = (): Section4 => ({
  applicants: [{}] as ApplicantKyc[]
});

@Injectable({ providedIn: 'root' })
export class BookingFormService {

  private _s1 = new BehaviorSubject<Section1>(EMPTY_SECTION1());
  private _s3 = new BehaviorSubject<Section3>(EMPTY_SECTION3());
  private _s4 = new BehaviorSubject<Section4>(EMPTY_SECTION4());
  private _step = new BehaviorSubject<number>(1);

  // ── Edit mode tracking ───────────────────────────────────────────
  // Set when a booking record is loaded via the CustomerSearch combo.
  // Cleared on reset(). Used by buildFullPayload() to switch action
  // from 'create' to 'update' and include the record IDs.
  private _editBookingId:  string | null = null;
  private _editCustomerId: string | null = null;
  private _existingFiles:  ExistingKycFiles | null = null;

  section1$ = this._s1.asObservable();
  section3$ = this._s3.asObservable();
  section4$ = this._s4.asObservable();
  currentStep$ = this._step.asObservable();

  get section1()        { return this._s1.getValue(); }
  get section3()        { return this._s3.getValue(); }
  get section4()        { return this._s4.getValue(); }
  get currentStep()     { return this._step.getValue(); }
  get isEditMode()      { return !!this._editBookingId; }
  get editBookingId()   { return this._editBookingId; }
  get editCustomerId()  { return this._editCustomerId; }
  get existingFiles()   { return this._existingFiles; }

  updateSection1(patch: Partial<Section1>) {
    const nextSection1 = { ...this.section1, ...patch };
    this._s1.next(nextSection1);
    this.syncSection4ApplicantCount(nextSection1.applicants?.length || 1);
  }
  updateSection3(patch: Partial<Section3>) { this._s3.next({ ...this.section3, ...patch }); }
  updateSection4(patch: Partial<Section4>) { this._s4.next({ ...this.section4, ...patch }); }

  updateApplicant(index: number, patch: Partial<Applicant>) {
    const applicants = [...this.section1.applicants];
    applicants[index] = { ...applicants[index], ...patch };
    this.updateSection1({ applicants });
  }

  addApplicant(): void {
    const applicants = [...(this.section1.applicants || [])];
    if (applicants.length >= 4) return;
    applicants.push(EMPTY_APPLICANT());
    this.updateSection1({ applicants });
  }

  removeApplicant(index: number): void {
    const applicants = [...(this.section1.applicants || [])];
    if (index <= 0) return; // never remove applicant 1
    if (index >= applicants.length) return;

    applicants.splice(index, 1);

    const photos = this.reindexApplicantMediaMap(this.section1.photos || {}, index);
    const signatures = this.reindexApplicantMediaMap(this.section1.signatures || {}, index);

    const section4Applicants = [...(this.section4.applicants || [])];
    if (index < section4Applicants.length) {
      section4Applicants.splice(index, 1);
    }
    const safeCount = Math.max(1, applicants.length);
    while (section4Applicants.length < safeCount) section4Applicants.push({});
    if (section4Applicants.length > safeCount) section4Applicants.length = safeCount;

    if (this._existingFiles?.applicants) {
      const shifted = [...this._existingFiles.applicants];
      if (index < shifted.length) shifted.splice(index, 1);
      while (shifted.length < safeCount) shifted.push({});
      if (shifted.length > safeCount) shifted.length = safeCount;
      this._existingFiles = { ...this._existingFiles, applicants: shifted as any };
    }

    this.updateSection1({ applicants, photos, signatures });
    this.updateSection4({ applicants: section4Applicants as ApplicantKyc[] });
  }

  updateKycDocument(appIdx: number, field: string, docData: any) {
    const applicants = [...this.section4.applicants];
    applicants[appIdx] = { ...applicants[appIdx], [field]: docData };
    this.updateSection4({ applicants });
  }

  isApplicant1PanUploaded(): boolean {
    const panDoc = (this.section4.applicants || [])[0]?.pan;
    if (panDoc?.fileData) return true;
    return !!this._existingFiles?.applicants?.[0]?.pan;
  }

  goToStep(step: number) { if (step >= 1 && step <= 3) this._step.next(step); }

  buildFullPayload(): BookingFormPayload {
    const payload: BookingFormPayload = {
      section1: this.section1, section3: this.section3, section4: this.section4,
      submittedAt: new Date().toISOString(), formVersion: '5.0'
    };
    // If editing an existing record, include IDs so suitelet does UPDATE not CREATE
    if (this._editBookingId)  payload.editBookingId  = this._editBookingId;
    if (this._editCustomerId) payload.editCustomerId = this._editCustomerId;
    return payload;
  }

  saveDraft() {
    try {
      sessionStorage.setItem('bf_s1', JSON.stringify(this.section1));
      sessionStorage.setItem('bf_s3', JSON.stringify(this.section3));
      sessionStorage.setItem('bf_s4', JSON.stringify(this.section4));
    } catch (e) { console.warn('Draft save failed', e); }
  }

  loadDraft(): boolean {
    try {
      const s1 = sessionStorage.getItem('bf_s1');
      const s3 = sessionStorage.getItem('bf_s3');
      const s4 = sessionStorage.getItem('bf_s4');
      if (s1) this._s1.next(JSON.parse(s1));
      if (s3) this._s3.next(JSON.parse(s3));
      if (s4) this._s4.next(JSON.parse(s4));
      this.syncSection4ApplicantCount(this.section1.applicants?.length || 1);
      return !!(s1 || s3 || s4);
    } catch (e) { return false; }
  }

  // ── Check if the form has any user-entered data ──────────────────
  // Used by CustomerSearch to decide whether to show the overwrite confirmation.
  hasUnsavedData(): boolean {
    const s1 = this.section1;
    return !!(
      s1.mobile ||
      s1.email  ||
      s1.applicants[0]?.firstName ||
      s1.flat?.flatNo
    );
  }

  // ── Populate all form sections from a loaded BookingRecord ────────
  // Sets edit mode — subsequent buildFullPayload() sends 'update'.
  loadFromBookingRecord(rec: BookingRecord): void {
    // Track edit mode IDs so submit sends UPDATE not CREATE
    this._editBookingId  = rec.bookingId  || null;
    this._editCustomerId = rec.customerId || null;
    this._existingFiles  = rec.existingFiles || null;

    if (rec.section1) {
      const s1 = rec.section1;
      const apps = s1.applicants || [];
      if (apps.length === 0) {
        s1.applicants = [EMPTY_APPLICANT()];
      } else if (apps.length > 4) {
        s1.applicants = apps.slice(0, 4);
      } else {
        s1.applicants = apps;
      }
      if (!s1.residentialStatus) s1.residentialStatus = 'Resident Indian';
      s1.signatures = {};
      s1.photos     = {};
      this._s1.next(s1);
    }

    if (rec.section3) {
      const s3 = rec.section3;
      while ((s3.family || []).length < 6) {
        (s3.family = s3.family || []).push({
          relation: '', name: '', age: '', livingTogether: '',
          maritalStatus: '', occupation: '', placeOfOccupation: ''
        });
      }
      if (!s3.householdCount) s3.householdCount = '1';
      this._s3.next(s3);
    }

    // KYC file base64 data cannot be round-tripped — existingFiles carries
    // the File Cabinet IDs instead, shown as "Previously uploaded" in Section4
    this._s4.next({ applicants: [{}] as any });

    // Show only applicants that have actual data (firstName filled).
    // Raw array may include empty placeholder objects from NetSuite — filter those out.
    const filledCount = (this.section1.applicants || [])
      .filter((a: any) => a?.firstName?.trim()).length;
    this.syncSection4ApplicantCount(Math.max(1, filledCount));

    this._step.next(1);
    sessionStorage.clear();
  }

  reset() {
    this._s1.next(EMPTY_SECTION1());
    this._s3.next(EMPTY_SECTION3());
    this._s4.next(EMPTY_SECTION4());
    this._step.next(1);
    // Clear edit mode
    this._editBookingId  = null;
    this._editCustomerId = null;
    this._existingFiles  = null;
    sessionStorage.clear();
  }

  private syncSection4ApplicantCount(targetCount: number): void {
    const safeCount = Math.max(1, Math.min(4, targetCount || 1));
    const current = [...(this.section4.applicants || [])];
    if (current.length === safeCount) return;

    if (current.length > safeCount) {
      this.updateSection4({ applicants: current.slice(0, safeCount) as ApplicantKyc[] });
      return;
    }

    while (current.length < safeCount) current.push({});
    this.updateSection4({ applicants: current as ApplicantKyc[] });
  }

  private reindexApplicantMediaMap(
    mediaMap: { [key: string]: string },
    removedIndex: number
  ): { [key: string]: string } {
    const out: { [key: string]: string } = {};
    Object.entries(mediaMap || {}).forEach(([key, value]) => {
      const match = /^applicant(\d+)$/.exec(key);
      if (!match) {
        out[key] = value;
        return;
      }
      const oneBased = Number(match[1]);
      const zeroBased = oneBased - 1;
      if (zeroBased === removedIndex) return;
      if (zeroBased > removedIndex) {
        out[`applicant${oneBased - 1}`] = value;
        return;
      }
      out[key] = value;
    });
    return out;
  }
}
