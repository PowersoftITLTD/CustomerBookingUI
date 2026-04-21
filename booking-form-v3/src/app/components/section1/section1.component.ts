import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs/operators';
import { Applicant, Section1 } from '../../models/booking-form.model';
import { BookingFormService } from '../../services/booking-form.service';
import { MobileCheckResult, NetsuiteService } from '../../services/netsuite.service';

type Section1ValidationField = 'bankName' | 'ownContrib' | 'homeLoan';
type NriField = 'nriCountry' | 'localContactNo' | 'localContactPerson';
type ApplicantField = 'title' | 'firstName' | 'middleName' | 'lastName' | 'pan' | 'occupation' | 'designation' | 'residentialStatus';

@Component({
  selector: 'app-section1',
  templateUrl: './section1.component.html'
})
export class Section1Component implements OnInit, OnDestroy {
  @Output('applicantType') residentialStatusChange = new EventEmitter<string>();

  form!: Section1;
  showErrors = false;
  expandedApplicants: boolean[] = [];
  applicantAccessWarning = '';
  touchedPan: Record<number, boolean> = {};
  touchedAadhar: Record<number, boolean> = {};
  touchedPassport: Record<number, boolean> = {};
  touchedApplicantPhone: Record<number, boolean> = {};
  touchedApplicantEmail: Record<number, boolean> = {};
  touchedApplicantAddress: Record<number, Record<string, boolean>> = {};
  touchedApplicantWhatsapp: Record<number, boolean> = {};
  touchedOccupation: Record<number, boolean> = {};
  touchedDesignation: Record<number, boolean> = {};
  touchedResidentialStatus: Record<number, boolean> = {};
  touchedFunding: Record<Section1ValidationField, boolean> = {
    bankName: false,
    ownContrib: false,
    homeLoan: false
  };
  touchedNri: Record<NriField, boolean> = {
    nriCountry: false,
    localContactNo: false,
    localContactPerson: false
  };

  readonly titles = ['Dr.', 'M/s', 'Mr.', 'Mrs.', 'Ms.', 'Mx.', 'Shree.', 'Smt.'];
  readonly configurations = ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '5 BHK', 'Penthouse', 'Studio', 'Duplex'];
  readonly cpTypes = ['Open', 'Covered', 'Mechanical'];
  readonly professionOptions = ['Accountant', 'amitsibal memo', 'BUSINESS', 'Doctor', 'Professor', 'Software'];
  readonly designationOptions = ['Proprietor', 'Software Developer'];
  readonly sourceOptions = [
    'Newspaper', 'Hoardings', 'Website', 'Magazine', 'E-Mailers', 'SMS',
    'Exhibition', 'Channel Partner', 'Passing By', 'Reference', 'Existing Customer'
  ];
  readonly residentialStatusOptions = ['Resident Indian', 'NRI', 'PIO', 'OCI'];

  mobileCheckState: 'idle' | 'checking' | 'duplicate' | 'ok' = 'idle';
  mobileDuplicateMatches: Array<{ customerId: string; customerName: string; mobile: string }> = [];
  applicantIdentityForms: FormGroup[] = [];

  private readonly mobile$ = new Subject<string>();
  private mobileSub?: Subscription;
  applicantWhatsappSameAsPhone: Record<number, boolean> = {};
  touchedApplicantNri: Record<number, Record<string, boolean>> = {};

  constructor(
    public svc: BookingFormService,
    private readonly netsuiteService: NetsuiteService
  ) {}

  ngOnInit(): void {
    this.svc.section1$.subscribe(section => {
      this.form = section;
      this.syncApplicantExpandedState();
      this.syncApplicantIdentityForms();

      if (!this.form.residentialStatus) {
        this.patch('residentialStatus', 'Resident Indian');
      }
    });

    this.setupMobileCheck();
  }

  ngOnDestroy(): void {
    this.mobileSub?.unsubscribe();
  }

  onPanInput(index: number, value: string): void {
    this.touchedPan[index] = true;
    const pan = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    this.patchApplicant(index, 'pan', pan);
  }

  onPanBlur(index: number): void {
    this.touchedPan[index] = true;
  }

  onAadharInput(index: number, value: string): void {
    this.touchedAadhar[index] = true;
    const digits = this.sanitizeDigits(value, 12);
    this.applicantIdentityForms[index]?.get('aadharNumber')?.setValue(digits, { emitEvent: false });
    this.patchApplicant(index, 'aadharNumber', digits);
  }

  onAadharBlur(index: number): void {
    this.touchedAadhar[index] = true;
    this.applicantIdentityForms[index]?.get('aadharNumber')?.markAsTouched();
  }

  onPassportInput(index: number, value: string): void {
    this.touchedPassport[index] = true;
    const passport = (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9);
    this.applicantIdentityForms[index]?.get('passportNumber')?.setValue(passport, { emitEvent: false });
    this.patchApplicant(index, 'passportNumber', passport);
  }

  onPassportBlur(index: number): void {
    this.touchedPassport[index] = true;
    this.applicantIdentityForms[index]?.get('passportNumber')?.markAsTouched();
  }

  onApplicantPhoneInput(index: number, value: string): void {
    this.touchedApplicantPhone[index] = true;
    const digits = this.sanitizeDigits(value, 10);
    this.applicantIdentityForms[index]?.get('phoneNumber')?.setValue(digits, { emitEvent: false });
    this.patchApplicant(index, 'phoneNumber', digits);

    if (index === 0) {
      this.patch('mobile', digits);
      this.mobileCheckState = digits.length === 10 ? 'checking' : 'idle';
      this.mobileDuplicateMatches = [];
      this.mobile$.next(digits);
    }

    if (this.applicantWhatsappSameAsPhone[index] !== false) {
      this.setApplicantWhatsappValue(index, digits);
    }
  }

  onApplicantPhoneBlur(index: number): void {
    this.touchedApplicantPhone[index] = true;
    this.applicantIdentityForms[index]?.get('phoneNumber')?.markAsTouched();
  }

  onApplicantWhatsappInput(index: number, value: string): void {
    this.touchedApplicantWhatsapp[index] = true;
    const digits = this.sanitizeDigits(value, 10);
    const phoneNumber = this.form?.applicants?.[index]?.phoneNumber || '';

    this.applicantWhatsappSameAsPhone[index] = digits === phoneNumber;
    this.setApplicantWhatsappValue(index, digits);
  }

  onApplicantWhatsappBlur(index: number): void {
    this.touchedApplicantWhatsapp[index] = true;
    this.applicantIdentityForms[index]?.get('whatsappNumber')?.markAsTouched();
  }

  onApplicantEmailInput(index: number, value: string): void {
    this.touchedApplicantEmail[index] = true;
    this.applicantIdentityForms[index]?.get('email')?.setValue(value, { emitEvent: false });
    this.patchApplicant(index, 'email', value);

    if (index === 0) {
      this.patch('email', value);
    }
  }

  onApplicantEmailBlur(index: number): void {
    this.touchedApplicantEmail[index] = true;
    this.applicantIdentityForms[index]?.get('email')?.markAsTouched();
  }

  onApplicantAddressInput(index: number, field: 'residenceAddress' | 'correspondenceAddress', value: string): void {
    if (!this.touchedApplicantAddress[index]) {
      this.touchedApplicantAddress[index] = {};
    }
    this.touchedApplicantAddress[index][field] = true;
    this.applicantIdentityForms[index]?.get(field)?.setValue(value, { emitEvent: false });
    this.patchApplicant(index, field, value);

    if (index === 0) {
      this.patch(field, value);
    }
  }

  onApplicantAddressBlur(index: number, field: string): void {
    if (!this.touchedApplicantAddress[index]) {
      this.touchedApplicantAddress[index] = {};
    }
    this.touchedApplicantAddress[index][field] = true;
    this.applicantIdentityForms[index]?.get(field)?.markAsTouched();
  }

  onApplicantWhatsappSameAsPhoneChange(index: number, checked: boolean): void {
    this.applicantWhatsappSameAsPhone[index] = checked;

    if (checked) {
      this.touchedApplicantWhatsapp[index] = true;
      this.setApplicantWhatsappValue(index, this.form?.applicants?.[index]?.phoneNumber || '');
    } else {
      // Clear WhatsApp when unchecking "Same as mobile"
      this.setApplicantWhatsappValue(index, '');
    }
  }

  onFundingInput(field: Section1ValidationField, value: string): void {
    this.touchedFunding[field] = true;
    this.patchFunding(field, value);
  }

  onFundingBlur(field: Section1ValidationField): void {
    this.touchedFunding[field] = true;
  }

  onNriInput(field: NriField, value: string): void {
    this.touchedNri[field] = true;
    this.patch(field, value);
  }

  onNriBlur(field: NriField): void {
    this.touchedNri[field] = true;
  }

  onApplicantNriStatusChange(index: number, status: string): void {
    this.patchApplicant(index, 'residentialStatus', status);

    // Sync Applicant 1's residential status to form level for NetSuite compatibility
    if (index === 0) {
      this.patch('residentialStatus', status);
    }
  }

  onApplicantNriInput(index: number, field: string, value: string): void {
    this.initApplicantNriTouched(index);
    this.touchedApplicantNri[index][field] = true;
    this.patchApplicant(index, field as keyof Applicant, value);

    // Sync Applicant 1's NRI fields to form level for NetSuite compatibility
    if (index === 0) {
      const fieldMap: Record<string, keyof Section1> = {
        nriCountry: 'nriCountry',
        localContactNo: 'localContactNo',
        localContactPerson: 'localContactPerson'
      };

      const formField = fieldMap[field];
      if (formField) {
        this.patch(formField, value);
      }
    }
  }

  onApplicantNriBlur(index: number, field: string): void {
    this.initApplicantNriTouched(index);
    this.touchedApplicantNri[index][field] = true;
  }

  onApplicantNriNumericInput(index: number, field: string, value: string): void {
    this.onApplicantNriInput(index, field, this.sanitizeDigits(value, 10));
  }

  onApplicantNriTextInput(index: number, field: string, value: string): void {
    this.onApplicantNriInput(index, field, this.sanitizeWords(value));
  }

  private initApplicantNriTouched(index: number): void {
    if (!this.touchedApplicantNri[index]) {
      this.touchedApplicantNri[index] = {
        nriCountry: false,
        localContactNo: false,
        localContactPerson: false
      };
    }
  }

  onFlatNumericInput(field: string, value: string): void {
    this.patchFlat(field, this.sanitizeDigits(value));
  }

  onFlatWordsInput(field: string, value: string): void {
    this.patchFlat(field, this.sanitizeWords(value, true));
  }

  onPaymentWordsInput(field: string, value: string): void {
    this.patchPayment(field, this.sanitizeWords(value, true));
  }

  onApplicantTextInput(index: number, field: keyof Applicant, value: string): void {
    this.patchApplicant(index, field, this.sanitizeWords(value));
  }

  onNumericInput(field: keyof Section1, value: string, maxLength?: number): void {
    this.patch(field, this.sanitizeDigits(value, maxLength) as Section1[keyof Section1]);
  }

  onNriNumericInput(field: NriField, value: string): void {
    this.onNriInput(field, this.sanitizeDigits(value, 10));
  }

  onNriTextInput(field: NriField, value: string): void {
    this.onNriInput(field, this.sanitizeWords(value));
  }

  onChannelPartnerTextInput(field: string, value: string): void {
    this.patchCP(field, this.sanitizeWords(value));
  }

  onChannelPartnerNumericInput(field: string, value: string): void {
    this.patchCP(field, this.sanitizeDigits(value, 10));
  }

  patch(field: keyof Section1, value: Section1[keyof Section1]): void {
    if (field === 'residentialStatus' && typeof value === 'string') {
      this.residentialStatusChange.emit(value);
    }

    this.svc.updateSection1({ [field]: value } as Partial<Section1>);
  }

  patchFlat(field: string, value: unknown): void {
    this.svc.updateSection1({
      flat: { ...this.form.flat, [field]: value }
    });
  }

  patchPayment(field: string, value: unknown): void {
    this.svc.updateSection1({
      payment: { ...this.form.payment, [field]: value }
    });
  }

  patchFunding(field: string, value: unknown): void {
    this.svc.updateSection1({
      funding: { ...this.form.funding, [field]: value }
    });
  }

  patchCP(field: string, value: unknown): void {
    this.svc.updateSection1({
      channelPartner: { ...this.form.channelPartner, [field]: value }
    });
  }

  patchApplicant(index: number, field: keyof Applicant, value: Applicant[keyof Applicant]): void {
    if (field === 'occupation') this.touchedOccupation[index] = true;
    if (field === 'designation') this.touchedDesignation[index] = true;
    if (field === 'residentialStatus') this.touchedResidentialStatus[index] = true;
    this.svc.updateApplicant(index, { [field]: value } as Partial<Applicant>);
  }

  toggleSource(option: string): void {
    const source = [...this.form.source];
    const index = source.indexOf(option);

    if (index >= 0) {
      source.splice(index, 1);
    } else {
      source.push(option);
    }

    this.patch('source', source);
  }

  isSourceOn(option: string): boolean {
    return this.form.source.includes(option);
  }

  trackByIndex(index: number): number {
    return index;
  }

  addNextApplicant(): void {
    const applicantCount = this.form?.applicants?.length || 0;

    if (applicantCount >= 4) {
      return;
    }

    if (!this.isApplicantComplete(applicantCount - 1)) {
      this.showErrors = true;
      this.showApplicantAccessWarning(applicantCount);
      this.expandedApplicants[applicantCount - 1] = true;
      return;
    }

    this.svc.addApplicant();
    this.applicantAccessWarning = '';

    const newIndex = applicantCount;
    this.syncApplicantExpandedState();

    while (this.expandedApplicants.length <= newIndex) {
      this.expandedApplicants.push(false);
    }

    this.expandedApplicants[newIndex] = true;
  }

  removeApplicant(index: number, event?: MouseEvent): void {
    event?.stopPropagation();

    if (index <= 0) {
      return;
    }

    this.svc.removeApplicant(index);
  }

  toggleApplicant(index: number): void {
    if (index > 0 && !this.isApplicantComplete(index - 1)) {
      this.showErrors = true;
      this.showApplicantAccessWarning(index);
      this.syncApplicantExpandedState();
      this.expandedApplicants[index - 1] = true;
      return;
    }

    this.applicantAccessWarning = '';
    this.syncApplicantExpandedState();

    while (this.expandedApplicants.length <= index) {
      this.expandedApplicants.push(false);
    }

    this.expandedApplicants[index] = !this.expandedApplicants[index];
  }

  toggleTnc(): void {
    this.patch('tncAccepted', !this.form.tncAccepted);
  }

  onPhotoSelected(index: number, url: string): void {
    const applicantKey = `applicant${index + 1}`;

    this.svc.updateSection1({
      photos: { ...this.form.photos, [applicantKey]: url }
    });
    this.svc.updateExistingFile(index, 'photo', url);
  }

  onPhotoCleared(index: number): void {
    const photos = { ...this.form.photos };
    delete photos[`applicant${index + 1}`];

    this.svc.updateSection1({ photos });
    this.svc.updateExistingFile(index, 'photo', null);
  }

  onSigned(key: string, url: string): void {
    if (key === 'channelPartner') {
      this.setChannelPartnerSignature(url);
      return;
    }

    this.svc.updateSection1({
      signatures: { ...this.form.signatures, [key]: url }
    });

    const match = /^applicant(\d+)$/.exec(key);

    if (match) {
      this.svc.updateExistingFile(Number(match[1]) - 1, 'sig', url);
    }
  }

  onSignatureCleared(key: string): void {
    if (key === 'channelPartner') {
      this.setChannelPartnerSignature(null);
      return;
    }

    const signatures = { ...this.form.signatures };
    delete signatures[key];

    this.svc.updateSection1({ signatures });

    const match = /^applicant(\d+)$/.exec(key);

    if (match) {
      this.svc.updateExistingFile(Number(match[1]) - 1, 'sig', null);
    }
  }

  existingPhotoUrl(index: number): string | null {
    return this.svc.existingFiles?.applicants?.[index]?.photo || null;
  }

  existingSigUrl(index: number): string | null {
    return this.svc.existingFiles?.applicants?.[index]?.sig || null;
  }

  existingCPSigUrl(): string | null {
    return this.form?.signatures?.['channelPartner'] || this.form?.channelPartner?.sig || null;
  }

  getValidationState(): { firstInvalidFieldId: string | null; missingFieldNames: string[] } {
    this.showErrors = true;

    const missing: Array<{ id: string; label: string }> = [];

    if (!this.safeStr(this.form.residenceAddress)) {
      missing.push({ id: 'residential-address', label: 'Residence Address' });
    }

    if (this.form.funding.loanOpted === 'Yes') {
      if (!this.safeStr(this.form.funding.bankName)) {
        missing.push({ id: 'funding-bankName', label: 'Bank / FI Name' });
      }

      if (!this.safeStr(this.form.funding.ownContrib)) {
        missing.push({ id: 'funding-ownContrib', label: 'Own Contribution %' });
      }

      if (!this.safeStr(this.form.funding.homeLoan)) {
        missing.push({ id: 'funding-homeLoan', label: 'Home Loan %' });
      }
    }

    if (this.isNriSelected()) {
      if (!this.safeStr(this.form.nriCountry)) {
        missing.push({ id: 'nri-country', label: 'Country' });
      }

      if (!this.safeStr(this.form.localContactNo)) {
        missing.push({ id: 'nri-localContactNo', label: 'Local Contact Number' });
      }

      if (!this.safeStr(this.form.localContactPerson)) {
        missing.push({ id: 'nri-localContactPerson', label: 'Local Contact Person' });
      }
    }

    (this.form.applicants || []).forEach((_, index) => {
      missing.push(...this.getApplicantMissingFields(index));
    });

    const channelPartner = this.form.channelPartner;

    if (channelPartner.applicable) {
      if (!this.safeStr(channelPartner.name)) {
        missing.push({ id: 'cp-name', label: 'Channel Partner Name' });
      }

      if (!this.safeStr(channelPartner.mobile)) {
        missing.push({ id: 'cp-mobile', label: 'Channel Partner Mobile' });
      }

      if (!this.safeStr(channelPartner.email)) {
        missing.push({ id: 'cp-email', label: 'Channel Partner Email' });
      }

      if (!this.safeStr(channelPartner.rera)) {
        missing.push({ id: 'cp-rera', label: 'Channel Partner RERA' });
      }

      if (!this.safeStr(channelPartner.gst)) {
        missing.push({ id: 'cp-gst', label: 'Channel Partner GST' });
      }

      if (!this.safeStr(channelPartner.brokerage)) {
        missing.push({ id: 'cp-brokerage', label: 'Channel Partner Brokerage' });
      }

      if (!this.hasChannelPartnerSignature()) {
        missing.push({ id: 'cp-signature-anchor', label: 'Channel Partner Signature' });
      }
    }

    if (!this.form.tncAccepted) {
      missing.push({ id: 'tnc-acceptance', label: 'Terms & Conditions Acceptance' });
    }

    return {
      firstInvalidFieldId: missing.length ? missing[0].id : null,
      missingFieldNames: missing.map(item => item.label)
    };
  }

  isApplicantComplete(index: number): boolean {
    return this.getApplicantMissingFields(index).length === 0;
  }

  isAllApplicantsComplete(): boolean {
    return this.form.applicants.every((_, i) => this.isApplicantComplete(i));
  }

  isApplicantFieldInvalid(index: number, field: ApplicantField): boolean {
    const applicant = this.form?.applicants?.[index];
    if (!applicant) return false;

    const isPrimary = index === 0;
    const isMandatory = isPrimary || ['title', 'firstName', 'middleName', 'lastName'].includes(field);

    if (field === 'pan') {
      if (!this.showErrors && !this.touchedPan[index]) return false;
      if (!isMandatory && !applicant.pan) return false;
      return !this.isPanValid(applicant.pan);
    }

    const touched = this.showErrors || 
                    (['occupation'].includes(field) && this.touchedOccupation[index]) ||
                    (['designation'].includes(field) && this.touchedDesignation[index]) ||
                    (['residentialStatus'].includes(field) && this.touchedResidentialStatus[index]) ||
                    (['title', 'firstName', 'middleName', 'lastName'].includes(field)); // headers usually show errors if showErrors is true

    if (!touched) return false;
    if (!isMandatory && !this.safeStr(applicant[field])) return false;

    return !this.safeStr(applicant[field]);
  }

  isPanValid(pan?: string): boolean {
    return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test((pan || '').trim());
  }

  isAadharInvalid(index: number): boolean {
    const control = this.applicantIdentityForms[index]?.get('aadharNumber');

    if (!control) {
      return false;
    }

    return (this.showErrors || this.touchedAadhar[index] || control.touched) && control.invalid;
  }

  isPassportInvalid(index: number): boolean {
    const control = this.applicantIdentityForms[index]?.get('passportNumber');

    if (!control) {
      return false;
    }

    return (this.showErrors || this.touchedPassport[index] || control.touched) && control.invalid;
  }

  isApplicantPhoneInvalid(index: number): boolean {
    const control = this.applicantIdentityForms[index]?.get('phoneNumber');
    if (!control) return false;
    return (this.showErrors || this.touchedApplicantPhone[index] || control.touched) && control.invalid;
  }


  isApplicantEmailInvalid(index: number): boolean {
    const control = this.applicantIdentityForms[index]?.get('email');
    if (!control) return false;
    return (this.showErrors || this.touchedApplicantEmail[index] || control.touched) && control.invalid;
  }

  applicantEmailErrorMessage(index: number): string {
    const control = this.applicantIdentityForms[index]?.get('email');
    if (control?.hasError('required')) return 'Email is required for Applicant 1.';
    if (control?.hasError('pattern')) return 'Please enter a valid email address.';
    return '';
  }

  applicantPhoneErrorMessage(index: number): string {
    const control = this.applicantIdentityForms[index]?.get('phoneNumber');
    if (control?.hasError('required')) return 'Phone number is required for Applicant 1.';
    if (control?.hasError('pattern')) return 'Please enter a valid 10-digit phone number.';
    return '';
  }



  isApplicantAddressInvalid(index: number, field: 'residenceAddress' | 'correspondenceAddress'): boolean {
    const control = this.applicantIdentityForms[index]?.get(field);
    if (!control) return false;
    const touched = this.touchedApplicantAddress[index]?.[field];
    return (this.showErrors || touched || control.touched) && control.invalid;
  }

  isApplicantWhatsappInvalid(index: number): boolean {
    const control = this.applicantIdentityForms[index]?.get('whatsappNumber');

    if (!control) {
      return false;
    }

    return (this.showErrors || this.touchedApplicantWhatsapp[index] || control.touched) && control.invalid;
  }

  aadharErrorMessage(index: number): string {
    const control = this.applicantIdentityForms[index]?.get('aadharNumber');

    if (index === 0 && control?.hasError('required')) {
      return 'Aadhar number is required for Applicant 1.';
    }

    return 'Aadhar number must be exactly 12 digits.';
  }

  passportErrorMessage(index: number): string {
    const control = this.applicantIdentityForms[index]?.get('passportNumber');

    if (index === 0 && control?.hasError('required')) {
      return 'Passport number is required for Applicant 1.';
    }

    return 'Passport number must be 8-9 alphanumeric characters.';
  }



  applicantWhatsappErrorMessage(index: number): string {
    const control = this.applicantIdentityForms[index]?.get('whatsappNumber');

    if (control?.hasError('required')) {
      return `Applicant ${index + 1} WhatsApp number is required.`;
    }

    return 'WhatsApp number must be exactly 10 digits.';
  }

  isTncInvalid(): boolean {
    return this.showErrors && !this.form.tncAccepted;
  }

  isNriSelected(): boolean {
    return ['NRI', 'PIO', 'OCI'].includes(this.form?.residentialStatus || '');
  }

  isApplicantNriSelected(index: number): boolean {
    const status = this.form?.applicants?.[index]?.residentialStatus || 'Resident Indian';
    return ['NRI', 'PIO', 'OCI'].includes(status);
  }

  isApplicantNriFieldInvalid(index: number, field: string): boolean {
    const applicant = this.form?.applicants?.[index];
    
    if (!applicant || !this.isApplicantNriSelected(index)) {
      return false;
    }

    this.initApplicantNriTouched(index);

    if (!this.showErrors && !this.touchedApplicantNri[index][field]) {
      return false;
    }

    const value = applicant[field as keyof Applicant] as string;
    return !this.safeStr(value);
  }

  isFundingFieldInvalid(field: Section1ValidationField): boolean {
    if (this.form?.funding?.loanOpted !== 'Yes') {
      return false;
    }

    if (!this.showErrors && !this.touchedFunding[field]) {
      return false;
    }

    return !this.safeStr(this.form?.funding?.[field]);
  }

  isNriFieldInvalid(field: NriField): boolean {
    if (!this.isNriSelected()) {
      return false;
    }

    if (!this.showErrors && !this.touchedNri[field]) {
      return false;
    }

    return !this.safeStr(this.form?.[field]);
  }

  revealField(fieldId: string): void {
    const match = /^applicant-(\d+)-/.exec(fieldId);

    if (!match) {
      return;
    }

    const index = Number(match[1]);

    if (Number.isNaN(index)) {
      return;
    }

    this.syncApplicantExpandedState();

    while (this.expandedApplicants.length <= index) {
      this.expandedApplicants.push(false);
    }

    this.expandedApplicants[index] = true;
  }

  get isMobileDuplicate(): boolean {
    return this.mobileCheckState === 'duplicate';
  }

  private setupMobileCheck(): void {
    this.mobileSub = this.mobile$
      .pipe(
        debounceTime(700),
        distinctUntilChanged(),
        filter(value => this.looksLikeMobile(value)),
        switchMap(mobile => {
          this.mobileCheckState = 'checking';
          return this.netsuiteService.checkMobileDuplicate(mobile);
        })
      )
      .subscribe({
        next: (result: MobileCheckResult) => {
          if (result.exists) {
            this.mobileCheckState = 'duplicate';
            this.mobileDuplicateMatches =
              result.matches ||
              (result.customerId
                ? [
                    {
                      customerId: result.customerId,
                      customerName: result.customerName || 'Existing Customer',
                      mobile: this.form.mobile,
                      phoneNumber: result.phoneNumber || result.mobile || '',
                      whatsappNumber: result.whatsappNumber || result.phoneNumber || result.mobile || '',
                      email: result.email || '',
                      residenceAddress: result.residenceAddress || '',
                      correspondenceAddress: result.correspondenceAddress || '',
                      occupation: result.occupation || '',
                      designation: result.designation || ''
                    }
                  ]
                : []);
            return;
          }

          this.mobileCheckState = 'ok';
          this.mobileDuplicateMatches = [];
        },
        error: () => {
          this.mobileCheckState = 'idle';
        }
      });
  }

  private looksLikeMobile(value: string): boolean {
    return /^\d{10}$/.test(value.replace(/\D/g, ''));
  }

  private syncApplicantIdentityForms(): void {
    const applicants = this.form?.applicants || [];

    while (this.applicantIdentityForms.length < applicants.length) {
      this.applicantIdentityForms.push(this.createApplicantIdentityForm(this.applicantIdentityForms.length));
    }

    if (this.applicantIdentityForms.length > applicants.length) {
      this.applicantIdentityForms = this.applicantIdentityForms.slice(0, applicants.length);
    }

    this.applicantIdentityForms.forEach((group, index) => {
      const phoneNumber = applicants[index]?.phoneNumber || '';
      let whatsappNumber = applicants[index]?.whatsappNumber || '';

      if (this.applicantWhatsappSameAsPhone[index] === undefined) {
        // First time or reload: if whatsapp is same as phone (or empty), consider it "Same as mobile"
        this.applicantWhatsappSameAsPhone[index] = !whatsappNumber || whatsappNumber === phoneNumber;
      }

      // If "Same as mobile" is checked, force it to phone number
      if (this.applicantWhatsappSameAsPhone[index]) {
        whatsappNumber = phoneNumber;
      }

      this.applyApplicantIdentityValidators(group, index);
      group.patchValue(
        {
          aadharNumber: applicants[index]?.aadharNumber || '',
          passportNumber: applicants[index]?.passportNumber || '',
          phoneNumber,
          whatsappNumber,
          email: applicants[index]?.email || '',
          residenceAddress: applicants[index]?.residenceAddress || '',
          correspondenceAddress: applicants[index]?.correspondenceAddress || ''
        },
        { emitEvent: false }
      );
    });
  }

  private createApplicantIdentityForm(index: number): FormGroup {
    const group = new FormGroup({
      aadharNumber: new FormControl(''),
      passportNumber: new FormControl(''),
      phoneNumber: new FormControl(''),
      whatsappNumber: new FormControl(''),
      email: new FormControl('', [Validators.pattern('^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,4}$')]),
      residenceAddress: new FormControl(''),
      correspondenceAddress: new FormControl('')
    });

    this.applyApplicantIdentityValidators(group, index);
    return group;
  }

  private applyApplicantIdentityValidators(group: FormGroup, index: number): void {
    const isPrimary = index === 0;

    const aadharValidators = [Validators.pattern(/^\d{12}$/)];
    const passportValidators = [Validators.pattern(/^[A-Z0-9]{8,9}$/)];
    const phoneValidators = [Validators.pattern(/^\d{10}$/)];
    const whatsappValidators = [Validators.pattern(/^\d{10}$/)];
    const emailValidators = [Validators.pattern(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$/i)];
    const resAddrValidators = [];

    if (isPrimary) {
      aadharValidators.unshift(Validators.required);
      passportValidators.unshift(Validators.required);
      phoneValidators.unshift(Validators.required);
      whatsappValidators.unshift(Validators.required);
      emailValidators.unshift(Validators.required);
      resAddrValidators.push(Validators.required);
    }

    group.get('aadharNumber')?.setValidators(aadharValidators);
    group.get('passportNumber')?.setValidators(passportValidators);
    group.get('phoneNumber')?.setValidators(phoneValidators);
    group.get('whatsappNumber')?.setValidators(whatsappValidators);
    group.get('email')?.setValidators(emailValidators);
    group.get('residenceAddress')?.setValidators(resAddrValidators);

    group.get('aadharNumber')?.updateValueAndValidity({ emitEvent: false });
    group.get('passportNumber')?.updateValueAndValidity({ emitEvent: false });
    group.get('phoneNumber')?.updateValueAndValidity({ emitEvent: false });
    group.get('whatsappNumber')?.updateValueAndValidity({ emitEvent: false });
    group.get('email')?.updateValueAndValidity({ emitEvent: false });
    group.get('residenceAddress')?.updateValueAndValidity({ emitEvent: false });
  }

  private isAadharValid(value: string | undefined, required: boolean): boolean {
    const aadhar = this.safeStr(value);
    return required || aadhar ? /^\d{12}$/.test(aadhar) : true;
  }

  private isPassportValid(value: string | undefined, required: boolean): boolean {
    const passport = this.safeStr(value).toUpperCase();
    return required || passport ? /^[A-Z0-9]{8,9}$/.test(passport) : true;
  }

  private isApplicantPhoneValid(value: string | undefined): boolean {
    return /^\d{10}$/.test(this.safeStr(value));
  }

  private isApplicantWhatsappValid(value: string | undefined): boolean {
    return /^\d{10}$/.test(this.safeStr(value));
  }

  private sanitizeDigits(value: string, maxLength?: number): string {
    const digits = (value || '').replace(/\D/g, '');
    return maxLength ? digits.slice(0, maxLength) : digits;
  }

  private sanitizeWords(value: string, allowHyphen = false): string {
    const pattern = allowHyphen ? /[^a-zA-Z\s.'`-]/g : /[^a-zA-Z\s.'`]/g;
    return (value || '').replace(pattern, '');
  }

  private setApplicantWhatsappValue(index: number, value: string): void {
    this.applicantIdentityForms[index]?.get('whatsappNumber')?.setValue(value, { emitEvent: false });
    this.patchApplicant(index, 'whatsappNumber', value);

    if (index === 0) {
      this.patch('whatsappNumber', value);
    }
  }

  private syncApplicantExpandedState(): void {
    const applicantCount = this.form?.applicants?.length || 0;

    if (this.expandedApplicants.length === 0 && applicantCount > 0) {
      this.expandedApplicants = [true];
    }

    while (this.expandedApplicants.length < applicantCount) {
      this.expandedApplicants.push(false);
    }

    if (this.expandedApplicants.length > applicantCount) {
      this.expandedApplicants = this.expandedApplicants.slice(0, applicantCount);
    }
  }

  private getApplicantMissingFields(index: number): Array<{ id: string; label: string }> {
    const applicant = this.form.applicants[index];
    if (!applicant) return [];

    const applicantNumber = index + 1;
    const isPrimary = index === 0;
    const missing: Array<{ id: string; label: string }> = [];

    // Title, First, Middle, Last are mandatory for everyone
    if (!this.safeStr(applicant.title)) {
      missing.push({ id: `applicant-${index}-title`, label: `Applicant ${applicantNumber} Title` });
    }
    if (!this.safeStr(applicant.firstName)) {
      missing.push({ id: `applicant-${index}-firstName`, label: `Applicant ${applicantNumber} First Name` });
    }
    if (!this.safeStr(applicant.middleName)) {
      missing.push({ id: `applicant-${index}-middleName`, label: `Applicant ${applicantNumber} Middle Name` });
    }
    if (!this.safeStr(applicant.lastName)) {
      missing.push({ id: `applicant-${index}-lastName`, label: `Applicant ${applicantNumber} Last Name` });
    }

    // Other fields are mandatory for Applicant 1 only
    if (isPrimary) {
      if (!this.safeStr(applicant.dob)) {
        missing.push({ id: `applicant-${index}-dob`, label: `Applicant ${applicantNumber} Date of Birth` });
      }
      if (!this.isPanValid(applicant.pan)) {
        missing.push({ id: `applicant-${index}-pan`, label: `Applicant ${applicantNumber} PAN (valid format)` });
      }
      if (!this.isAadharValid(applicant.aadharNumber, true)) {
        missing.push({ id: `applicant-${index}-aadhar`, label: `Applicant ${applicantNumber} Aadhar (12 digits)` });
      }
      if (!this.isPassportValid(applicant.passportNumber, true)) {
        missing.push({ id: `applicant-${index}-passport`, label: `Applicant ${applicantNumber} Passport (8-9 alphanumeric)` });
      }
      if (!this.isApplicantPhoneValid(applicant.phoneNumber)) {
        missing.push({ id: `applicant-${index}-phone`, label: `Applicant ${applicantNumber} Phone Number (10 digits)` });
      }
      if (!this.isApplicantWhatsappValid(applicant.whatsappNumber || applicant.phoneNumber)) {
        missing.push({ id: `applicant-${index}-whatsapp`, label: `Applicant ${applicantNumber} WhatsApp Number (10 digits)` });
      }
      if (!this.safeStr(applicant.email) || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$/i.test(applicant.email)) {
        missing.push({ id: `applicant-${index}-email`, label: `Applicant ${applicantNumber} Email` });
      }
      if (!this.safeStr(applicant.residenceAddress)) {
        missing.push({ id: `applicant-${index}-res-address`, label: `Applicant ${applicantNumber} Residence Address` });
      }
      if (!this.safeStr(applicant.occupation)) {
        missing.push({ id: `applicant-${index}-occupation`, label: `Applicant ${applicantNumber} Profession` });
      }
      if (!this.safeStr(applicant.designation)) {
        missing.push({ id: `applicant-${index}-designation`, label: `Applicant ${applicantNumber} Designation` });
      }
      if (!this.safeStr(applicant.residentialStatus)) {
        missing.push({ id: `applicant-${index}-residentialStatus`, label: `Applicant ${applicantNumber} Residential Status` });
      }
    }

    // Validate per-applicant NRI fields if NRI/PIO/OCI is selected
    if (this.isApplicantNriSelected(index)) {
      if (!this.safeStr(applicant.nriCountry)) {
        missing.push({ id: `applicant-${index}-nri-country`, label: `Applicant ${applicantNumber} Country` });
      }
      if (!this.safeStr(applicant.localContactNo)) {
        missing.push({ id: `applicant-${index}-nri-contact`, label: `Applicant ${applicantNumber} Local Contact No.` });
      }

      if (!this.safeStr(applicant.localContactPerson)) {
        missing.push({ id: `applicant-${index}-nri-person`, label: `Applicant ${applicantNumber} Local Contact Person` });
      }
    }

    return missing;
  }

  private safeStr(value: unknown): string {
    if (value === null || value === undefined) return '';
    const s = String(value).trim();
    return (s === 'Select' || s === 'Select Title') ? '' : s;
  }

  private showApplicantAccessWarning(applicantIndex: number): void {
    this.applicantAccessWarning =
      `Please complete Applicant ${applicantIndex} details before proceeding to Applicant ${applicantIndex + 1}.`;

    setTimeout(() => {
      this.applicantAccessWarning = '';
    }, 4000);
  }

  hasChannelPartnerSignature(): boolean {
    return !!this.safeStr(this.existingCPSigUrl());
  }

  private setChannelPartnerSignature(value: string | null): void {
    const signatures = { ...this.form.signatures };

    if (value) {
      signatures['channelPartner'] = value;
    } else {
      delete signatures['channelPartner'];
    }

    this.svc.updateSection1({
      signatures,
      channelPartner: {
        ...this.form.channelPartner,
        sig: value
      }
    });
  }
}
