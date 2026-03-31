import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { BookingFormPayload, NetSuiteAttachment, Section4, NSConfig, BookingRecord } from '../models/booking-form.model';
import { environment } from '../../environments/environment';

export interface MobileCheckResult {
  exists:       boolean;
  customerId?:  string;
  customerName?: string;
  matches?:     Array<{ customerId: string; customerName: string; mobile: string }>;
  error?:       string;
}

// ── Injected by the Suitelet's GET handler into index.html ──────────────────
// window.__NS_CONFIG__ is set BEFORE Angular bootstraps so it is always ready.
// In local dev (ng serve) this will be undefined — the fallback URL is used.
declare global {
  interface Window { __NS_CONFIG__?: NSConfig; }
}

@Injectable({ providedIn: 'root' })
export class NetsuiteService {

  constructor(private http: HttpClient) {}

  // ── Suitelet URL ─────────────────────────────────────────────────────────
  // FIX: No https.HostType.APPLICATION needed.
  // The URL is built server-side in the Suitelet using:
  //   runtime.getCurrentScript().id + deploymentId  (root-relative path)
  // and injected into the page as window.__NS_CONFIG__.suiteletUrl.
  // Angular simply reads it here — zero config, zero auth headers required.
  private get suiteletUrl(): string {
    return window.__NS_CONFIG__?.suiteletUrl
      ?? environment.devSuiteletUrl
      ?? '/api/booking';
  }

  get nsUser(): NSConfig {
    return window.__NS_CONFIG__ ?? {
      suiteletUrl: environment.devSuiteletUrl,
      userId: 'dev', userName: 'Developer', role: 'dev', subsidiary: ''
    };
  }

  // ── Check mobile duplicate against NetSuite ──────────────────────────────
  // Called on blur of the Mobile field in Section1.
  // Returns Observable<MobileCheckResult>.
  // Errors are caught and returned as { exists: false } so they never block the UI.
  checkMobileDuplicate(mobile: string): Observable<MobileCheckResult> {
    const base = this.suiteletUrl;
    const url  = `${base}&action=checkMobile&mobile=${encodeURIComponent(mobile)}`;

    return this.http.get<MobileCheckResult>(url).pipe(
      catchError(err => {
        console.warn('Mobile duplicate check failed (non-blocking):', err);
        return of({ exists: false } as MobileCheckResult);
      })
    );
  }

  // ── Search booking records (customer combo) ──────────────────────────────
  // Calls GET ?action=searchBookings&q=<term>
  // Returns list of BookingRecord summary objects for the dropdown.
  searchBookingRecords(term: string): Observable<{ records: BookingRecord[] }> {
    const url = `${this.suiteletUrl}&action=searchBookings&q=${encodeURIComponent(term)}`;
    return this.http.get<{ records: BookingRecord[] }>(url).pipe(
      catchError(err => {
        console.warn('Booking search failed:', err);
        return of({ records: [] });
      })
    );
  }

  // ── Load full booking record by ID ───────────────────────────────────────
  // Calls GET ?action=loadBooking&id=<bookingId>
  // Returns a fully-populated BookingRecord with section1 + section3 data.
  loadBookingRecord(bookingId: string): Observable<BookingRecord> {
    const url = `${this.suiteletUrl}&action=loadBooking&id=${encodeURIComponent(bookingId)}`;
    return this.http.get<BookingRecord>(url).pipe(
      map((res: any) => {
        if (res?.success === false) throw new Error(res.error || 'Load failed');
        return res as BookingRecord;
      }),
      catchError(err => throwError(() => new Error(err?.error?.error || err?.message || 'Load failed')))
    );
  }

  // ── Submit form ──────────────────────────────────────────────────────────
  submitBookingForm(payload: BookingFormPayload): Observable<any> {
    const body = this.buildPayload(payload);

    // No Authorization header needed — NetSuite session cookie handles auth
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.http.post(this.suiteletUrl, body, { headers }).pipe(
      map((res: any) => {
        if (res?.success) {
          return { success: true, customerId: res.customerId, bookingId: res.bookingId, message: res.message };
        }
        throw new Error(res?.error || 'NetSuite returned an error');
      }),
      catchError(err => {
        const msg = err?.error?.error || err?.message || 'Submission failed';
        return throwError(() => new Error(msg));
      })
    );
  }

  // ── Build payload ────────────────────────────────────────────────────────
  buildPayload(form: BookingFormPayload) {
    const attachments = this.extractAttachments(form.section4);

    // Add signature images
    Object.entries(form.section1.signatures || {}).forEach(([key, data]) => {
      if (data) attachments.push({
        uid: `sig-${key}`, label: `Signature — ${key}`,
        applicantIndex: 0, documentType: 'Signature',
        fileName: `signature-${key}.png`, fileType: 'image/png', fileData: data
      });
    });

    // Add passport photos
    Object.entries(form.section1.photos || {}).forEach(([key, data]) => {
      if (data) attachments.push({
        uid: `photo-${key}`, label: `Photo — ${key}`,
        applicantIndex: parseInt(key.replace('applicant','')) - 1 || 0,
        documentType: 'Passport Photo', fileName: `photo-${key}.jpg`,
        fileType: 'image/jpeg', fileData: data
      });
    });

    // action='update' when editing an existing record, 'create' for new
    const isUpdate = !!(form.editBookingId);

    return {
      action:          isUpdate ? 'update' : 'create',
      editBookingId:   form.editBookingId  || null,
      editCustomerId:  form.editCustomerId || null,
      section1:        form.section1,
      section3:        form.section3,
      section4:        form.section4,
      attachments,
      submittedAt:     form.submittedAt,
      formVersion:     form.formVersion,
      submittedBy:     this.nsUser.userName,
      nsUserId:        this.nsUser.userId
    };
  }

  // ── Extract KYC docs as attachment objects ───────────────────────────────
  private extractAttachments(s4: Section4): NetSuiteAttachment[] {
    const out: NetSuiteAttachment[] = [];
    const docMap: Record<string, string> = {
      pan: 'PAN Card', aadhar: 'Aadhar Card', dl: 'Driving License',
      passport: 'Passport', voter: "Voter's ID",
      addrPassport: 'Addr Proof - Passport', addrAadhar: 'Addr Proof - Aadhar',
      addrDl: 'Addr Proof - DL', addrVoter: 'Addr Proof - Voter ID',
      electricity: 'Electricity Bill', mtnl: 'MTNL Bill', bank: 'Bank Statement',
      nriPassport: 'NRI Passport', pio: 'PIO Card', oci: 'OCI Card',
      companyPan: 'Company PAN', boardResolution: 'Board Resolution',
      incorporation: 'Inc. Certificate', moaAoa: 'MOA & AOA'
    };
    (s4?.applicants || []).forEach((app: any, idx: number) => {
      Object.entries(app || {}).forEach(([field, doc]: [string, any]) => {
        if (doc?.fileData) {
          out.push({
            uid: `kyc-${idx}-${field}`,
            label: `App ${idx + 1} — ${docMap[field] || field}`,
            applicantIndex: idx,
            documentType: docMap[field] || field,
            fileName: doc.fileName || `${field}-app${idx + 1}.pdf`,
            fileType: doc.fileType || 'application/pdf',
            fileData: doc.fileData
          });
        }
      });
    });
    return out;
  }
}
