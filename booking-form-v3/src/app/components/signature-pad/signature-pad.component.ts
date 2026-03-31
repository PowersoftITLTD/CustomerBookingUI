import {
  Component, ElementRef, ViewChild, Input, Output,
  EventEmitter, AfterViewInit, OnDestroy
} from '@angular/core';

@Component({
  selector: 'app-signature-pad',
  templateUrl: './signature-pad.component.html',
  styleUrls: ['./signature-pad.component.scss']
})
export class SignaturePadComponent implements AfterViewInit, OnDestroy {

  @ViewChild('sigCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() label     = '';
  @Input() mandatory = false;

  @Output() signed  = new EventEmitter<string>();
  @Output() cleared = new EventEmitter<void>();

  isSigned   = false;
  hasError   = false;
  statusText = 'Draw signature here';

  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
  private lastX = 0;
  private lastY = 0;
  private resizeObserver!: ResizeObserver;

  ngAfterViewInit(): void {
    this.initCanvas();
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.canvasRef.nativeElement.parentElement!);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.removeListeners();
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resizeCanvas();
    this.addListeners();
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const rect   = canvas.getBoundingClientRect();
    const saved  = this.isSigned ? this.ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
    canvas.width  = rect.width || 300;
    canvas.height = 100;
    this.setupCtx();
    if (saved) this.ctx.putImageData(saved, 0, 0);
  }

  private setupCtx(): void {
    this.ctx.strokeStyle = '#1C1710';
    this.ctx.lineWidth   = 1.8;
    this.ctx.lineCap     = 'round';
    this.ctx.lineJoin    = 'round';
    this.ctx.imageSmoothingEnabled = true;
  }

  private addListeners(): void {
    const el = this.canvasRef.nativeElement;
    el.addEventListener('mousedown',  this.onMouseDown);
    el.addEventListener('mousemove',  this.onMouseMove);
    el.addEventListener('mouseup',    this.onMouseUp);
    el.addEventListener('mouseleave', this.onMouseUp);
    // passive:false lets us call preventDefault() — stops iPad page scroll during signing
    el.addEventListener('touchstart', this.onTouchStart, { passive: false });
    el.addEventListener('touchmove',  this.onTouchMove,  { passive: false });
    el.addEventListener('touchend',   this.onTouchEnd,   { passive: false });
  }

  private removeListeners(): void {
    const el = this.canvasRef.nativeElement;
    if (!el) return;
    el.removeEventListener('mousedown',  this.onMouseDown);
    el.removeEventListener('mousemove',  this.onMouseMove);
    el.removeEventListener('mouseup',    this.onMouseUp);
    el.removeEventListener('mouseleave', this.onMouseUp);
    el.removeEventListener('touchstart', this.onTouchStart);
    el.removeEventListener('touchmove',  this.onTouchMove);
    el.removeEventListener('touchend',   this.onTouchEnd);
  }

  private onMouseDown = (e: MouseEvent) => {
    this.drawing = true;
    const { x, y } = this.getPos(e);
    this.lastX = x; this.lastY = y;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 0.8, 0, Math.PI * 2);
    this.ctx.fill();
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.drawing) return;
    e.preventDefault();
    const { x, y } = this.getPos(e);
    this.drawStroke(x, y);
  };

  private onMouseUp = () => { if (this.drawing) { this.drawing = false; this.finishStroke(); } };

  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    const { x, y } = this.getTouchPos(t);
    this.drawing = true; this.lastX = x; this.lastY = y;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 0.8, 0, Math.PI * 2);
    this.ctx.fill();
  };

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (!this.drawing) return;
    const { x, y } = this.getTouchPos(e.touches[0]);
    this.drawStroke(x, y);
  };

  private onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    this.drawing = false;
    this.finishStroke();
  };

  private drawStroke(x: number, y: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.lastX = x; this.lastY = y;
  }

  private finishStroke(): void {
    this.isSigned  = true;
    this.hasError  = false;
    this.statusText = '✓ Signature captured';
    this.signed.emit(this.canvasRef.nativeElement.toDataURL('image/png'));
  }

  private getPos(e: MouseEvent) {
    const r = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private getTouchPos(t: Touch) {
    const r = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  clear(): void {
    const c = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, c.width, c.height);
    this.isSigned = false; this.hasError = false;
    this.statusText = 'Draw signature here';
    this.cleared.emit();
  }

  validate(): boolean {
    if (this.mandatory && !this.isSigned) {
      this.hasError = true;
      this.statusText = '⚠ Signature required';
      return false;
    }
    return true;
  }

  getDataUrl(): string {
    return this.isSigned ? this.canvasRef.nativeElement.toDataURL('image/png') : '';
  }
}
