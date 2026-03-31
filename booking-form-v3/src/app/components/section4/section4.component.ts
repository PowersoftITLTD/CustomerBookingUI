import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { BookingFormService } from '../../services/booking-form.service';
import { Section4, KycDocument, KycFileIds } from '../../models/booking-form.model';

@Component({
  selector: 'app-section4',
  templateUrl: './section4.component.html'
})
export class Section4Component implements OnInit, OnChanges  {

  form!: Section4;

  endUserType:string = '';

  @Input() SelectedApplicantTypeSection4: any;

ngOnChanges(changes: SimpleChanges) {
    if (changes['SelectedApplicantTypeSection4']) {
      // console.log(
      //   'Applicant type in section4:',
      //   changes['SelectedApplicantTypeSection4'].currentValue
      // );

      this.endUserType = changes['SelectedApplicantTypeSection4'].currentValue;
    }
  }

  // Tracks files uploaded in THIS session (has base64 data)
  uploadedFiles: Record<string, { label: string; name: string; type: string }> = {};

  idFields = [
    { key: 'pan',      label: 'PAN Card' },
    { key: 'aadhar',   label: 'Aadhar Card' },
    { key: 'dl',       label: 'Driving License' },
    { key: 'passport', label: 'Passport' },
    { key: 'voter',    label: "Voter's ID" }
  ];
  addrFields = [
    { key: 'addrPassport', label: 'Passport'        },
    { key: 'addrAadhar',   label: 'Aadhar Card'      },
    { key: 'addrDl',       label: 'Driving License'  },
    { key: 'addrVoter',    label: "Voter's ID"        },
    { key: 'electricity',  label: 'Electricity Bill' },
    { key: 'mtnl',         label: 'MTNL Bill'         },
    { key: 'bank',         label: 'Bank Statement'    }
  ];
  nriFields = [
    { key: 'nriPassport', label: 'Passport Copy' },
    { key: 'pio',         label: 'PIO Card'       },
    { key: 'oci',         label: 'OCI Card'       }
  ];
  coFields = [
    { key: 'companyPan',      label: 'Company PAN'     },
    { key: 'boardResolution', label: 'Board Resolution' },
    { key: 'incorporation',   label: 'Inc. Certificate' },
    { key: 'moaAoa',          label: 'MOA & AOA'        }
  ];

  // Maps docKey → which existingFiles property holds its File Cabinet ID
  private readonly docKeyToExistingField: Record<string, keyof KycFileIds> = {
    pan: 'pan', aadhar: 'aadhar', dl: 'dl', passport: 'passport', voter: 'voter',
    addrPassport: 'addr', addrAadhar: 'addr', addrDl: 'addr',
    addrVoter: 'addr', electricity: 'addr', mtnl: 'addr', bank: 'addr',
    nriPassport: 'passport'
  };

  constructor(public svc: BookingFormService) {}

  ngOnInit() {
    this.svc.section4$.subscribe(s => {
      this.form = s;
      this.syncUploadedFilesFromForm();
    });
  }

  // Rebuild uploadedFiles display from the s4 model (e.g. draft restore)
  private syncUploadedFilesFromForm(): void {
    if (!this.form) return;
    const rebuilt: Record<string, { label: string; name: string; type: string }> = {};
    this.form.applicants.forEach((app: any, appIdx: number) => {
      Object.entries(app || {}).forEach(([field, doc]: [string, any]) => {
        if (doc?.fileData) {
          const allFields = [...this.idFields, ...this.addrFields, ...this.nriFields, ...this.coFields];
          const fieldDef  = allFields.find(f => f.key === field);
          rebuilt[`${appIdx}-${field}`] = {
            label: `App ${appIdx + 1} — ${fieldDef?.label || field}`,
            name:  doc.fileName || field, type: doc.fileType || 'application/pdf'
          };
        }
      });
    });
    this.uploadedFiles = rebuilt;
  }

  // True if a NEW file was uploaded in this session
  isUploaded(appIdx: number, field: string): boolean {
    return !!(this.form?.applicants[appIdx] as any)?.[field]?.fileData;
  }

  // Returns File Cabinet ID of a previously saved file (edit mode)
  existingFileId(appIdx: number, field: string): string | null {
    const existing = this.svc.existingFiles;
    if (!existing) return null;
    const appFiles = existing.applicants[appIdx];
    if (!appFiles) return null;
    const mapped = this.docKeyToExistingField[field];
    if (!mapped) return null;
    return (appFiles as any)[mapped] || null;
  }

  hasPriorFile(appIdx: number, field: string): boolean {
    return !!this.existingFileId(appIdx, field);
  }

  onFileChange(e: Event, appIdx: number, field: string, sectionLabel: string, docLabel: string): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File too large — max 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const doc: KycDocument = {
        ticked: true, fileName: file.name, fileType: file.type,
        fileSize: file.size, fileData: ev.target?.result as string
      };
      this.svc.updateKycDocument(appIdx, field, doc);
      this.uploadedFiles[`${appIdx}-${field}`] = {
        label: `App ${appIdx + 1} — ${sectionLabel} · ${docLabel}`,
        name: file.name, type: file.type
      };
    };
    reader.readAsDataURL(file);
  }

  removeFile(uid: string): void {
    const parts  = uid.split('-');
    const appIdx = parseInt(parts[0]);
    const field  = parts.slice(1).join('-');
    this.svc.updateKycDocument(appIdx, field, undefined);
    delete this.uploadedFiles[uid];
  }

  get uploadedKeys(): string[] { return Object.keys(this.uploadedFiles); }
  get isEditMode():   boolean  { return this.svc.isEditMode; }
  get applicantLabels(): string[] {
    const count = this.form?.applicants?.length || 1;
    return Array.from({ length: count }, (_, i) => `Applicant ${i + 1}`);
  }

  // Summary list of all previously saved files (shown in edit mode)
  get existingSummary(): Array<{ label: string; fileId: string }> {
    const existing = this.svc.existingFiles;
    if (!existing) return [];
    const out: Array<{ label: string; fileId: string }> = [];
    const docLabels: Record<string, string> = {
      pan: 'PAN Card', aadhar: 'Aadhar', dl: 'Driving Licence',
      passport: 'Passport', voter: "Voter's ID",
      addr: 'Address Proof', sig: 'Signature', photo: 'Passport Photo'
    };
    existing.applicants.forEach((app, idx) => {
      Object.entries(app).forEach(([key, fileId]) => {
        if (fileId) out.push({ label: `App ${idx + 1} — ${docLabels[key] || key}`, fileId: fileId as string });
      });
    });
    return out;
  }
}
