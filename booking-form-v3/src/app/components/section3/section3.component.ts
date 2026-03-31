import { Component, OnInit } from '@angular/core';
import { BookingFormService } from '../../services/booking-form.service';
import { Section3 } from '../../models/booking-form.model';

@Component({
  selector: 'app-section3',
  templateUrl: './section3.component.html'
})
export class Section3Component implements OnInit {

  form!: Section3;

  fitnessOptions  = ['Yoga / Meditation','Marathons','Cycling','Exercising'];
  sportsOptions   = ['Cricket','Tennis','Football','Squash','Swimming'];
  eventsOptions   = ['Concert','Plays','Comedy Shows','Food Shows','Sports Events','Club Events'];
  musicOptions    = ['Blues','Indian Classical','Jazz','Bollywood'];
  internetOptions = ['News','Banking & Finance','Sports','Entertainment','Shopping','Social Media','YouTube','Web Series'];
  kidsOptions     = ['Cricket','Tennis','Football','Squash','Watch Movies','Travel'];
  socialOptions   = ['Facebook','Twitter / X','Instagram','Snapchat'];
  travelOptions   = ['Once a Year','Frequently','Rarely'];

  showErrors = false;

  constructor(public svc: BookingFormService) {}

  ngOnInit() {
    this.svc.section3$.subscribe(s => {
      this.form = s;
      if (!this.form.householdCount) {
        this.patch('householdCount', '1');
      }
    });
  }

  trackByIndex(index: number): number { return index; }

  // ── Self row helpers ──────────────────────────────────────────────

  private getSelf() {
    return this.form?.family?.find(m => m.relation === 'Self');
  }

  /** Per-field red-border check — used in template */
  isSelfFieldInvalid(field: 'name' | 'age' | 'livingTogether' | 'maritalStatus' | 'occupation' | 'placeOfOccupation'): boolean {
    if (!this.showErrors) return false;
    const self = this.getSelf();
    if (!self) return true;
    return !(self[field] || '').trim();
  }

  /** True only when ALL 6 Self fields are filled */
  isSelfValid(): boolean {
    const self = this.getSelf();
    if (!self) return false;
    return !!(
      self.name?.trim() &&
      self.age?.trim() &&
      self.livingTogether?.trim() &&
      self.maritalStatus?.trim() &&
      self.occupation?.trim() &&
      self.placeOfOccupation?.trim()
    );
  }

  /** Legacy alias so existing template bindings keep working */
  isSelfSelected(): boolean { return this.isSelfValid(); }

  /** Called by AppComponent before navigating away from Step 2 */
  getValidationState(): { valid: boolean; errorMessage: string } {
    this.showErrors = true;
    if (this.isSelfValid()) {
      return { valid: true, errorMessage: '' };
    }
    return { valid: false, errorMessage: 'Please complete all Self details in Family Members.' };
  }

  /** Returns each missing Self field as a separate string for the modal bullet list */
  getMissingSelfFields(): string[] {
    const self = this.getSelf();
    const missing: string[] = [];
    if (!self?.name?.trim())               missing.push('Self – Name');
    if (!self?.age?.trim())                missing.push('Self – Age');
    if (!self?.livingTogether?.trim())     missing.push('Self – Living Together');
    if (!self?.maritalStatus?.trim())      missing.push('Self – Marital Status');
    if (!self?.occupation?.trim())         missing.push('Self – Occupation');
    if (!self?.placeOfOccupation?.trim())  missing.push('Self – Place of Work / School');
    return missing;
  }

  // ── Patch helpers ─────────────────────────────────────────────────

  patch(field: string, value: any) { this.svc.updateSection3({ [field]: value } as any); }

  toggle(field: string, option: string) {
    const arr = [...(this.form as any)[field] as string[]];
    const i = arr.indexOf(option);
    i >= 0 ? arr.splice(i, 1) : arr.push(option);
    this.patch(field, arr);
  }

  isOn(field: string, option: string): boolean {
    return ((this.form as any)[field] as string[]).includes(option);
  }

  patchFamily(idx: number, field: string, value: any) {
    const family = [...this.form.family];
    family[idx] = { ...family[idx], [field]: value };
    this.patch('family', family);
  }
}
