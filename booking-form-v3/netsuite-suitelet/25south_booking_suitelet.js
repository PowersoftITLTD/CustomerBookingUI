/**
 * ═══════════════════════════════════════════════════════════════════════
 * 25 SOUTH — BOOKING FORM SUITELET  (v4 — Full Save)
 * File:        25south_booking_suitelet.js
 * SuiteScript: 2.1
 * Type:        Suitelet
 *
 * WHAT THIS VERSION ADDS OVER v3:
 *   ✓ Saves ALL KYC documents (PAN, Aadhar, DL, Passport, Voter ID,
 *     Address Proofs, NRI docs, Company docs) to File Cabinet
 *   ✓ Saves ALL applicant signatures as PNG files to File Cabinet
 *   ✓ Saves ALL passport photos as JPG/PNG files to File Cabinet
 *   ✓ Attaches every saved file to both Customer + Booking records
 *   ✓ Stores per-file Cabinet IDs on the Booking record fields
 *   ✓ Full custom record field prototype (90+ fields) documented below
 *
 * DEPLOYMENT CHECKLIST:
 *   1. Build Angular + run inliner → dist/index.inlined.html
 *   2. Upload index.inlined.html to File Cabinet → ANGULAR_INDEX_FILE_ID
 *   3. Create "25south-kyc-uploads" folder     → KYC_UPLOAD_FOLDER_ID
 *   4. Create "25south-signatures" folder      → SIGNATURES_FOLDER_ID
 *   5. Fill in the three constants below
 *   6. Upload this suitelet → Customization → Scripting → Scripts → New
 *   7. Deploy → Status: Released
 * ═══════════════════════════════════════════════════════════════════════
 */

/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/file', 'N/log', 'N/runtime','N/search'],
(record, file, log, runtime,search) => {

  // ══════════════════════════════════════════════════════════════════
  // CONFIGURATION — UPDATE ALL THREE VALUES BEFORE DEPLOYING
  // ══════════════════════════════════════════════════════════════════

  /** Internal File ID of index.inlined.html in File Cabinet */
  const ANGULAR_INDEX_FILE_ID = '390504';

  /** File Cabinet folder ID for KYC documents */
  const KYC_UPLOAD_FOLDER_ID = '78188';

  /** File Cabinet folder ID for Signatures + Passport Photos
   *  Create: Documents → File Cabinet → New Folder → "25south-signatures" */
  const SIGNATURES_FOLDER_ID = '78189';

  // ══════════════════════════════════════════════════════════════════
  // ENTRY POINT
  // ══════════════════════════════════════════════════════════════════
  const onRequest = (context) => {
    const method = context.request.method;

    // GET routing by ?action= param
    if (method === 'GET') {
      const action = context.request.parameters.action;
      if (action === 'checkMobile')    return onCheckMobile(context,search);
      if (action === 'searchBookings') return onSearchBookings(context,search);
      if (action === 'loadBooking')    return onLoadBooking(context);
      return onGet(context);
    }

    if (method === 'POST') return onPost(context);
  };

  // ══════════════════════════════════════════════════════════════════
  // GET ?action=checkMobile&mobile=XXXXXXXXXX
  // Called by Angular on blur of the Mobile field.
  // Searches NetSuite Customer records for an existing mobilephone match.
  //
  // Response:
  //   { exists: false }
  //   { exists: true, customerId: 123, customerName: 'John Doe' }
  //   { exists: false, error: '...' }   ← on search error (non-blocking)
  //
  // Uses N/search so it runs server-side — no CORS issues, no auth token.
  // ══════════════════════════════════════════════════════════════════
  const onCheckMobile = (context,search) => {
    context.response.setHeader({ name: 'Content-Type',                value: 'application/json' });
    context.response.setHeader({ name: 'Cache-Control',               value: 'no-store' });
    context.response.setHeader({ name: 'Access-Control-Allow-Origin', value: '*' });

    const mobile = (context.request.parameters.mobile || '').trim();

    // Return immediately if number is too short to be valid
    if (mobile.length < 7) {
      context.response.write(JSON.stringify({ exists: false }));
      return;
    }

    try {
      // Lazy-require N/search inside the function so the module list stays minimal
      //const search = require('N/search');

      // Search Customer records where mobilephone = the supplied number.
      // We also strip leading country-code variants (+91, 0) for robustness.
      const stripped = mobile.replace(/^\+91|^0/, '');

      const results = search.create({
        type: search.Type.CUSTOMER,
        filters: [
          search.createFilter({
            name:     'mobilephone',
            operator: search.Operator.IS,
            values:   [mobile]          // exact match first
          })
        ],
        columns: [
          search.createColumn({ name: 'internalid' }),
          search.createColumn({ name: 'entityid'   }),
          search.createColumn({ name: 'firstname'  }),
          search.createColumn({ name: 'lastname'   }),
          search.createColumn({ name: 'mobilephone'})
        ]
      }).run().getRange({ start: 0, end: 5 });   // max 5 matches

      // If no exact match, try the stripped version (without country code)
      let finalResults = results;
      if (results.length === 0 && stripped !== mobile) {
        finalResults = search.create({
          type: search.Type.CUSTOMER,
          filters: [
            search.createFilter({
              name:     'mobilephone',
              operator: search.Operator.IS,
              values:   [stripped]
            })
          ],
          columns: [
            search.createColumn({ name: 'internalid'  }),
            search.createColumn({ name: 'entityid'    }),
            search.createColumn({ name: 'firstname'   }),
            search.createColumn({ name: 'lastname'    }),
            search.createColumn({ name: 'mobilephone' })
          ]
        }).run().getRange({ start: 0, end: 5 });
      }

      if (finalResults.length === 0) {
        context.response.write(JSON.stringify({ exists: false }));
        return;
      }

      // Build a list of matching customers to show in the warning
      const matches = finalResults.map(r => ({
        customerId:   r.getValue('internalid'),
        customerName: [
          r.getValue('firstname'),
          r.getValue('lastname')
        ].filter(Boolean).join(' ') || r.getValue('entityid'),
        mobile: r.getValue('mobilephone')
      }));

      context.response.write(JSON.stringify({
        exists:  true,
        matches,                           // array — could be more than one
        // Convenience fields for the common single-match case
        customerId:   matches[0].customerId,
        customerName: matches[0].customerName
      }));

      log.debug('25South checkMobile', `Duplicate found for ${mobile}: ${matches[0].customerName}`);

    } catch (e) {
      // Search failure must NOT block the user — return exists:false with error logged
      log.error('25South checkMobile', e.message);
      context.response.write(JSON.stringify({ exists: false, error: e.message }));
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // GET ?action=searchBookings&q=<term>
  //
  // Full-text search across customrecord_25south_booking.
  // Searches simultaneously across:
  //   - App1 first+last name   (custrecord_25s_app1_fname / lname)
  //   - Mobile                 (custrecord_25s_mobile)
  //   - Email                  (custrecord_25s_email)
  //   - Project name           (custrecord_25s_project)
  //   - Flat no                (custrecord_25s_flat_no)
  //   - Internal booking ID    (internalid — numeric exact match)
  //
  // Response: { records: BookingRecord[] }  (max 20 results)
  // ══════════════════════════════════════════════════════════════════
  const onSearchBookings = (context,search) => {
    context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
    context.response.setHeader({ name: 'Cache-Control', value: 'no-store' });

    const q = (context.request.parameters.q || '').trim();

    if (q.length < 6) {
      context.response.write(JSON.stringify({ records: [] }));
      return;
    }

    try {
      //const search = require('N/search');

      // Build OR filter group — any field containing the search term
      const orFilters = [
        search.createFilter({ name: 'custrecord_25s_app1_fname', operator: search.Operator.CONTAINS, values: [q] }),
        search.createFilter({ name: 'custrecord_25s_app1_lname', operator: search.Operator.CONTAINS, values: [q] }),
        search.createFilter({ name: 'custrecord_25s_mobile',     operator: search.Operator.CONTAINS, values: [q] }),
        search.createFilter({ name: 'custrecord_25s_email',      operator: search.Operator.CONTAINS, values: [q] }),
        search.createFilter({ name: 'custrecord_25s_project',    operator: search.Operator.CONTAINS, values: [q] }),
        search.createFilter({ name: 'custrecord_25s_flat_no',    operator: search.Operator.CONTAINS, values: [q] }),
      ];

      // If q looks like an integer, also search by internal ID
      if (/^\d+$/.test(q)) {
        orFilters.push(
          search.createFilter({ name: 'internalid', operator: search.Operator.IS, values: [q] })
        );
      }

      log.debug('Start Searching', `Start Searching`);

      // NetSuite needs OR expressed as ['filter', 'OR', 'filter', 'OR', ...]
      const filterExpression = [];
      orFilters.forEach((f, i) => {
        log.debug('read param', f);
        filterExpression.push([f.name, f.operator, (context.request.parameters.q || '').trim()]);
        if (i < orFilters.length - 1) filterExpression.push('OR');
      });

      const results = search.create({
        type: 'customrecord_25south_booking',
        filters: filterExpression,
        columns: [
          search.createColumn({ name: 'internalid'              }),
          search.createColumn({ name: 'custrecord_25s_customer' }),
          search.createColumn({ name: 'custrecord_25s_app1_fname' }),
          search.createColumn({ name: 'custrecord_25s_app1_mname' }),
          search.createColumn({ name: 'custrecord_25s_app1_lname' }),
          search.createColumn({ name: 'custrecord_25s_mobile'   }),
          search.createColumn({ name: 'custrecord_25s_email'    }),
          search.createColumn({ name: 'custrecord_25s_project'  }),
          search.createColumn({ name: 'custrecord_25s_wing'     }),
          search.createColumn({ name: 'custrecord_25s_flat_no'  }),
          search.createColumn({ name: 'custrecord_25s_app_date' }),
        ]
      }).run().getRange({ start: 0, end: 20 });

      const records = results.map(r => {
        const bookingId    = r.getValue('internalid');
        const customerId   = r.getValue('custrecord_25s_customer');
        const firstName    = r.getValue('custrecord_25s_app1_fname') || '';
        const middleName   = r.getValue('custrecord_25s_app1_mname') || '';
        const lastName     = r.getValue('custrecord_25s_app1_lname') || '';
        const customerName = [firstName, middleName, lastName].filter(Boolean).join(' ') || `Booking #${bookingId}`;
        const project      = r.getValue('custrecord_25s_project') || '';
        const wing         = r.getValue('custrecord_25s_wing')    || '';
        const flatNo       = r.getValue('custrecord_25s_flat_no') || '';
        const mobile       = r.getValue('custrecord_25s_mobile')  || '';
        const email        = r.getValue('custrecord_25s_email')   || '';

        const flatPart     = [wing, flatNo].filter(Boolean).join('-');
        const displayLabel = [customerName, project, flatPart].filter(Boolean).join(' · ');

        return { bookingId, customerId, displayLabel, customerName, mobile, email, project, wing, flatNo };
      });

      context.response.write(JSON.stringify({ records }));

      log.debug('25South searchBookings', `q="${q}" → ${records.length} results`);

    } catch (e) {
      log.error('25South searchBookings', e.message);
      context.response.write(JSON.stringify({ records: [], error: e.message }));
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // GET ?action=loadBooking&id=<bookingId>
  //
  // Loads a single customrecord_25south_booking by internal ID and
  // maps ALL stored fields back into the Section1 + Section3 shapes
  // that Angular's BookingFormService.loadFromBookingRecord() expects.
  //
  // Response: BookingRecord (with section1 + section3 populated)
  // ══════════════════════════════════════════════════════════════════
  const onLoadBooking = (context) => {
    context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
    context.response.setHeader({ name: 'Cache-Control', value: 'no-store' });

    const bookingId = (context.request.parameters.id || '').trim();

    if (!bookingId) {
      context.response.write(JSON.stringify({ success: false, error: 'Missing id parameter' }));
      return;
    }

    try {
      const rec = record.load({
        type: 'customrecord_25south_booking',
        id:   bookingId
      });

      // ── Helper: safe field read ──────────────────────────────────
      const gv  = (f) => { try { return rec.getValue(f) || ''; } catch(e) { return ''; } };
      const gvb = (f) => { try { return !!rec.getValue(f); }     catch(e) { return false; } };
      const gvn = (f) => { try { return rec.getValue(f) || null; } catch(e) { return null; } };

      // ── Build applicant objects ──────────────────────────────────
      const buildApplicant = (n) => ({
        title:       '',
        firstName:   gv(`custrecord_25s_app${n}_fname`),
        middleName:  gv(`custrecord_25s_app${n}_mname`),
        lastName:    gv(`custrecord_25s_app${n}_lname`),
        relation:    n > 1 ? gv(`custrecord_25s_app${n}_relation`) : '',
        dob:         gv(`custrecord_25s_app${n}_dob`),
        anniversary: '',
        pan:         gv(`custrecord_25s_app${n}_pan`),
        occupation:  gv(`custrecord_25s_app${n}_occ`)
      });

      // ── Section 1 ────────────────────────────────────────────────
      const section1 = {
        applicationDate:       gv('custrecord_25s_app_date'),
        applicants:            [1,2,3,4].map(buildApplicant),

        residenceAddress:      gv('custrecord_25s_res_addr'),
        correspondenceAddress: gv('custrecord_25s_corr_addr'),
        ownership:             '',
        otherProp:             '',
        otherPropCity:         '',

        profession:            gv('custrecord_25s_profession'),
        organization:          gv('custrecord_25s_organization'),
        designation:           gv('custrecord_25s_designation'),
        officeAddress:         '',
        businessCard:          false,

        mobile:                gv('custrecord_25s_mobile'),
        residencePhone:        '',
        officePhone:           '',
        email:                 gv('custrecord_25s_email'),

        residentialStatus:     gv('custrecord_25s_res_status'),
        nriCountry:            gv('custrecord_25s_nri_country'),
        localContactNo:        '',
        localContactPerson:    '',

        flat: {
          projectName:   gv('custrecord_25s_project'),
          wing:          gv('custrecord_25s_wing'),
          flatNo:        gv('custrecord_25s_flat_no'),
          floor:         gv('custrecord_25s_floor'),
          configuration: gv('custrecord_25s_config'),
          bhkType:       gv('custrecord_25s_bhk'),
          reraCarpet:    gv('custrecord_25s_rera_carpet'),
          alongWithArea: gv('custrecord_25s_along_area'),
          cpNo:          gv('custrecord_25s_cp_no'),
          cpLevel:       gv('custrecord_25s_cp_level'),
          cpType:        gv('custrecord_25s_cp_type'),
          saleValue:     gv('custrecord_25s_sale_value'),
          saleValueWords:gv('custrecord_25s_sale_words'),
          endUse:        gv('custrecord_25s_end_use')
        },

        payment: {
          chequeNo:     gv('custrecord_25s_cheque_no'),
          dated:        gv('custrecord_25s_cheque_date'),
          amount:       gv('custrecord_25s_amount'),
          amountWords:  gv('custrecord_25s_amount_words'),
          drawnOn:      gv('custrecord_25s_drawn_on'),
          costSheetRef: gv('custrecord_25s_cost_sheet')
        },

        funding: {
          loanOpted:   gv('custrecord_25s_loan_opted'),
          bankName:    gv('custrecord_25s_bank_name'),
          bankContact: '',
          ownContrib:  gv('custrecord_25s_own_contrib'),
          homeLoan:    gv('custrecord_25s_home_loan_pct')
        },

        source:      splitComma(gv('custrecord_25s_source')),
        sourceOther: '',

        channelPartner: {
          applicable: gvb('custrecord_25s_cp_applicable'),
          name:       gv('custrecord_25s_cp_name'),
          contact:    '',
          mobile:     gv('custrecord_25s_cp_mobile'),
          landline:   '',
          email:      gv('custrecord_25s_cp_email'),
          remarks:    '',
          rera:       gv('custrecord_25s_cp_rera'),
          gst:        gv('custrecord_25s_cp_gst'),
          brokerage:  gv('custrecord_25s_cp_brokerage')
        },

        reference: { type: '', name: '', contact: '', email: '', property: '', apartment: '' },

        tncAccepted: gvb('custrecord_25s_tnc_accepted'),
        signatures:  {},
        photos:      {}
      };

      // ── Section 3 ────────────────────────────────────────────────
      const section3 = {
        householdCount:  gv('custrecord_25s_household'),
        family: [
          { relation: 'Self',     name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
          { relation: 'Spouse',   name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
          { relation: 'Child 1',  name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
          { relation: 'Child 2',  name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
          { relation: 'Parent 1', name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' },
          { relation: 'Parent 2', name: '', age: '', livingTogether: '', maritalStatus: '', occupation: '', placeOfOccupation: '' }
        ],
        fitness:        splitComma(gv('custrecord_25s_fitness')),
        fitnessOther:   '',
        sports:         splitComma(gv('custrecord_25s_sports')),
        sportsOther:    '',
        events:         splitComma(gv('custrecord_25s_events')),
        eventsOther:    '',
        music:          splitComma(gv('custrecord_25s_music')),
        musicOther:     '',
        internet:       splitComma(gv('custrecord_25s_internet')),
        internetOther:  '',
        lastApps:       gv('custrecord_25s_last_apps'),
        kidsActivities: splitComma(gv('custrecord_25s_kids_act')),
        kidsOther:      '',
        travelAbroad:   gv('custrecord_25s_travel'),
        carsDriven:     gv('custrecord_25s_cars'),
        clubMembership: gv('custrecord_25s_clubs') !== 'No' && gv('custrecord_25s_clubs') ? 'Yes' : 'No',
        clubNames:      gv('custrecord_25s_clubs') !== 'No' ? gv('custrecord_25s_clubs') : '',
        socialMedia:    splitComma(gv('custrecord_25s_social_media')),
        socialOther:    ''
      };

      // ── Build existingFiles map (file IDs per applicant per doc type) ─
      const existingFiles = {
        applicants: [1,2,3,4].map(n => ({
          pan:      gv(`custrecord_25s_file_pan_${n}`)      || null,
          aadhar:   gv(`custrecord_25s_file_aadhar_${n}`)   || null,
          dl:       gv(`custrecord_25s_file_dl_${n}`)       || null,
          passport: gv(`custrecord_25s_file_passport_${n}`) || null,
          voter:    gv(`custrecord_25s_file_voter_${n}`)    || null,
          addr:     gv(`custrecord_25s_file_addr_${n}`)     || null,
          sig:      gv(`custrecord_25s_file_sig_${n}`)      || null,
          photo:    gv(`custrecord_25s_file_photo_${n}`)    || null,
        }))
      };

      // ── Build response ───────────────────────────────────────────
      const customerId   = gv('custrecord_25s_customer');
      const a1           = section1.applicants[0];
      const customerName = [a1.firstName, a1.middleName, a1.lastName].filter(Boolean).join(' ') || `Booking #${bookingId}`;
      const flatPart     = [section1.flat.wing, section1.flat.flatNo].filter(Boolean).join('-');
      const displayLabel = [customerName, section1.flat.projectName, flatPart].filter(Boolean).join(' · ');

      context.response.write(JSON.stringify({
        bookingId,
        customerId,
        displayLabel,
        customerName,
        mobile:        section1.mobile,
        email:         section1.email,
        projectName:   section1.flat.projectName,
        wing:          section1.flat.wing,
        flatNo:        section1.flat.flatNo,
        section1,
        section3,
        existingFiles
      }));

      log.debug('25South loadBooking', `Loaded booking ${bookingId} for ${customerName}`);

    } catch (e) {
      log.error('25South loadBooking', e.message);
      context.response.write(JSON.stringify({ success: false, error: e.message }));
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // GET — Serve inlined Angular HTML with injected NS config
  // ══════════════════════════════════════════════════════════════════
  const onGet = (context) => {
    try {
      const indexFile = file.load({ id: ANGULAR_INDEX_FILE_ID });
      let   html      = indexFile.getContents();

      const script      = runtime.getCurrentScript();
      const suiteletUrl = '/app/site/hosting/scriptlet.nl'
        + '?script='  + script.id
        + '&deploy='  + script.deploymentId;

      const user = runtime.getCurrentUser();

      const injection = `
  <!-- 25 South NS Config — injected by Suitelet -->
  <script>
    window.__NS_CONFIG__ = {
      suiteletUrl: '${suiteletUrl}',
      userId:      '${user.id}',
      userName:    '${escapeJs(user.name)}',
      role:        '${user.role}',
      subsidiary:  '${user.subsidiary || ''}'
    };
  </script>`;

      html = html.replace('</head>', injection + '\n</head>');

      context.response.setHeader({ name: 'Content-Type', value: 'text/html; charset=utf-8' });
      context.response.setHeader({ name: 'X-Frame-Options', value: 'SAMEORIGIN' });
      context.response.write(html);

      log.debug('25South GET', `Served to: ${user.name} (${user.id})`);

    } catch (e) {
      log.error('25South GET Error', e.message);
      context.response.write(`
        <html><head><style>body{font-family:sans-serif;padding:48px;background:#F7F3EC}</style></head>
        <body>
          <h2 style="font-family:Georgia;font-weight:300;letter-spacing:3px">25 South Booking Form</h2>
          <p style="color:#C0392B"><strong>Config Error:</strong> ${e.message}</p>
          <ul style="font-size:13px;color:#7A6E5F;line-height:2">
            <li>ANGULAR_INDEX_FILE_ID points to the correct File Cabinet internal ID?</li>
            <li>Did you upload index.inlined.html (not the source index.html)?</li>
          </ul>
        </body></html>`);
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // POST — Full save:
  //   1. Save KYC documents to File Cabinet
  //   2. Save Signatures to File Cabinet
  //   3. Save Passport Photos to File Cabinet
  //   4. Create Customer record
  //   5. Create custom Booking record (with file IDs stored on fields)
  //   6. Attach all files to both records
  // ══════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════
  // POST — Routes to CREATE or UPDATE based on body.action
  // ══════════════════════════════════════════════════════════════════
  const onPost = (context) => {
    context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
    try {
      const body = JSON.parse(context.request.body);
      if (body.action === 'update') return onUpdate(context, body);
      return onCreate(context, body);
    } catch (e) {
      log.error('25South POST Error', `${e.message}\n${e.stack}`);
      context.response.write(JSON.stringify({ success: false, error: e.message }));
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // CREATE — New booking: saves files, creates Customer + Booking records
  // ══════════════════════════════════════════════════════════════════
  const onCreate = (context, body) => {
    const s1   = body.section1    || {};
    const s3   = body.section3    || {};
    const s4   = body.section4    || {};
    const atts = body.attachments || [];

    log.audit('25South CREATE', `KYC attachments: ${atts.length}`);

    const kycFileMap   = saveKycDocuments(atts);
    const sigFileMap   = saveSignatures(s1.signatures || {});
    const photoFileMap = savePhotos(s1.photos || {});

    const customerId = createCustomer(s1, s3);
    log.audit('25South CREATE', `Customer created: ${customerId}`);

    const bookingId = createBookingRecord(
      customerId, s1, s3, s4, body.submittedAt,
      kycFileMap, sigFileMap, photoFileMap
    );
    log.audit('25South CREATE', `Booking created: ${bookingId}`);

    const allFileIds = [
      ...Object.values(kycFileMap).map(f => f.fileId),
      ...Object.values(sigFileMap).map(f => f.fileId),
      ...Object.values(photoFileMap).map(f => f.fileId)
    ].filter(Boolean);

    let attachedCount = 0;
    allFileIds.forEach(fileId => {
      try {
        attachToRecord(fileId, record.Type.CUSTOMER,           customerId);
        attachToRecord(fileId, 'customrecord_25south_booking', bookingId);
        attachedCount++;
      } catch (e) { log.error('25South Attach', `${fileId}: ${e.message}`); }
    });

    context.response.write(JSON.stringify({
      success: true, customerId, bookingId,
      kycFiles: Object.keys(kycFileMap).length,
      signatures: Object.keys(sigFileMap).length,
      photos: Object.keys(photoFileMap).length,
      attachedFiles: attachedCount,
      submittedAt: body.submittedAt,
      message: `Booking created. Customer: ${customerId} | Booking: ${bookingId} | Files: ${attachedCount}`
    }));
  };

  // ══════════════════════════════════════════════════════════════════
  // UPDATE — Existing booking: updates Customer + Booking records in-place,
  //          saves only NEW attachments uploaded in this session
  //
  // Uses record.submitFields() for atomic partial updates — only fields
  // that have values are written, existing values are not blanked.
  // ══════════════════════════════════════════════════════════════════
  const onUpdate = (context, body) => {
    const bookingId  = body.editBookingId;
    const customerId = body.editCustomerId;
    const s1   = body.section1    || {};
    const s3   = body.section3    || {};
    const s4   = body.section4    || {};
    const atts = body.attachments || [];

    if (!bookingId || !customerId) {
      context.response.write(JSON.stringify({
        success: false,
        error:   'editBookingId and editCustomerId are required for update'
      }));
      return;
    }

    log.audit('25South UPDATE', `Booking: ${bookingId} | Customer: ${customerId}`);

    // ── 1. Save only NEW attachments (user re-uploaded in this session) ──
    const kycFileMap   = saveKycDocuments(atts);
    const sigFileMap   = saveSignatures(s1.signatures || {});
    const photoFileMap = savePhotos(s1.photos || {});
    log.audit('25South UPDATE', `New files — KYC: ${Object.keys(kycFileMap).length} | Sigs: ${Object.keys(sigFileMap).length} | Photos: ${Object.keys(photoFileMap).length}`);

    // ── 2. Update Customer record fields ────────────────────────────
    const a  = (i) => s1.applicants?.[i] || {};
    const a1 = a(0);

    const customerFields = {};
    const cset = (f, v) => { if (v !== undefined && v !== null && v !== '') customerFields[f] = v; };

    cset('firstname',   a1.firstName);
    cset('middlename',  a1.middleName);
    cset('lastname',    a1.lastName);
    cset('salutation',  a1.title);
    cset('email',       s1.email);
    cset('phone',       s1.residencePhone);
    cset('mobilephone', s1.mobile);
    cset('altphone',    s1.officePhone);

    if (Object.keys(customerFields).length > 0) {
      try {
        record.submitFields({
          type:   record.Type.CUSTOMER,
          id:     customerId,
          values: customerFields,
          options: { enableSourcing: true, ignoreMandatoryFields: true }
        });
        log.audit('25South UPDATE', `Customer ${customerId} updated`);
      } catch (e) {
        log.error('25South UPDATE Customer', e.message);
      }
    }

    // ── 3. Update Booking record fields ─────────────────────────────
    const bookingFields = {};
    const bset = (f, v) => { if (v !== undefined && v !== null && v !== '') bookingFields[f] = v; };

    // Flat
    bset('custrecord_25s_project',      s1.flat?.projectName);
    bset('custrecord_25s_wing',         s1.flat?.wing);
    bset('custrecord_25s_flat_no',      s1.flat?.flatNo);
    bset('custrecord_25s_floor',        s1.flat?.floor);
    bset('custrecord_25s_config',       s1.flat?.configuration);
    bset('custrecord_25s_bhk',          s1.flat?.bhkType);
    bset('custrecord_25s_rera_carpet',  s1.flat?.reraCarpet);
    bset('custrecord_25s_along_area',   s1.flat?.alongWithArea);
    bset('custrecord_25s_cp_no',        s1.flat?.cpNo);
    bset('custrecord_25s_cp_level',     s1.flat?.cpLevel);
    bset('custrecord_25s_cp_type',      s1.flat?.cpType);
    bset('custrecord_25s_sale_value',   s1.flat?.saleValue);
    bset('custrecord_25s_sale_words',   s1.flat?.saleValueWords);
    bset('custrecord_25s_end_use',      s1.flat?.endUse);

    // Applicants
    [0,1,2,3].forEach(i => {
      const n = i + 1; const ap = a(i);
      bset(`custrecord_25s_app${n}_fname`,   ap.firstName);
      bset(`custrecord_25s_app${n}_mname`,   ap.middleName);
      bset(`custrecord_25s_app${n}_lname`,   ap.lastName);
      bset(`custrecord_25s_app${n}_pan`,     ap.pan);
      bset(`custrecord_25s_app${n}_dob`,     ap.dob);
      bset(`custrecord_25s_app${n}_occ`,     ap.occupation);
      if (i > 0) bset(`custrecord_25s_app${n}_relation`, ap.relation);
    });

    // Contact
    bset('custrecord_25s_mobile',       s1.mobile);
    bset('custrecord_25s_email',        s1.email);
    bset('custrecord_25s_res_addr',     s1.residenceAddress);
    bset('custrecord_25s_corr_addr',    s1.correspondenceAddress);
    bset('custrecord_25s_res_status',   s1.residentialStatus);
    bset('custrecord_25s_nri_country',  s1.nriCountry);
    bset('custrecord_25s_profession',   s1.profession);
    bset('custrecord_25s_organization', s1.organization);
    bset('custrecord_25s_designation',  s1.designation);

    // Payment
    bset('custrecord_25s_cheque_no',    s1.payment?.chequeNo);
    bset('custrecord_25s_cheque_date',  s1.payment?.dated);
    bset('custrecord_25s_amount',       s1.payment?.amount);
    bset('custrecord_25s_amount_words', s1.payment?.amountWords);
    bset('custrecord_25s_drawn_on',     s1.payment?.drawnOn);
    bset('custrecord_25s_cost_sheet',   s1.payment?.costSheetRef);

    // Funding
    bset('custrecord_25s_loan_opted',    s1.funding?.loanOpted);
    bset('custrecord_25s_bank_name',     s1.funding?.bankName);
    bset('custrecord_25s_own_contrib',   s1.funding?.ownContrib);
    bset('custrecord_25s_home_loan_pct', s1.funding?.homeLoan);

    // Source / CP
    if ((s1.source || []).length > 0)
      bookingFields['custrecord_25s_source'] = s1.source.join(', ');
    bset('custrecord_25s_cp_applicable', s1.channelPartner?.applicable);
    bset('custrecord_25s_cp_name',       s1.channelPartner?.name);
    bset('custrecord_25s_cp_mobile',     s1.channelPartner?.mobile);
    bset('custrecord_25s_cp_email',      s1.channelPartner?.email);
    bset('custrecord_25s_cp_rera',       s1.channelPartner?.rera);
    bset('custrecord_25s_cp_gst',        s1.channelPartner?.gst);
    bset('custrecord_25s_cp_brokerage',  s1.channelPartner?.brokerage);
    bookingFields['custrecord_25s_tnc_accepted'] = !!s1.tncAccepted;

    // Section 3
    bset('custrecord_25s_household',    s3?.householdCount);
    if ((s3?.fitness     || []).length > 0) bookingFields['custrecord_25s_fitness']      = s3.fitness.join(', ');
    if ((s3?.sports      || []).length > 0) bookingFields['custrecord_25s_sports']       = s3.sports.join(', ');
    if ((s3?.events      || []).length > 0) bookingFields['custrecord_25s_events']       = s3.events.join(', ');
    if ((s3?.music       || []).length > 0) bookingFields['custrecord_25s_music']        = s3.music.join(', ');
    if ((s3?.internet    || []).length > 0) bookingFields['custrecord_25s_internet']     = s3.internet.join(', ');
    if ((s3?.kidsActivities || []).length > 0) bookingFields['custrecord_25s_kids_act'] = s3.kidsActivities.join(', ');
    if ((s3?.socialMedia || []).length > 0) bookingFields['custrecord_25s_social_media']= s3.socialMedia.join(', ');
    bset('custrecord_25s_last_apps',    s3?.lastApps);
    bset('custrecord_25s_travel',       s3?.travelAbroad);
    bset('custrecord_25s_cars',         s3?.carsDriven);
    bset('custrecord_25s_clubs',        s3?.clubMembership === 'Yes' ? s3.clubNames : 'No');

    // New file IDs (only written if new files were uploaded this session)
    [0,1,2,3].forEach(appIdx => {
      const n = appIdx + 1;
      ['pan','aadhar','dl','passport','voter'].forEach(docKey => {
        const fid = kycFileMap[`kyc-${appIdx}-${docKey}`]?.fileId;
        if (fid) bookingFields[`custrecord_25s_file_${docKey}_${n}`] = fid;
      });
      const addrKeys = ['addrPassport','addrAadhar','addrDl','addrVoter','electricity','mtnl','bank'];
      const firstAddr = addrKeys.find(k => kycFileMap[`kyc-${appIdx}-${k}`]?.fileId);
      if (firstAddr) bookingFields[`custrecord_25s_file_addr_${n}`] = kycFileMap[`kyc-${appIdx}-${firstAddr}`].fileId;

      const sigEntry   = sigFileMap[`sig-applicant${n}`]   || sigFileMap[`sig-app${n}`];
      const photoEntry = photoFileMap[`photo-applicant${n}`] || photoFileMap[`photo-app${n}`];
      if (sigEntry?.fileId)   bookingFields[`custrecord_25s_file_sig_${n}`]   = sigEntry.fileId;
      if (photoEntry?.fileId) bookingFields[`custrecord_25s_file_photo_${n}`] = photoEntry.fileId;
    });

    // Update submitted_at
    bookingFields['custrecord_25s_submitted_at'] = body.submittedAt;
    bookingFields['custrecord_25s_submitted_by'] = runtime.getCurrentUser().name;

    record.submitFields({
      type:   'customrecord_25south_booking',
      id:     bookingId,
      values: bookingFields,
      options: { enableSourcing: true, ignoreMandatoryFields: true }
    });
    log.audit('25South UPDATE', `Booking ${bookingId} updated`);

    // ── 4. Attach new files to both records ─────────────────────────
    const allNewFileIds = [
      ...Object.values(kycFileMap).map(f => f.fileId),
      ...Object.values(sigFileMap).map(f => f.fileId),
      ...Object.values(photoFileMap).map(f => f.fileId)
    ].filter(Boolean);

    let attachedCount = 0;
    allNewFileIds.forEach(fileId => {
      try {
        attachToRecord(fileId, record.Type.CUSTOMER,           customerId);
        attachToRecord(fileId, 'customrecord_25south_booking', bookingId);
        attachedCount++;
      } catch (e) { log.error('25South UPDATE Attach', `${fileId}: ${e.message}`); }
    });

    context.response.write(JSON.stringify({
      success:       true,
      customerId,
      bookingId,
      newFiles:      allNewFileIds.length,
      attachedFiles: attachedCount,
      submittedAt:   body.submittedAt,
      message:       `Booking updated. Customer: ${customerId} | Booking: ${bookingId} | New files: ${allNewFileIds.length}`
    }));
  };

  // ══════════════════════════════════════════════════════════════════
  // SAVE KYC DOCUMENTS
  // Processes Angular's NetsuiteService.extractAttachments() output:
  //   att = { uid, label, applicantIndex, documentType,
  //            fileName, fileType, fileData (base64 or dataURL) }
  // ══════════════════════════════════════════════════════════════════
  const saveKycDocuments = (attachments) => {
    const fileMap = {};

    attachments.forEach(att => {
      try {
        if (!att.fileData) return;

        // Strip "data:application/pdf;base64," prefix if present
        let b64 = att.fileData;
        if (b64.includes(',')) b64 = b64.split(',')[1];
        if (!b64) return;

        const nsFileType  = mimeToNsType(att.fileType);
        const safeFileName = sanitizeFileName(att.fileName || `${att.uid}.pdf`);

        const f = file.create({
          name:        safeFileName,
          fileType:    nsFileType,
          contents:    b64,
          description: `KYC | ${att.label} | App ${(att.applicantIndex || 0) + 1}`,
          folder:      KYC_UPLOAD_FOLDER_ID,
          isOnline:    false
        });

        const fileId = f.save();

        fileMap[att.uid] = {
          fileId,
          fileName:       safeFileName,
          label:          att.label,
          applicantIndex: att.applicantIndex || 0,
          documentType:   att.documentType || att.label
        };

        log.debug('25South KYC', `Saved: ${safeFileName} → ID ${fileId}`);
      } catch (e) {
        log.error('25South KYC Error', `${att.uid}: ${e.message}`);
      }
    });

    return fileMap;
  };

  // ══════════════════════════════════════════════════════════════════
  // SAVE SIGNATURES
  // signatures obj keys match Angular's signature-pad component output:
  //   { applicant1: 'data:image/png;base64,...', applicant2: '...' }
  // ══════════════════════════════════════════════════════════════════
  const saveSignatures = (signatures) => {
    const fileMap = {};

    Object.entries(signatures).forEach(([key, dataUrl]) => {
      try {
        if (!dataUrl) return;

        let b64 = dataUrl;
        if (b64.includes(',')) b64 = b64.split(',')[1];
        if (!b64) return;

        const fileName = `signature-${key}-${Date.now()}.png`;

        const f = file.create({
          name:        fileName,
          fileType:    file.Type.PNG,
          contents:    b64,
          description: `Signature — ${key}`,
          folder:      SIGNATURES_FOLDER_ID,
          isOnline:    false
        });

        const fileId = f.save();

        fileMap[`sig-${key}`] = { fileId, fileName, key };

        log.debug('25South Signature', `Saved: ${fileName} → ID ${fileId}`);
      } catch (e) {
        log.error('25South Signature Error', `${key}: ${e.message}`);
      }
    });

    return fileMap;
  };

  // ══════════════════════════════════════════════════════════════════
  // SAVE PASSPORT PHOTOS
  // photos obj keys: { applicant1: 'data:image/jpeg;base64,...' }
  // ══════════════════════════════════════════════════════════════════
  const savePhotos = (photos) => {
    const fileMap = {};

    Object.entries(photos).forEach(([key, dataUrl]) => {
      try {
        if (!dataUrl) return;

        let b64 = dataUrl;
        // Detect actual mime type from data URL prefix
        const mimeMatch = b64.match(/^data:([^;]+);base64,/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        if (b64.includes(',')) b64 = b64.split(',')[1];
        if (!b64) return;

        const ext      = mime === 'image/png' ? 'png' : 'jpg';
        const nsType   = mime === 'image/png' ? file.Type.PNG : file.Type.JPG;
        const fileName = `photo-${key}-${Date.now()}.${ext}`;

        const f = file.create({
          name:        fileName,
          fileType:    nsType,
          contents:    b64,
          description: `Passport Photo — ${key}`,
          folder:      SIGNATURES_FOLDER_ID,
          isOnline:    false
        });

        const fileId = f.save();

        fileMap[`photo-${key}`] = { fileId, fileName, key };

        log.debug('25South Photo', `Saved: ${fileName} → ID ${fileId}`);
      } catch (e) {
        log.error('25South Photo Error', `${key}: ${e.message}`);
      }
    });

    return fileMap;
  };

  // ══════════════════════════════════════════════════════════════════
  // CREATE CUSTOMER RECORD
  // ══════════════════════════════════════════════════════════════════
  const createCustomer = (s1, s3) => {
    const a  = (i) => s1.applicants?.[i] || {};
    const a1 = a(0);

    const rec = record.create({ type: record.Type.CUSTOMER, isDynamic: true });

    sf(rec, 'firstname',   a1.firstName);
    sf(rec, 'middlename',  a1.middleName);
    sf(rec, 'lastname',    a1.lastName);
    sf(rec, 'salutation',  a1.title);
    sf(rec, 'email',       s1.email);
    sf(rec, 'phone',       s1.residencePhone);
    sf(rec, 'mobilephone', s1.mobile);
    sf(rec, 'altphone',    s1.officePhone);
    sf(rec, 'comments',
      `${s1.flat?.projectName || ''} | ${s1.flat?.wing || ''}-${s1.flat?.flatNo || ''} | ` +
      `Submitted: ${new Date().toLocaleDateString('en-IN')}`
    );

    // Address
    rec.selectNewLine({ sublistId: 'addressbook' });
    rec.setCurrentSublistValue({ sublistId: 'addressbook', fieldId: 'defaultshipping', value: true });
    rec.setCurrentSublistValue({ sublistId: 'addressbook', fieldId: 'defaultbilling',  value: true });
    const addrRec = rec.getCurrentSublistSubrecord({ sublistId: 'addressbook', fieldId: 'addressbookaddress' });
    addrRec.setValue({ fieldId: 'addr1', value: s1.residenceAddress || '' });
    rec.commitLine({ sublistId: 'addressbook' });

    // Custom entity fields
    cf(rec, 'custentity_25s_app_date',     s1.applicationDate);
    cf(rec, 'custentity_25s_pan',          a1.pan);
    cf(rec, 'custentity_25s_dob',          a1.dob);
    cf(rec, 'custentity_25s_anniversary',  a1.anniversary);
    cf(rec, 'custentity_25s_profession',   s1.profession);
    cf(rec, 'custentity_25s_organization', s1.organization);
    cf(rec, 'custentity_25s_designation',  s1.designation);
    cf(rec, 'custentity_25s_res_status',   s1.residentialStatus);
    cf(rec, 'custentity_25s_nri_country',  s1.nriCountry);
    cf(rec, 'custentity_25s_ownership',    s1.ownership);
    cf(rec, 'custentity_25s_source',       (s1.source || []).join(', '));
    cf(rec, 'custentity_25s_cp_name',      s1.channelPartner?.name);
    cf(rec, 'custentity_25s_cp_rera',      s1.channelPartner?.rera);
    cf(rec, 'custentity_25s_app2_name',    fullName(a(1)));
    cf(rec, 'custentity_25s_app2_pan',     a(1).pan);
    cf(rec, 'custentity_25s_app3_name',    fullName(a(2)));
    cf(rec, 'custentity_25s_app3_pan',     a(2).pan);
    cf(rec, 'custentity_25s_app4_name',    fullName(a(3)));
    cf(rec, 'custentity_25s_app4_pan',     a(3).pan);
    cf(rec, 'custentity_25s_household',    s3?.householdCount);
    cf(rec, 'custentity_25s_tnc_accepted', s1.tncAccepted);

    return rec.save({ enableSourcing: true, ignoreMandatoryFields: true });
  };

  // ══════════════════════════════════════════════════════════════════
  // CREATE CUSTOM BOOKING RECORD
  //
  // ┌──────────────────────────────────────────────────────────────────┐
  // │  CUSTOM RECORD TYPE PROTOTYPE                                    │
  // │                                                                  │
  // │  Customization → Lists, Records & Fields → Record Types → New   │
  // │  Name:        25 South Booking                                  │
  // │  ID:          _25south_booking                                  │
  // │               (auto-becomes: customrecord_25south_booking)      │
  // │  Allow Quick Search: ✓                                          │
  // │  Show in List: ✓                                                │
  // │                                                                  │
  // │  FIELDS TO CREATE (Customization → Record Fields → New):        │
  // │                                                                  │
  // │  ── HEADER / META ───────────────────────────────────────────   │
  // │  custrecord_25s_customer        Record (Customer)               │
  // │  custrecord_25s_app_date        Date                            │
  // │  custrecord_25s_submitted_at    Free-Form Text                  │
  // │  custrecord_25s_form_version    Free-Form Text                  │
  // │  custrecord_25s_submitted_by    Free-Form Text                  │
  // │                                                                  │
  // │  ── FLAT DETAILS ────────────────────────────────────────────   │
  // │  custrecord_25s_project         Free-Form Text                  │
  // │  custrecord_25s_wing            Free-Form Text                  │
  // │  custrecord_25s_flat_no         Free-Form Text                  │
  // │  custrecord_25s_floor           Free-Form Text                  │
  // │  custrecord_25s_config          Free-Form Text                  │
  // │  custrecord_25s_bhk             Free-Form Text                  │
  // │  custrecord_25s_rera_carpet     Free-Form Text                  │
  // │  custrecord_25s_along_area      Free-Form Text                  │
  // │  custrecord_25s_cp_no           Free-Form Text  (Car Park No)   │
  // │  custrecord_25s_cp_level        Free-Form Text                  │
  // │  custrecord_25s_cp_type         Free-Form Text                  │
  // │  custrecord_25s_sale_value      Currency                        │
  // │  custrecord_25s_sale_words      Free-Form Text                  │
  // │  custrecord_25s_end_use         Free-Form Text                  │
  // │                                                                  │
  // │  ── APPLICANTS (repeat ×4, n=1..4) ─────────────────────────   │
  // │  custrecord_25s_app{n}_fname    Free-Form Text                  │
  // │  custrecord_25s_app{n}_mname    Free-Form Text                  │
  // │  custrecord_25s_app{n}_lname    Free-Form Text                  │
  // │  custrecord_25s_app{n}_pan      Free-Form Text                  │
  // │  custrecord_25s_app{n}_dob      Date                            │
  // │  custrecord_25s_app{n}_occ      Free-Form Text                  │
  // │  custrecord_25s_app{n}_relation Free-Form Text  (App 2-4 only)  │
  // │                                                                  │
  // │  ── CONTACT ─────────────────────────────────────────────────   │
  // │  custrecord_25s_mobile          Phone                           │
  // │  custrecord_25s_email           Email                           │
  // │  custrecord_25s_res_addr        Text Area                       │
  // │  custrecord_25s_corr_addr       Text Area                       │
  // │  custrecord_25s_res_status      Free-Form Text                  │
  // │  custrecord_25s_nri_country     Free-Form Text                  │
  // │  custrecord_25s_profession      Free-Form Text                  │
  // │  custrecord_25s_organization    Free-Form Text                  │
  // │  custrecord_25s_designation     Free-Form Text                  │
  // │                                                                  │
  // │  ── PAYMENT ─────────────────────────────────────────────────   │
  // │  custrecord_25s_cheque_no       Free-Form Text                  │
  // │  custrecord_25s_cheque_date     Date                            │
  // │  custrecord_25s_amount          Currency                        │
  // │  custrecord_25s_amount_words    Free-Form Text                  │
  // │  custrecord_25s_drawn_on        Free-Form Text                  │
  // │  custrecord_25s_cost_sheet      Free-Form Text                  │
  // │                                                                  │
  // │  ── FUNDING ─────────────────────────────────────────────────   │
  // │  custrecord_25s_loan_opted      Free-Form Text                  │
  // │  custrecord_25s_bank_name       Free-Form Text                  │
  // │  custrecord_25s_own_contrib     Free-Form Text                  │
  // │  custrecord_25s_home_loan_pct   Free-Form Text                  │
  // │                                                                  │
  // │  ── SOURCE / CHANNEL PARTNER ────────────────────────────────   │
  // │  custrecord_25s_source          Free-Form Text                  │
  // │  custrecord_25s_cp_applicable   Checkbox                        │
  // │  custrecord_25s_cp_name         Free-Form Text                  │
  // │  custrecord_25s_cp_mobile       Phone                           │
  // │  custrecord_25s_cp_email        Email                           │
  // │  custrecord_25s_cp_rera         Free-Form Text                  │
  // │  custrecord_25s_cp_gst          Free-Form Text                  │
  // │  custrecord_25s_cp_brokerage    Currency                        │
  // │  custrecord_25s_tnc_accepted    Checkbox                        │
  // │                                                                  │
  // │  ── SECTION III — LIFESTYLE ─────────────────────────────────   │
  // │  custrecord_25s_household       Integer                         │
  // │  custrecord_25s_fitness         Long Text                       │
  // │  custrecord_25s_sports          Long Text                       │
  // │  custrecord_25s_events          Long Text                       │
  // │  custrecord_25s_music           Long Text                       │
  // │  custrecord_25s_internet        Long Text                       │
  // │  custrecord_25s_last_apps       Free-Form Text                  │
  // │  custrecord_25s_kids_act        Long Text                       │
  // │  custrecord_25s_travel          Free-Form Text                  │
  // │  custrecord_25s_cars            Integer                         │
  // │  custrecord_25s_clubs           Free-Form Text                  │
  // │  custrecord_25s_social_media    Free-Form Text                  │
  // │                                                                  │
  // │  ── KYC FLAGS ───────────────────────────────────────────────   │
  // │  custrecord_25s_pan_uploaded    Checkbox                        │
  // │  custrecord_25s_aadhar_upl      Checkbox                        │
  // │  custrecord_25s_addr_upl        Checkbox                        │
  // │  custrecord_25s_nri_upl         Checkbox                        │
  // │                                                                  │
  // │  ── FILE CABINET IDs (Integer type — store FC internal IDs) ──  │
  // │  custrecord_25s_file_pan_1      Integer  App1 PAN file ID       │
  // │  custrecord_25s_file_aadhar_1   Integer  App1 Aadhar file ID    │
  // │  custrecord_25s_file_dl_1       Integer  App1 DL file ID        │
  // │  custrecord_25s_file_passport_1 Integer  App1 Passport file ID  │
  // │  custrecord_25s_file_voter_1    Integer  App1 Voter file ID     │
  // │  custrecord_25s_file_addr_1     Integer  App1 Addr Proof ID     │
  // │  (repeat _2, _3, _4 for each applicant)                         │
  // │  custrecord_25s_file_sig_1      Integer  App1 Signature ID      │
  // │  custrecord_25s_file_sig_2      Integer  App2 Signature ID      │
  // │  custrecord_25s_file_sig_3      Integer  App3 Signature ID      │
  // │  custrecord_25s_file_sig_4      Integer  App4 Signature ID      │
  // │  custrecord_25s_file_photo_1    Integer  App1 Photo ID          │
  // │  custrecord_25s_file_photo_2    Integer  App2 Photo ID          │
  // │  custrecord_25s_file_photo_3    Integer  App3 Photo ID          │
  // │  custrecord_25s_file_photo_4    Integer  App4 Photo ID          │
  // └──────────────────────────────────────────────────────────────────┘
  // ══════════════════════════════════════════════════════════════════
  const createBookingRecord = (customerId, s1, s3, s4, submittedAt, kycFileMap, sigFileMap, photoFileMap) => {
    const a   = (i) => s1.applicants?.[i] || {};
    const rec = record.create({ type: 'customrecord_25south_booking', isDynamic: true });

    // ── Header ─────────────────────────────────────────────────────
    cf(rec, 'custrecord_25s_customer',     customerId);
    cf(rec, 'custrecord_25s_app_date',     s1.applicationDate);
    cf(rec, 'custrecord_25s_submitted_at', submittedAt);
    cf(rec, 'custrecord_25s_form_version', '4.0');
    cf(rec, 'custrecord_25s_submitted_by', runtime.getCurrentUser().name);

    // ── Flat ───────────────────────────────────────────────────────
    cf(rec, 'custrecord_25s_project',      s1.flat?.projectName);
    cf(rec, 'custrecord_25s_wing',         s1.flat?.wing);
    cf(rec, 'custrecord_25s_flat_no',      s1.flat?.flatNo);
    cf(rec, 'custrecord_25s_floor',        s1.flat?.floor);
    cf(rec, 'custrecord_25s_config',       s1.flat?.configuration);
    cf(rec, 'custrecord_25s_bhk',          s1.flat?.bhkType);
    cf(rec, 'custrecord_25s_rera_carpet',  s1.flat?.reraCarpet);
    cf(rec, 'custrecord_25s_along_area',   s1.flat?.alongWithArea);
    cf(rec, 'custrecord_25s_cp_no',        s1.flat?.cpNo);
    cf(rec, 'custrecord_25s_cp_level',     s1.flat?.cpLevel);
    cf(rec, 'custrecord_25s_cp_type',      s1.flat?.cpType);
    cf(rec, 'custrecord_25s_sale_value',   s1.flat?.saleValue);
    cf(rec, 'custrecord_25s_sale_words',   s1.flat?.saleValueWords);
    cf(rec, 'custrecord_25s_end_use',      s1.flat?.endUse);

    // ── All 4 Applicants ───────────────────────────────────────────
    [0, 1, 2, 3].forEach(i => {
      const n  = i + 1;
      const ap = a(i);
      cf(rec, `custrecord_25s_app${n}_fname`,    ap.firstName);
      cf(rec, `custrecord_25s_app${n}_mname`,    ap.middleName);
      cf(rec, `custrecord_25s_app${n}_lname`,    ap.lastName);
      cf(rec, `custrecord_25s_app${n}_pan`,      ap.pan);
      cf(rec, `custrecord_25s_app${n}_dob`,      ap.dob);
      cf(rec, `custrecord_25s_app${n}_occ`,      ap.occupation);
      if (i > 0) cf(rec, `custrecord_25s_app${n}_relation`, ap.relation);
    });

    // ── Contact ────────────────────────────────────────────────────
    cf(rec, 'custrecord_25s_mobile',       s1.mobile);
    cf(rec, 'custrecord_25s_email',        s1.email);
    cf(rec, 'custrecord_25s_res_addr',     s1.residenceAddress);
    cf(rec, 'custrecord_25s_corr_addr',    s1.correspondenceAddress);
    cf(rec, 'custrecord_25s_res_status',   s1.residentialStatus);
    cf(rec, 'custrecord_25s_nri_country',  s1.nriCountry);
    cf(rec, 'custrecord_25s_profession',   s1.profession);
    cf(rec, 'custrecord_25s_organization', s1.organization);
    cf(rec, 'custrecord_25s_designation',  s1.designation);

    // ── Payment ────────────────────────────────────────────────────
    cf(rec, 'custrecord_25s_cheque_no',    s1.payment?.chequeNo);
    cf(rec, 'custrecord_25s_cheque_date',  s1.payment?.dated);
    cf(rec, 'custrecord_25s_amount',       s1.payment?.amount);
    cf(rec, 'custrecord_25s_amount_words', s1.payment?.amountWords);
    cf(rec, 'custrecord_25s_drawn_on',     s1.payment?.drawnOn);
    cf(rec, 'custrecord_25s_cost_sheet',   s1.payment?.costSheetRef);

    // ── Funding ────────────────────────────────────────────────────
    cf(rec, 'custrecord_25s_loan_opted',    s1.funding?.loanOpted);
    cf(rec, 'custrecord_25s_bank_name',     s1.funding?.bankName);
    cf(rec, 'custrecord_25s_own_contrib',   s1.funding?.ownContrib);
    cf(rec, 'custrecord_25s_home_loan_pct', s1.funding?.homeLoan);

    // ── Source / CP ────────────────────────────────────────────────
    cf(rec, 'custrecord_25s_source',        (s1.source || []).join(', '));
    cf(rec, 'custrecord_25s_cp_applicable', s1.channelPartner?.applicable);
    cf(rec, 'custrecord_25s_cp_name',       s1.channelPartner?.name);
    cf(rec, 'custrecord_25s_cp_mobile',     s1.channelPartner?.mobile);
    cf(rec, 'custrecord_25s_cp_email',      s1.channelPartner?.email);
    cf(rec, 'custrecord_25s_cp_rera',       s1.channelPartner?.rera);
    cf(rec, 'custrecord_25s_cp_gst',        s1.channelPartner?.gst);
    cf(rec, 'custrecord_25s_cp_brokerage',  s1.channelPartner?.brokerage);
    cf(rec, 'custrecord_25s_tnc_accepted',  s1.tncAccepted);

    // ── Section III ────────────────────────────────────────────────
    cf(rec, 'custrecord_25s_household',    s3?.householdCount);
    cf(rec, 'custrecord_25s_fitness',      (s3?.fitness      || []).join(', '));
    cf(rec, 'custrecord_25s_sports',       (s3?.sports       || []).join(', '));
    cf(rec, 'custrecord_25s_events',       (s3?.events       || []).join(', '));
    cf(rec, 'custrecord_25s_music',        (s3?.music        || []).join(', '));
    cf(rec, 'custrecord_25s_internet',     (s3?.internet     || []).join(', '));
    cf(rec, 'custrecord_25s_last_apps',    s3?.lastApps);
    cf(rec, 'custrecord_25s_kids_act',     (s3?.kidsActivities || []).join(', '));
    cf(rec, 'custrecord_25s_travel',       s3?.travelAbroad);
    cf(rec, 'custrecord_25s_cars',         s3?.carsDriven);
    cf(rec, 'custrecord_25s_clubs',        s3?.clubMembership === 'Yes' ? s3.clubNames : 'No');
    cf(rec, 'custrecord_25s_social_media', (s3?.socialMedia  || []).join(', '));

    // ── KYC Flags ──────────────────────────────────────────────────
    cf(rec, 'custrecord_25s_pan_uploaded', !!(s4?.applicants?.[0]?.pan?.fileData));
    cf(rec, 'custrecord_25s_aadhar_upl',  !!(s4?.applicants?.[0]?.aadhar?.fileData));
    cf(rec, 'custrecord_25s_addr_upl',    !!(
      s4?.applicants?.[0]?.addrAadhar?.fileData   ||
      s4?.applicants?.[0]?.electricity?.fileData
    ));
    cf(rec, 'custrecord_25s_nri_upl',     !!(s4?.applicants?.[0]?.nriPassport?.fileData));

    // ── KYC File IDs per applicant ─────────────────────────────────
    // uid format from Angular: "kyc-{appIdx}-{docKey}"
    [0, 1, 2, 3].forEach(appIdx => {
      const n = appIdx + 1;

      // Standard KYC docs
      ['pan', 'aadhar', 'dl', 'passport', 'voter'].forEach(docKey => {
        const uid    = `kyc-${appIdx}-${docKey}`;
        const fileId = kycFileMap[uid]?.fileId;
        if (fileId) cf(rec, `custrecord_25s_file_${docKey}_${n}`, fileId);
      });

      // Address proof — store the first uploaded doc's file ID
      const addrKeys = ['addrPassport','addrAadhar','addrDl','addrVoter','electricity','mtnl','bank'];
      const firstAddr = addrKeys.find(k => kycFileMap[`kyc-${appIdx}-${k}`]?.fileId);
      if (firstAddr) {
        cf(rec, `custrecord_25s_file_addr_${n}`,
          kycFileMap[`kyc-${appIdx}-${firstAddr}`].fileId
        );
      }

      // Signature IDs — Angular key can be 'applicant1' or 'app1'
      const sigEntry = sigFileMap[`sig-applicant${n}`] || sigFileMap[`sig-app${n}`];
      if (sigEntry?.fileId) cf(rec, `custrecord_25s_file_sig_${n}`, sigEntry.fileId);

      // Photo IDs
      const photoEntry = photoFileMap[`photo-applicant${n}`] || photoFileMap[`photo-app${n}`];
      if (photoEntry?.fileId) cf(rec, `custrecord_25s_file_photo_${n}`, photoEntry.fileId);
    });

    return rec.save({ enableSourcing: true, ignoreMandatoryFields: true });
  };

  // ══════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════

  /** Attach a File Cabinet file to any record */
  const attachToRecord = (fileId, recordType, recordId) => {
    record.attach({
      record: { type: 'file', id: fileId },
      to:     { type: recordType, id: recordId }
    });
  };

  /** Map browser MIME type → NetSuite file.Type constant */
  const mimeToNsType = (mime) => {
    const map = {
      'application/pdf': file.Type.PDF,
      'image/jpeg':      file.Type.JPG,
      'image/jpg':       file.Type.JPG,
      'image/png':       file.Type.PNG,
      'image/gif':       file.Type.GIF,
      'image/webp':      file.Type.WEBP
    };
    return map[(mime || '').toLowerCase()] || file.Type.PDF;
  };

  /** Strip characters illegal in NetSuite file names */
  const sanitizeFileName = (name) =>
    (name || 'file.pdf').replace(/[/\\:*?"<>|]/g, '_').substring(0, 200);

  /** Safe field setter — silently logs failures instead of crashing */
  const sf = (rec, fieldId, value) => {
    try {
      if (value !== undefined && value !== null && value !== '') {
        rec.setValue({ fieldId, value });
      }
    } catch (e) {
      log.error('sf', `${fieldId}: ${e.message}`);
    }
  };

  const cf = sf; // alias — same logic for custom fields

  const fullName = (a) => [a.title, a.firstName, a.lastName].filter(Boolean).join(' ');
  const escapeJs = (s) => (s || '').replace(/'/g, "\\'").replace(/\n/g, ' ');

  /** Split a comma-separated NS field value back into an array, trimming empties */
  const splitComma = (s) => (s || '').split(',').map(v => v.trim()).filter(Boolean);

  return { onRequest };
});
