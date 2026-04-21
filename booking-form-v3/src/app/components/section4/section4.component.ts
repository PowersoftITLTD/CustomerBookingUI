import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { BookingFormService } from '../../services/booking-form.service';
import { KycDocument, KycFileIds, Section1, Section4 } from '../../models/booking-form.model';

type DocumentField = {
  key: string;
  label: string;
};

type SummaryItem = {
  label: string;
  fileId: string;
  isUrl: boolean;
  isBase64: boolean;
};

@Component({
  selector: 'app-section4',
  templateUrl: './section4.component.html'
})
export class Section4Component implements OnInit, OnChanges {
  @Input() SelectedApplicantTypeSection4: string | null = null;

  form!: Section4;
  section1!: Section1;
  endUserType = '';
  lightboxUrl = '';
  lightboxLabel = '';

  readonly idFields: DocumentField[] = [
    { key: 'pan', label: 'PAN Card' },
    { key: 'aadhar', label: 'Aadhar Card' },
    { key: 'dl', label: 'Driving License' },
    { key: 'passport', label: 'Passport' },
    { key: 'voter', label: "Voter's ID" }
  ];

  readonly addrFields: DocumentField[] = [
    { key: 'addrPassport', label: 'Passport' },
    { key: 'addrAadhar', label: 'Aadhar Card' },
    { key: 'addrDl', label: 'Driving License' },
    { key: 'addrVoter', label: "Voter's ID" },
    { key: 'electricity', label: 'Electricity Bill' },
    { key: 'mtnl', label: 'MTNL Bill' },
    { key: 'bank', label: 'Bank Statement' }
  ];

  readonly nriFields: DocumentField[] = [
    { key: 'nriPassport', label: 'Passport Copy' },
    { key: 'pio', label: 'PIO Card' },
    { key: 'oci', label: 'OCI Card' }
  ];

  readonly coFields: DocumentField[] = [
    { key: 'companyPan', label: 'Company PAN' },
    { key: 'boardResolution', label: 'Board Resolution' },
    { key: 'incorporation', label: 'Inc. Certificate' },
    { key: 'moaAoa', label: 'MOA & AOA' }
  ];

  private readonly docKeyToExistingField: Record<string, keyof KycFileIds> = {
    pan: 'pan',
    aadhar: 'aadhar',
    dl: 'dl',
    passport: 'passport',
    voter: 'voter',
    addrAadhar: 'aadharcard',
    addrDl: 'drivinglicense',
    addrVoter: 'voterIid',
    electricity: 'electricitybill',
    mtnl: 'mtnlbill',
    bank: 'bankstatement',
    addrPassport: 'passport',
    nriPassport: 'passport',
    companyPan: 'companypan',
    boardResolution: 'boardresolution',
    incorporation: 'inccertificate',
    moaAoa: 'moaaoa'
  };

  constructor(public svc: BookingFormService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['SelectedApplicantTypeSection4']) {
      this.endUserType = changes['SelectedApplicantTypeSection4'].currentValue || '';
    }
  }

  ngOnInit(): void {
    this.svc.section1$.subscribe(section => {
      this.section1 = section;
    });

    this.svc.section4$.subscribe(section => {
      this.form = section;
    });
  }

  openPreview(url: string, label = ''): void {
    this.lightboxUrl = url;
    this.lightboxLabel = label;
  }

  closePreview(): void {
    this.lightboxUrl = '';
  }

  isUploaded(appIdx: number, field: string): boolean {
    return !!(this.form?.applicants[appIdx] as any)?.[field]?.fileData;
  }

  getUploadedDoc(appIdx: number, field: string): KycDocument | null {
    const doc = (this.form?.applicants[appIdx] as any)?.[field];
    return doc?.fileData ? doc : null;
  }

  isImage(doc: KycDocument | null): boolean {
    return !!doc?.fileType?.startsWith('image/');
  }

  isPdf(doc: KycDocument | null): boolean {
    return doc?.fileType === 'application/pdf';
  }

  existingFileId(appIdx: number, field: string): string | null {
    const appFiles = this.svc.existingFiles?.applicants?.[appIdx];

    if (!appFiles) {
      return null;
    }

    const mappedField = this.docKeyToExistingField[field];
    return mappedField ? ((appFiles as any)[mappedField] || null) : null;
  }

  hasPriorFile(appIdx: number, field: string): boolean {
    return !!this.existingFileId(appIdx, field) && !this.isUploaded(appIdx, field);
  }

  priorIsUrl(appIdx: number, field: string): boolean {
    const value = this.existingFileId(appIdx, field);
    return !!value?.startsWith('http');
  }

  onFileChange(event: Event, appIdx: number, field: string): void {
    const file = (event.target as HTMLInputElement).files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File too large - max 5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = loadEvent => {
      const doc: KycDocument = {
        ticked: true,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: loadEvent.target?.result as string
      };

      this.svc.updateKycDocument(appIdx, field, doc);
    };

    reader.readAsDataURL(file);
    (event.target as HTMLInputElement).value = '';
  }

  removeFile(appIdx: number, field: string): void {
    this.svc.updateKycDocument(appIdx, field, undefined);
  }

  isBase64(value: string): boolean {
    return value?.startsWith('data:');
  }

  isUrl(value: string): boolean {
    return value?.startsWith('http');
  }

  get existingSummary(): SummaryItem[] {
    const output: SummaryItem[] = [];
    const docLabels: Record<string, string> = {
      pan: 'PAN Card',
      aadhar: 'Aadhar',
      dl: 'Driving Licence',
      passport: 'Passport',
      voter: "Voter's ID",
      addr: 'Address Proof',
      sig: 'Signature',
      photo: 'Passport Photo'
    };

    this.svc.existingFiles?.applicants.forEach((applicant, index) => {
      Object.entries(applicant).forEach(([key, fileId]) => {
        if (!fileId) {
          return;
        }

        const value = String(fileId);
        output.push({
          label: `App ${index + 1} - ${docLabels[key] || key}`,
          fileId: value,
          isUrl: this.isUrl(value),
          isBase64: this.isBase64(value)
        });
      });
    });

    const channelPartnerSignature = this.channelPartnerSignatureValue;

    if (channelPartnerSignature) {
      output.push({
        label: 'Channel Partner - Signature',
        fileId: channelPartnerSignature,
        isUrl: this.isUrl(channelPartnerSignature),
        isBase64: this.isBase64(channelPartnerSignature)
      });
    }

    return output;
  }

  get isEditMode(): boolean {
    return this.svc.isEditMode;
  }

  get applicantLabels(): string[] {
    const count = this.form.applicants.length || 1;
    return Array.from({ length: count }, (_, index) => `Applicant ${index + 1}`);
  }

  private get channelPartnerSignatureValue(): string | null {
    return this.section1?.signatures?.['channelPartner'] || this.section1?.channelPartner?.sig || null;
  }
}
