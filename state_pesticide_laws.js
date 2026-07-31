/* State pesticide application recordkeeping requirements (50 states).
 *
 * Built for post-July 11, 2025 reality: USDA 7 CFR Part 110 (federal private
 * applicator RUP recordkeeping) was rescinded. State pesticide acts, WPS,
 * and product labels control.
 *
 * Scope: agricultural application RECORDKEEPING field coverage for each
 * state's researched requirements. This is not a substitute for:
 *   - Worker Protection Standard (40 CFR Part 170) employer duties
 *   - California PUR / CalAgPermits electronic reporting
 *   - New York Pesticide Reporting Law electronic filings
 *   - Product-label-specific record mandates (dicamba, fumigants, etc.)
 *
 * verification values:
 *   researched — fields sourced from state rule/statute/agency guidance
 *   partial    — core fields verified; some private/commercial nuances open
 *   uncertain  — limited authoritative field list; capture recommended base
 *
 * privateDuty:
 *   required  — private applicators have a researched state recordkeeping duty
 *   none      — state sources indicate no private applicator record duty
 *   uncertain — private-applicator duty not verified after Part 110 rescission
 *
 * customerCopyDays:
 *   number — researched commercial customer-copy window (days)
 *   null   — no researched customer-copy duty encoded (do not invent one)
 *
 * Source research date: 2026-07-31. Always confirm with your state agency.
 */
const STATE_LAWS = {
  "AK": {
    "agency": "Alaska Department of Environmental Conservation",
    "citation": {
      "reference": "18 AAC 90.410, .415, .420",
      "url": "https://dec.alaska.gov/media/drgngwgy/18-aac-90.pdf"
    },
    "retentionYears": 2,
    "appliesTo": "Private agricultural applicators must keep RUP use records; other RUP applicators keep purchase/use records; custom, commercial, or contract applicators also keep general-use records.",
    "verification": "researched",
    "notes": "Private agricultural RUP records are a shorter subset: product/EPA, date, location, total amount, applicator/certification, crop/site, and area. Fumigants substitute temperature, exposure duration, and gas pounds per 1,000 cubic feet for rate/dilution.",
    "fields": [
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "dilution_rate",
        "label": "Dilution rate",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "AL": {
    "agency": "Alabama Department of Agriculture and Industries",
    "citation": {
      "reference": "Ala. Admin. Code r. 80-1-13-.14; aerial applications r. 80-1-14-.08",
      "url": "https://www.law.cornell.edu/regulations/alabama/Ala-Admin-Code-r-80-1-13-.14"
    },
    "retentionYears": 3,
    "appliesTo": "Commercial pesticide permit holders: each application of restricted-use and other pesticides. Private applicators: no Alabama record duty unless pesticide labeling requires it.",
    "verification": "partial",
    "notes": "Rule text does not require weather for ordinary ground applications. Separate Alabama aerial rule requires licensee/customer/farm/crop/acres/brand/formulation/rate/tank-mix/person/signature records and three-year retention. Partially verified for non-ag professional-services rules, which have a one-year baseline.",
    "fields": [
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "none"
  },
  "AR": {
    "agency": "Arkansas Department of Agriculture, State Plant Board",
    "citation": {
      "reference": "Ark. Code Ann. §20-20-215 / Arkansas Pesticide Use and Application Act rules",
      "url": "https://media.ark.org/agri/Pesticide-Use-and-Application-Law-and-Rules.pdf"
    },
    "retentionYears": 2,
    "appliesTo": "Commercial and noncommercial applicator licensees; routine operational records of pesticide applications. Private applicator state application-record fields not verified after federal rescission.",
    "verification": "partial",
    "notes": "Authoritative law text requires records containing kinds, amounts, uses, dates, and places of application. More detailed structural/pest-control rules include customer, location, area, crop/site, date/time, brand, EPA number, total amount, certified and noncertified applicators; agricultural exact field list partially verified.",
    "fields": [
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": false
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "uncertain"
  },
  "AZ": {
    "agency": "Arizona Department of Agriculture",
    "citation": {
      "reference": "Ariz. Admin. Code R3-3-402; Form 1080/R3-3-302 for custom applications",
      "url": "https://www.law.cornell.edu/regulations/arizona/Ariz-Admin-Code-SS-R3-3-402"
    },
    "retentionYears": 3,
    "appliesTo": "Private and golf applicators for RUP, FIFRA section 18, and experimental-use pesticide applications; custom applicators use Form 1080/application report process.",
    "verification": "researched",
    "notes": "Private field records include seller name/permit number, regulated grower, crop/site acres, rate per acre of active ingredient or formulation, total volume per acre, and county/township/range/section. Form 1080 for custom work captures start/end times, equipment tag, wind direction/velocity, operator/pilot, weekly submission to ADA, and deviations.",
    "fields": [
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "permit_number",
        "label": "Permit / operator ID",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "carrier_volume",
        "label": "Carrier / finished spray volume",
        "type": "string",
        "required": true
      },
      {
        "name": "county",
        "label": "County of application",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "CA": {
    "agency": "California Department of Pesticide Regulation and county agricultural commissioners",
    "citation": {
      "reference": "3 CCR §§6624, 6626, 6623",
      "url": "https://www.law.cornell.edu/regulations/california/3-CCR-6624"
    },
    "retentionYears": 2,
    "appliesTo": "Any person using pesticides for agricultural use; operators of property producing agricultural commodities; agricultural pest control businesses; broader California PUR/use-reporting duties apply.",
    "verification": "researched",
    "notes": "CA requires production-ag PUR/use reporting: property operators report to the county by the 10th of the following month unless an agricultural pest control business reports; ag pest control businesses report within 7 days and send the operator a copy within 30 days. Operator identification numbers and site IDs are central; site IDs are issued by county and retained with permits/forms for two years. REI/rate/dilution fields may be optional on PUR forms but are recommended for the logger.",
    "fields": [
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "county",
        "label": "County of application",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_unit",
        "label": "Area unit",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "permit_number",
        "label": "Permit / operator ID",
        "type": "string",
        "required": true
      },
      {
        "name": "site_id",
        "label": "Site ID",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "supervisor_name",
        "label": "Supervising applicator",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "CO": {
    "agency": "Colorado Department of Agriculture",
    "citation": {
      "reference": "C.R.S. §35-10-111; 8 CCR 1203-2 Part 6.05",
      "url": "https://colorado.public.law/statutes/crs_35-10-111"
    },
    "retentionYears": 3,
    "appliesTo": "Commercial, limited commercial, private, and public applicators maintain application records; private applicator rule incorporates the old 7 CFR Part 110 elements for RUP records.",
    "verification": "researched",
    "notes": "Colorado statute requires records in the form/manner designated by the commissioner. CSU guidance lists the classic RUP elements and recommends start/end time, REI, active ingredient, rate, GPA, nozzle, wind, and temperature for WPS/drift defense.",
    "fields": [
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "CT": {
    "agency": "Connecticut Department of Energy and Environmental Protection",
    "citation": {
      "reference": "Conn. Gen. Stat. §22a-58(d); §22a-66b guidance",
      "url": "https://portal.ct.gov/deep/pesticides/pesticide-control-statutes-clarification"
    },
    "retentionYears": 5,
    "appliesTo": "Commercial applicators and pesticide application businesses; private restricted-pesticide access/record language exists but exact private field list was not fully verified.",
    "verification": "partial",
    "notes": "Commercial records must include supervisor/operator names and certification numbers, kind and amount of pesticide, acreage if applicable, date/place, pest, crop/site. Annual summary reporting is due Jan. 31 for commercial use. Partially verified for private applicators.",
    "fields": [
      {
        "name": "supervisor_name",
        "label": "Supervising applicator",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "DE": {
    "agency": "Delaware Department of Agriculture",
    "citation": {
      "reference": "3 Del. Admin. Code §601-14.0",
      "url": "https://regulations.delaware.gov/AdminCode/title3/601"
    },
    "retentionYears": 2,
    "appliesTo": "Commercial applicators; each application of any pesticide.",
    "verification": "researched",
    "notes": "EPA registration number is required for RUP or WPS-covered products. Weather (wind velocity/direction, temperature, relative humidity) is required when label directions advise drift precautions. Records logged immediately or within 24 hours unless good cause.",
    "fields": [
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": false
      },
      {
        "name": "dilution_rate",
        "label": "Dilution rate",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "supervisor_name",
        "label": "Supervising applicator",
        "type": "string",
        "required": false
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": false
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": false
      },
      {
        "name": "temperature",
        "label": "Temperature",
        "type": "number",
        "required": false
      },
      {
        "name": "sky",
        "label": "Humidity / sky conditions",
        "type": "string",
        "required": false
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "FL": {
    "agency": "Florida Department of Agriculture and Consumer Services",
    "citation": {
      "reference": "Fla. Admin. Code r. 5E-9.032",
      "url": "http://flrules.elaws.us/fac/5e-9.032"
    },
    "retentionYears": 2,
    "appliesTo": "Licensed pesticide applicators; all restricted-use pesticide applications. Some special property-owner/leaseholder records are indefinite under §487.081(6)(b).",
    "verification": "researched",
    "notes": "Records must be made within two working days. Commercial/licensed applicator making or supervising for another person must provide copy within 30 days. Florida does not require weather in this agricultural RUP rule, but it is recommended.",
    "fields": [
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "supervisor_name",
        "label": "Supervising applicator",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_unit",
        "label": "Area unit",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 48,
    "customerCopyDays": 30,
    "privateDuty": "required"
  },
  "GA": {
    "agency": "Georgia Department of Agriculture",
    "citation": {
      "reference": "Ga. Comp. R. & Regs. 40-21-5",
      "url": "https://rules.sos.ga.gov/gac/40-21-5"
    },
    "retentionYears": 2,
    "appliesTo": "Licensed pesticide contractors: all business applications; licensed commercial applicators not acting for a contractor: RUP and state-restricted-use applications. Licensed private applicators are not required by this rule to maintain records.",
    "verification": "researched",
    "notes": "Record content includes unexpected occurrences such as spillage, exposure, drift, and corrective/emergency action, plus pesticide disposal details. Weather is not a standard required field except as part of incident notes/label duties.",
    "fields": [
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "notes",
        "label": "Notes / unexpected occurrences",
        "type": "string",
        "required": true
      },
      {
        "name": "disposal_method",
        "label": "Disposal of unused pesticide",
        "type": "string",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "HI": {
    "agency": "Hawaii Department of Agriculture and Biosecurity, Pesticides Branch",
    "citation": {
      "reference": "HAR §4-66-62; HRS 149A-26 annual RUP reports",
      "url": "https://dab.hawaii.gov/pi/main/rup-use-reports/"
    },
    "retentionYears": 2,
    "appliesTo": "Certified pesticide applicators; all RUP applications. Commercial applicators applying any pesticide in agricultural operations must furnish written records to the agricultural employer.",
    "verification": "partial",
    "notes": "Annual RUP use declaration/report is due by Jan. 30 after the calendar year; reports include date, product name/EPA/active ingredients, amount, area, Tax Map Key (TMK), county and related fields. Full 16-item HAR record list partially verified from extension/form sources.",
    "fields": [
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "active_ingredient",
        "label": "Active ingredient",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "county",
        "label": "County of application",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "rei_hours",
        "label": "Restricted-entry interval (REI)",
        "type": "string",
        "required": true
      },
      {
        "name": "notes",
        "label": "Notes / unexpected occurrences",
        "type": "string",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": 30,
    "privateDuty": "required"
  },
  "IA": {
    "agency": "Iowa Department of Agriculture and Land Stewardship",
    "citation": {
      "reference": "Iowa Admin. Code r. 21-45.26(206)",
      "url": "https://www.legis.iowa.gov/docs/iac/rule/02-05-2025.21.45.26.pdf"
    },
    "retentionYears": 3,
    "appliesTo": "Commercial applicators and retail dealers; commercial applicator office records of all application activities on each pesticide applied.",
    "verification": "researched",
    "notes": "Current 2025 text requires temperature/wind direction/velocity if applicable for outdoor areas. Rule effective 1/1/2026 adds EPA registration number, treatment area size, crop/commodity/site for RUP, and certified/noncertified applicator details; include those in the logger as recommended.",
    "fields": [
      {
        "name": "business_name_address",
        "label": "Business / operator name & address",
        "type": "string",
        "required": true
      },
      {
        "name": "company_license",
        "label": "Company / business license #",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "temperature",
        "label": "Temperature",
        "type": "number",
        "required": false
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": false
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": false
      },
      {
        "name": "restricted_use_flag",
        "label": "Restricted-use (RUP) status",
        "type": "boolean",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "ID": {
    "agency": "Idaho State Department of Agriculture",
    "citation": {
      "reference": "IDAPA 02.03.03.101",
      "url": "https://www.law.cornell.edu/regulations/idaho/IDAPA-02.03.03.101"
    },
    "retentionYears": 2,
    "appliesTo": "Professional applicators; pesticide application records for applications they make. RUP records must be provided to the customer within 30 days.",
    "verification": "researched",
    "notes": "2024/current IDAPA no longer includes dilution/rate in the main current field list, though prior/transition guidance showed dilution or rate. WPS information exchange is required when applicable before application.",
    "fields": [
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": true
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "supervisor_name",
        "label": "Supervising applicator",
        "type": "string",
        "required": false
      },
      {
        "name": "notes",
        "label": "Notes / unexpected occurrences",
        "type": "string",
        "required": false
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "IL": {
    "agency": "Illinois Department of Agriculture",
    "citation": {
      "reference": "8 Ill. Admin. Code §250.150(b)",
      "url": "https://www.law.cornell.edu/regulations/illinois/Ill-Admin-Code-tit-8-SS-250.150"
    },
    "retentionYears": 2,
    "appliesTo": "Certified commercial applicators and operators; all restricted pesticide/RUP usage. State private-applicator RUP duty not verified after 7 CFR Part 110 rescission.",
    "verification": "researched",
    "notes": "Rule text lists chemical name, USEPA registration number, amount of chemical concentration per unit treated, date, and use site. Illinois Extension says wind speed/direction is not required in Illinois but recommended for drift defense. WPS records can still apply to agricultural employers.",
    "fields": [
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "IN": {
    "agency": "Office of Indiana State Chemist",
    "citation": {
      "reference": "355 IAC 4-4-1 and OISC Pesticide Recordkeeping guidance (3/12/2024)",
      "url": "https://oisc.purdue.edu/pesticide/pdf/pesticide_recordkeeping_031224.pdf"
    },
    "retentionYears": 2,
    "appliesTo": "Commercial and private applicators for RUP applications; certain commercial applicator categories must also record unrestricted general-use products.",
    "verification": "researched",
    "notes": "No specific form required; paper or electronic records allowed. Records are generally created on date of application. Commercial applicator must provide a copy to customer upon request within 30 days under current rule language.",
    "fields": [
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "supervisor_name",
        "label": "Supervising applicator",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "concentration",
        "label": "Application concentration",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 72,
    "customerCopyDays": 30,
    "privateDuty": "required"
  },
  "KS": {
    "agency": "Kansas Department of Agriculture",
    "citation": {
      "reference": "K.S.A. 2-2455; K.A.R. 4-13-4a",
      "url": "https://www.ksrevisor.gov/statutes/chapters/ch02/002_024_0055.html"
    },
    "retentionYears": 3,
    "appliesTo": "Pesticide businesses must retain statements of services/contracts; government agencies and certain certified commercial applicators maintain application records. Private applicator app-record field list not verified.",
    "verification": "partial",
    "notes": "K.S.A. 2-2455 governs customer statements/contracts and record availability. K.A.R. 4-13-4a requires complete product name and EPA/Kansas registration number. Field list is partially verified for agricultural application records because statute delegates some details to rules.",
    "fields": [
      {
        "name": "business_name_address",
        "label": "Business / operator name & address",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "supervisor_name",
        "label": "Supervising applicator",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "uncertain"
  },
  "KY": {
    "agency": "Kentucky Department of Agriculture",
    "citation": {
      "reference": "302 KAR 26:030",
      "url": "https://apps.legislature.ky.gov/law/kar/titles/302/026/030/"
    },
    "retentionYears": 3,
    "appliesTo": "Private applicators, dealers, structural pest management companies, licensed operators/applicators, and trainees who apply pesticides, as required by 302 KAR Chapter 26.",
    "verification": "researched",
    "notes": "Trainee applications require trainee name and supervising applicator name/license. Label-required records must also be kept.",
    "fields": [
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "noncertified_applicator_name",
        "label": "Noncertified / trainee applicator",
        "type": "string",
        "required": false
      },
      {
        "name": "supervisor_name",
        "label": "Supervising applicator",
        "type": "string",
        "required": false
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": false
      },
      {
        "name": "application_purpose",
        "label": "Purpose of application",
        "type": "string",
        "required": true
      },
      {
        "name": "notes",
        "label": "Notes / unexpected occurrences",
        "type": "string",
        "required": false
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "LA": {
    "agency": "Louisiana Department of Agriculture and Forestry",
    "citation": {
      "reference": "LAC Title 7, Part XXIII, §2101 and LDAF Certified Pesticide Applicator Record Keeping form",
      "url": "https://assets.ctfassets.net/pc5e1rlgfrov/1l8HzBeIHNBeZkVHhLYmdL/0af46ed6626f0d9bbdae54e1c0fe6ea9/AES-41-06_CERT_PEST_APP_RECORD_R04-27-2026_ADA.pdf"
    },
    "retentionYears": 2,
    "appliesTo": "Certified pesticide applicators/owner-operators/private and commercial applicators covered by LDAF pesticide law; records within three days according to LSU/LDAF materials.",
    "verification": "researched",
    "notes": "LDAF form AES-41-06 uses RUP checkbox and fields for owner/operator firm, LDAF card number, customer/applicator tables, crop/type, location, size, rate, and total concentrate applied. Some LDEQ permit language references three-year retention for permittees; LDAF/LSU state minimum two years.",
    "fields": [
      {
        "name": "owner_operator_name",
        "label": "Owner / operator name",
        "type": "string",
        "required": true
      },
      {
        "name": "company_license",
        "label": "Company / business license #",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "restricted_use_flag",
        "label": "Restricted-use (RUP) status",
        "type": "boolean",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 72,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "MA": {
    "agency": "Massachusetts Department of Agricultural Resources",
    "citation": {
      "reference": "333 CMR 10.14; 333 CMR 10.07(9)",
      "url": "https://www.law.cornell.edu/regulations/massachusetts/333-CMR-10-14"
    },
    "retentionYears": 3,
    "appliesTo": "All certified commercial applicators, certified private applicators, and licensed applicators or their employers; each pesticide application.",
    "verification": "researched",
    "notes": "Operational records must also include pollution incidents, liability insurance amount/insurer, and pesticide-related illnesses/injuries reported to applicator. RUP/state-limited applications require specific site description and supervising applicator signature/license review within 72 hours where applicable.",
    "fields": [
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "application_purpose",
        "label": "Purpose of application",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "supervisor_name",
        "label": "Supervising applicator",
        "type": "string",
        "required": false
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": false
      },
      {
        "name": "notes",
        "label": "Notes / unexpected occurrences",
        "type": "string",
        "required": false
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "MD": {
    "agency": "Maryland Department of Agriculture",
    "citation": {
      "reference": "COMAR 15.05.01.07(F), 15.05.01.12",
      "url": "https://www.law.cornell.edu/regulations/maryland/COMAR-15-05-01-12"
    },
    "retentionYears": 2,
    "appliesTo": "Certified private applicators: each general-use or RUP application; licensees and permit holders: pest identification, recommendations, and pesticide applications.",
    "verification": "researched",
    "notes": "Private applicator records include name/address, treated location including county/farm/field, date, brand/common name and EPA number, rate, total amount, area/units, and crop/site. Commercial/licensee records additionally include pest, owner/tenant, equipment, time of day, and wind direction/velocity except baits or applications in/within 3 feet of structures.",
    "fields": [
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": false
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "county",
        "label": "County of application",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "concentration",
        "label": "Application concentration",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": false
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": false
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": false
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": false
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": false
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "ME": {
    "agency": "Maine Board of Pesticides Control, Department of Agriculture, Conservation and Forestry",
    "citation": {
      "reference": "01-026 C.M.R. ch. 50, §1(A)",
      "url": "https://www.maine.gov/dacf/php/pesticides/documents2/rulemaking_2024/BPC-Ch50-amended_rule_legislative_Final.pdf"
    },
    "retentionYears": 2,
    "appliesTo": "Commercial agricultural producers and commercial applicators; pesticide application records for applications they make.",
    "verification": "partial",
    "notes": "Records must be kept current by recording all required information on the same day. Maine requires commercial applicator annual summary reports; a proposed/electronic reporting document indicates Jan. 31 reporting through Board-approved software. Outdoor weather details are partially verified from Chapter 50 context and should be captured.",
    "fields": [
      {
        "name": "county",
        "label": "County of application",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": false
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": false
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "active_ingredient",
        "label": "Active ingredient",
        "type": "string",
        "required": true
      },
      {
        "name": "rei_hours",
        "label": "Restricted-entry interval (REI)",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": true
      },
      {
        "name": "dilution_rate",
        "label": "Dilution rate",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "noncertified_applicator_name",
        "label": "Noncertified / trainee applicator",
        "type": "string",
        "required": false
      },
      {
        "name": "business_name_address",
        "label": "Business / operator name & address",
        "type": "string",
        "required": false
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": false
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": false
      },
      {
        "name": "temperature",
        "label": "Temperature",
        "type": "number",
        "required": false
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 0,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "MI": {
    "agency": "Michigan Department of Agriculture and Rural Development",
    "citation": {
      "reference": "Mich. Admin. Code R 285.636.15; MCL 324.8311",
      "url": "https://www.law.cornell.edu/regulations/michigan/Mich-Admin-Code-R-285-636-15"
    },
    "retentionYears": 3,
    "appliesTo": "Commercial applicators; RUP and general-use application records. Private-applicator state record fields not verified.",
    "verification": "researched",
    "notes": "MCL also requires annual RUP summary to the director before March 1 for commercial RUP use. Weather is not a required field in the cited commercial record rule.",
    "fields": [
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "concentration",
        "label": "Application concentration",
        "type": "string",
        "required": true
      },
      {
        "name": "total_mix_applied",
        "label": "Total diluted mix applied",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "application_purpose",
        "label": "Purpose of application",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "uncertain"
  },
  "MN": {
    "agency": "Minnesota Department of Agriculture",
    "citation": {
      "reference": "Minn. Stat. §18B.37, subd. 2",
      "url": "https://www.revisor.mn.gov/statutes/cite/18B.37"
    },
    "retentionYears": 5,
    "appliesTo": "Commercial applicators record pesticides used on each site; noncommercial applicators record restricted-use pesticides. Private agricultural applicator state record fields not verified in this section.",
    "verification": "researched",
    "notes": "Record must be completed within five days. Commercial applicators must give a copy to the customer. Portions not relevant may be omitted with commissioner approval.",
    "fields": [
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "temperature",
        "label": "Temperature",
        "type": "number",
        "required": true
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": true
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "business_name_address",
        "label": "Business / operator name & address",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 120,
    "customerCopyDays": null,
    "privateDuty": "uncertain"
  },
  "MO": {
    "agency": "Missouri Department of Agriculture",
    "citation": {
      "reference": "2 CSR 70-25.120 (effective Jan. 1, 2025)",
      "url": "https://www.law.cornell.edu/regulations/missouri/2-CSR-70-25.120"
    },
    "retentionYears": 3,
    "appliesTo": "Certified commercial applicators/employers: all pesticides; certified noncommercial applicators and public operators/employers: RUPs.",
    "verification": "researched",
    "notes": "Records completed within three business days. Outdoor weather required except specified structural/termite applications within 10 feet of buildings. Notes should capture agricultural producer request for less-than-label concentration if applicable.",
    "fields": [
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "noncertified_applicator_name",
        "label": "Noncertified / trainee applicator",
        "type": "string",
        "required": false
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "dilution_rate",
        "label": "Dilution rate",
        "type": "string",
        "required": true
      },
      {
        "name": "total_mix_applied",
        "label": "Total diluted mix applied",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "temperature",
        "label": "Temperature",
        "type": "number",
        "required": false
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": false
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": false
      },
      {
        "name": "notes",
        "label": "Notes / unexpected occurrences",
        "type": "string",
        "required": false
      }
    ],
    "recordWithinHours": 72,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "MS": {
    "agency": "Mississippi Department of Agriculture and Commerce, Bureau of Plant Industry",
    "citation": {
      "reference": "Title 2, Part 1, Subpart 3, Chapter 11 §111.01 (professional services)",
      "url": "https://agnet.mdac.ms.gov/agManage/uploads/1641.pdf"
    },
    "retentionYears": 2,
    "appliesTo": "Persons licensed or permitted under Mississippi professional-services rules; all work performed. Broader agricultural private/commercial pesticide-use record rule not fully verified.",
    "verification": "uncertain",
    "notes": "WDI records are retained while contract is current plus two years. Termiticide pretreatments require start/end time, vehicle ID, application volume/minute, tank size, nozzle type/size, PSI, and total diluted volume. Agricultural coverage is uncertain/partially verified.",
    "fields": [
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "application_purpose",
        "label": "Purpose of application",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "dilution_rate",
        "label": "Dilution rate",
        "type": "string",
        "required": true
      },
      {
        "name": "total_mix_applied",
        "label": "Total diluted mix applied",
        "type": "string",
        "required": true
      },
      {
        "name": "nozzle_type",
        "label": "Nozzle type",
        "type": "string",
        "required": false
      },
      {
        "name": "sprayer_pressure",
        "label": "Sprayer pressure",
        "type": "string",
        "required": false
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": false
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": false
      },
      {
        "name": "equipment_id",
        "label": "Equipment ID",
        "type": "string",
        "required": false
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "MT": {
    "agency": "Montana Department of Agriculture",
    "citation": {
      "reference": "ARM 4.10.207",
      "url": "https://agr.mt.gov/_docs/pesticides-docs/licensing-pesticides/14pesticidelic_MTLaws_Pesticides.pdf"
    },
    "retentionYears": 2,
    "appliesTo": "Certified commercial, public utility, government, and noncommercial applicators and operators; operational records for every application. Private RUP state duty partially verified only through extension/federal materials.",
    "verification": "researched",
    "notes": "Application records must be completed within 24 hours. Weather is required if applicable; seed and wood-product applicators have exceptions for pests/site/weather under ARM guidance.",
    "fields": [
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "noncertified_applicator_name",
        "label": "Noncertified / trainee applicator",
        "type": "string",
        "required": false
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "manufacturer_name",
        "label": "Manufacturer",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": false
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": false
      },
      {
        "name": "temperature",
        "label": "Temperature",
        "type": "number",
        "required": false
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "NC": {
    "agency": "North Carolina Department of Agriculture and Consumer Services",
    "citation": {
      "reference": "02 NCAC 09L .1402",
      "url": "http://ncrules.state.nc.us/ncac/title%2002%20-%20agriculture%20and%20consumer%20services/chapter%2009%20-%20food%20and%20drug%20protection/subchapter%20l/02%20ncac%2009l%20.1402.html"
    },
    "retentionYears": 3,
    "appliesTo": "All pesticide applicators using ground equipment; RUP applications. Records created within 72 hours.",
    "verification": "researched",
    "notes": "Amount may be formulation or active ingredient per unit of measure. Each day of application is a separate record. Weather is not required by this rule.",
    "fields": [
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "active_ingredient",
        "label": "Active ingredient",
        "type": "string",
        "required": false
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 72,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "ND": {
    "agency": "North Dakota Department of Agriculture",
    "citation": {
      "reference": "N.D.C.C. §4.1-33-14; N.D. Admin. Code 60-03-01-07",
      "url": "https://ndlegis.gov/information/acdata/pdf/60-03-01.pdf"
    },
    "retentionYears": 3,
    "appliesTo": "Commercial and public applicators: all pesticide applications and rinsate use/disposal; private applicators: all RUP applications.",
    "verification": "researched",
    "notes": "Records made within 24 hours. Commercial/public customer copy within 30 days unless waived. Weather required for outdoor applications except seed treatment, bait, or indoor applications. Right-of-way records require weather and geographic location in two-hour increments.",
    "fields": [
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": false
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": false
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": false
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": true
      },
      {
        "name": "pesticide_supplier",
        "label": "Pesticide supplier",
        "type": "string",
        "required": false
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": false
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": false
      },
      {
        "name": "temperature",
        "label": "Temperature",
        "type": "number",
        "required": false
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "carrier_volume",
        "label": "Carrier / finished spray volume",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": false
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "notes",
        "label": "Notes / unexpected occurrences",
        "type": "string",
        "required": false
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": 30,
    "privateDuty": "required"
  },
  "NE": {
    "agency": "Nebraska Department of Agriculture",
    "citation": {
      "reference": "25 Neb. Admin. Code ch. 2 §006",
      "url": "https://www.law.cornell.edu/regulations/nebraska/25-Neb-Admin-Code-ch-2-SS-006"
    },
    "retentionYears": 3,
    "appliesTo": "Commercial and noncommercial applicators for RUP applications and structural general-use applications; private RUP records are addressed separately but retention after rescission needs direct state confirmation.",
    "verification": "researched",
    "notes": "Commercial/noncommercial records must be created within 48 hours and kept at the principal place of business. Department guidance recommends wind direction/velocity, temperature, and REI for outdoor applications but does not require them in the cited section.",
    "fields": [
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "supervisor_name",
        "label": "Supervising applicator",
        "type": "string",
        "required": false
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": false
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": false
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "disposal_method",
        "label": "Disposal of unused pesticide",
        "type": "string",
        "required": false
      }
    ],
    "recordWithinHours": 48,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "NH": {
    "agency": "New Hampshire Department of Agriculture, Markets & Food, Division of Pesticide Control",
    "citation": {
      "reference": "N.H. Admin. Code Pes 901.02; Pes 901.04 annual reporting",
      "url": "https://gencourt.state.nh.us/rules/state_agencies/pes900.html"
    },
    "retentionYears": 2,
    "appliesTo": "Registrants and permittees; all pesticide applications by personnel working from registered firms/branches/subsidiaries; records maintained by both commercial and private applicators.",
    "verification": "researched",
    "notes": "Pes 901.02 has seven daily-use record elements. Annual reporting under Pes 901.04 requires additional product/EPA/active/acreage/amount information; include EPA and amount in the logger although not in the seven daily record elements.",
    "fields": [
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "pesticide_formulation",
        "label": "Pesticide formulation",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "NJ": {
    "agency": "New Jersey Department of Environmental Protection, Pesticide Control Program",
    "citation": {
      "reference": "N.J.A.C. 7:30-6.8, 7:30-7.3, 7:30-8.8",
      "url": "https://www.law.cornell.edu/regulations/new-jersey/N-J-A-C-7-30-6-8"
    },
    "retentionYears": 5,
    "appliesTo": "Licensed private and commercial pesticide applicators/businesses; any pesticide application, with longer termiticide retention.",
    "verification": "researched",
    "notes": "Records must be written as soon as possible and no later than 24 hours. For agricultural commodity applications, place includes farm name/address, specific field/greenhouse/land area, municipality/county, crop/commodity/stored product, and treated size. Product list/symbol correlation allowed.",
    "fields": [
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": true
      },
      {
        "name": "rei_hours",
        "label": "Restricted-entry interval (REI)",
        "type": "string",
        "required": false
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "county",
        "label": "County of application",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "active_ingredient",
        "label": "Active ingredient",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "carrier_volume",
        "label": "Carrier / finished spray volume",
        "type": "string",
        "required": true
      },
      {
        "name": "total_mix_applied",
        "label": "Total diluted mix applied",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "NM": {
    "agency": "New Mexico Department of Agriculture",
    "citation": {
      "reference": "21.17.50.10 NMAC; 21.17.56.15 NMAC",
      "url": "https://www.srca.nm.gov/parts/title21/21.017.0050.html"
    },
    "retentionYears": 2,
    "appliesTo": "Commercial, non-commercial, and public applicators for all pesticide applications; licensed/certified applicators have related records under 21.17.56.15. Private coverage partially verified through 21.17.56 after USDA rescission.",
    "verification": "researched",
    "notes": "Records completed and available within 24 hours. Outdoor weather required except baits in bait stations or applications in/immediately adjacent to structures. Customer copy upon written request.",
    "fields": [
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": false
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": false
      },
      {
        "name": "temperature",
        "label": "Temperature",
        "type": "number",
        "required": false
      },
      {
        "name": "concentration",
        "label": "Application concentration",
        "type": "string",
        "required": true
      },
      {
        "name": "carrier_volume",
        "label": "Carrier / finished spray volume",
        "type": "string",
        "required": false
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "aircraft_id",
        "label": "Aircraft ID",
        "type": "string",
        "required": false
      },
      {
        "name": "business_name_address",
        "label": "Business / operator name & address",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": 30,
    "privateDuty": "required"
  },
  "NV": {
    "agency": "Nevada Department of Agriculture",
    "citation": {
      "reference": "NAC 555.410",
      "url": "https://www.law.cornell.edu/regulations/nevada/NAC-555-410"
    },
    "retentionYears": 2,
    "appliesTo": "Persons subject to NAC 555.400/custom application license categories; aerial/agricultural ground and urban/structural fields have different records. Aerial/agricultural monthly pest-control operation reports are required.",
    "verification": "researched",
    "notes": "For aerial/agricultural ground: date, person/county, pilot/applicator, crop/site, units, field number/name/site ID, brand/generic + EPA + dosage, purpose, start/finish time, start/finish temperature and wind. Urban/structural records are narrower, with extra weather/area fields for ornamental/turf/right-of-way/aquatic/fumigation.",
    "fields": [
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "county",
        "label": "County of application",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "site_id",
        "label": "Site ID",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": true
      },
      {
        "name": "temperature",
        "label": "Temperature",
        "type": "number",
        "required": false
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": false
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": false
      },
      {
        "name": "total_mix_applied",
        "label": "Total diluted mix applied",
        "type": "string",
        "required": false
      },
      {
        "name": "concentration",
        "label": "Application concentration",
        "type": "string",
        "required": false
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "NY": {
    "agency": "New York State Department of Environmental Conservation",
    "citation": {
      "reference": "ECL §33-1205; 6 NYCRR 325.25; PRL electronic reporting",
      "url": "https://dec.ny.gov/environmental-protection/pesticides/pesticide-reporting-law"
    },
    "retentionYears": 3,
    "appliesTo": "Commercial applicators, technicians, commercial permittees: all pesticide applications; private applicators: restricted pesticides purchased/crop/method/date records.",
    "verification": "researched",
    "notes": "Commercial annual PRL reports are due electronically by Feb. 1 for prior calendar year; paper is no longer accepted. Commercial records also need address including five-digit ZIP and sufficiently precise place. Private applicator minimum records are restricted pesticides purchased, crops treated, application method, and dates; less complete than commercial records.",
    "fields": [
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": false
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "OH": {
    "agency": "Ohio Department of Agriculture",
    "citation": {
      "reference": "Ohio Admin. Code 901:5-11-10",
      "url": "https://codes.ohio.gov/ohio-administrative-code/rule-901:5-11-10"
    },
    "retentionYears": 3,
    "appliesTo": "Commercial applicators/pesticide businesses; private applicators for each application required under paragraph (E), primarily RUP agricultural applications.",
    "verification": "researched",
    "notes": "Commercial excluding categories 7/10 includes weather when applicable. Private records include applicator name/license, brand/product and EPA number, total amount, location/field number, total area/acreage, crop, and date. Records created on date of application; some customer-copy rules apply.",
    "fields": [
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "carrier_volume",
        "label": "Carrier / finished spray volume",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": true
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": true
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": true
      },
      {
        "name": "temperature",
        "label": "Temperature",
        "type": "number",
        "required": true
      },
      {
        "name": "sky",
        "label": "Humidity / sky conditions",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "OK": {
    "agency": "Oklahoma Department of Agriculture, Food, and Forestry",
    "citation": {
      "reference": "2 O.S. §3-83; OAC 35:30-17-21",
      "url": "https://okrules.elaws.us/oac/35:30-17-21"
    },
    "retentionYears": 2,
    "appliesTo": "Commercial and noncommercial applicators; pesticide activities, applications, contracts, and wood infestation reports.",
    "verification": "researched",
    "notes": "Notes should capture required adjuvants or drift agents when label requires them, copy of product label/labeling, contracts, WDI reports, and other Board-required information. Records kept at principal business location and accessible for inspection.",
    "fields": [
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "business_name_address",
        "label": "Business / operator name & address",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "dilution_rate",
        "label": "Dilution rate",
        "type": "string",
        "required": true
      },
      {
        "name": "total_mix_applied",
        "label": "Total diluted mix applied",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "notes",
        "label": "Notes / unexpected occurrences",
        "type": "string",
        "required": false
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "rei_hours",
        "label": "Restricted-entry interval (REI)",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "OR": {
    "agency": "Oregon Department of Agriculture",
    "citation": {
      "reference": "ORS 634.146; OAR 603-057-0130",
      "url": "https://www.oregonlegislature.gov/bills_laws/ors/ors634.html"
    },
    "retentionYears": 3,
    "appliesTo": "Pesticide operators; public and noncommercial applicators maintain operator-style records. Private farm applicator state field list not verified.",
    "verification": "researched",
    "notes": "ORS text uses date and approximate time; ODA guidance says beginning and ending time. Field-crop owner can request a written statement within 40 days. Apprentice/trainee applications require both trainee/apprentice and supervisor names/license numbers.",
    "fields": [
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_phone",
        "label": "Customer phone",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": true
      },
      {
        "name": "pesticide_supplier",
        "label": "Pesticide supplier",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "concentration",
        "label": "Application concentration",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "carrier_volume",
        "label": "Carrier / finished spray volume",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": true
      },
      {
        "name": "aircraft_id",
        "label": "Aircraft ID",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "supervisor_name",
        "label": "Supervising applicator",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "PA": {
    "agency": "Pennsylvania Department of Agriculture",
    "citation": {
      "reference": "7 Pa. Code §§128.35, 128.65",
      "url": "https://www.pacodeandbulletin.gov/secure/pacode/data/007/chapter128/s128.65.html"
    },
    "retentionYears": 3,
    "appliesTo": "Pesticide application businesses: every pesticide application; private applicators: every RUP application. WPS can require general-use records for agricultural employers.",
    "verification": "researched",
    "notes": "Records completed in written/printable form within 24 hours. If pesticide has a reentry time, date includes hour completed. Commercial ag RUP customer copy within 30 days.",
    "fields": [
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": false
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": false
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": false
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "noncertified_applicator_name",
        "label": "Noncertified / trainee applicator",
        "type": "string",
        "required": false
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": 30,
    "privateDuty": "required"
  },
  "RI": {
    "agency": "Rhode Island Department of Environmental Management",
    "citation": {
      "reference": "250-RICR-40-15-2.6(B)",
      "url": "https://rules.sos.ri.gov/regulations/part/250-40-15-2"
    },
    "retentionYears": 2,
    "appliesTo": "Commercial applicators; applications of general-use, restricted-use, and state-limited-use pesticides. Private applicator application-record state requirements not verified.",
    "verification": "researched",
    "notes": "Upon completion, applicator must leave a detailed invoice at the property containing product/EPA/amount, persons certified/licensed and supervised participants, certification/license number, and post-application safety/environment/health label instructions. RUP applications must be recorded no later than 14 days.",
    "fields": [
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "pesticide_formulation",
        "label": "Pesticide formulation",
        "type": "string",
        "required": true
      },
      {
        "name": "active_ingredient",
        "label": "Active ingredient",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "total_mix_applied",
        "label": "Total diluted mix applied",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "application_purpose",
        "label": "Purpose of application",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "notes",
        "label": "Notes / unexpected occurrences",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "uncertain"
  },
  "SC": {
    "agency": "Clemson University Department of Pesticide Regulation",
    "citation": {
      "reference": "S.C. Code Regs. 27-1083(C)",
      "url": "https://www.law.cornell.edu/regulations/south-carolina/R-27-1083"
    },
    "retentionYears": 2,
    "appliesTo": "Companies/firms employing licensed commercial or noncommercial applicators; self-employed commercial applicators; employers of noncommercial applicators. Private applicator record duty not verified.",
    "verification": "researched",
    "notes": "Records include quantity of each pesticide used, received, or purchased. Pests need not be listed for general household or general commercial/industrial insect control. Weather is not required by this section.",
    "fields": [
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "active_ingredient",
        "label": "Active ingredient",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": false
      },
      {
        "name": "application_purpose",
        "label": "Purpose of application",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "uncertain"
  },
  "SD": {
    "agency": "South Dakota Department of Agriculture and Natural Resources",
    "citation": {
      "reference": "ARSD 12:56:07:01 and 12:56:07:03",
      "url": "https://www.law.cornell.edu/regulations/south-dakota/ARSD-12-56-07-01"
    },
    "retentionYears": 3,
    "appliesTo": "Commercial applicators; records for each pesticide application. Private applicator exact state duty not verified.",
    "verification": "researched",
    "notes": "Records completed by close of business day per DANR sample form/extension. Weather requirement excludes bait stations and pesticide applications in or immediately adjacent to structures.",
    "fields": [
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "manufacturer_name",
        "label": "Manufacturer",
        "type": "string",
        "required": true
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": true
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": true
      },
      {
        "name": "temperature",
        "label": "Temperature",
        "type": "number",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "concentration",
        "label": "Application concentration",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "business_name_address",
        "label": "Business / operator name & address",
        "type": "string",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "uncertain"
  },
  "TN": {
    "agency": "Tennessee Department of Agriculture",
    "citation": {
      "reference": "Tenn. Comp. R. & Regs. 0080-09-04-.06",
      "url": "https://www.law.cornell.edu/regulations/tennessee/Tenn-Comp-R-Regs-0080-09-04-.06"
    },
    "retentionYears": 2,
    "appliesTo": "Commercial applicators: each custom application and each RUP application they apply or authorize by direct supervision; private applicators: each RUP application.",
    "verification": "researched",
    "notes": "For RUPs, EPA registration number and time of application are required. Applicators must supply required records within 48 hours of request by owner/tenant.",
    "fields": [
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "dilution_rate",
        "label": "Dilution rate",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": false
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": false
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "TX": {
    "agency": "Texas Department of Agriculture",
    "citation": {
      "reference": "TDA pesticide applicator record requirements; 4 TAC §7.144 for structural pest-control records",
      "url": "https://texasagriculture.gov/portals/0/forms/pest/applicator/pesticide_applicator_record_requirements.pdf"
    },
    "retentionYears": 2,
    "appliesTo": "Agricultural/private/commercial pesticide applicators have TDA record requirements; 4 TAC §7.144 separately governs structural pest-control use records. Exact agricultural TAC citation partially verified.",
    "verification": "researched",
    "notes": "TDA record-requirements PDF lists wind direction/velocity and air temperature, equipment IDs/FAA N-number, and spray permit number for regulated herbicides in regulated counties. Structural §7.144 requires customer/service address, pesticide/device, amounts, mixing rate, target pest/purpose, date, and applicator/license/TPCL numbers.",
    "fields": [
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "carrier_volume",
        "label": "Carrier / finished spray volume",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": true
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": true
      },
      {
        "name": "temperature",
        "label": "Temperature",
        "type": "number",
        "required": true
      },
      {
        "name": "aircraft_id",
        "label": "Aircraft ID",
        "type": "string",
        "required": true
      },
      {
        "name": "equipment_id",
        "label": "Equipment ID",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "permit_number",
        "label": "Permit / operator ID",
        "type": "string",
        "required": false
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "UT": {
    "agency": "Utah Department of Agriculture and Food",
    "citation": {
      "reference": "Utah Admin. Code R68-7-11(11), R68-7-12(8), R68-7-13(8)",
      "url": "https://www.law.cornell.edu/regulations/utah/Utah-Admin-Code-R68-7-11"
    },
    "retentionYears": 2,
    "appliesTo": "Commercial applicators: any pesticide application; non-commercial applicators: RUP applications; private applicators: covered pesticide applications under R68-7-13, exact post-rescission private scope partially verified.",
    "verification": "researched",
    "notes": "Records created within 24 hours and kept in uniform format. Commercial records require business address and commercial applicator license number; noncommercial/private rules are similar but scope differs.",
    "fields": [
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "dilution_rate",
        "label": "Dilution rate",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "application_purpose",
        "label": "Purpose of application",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "business_name_address",
        "label": "Business / operator name & address",
        "type": "string",
        "required": false
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "VA": {
    "agency": "Virginia Department of Agriculture and Consumer Services",
    "citation": {
      "reference": "2VAC5-680-50, 2VAC5-680-70; 2VAC5-685-200, -210",
      "url": "https://law.lis.virginia.gov/admincode/title2/agency5/chapter680/section70/"
    },
    "retentionYears": 2,
    "appliesTo": "Pesticide businesses: each general-use and RUP application; commercial applicators not for hire and registered technicians not for hire: each pesticide application. Private applicator requirements not verified in these sections.",
    "verification": "researched",
    "notes": "Records not readily available must be submitted to VDACS within 72 hours of written request. No wind/weather field in cited rule.",
    "fields": [
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_phone",
        "label": "Customer phone",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "carrier_volume",
        "label": "Carrier / finished spray volume",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "uncertain"
  },
  "VT": {
    "agency": "Vermont Agency of Agriculture, Food & Markets",
    "citation": {
      "reference": "Vermont Rule for Control of Pesticides §§8.01, 8.02, 8.04",
      "url": "https://agriculture.vermont.gov/sites/agriculture/files/Vermont%20Rule%20for%20Control%20of%20Pesticides%20in%20Accordance%20with%206%20V.S.A.%20Chapter%2087%20(3.8.23).pdf"
    },
    "retentionYears": 3,
    "appliesTo": "Certified private applicators: Class A/RUP applications; certified commercial and non-commercial applicators: any pesticide used; licensed companies retain operational records.",
    "verification": "researched",
    "notes": "Private applicator summary includes REI and active ingredients for 8.01; commercial/noncommercial routine records include customer and ten core items. Annual usage/reporting obligations continue for certain licensees/companies.",
    "fields": [
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": false
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": false
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "noncertified_applicator_name",
        "label": "Noncertified / trainee applicator",
        "type": "string",
        "required": false
      },
      {
        "name": "rei_hours",
        "label": "Restricted-entry interval (REI)",
        "type": "string",
        "required": false
      },
      {
        "name": "active_ingredient",
        "label": "Active ingredient",
        "type": "string",
        "required": false
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "WA": {
    "agency": "Washington State Department of Agriculture",
    "citation": {
      "reference": "RCW 17.21.100; WAC 16-228-1320",
      "url": "https://apps.leg.wa.gov/wac/default.aspx?cite=16-228-1320"
    },
    "retentionYears": 7,
    "appliesTo": "Certified applicators; persons applying pesticides to more than one acre of agricultural land in a calendar year; public roadside spray entities; specified landscape applicators.",
    "verification": "researched",
    "notes": "Records completed the same day. Agricultural land >=1 acre must be locatable on adopted/map form using section-township-range, GPS, or irrigation block/farm unit. Commercial applicators applying to ag crop/land must provide copy to owner/lessee; employers with employees must also keep records for seven years.",
    "fields": [
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "carrier_volume",
        "label": "Carrier / finished spray volume",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": true
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": true
      },
      {
        "name": "temperature",
        "label": "Temperature",
        "type": "number",
        "required": true
      },
      {
        "name": "concentration",
        "label": "Application concentration",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "permit_number",
        "label": "Permit / operator ID",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 0,
    "customerCopyDays": 30,
    "privateDuty": "required"
  },
  "WI": {
    "agency": "Wisconsin Department of Agriculture, Trade and Consumer Protection",
    "citation": {
      "reference": "Wis. Admin. Code ATCP 29.21, 29.33; ATCP 30 atrazine records",
      "url": "https://docs.legis.wisconsin.gov/document/administrativecode/ATCP%2029.21(1)"
    },
    "retentionYears": 3,
    "appliesTo": "Commercial application businesses: each pesticide application; private agricultural producers applying RUPs; certified applicators where required.",
    "verification": "researched",
    "notes": "Records completed on day of application. Amount may be concentration+total quantity or rate+total area. Mix/load location is required if other than licensed business location, with small equipment/prepackaged exceptions. Products with atrazine or isoxaflutole should be retained three years per extension guidance.",
    "fields": [
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      },
      {
        "name": "end_time",
        "label": "End time",
        "type": "time",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "concentration",
        "label": "Application concentration",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "mix_load_location",
        "label": "Mix / load location",
        "type": "string",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "WV": {
    "agency": "West Virginia Department of Agriculture",
    "citation": {
      "reference": "W. Va. C.S.R. §§61-12A-9 and 61-12B-7",
      "url": "https://www.law.cornell.edu/regulations/west-virginia/W-Va-C-S-R-SS-61-12A-9"
    },
    "retentionYears": 2,
    "appliesTo": "Commercial and certified public applicators: all pesticides; private applicators: RUP applications; pesticide businesses: all pesticide applications as licensing condition.",
    "verification": "researched",
    "notes": "Private RUP records include certified and noncertified applicator names/certification numbers and records required for noncertified applicator supervision. Weather is not required by cited sections.",
    "fields": [
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "pesticide_formulation",
        "label": "Pesticide formulation",
        "type": "string",
        "required": true
      },
      {
        "name": "dilution_rate",
        "label": "Dilution rate",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "noncertified_applicator_name",
        "label": "Noncertified / trainee applicator",
        "type": "string",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  },
  "WY": {
    "agency": "Wyoming Department of Agriculture",
    "citation": {
      "reference": "010-62 Wyo. Code R. §62-4; Chapter 28 §14",
      "url": "https://www.law.cornell.edu/regulations/wyoming/010-62-Wyo-Code-R-SS-62-4"
    },
    "retentionYears": 2,
    "appliesTo": "Commercial applicators must maintain records for any commercial pesticide application; rule also states commercial and private applicators retain required accurate records for pesticides applied, but private field list was partially verified.",
    "verification": "researched",
    "notes": "Records include state special local need number if applicable and names/certification numbers of commercial applicator or supervising applicator plus apprentice applicators. Weather required at time of application.",
    "fields": [
      {
        "name": "customer_name",
        "label": "Customer / person for whom applied",
        "type": "string",
        "required": true
      },
      {
        "name": "customer_address",
        "label": "Customer address",
        "type": "string",
        "required": true
      },
      {
        "name": "location",
        "label": "Location / field / site description",
        "type": "string",
        "required": true
      },
      {
        "name": "area_treated",
        "label": "Area treated",
        "type": "string",
        "required": true
      },
      {
        "name": "crop_treated",
        "label": "Crop / commodity / site treated",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target pest",
        "type": "string",
        "required": true
      },
      {
        "name": "brand_name",
        "label": "Brand / product name",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA registration number",
        "type": "string",
        "required": true
      },
      {
        "name": "state_registration_no",
        "label": "State registration / SLN number",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Total amount applied",
        "type": "string",
        "required": true
      },
      {
        "name": "rate",
        "label": "Application rate",
        "type": "string",
        "required": true
      },
      {
        "name": "method",
        "label": "Method / equipment",
        "type": "string",
        "required": true
      },
      {
        "name": "date",
        "label": "Application date",
        "type": "date",
        "required": true
      },
      {
        "name": "application_time",
        "label": "Application time",
        "type": "time",
        "required": true
      },
      {
        "name": "temperature",
        "label": "Temperature",
        "type": "number",
        "required": true
      },
      {
        "name": "wind_direction",
        "label": "Wind direction",
        "type": "string",
        "required": true
      },
      {
        "name": "wind_speed",
        "label": "Wind speed",
        "type": "number",
        "required": true
      },
      {
        "name": "applicator_name",
        "label": "Applicator name",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator certification / license #",
        "type": "string",
        "required": true
      },
      {
        "name": "noncertified_applicator_name",
        "label": "Noncertified / trainee applicator",
        "type": "string",
        "required": true
      },
      {
        "name": "start_time",
        "label": "Start time",
        "type": "time",
        "required": true
      }
    ],
    "recordWithinHours": 24,
    "customerCopyDays": null,
    "privateDuty": "required"
  }
};

// Recommended base record for every application (drift defense / audits / WPS overlap).
const BASE_RECORD_FIELDS = [
  "brand_name",
  "epa_reg_no",
  "active_ingredient",
  "restricted_use_flag",
  "amount_applied",
  "rate",
  "dilution_rate",
  "carrier_volume",
  "total_mix_applied",
  "area_treated",
  "area_unit",
  "crop_treated",
  "target_pest",
  "location",
  "county",
  "date",
  "start_time",
  "end_time",
  "wind_speed",
  "wind_direction",
  "temperature",
  "sky",
  "boom_height",
  "ground_speed",
  "buffer_distance",
  "inversion_observed",
  "sensitive_sites",
  "method",
  "nozzle_type",
  "sprayer_pressure",
  "applicator_name",
  "applicator_license",
  "supervisor_name",
  "permit_number",
  "site_id",
  "rei_hours",
  "phi_days",
  "customer_name",
  "customer_address",
  "customer_copy_provided",
  "customer_copy_date",
  "notes"
];
