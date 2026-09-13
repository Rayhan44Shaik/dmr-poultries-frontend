// Shared by the Duty Planner UI and Excel writer. Backend values and employee
// names stay unchanged; only the display copy follows the app language switch.
export type DutyLanguage = 'en' | 'te';

export const dutyEnglish = {
  planner: 'Duty Planner', details: 'Daily Details', filters: 'Duty Planner filters',
  dutyAssign: 'Duty Assign',
  actions: 'Duty Planner actions', weekTable: 'Duty Planner week table', dateTable: 'Duty Planner date matrix',
  employee: 'Employee', employeeNo: 'Employee No.', role: 'Role', roles: 'Roles', department: 'Department',
  filterRoles: 'Filter employee roles', includeRoles: 'Include roles', allRoles: 'All roles',
  allRolesIncluded: 'All roles included', selectedRoles: 'Selected role filters', selectedCount: '{count} selected',
  removeRole: 'Remove {role} role filter', period: 'Period', week: 'Weekly', month: 'Monthly', custom: 'Custom range',
  displayedPeriod: 'Displayed period', customDates: 'Custom date range', fromDate: 'From date', toDate: 'To date',
  dateRange: 'Date range', previousWeek: 'Previous week', nextWeek: 'Next week', currentWeek: 'Current week',
  previousMonth: 'Previous month', nextMonth: 'Next month', currentMonth: 'Current month',
  search: 'Search employees', searchPlaceholder: 'Search employee name...', reset: 'Reset',
  download: 'Download Excel', excel: 'Excel', preparing: 'Preparing Excel…', downloadScope: 'Download the displayed table: {from} – {to}, {count} employees.',
  downloadSuccess: 'Duty Planner Excel downloaded successfully.', downloadFailed: 'Could not export Duty Planner to Excel. Please retry.',
  saveWait: 'Wait for duty changes to finish saving.', loading: 'Loading table data…',
  noEmployees: 'No employees match the selected filters.', changeFilters: 'Change the role or employee search to export.',
  loadFailed: 'Could not load the full report. Export is unavailable until it loads successfully.',
  loadRetry: 'Could not load the duty report. Please retry before exporting.', retry: 'Retry report',
  chooseRange: 'Choose a valid date range to view duties.', bothDates: 'Both dates are included.',
  missingDates: 'Select both a from date and a to date.', invalidDates: 'Enter valid dates on or after 01 Jan 1900.',
  reversedDates: 'The to date must be on or after the from date.', rangeTooLong: 'This range exceeds the Excel column limit. Please choose a shorter range.',
  incomplete: 'The duty report is incomplete. Reload the selected range before exporting.',
  detailsTooLong: 'The daily details exceed the Excel row limit. Select fewer employees or a shorter date range.',
  sample: 'Sample data', sampleTitle: 'SAMPLE DATA', sampleHint: 'Backend unavailable — showing local sample data (edits are kept in memory only)',
  sampleWarning: 'SAMPLE / DEMO — not live staff records', sampleNotice: 'Backend unavailable — showing sample staff data.',
  duty: 'Duty', driver: 'Driver', leave: 'Leave', repair: 'Repair', office: 'Office', officeDuty: 'Office Duty', collection: 'Collection',
  weeklyOff: 'Weekly Off', off: 'Off', noEntry: 'No Entry', dutyCount: 'Duty Count', future: 'Future date',
  approvedLeave: 'Approved leave', approvedOverrides: 'Approved leave takes precedence over this assignment.',
  automatic: 'Automatic', recorded: 'Recorded', automaticHint: 'Automatically assigned for this role.',
  supervisor: 'Supervisor', helper: 'Helper', loader: 'Loader', collector: 'Collector', accountant: 'Accountant', mechanic: 'Mechanic',
  cashier: 'Cashier', manager: 'Manager', admin: 'Admin', officeStaff: 'Office staff',
  operations: 'Operations', fleet: 'Fleet', farm: 'Farm', warehouse: 'Warehouse', accounts: 'Accounts', administration: 'Administration',
  open: 'Open', draft: 'Draft', submitted: 'Submitted', locked: 'Locked', closed: 'Closed', readOnly: 'Read-only',
  lockedPrevious: 'Locked — close previous week', previousNotClosed: 'Previous week ({range}) is not closed yet. Submit it first to open this week.',
  submit: 'Submit Week', closePrevious: 'Close the previous week first — submit it before this week can be submitted.',
  unassigned: '{count} of {total} days without duty — assign all to submit', assignAll: 'Assign duties for all days first — {count} days still empty',
  pendingDuties: 'Pending duties', pendingSummary: '{cells} days without duty · {employees} employees',
  pendingHint: 'Every employee needs a duty on every day before the week can be submitted.',
  pendingPick: 'Assign duty for this day', pendingCell: 'Duty not assigned', missingDays: 'Days without duty',
  allAssigned: 'All assigned', autoAssign: 'Auto-assign',
  refresh: 'Refresh', refreshData: 'Refresh data',
  dates: 'Dates', allDates: 'All', allDatesLabel: 'All dates',
  dragHint: 'Drag to another day to move or swap', dragMoved: 'Duty moved to {target}', dragSwapped: 'Duties swapped: {source} ⇄ {target}',
  ready: 'All duties assigned — ready to submit', issues: '{count} issues', validation: 'Validation issues',
  pastLocked: 'Cannot edit duties for previous completed weeks.', weekReadOnly: 'This week is {status} and cannot be modified.',
  leaveLocked: 'This date has approved leave. Change the leave request before assigning a duty.',
  futureLocked: 'Future dates remain empty until that day.',
  autoSaveFailed: 'Automatic duties could not be saved. Please retry.', retrySave: 'Retry saving',
  updateSuccess: 'Duty assignment updated successfully', updateSample: 'Duty updated (sample data).',
  removeSuccess: 'Duty assignment removed successfully', removeSample: 'Duty removed (sample data).',
  noAssignment: 'No duty assignment to remove.', submitSuccess: 'Week submitted successfully.', submitSample: 'Week closed (sample data).',
  submitMissing: 'Cannot submit — {count} days still have no duty assigned. Assign every day for every employee first.',
  selectDuty: 'Select duty for', close: 'Close', other: 'Other', customPlaceholder: 'Type a custom duty (e.g. Farm Visit)',
  setDuty: 'Set as Duty', removeDuty: 'Remove Duty', restoreDefault: 'Restore automatic duty',
  asOf: 'As of {date}', generated: 'Generated {date}', rangeHeading: '{from} to {to} (inclusive) | {days} days | {employees} employees',
  filterHeading: 'Filters: {filters}', allEmployees: 'All employees', filterRole: 'Roles: {roles}', filterSearch: 'Employee search: {search}',
  date: 'Date', day: 'Day', dutyStatus: 'Duty / Status', originalDuty: 'Original Duty Type', vehicle: 'Vehicle',
  entrySource: 'Entry Source', yes: 'Yes', no: 'No',
  apiError: 'The request could not be completed. Please try again.',
} as const;

export const dutyTelugu: Record<keyof typeof dutyEnglish, string> = {
  planner: 'డ్యూటీ పట్టిక', details: 'రోజువారీ వివరాలు', filters: 'డ్యూటీ పట్టిక ఫిల్టర్లు',
  dutyAssign: 'డ్యూటీ అసైన్',
  actions: 'డ్యూటీ పట్టిక చర్యలు', weekTable: 'వారపు డ్యూటీ పట్టిక', dateTable: 'తేదీల వారీ డ్యూటీ పట్టిక',
  employee: 'ఉద్యోగి', employeeNo: 'ఉద్యోగి సంఖ్య', role: 'హోదా', roles: 'హోదాలు', department: 'విభాగం',
  filterRoles: 'ఉద్యోగుల హోదాలను ఎంచుకోండి', includeRoles: 'చేర్చాల్సిన హోదాలు', allRoles: 'అన్ని హోదాలు',
  allRolesIncluded: 'అన్ని హోదాలు చేర్చబడ్డాయి', selectedRoles: 'ఎంచుకున్న హోదాలు', selectedCount: '{count} ఎంపిక',
  removeRole: '{role} హోదాను తొలగించండి', period: 'కాలవ్యవధి', week: 'వారపు', month: 'నెలవారీ', custom: 'తేదీ పరిధి',
  displayedPeriod: 'చూపిస్తున్న కాలవ్యవధి', customDates: 'నిర్దిష్ట తేదీ పరిధి', fromDate: 'నుంచి తేదీ', toDate: 'వరకు తేదీ',
  dateRange: 'తేదీ పరిధి', previousWeek: 'మునుపటి వారం', nextWeek: 'తదుపరి వారం', currentWeek: 'ఈ వారం',
  previousMonth: 'మునుపటి నెల', nextMonth: 'తదుపరి నెల', currentMonth: 'ఈ నెల',
  search: 'ఉద్యోగులను వెతకండి', searchPlaceholder: 'ఉద్యోగి పేరు వెతకండి...', reset: 'రీసెట్',
  download: 'ఎక్సెల్ డౌన్‌లోడ్', excel: 'ఎక్సెల్', preparing: 'ఎక్సెల్ తయారవుతోంది…', downloadScope: 'చూపిస్తున్న పట్టిక డౌన్‌లోడ్: {from} – {to}, {count} మంది ఉద్యోగులు.',
  downloadSuccess: 'డ్యూటీ పట్టిక ఎక్సెల్ డౌన్‌లోడ్ అయింది.', downloadFailed: 'ఎక్సెల్ డౌన్‌లోడ్ కాలేదు. మళ్లీ ప్రయత్నించండి.',
  saveWait: 'డ్యూటీ మార్పులు సేవ్ అయ్యే వరకు వేచి ఉండండి.', loading: 'పట్టిక వివరాలు లోడ్ అవుతున్నాయి…',
  noEmployees: 'ఎంచుకున్న ఫిల్టర్లకు సరిపడే ఉద్యోగులు లేరు.', changeFilters: 'డౌన్‌లోడ్ కోసం హోదా లేదా పేరు ఫిల్టర్ మార్చండి.',
  loadFailed: 'పూర్తి వివరాలు లోడ్ కాలేదు. వివరాలు లోడ్ అయిన తర్వాతే డౌన్‌లోడ్ చేయవచ్చు.',
  loadRetry: 'డ్యూటీ వివరాలు లోడ్ కాలేదు. డౌన్‌లోడ్‌కు ముందు మళ్లీ ప్రయత్నించండి.', retry: 'మళ్లీ ప్రయత్నించండి',
  chooseRange: 'డ్యూటీలు చూడటానికి సరైన తేదీ పరిధిని ఎంచుకోండి.', bothDates: 'రెండు తేదీలు కూడా చేర్చబడతాయి.',
  missingDates: 'ప్రారంభ, ముగింపు తేదీలను ఎంచుకోండి.', invalidDates: '01 జనవరి 1900 నుంచి చెల్లుబాటు అయ్యే తేదీలను నమోదు చేయండి.',
  reversedDates: 'ముగింపు తేదీ ప్రారంభ తేదీకి ముందు ఉండకూడదు.', rangeTooLong: 'ఈ పరిధి ఎక్సెల్ కాలమ్ పరిమితిని మించింది. తక్కువ తేదీలను ఎంచుకోండి.',
  incomplete: 'డ్యూటీ వివరాలు అసంపూర్ణంగా ఉన్నాయి. ఎంచుకున్న తేదీలను మళ్లీ లోడ్ చేయండి.',
  detailsTooLong: 'రోజువారీ వివరాలు ఎక్సెల్ వరుసల పరిమితిని మించాయి. తక్కువ ఉద్యోగులు లేదా తేదీలను ఎంచుకోండి.',
  sample: 'నమూనా డేటా', sampleTitle: 'నమూనా డేటా', sampleHint: 'సర్వర్ అందుబాటులో లేదు — స్థానిక నమూనా డేటా చూపిస్తున్నాం. మార్పులు ఈ సెషన్‌లో మాత్రమే ఉంటాయి.',
  sampleWarning: 'నమూనా మాత్రమే — నిజమైన సిబ్బంది రికార్డులు కావు', sampleNotice: 'సర్వర్ అందుబాటులో లేదు — నమూనా సిబ్బంది డేటా చూపిస్తున్నాం.',
  duty: 'డ్యూటీ', driver: 'డ్రైవర్', leave: 'సెలవు', repair: 'మరమ్మతు', office: 'ఆఫీస్', officeDuty: 'ఆఫీస్ డ్యూటీ', collection: 'వసూళ్లు',
  weeklyOff: 'వారపు సెలవు', off: 'ఆఫ్', noEntry: 'నమోదు లేదు', dutyCount: 'డ్యూటీ రోజులు', future: 'రాబోయే తేదీ',
  approvedLeave: 'ఆమోదించిన సెలవు', approvedOverrides: 'ఈ తేదీన కేటాయించిన డ్యూటీ బదులు ఆమోదించిన సెలవు వర్తిస్తుంది.',
  automatic: 'ఆటోమేటిక్', recorded: 'నమోదైనది', automaticHint: 'ఈ హోదా ప్రకారం ఆటోమేటిక్‌గా కేటాయించబడింది.',
  supervisor: 'సూపర్‌వైజర్', helper: 'సహాయకుడు', loader: 'లోడర్', collector: 'వసూలుదారు', accountant: 'అకౌంటెంట్', mechanic: 'మెకానిక్',
  cashier: 'క్యాషియర్', manager: 'మేనేజర్', admin: 'అడ్మిన్', officeStaff: 'ఆఫీస్ సిబ్బంది',
  operations: 'కార్యకలాపాలు', fleet: 'వాహన విభాగం', farm: 'ఫారం', warehouse: 'గోదాం', accounts: 'ఖాతాలు', administration: 'పరిపాలన',
  open: 'తెరిచి ఉంది', draft: 'ముసాయిదా', submitted: 'సమర్పించారు', locked: 'లాక్ అయింది', closed: 'ముగిసింది', readOnly: 'చూడటానికి మాత్రమే',
  lockedPrevious: 'ముందు గత వారాన్ని ముగించాలి', previousNotClosed: 'మునుపటి వారం ({range}) ఇంకా ముగియలేదు. ఈ వారాన్ని తెరవడానికి ముందు దానిని సమర్పించండి.',
  submit: 'వారాన్ని సమర్పించండి', closePrevious: 'ముందు గత వారాన్ని ముగించండి — దానిని సమర్పించిన తర్వాతే ఈ వారాన్ని సమర్పించవచ్చు.',
  unassigned: '{total} రోజులలో {count} రోజులకు డ్యూటీ లేదు — అన్నింటికీ కేటాయించండి', assignAll: 'ముందు అన్ని రోజులకు డ్యూటీలు కేటాయించండి — ఇంకా {count} రోజులు ఖాళీగా ఉన్నాయి',
  pendingDuties: 'పెండింగ్ డ్యూటీలు', pendingSummary: '{cells} రోజులకు డ్యూటీ లేదు · {employees} మంది ఉద్యోగులు',
  pendingHint: 'వారాన్ని సమర్పించే ముందు ప్రతి ఉద్యోగికి ప్రతి రోజూ డ్యూటీ కేటాయించాలి.',
  pendingPick: 'ఈ రోజు డ్యూటీ కేటాయించండి', pendingCell: 'డ్యూటీ కేటాయించలేదు', missingDays: 'డ్యూటీ లేని రోజులు',
  allAssigned: 'అన్నీ కేటాయించారు', autoAssign: 'ఆటో-అసైన్',
  refresh: 'రిఫ్రెష్', refreshData: 'డేటా రిఫ్రెష్ చేయండి',
  dates: 'తేదీలు', allDates: 'అన్నీ', allDatesLabel: 'అన్ని తేదీలు',
  dragHint: 'మరో రోజుకు లాగి మార్చండి లేదా స్వాప్ చేయండి', dragMoved: 'డ్యూటీ {target} కి మార్చబడింది', dragSwapped: 'డ్యూటీలు స్వాప్ అయ్యాయి: {source} ⇄ {target}',
  ready: 'అన్ని డ్యూటీలు కేటాయించారు — సమర్పించవచ్చు', issues: '{count} సమస్యలు', validation: 'పరిశీలించాల్సిన సమస్యలు',
  pastLocked: 'ముగిసిన వారాల డ్యూటీలను మార్చలేరు.', weekReadOnly: 'ఈ వారం స్థితి: {status}. మార్పులు చేయలేరు.',
  leaveLocked: 'ఈ తేదీకి సెలవు ఆమోదించారు. డ్యూటీ కేటాయించే ముందు సెలవు అభ్యర్థనను మార్చండి.',
  futureLocked: 'రాబోయే తేదీలు ఆ రోజు వరకు ఖాళీగా ఉంటాయి.',
  autoSaveFailed: 'ఆటోమేటిక్ డ్యూటీలు సేవ్ కాలేదు. మళ్లీ ప్రయత్నించండి.', retrySave: 'మళ్లీ సేవ్ చేయండి',
  updateSuccess: 'డ్యూటీ విజయవంతంగా మార్చబడింది.', updateSample: 'డ్యూటీ మార్చబడింది (నమూనా డేటా).',
  removeSuccess: 'డ్యూటీ తొలగించబడింది.', removeSample: 'డ్యూటీ తొలగించబడింది (నమూనా డేటా).',
  noAssignment: 'తొలగించడానికి డ్యూటీ లేదు.', submitSuccess: 'వారం విజయవంతంగా సమర్పించబడింది.', submitSample: 'వారం ముగిసింది (నమూనా డేటా).',
  submitMissing: 'సమర్పించలేరు — ఇంకా {count} రోజులకు డ్యూటీ లేదు. ప్రతి ఉద్యోగికి అన్ని రోజుల డ్యూటీలు కేటాయించండి.',
  selectDuty: 'డ్యూటీ ఎంచుకోండి', close: 'మూసివేయండి', other: 'ఇతర', customPlaceholder: 'ఇతర డ్యూటీ రాయండి (ఉదా: ఫారం సందర్శన)',
  setDuty: 'డ్యూటీగా పెట్టండి', removeDuty: 'డ్యూటీ తొలగించండి', restoreDefault: 'ఆటోమేటిక్ డ్యూటీని పునరుద్ధరించండి',
  asOf: '{date} నాటికి', generated: 'తయారీ సమయం: {date}', rangeHeading: '{from} నుంచి {to} వరకు | {days} రోజులు | {employees} మంది ఉద్యోగులు',
  filterHeading: 'ఫిల్టర్లు: {filters}', allEmployees: 'అందరు ఉద్యోగులు', filterRole: 'హోదాలు: {roles}', filterSearch: 'ఉద్యోగి పేరు: {search}',
  date: 'తేదీ', day: 'రోజు', dutyStatus: 'డ్యూటీ / స్థితి', originalDuty: 'అసలు డ్యూటీ రకం', vehicle: 'వాహనం',
  entrySource: 'నమోదు మూలం', yes: 'అవును', no: 'కాదు',
  apiError: 'అభ్యర్థన పూర్తి కాలేదు. మళ్లీ ప్రయత్నించండి.',
};

export type DutyTextKey = keyof typeof dutyEnglish;
export function dutyText(language: DutyLanguage, key: DutyTextKey, params?: Record<string, string | number>): string {
  let text: string = (language === 'te' ? dutyTelugu : dutyEnglish)[key];
  for (const [name, value] of Object.entries(params ?? {})) text = text.split(`{${name}}`).join(String(value));
  return text;
}
export function dutyTranslator(language: DutyLanguage) {
  return (key: DutyTextKey, params?: Record<string, string | number>) => dutyText(language, key, params);
}
export function dutyLocale(language: DutyLanguage): string { return language === 'te' ? 'te-IN' : 'en-IN'; }

const DISPLAY_KEYS: Record<string, DutyTextKey> = {
  supervisor: 'supervisor', driver: 'driver', helper: 'helper', loader: 'loader', collector: 'collector', mechanic: 'mechanic',
  collection: 'collection', collections: 'collection', accountant: 'accountant', cashier: 'cashier', manager: 'manager',
  admin: 'admin', administrator: 'admin', administration: 'administration', office: 'office', 'office staff': 'officeStaff',
  operations: 'operations', fleet: 'fleet', farm: 'farm', warehouse: 'warehouse', accounts: 'accounts',
  open: 'open', draft: 'draft', submitted: 'submitted', locked: 'locked', closed: 'closed',
};
export function dutyDisplayValue(value: string, language: DutyLanguage): string {
  const normalized = value.trim().toLowerCase();
  const key = Object.prototype.hasOwnProperty.call(DISPLAY_KEYS, normalized) ? DISPLAY_KEYS[normalized] : undefined;
  return key ? dutyText(language, key) : value;
}

export function localizeDutyError(error: unknown, language: DutyLanguage): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (language === 'en') return message || dutyText(language, 'apiError');
  const entry = Object.entries(dutyEnglish).find(([, value]) => value === message);
  return entry ? dutyText(language, entry[0] as DutyTextKey) : dutyText(language, 'apiError');
}
