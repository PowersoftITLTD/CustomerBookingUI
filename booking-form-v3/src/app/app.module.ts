import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppComponent }         from './app.component';
import { Section1Component }    from './components/section1/section1.component';
import { Section3Component }    from './components/section3/section3.component';
import { Section4Component }    from './components/section4/section4.component';
import { SignaturePadComponent } from './components/signature-pad/signature-pad.component';
import { PhotoUploadComponent }  from './components/photo-upload/photo-upload.component';
import { CustomerSearchComponent } from './components/customer-search/customer-search.component';

import { BookingFormService } from './services/booking-form.service';
import { NetsuiteService }    from './services/netsuite.service';

@NgModule({
  declarations: [
    AppComponent,
    Section1Component,
    Section3Component,
    Section4Component,
    SignaturePadComponent,
    PhotoUploadComponent,
    CustomerSearchComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule
  ],
  providers: [ BookingFormService, NetsuiteService ],
  bootstrap: [ AppComponent ]
})
export class AppModule {}
