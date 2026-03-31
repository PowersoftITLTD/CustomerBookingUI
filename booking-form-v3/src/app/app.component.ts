import { Component, EventEmitter, Input, input, OnInit, ViewChild } from '@angular/core';
import { BookingFormService } from './services/booking-form.service';
import { NetsuiteService } from './services/netsuite.service';
import { BookingRecord } from './models/booking-form.model';
import { Section1Component } from './components/section1/section1.component';
import { Section3Component } from './components/section3/section3.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  currentStep  = 1;
  totalSteps   = 3;
  submitting   = false;
  submitted    = false;
  submitError  = '';
  selectedApplicantType:string = '';
  draftSaved   = false;
  showValidationModal = false;
  validationMissingFields: string[] = [];
  modalCountdown = 3;
  private modalTimer: any = null;

    isDark = false;


  // @Input() applicantSelectedType = new EventEmitter();
  @Input() applicantType: any;
  @ViewChild(Section1Component) section1!: Section1Component;
  @ViewChild(Section3Component) section3!: Section3Component;

  steps = [
    { num: 1, label: 'Booking Form',    sub: 'Applicant & Flat Details' },
    { num: 2, label: 'Know You Better', sub: 'Lifestyle Profile' },
    { num: 3, label: 'KYC & Documents', sub: 'Upload Checklist' }
  ];

  constructor(
    public formService: BookingFormService,
    private nsService: NetsuiteService
  ) {}

  ngOnInit(): void {
    this.formService.currentStep$.subscribe(s => this.currentStep = s);
    this.formService.loadDraft();
  }

  get isEditMode(): boolean { return this.formService.isEditMode; }

  onRecordLoaded(rec: BookingRecord): void {
    // Scroll to top so user sees the populated form from step 1
    window.scrollTo({ top: 0, behavior: 'smooth' });
    console.log('✓ Loaded booking record:', rec.bookingId, '| Customer:', rec.customerName);
  }

goTo(step: number): void {
 if (step > this.currentStep && this.currentStep === 1 && this.section1) {
    if (!this.validateSection1BeforeProceeding()) return;
 }
 if (step > this.currentStep && this.currentStep === 2 && this.section3) {
    if (!this.validateSection3BeforeProceeding()) return;
 }

    this.formService.goToStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

next(): void {
  this.goTo(this.currentStep + 1);
}

scrollToField(fieldId: string) {
  if (this.currentStep === 1 && this.section1) {
    this.section1.revealField(fieldId);
  }
  setTimeout(() => {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el as HTMLInputElement).focus();
  }, 120);
}



toggleTheme(): void {
  const next = this.isDark ? 'light' : 'dark';
  this.applyTheme(next);
  localStorage.setItem('25s-theme', next);
}


private applyTheme(theme: string): void {
  this.isDark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', theme);
}

//   next(): void { 

//      if (this.currentStep === 1) {

      
//     const isValid = this.section1.isChannelPartnerValid();

//     if (!isValid) {
//       alert('Please fill all Channel Partner details');
//       return;
//     }
//   }
//     // this.goTo(this.currentStep + 1); 
//   }

//   scrollToField(fieldId: string): void {
//   const el = document.getElementById(fieldId);
//   if (el) {
//     el.scrollIntoView({ behavior: 'smooth', block: 'center' });
//     el.focus(); // optional: focus the input
//   }
// }
  back(): void { this.goTo(this.currentStep - 1); }

  saveDraft(): void {
    this.formService.saveDraft();
    this.draftSaved = true;
    setTimeout(() => this.draftSaved = false, 2500);
  }

  get progressPct(): number {
    return [16, 50, 100][this.currentStep - 1];
  }

  onApplicantTypeChange(value: any) {
  console.log('Received in parent:', value);

  // do whatever you need
  this.selectedApplicantType = value;
}

  submitAll(): void {
    this.submitting  = true;
    this.submitError = '';

    if (!this.formService.isApplicant1PanUploaded()) {
      this.submitting = false;
      this.validationMissingFields = ['Applicant 1 PAN Document (KYC)'];
      this.showModal();
      this.submitError = 'Missing required fields.';
      return;
    }

    const payload = this.formService.buildFullPayload();

    this.nsService.submitBookingForm(payload).subscribe({
      next: (res) => {
        this.submitting = false;
        this.submitted  = true;
        console.log('✓ Submitted | Customer:', res.customerId, '| Booking:', res.bookingId);
      },
      error: (err) => {
        this.submitting  = false;
        this.submitError = err.message;
      }
    });
  }

  closeValidationModal(): void {
    this.showValidationModal = false;
    if (this.modalTimer) { clearInterval(this.modalTimer); this.modalTimer = null; }
  }

  private showModal(): void {
    this.modalCountdown = 3;
    this.showValidationModal = true;
    if (this.modalTimer) { clearInterval(this.modalTimer); }
    this.modalTimer = setInterval(() => {
      this.modalCountdown--;
      if (this.modalCountdown <= 0) { this.closeValidationModal(); }
    }, 1000);
  }

  private validateSection1BeforeProceeding(): boolean {
    const validation = this.section1.getValidationState();
    if (!validation.firstInvalidFieldId) {
      this.validationMissingFields = [];
      this.showValidationModal = false;
      return true;
    }

    this.validationMissingFields = validation.missingFieldNames;
    this.showModal();
    this.scrollToField(validation.firstInvalidFieldId);
    return false;
  }

  private validateSection3BeforeProceeding(): boolean {
    const validation = this.section3.getValidationState();
    if (validation.valid) {
      this.validationMissingFields = [];
      this.showValidationModal = false;
      return true;
    }
    this.validationMissingFields = this.section3.getMissingSelfFields();
    this.showModal();
    return false;
  }
}
