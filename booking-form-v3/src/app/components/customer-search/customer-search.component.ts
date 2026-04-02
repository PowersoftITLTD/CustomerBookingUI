import {
  Component, OnInit, OnDestroy, Output, EventEmitter,
  ElementRef, ViewChild, HostListener
} from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, filter } from 'rxjs/operators';
import { NetsuiteService } from '../../services/netsuite.service';
import { BookingFormService } from '../../services/booking-form.service';
import { BookingRecord } from '../../models/booking-form.model';

@Component({
  selector: 'app-customer-search',
  templateUrl: './customer-search.component.html',
  styleUrls: ['./customer-search.component.scss']
})
export class CustomerSearchComponent implements OnInit, OnDestroy {

  @Output() recordLoaded = new EventEmitter<BookingRecord>();
  @Output() loading       = new EventEmitter<boolean>();
  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;

  // Search input binding
  searchTerm = '';

  // Dropdown state
  results:     BookingRecord[] = [];
  isOpen       = false;
  isSearching  = false;
  searchError  = '';
  noResults    = false;

  // Selected / loaded record state
  selectedRecord: BookingRecord | null = null;
  isLoadingDetail = false;
  loadError        = '';
  isLoaded         = false;

  // Confirmation modal state (shown before overwriting a partially filled form)
  showConfirm     = false;
  pendingRecord:  BookingRecord | null = null;

  private search$   = new Subject<string>();
  private subs      = new Subscription();

  constructor(
    private ns:  NetsuiteService,
    private svc: BookingFormService
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.search$.pipe(
        debounceTime(400),
        distinctUntilChanged(),
        filter(v => v.trim().length >= 2),   // min 2 chars to search
        switchMap(term => {
          this.isSearching = true;
          this.noResults   = false;
          this.searchError = '';
          this.results     = [];
          return this.ns.searchBookingRecords(term);
        })
      ).subscribe({
        next: res => {
          this.isSearching = false;
          this.results     = res.records || [];
          this.noResults   = this.results.length === 0;
          this.isOpen      = true;
        },
        error: err => {
          this.isSearching = false;
          this.searchError = 'Search failed — please try again';
          this.results     = [];
        }
      })
    );
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  // ── Triggered on every keystroke ────────────────────────────────
  onInput(value: string): void {
    this.searchTerm = value;
    if (value.trim().length < 2) {
      this.isOpen    = false;
      this.results   = [];
      this.noResults = false;
      return;
    }
    this.isSearching = true;   // show spinner immediately
    this.search$.next(value.trim());
  }

  // ── User picks a result from the dropdown ───────────────────────
  selectResult(rec: BookingRecord): void {
    this.isOpen      = false;
    this.searchTerm  = rec.displayLabel;

    // If form has data already, ask for confirmation before overwriting
    const hasData = this.svc.hasUnsavedData();
    if (hasData) {
      this.pendingRecord  = rec;
      this.showConfirm    = true;
    } else {
      this.loadBookingDetail(rec);
    }
  }

  // ── Confirmation: proceed ───────────────────────────────────────
  confirmLoad(): void {
    this.showConfirm = false;
    if (this.pendingRecord) this.loadBookingDetail(this.pendingRecord);
    this.pendingRecord = null;
  }

  // ── Confirmation: cancel ────────────────────────────────────────
  cancelLoad(): void {
    this.showConfirm = false;
    this.pendingRecord = null;
    this.searchTerm = '';
  }

  // ── Load full booking record by ID and bind to form ─────────────
  private loadBookingDetail(rec: BookingRecord): void {
    this.isLoadingDetail = true;
    this.isLoaded        = false;
    this.loadError       = '';
    this.selectedRecord  = rec;
    this.loading.emit(true);          // ← tell parent: show overlay spinner

    this.ns.loadBookingRecord(rec.bookingId).subscribe({
      next: (full: BookingRecord) => {
        this.isLoadingDetail = false;
        this.isLoaded        = true;
        this.selectedRecord  = full;
        this.loading.emit(false);     // ← hide overlay spinner

        // Bind all sections back into the form service
        this.svc.loadFromBookingRecord(full);

        this.recordLoaded.emit(full);
      },
      error: (err) => {
        this.isLoadingDetail = false;
        this.loadError       = `Could not load record: ${err.message}`;
        this.loading.emit(false);     // ← hide overlay spinner on error
      }
    });
  }

  // ── Clear the selection ─────────────────────────────────────────
  clear(): void {
    this.searchTerm     = '';
    this.results        = [];
    this.isOpen         = false;
    this.selectedRecord = null;
    this.isLoaded       = false;
    this.loadError      = '';
    this.noResults      = false;
    this.svc.reset();
    setTimeout(() => this.searchInputRef?.nativeElement.focus(), 50);
  }

  // ── Close dropdown when clicking outside ────────────────────────
  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!(e.target as HTMLElement).closest('.cs-wrap')) {
      this.isOpen = false;
    }
  }
}
