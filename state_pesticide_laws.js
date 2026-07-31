// State pesticide record-keeping requirements (50 states).
// Source: PracticalFarmTools research dataset (fsma-calculator-2026).
const STATE_LAWS = {
  "AL": {
    "agency": "Alabama Department of Agriculture and Industries",
    "citation": {
      "reference": "Ala. Admin. Code r. 80-1-13-.08",
      "url": "https://agi.alabama.gov/pesticides/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "AK": {
    "agency": "Alaska Department of Environmental Conservation",
    "citation": {
      "reference": "18 AAC 90.415",
      "url": "https://dec.alaska.gov/eh/pest/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "dilution_rate",
        "label": "Dilution or Concentration Rate",
        "type": "string",
        "required": true
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "AZ": {
    "agency": "Arizona Department of Agriculture",
    "citation": {
      "reference": "A.A.C. R3-3-208",
      "url": "https://agriculture.az.gov/pest-management-division"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "permit_number",
        "label": "Permit Number / Operator ID",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "Permit number must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "AR": {
    "agency": "Arkansas Department of Agriculture",
    "citation": {
      "reference": "Ark. Admin. Code 209.02.4",
      "url": "https://www.agriculture.arkansas.gov/plant-industries/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "CA": {
    "agency": "California Department of Pesticide Regulation",
    "citation": {
      "reference": "3 CCR § 6624",
      "url": "https://www.cdpr.ca.gov/"
    },
    "fields": [
      {
        "name": "permit_number",
        "label": "Permit Number / Operator ID",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "Permit number must be alphanumeric and can contain hyphens."
      },
      {
        "name": "county",
        "label": "County of Application",
        "type": "string",
        "required": true
      },
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "rei_hours",
        "label": "Restricted Entry Interval (REI) Hours",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "REI hours must be a non-negative number."
      },
      {
        "name": "phi_days",
        "label": "Pre-Harvest Interval (PHI) Days",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "PHI days must be a non-negative number."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "CO": {
    "agency": "Colorado Department of Agriculture",
    "citation": {
      "reference": "8 CCR 1203-2, Part 6",
      "url": "https://ag.colorado.gov/plants/pesticides"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "CT": {
    "agency": "Connecticut Department of Energy and Environmental Protection",
    "citation": {
      "reference": "CGS § 22a-66g",
      "url": "https://portal.ct.gov/DEEP/Pesticides/Pesticide-Management-Program"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "DE": {
    "agency": "Delaware Department of Agriculture",
    "citation": {
      "reference": "3 Del. Admin. Code 1201-14.0",
      "url": "https://agriculture.delaware.gov/pesticides-planning-survey/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "FL": {
    "agency": "Florida Department of Agriculture and Consumer Services",
    "citation": {
      "reference": "Fla. Admin. Code r. 5E-9.032",
      "url": "https://www.fdacs.gov/Business-Services/Pesticide-Licensing"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "GA": {
    "agency": "Georgia Department of Agriculture",
    "citation": {
      "reference": "Ga. Comp. R. & Regs. 40-21-2-.02",
      "url": "http://agr.georgia.gov/pesticides.aspx"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "HI": {
    "agency": "Hawaii Department of Agriculture",
    "citation": {
      "reference": "HAR § 4-66-62",
      "url": "https://hdoa.hawaii.gov/pi/pest/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "ID": {
    "agency": "Idaho State Department of Agriculture",
    "citation": {
      "reference": "IDAPA 02.03.03.400",
      "url": "https://agri.idaho.gov/main/5-2/pesticides/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "IL": {
    "agency": "Illinois Department of Agriculture",
    "citation": {
      "reference": "8 Ill. Admin. Code 250.120",
      "url": "https://agr.illinois.gov/pesticides.html"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "IN": {
    "agency": "Office of Indiana State Chemist",
    "citation": {
      "reference": "357 IAC 1-4-4",
      "url": "https://oisc.purdue.edu/pesticide/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "IA": {
    "agency": "Iowa Department of Agriculture and Land Stewardship",
    "citation": {
      "reference": "IAC 21-45.26(45)",
      "url": "https://iowaagriculture.gov/pesticide-bureau"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "KS": {
    "agency": "Kansas Department of Agriculture",
    "citation": {
      "reference": "K.A.R. 4-13-9",
      "url": "https://agriculture.ks.gov/divisions-programs/pesticide-fertilizer"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "KY": {
    "agency": "Kentucky Department of Agriculture",
    "citation": {
      "reference": "302 KAR 31:015",
      "url": "https://www.kyagr.com/consumer/pesticides.html"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "LA": {
    "agency": "Louisiana Department of Agriculture and Forestry",
    "citation": {
      "reference": "LAC 7:XXIII.117",
      "url": "https://www.ldaf.state.la.us/licensing/pesticides/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "ME": {
    "agency": "Maine Board of Pesticides Control",
    "citation": {
      "reference": "01-026 CMR Chapter 50",
      "url": "https://www.maine.gov/dacf/php/pesticides/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "MD": {
    "agency": "Maryland Department of Agriculture",
    "citation": {
      "reference": "COMAR 15.05.01.14",
      "url": "https://mda.maryland.gov/plants-pests/Pages/pesticide_regulation.aspx"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "MA": {
    "agency": "Massachusetts Department of Agricultural Resources",
    "citation": {
      "reference": "333 CMR 10.14",
      "url": "https://www.mass.gov/pesticide-licensing-and-integrated-pest-management-ipm"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "MI": {
    "agency": "Michigan Department of Agriculture and Rural Development",
    "citation": {
      "reference": "Mich. Admin. Code R 285.636.15",
      "url": "https://www.michigan.gov/mdard/licensing/pesticide"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "MN": {
    "agency": "Minnesota Department of Agriculture",
    "citation": {
      "reference": "Minn. Stat. § 18B.37",
      "url": "https://www.mda.state.mn.us/pesticide-fertilizer/pesticide-applicator-licensing"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "MS": {
    "agency": "Mississippi Department of Agriculture and Commerce",
    "citation": {
      "reference": "Miss. Admin. Code 2-1-3",
      "url": "https://www.mdac.ms.gov/bureaus-departments/plant-industry/pesticide-division/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "MO": {
    "agency": "Missouri Department of Agriculture",
    "citation": {
      "reference": "2 CSR 70-25.060",
      "url": "https://agriculture.mo.gov/plants/pesticides/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "MT": {
    "agency": "Montana Department of Agriculture",
    "citation": {
      "reference": "ARM 4.10.207",
      "url": "https://agr.mt.gov/Pesticides"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "NE": {
    "agency": "Nebraska Department of Agriculture",
    "citation": {
      "reference": "Title 25, Chapter 2",
      "url": "https://nda.nebraska.gov/pesticide/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "NV": {
    "agency": "Nevada Department of Agriculture",
    "citation": {
      "reference": "NAC 555.440",
      "url": "https://agri.nv.gov/Pesticides/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "NH": {
    "agency": "New Hampshire Department of Agriculture, Markets & Food",
    "citation": {
      "reference": "Pes 501.01",
      "url": "https://www.agriculture.nh.gov/divisions/pesticide-control/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "NJ": {
    "agency": "New Jersey Department of Environmental Protection",
    "citation": {
      "reference": "N.J.A.C. 7:30-6.8",
      "url": "https://www.nj.gov/dep/enforcement/pcp/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "NM": {
    "agency": "New Mexico Department of Agriculture",
    "citation": {
      "reference": "NMAC 21.17.50",
      "url": "https://www.nmda.nmsu.edu/nmda-homepage/divisions/aes/pesticides/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "NY": {
    "agency": "New York State Department of Environmental Conservation",
    "citation": {
      "reference": "6 NYCRR § 325.25",
      "url": "https://www.dec.ny.gov/chemical/298.html"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "NC": {
    "agency": "North Carolina Department of Agriculture and Consumer Services",
    "citation": {
      "reference": "02 NCAC 09L .1400",
      "url": "https://www.ncagr.gov/SPDiv/pesticides/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "ND": {
    "agency": "North Dakota Department of Agriculture",
    "citation": {
      "reference": "N.D. Admin. Code 7-04-01-08",
      "url": "https://www.nd.gov/ndda/program/pesticide-program"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "OH": {
    "agency": "Ohio Department of Agriculture",
    "citation": {
      "reference": "O.A.C. 901:5-11-10",
      "url": "https://agri.ohio.gov/divisions/plant-health/pesticides/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "OK": {
    "agency": "Oklahoma Department of Agriculture, Food, and Forestry",
    "citation": {
      "reference": "O.A.C. 35:30-17-24",
      "url": "https://www.oda.state.ok.us/cps/pesticide.htm"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "OR": {
    "agency": "Oregon Department of Agriculture",
    "citation": {
      "reference": "OAR 603-057-0130",
      "url": "https://www.oregon.gov/oda/programs/Pesticides/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "PA": {
    "agency": "Pennsylvania Department of Agriculture",
    "citation": {
      "reference": "7 Pa. Code § 128.65",
      "url": "https://www.agriculture.pa.gov/Plants_Land_Water/pesticides/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "RI": {
    "agency": "Rhode Island Department of Environmental Management",
    "citation": {
      "reference": "250-RICR-40-15-2",
      "url": "http://www.dem.ri.gov/programs/agriculture/pesticides.php"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "SC": {
    "agency": "Clemson University Department of Pesticide Regulation",
    "citation": {
      "reference": "S.C. Code Regs. 27-1077",
      "url": "https://www.clemson.edu/public/regulatory/pesticide-regulation/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "SD": {
    "agency": "South Dakota Department of Agriculture and Natural Resources",
    "citation": {
      "reference": "ARSD 12:56:06",
      "url": "https://danr.sd.gov/Agriculture/Inspection/Pesticide/default.aspx"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "TN": {
    "agency": "Tennessee Department of Agriculture",
    "citation": {
      "reference": "Tenn. Comp. R. & Regs. 0080-06-14-.07",
      "url": "https://www.tn.gov/agriculture/businesses/pesticides.html"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "TX": {
    "agency": "Texas Department of Agriculture",
    "citation": {
      "reference": "4 TAC § 7.33",
      "url": "https://texasagriculture.gov/regulatory-programs/pesticides/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "county",
        "label": "County of Application",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "UT": {
    "agency": "Utah Department of Agriculture and Food",
    "citation": {
      "reference": "R68-7-10",
      "url": "https://ag.utah.gov/farmers/plants-industry/pesticides/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "VT": {
    "agency": "Vermont Agency of Agriculture, Food and Markets",
    "citation": {
      "reference": "V.A.R. 20-031-011",
      "url": "https://agriculture.vermont.gov/public-health-agricultural-resource-management-division/pesticide-program"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "VA": {
    "agency": "Virginia Department of Agriculture and Consumer Services",
    "citation": {
      "reference": "2 VAC 5-685-110",
      "url": "https://www.vdacs.virginia.gov/pesticide-applicator-certification.shtml"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "WA": {
    "agency": "Washington State Department of Agriculture",
    "citation": {
      "reference": "WAC 16-228-1320",
      "url": "https://agr.wa.gov/departments/pesticides-and-fertilizers/pesticides"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "county",
        "label": "County of Application",
        "type": "string",
        "required": true
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "WV": {
    "agency": "West Virginia Department of Agriculture",
    "citation": {
      "reference": "W. Va. Code Regs. § 61-12A-10",
      "url": "https://agriculture.wv.gov/divisions/regulatory-environmental-protection/pesticides/"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "WI": {
    "agency": "Wisconsin Department of Agriculture, Trade and Consumer Protection",
    "citation": {
      "reference": "ATCP 29.50",
      "url": "https://datcp.wi.gov/Pages/Programs_Services/PesticidesFertilizers.aspx"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  },
  "WY": {
    "agency": "Wyoming Department of Agriculture",
    "citation": {
      "reference": "Chapter 28, Section 8",
      "url": "https://wyagric.state.wy.us/technical-services/pesticide-registration"
    },
    "fields": [
      {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": true,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
      },
      {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": true,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
      },
      {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": true
      },
      {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": true,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
      },
      {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": true,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
      },
      {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": true,
        "options": [
          "N",
          "NNE",
          "NE",
          "ENE",
          "E",
          "ESE",
          "SE",
          "SSE",
          "S",
          "SSW",
          "SW",
          "WSW",
          "W",
          "WNW",
          "NW",
          "NNW",
          "Calm"
        ]
      },
      {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": true,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
      },
      {
        "name": "target_pest",
        "label": "Target Pest",
        "type": "string",
        "required": false
      }
    ]
  }
};
