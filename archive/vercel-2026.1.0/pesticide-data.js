/**
 * Practical Farm Tools — Pesticide Data Vault (Phase 2)
 * 40+ specialty crop products with hazard metadata,
 * EPA label URLs, OMRI tags, and deep vegetable hierarchy.
 * © 2026 Practical Farm Tools. All rights reserved.
 */

// EPA LABEL DATABASE (Mock PPLS Registry)
export const PESTICIDE_DB = {
    'default': [
        // Orchards
        { group: 'Apples', page: 2 },
        { group: 'Peaches', page: 4 },
        { group: 'Cherries', page: 5 },
        { group: 'Pears', page: 6 },
        // Berries
        { group: 'Blueberries', page: 8 },
        { group: 'Strawberries', page: 9 },
        { group: 'Cranberries', page: 10 },
        { group: 'Raspberries', page: 11 },
        // Vegetables ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Deep Dive
        { group: 'Tomatoes', page: 12 },
        { group: 'Peppers', page: 13 },
        { group: 'Eggplant', page: 14 },
        { group: 'Cucurbits', page: 15 },
        { group: 'Brassicas', page: 16 },
        { group: 'Alliums', page: 17 },
        { group: 'Leafy Greens', page: 18 },
        { group: 'Beans', page: 19 },
        { group: 'Potatoes', page: 20 },
        // Row Crops
        { group: 'Corn', page: 22 },
        { group: 'Soybeans', page: 23 },
        { group: 'Wheat', page: 24 },
        { group: 'Barley', page: 25 },
        { group: 'Oats', page: 26 },
        // Pasture / Forage
        { group: 'Hay / Alfalfa', page: 28 },
        { group: 'Clover', page: 29 },
        { group: 'Pasture Grass', page: 30 },
        // Right-of-Way
        { group: 'Roadsides', page: 32 },
        { group: 'Fence Lines', page: 33 },
        { group: 'Utility Corridors', page: 34 }
    ]
};

// STARRED / PRIORITY CROPS
export const STARRED_CROPS = ['Apples', 'Blueberries', 'Potatoes', 'Tomatoes', 'Hay / Alfalfa', 'Corn'];

// NOZZLE DRIFT CREDIT (ft reduction)
// 2026 EPA Spray Drift Mitigation
export const NOZZLE_CREDIT = { "AI": 75, "TTI": 50, "AIXR": 50, "TT": 25, "XR": 0 };

// 50-STATE NAME MAP (abbrev ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ full name)
export const STATE_NAMES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire',
    'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina',
    'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania',
    'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee',
    'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington',
    'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

// PRODUCT RATE CONFIGS (keyed by EPA Reg No)
export const PRODUCT_RATES = {
    '1021-1772': { rate: 18.0, unit: 'oz', maxRate: 18.0, minRate: 9.0 },
    '62719-621': { rate: 6.0,  unit: 'oz', maxRate: 10.0, minRate: 4.0 },
    '50534-211': { rate: 1.5,  unit: 'pts', maxRate: 2.25, minRate: 1.0 },
    '7969-393':  { rate: 11.4, unit: 'oz', maxRate: 13.7, minRate: 9.2 },
    '8033-36':   { rate: 5.3,  unit: 'oz', maxRate: 8.0,  minRate: 2.5 },
    '352-857':   { rate: 4.0,  unit: 'oz', maxRate: 4.0,  minRate: 3.2 },
    '62719-541': { rate: 6.0,  unit: 'oz', maxRate: 7.0,  minRate: 3.0 },
    '264-1155':  { rate: 6.84, unit: 'oz', maxRate: 6.84, minRate: 5.5 },
    '66222-270': { rate: 3.0,  unit: 'lb', maxRate: 4.0,  minRate: 2.5 },
    '264-1053':  { rate: 7.0,  unit: 'oz', maxRate: 7.0,  minRate: 3.5 },
    '264-1156':  { rate: 4.0,  unit: 'oz', maxRate: 6.5,  minRate: 2.0 },
    '7969-294':  { rate: 1.5,  unit: 'pts', maxRate: 2.5,  minRate: 0.75 },
    '241-416':   { rate: 2.0,  unit: 'pts', maxRate: 4.2,  minRate: 1.5 },
};

export const DEFAULT_RATE = { rate: 2.5, unit: 'pts', maxRate: 5.0, minRate: 1.0 };

// SEARCHABLE PRODUCT CATALOG ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 40+ Products
// Mandatory: name, epa, type, moa, ai, rate, unit, maxRate, minRate,
//            rei (hours), phi (days), hazards, labelUrl, tags
export const PRODUCT_CATALOG = [
    { name: 'BRAVO WEATHER STIK',    epa: '50534-188',  type: 'Fungicide', moa: 'M05', ai: 'Chlorothalonil',                    rate: 1.5,  unit: 'pts', maxRate: 2.25, minRate: 1.0,  rei: 12, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'high', GA: 'medium', PA: 'high' } },
    { name: 'MIRAVIS PRIME',         epa: '100-1603',   type: 'Fungicide', moa: '7+12', ai: 'Pydiflumetofen + Fludioxonil',     rate: 11.4, unit: 'oz', maxRate: 13.7, minRate: 9.2,  rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'high', WA: 'high', CA: 'medium' } },
    { name: 'CAPTAN 80 WDG',         epa: '66222-58',  type: 'Fungicide', moa: 'M04', ai: 'Captan',                            rate: 3.0,  unit: 'lb', maxRate: 4.0,  minRate: 2.5,  rei: 24, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'high', NY: 'high', PA: 'high' } },
    { name: 'RHYME',                 epa: '279-3588',   type: 'Fungicide', moa: '3',   ai: 'Flutriafol',                        rate: 7.0,  unit: 'oz', maxRate: 7.0,  minRate: 3.5,  rei: 12, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'medium', WA: 'medium' } },
    { name: 'LUNA TRANQUILITY',      epa: '264-1085',   type: 'Fungicide', moa: '7+9', ai: 'Fluopyram + Pyrimethanil',          rate: 6.84, unit: 'oz', maxRate: 6.84, minRate: 5.5,  rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'high', OR: 'high' } },
    { name: 'MANCOZEB 75DF',         epa: '62719-402',  type: 'Fungicide', moa: 'M03', ai: 'Mancozeb',                          rate: 2.0,  unit: 'lb', maxRate: 3.0,  minRate: 1.5,  rei: 24, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'high', OR: 'high' } },
    { name: 'FONTELIS SC',           epa: '352-834',   type: 'Fungicide', moa: '7',   ai: 'Penthiopyrad',                      rate: 16.0, unit: 'oz', maxRate: 24.0, minRate: 14.0, rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'high' } },
    { name: 'RALLY 40WSP',           epa: '62719-410',  type: 'Fungicide', moa: '3',   ai: 'Myclobutanil',                      rate: 5.0,  unit: 'oz', maxRate: 8.0,  minRate: 2.5,  rei: 24, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'high', CA: 'medium' } },
    { name: 'PRISTINE WG',           epa: '7969-199',   type: 'Fungicide', moa: '7+11',ai: 'Boscalid + Pyraclostrobin',         rate: 14.5, unit: 'oz', maxRate: 23.0, minRate: 10.5, rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'high', OR: 'high' } },
    { name: 'COPPER HYDROXIDE 77WP', epa: '55146-1',   type: 'Fungicide', moa: 'M01', ai: 'Copper Hydroxide',                  rate: 2.0,  unit: 'lb', maxRate: 4.0,  minRate: 1.0,  rei: 24, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: ['omri'], stateRelevance: { ME: 'high', CA: 'high', FL: 'high' } },
    { name: 'OMEGA 500F',            epa: '71512-1',    type: 'Fungicide', moa: '29',  ai: 'Fluazinam',                          rate: 8.0,  unit: 'oz', maxRate: 10.0, minRate: 5.5,  rei: 12, phi: 30,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'high' } },
    { name: 'SWITCH 62.5WG',         epa: '100-953',   type: 'Fungicide', moa: '9+12',ai: 'Cyprodinil + Fludioxonil',           rate: 11.0, unit: 'oz', maxRate: 14.0, minRate: 11.0, rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'high', NY: 'medium' } },
    { name: 'MERIVON',               epa: '7969-310',   type: 'Fungicide', moa: '7+11',ai: 'Fluxapyroxad + Pyraclostrobin',      rate: 5.5,  unit: 'oz', maxRate: 6.5,  minRate: 4.0,  rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'medium' } },
    { name: 'TILT 3.6EC',            epa: '100-617',    type: 'Fungicide', moa: '3',   ai: 'Propiconazole',                      rate: 4.0,  unit: 'oz', maxRate: 6.0,  minRate: 2.0,  rei: 24, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { AL: 'medium', TX: 'medium', OH: 'medium' } },
    { name: 'INDAR 2F',              epa: '62719-443',  type: 'Fungicide', moa: '3',   ai: 'Fenbuconazole',                      rate: 6.0,  unit: 'oz', maxRate: 8.0,  minRate: 4.0,  rei: 12, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'high', PA: 'high' } },
    { name: 'INSPIRE SUPER',         epa: '100-1271',   type: 'Fungicide', moa: '3+9', ai: 'Difenoconazole + Cyprodinil',        rate: 12.0, unit: 'oz', maxRate: 16.0, minRate: 8.0,  rei: 12, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'high', WA: 'high' } },
    { name: 'FLINT EXTRA',           epa: '264-1067',   type: 'Fungicide', moa: '11',  ai: 'Trifloxystrobin',                    rate: 3.0,  unit: 'oz', maxRate: 3.8,  minRate: 2.0,  rei: 12, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'high', NY: 'medium' } },
    { name: 'TOPSIN M 70WP',         epa: '73545-17',   type: 'Fungicide', moa: '1',   ai: 'Thiophanate-methyl',                 rate: 1.0,  unit: 'lb', maxRate: 1.5,  minRate: 0.5,  rei: 12, phi: 1,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'medium', NY: 'medium', PA: 'medium' } },
    { name: 'HEADLINE SC',           epa: '7969-187',   type: 'Fungicide', moa: '11',  ai: 'Pyraclostrobin',                     rate: 9.0,  unit: 'oz', maxRate: 12.0, minRate: 6.0,  rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { OH: 'high', IA: 'high', IL: 'high', IN: 'high' } },
    { name: 'TRIVAPRO',              epa: '100-1609',   type: 'Fungicide', moa: '3+7+11', ai: 'Propiconazole+Benzovindiflupyr+Azoxystrobin', rate: 13.7, unit: 'oz', maxRate: 13.7, minRate: 9.0, rei: 12, phi: 7, hazards: { beeTox: 'Low', aquaticTox: true }, labelUrl: '', tags: [], stateRelevance: { OH: 'high', IA: 'high', IL: 'high', GA: 'medium' } },
    { name: 'STRATEGO YLD',          epa: '264-1069',   type: 'Fungicide', moa: '3+11',ai: 'Prothioconazole + Trifloxystrobin',   rate: 4.0,  unit: 'oz', maxRate: 4.65, minRate: 2.0,  rei: 12, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { OH: 'high', GA: 'high', AL: 'medium' } },
    { name: 'PROSARO 421 SC',        epa: '264-862',    type: 'Fungicide', moa: '3+3', ai: 'Prothioconazole + Tebuconazole',      rate: 6.5,  unit: 'oz', maxRate: 8.2,  minRate: 6.5,  rei: 12, phi: 30,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { OH: 'high', IA: 'high', KS: 'high' } },
    { name: 'PROLINE 480 SC',        epa: '264-999',    type: 'Fungicide', moa: '3',   ai: 'Prothioconazole',                    rate: 5.7,  unit: 'oz', maxRate: 5.7,  minRate: 2.5,  rei: 12, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { GA: 'high', TX: 'high', AL: 'high' } },
    { name: 'VIVANDO',               epa: '7969-314',   type: 'Fungicide', moa: 'U13', ai: 'Metrafenone',                        rate: 15.4, unit: 'oz', maxRate: 15.4, minRate: 10.3, rei: 12, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { CA: 'high', WA: 'high', OR: 'high' } },
    { name: 'QUINTEC',               epa: '62719-544',  type: 'Fungicide', moa: '13',  ai: 'Quinoxyfen',                         rate: 6.0,  unit: 'oz', maxRate: 7.0,  minRate: 3.0,  rei: 12, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { CA: 'high', WA: 'high', OR: 'high' } },
    { name: 'TORINO',                epa: '71512-24',   type: 'Fungicide', moa: 'U13', ai: 'Cyflufenamid',                       rate: 3.4,  unit: 'oz', maxRate: 3.4,  minRate: 2.0,  rei: 4,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { CA: 'high', WA: 'high', NY: 'medium' } },
    { name: 'REVUS TOP',             epa: '100-1278',   type: 'Fungicide', moa: '40+3',ai: 'Mandipropamid + Difenoconazole',     rate: 7.0,  unit: 'oz', maxRate: 7.0,  minRate: 5.5,  rei: 12, phi: 1,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'high', FL: 'high' } },
    { name: 'PRESIDIO',              epa: '59639-152',  type: 'Fungicide', moa: '43',  ai: 'Fluopicolide',                       rate: 4.0,  unit: 'oz', maxRate: 4.0,  minRate: 3.0,  rei: 12, phi: 2,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', FL: 'high', NY: 'medium' } },
    { name: 'RANMAN 400SC',          epa: '71512-5',    type: 'Fungicide', moa: '21',  ai: 'Cyazofamid',                         rate: 2.75, unit: 'oz', maxRate: 2.75, minRate: 2.1,  rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'high', PA: 'high' } },
    { name: 'FORUM',                 epa: '7969-199',   type: 'Fungicide', moa: '40',  ai: 'Dimethomorph',                       rate: 6.0,  unit: 'oz', maxRate: 6.0,  minRate: 3.0,  rei: 12, phi: 4,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'medium', NY: 'medium', PA: 'medium' } },
    { name: 'SCALA SC',              epa: '264-829',    type: 'Fungicide', moa: '9',   ai: 'Pyrimethanil',                       rate: 18.0, unit: 'oz', maxRate: 18.0, minRate: 9.0,  rei: 12, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'medium', WA: 'medium' } },
    { name: 'CURZATE 60DF',          epa: '352-651',    type: 'Fungicide', moa: '27',  ai: 'Cymoxanil',                          rate: 3.2,  unit: 'oz', maxRate: 5.0,  minRate: 2.0,  rei: 12, phi: 3,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'medium', FL: 'medium' } },
    { name: 'ZIRAM 76DF',            epa: '70506-64',   type: 'Fungicide', moa: 'M03', ai: 'Ziram',                              rate: 4.0,  unit: 'lb', maxRate: 6.0,  minRate: 2.0,  rei: 48, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'medium', NY: 'medium', WA: 'medium' } },
    { name: 'QUADRIS TOP',           epa: '100-1314',   type: 'Fungicide', moa: '11+3',ai: 'Azoxystrobin + Difenoconazole',      rate: 14.0, unit: 'oz', maxRate: 14.0, minRate: 8.0,  rei: 12, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { GA: 'high', FL: 'high', TX: 'medium' } },
    { name: 'ABOUND 2.08SC',         epa: '100-1098',   type: 'Fungicide', moa: '11',  ai: 'Azoxystrobin',                       rate: 15.4, unit: 'oz', maxRate: 15.4, minRate: 6.0,  rei: 4,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { GA: 'high', AL: 'high', TX: 'high' } },
    { name: 'ELATUS ACE',            epa: '100-1624',   type: 'Fungicide', moa: '7+11',ai: 'Benzovindiflupyr + Azoxystrobin',    rate: 7.0,  unit: 'oz', maxRate: 9.5,  minRate: 4.0,  rei: 12, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { GA: 'high', OH: 'medium', IA: 'medium' } },

    { name: 'ROUNDUP POWERMAX 3',    epa: '524-549',    type: 'Herbicide', moa: '9',   ai: 'Glyphosate',                         rate: 32.0, unit: 'oz', maxRate: 44.0, minRate: 22.0, rei: 4,  phi: 14,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { AL: 'high', TX: 'high', GA: 'high' } },
    { name: 'LIBERTY 280SL',         epa: '264-829',    type: 'Herbicide', moa: '10',  ai: 'Glufosinate-ammonium',                rate: 32.0, unit: 'oz', maxRate: 43.0, minRate: 22.0, rei: 12, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { AL: 'high', GA: 'high', TX: 'high' } },
    { name: 'ATRAZINE 4L',           epa: '19713-11',  type: 'Herbicide', moa: '5',   ai: 'Atrazine',                           rate: 2.0,  unit: 'qt', maxRate: 2.5,  minRate: 1.0,  rei: 12, phi: 21,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { AL: 'high', TX: 'medium' } },
    { name: 'DICAMBA DGA 4SL',        epa: '7969-472',   type: 'Herbicide', moa: '4',   ai: 'Dicamba',                            rate: 12.8, unit: 'oz', maxRate: 16.0, minRate: 8.0,  rei: 24, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { AL: 'high', TX: 'high' } },
    { name: 'PROWL H2O',             epa: '241-418',    type: 'Herbicide', moa: '3',   ai: 'Pendimethalin',                      rate: 2.0,  unit: 'pts', maxRate: 4.2,  minRate: 1.5,  rei: 24, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { AL: 'high', TX: 'medium', GA: 'medium', ME: 'medium' } },
    { name: 'POAST',                  epa: '7969-58',   type: 'Herbicide', moa: '1',   ai: 'Sethoxydim',                         rate: 1.5,  unit: 'pts', maxRate: 2.5,  minRate: 0.75, rei: 12, phi: 15,  hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'medium', AL: 'medium' } },
    { name: 'GRAMOXONE SL 3.0',      epa: '100-1652',   type: 'Herbicide', moa: '22',  ai: 'Paraquat',                           rate: 2.0,  unit: 'pts', maxRate: 4.0,  minRate: 1.5,  rei: 12, phi: 3,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: ['rup'], stateRelevance: { AL: 'medium', GA: 'medium' } },
    { name: 'DUAL MAGNUM',           epa: '100-816',    type: 'Herbicide', moa: '15',  ai: 'S-Metolachlor',                      rate: 1.33, unit: 'pts', maxRate: 2.0,  minRate: 1.0,  rei: 24, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { AL: 'medium', TX: 'medium' } },
    { name: 'ENLIST ONE',            epa: '62719-695',  type: 'Herbicide', moa: '4',   ai: '2,4-D Choline',                      rate: 32.0, unit: 'oz', maxRate: 48.0, minRate: 24.0, rei: 48, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { AL: 'medium', GA: 'medium' } },
    { name: 'VALOR SX',              epa: '59639-119',  type: 'Herbicide', moa: '14',  ai: 'Flumioxazin',                        rate: 2.0,  unit: 'oz', maxRate: 3.0,  minRate: 1.0,  rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { GA: 'high', AL: 'high', TX: 'high' } },
    { name: 'FIERCE EZ',             epa: '59639-178',  type: 'Herbicide', moa: '14+15',ai: 'Flumioxazin + Pyroxasulfone',       rate: 6.0,  unit: 'oz', maxRate: 7.5,  minRate: 3.0,  rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { GA: 'high', OH: 'high', IA: 'high' } },
    { name: 'ZIDUA SC',              epa: '7969-372',   type: 'Herbicide', moa: '15',  ai: 'Pyroxasulfone',                      rate: 3.0,  unit: 'oz', maxRate: 4.25, minRate: 1.5,  rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { OH: 'high', IA: 'high', IL: 'high' } },
    { name: 'WARRANT',               epa: '524-591',    type: 'Herbicide', moa: '15',  ai: 'Acetochlor',                         rate: 3.0,  unit: 'pts', maxRate: 4.5,  minRate: 2.0,  rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { OH: 'high', IA: 'high', IL: 'high' } },
    { name: 'CHATEAU SW',            epa: '59639-120',  type: 'Herbicide', moa: '14',  ai: 'Flumioxazin',                        rate: 6.0,  unit: 'oz', maxRate: 12.0, minRate: 3.0,  rei: 12, phi: 60,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { CA: 'high', OR: 'high', WA: 'high' } },
    { name: 'GOALTENDER',            epa: '62719-447',  type: 'Herbicide', moa: '14',  ai: 'Oxyfluorfen',                        rate: 2.0,  unit: 'pts', maxRate: 4.0,  minRate: 1.0,  rei: 24, phi: 45,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { CA: 'high', OR: 'high', WA: 'high' } },
    { name: 'STINGER',               epa: '62719-73',   type: 'Herbicide', moa: '4',   ai: 'Clopyralid',                         rate: 4.0,  unit: 'oz', maxRate: 5.33, minRate: 2.66, rei: 12, phi: 30,  hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'medium', WA: 'medium' } },
    { name: 'REFLEX 2LC',            epa: '100-1073',   type: 'Herbicide', moa: '14',  ai: 'Fomesafen',                          rate: 1.0,  unit: 'pts', maxRate: 1.5,  minRate: 0.75, rei: 24, phi: 45,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { GA: 'high', AL: 'high', OH: 'medium' } },
    { name: 'FLEXSTAR GT',           epa: '100-1369',   type: 'Herbicide', moa: '14+9',ai: 'Fomesafen + Glyphosate',             rate: 3.5,  unit: 'pts', maxRate: 3.5,  minRate: 2.25, rei: 24, phi: 45,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { GA: 'high', AL: 'high', TX: 'high' } },
    { name: 'COBRA 2EC',             epa: '59639-37',   type: 'Herbicide', moa: '14',  ai: 'Lactofen',                           rate: 12.5, unit: 'oz', maxRate: 12.5, minRate: 6.0,  rei: 12, phi: 45,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { GA: 'medium', OH: 'medium', IA: 'medium' } },
    { name: 'REMEDY ULTRA',          epa: '62719-551',  type: 'Herbicide', moa: '4',   ai: 'Triclopyr',                          rate: 2.0,  unit: 'pts', maxRate: 4.0,  minRate: 1.0,  rei: 12, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { TX: 'high', AL: 'medium', GA: 'medium' } },
    { name: 'CROSSBOW',              epa: '62719-260',  type: 'Herbicide', moa: '4+4', ai: 'Triclopyr + 2,4-D',                  rate: 3.0,  unit: 'qt', maxRate: 6.0,  minRate: 1.5,  rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { TX: 'high', AL: 'high' } },
    { name: 'BASAGRAN',              epa: '7969-45',    type: 'Herbicide', moa: '6',   ai: 'Bentazon',                           rate: 1.5,  unit: 'pts', maxRate: 2.0,  minRate: 0.75, rei: 48, phi: 21,  hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { OH: 'high', ME: 'medium' } },
    { name: 'AUTHORITY ELITE',       epa: '279-9607',   type: 'Herbicide', moa: '14+15',ai: 'Sulfentrazone + S-Metolachlor',     rate: 25.0, unit: 'oz', maxRate: 32.0, minRate: 19.0, rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { GA: 'high', OH: 'high', AL: 'high' } },
    { name: 'PREFAR 4E',             epa: '45639-2',    type: 'Herbicide', moa: '8',   ai: 'Bensulide',                          rate: 5.0,  unit: 'qt', maxRate: 6.0,  minRate: 5.0,  rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { CA: 'high', FL: 'medium' } },
    { name: 'COMMAND 3ME',           epa: '279-3158',   type: 'Herbicide', moa: '13',  ai: 'Clomazone',                          rate: 2.0,  unit: 'pts', maxRate: 2.67, minRate: 1.33, rei: 12, phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { OH: 'medium', IA: 'medium' } },
    { name: 'SENCOR 75DF',           epa: '264-719',    type: 'Herbicide', moa: '5',   ai: 'Metribuzin',                         rate: 0.5,  unit: 'lb', maxRate: 1.0,  minRate: 0.33, rei: 12, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'medium', PA: 'medium' } },
    { name: 'LOROX 50DF',            epa: '352-516',    type: 'Herbicide', moa: '7',   ai: 'Linuron',                            rate: 1.5,  unit: 'lb', maxRate: 2.0,  minRate: 1.0,  rei: 24, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'medium', NY: 'medium' } },
    { name: 'CLARITY',               epa: '7969-137',   type: 'Herbicide', moa: '4',   ai: 'Dicamba DGA',                        rate: 8.0,  unit: 'oz', maxRate: 16.0, minRate: 4.0,  rei: 24, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { OH: 'high', IA: 'high', IL: 'high' } },
    { name: 'SELECT MAX',            epa: '59639-132',  type: 'Herbicide', moa: '1',   ai: 'Clethodim',                          rate: 12.0, unit: 'oz', maxRate: 16.0, minRate: 9.0,  rei: 24, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { GA: 'medium', OH: 'medium', ME: 'medium' } },

    { name: 'ASSAIL 30SG',           epa: '8033-36',    type: 'Insecticide', moa: '4A',  ai: 'Acetamiprid',                       rate: 5.3,  unit: 'oz', maxRate: 8.0,  minRate: 2.5,  rei: 12, phi: 7,   hazards: { beeTox: 'Medium', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'medium', PA: 'high' } },
    { name: 'MUSTANG MAXX',          epa: '279-3426',    type: 'Insecticide', moa: '3A',  ai: 'Zeta-Cypermethrin',                 rate: 4.0,  unit: 'oz', maxRate: 4.0,  minRate: 3.2,  rei: 12, phi: 1,   hazards: { beeTox: 'High', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { AL: 'high', TX: 'high', GA: 'high' } },
    { name: 'DELEGATE WG',           epa: '62719-541',  type: 'Insecticide', moa: '5',   ai: 'Spinetoram',                        rate: 6.0,  unit: 'oz', maxRate: 7.0,  minRate: 3.0,  rei: 4,  phi: 7,   hazards: { beeTox: 'Medium', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'high', NY: 'medium' } },
    { name: 'SEVIN XLR',             epa: '264-333',   type: 'Insecticide', moa: '1A',  ai: 'Carbaryl',                          rate: 4.0,  unit: 'oz', maxRate: 6.5,  minRate: 2.0,  rei: 12, phi: 3,   hazards: { beeTox: 'High', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'medium', AL: 'medium', NY: 'medium' } },
    { name: 'IMIDAN 70W',            epa: '10163-169',  type: 'Insecticide', moa: '1B',  ai: 'Phosmet',                           rate: 2.13, unit: 'lb', maxRate: 5.33, minRate: 1.0,  rei: 24, phi: 7,   hazards: { beeTox: 'High', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'high', NY: 'high' } },
    { name: 'ALTACOR WDG',           epa: '279-9607',   type: 'Insecticide', moa: '28',  ai: 'Chlorantraniliprole',                rate: 3.0,  unit: 'oz', maxRate: 4.5,  minRate: 2.0,  rei: 4,  phi: 5,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'high', CA: 'medium' } },
    { name: 'BIFENTHRIN 2EC',        epa: '2749-556',   type: 'Insecticide', moa: '3A',  ai: 'Bifenthrin',                        rate: 6.4,  unit: 'oz', maxRate: 12.8, minRate: 2.0,  rei: 12, phi: 3,   hazards: { beeTox: 'High', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { AL: 'medium', TX: 'medium', GA: 'medium' } },
    { name: 'WARRIOR II',            epa: '100-1295',   type: 'Insecticide', moa: '3A',  ai: 'Lambda-Cyhalothrin',                rate: 1.92, unit: 'oz', maxRate: 2.56, minRate: 1.28, rei: 24, phi: 7,   hazards: { beeTox: 'High', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { AL: 'high', TX: 'high' } },
    { name: 'LANNATE LV',            epa: '352-384',    type: 'Insecticide', moa: '1A',  ai: 'Methomyl',                          rate: 1.5,  unit: 'pts', maxRate: 3.0,  minRate: 0.75, rei: 48, phi: 3,   hazards: { beeTox: 'High', aquaticTox: true },  labelUrl: '', tags: ['rup'], stateRelevance: { ME: 'medium', NY: 'medium' } },
    { name: 'ADMIRE PRO',            epa: '264-827',    type: 'Insecticide', moa: '4A',  ai: 'Imidacloprid',                      rate: 7.0,  unit: 'oz', maxRate: 10.5, minRate: 4.4,  rei: 12, phi: 21,  hazards: { beeTox: 'High', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'medium', AL: 'medium' } },
    { name: 'CORAGEN',               epa: '352-729',    type: 'Insecticide', moa: '28',  ai: 'Chlorantraniliprole',                rate: 5.0,  unit: 'oz', maxRate: 7.5,  minRate: 3.5,  rei: 4,  phi: 1,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'medium', NY: 'medium' } },
    { name: 'EXIREL',                epa: '279-9615',    type: 'Insecticide', moa: '28',  ai: 'Cyantraniliprole',                   rate: 13.5, unit: 'oz', maxRate: 20.5, minRate: 10.0, rei: 12, phi: 3,   hazards: { beeTox: 'Medium', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', CA: 'medium' } },
    { name: 'MOVENTO',               epa: '264-1050',   type: 'Insecticide', moa: '23',  ai: 'Spirotetramat',                     rate: 8.0,  unit: 'oz', maxRate: 9.0,  minRate: 6.0,  rei: 24, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { CA: 'high', WA: 'high' } },
    { name: 'HARVANTA 50SL',         epa: '264-1170',   type: 'Insecticide', moa: '28',  ai: 'Cyclaniliprole',                    rate: 12.9, unit: 'oz', maxRate: 16.4, minRate: 10.9, rei: 12, phi: 1,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'high', NY: 'high' } },
    { name: 'BELEAF 50SG',           epa: '279-3364',   type: 'Insecticide', moa: '9C',  ai: 'Flonicamid',                        rate: 2.8,  unit: 'oz', maxRate: 2.8,  minRate: 1.4,  rei: 12, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'high', CA: 'high' } },
    { name: 'KNACK',                 epa: '264-655',    type: 'Insecticide', moa: '7C',  ai: 'Pyriproxyfen',                      rate: 10.0, unit: 'oz', maxRate: 10.0, minRate: 8.0,  rei: 12, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { CA: 'high', FL: 'high' } },
    { name: 'SIVANTO PRIME',         epa: '264-1141',   type: 'Insecticide', moa: '4D',  ai: 'Flupyradifurone',                   rate: 10.5, unit: 'oz', maxRate: 14.0, minRate: 7.0,  rei: 4,  phi: 7,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', CA: 'high', WA: 'high' } },
    { name: 'VERDEPRYN 100SL',       epa: '100-1668',   type: 'Insecticide', moa: '28',  ai: 'Cyclaniliprole',                    rate: 8.2,  unit: 'oz', maxRate: 11.0, minRate: 5.5,  rei: 12, phi: 1,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'high' } },
    { name: 'PREVATHON',             epa: '352-766',    type: 'Insecticide', moa: '28',  ai: 'Chlorantraniliprole',                rate: 20.0, unit: 'oz', maxRate: 20.0, minRate: 14.0, rei: 4,  phi: 1,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { GA: 'high', AL: 'high', TX: 'high' } },
    { name: 'INTREPID EDGE',         epa: '62719-685',  type: 'Insecticide', moa: '18+28',ai: 'Methoxyfenozide + Spinetoram',     rate: 6.0,  unit: 'oz', maxRate: 8.0,  minRate: 4.0,  rei: 4,  phi: 7,   hazards: { beeTox: 'Medium', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'medium' } },
    { name: 'VANTACOR',              epa: '352-858',    type: 'Insecticide', moa: '28',  ai: 'Chlorantraniliprole',                rate: 1.7,  unit: 'oz', maxRate: 2.5,  minRate: 0.9,  rei: 4,  phi: 1,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { GA: 'high', OH: 'high', IA: 'high' } },
    { name: 'DIMILIN 2L',            epa: '400-468',    type: 'Insecticide', moa: '15',  ai: 'Diflubenzuron',                     rate: 4.0,  unit: 'oz', maxRate: 8.0,  minRate: 2.0,  rei: 12, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'medium', NY: 'medium' } },
    { name: 'AVAUNT',                epa: '352-674',    type: 'Insecticide', moa: '22A', ai: 'Indoxacarb',                        rate: 5.0,  unit: 'oz', maxRate: 6.0,  minRate: 3.5,  rei: 12, phi: 14,  hazards: { beeTox: 'Medium', aquaticTox: true }, labelUrl: '', tags: [], stateRelevance: { ME: 'medium', CA: 'medium', WA: 'medium' } },
    { name: 'LEVERAGE 360',          epa: '264-836',    type: 'Insecticide', moa: '4A+3A',ai: 'Imidacloprid + Beta-Cyfluthrin',   rate: 3.0,  unit: 'oz', maxRate: 3.84, minRate: 2.4,  rei: 12, phi: 7,   hazards: { beeTox: 'High', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'medium', NY: 'medium' } },
    { name: 'RADIANT SC',            epa: '62719-543',  type: 'Insecticide', moa: '5',   ai: 'Spinetoram',                        rate: 6.0,  unit: 'oz', maxRate: 8.0,  minRate: 5.0,  rei: 4,  phi: 1,   hazards: { beeTox: 'Medium', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { CA: 'high', FL: 'high', GA: 'high' } },
    { name: 'MINECTO PRO',           epa: '100-1657',   type: 'Insecticide', moa: '28+6',ai: 'Cyantraniliprole + Abamectin',      rate: 10.0, unit: 'oz', maxRate: 12.0, minRate: 7.0,  rei: 12, phi: 3,   hazards: { beeTox: 'Medium', aquaticTox: true }, labelUrl: '', tags: [], stateRelevance: { CA: 'high', FL: 'high' } },
    { name: 'AGRI-MEK SC',           epa: '100-903',    type: 'Insecticide', moa: '6',   ai: 'Abamectin',                         rate: 3.5,  unit: 'oz', maxRate: 3.5,  minRate: 1.75, rei: 12, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { CA: 'high', WA: 'high', FL: 'high' } },
    { name: 'ESTEEM 35WP',           epa: '59639-128',  type: 'Insecticide', moa: '7B',  ai: 'Pyriproxyfen',                      rate: 5.0,  unit: 'oz', maxRate: 5.0,  minRate: 4.0,  rei: 12, phi: 45,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { CA: 'high', WA: 'high' } },
    { name: 'VOLIAM FLEXI',          epa: '100-1320',   type: 'Insecticide', moa: '28+4A',ai: 'Chlorantraniliprole + Thiamethoxam',rate: 7.0,  unit: 'oz', maxRate: 7.0,  minRate: 4.0,  rei: 12, phi: 14,  hazards: { beeTox: 'High', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { GA: 'high', AL: 'medium', OH: 'medium' } },
    { name: 'HERO EC',               epa: '279-3387',   type: 'Insecticide', moa: '3A',  ai: 'Zeta-Cypermethrin + Bifenthrin',    rate: 6.1,  unit: 'oz', maxRate: 10.3, minRate: 4.0,  rei: 12, phi: 21,  hazards: { beeTox: 'High', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { GA: 'high', TX: 'high', AL: 'high' } },
    { name: 'SENSTAR',               epa: '59639-214',  type: 'Insecticide', moa: '28+15',ai: 'Cyclaniliprole + Diflubenzuron',   rate: 10.0, unit: 'oz', maxRate: 14.0, minRate: 8.0,  rei: 12, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'high' } },
    { name: 'FULFILL 50WDG',         epa: '100-1301',   type: 'Insecticide', moa: '9B',  ai: 'Pymetrozine',                       rate: 2.75, unit: 'oz', maxRate: 5.5,  minRate: 2.75, rei: 12, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', CA: 'high' } },
    { name: 'PYGANIC 5.0',           epa: '1021-1772',  type: 'Insecticide', moa: '3A',  ai: 'Pyrethrins',                        rate: 18.0, unit: 'oz', maxRate: 18.0, minRate: 9.0,  rei: 12, phi: 0,   hazards: { beeTox: 'High', aquaticTox: true },  labelUrl: '', tags: ['omri', 'organic'], stateRelevance: { ME: 'high', CA: 'high', OR: 'high', VT: 'high' } },
    { name: 'ENTRUST SC',            epa: '62719-621',  type: 'Insecticide', moa: '5',   ai: 'Spinosad',                          rate: 6.0,  unit: 'oz', maxRate: 10.0, minRate: 4.0,  rei: 4,  phi: 7,   hazards: { beeTox: 'High', aquaticTox: false }, labelUrl: '', tags: ['omri', 'organic'], stateRelevance: { ME: 'high', CA: 'high', OR: 'high', WA: 'high' } },
    { name: 'SURROUND WP (KAOLIN)',  epa: '61842-18',   type: 'Insecticide', moa: 'UN',  ai: 'Kaolin Clay',                       rate: 25.0, unit: 'lb', maxRate: 50.0, minRate: 12.5, rei: 4,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: ['omri', 'organic'], stateRelevance: { ME: 'high', CA: 'high', OR: 'high' } },
    { name: 'REGALIA SC',            epa: '84059-3',   type: 'Fungicide',   moa: 'P05', ai: 'Reynoutria sachalinensis',           rate: 2.0,  unit: 'qt', maxRate: 4.0,  minRate: 1.0,  rei: 4,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: ['omri', 'organic'], stateRelevance: { ME: 'medium', CA: 'high', OR: 'high' } },
    { name: 'NEEM OIL 70%',          epa: '70051-2',    type: 'Fungicide',   moa: 'UN',  ai: 'Clarified Neem Oil',                 rate: 1.0,  unit: 'gal', maxRate: 2.0, minRate: 0.5,  rei: 4,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: ['omri', 'organic'], stateRelevance: { ME: 'medium', CA: 'high' } },
    { name: 'DIPEL DF',              epa: '73049-39',   type: 'Insecticide', moa: '11A', ai: 'Bacillus thuringiensis (Bt)',        rate: 1.0,  unit: 'lb', maxRate: 2.0,  minRate: 0.5,  rei: 4,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: ['omri', 'organic'], stateRelevance: { ME: 'high', CA: 'high', OR: 'high' } },
    { name: 'OXIDATE 2.0',           epa: '70299-12',   type: 'Fungicide',   moa: 'NC',  ai: 'Hydrogen Peroxide + Peroxyacetic',   rate: 64.0, unit: 'oz', maxRate: 128.0,minRate: 32.0, rei: 0,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: ['omri', 'organic'], stateRelevance: { ME: 'medium', CA: 'medium' } },
    { name: 'SERENADE ASO',          epa: '264-1152',   type: 'Fungicide',   moa: '44',  ai: 'Bacillus subtilis QST 713',          rate: 6.0,  unit: 'qt', maxRate: 8.0,  minRate: 2.0,  rei: 4,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: ['omri', 'organic'], stateRelevance: { ME: 'medium', CA: 'high', OR: 'high' } },

    { name: 'INDUCE NIS',            epa: 'EXEMPT',     type: 'Adjuvant',    moa: '--',  ai: 'Non-ionic Surfactant',                rate: 8.0,  unit: 'oz', maxRate: 16.0, minRate: 4.0,  rei: 0,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: {} },
    { name: 'CROP OIL CONCENTRATE',  epa: 'EXEMPT',     type: 'Adjuvant',    moa: '--',  ai: 'Petroleum Oil',                      rate: 1.0,  unit: 'qt', maxRate: 2.0,  minRate: 0.5,  rei: 0,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: {} },
    { name: 'DRIFT GUARD (POLYMER)', epa: 'EXEMPT',     type: 'Adjuvant',    moa: '--',  ai: 'Polyacrylamide',                     rate: 4.0,  unit: 'oz', maxRate: 8.0,  minRate: 2.0,  rei: 0,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: {} },
    { name: 'ACTIVATOR 90',          epa: 'EXEMPT',     type: 'Adjuvant',    moa: '--',  ai: 'Alkylphenol Ethoxylate',             rate: 16.0, unit: 'oz', maxRate: 32.0, minRate: 8.0,  rei: 0,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: {} },
    { name: 'MSO (METHYLATED SOY)',  epa: 'EXEMPT',     type: 'Adjuvant',    moa: '--',  ai: 'Methylated Soybean Oil',             rate: 1.0,  unit: 'qt', maxRate: 2.0,  minRate: 0.5,  rei: 0,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: {} },
    { name: 'AMS (AMMONIUM SULFATE)',epa: 'EXEMPT',     type: 'Adjuvant',    moa: '--',  ai: 'Ammonium Sulfate',                   rate: 17.0, unit: 'lb', maxRate: 17.0, minRate: 8.5,  rei: 0,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: {} },
    { name: 'LI 700',                epa: 'EXEMPT',     type: 'Adjuvant',    moa: '--',  ai: 'Lecithin + Propionic Acid',          rate: 16.0, unit: 'oz', maxRate: 32.0, minRate: 8.0,  rei: 0,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: {} },
    { name: 'LIBERATE',              epa: 'EXEMPT',     type: 'Adjuvant',    moa: '--',  ai: 'Lecithin + Methyl Esters',           rate: 16.0, unit: 'oz', maxRate: 32.0, minRate: 6.0,  rei: 0,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: {} },

    // Additional Organics & Biologicals
    { name: 'DOUBLE NICKEL LC',      epa: '70051-108',  type: 'Fungicide',   moa: '44',  ai: 'Bacillus amyloliquefaciens D747',    rate: 1.0,  unit: 'qt', maxRate: 2.0,  minRate: 0.5,  rei: 4,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: ['omri', 'organic'], stateRelevance: { ME: 'medium', CA: 'high', OR: 'high' } },
    { name: 'GRANDEVO CG',          epa: '84059-17',   type: 'Insecticide', moa: 'UN',  ai: 'Chromobacterium subtsugae',          rate: 2.0,  unit: 'lb', maxRate: 3.0,  minRate: 1.0,  rei: 4,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: ['omri', 'organic'], stateRelevance: { CA: 'high', OR: 'high', ME: 'medium' } },
    { name: 'VENERATE XC',           epa: '84059-15',   type: 'Insecticide', moa: 'UN',  ai: 'Burkholderia rinojensis',            rate: 2.0,  unit: 'qt', maxRate: 4.0,  minRate: 1.0,  rei: 4,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: ['omri', 'organic'], stateRelevance: { CA: 'high', OR: 'high', WA: 'high' } },
    { name: 'TRILOGY',               epa: '70051-2',    type: 'Fungicide',   moa: 'UN',  ai: 'Neem Oil Extract',                   rate: 1.0,  unit: '%', maxRate: 2.0,  minRate: 0.5,  rei: 4,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: ['omri', 'organic'], stateRelevance: { CA: 'high', ME: 'medium' } },

    // Additional Specialty Insecticides & Miticides
    { name: 'MITE-E-OIL',           epa: '5905-277',   type: 'Insecticide', moa: 'UN',  ai: 'Mineral Oil',                        rate: 2.0,  unit: 'gal', maxRate: 4.0, minRate: 1.0,  rei: 4,  phi: 0,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'high', CA: 'high' } },
    { name: 'INTREPID 2F',           epa: '62719-442',  type: 'Insecticide', moa: '18',  ai: 'Methoxyfenozide',                   rate: 10.0, unit: 'oz', maxRate: 16.0, minRate: 4.0,  rei: 4,  phi: 14,  hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', NY: 'high', WA: 'high' } },
    { name: 'TORAC',                 epa: '7969-358',   type: 'Insecticide', moa: '21A', ai: 'Tolfenpyrad',                       rate: 21.0, unit: 'oz', maxRate: 21.0, minRate: 14.0, rei: 12, phi: 1,   hazards: { beeTox: 'High', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'medium', NY: 'medium' } },
    { name: 'RIMON 0.83EC',          epa: '66222-60',   type: 'Insecticide', moa: '15',  ai: 'Novaluron',                         rate: 12.0, unit: 'oz', maxRate: 12.0, minRate: 6.0,  rei: 12, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { ME: 'medium', CA: 'medium' } },
    { name: 'BELT SC',               epa: '264-1025',   type: 'Insecticide', moa: '28',  ai: 'Flubendiamide',                     rate: 3.0,  unit: 'oz', maxRate: 3.0,  minRate: 2.0,  rei: 12, phi: 1,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { GA: 'high', TX: 'high', AL: 'high' } },
    { name: 'TOMBSTONE HELIOS',      epa: '279-3457',   type: 'Insecticide', moa: '3A',  ai: 'Cyfluthrin',                        rate: 2.8,  unit: 'oz', maxRate: 2.8,  minRate: 1.6,  rei: 12, phi: 0,   hazards: { beeTox: 'High', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { OH: 'high', IA: 'high', IL: 'high' } },
    { name: 'FASTAC EC',             epa: '7969-275',   type: 'Insecticide', moa: '3A',  ai: 'Alpha-Cypermethrin',                rate: 3.8,  unit: 'oz', maxRate: 3.8,  minRate: 1.8,  rei: 12, phi: 3,   hazards: { beeTox: 'High', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { OH: 'high', GA: 'high', TX: 'high' } },
    { name: 'ACRAMITE 50WS',         epa: '400-516',    type: 'Insecticide', moa: 'UN',  ai: 'Bifenazate',                        rate: 0.75, unit: 'lb', maxRate: 1.0,  minRate: 0.5,  rei: 12, phi: 7,   hazards: { beeTox: 'Low', aquaticTox: false }, labelUrl: '', tags: [], stateRelevance: { ME: 'high', WA: 'high', CA: 'high' } },
    { name: 'VENDEX 50WP',           epa: '400-168',    type: 'Insecticide', moa: '12B', ai: 'Fenbutatin-oxide',                  rate: 1.5,  unit: 'lb', maxRate: 2.0,  minRate: 1.0,  rei: 48, phi: 14,  hazards: { beeTox: 'Low', aquaticTox: true },  labelUrl: '', tags: [], stateRelevance: { WA: 'high', CA: 'medium' } },
];

// STATE-SPECIFIC CHEMICAL PRIORITIES
export const STATE_CHEMICAL_PRIORITY = {
    'ME': 'Fungicide',   // Maine: apple scab, late blight pressure
    'NY': 'Fungicide',   // New York: same disease pressure
    'WA': 'Fungicide',   // Washington: fruit rot, mildew
    'OR': 'Fungicide',   // Oregon: mildew, botrytis
    'CA': 'Insecticide', // California: pest pressure year-round
    'AL': 'Herbicide',   // Alabama: weed pressure in row crops
    'TX': 'Herbicide',   // Texas: row crop herbicide demand
    'GA': 'Herbicide',   // Georgia: cotton/soybean herbicide focus
    'FL': 'Insecticide', // Florida: tropical pest pressure
    'OH': 'Herbicide',   // Ohio: corn/soy weed management
    'PA': 'Fungicide',   // Pennsylvania: orchard/vegetable fungicide
    'VT': 'Fungicide',   // Vermont: organic specialty crops
};

// COMPLIANCE FIELD TEMPLATES (Plain Language)
export const COMPLIANCE_FIELDS = [
    {
        section: 'Personnel', fields: [
            { key: 'Applicator Name', id: 'input-applicator-name', type: 'text', placeholder: 'Your Name' },
            {
                key: 'Wind Direction', id: 'input-wind-direction', type: 'buttons', placeholder: 'Wind Direction',
                options: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
            }
        ]
    },
    {
        section: 'Logistics', fields: [
            { key: 'Start Time', id: 'input-start-time', type: 'time', placeholder: 'When did you start?' },
            { key: 'Stop Time', id: 'input-stop-time', type: 'time', placeholder: 'When did you finish?' },
            { key: 'Site Description', id: 'input-site-description', type: 'text', placeholder: 'Where are you spraying?' }
        ]
    },
    {
        section: 'Chemical / Safety', fields: [
            { key: 'Active Ingredients', id: 'input-active-ingredients', type: 'text', placeholder: 'Active Ingredients' },
            { key: 'Diluent', id: 'input-diluent', type: 'text', placeholder: 'Water in Tank (gal)' },
            {
                key: 'REI', id: 'input-rei', type: 'buttons', placeholder: 'Reentry Wait',
                options: ['4h', '12h', '24h', '48h']
            },
            {
                key: 'PHI', id: 'input-phi', type: 'buttons', placeholder: 'Harvest Wait',
                options: ['0d', '1d', '3d', '7d', '14d', '21d']
            }
        ]
    },
    {
        section: 'Environmental', fields: [
            {
                key: 'Sky Conditions', id: 'input-sky-conditions', type: 'buttons', placeholder: 'Sky',
                options: ['Clear', 'Partly Cloudy', 'Overcast', 'Rain']
            },
            {
                key: 'Soil Moisture', id: 'input-soil-moisture', type: 'buttons', placeholder: 'Ground',
                options: ['Dry', 'Moist', 'Wet', 'Saturated']
            }
        ]
    },
    {
        section: 'Equipment', fields: [
            {
                key: 'Nozzle Type', id: 'input-nozzle-type', type: 'buttons', placeholder: 'Nozzle Tip',
                options: ['XR', 'TT', 'TTI', 'AI', 'AIXR']
            },
            {
                key: 'Sprayer Pressure', id: 'input-sprayer-pressure', type: 'buttons', placeholder: 'PSI',
                options: ['20', '30', '40', '60', '80']
            },
            {
                key: 'Boom Height', id: 'input-boom-height', type: 'buttons', placeholder: 'Boom Height',
                options: ['12"', '18"', '24"', '30"', '36"']
            },
            {
                key: 'Ground Speed', id: 'input-ground-speed', type: 'buttons', placeholder: 'Speed (mph)',
                options: ['3', '5', '7', '10', '12']
            }
        ]
    }
];

// ═══════════════════════════════════════
// CROP DATABASE — Two-Tier + Vegetable Deep Dive + EPA Crop Groups
// EPA Crop Groups per 40 CFR 180 / VT Act 182 neonicotinoid blocks:
//   BLANKET_BLOCK (bloom): Groups 15 (Cereal Grain), 16 (Forage/Fodder/Straw)
//   BLOOM_HARVEST_BLOCK:   Groups 3,4,5,19,22,25,26 (Leafy/Brassica Veg)
// ═══════════════════════════════════════
export const CROP_DATABASE = {
    'Row Crops': [
        { name: 'Corn', icon: '🌽', cropGroup: 15 },
        { name: 'Soybeans', icon: '🫘', cropGroup: 15 },
        { name: 'Cotton', icon: '🏵️', cropGroup: null },
        { name: 'Peanuts', icon: '🥜', cropGroup: null },
        { name: 'Wheat', icon: '🌾', cropGroup: 15 },
        { name: 'Sorghum', icon: '🌿', cropGroup: 15 },
        { name: 'Barley', icon: '🌾', cropGroup: 15 },
        { name: 'Oats', icon: '🌾', cropGroup: 15 },
    ],
    'Specialty & Horticulture': [
        { name: 'Blueberries', icon: '🫐', cropGroup: null },
        { name: 'Wild Blueberry', icon: '🫐', cropGroup: null, tags: ['lowbush', 'V. angustifolium'] },
        { name: 'Strawberries', icon: '🍓', cropGroup: null },
        { name: 'Cranberries', icon: '🔴', cropGroup: null },
        { name: 'Raspberries', icon: '🍇', cropGroup: null },
        { name: 'Orchard Fruit', icon: '🍎', cropGroup: 11 },
        { name: 'Potatoes', icon: '🥔', cropGroup: 1 },
        { name: 'Greenhouse', icon: '🌱', cropGroup: null },
        { name: 'Grapes / Vineyard', icon: '🍇', cropGroup: null },
    ],
    'Vegetables': {
        // Flat list for backward compatibility / search
        crops: [
            { name: 'Tomatoes', icon: '🍅', cropGroup: 8 },
            { name: 'Peppers', icon: '🌶️', cropGroup: 8 },
            { name: 'Eggplant', icon: '🍆', cropGroup: 8 },
            { name: 'Squash / Zucchini', icon: '🎃', cropGroup: 9 },
            { name: 'Cucumbers', icon: '🥒', cropGroup: 9 },
            { name: 'Melons', icon: '🍈', cropGroup: 9 },
            { name: 'Pumpkins', icon: '🎃', cropGroup: 9 },
            { name: 'Broccoli / Cauliflower', icon: '🥦', cropGroup: 5 },
            { name: 'Cabbage', icon: '🥬', cropGroup: 5 },
            { name: 'Kale / Collards', icon: '🥬', cropGroup: 4 },
            { name: 'Brussels Sprouts', icon: '🥬', cropGroup: 5 },
            { name: 'Onions', icon: '🧅', cropGroup: 3 },
            { name: 'Garlic', icon: '🧄', cropGroup: 3 },
            { name: 'Leeks', icon: '🧅', cropGroup: 3 },
            { name: 'Shallots', icon: '🧅', cropGroup: 3 },
            { name: 'Lettuce', icon: '🥬', cropGroup: 4 },
            { name: 'Spinach', icon: '🥬', cropGroup: 4 },
            { name: 'Swiss Chard', icon: '🥬', cropGroup: 4 },
            { name: 'Arugula', icon: '🌿', cropGroup: 4 },
            { name: 'Carrots', icon: '🥕', cropGroup: 1 },
            { name: 'Beets', icon: '🟣', cropGroup: 1 },
            { name: 'Turnips / Radishes', icon: '🟤', cropGroup: 1 },
            { name: 'Sweet Potatoes', icon: '🍠', cropGroup: 1 },
            { name: 'Parsnips', icon: '🥕', cropGroup: 1 },
            { name: 'Snap Beans', icon: '🫘', cropGroup: 6 },
            { name: 'Lima Beans', icon: '🫘', cropGroup: 6 },
            { name: 'Peas', icon: '🟢', cropGroup: 6 },
            { name: 'Edamame', icon: '🫛', cropGroup: 6 },
        ],
        // Deep hierarchy for gateway drill-down
        subcategories: {
            'Solanaceae': [
                { name: 'Tomatoes', icon: '🍅', cropGroup: 8 },
                { name: 'Peppers', icon: '🌶️', cropGroup: 8 },
                { name: 'Eggplant', icon: '🍆', cropGroup: 8 },
            ],
            'Cucurbits': [
                { name: 'Squash / Zucchini', icon: '🎃', cropGroup: 9 },
                { name: 'Cucumbers', icon: '🥒', cropGroup: 9 },
                { name: 'Melons', icon: '🍈', cropGroup: 9 },
                { name: 'Pumpkins', icon: '🎃', cropGroup: 9 },
            ],
            'Brassicas': [
                { name: 'Broccoli / Cauliflower', icon: '🥦', cropGroup: 5 },
                { name: 'Cabbage', icon: '🥬', cropGroup: 5 },
                { name: 'Kale / Collards', icon: '🥬', cropGroup: 4 },
                { name: 'Brussels Sprouts', icon: '🥬', cropGroup: 5 },
            ],
            'Alliums': [
                { name: 'Onions', icon: '🧅', cropGroup: 3 },
                { name: 'Garlic', icon: '🧄', cropGroup: 3 },
                { name: 'Leeks', icon: '🧅', cropGroup: 3 },
                { name: 'Shallots', icon: '🧅', cropGroup: 3 },
            ],
            'Leafy Greens': [
                { name: 'Lettuce', icon: '🥬', cropGroup: 4 },
                { name: 'Spinach', icon: '🥬', cropGroup: 4 },
                { name: 'Swiss Chard', icon: '🥬', cropGroup: 4 },
                { name: 'Arugula', icon: '🌿', cropGroup: 4 },
            ],
            'Root Crops': [
                { name: 'Carrots', icon: '🥕', cropGroup: 1 },
                { name: 'Beets', icon: '🟣', cropGroup: 1 },
                { name: 'Turnips / Radishes', icon: '🟤', cropGroup: 1 },
                { name: 'Sweet Potatoes', icon: '🍠', cropGroup: 1 },
                { name: 'Parsnips', icon: '🥕', cropGroup: 1 },
            ],
            'Legumes': [
                { name: 'Snap Beans', icon: '🫘', cropGroup: 6 },
                { name: 'Lima Beans', icon: '🫘', cropGroup: 6 },
                { name: 'Peas', icon: '🟢', cropGroup: 6 },
                { name: 'Edamame', icon: '🫛', cropGroup: 6 },
            ],
        }
    },
    'Forage & Turf': [
        { name: 'Pasture', icon: '🌻', cropGroup: 16 },
        { name: 'Hay', icon: '🌾', cropGroup: 16 },
        { name: 'Rangeland', icon: '🏔️', cropGroup: 16 },
        { name: 'Turfgrass', icon: '⛳', cropGroup: null },
    ],
};

// ═══════════════════════════════════════
// DEFAULT CROP CATEGORY BY STATE
// ═══════════════════════════════════════
export const STATE_CROP_DEFAULT = {
    'ME': 'Specialty & Horticulture',
    'NY': 'Specialty & Horticulture',
    'WA': 'Specialty & Horticulture',
    'OR': 'Specialty & Horticulture',
    'CA': 'Specialty & Horticulture',
    'VT': 'Specialty & Horticulture',
    'FL': 'Specialty & Horticulture',
    'PA': 'Vegetables',
    'NJ': 'Vegetables',
    'AL': 'Row Crops',
    'TX': 'Row Crops',
    'GA': 'Row Crops',
    'OH': 'Row Crops',
    'IA': 'Row Crops',
    'IL': 'Row Crops',
    'IN': 'Row Crops',
    'KS': 'Row Crops',
    'NE': 'Row Crops',
    'DEFAULT': 'Row Crops',
};

