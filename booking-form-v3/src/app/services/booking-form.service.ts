import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  Applicant,
  ApplicantKyc,
  BookingFormPayload,
  BookingRecord,
  ExistingKycFiles,
  KycFileIds,
  NetSuiteCustomer,
  NetSuiteRecord,
  Section1,
  Section3,
  Section4
} from '../models/booking-form.model';

const MAX_APPLICANTS = 4;
const DEFAULT_RESIDENTIAL_STATUS = 'Resident Indian';
const APPLICANT_SIGNATURE_KEY = 'channelPartner';

const createEmptyApplicant = (): Applicant => ({
  title: '',
  firstName: '',
  middleName: '',
  lastName: '',
  relation: '',
  dob: '',
  anniversary: '',
  pan: '',
  aadharNumber: '',
  passportNumber: '',
  phoneNumber: '',
  whatsappNumber: '',
  email: '',
  residenceAddress: '',
  correspondenceAddress: '',
  occupation: '',
  designation: '',
  residentialStatus: 'Resident Indian',
  nriCountry: '',
  localContactNo: '',
  localContactPerson: ''
});

const createEmptyFileIds = (): KycFileIds => ({
  pan: null,
  aadhar: null,
  dl: null,
  passport: null,
  voter: null,
  addr: null,
  sig: null,
  photo: null
});

const createEmptySection1 = (): Section1 => ({
  applicationDate: new Date().toISOString().split('T')[0],
  applicants: [createEmptyApplicant()],
  residenceAddress: '',
  correspondenceAddress: '',
  ownership: '',
  otherProp: '',
  otherPropCity: '',
  profession: '',
  organization: '',
  designation: '',
  officeAddress: '',
  businessCard: false,
  mobile: '',
  whatsappNumber: '',
  residencePhone: '',
  officePhone: '',
  email: '',
  residentialStatus: DEFAULT_RESIDENTIAL_STATUS,
  nriCountry: '',
  localContactNo: '',
  localContactPerson: '',
  flat: {
    projectName: '',
    wing: '',
    flatNo: '',
    floor: '',
    configuration: '',
    bhkType: '',
    reraCarpet: '',
    alongWithArea: '',
    cpNo: '',
    cpLevel: '',
    cpType: '',
    saleValue: '',
    saleValueWords: '',
    endUse: ''
  },
  payment: {
    chequeNo: '',
    dated: '',
    amount: '',
    amountWords: '',
    drawnOn: '',
    costSheetRef: ''
  },
  funding: {
    loanOpted: '',
    bankName: '',
    bankContact: '',
    ownContrib: '',
    homeLoan: ''
  },
  source: [],
  sourceOther: '',
  channelPartner: {
    applicable: false,
    name: '',
    contact: '',
    mobile: '',
    landline: '',
    email: '',
    remarks: '',
    rera: '',
    gst: '',
    brokerage: ''
  },
  reference: {
    type: '',
    name: '',
    contact: '',
    email: '',
    property: '',
    apartment: ''
  },
  tncAccepted: false,
  signatures: {},
  photos: {}
});

const createEmptySection3 = (): Section3 => ({
  householdCount: '1',
  family: [
    { relation: 'Self', name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
    { relation: 'Spouse', name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
    { relation: 'Child 1', name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
    { relation: 'Child 2', name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
    { relation: 'Parent 1', name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
    { relation: 'Parent 2', name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' }
  ],
  fitness: [],
  fitnessOther: '',
  sports: [],
  sportsOther: '',
  events: [],
  eventsOther: '',
  music: [],
  musicOther: '',
  internet: [],
  internetOther: '',
  lastApps: '',
  kidsActivities: [],
  kidsOther: '',
  travelAbroad: '',
  carsDriven: '',
  clubMembership: '',
  clubNames: '',
  socialMedia: [],
  socialOther: ''
});

const createEmptySection4 = (): Section4 => ({
  applicants: [{}]
});

type BookingMeta = {
  displayLabel: string;
  customerName: string;
  mobile: string;
  email: string;
  projectName: string;
  wing: string;
  flatNo: string;
};

@Injectable({ providedIn: 'root' })
export class BookingFormService {
  private readonly section1State = new BehaviorSubject<Section1>(createEmptySection1());
  private readonly section3State = new BehaviorSubject<Section3>(createEmptySection3());
  private readonly section4State = new BehaviorSubject<Section4>(createEmptySection4());
  private readonly stepState = new BehaviorSubject<number>(1);

  private editBookingIdValue: string | null = null;
  private existingFilesValue: ExistingKycFiles | null = null;
  private bookingMeta: BookingMeta | null = null;

  readonly section1$ = this.section1State.asObservable();
  readonly section3$ = this.section3State.asObservable();
  readonly section4$ = this.section4State.asObservable();
  readonly currentStep$ = this.stepState.asObservable();

  get section1(): Section1 {
    return this.section1State.getValue();
  }

  get section3(): Section3 {
    return this.section3State.getValue();
  }

  get section4(): Section4 {
    return this.section4State.getValue();
  }

  get currentStep(): number {
    return this.stepState.getValue();
  }

  get isEditMode(): boolean {
    return !!this.editBookingIdValue;
  }

  get editBookingId(): string | null {
    return this.editBookingIdValue;
  }

  get existingFiles(): ExistingKycFiles | null {
    return this.existingFilesValue;
  }

  updateSection1(patch: Partial<Section1>): void {
    const nextSection = { ...this.section1, ...patch };
    this.section1State.next(nextSection);
    this.syncSection4ApplicantCount(nextSection.applicants?.length || 1);
  }

  updateSection3(patch: Partial<Section3>): void {
    this.section3State.next({ ...this.section3, ...patch });
  }

  updateSection4(patch: Partial<Section4>): void {
    this.section4State.next({ ...this.section4, ...patch });
  }

  updateApplicant(index: number, patch: Partial<Applicant>): void {
    const applicants = [...this.section1.applicants];
    applicants[index] = { ...applicants[index], ...patch };
    this.updateSection1({ applicants });
  }

  addApplicant(): void {
    const applicants = [...this.section1.applicants];

    if (applicants.length >= MAX_APPLICANTS) {
      return;
    }

    applicants.push(createEmptyApplicant());
    this.updateSection1({ applicants });
  }

  removeApplicant(index: number): void {
    const applicants = [...this.section1.applicants];

    if (index <= 0 || index >= applicants.length) {
      return;
    }

    applicants.splice(index, 1);

    const photos = this.reindexApplicantMediaMap(this.section1.photos, index);
    const signatures = this.reindexApplicantMediaMap(this.section1.signatures, index);
    const kycApplicants = [...this.section4.applicants];

    if (index < kycApplicants.length) {
      kycApplicants.splice(index, 1);
    }

    const safeCount = Math.max(1, applicants.length);
    this.normalizeApplicantCollections(kycApplicants, safeCount);

    if (this.existingFilesValue?.applicants) {
      const shiftedFiles = [...this.existingFilesValue.applicants];

      if (index < shiftedFiles.length) {
        shiftedFiles.splice(index, 1);
      }

      this.normalizeFileCollection(shiftedFiles, safeCount);
      this.existingFilesValue = {
        ...this.existingFilesValue,
        applicants: shiftedFiles
      };
    }

    this.updateSection1({ applicants, photos, signatures });
    this.updateSection4({ applicants: kycApplicants });
  }

  updateKycDocument(applicantIndex: number, field: string, document: unknown): void {
    const applicants = [...this.section4.applicants];
    applicants[applicantIndex] = { ...applicants[applicantIndex], [field]: document };
    this.updateSection4({ applicants });
  }

  isApplicant1PanUploaded(): boolean {
    const panDocument = this.section4.applicants[0]?.pan;
    return !!panDocument?.fileData || !!this.existingFilesValue?.applicants?.[0]?.pan;
  }

  goToStep(step: number): void {
    if (step >= 1 && step <= 3) {
      this.stepState.next(step);
    }
  }

  buildFullPayload(): BookingFormPayload {
    const primaryApplicant = this.section1.applicants[0];
    const primaryMobile = this.section1.mobile || primaryApplicant?.phoneNumber || '';
    const primaryWhatsapp = this.section1.whatsappNumber || primaryApplicant?.whatsappNumber || primaryMobile;

    const section1 = {
      ...this.section1,
      mobile: primaryMobile,
      whatsappNumber: primaryWhatsapp,
      // Sync Applicant 1's residential status fields to form level for NetSuite
      residentialStatus: primaryApplicant?.residentialStatus || this.section1.residentialStatus,
      nriCountry: primaryApplicant?.nriCountry || this.section1.nriCountry,
      localContactNo: primaryApplicant?.localContactNo || this.section1.localContactNo,
      localContactPerson: primaryApplicant?.localContactPerson || this.section1.localContactPerson,
      applicants: this.getPaddedApplicants(this.section1.applicants),
      channelPartner: {
        ...this.section1.channelPartner,
        sig: this.section1.signatures[APPLICANT_SIGNATURE_KEY] || this.section1.channelPartner.sig || null
      }
    };

    const payload: BookingFormPayload = {
      ...(this.bookingMeta || {}),
      section1,
      section3: this.section3,
      section4: this.section4,
      existingFiles: {
        applicants: this.getPaddedExistingFiles()
      },
      submittedAt: new Date().toISOString(),
      formVersion: '5.0'
    };

    if (this.editBookingIdValue) {
      payload.editBookingId = this.editBookingIdValue;
    }

    return payload;
  }

  updateExistingFile(applicantIndex: number, field: 'sig' | 'photo', value: string | null): void {
    const applicants = [...(this.existingFilesValue?.applicants || [])];

    while (applicants.length <= applicantIndex) {
      applicants.push(createEmptyFileIds());
    }

    applicants[applicantIndex] = { ...applicants[applicantIndex], [field]: value };
    this.existingFilesValue = {
      ...(this.existingFilesValue || { applicants: [] }),
      applicants
    };
  }

  saveDraft(): void {
    try {
      sessionStorage.setItem('bf_s1', JSON.stringify(this.section1));
      sessionStorage.setItem('bf_s3', JSON.stringify(this.section3));
      sessionStorage.setItem('bf_s4', JSON.stringify(this.section4));
    } catch (error) {
      console.warn('Draft save failed', error);
    }
  }

  loadDraft(): boolean {
    try {
      const section1 = sessionStorage.getItem('bf_s1');
      const section3 = sessionStorage.getItem('bf_s3');
      const section4 = sessionStorage.getItem('bf_s4');

      if (section1) {
        this.section1State.next(JSON.parse(section1));
      }

      if (section3) {
        this.section3State.next(JSON.parse(section3));
      }

      if (section4) {
        this.section4State.next(JSON.parse(section4));
      }

      this.syncSection4ApplicantCount(this.section1.applicants?.length || 1);
      return !!(section1 || section3 || section4);
    } catch {
      return false;
    }
  }

  hasUnsavedData(): boolean {
    const section1 = this.section1;
    return !!(section1.mobile || section1.email || section1.applicants[0]?.firstName || section1.flat?.flatNo);
  }

  loadFromBookingRecord(record: BookingRecord): void {
    this.editBookingIdValue = record.bookingId || null;
    this.existingFilesValue = record.existingFiles || null;
    this.bookingMeta = {
      displayLabel: record.displayLabel || '',
      customerName: record.customerName || '',
      mobile: record.mobile || '',
      email: record.email || '',
      projectName: record.projectName || '',
      wing: record.wing || '',
      flatNo: record.flatNo || ''
    };

    if (record.nsData) {
      this.section1State.next(this.mapNsRecordToSection1(record.nsData));
    } else if ((record as unknown as NetSuiteRecord).channelPartner || (record as unknown as NetSuiteRecord).customers) {
      this.section1State.next(this.mapNsRecordToSection1(record as unknown as NetSuiteRecord));
    } else if (record.section1) {
      this.section1State.next(this.normalizeLoadedSection1(record.section1));
    }

    if (record.section3) {
      this.section3State.next(this.normalizeLoadedSection3(record.section3));
    }

    this.section4State.next({ applicants: [{}] });
    this.syncSection4ApplicantCount(Math.max(1, this.section1.applicants.length));
    this.stepState.next(1);
    sessionStorage.clear();
  }

  loadSampleData(): void {
    const sampleRecord: BookingRecord = {
      bookingId: '45',
      displayLabel: 'SAMBHAV · SAMBHAV-1902 - 4 BHK',
      customerName: 'Prashanth G Sharma',
      mobile: '7022887096',
      email: 'prashanth.gs1297@gmail.com',
      projectName: 'SAMBHAV',
      wing: 'SAMBHAV',
      flatNo: '1902 - 4 BHK',
      section1: {
        applicationDate: '2026-04-10',
        applicants: [
          { title: 'Mr.', firstName: 'Prashanth', middleName: 'G', lastName: 'Sharma', relation: '', dob: '1990-05-20', anniversary: '2015-11-10', pan: 'JHGYU6900P', aadharNumber: '123456789012', passportNumber: 'J1234567', phoneNumber: '7022887096', whatsappNumber: '7022887096', email: 'prashanth.gs1297@gmail.com', residenceAddress: '42, Palm Grove Society, Koregaon Park, Pune - 411001', correspondenceAddress: '42, Palm Grove Society, Koregaon Park, Pune - 411001', occupation: 'BUSINESS', designation: 'Software Developer', residentialStatus: 'PIO', nriCountry: 'United States of America', localContactNo: '9823001122', localContactPerson: 'Rajesh G Sharma' },
          { title: 'Mrs.', firstName: 'Ananya', middleName: '', lastName: 'Sharma', relation: 'Spouse', dob: '1993-08-14', anniversary: '2015-11-10', pan: 'ANPSH4321K', aadharNumber: '', passportNumber: '', phoneNumber: '9823001122', whatsappNumber: '9823001122', email: '', residenceAddress: '', correspondenceAddress: '', occupation: 'Professor', designation: 'Proprietor', residentialStatus: 'Resident Indian' },
          { title: 'Mr.', firstName: 'Vikram', middleName: 'P', lastName: 'Sharma', relation: 'Son', dob: '2016-03-10', anniversary: '', pan: 'VKPSH7890M', aadharNumber: '', passportNumber: '', phoneNumber: '9823001133', whatsappNumber: '9823001133', email: '', residenceAddress: '', correspondenceAddress: '', occupation: 'Software', designation: 'Software Developer', residentialStatus: 'Resident Indian' },
          { title: 'Mr.', firstName: 'Gopal', middleName: 'R', lastName: 'Sharma', relation: 'Father', dob: '1958-01-25', anniversary: '1985-06-15', pan: 'GPLSH1122N', aadharNumber: '', passportNumber: '', phoneNumber: '9823001144', whatsappNumber: '9823001144', email: '', residenceAddress: '', correspondenceAddress: '', occupation: 'Accountant', designation: 'Proprietor', residentialStatus: 'Resident Indian' }
        ],
        residenceAddress: '42, Palm Grove Society, Koregaon Park, Pune - 411001',
        correspondenceAddress: '42, Palm Grove Society, Koregaon Park, Pune - 411001',
        ownership: 'Owned',
        otherProp: 'Yes',
        otherPropCity: 'Bengaluru',
        profession: 'BUSINESS',
        organization: 'Powersoft International Pvt. Ltd.',
        designation: 'Software Developer',
        officeAddress: '5th Floor, Amar Business Centre, FC Road, Pune - 411004',
        businessCard: false,
        mobile: '7022887096',
        whatsappNumber: '7022887096',
        residencePhone: '02025671234',
        officePhone: '02041234567',
        email: 'prashanth.gs1297@gmail.com',
        residentialStatus: 'PIO',
        nriCountry: 'United States of America',
        localContactNo: '9823001122',
        localContactPerson: 'Rajesh G Sharma',
        flat: {
          projectName: 'SAMBHAV',
          wing: 'SAMBHAV',
          flatNo: '1902 - 4 BHK',
          floor: '19th Habitable Floor',
          configuration: '4 BHK',
          bhkType: '4 BHK',
          reraCarpet: 112.19 as unknown as string,
          alongWithArea: 1.74 as unknown as string,
          cpNo: 'P-31',
          cpLevel: 'Level 3',
          cpType: 'Covered',
          saleValue: '53031280',
          saleValueWords: 'Five Crore Thirty Lakh Thirty One Thousand Two Hundred Eighty Only',
          endUse: 'Self Use'
        },
        payment: {
          chequeNo: 'CHQ-2024-00887',
          dated: '2026-04-08',
          amount: 500000 as unknown as string,
          amountWords: 'Five Lakh Only',
          drawnOn: 'HDFC Bank, FC Road Branch, Pune',
          costSheetRef: '4340'
        },
        funding: {
          loanOpted: 'Yes',
          bankName: 'State Bank of India',
          bankContact: 'Amit Kulkarni - 9876001234',
          ownContrib: 25031280 as unknown as string,
          homeLoan: 28000000 as unknown as string
        },
        source: ['Newspaper', 'Website', 'Channel Partner', 'Reference'],
        sourceOther: '',
        channelPartner: {
          applicable: true,
          name: 'Rahul Enterprises',
          contact: 'Rahul Mehta',
          mobile: '9823456701',
          landline: '02041239000',
          email: 'rahul.mehta@rahulenterprises.in',
          remarks: 'Referred by existing customer',
          rera: 'A51800023456',
          gst: '27AABCR1234F1Z5',
          brokerage: 2 as unknown as string
        },
        reference: {
          type: 'Existing Customer',
          name: 'Suresh Iyer',
          contact: '9812345670',
          email: 'suresh.iyer@gmail.com',
          property: 'SAMBHAV',
          apartment: '1502 - 3 BHK'
        },
        tncAccepted: true,
        signatures: {},
        photos: {}
      },
      section3: {
        householdCount: '4',
        family: [
          { relation: 'Self', name: 'Prashanth G Sharma', age: '35', livingTogether: 'Yes', maritalStatus: 'Married', occupation: 'Business', placeOfOccupation: 'Pune' },
          { relation: 'Spouse', name: 'Ananya Sharma', age: '32', livingTogether: 'Yes', maritalStatus: 'Married', occupation: 'Homemaker', placeOfOccupation: 'Pune' },
          { relation: 'Child 1', name: 'Aarav Sharma', age: '8', livingTogether: 'Yes', maritalStatus: 'Single', occupation: 'Student', placeOfOccupation: 'Pune' },
          { relation: 'Child 2', name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
          { relation: 'Parent 1', name: 'Gopal Sharma', age: '65', livingTogether: 'No', maritalStatus: 'Married', occupation: 'Retired', placeOfOccupation: 'Mysore' },
          { relation: 'Parent 2', name: 'Savitha Sharma', age: '62', livingTogether: 'No', maritalStatus: 'Married', occupation: 'Homemaker', placeOfOccupation: 'Mysore' }
        ],
        fitness: ['Yoga / Meditation', 'Cycling', 'Exercising'],
        fitnessOther: '',
        sports: ['Cricket', 'Tennis', 'Swimming'],
        sportsOther: '',
        events: ['Concert', 'Food Shows', 'Club Events'],
        eventsOther: '',
        music: ['Bollywood', 'Indian Classical'],
        musicOther: '',
        internet: ['News', 'Banking & Finance', 'YouTube', 'Shopping'],
        internetOther: '',
        lastApps: 'PhonePe, Zomato, Instagram, YouTube',
        kidsActivities: ['Cricket', 'Football', 'Watch Movies'],
        kidsOther: '',
        travelAbroad: 'Frequently',
        carsDriven: 'Mercedes GLC, Toyota Fortuner',
        clubMembership: 'Yes',
        clubNames: 'Pune Club, Poona Club',
        socialMedia: ['Facebook', 'Instagram', 'LinkedIn'],
        socialOther: ''
      },
      existingFiles: {
        applicants: [
          {
            pan: '390522',
            aadhar: '390915',
            dl: '390916',
            passport: '390917',
            voter: '390918',
            addr: null,
            sig: '391059',
            photo: '391061',
            aadharcard: '390915',
            drivinglicense: '390916',
            voterIid: '390918',
            electricitybill: '391028',
            mtnlbill: '391029',
            bankstatement: '391030',
            companypan: '390914',
            boardresolution: '391032',
            inccertificate: '391033',
            moaaoa: '391034'
          },
          createEmptyFileIds(),
          createEmptyFileIds(),
          createEmptyFileIds()
        ]
      }
    };

    this.loadFromBookingRecord(sampleRecord);
  }

  getAutoLoadBookingId(): string | null {
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('bookingId') || params.get('bid') || params.get('id');

    if (bookingId) {
      return bookingId;
    }

    const nsConfig = (window as any).__NS_CONFIG__;
    return nsConfig?.bookingId || null;
  }

  buildNetSuitePayload(): NetSuiteRecord {
    const section1 = this.section1;
    const primaryApplicant = section1.applicants[0];
    const primaryMobile = section1.mobile || primaryApplicant?.phoneNumber || '';
    const primaryWhatsapp = section1.whatsappNumber || primaryApplicant?.whatsappNumber || primaryMobile;

    return {
      costsheetId: section1.payment.costSheetRef || this.editBookingIdValue || '',
      project: section1.flat.projectName,
      wing: section1.flat.wing,
      flatNo: section1.flat.flatNo,
      floor: section1.flat.floor,
      amount: section1.flat.saleValue ? Number(section1.flat.saleValue) || section1.flat.saleValue : '',
      configuration: section1.flat.configuration,
      bhkType: section1.flat.bhkType,
      endUse: section1.flat.endUse,
      saleValueWords: section1.flat.saleValueWords,
      customers: section1.applicants
        .filter(applicant => applicant.firstName?.trim())
        .map((applicant, index) => ({
          title: applicant.title,
          firstName: applicant.firstName,
          middleName: applicant.middleName,
          lastName: applicant.lastName,
          email: index === 0 ? section1.email : '',
          mobile: index === 0 ? primaryMobile : '',
          relation: applicant.relation,
          dob: applicant.dob,
          anniversary: applicant.anniversary,
          pan: applicant.pan,
          aadharNumber: applicant.aadharNumber,
          passportNumber: applicant.passportNumber,
          phoneNumber: applicant.phoneNumber,
          whatsappNumber: applicant.whatsappNumber || applicant.phoneNumber,
          occupation: applicant.occupation,
          designation: applicant.designation || (index === 0 ? section1.designation : ''),
          residentialStatus: index === 0 ? section1.residentialStatus : '',
          nriCountry: index === 0 ? section1.nriCountry : '',
          localContactNo: index === 0 ? section1.localContactNo : '',
          localContactPerson: index === 0 ? section1.localContactPerson : '',
          profession: index === 0 ? section1.profession : '',
          organization: index === 0 ? section1.organization : ''
        })),
      carParks: [{ level: section1.flat.cpLevel, number: section1.flat.cpNo, type: section1.flat.cpType }],
      areas: [
        { sqMeter: section1.flat.reraCarpet, sqFeet: '' },
        { sqMeter: section1.flat.alongWithArea, sqFeet: '' }
      ].filter(area => area.sqMeter),
      mobile: primaryMobile,
      whatsappNumber: primaryWhatsapp,
      email: section1.email,
      residenceAddress: section1.residenceAddress,
      correspondenceAddress: section1.correspondenceAddress,
      ownership: section1.ownership,
      profession: section1.profession,
      organization: section1.organization,
      designation: section1.designation,
      residentialStatus: section1.residentialStatus,
      nriCountry: section1.nriCountry,
      localContactNo: section1.localContactNo,
      localContactPerson: section1.localContactPerson,
      chequeNo: section1.payment.chequeNo,
      paymentDate: section1.payment.dated,
      paymentAmountWords: section1.payment.amountWords,
      drawnOn: section1.payment.drawnOn,
      loanOpted: section1.funding.loanOpted,
      bankName: section1.funding.bankName,
      ownContrib: section1.funding.ownContrib,
      homeLoan: section1.funding.homeLoan,
      source: section1.source,
      sourceOther: section1.sourceOther,
      channelPartner: {
        applicable: section1.channelPartner.applicable,
        name: section1.channelPartner.name,
        contact: '',
        mobile: section1.channelPartner.mobile,
        landline: '',
        email: section1.channelPartner.email,
        remarks: '',
        rera: section1.channelPartner.rera,
        gst: section1.channelPartner.gst,
        brokerage: section1.channelPartner.brokerage,
        sig: section1.signatures[APPLICANT_SIGNATURE_KEY] || section1.channelPartner.sig || null
      },
      tncAccepted: section1.tncAccepted
    };
  }

  reset(): void {
    this.section1State.next(createEmptySection1());
    this.section3State.next(createEmptySection3());
    this.section4State.next(createEmptySection4());
    this.stepState.next(1);
    this.editBookingIdValue = null;
    this.existingFilesValue = null;
    this.bookingMeta = null;
    sessionStorage.clear();
  }

  private mapNsRecordToSection1(record: NetSuiteRecord): Section1 {
    const section = createEmptySection1();

    section.flat.projectName = record.project || '';
    section.flat.wing = record.wing || '';
    section.flat.flatNo = record.flatNo || '';
    section.flat.floor = record.floor || '';
    section.flat.configuration = record.configuration || '';
    section.flat.bhkType = record.bhkType || '';
    section.flat.saleValue = String(record.amount || '');
    section.flat.saleValueWords = record.saleValueWords || '';
    section.flat.endUse = (record.endUse as 'Self Use' | 'Investment' | '') || '';

    if (record.carParks?.length) {
      section.flat.cpLevel = record.carParks[0].level || '';
      section.flat.cpNo = record.carParks[0].number || '';
      section.flat.cpType = record.carParks[0].type || '';
    }

    if (record.areas?.length) {
      section.flat.reraCarpet = record.areas[0]?.sqMeter || '';
      section.flat.alongWithArea = record.areas[1]?.sqMeter || '';
    }

    if (record.customers?.length) {
      const applicants = this.getValidCustomers(record.customers);
      section.applicants = applicants.map(customer => this.mapCustomerToApplicant(customer));
    }

    section.mobile = record.mobile || '';
    section.whatsappNumber = record.whatsappNumber || record.mobile || '';

    if (section.applicants[0] && !section.applicants[0].phoneNumber) {
      section.applicants[0].phoneNumber = section.mobile;
    }

    if (section.applicants[0] && !section.applicants[0].whatsappNumber) {
      section.applicants[0].whatsappNumber = section.whatsappNumber || section.applicants[0].phoneNumber;
    }

    section.email = record.email || record.customers?.[0]?.email || '';
    section.residenceAddress = record.residenceAddress || '';
    section.correspondenceAddress = record.correspondenceAddress || '';
    section.ownership = record.ownership || '';
    section.profession = record.profession || '';
    section.organization = record.organization || '';
    section.designation = record.designation || '';
    section.residentialStatus = record.residentialStatus || DEFAULT_RESIDENTIAL_STATUS;
    section.nriCountry = record.nriCountry || '';
    section.localContactNo = record.localContactNo || '';
    section.localContactPerson = record.localContactPerson || '';

    // Sync form-level residential status to Applicant 1 for per-applicant management
    if (section.applicants[0]) {
      section.applicants[0].residentialStatus = section.residentialStatus;
      section.applicants[0].nriCountry = section.nriCountry;
      section.applicants[0].localContactNo = section.localContactNo;
      section.applicants[0].localContactPerson = section.localContactPerson;
    }

    section.payment.chequeNo = record.chequeNo || '';
    section.payment.dated = record.paymentDate || '';
    section.payment.amountWords = record.paymentAmountWords || '';
    section.payment.drawnOn = record.drawnOn || '';
    section.payment.costSheetRef = record.costsheetId || '';
    section.funding.loanOpted = (record.loanOpted as 'Yes' | 'No' | 'Not Yet Decided' | '') || '';
    section.funding.bankName = record.bankName || '';
    section.funding.ownContrib = record.ownContrib || '';
    section.funding.homeLoan = record.homeLoan || '';
    section.source = record.source || [];
    section.sourceOther = record.sourceOther || '';

    if (record.channelPartner) {
      section.channelPartner.applicable = record.channelPartner.applicable || false;
      section.channelPartner.name = record.channelPartner.name || '';
      section.channelPartner.mobile = record.channelPartner.mobile || '';
      section.channelPartner.email = record.channelPartner.email || '';
      section.channelPartner.rera = record.channelPartner.rera || '';
      section.channelPartner.gst = record.channelPartner.gst || '';
      section.channelPartner.brokerage = record.channelPartner.brokerage || '';

      if (record.channelPartner.sig) {
        section.channelPartner.sig = record.channelPartner.sig;
        section.signatures[APPLICANT_SIGNATURE_KEY] = record.channelPartner.sig;
      }
    } else {
      const legacyRecord = record as NetSuiteRecord & {
        cpApplicable?: boolean;
        cpName?: string;
        cpMobile?: string;
        cpEmail?: string;
        cpRera?: string;
        cpGst?: string;
        cpBrokerage?: string;
      };

      section.channelPartner.applicable = legacyRecord.cpApplicable || false;
      section.channelPartner.name = legacyRecord.cpName || '';
      section.channelPartner.mobile = legacyRecord.cpMobile || '';
      section.channelPartner.email = legacyRecord.cpEmail || '';
      section.channelPartner.rera = legacyRecord.cpRera || '';
      section.channelPartner.gst = legacyRecord.cpGst || '';
      section.channelPartner.brokerage = legacyRecord.cpBrokerage || '';
    }

    section.tncAccepted = record.tncAccepted || false;
    return section;
  }

  private getValidCustomers(customers: NetSuiteCustomer[]): NetSuiteCustomer[] {
    const filledCustomers = customers.filter(customer => {
      return !!(
        customer.firstName?.trim() ||
        customer.lastName?.trim() ||
        customer.title?.trim() ||
        customer.pan?.trim() ||
        customer.aadharNumber?.trim() ||
        customer.passportNumber?.trim() ||
        customer.phoneNumber?.trim() ||
        customer.whatsappNumber?.trim() ||
        customer.email?.trim()
      );
    });

    return filledCustomers.length > 0 ? filledCustomers : [customers[0]];
  }

  private mapCustomerToApplicant(customer: NetSuiteCustomer): Applicant {
    let title = (customer.title || '').trim();
    const validTitles = ['Dr.', 'M/s', 'Mr.', 'Mrs.', 'Ms.', 'Mx.', 'Shree.', 'Smt.'];

    if (title && !title.endsWith('.') && validTitles.includes(`${title}.`)) {
      title = `${title}.`;
    }

    return {
      title,
      firstName: customer.firstName || '',
      middleName: customer.middleName || '',
      lastName: customer.lastName || '',
      relation: customer.relation || '',
      dob: customer.dob || '',
      anniversary: customer.anniversary || '',
      pan: customer.pan || '',
      aadharNumber: customer.aadharNumber || '',
      passportNumber: customer.passportNumber || '',
      phoneNumber: customer.phoneNumber || customer.mobile || '',
      whatsappNumber: customer.whatsappNumber || customer.phoneNumber || customer.mobile || '',
      email: customer.email || '',
      residenceAddress: customer.residenceAddress || '',
      correspondenceAddress: customer.correspondenceAddress || '',
      occupation: customer.occupation || '',
      designation: customer.designation || ''
    };
  }

  private normalizeLoadedSection1(section: Section1): Section1 {
    const applicants = section.applicants || [];
    const normalizedApplicants =
      applicants.length === 0 ? [createEmptyApplicant()] : applicants.slice(0, MAX_APPLICANTS);

    const signatures = section.signatures || {};
    const photos = section.photos || {};

    if (!signatures[APPLICANT_SIGNATURE_KEY] && section.channelPartner.sig) {
      signatures[APPLICANT_SIGNATURE_KEY] = section.channelPartner.sig;
    }

    return {
      ...section,
      applicants: normalizedApplicants.map((applicant, index) => ({
        ...createEmptyApplicant(),
        ...applicant,
        phoneNumber: applicant.phoneNumber || (index === 0 ? section.mobile : ''),
        whatsappNumber: applicant.whatsappNumber || (index === 0 ? section.whatsappNumber || section.mobile : applicant.phoneNumber || '')
      })),
      whatsappNumber: section.whatsappNumber || section.mobile || '',
      residentialStatus: section.residentialStatus || DEFAULT_RESIDENTIAL_STATUS,
      signatures,
      photos
    };
  }

  private normalizeLoadedSection3(section: Section3): Section3 {
    const family = [...(section.family || [])];

    while (family.length < 6) {
      family.push({
        relation: '',
        name: '',
        age: '',
        livingTogether: '',
        maritalStatus: '',
        occupation: '',
        placeOfOccupation: ''
      });
    }

    return {
      ...section,
      family,
      householdCount: section.householdCount || '1'
    };
  }

  private getPaddedApplicants(applicants: Applicant[]): Applicant[] {
    const paddedApplicants = [...(applicants || [])];

    while (paddedApplicants.length < MAX_APPLICANTS) {
      paddedApplicants.push(createEmptyApplicant());
    }

    return paddedApplicants;
  }

  private getPaddedExistingFiles(): KycFileIds[] {
    const applicants = [...(this.existingFilesValue?.applicants || [])];
    this.normalizeFileCollection(applicants, MAX_APPLICANTS);
    return applicants;
  }

  private syncSection4ApplicantCount(targetCount: number): void {
    const safeCount = Math.max(1, Math.min(MAX_APPLICANTS, targetCount || 1));
    const applicants = [...this.section4.applicants];

    if (applicants.length === safeCount) {
      return;
    }

    this.normalizeApplicantCollections(applicants, safeCount);
    this.updateSection4({ applicants });
  }

  private normalizeApplicantCollections(applicants: ApplicantKyc[], targetCount: number): void {
    while (applicants.length < targetCount) {
      applicants.push({});
    }

    if (applicants.length > targetCount) {
      applicants.length = targetCount;
    }
  }

  private normalizeFileCollection(files: KycFileIds[], targetCount: number): void {
    while (files.length < targetCount) {
      files.push(createEmptyFileIds());
    }

    if (files.length > targetCount) {
      files.length = targetCount;
    }
  }

  private reindexApplicantMediaMap(mediaMap: Record<string, string>, removedIndex: number): Record<string, string> {
    const output: Record<string, string> = {};

    Object.entries(mediaMap || {}).forEach(([key, value]) => {
      const match = /^applicant(\d+)$/.exec(key);

      if (!match) {
        output[key] = value;
        return;
      }

      const oneBasedIndex = Number(match[1]);
      const zeroBasedIndex = oneBasedIndex - 1;

      if (zeroBasedIndex === removedIndex) {
        return;
      }

      if (zeroBasedIndex > removedIndex) {
        output[`applicant${oneBasedIndex - 1}`] = value;
        return;
      }

      output[key] = value;
    });

    return output;
  }
}
