import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-photo-upload',
  templateUrl: './photo-upload.component.html',
  styleUrls: ['./photo-upload.component.scss']
})
export class PhotoUploadComponent implements OnChanges {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  @Input() label = 'Applicant';
  @Input() sublabel = '';
  @Input() mandatory = false;

  /** URL from NetSuite existingFiles — shown as preview when form loads */
  @Input() existingUrl: string | null = null;

  @Output() photoSelected = new EventEmitter<string>();
  @Output() photoCleared = new EventEmitter<void>();

  previewUrl: string | null = null;
  hasError = false;
  showMandatoryError = false;

  ngOnChanges(changes: SimpleChanges): void {
    // When existingUrl arrives from NS, show it as preview
    // (only if user hasn't already selected a new file)
    if (changes['existingUrl'] && this.existingUrl && !this.previewUrl) {
      this.previewUrl = this.existingUrl;
    }
  }

  onFileChange(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      this.hasError = true; return;
    }
    this.hasError = false;
    this.showMandatoryError = false;
    const reader = new FileReader();
    reader.onload = (ev) => {
      this.previewUrl = ev.target?.result as string;
      this.photoSelected.emit(this.previewUrl);
    };
    reader.readAsDataURL(file);
  }

  clear(): void {
    this.previewUrl = null;
    this.hasError = false;
    this.showMandatoryError = false;
    if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = '';
    this.photoCleared.emit();
  }

  /** Called by parent during form validation */
  triggerValidation(): boolean {
    if (this.mandatory && !this.previewUrl) {
      this.showMandatoryError = true;
      return false;
    }
    return true;
  }

  trigger(): void { this.fileInputRef?.nativeElement.click(); }
}
