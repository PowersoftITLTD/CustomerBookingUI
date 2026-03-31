import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, filter } from 'rxjs/operators';
import { BookingFormService } from '../../services/booking-form.service';
import { NetsuiteService, MobileCheckResult } from '../../services/netsuite.service';
import { Section1 } from '../../models/booking-form.model';

@Component({
  selector: 'app-section1',
  templateUrl: './section1.component.html'
})
export class Section1Component implements OnInit, OnDestroy {

  @Output() applicantType = new EventEmitter();


  form!: Section1;
  showErrors:boolean = false;
  expandedApplicants:boolean[] = [];
  applicantAccessWarning = '';
  touchedMobile = false;
  touchedEmail = false;
  touchedPan: Record<number, boolean> = {};
  touchedFunding: Record<'bankName' | 'ownContrib' | 'homeLoan', boolean> = {
    bankName: false,
    ownContrib: false,
    homeLoan: false
  };
  touchedNri: Record<'nriCountry' | 'localContactNo' | 'localContactPerson', boolean> = {
    nriCountry: false,
    localContactNo: false,
    localContactPerson: false
  };

  titles         = ['Mr.','Mrs.','Ms.','Dr.','Prof.'];
  configurations = ['1 BHK','2 BHK','3 BHK','4 BHK','5 BHK','Penthouse','Studio','Duplex'];
  cpTypes        = ['Open','Covered','Mechanical'];
  sourceOptions  = [
    'Newspaper','Hoardings','Website','Magazine','E-Mailers','SMS',
    'Exhibition','Channel Partner','Passing By','Reference','Existing Customer'
  ];

  // ── Mobile duplicate check state ──────────────────────────────────────
  mobileCheckState: 'idle' | 'checking' | 'duplicate' | 'ok' = 'idle';
  mobileDuplicateMatches: Array<{ customerId: string; customerName: string; mobile: string }> = [];

  private mobile$       = new Subject<string>();
  private mobileSub!:    Subscription;

  constructor(
    public  svc: BookingFormService,
    private ns:  NetsuiteService
  ) {}

  ngOnInit() {

    this.svc.section1$.subscribe(s => {
      this.form = s;
      this.syncApplicantExpandedState();
      if (!this.form.residentialStatus) {
        this.patch('residentialStatus', 'Resident Indian');
      }
    });

    this.setupMobileCheck();
  }

  ngOnDestroy() {
    this.mobileSub?.unsubscribe();
  }

  // ── Wire up the debounced mobile duplicate check ────────────────────────
  // Fires 700 ms after the user stops typing, only when the number looks
  // like a valid Indian mobile (10 digits, optionally prefixed with +91/0).
  private setupMobileCheck(): void {
    this.mobileSub = this.mobile$.pipe(
      debounceTime(700),
      distinctUntilChanged(),
      filter(v => this.looksLikeMobile(v)),
      switchMap(mobile => {
        this.mobileCheckState = 'checking';
        return this.ns.checkMobileDuplicate(mobile);
      })
    ).subscribe({
      next: (result: MobileCheckResult) => {
        if (result.exists) {
          this.mobileCheckState       = 'duplicate';
          this.mobileDuplicateMatches = result.matches || (result.customerId ? [{
            customerId:   result.customerId!,
            customerName: result.customerName || 'Existing Customer',
            mobile:       this.form.mobile
          }] : []);
        } else {
          this.mobileCheckState       = 'ok';
          this.mobileDuplicateMatches = [];
        }
      },
      error: () => {
        // Silent fail — never block the user on a check error
        this.mobileCheckState = 'idle';
      }
    });
  }

  /** Mobile is valid only when exactly 10 digits. */
  private looksLikeMobile(v: string): boolean {
    const digits = (v || '').replace(/\D/g, '');
    return /^\d{10}$/.test(digits);
  }

  // ── Called on every keystroke on the mobile field ──────────────────────
  onMobileInput(value: string): void {
    this.touchedMobile = true;
    const digits = (value || '').replace(/\D/g, '').slice(0, 10);
    this.patch('mobile', digits);
    // Reset state immediately on new input so stale "ok"/"duplicate" clears
    this.mobileCheckState       = digits.length === 10 ? 'checking' : 'idle';
    this.mobileDuplicateMatches = [];
    this.mobile$.next(digits);
  }

  onMobileBlur(): void {
    this.touchedMobile = true;
  }

  onEmailInput(value: string): void {
    this.touchedEmail = true;
    this.patch('email', value);
  }

  onEmailBlur(): void {
    this.touchedEmail = true;
  }

  onPanInput(i: number, value: string): void {
    this.touchedPan[i] = true;
    const pan = (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    this.patchApplicant(i, 'pan', pan);
  }

  onPanBlur(i: number): void {
    this.touchedPan[i] = true;
  }

  onFundingInput(field: 'bankName' | 'ownContrib' | 'homeLoan', value: string): void {
    this.touchedFunding[field] = true;
    this.patchFunding(field, value);
  }

  onFundingBlur(field: 'bankName' | 'ownContrib' | 'homeLoan'): void {
    this.touchedFunding[field] = true;
  }

  onNriInput(field: 'nriCountry' | 'localContactNo' | 'localContactPerson', value: string): void {
    this.touchedNri[field] = true;
    this.patch(field, value);
  }

  onNriBlur(field: 'nriCountry' | 'localContactNo' | 'localContactPerson'): void {
    this.touchedNri[field] = true;
  }

  // ── Existing patch helpers ─────────────────────────────────────────────
  patch(field: string, value: any)        {
    this.applicantType.emit(value);
     this.svc.updateSection1({ [field]: value } as any);
     }
  patchFlat(f: string, v: any)            { this.svc.updateSection1({ flat:          { ...this.form.flat,          [f]: v } }); }
  patchPayment(f: string, v: any)         { this.svc.updateSection1({ payment:       { ...this.form.payment,       [f]: v } }); }
  patchFunding(f: string, v: any)         { this.svc.updateSection1({ funding:       { ...this.form.funding,       [f]: v } }); }
  patchCP(f: string, v: any)              { this.svc.updateSection1({ channelPartner:{ ...this.form.channelPartner,[f]: v } }); }
  patchApplicant(i: number, f: string, v: any) { this.svc.updateApplicant(i, { [f]: v } as any); }

  toggleSource(o: string) {
    const s = [...this.form.source];
    const i = s.indexOf(o); i >= 0 ? s.splice(i,1) : s.push(o);
    this.patch('source', s);
  }
  isSourceOn(o: string) { return this.form.source.includes(o); }

  trackByIndex(index: number): number { return index; }

  private syncApplicantExpandedState(): void {
    const n = this.form?.applicants?.length || 0;
    if (this.expandedApplicants.length === 0 && n > 0) {
      // Show applicant 1 details immediately for easier form-filling.
      this.expandedApplicants = [true];
    }
    while (this.expandedApplicants.length < n) this.expandedApplicants.push(false);
    if (this.expandedApplicants.length > n) this.expandedApplicants = this.expandedApplicants.slice(0, n);
  }

  addNextApplicant(): void {
    const n = this.form?.applicants?.length || 0;
    if (n >= 4) return;
    if (!this.isApplicantComplete(n - 1)) {
      this.showErrors = true;
      this.applicantAccessWarning = `Please complete Applicant ${n} details before proceeding to Applicant ${n + 1}.`;
      this.expandedApplicants[n - 1] = true;
      return;
    }

    this.svc.addApplicant();
    this.applicantAccessWarning = '';

    const newIdx = n; // newly appended applicant index
    this.syncApplicantExpandedState();
    while (this.expandedApplicants.length <= newIdx) this.expandedApplicants.push(false);
    this.expandedApplicants[newIdx] = true;
  }

  removeApplicant(i: number, ev?: MouseEvent): void {
    ev?.stopPropagation();
    if (i <= 0) return; // never remove applicant 1
    this.svc.removeApplicant(i);
  }

  toggleApplicant(i: number) {
    if (i > 0 && !this.isApplicantComplete(i - 1)) {
      this.showErrors = true;
      this.applicantAccessWarning = `Please complete Applicant ${i} details before proceeding to Applicant ${i + 1}.`;
      this.syncApplicantExpandedState();
      this.expandedApplicants[i - 1] = true;
      return;
    }
    this.applicantAccessWarning = '';
    this.syncApplicantExpandedState();
    while (this.expandedApplicants.length <= i) this.expandedApplicants.push(false);
    this.expandedApplicants[i] = !this.expandedApplicants[i];
  }
  toggleTnc() { this.patch('tncAccepted', !this.form.tncAccepted); }

  onPhotoSelected(idx: number, url: string) {
    this.svc.updateSection1({ photos: { ...this.form.photos, [`applicant${idx+1}`]: url } });
  }
  onPhotoCleared(idx: number) {
    const p = { ...this.form.photos }; delete p[`applicant${idx+1}`];
    this.svc.updateSection1({ photos: p });
  }
  onSigned(key: string, url: string) {

    console.log('key: ', key, 'url: ', url);
    console.log('Check form: ', this.form);
    this.svc.updateSection1({ signatures: { ...this.form.signatures, [key]: url } });
  }
  onSignatureCleared(key: string) {
    const s = { ...this.form.signatures }; delete s[key];
    this.svc.updateSection1({ signatures: s });
  }


  getValidationState(): { firstInvalidFieldId: string | null; missingFieldNames: string[] } {
    this.showErrors = true;
    const missing: Array<{ id: string; label: string }> = [];

    if (!this.form.residenceAddress?.trim()) missing.push({ id: 'residential-address', label: 'Residence Address' });
    if (!this.isMobileValid()) missing.push({ id: 'residential-mobile', label: 'Mobile Number (10 digits)' });
    if (!this.isEmailValid()) missing.push({ id: 'residential-email', label: 'Email Address (valid format)' });

    if (this.form.funding.loanOpted === 'Yes') {
      if (!this.form.funding.bankName?.trim()) missing.push({ id: 'funding-bankName', label: 'Bank / FI Name' });
      if (!this.form.funding.ownContrib?.trim()) missing.push({ id: 'funding-ownContrib', label: 'Own Contribution %' });
      if (!this.form.funding.homeLoan?.trim()) missing.push({ id: 'funding-homeLoan', label: 'Home Loan %' });
    }

    if (this.isNriSelected()) {
      if (!this.form.nriCountry?.trim()) missing.push({ id: 'nri-country', label: 'Country' });
      if (!this.form.localContactNo?.trim()) missing.push({ id: 'nri-localContactNo', label: 'Local Contact Number' });
      if (!this.form.localContactPerson?.trim()) missing.push({ id: 'nri-localContactPerson', label: 'Local Contact Person' });
    }

    (this.form.applicants || []).forEach((_, idx) => {
      missing.push(...this.getApplicantMissingFields(idx));
    });

    const cp = this.form.channelPartner;
    if (cp.applicable) {
      if (!cp.name?.trim()) missing.push({ id: 'cp-name', label: 'Channel Partner Name' });
      if (!cp.mobile?.trim()) missing.push({ id: 'cp-mobile', label: 'Channel Partner Mobile' });
      if (!cp.email?.trim()) missing.push({ id: 'cp-email', label: 'Channel Partner Email' });
      if (!cp.rera?.trim()) missing.push({ id: 'cp-rera', label: 'Channel Partner RERA' });
      if (!cp.gst?.trim()) missing.push({ id: 'cp-gst', label: 'Channel Partner GST' });
      if (!cp.brokerage?.trim()) missing.push({ id: 'cp-brokerage', label: 'Channel Partner Brokerage' });
      if (!this.form.signatures?.['channelPartner']) missing.push({ id: 'cp-signature-section', label: 'Channel Partner Signature' });
    }

    // Applicant 1 Photo & Signature — both mandatory
    if (!this.form.photos?.['applicant1']) {
      missing.push({ id: 'photo-sig-section', label: 'Applicant 1 Photograph' });
    }
    if (!this.form.signatures?.['applicant1']) {
      missing.push({ id: 'photo-sig-section', label: 'Applicant 1 Signature' });
    }

    return {
      firstInvalidFieldId: missing.length ? missing[0].id : null,
      missingFieldNames: missing.map(m => m.label)
    };
  }

  private getApplicantMissingFields(index: number): Array<{ id: string; label: string }> {
    const a = this.form.applicants[index];
    if (!a) return [];
    const applicantNo = index + 1;
    const missing: Array<{ id: string; label: string }> = [];

    if (!a.title?.trim()) missing.push({ id: `applicant-${index}-title`, label: `Applicant ${applicantNo} Title` });
    if (!a.firstName?.trim()) missing.push({ id: `applicant-${index}-firstName`, label: `Applicant ${applicantNo} First Name` });
    if (!a.lastName?.trim()) missing.push({ id: `applicant-${index}-lastName`, label: `Applicant ${applicantNo} Last Name` });
    // DOB is optional — removed from required fields
    if (!this.isPanValid(a.pan)) missing.push({ id: `applicant-${index}-pan`, label: `Applicant ${applicantNo} PAN (valid format)` });

    return missing;
  }

  isApplicantComplete(index: number): boolean {
    return this.getApplicantMissingFields(index).length === 0;
  }

  isApplicantFieldInvalid(index: number, field: 'title' | 'firstName' | 'lastName' | 'pan'): boolean {
    if (field === 'pan') {
      if (!this.showErrors && !this.touchedPan[index]) return false;
      const a = this.form?.applicants?.[index];
      if (!a) return false;
      return !this.isPanValid(a.pan);
    }

    if (!this.showErrors) return false;
    const a = this.form?.applicants?.[index];
    if (!a) return false;
    return !(a[field] || '').trim();
  }

  isMobileValid(): boolean {
    return /^\d{10}$/.test((this.form?.mobile || '').trim());
  }

  isEmailValid(): boolean {
    const email = (this.form?.email || '').trim();
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  isPanValid(pan?: string): boolean {
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test((pan || '').trim());
  }

  showMobileValidationError(): boolean {
    return (this.showErrors || this.touchedMobile) && !this.isMobileValid();
  }

  showEmailValidationError(): boolean {
    return (this.showErrors || this.touchedEmail) && !this.isEmailValid();
  }

  isNriSelected(): boolean {
    return ['NRI', 'PIO', 'OCI'].includes(this.form?.residentialStatus || '');
  }

  isFundingFieldInvalid(field: 'bankName' | 'ownContrib' | 'homeLoan'): boolean {
    if (this.form?.funding?.loanOpted !== 'Yes') return false;
    if (!this.showErrors && !this.touchedFunding[field]) return false;
    return !(this.form?.funding?.[field] || '').trim();
  }

  isNriFieldInvalid(field: 'nriCountry' | 'localContactNo' | 'localContactPerson'): boolean {
    if (!this.isNriSelected()) return false;
    if (!this.showErrors && !this.touchedNri[field]) return false;
    return !(this.form?.[field] || '').trim();
  }

  revealField(fieldId: string): void {
    const match = /^applicant-(\d+)-/.exec(fieldId || '');
    if (!match) return;
    const idx = Number(match[1]);
    if (Number.isNaN(idx)) return;
    this.syncApplicantExpandedState();
    while (this.expandedApplicants.length <= idx) this.expandedApplicants.push(false);
    this.expandedApplicants[idx] = true;
  }

//   isChannelPartnerValid(): boolean {

//      this.showErrors = true;

//      console.log('check errors: ', this.showErrors);
//   if (!this.form.channelPartner.applicable) {
//     return true; // not required if No
//   }

//   const cp = this.form.channelPartner;

//   return !!(
//     cp.name &&
//     cp.mobile &&
//     cp.email &&
//     cp.rera &&
//     cp.gst &&
//     cp.brokerage
//   );
// }

  /** Expose to template for submit guard */
  get isMobileDuplicate(): boolean { return this.mobileCheckState === 'duplicate'; }
}
