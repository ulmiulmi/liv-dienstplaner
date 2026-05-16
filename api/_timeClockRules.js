// ULMIPOINT Zeiterfassung / Monatsabschluss
// Standard-Regelwerk: Kanton Basel-Stadt
//
// Quelle Feiertagsprofil:
// Bundesamt für Justiz BJ, "Gesetzliche Feiertage und Tage, die in der Schweiz wie gesetzliche Feiertage behandelt werden"
// Kanton Basel-Stadt: Neujahr, Karfreitag, Ostermontag, Tag der Arbeit, Auffahrt,
// Pfingstmontag, Weihnachtstag, Stephanstag.
// Bundesrechtlich: Bundesfeiertag, 1. August.
//
// Wichtig:
// Diese Datei setzt die kantonale Feiertagsbasis.
// Zulagenbeträge / interne Personalregeln bleiben bewusst als editierbare Betriebsregeln vorgesehen.

function pad2(n){ return String(n).padStart(2,'0'); }
function isoDate(y,m,d){ return y + '-' + pad2(m) + '-' + pad2(d); }

function easterSunday(year){
  // Gregorian Easter algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days){
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function dateToIso(date){
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function baselStadtHolidays(year){
  const easter = easterSunday(year);
  const list = [
    {date: isoDate(year,1,1), code:'NEUJAHR', name:'Neujahrstag', type:'cantonal_legal'},
    {date: dateToIso(addDays(easter,-2)), code:'KARFREITAG', name:'Karfreitag', type:'cantonal_legal'},
    {date: dateToIso(addDays(easter,1)), code:'OSTERMONTAG', name:'Ostermontag', type:'cantonal_legal'},
    {date: isoDate(year,5,1), code:'TAG_DER_ARBEIT', name:'Tag der Arbeit', type:'cantonal_legal'},
    {date: dateToIso(addDays(easter,39)), code:'AUFFAHRT', name:'Auffahrt', type:'cantonal_legal'},
    {date: dateToIso(addDays(easter,50)), code:'PFINGSTMONTAG', name:'Pfingstmontag', type:'cantonal_legal'},
    {date: isoDate(year,8,1), code:'BUNDESFEIERTAG', name:'Bundesfeiertag', type:'federal_legal'},
    {date: isoDate(year,12,25), code:'WEIHNACHTEN', name:'Weihnachtstag', type:'cantonal_legal'},
    {date: isoDate(year,12,26), code:'STEPHANSTAG', name:'Stephanstag', type:'cantonal_legal'}
  ];
  return list.sort((a,b)=>a.date.localeCompare(b.date));
}

function isBaselStadtHoliday(dateIso){
  const y = Number(String(dateIso||'').slice(0,4));
  if(!y) return null;
  return baselStadtHolidays(y).find(h => h.date === String(dateIso).slice(0,10)) || null;
}

function isSunday(dateIso){
  const d = new Date(String(dateIso).slice(0,10) + 'T12:00:00Z');
  return d.getUTCDay() === 0;
}

const BASEL_STADT_DEFAULT_RULESET = {
  id: 'CH_BS_PERSONALRECHT_DEFAULT',
  canton: 'BS',
  cantonName: 'Basel-Stadt',
  holidayProfile: 'CH-BS',
  holidaySource: 'Bundesamt für Justiz BJ / Kanton Basel-Stadt Feiertagsprofil',
  personalLawSource: 'Kanton Basel-Stadt Personalrecht / Personalgesetz / Personalverordnung',
  sundayAndHolidayEquivalent: true,

  // Statuscodes aus dem Dienstplan.
  statusCodes: {
    sick: ['KR'],
    vacation: ['FER'],
    school: ['SCH','SCHF'],
    training: ['WB','WB%'],
    compensation: ['KGL','KF'],
    free: ['FR']
  },

  // Monatsabschluss-Kontrolle.
  controlRules: {
    plannedDutyRequiresClockIn: true,
    plannedDutyRequiresClockOut: true,
    absenceNormallyRequiresNoStamp: true,
    warnIfStampedOnSickVacationSchool: true,
    warnIfClockOutBeforeClockIn: true,
    warnIfMissingBreak: true
  },

  // Zulagenlogik: Die kantonalen Feiertage sind gesetzt.
  // Beträge/Prozente werden später als Betriebsregel gepflegt.
  allowanceBasis: {
    holidayHoursUseBaselStadtCalendar: true,
    sundayHoursUseCalendarSunday: true,
    sundayAndHolidayDoNotDoubleCount: true,
    nightWindowEditable: true,
    pikettEditable: true,
    ratesEditable: true
  },

  defaultsForMonthlyClose: {
    canton: 'BS',
    holidayProfile: 'CH-BS',
    useServerTimeForStamps: true,
    exportFormat: ['csv','xlsx_later'],
    apiStatusDefault: 'open'
  }
};

module.exports = {
  BASEL_STADT_DEFAULT_RULESET,
  baselStadtHolidays,
  isBaselStadtHoliday,
  isSunday
};
