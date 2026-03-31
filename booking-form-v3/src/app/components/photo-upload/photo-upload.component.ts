import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';

@Component({
  selector: 'app-photo-upload',
  templateUrl: './photo-upload.component.html',
  styleUrls: ['./photo-upload.component.scss']
})
export class PhotoUploadComponent {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
  @Input() label    = 'Applicant';
  @Input() sublabel = '';
  @Input() mandatory = false;
  @Output() photoSelected = new EventEmitter<string>();
  @Output() photoCleared  = new EventEmitter<void>();

  previewUrl: string | null = null;
  hasError = false;
  showMandatoryError = false;

  onFileChange(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) { this.hasError = true; return; }
    this.hasError = false;
    this.showMandatoryError = false;
    const reader = new FileReader();
    reader.onload = (ev) => { this.previewUrl = ev.target?.result as string; this.photoSelected.emit(this.previewUrl); };
    reader.readAsDataURL(file);
  }

  clear(): void {
    this.previewUrl = null; this.hasError = false; this.showMandatoryError = false;
    if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
    this.photoCleared.emit();
  }

  /** Called by parent during form validation to highlight if mandatory + empty */
  triggerValidation(): boolean {
    if (this.mandatory && !this.previewUrl) {
      this.showMandatoryError = true;
      return false;
    }
    return true;
  }

  trigger(): void { this.fileInputRef?.nativeElement.click(); }
}
