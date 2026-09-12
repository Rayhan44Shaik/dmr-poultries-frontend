import type { Language } from "../../../../i18n";
import type { BirdType } from "../../../masters/bird-types/types/birdType";
import type { Shop } from "../../../masters/shops/types/shop";
import type { Trip } from "../types/trip";
import { formatIstStamp } from "../services/tripHeaderApiService";
import { cleanDeliveryShopName } from "./shopDisplayName";

const PHRASE_TE: Record<string, string> = {
  "Country Chicken": "దేశీ కోడి",
  Broiler: "బ్రాయిలర్",
  Layer: "లేయర్",
  "Kadaknath": "కడక్నాథ్",
  "Aseel": "అసీల్",
  "Owner": "యజమాని",
  "DMR Owner": "డీఎంఆర్ యజమాని",
  "Commercial broiler — standard catch": "వాణిజ్య బ్రాయిలర్ — సాధారణ క్యాచ్",
  "Nati / country chicken": "నాటి / దేశీ కోడి",
  "Spent layer hen": "లేయర్ కోడి",
  "Dual purpose backyard bird": "రెండు ఉపయోగాల ఇంటి పక్షి",
  "Premium black-meat bird": "ప్రీమియం నల్ల మాంసం పక్షి",
};

const WORD_TE: Record<string, string> = {
  Sri: "శ్రీ",
  Om: "ఓం",
  Balaji: "బాలాజీ",
  Venkatadri: "వెంకటాద్రి",
  Venkateswara: "వెంకటేశ్వర",
  Annapurna: "అన్నపూర్ణ",
  Kakatiya: "కాకతీయ",
  Sai: "సాయి",
  Ram: "రామ్",
  Sreenivasa: "శ్రీనివాస",
  Lakshmi: "లక్ష్మి",
  Narasimha: "నరసింహ",
  Bhavani: "భవాని",
  Durga: "దుర్గ",
  Ganesh: "గణేష్",
  Hanuman: "హనుమాన్",
  Maruthi: "మారుతి",
  Rajarajeshwari: "రాజరాజేశ్వరి",
  Anjaneya: "ఆంజనేయ",
  Raghavendra: "రాఘవేంద్ర",
  Prasanna: "ప్రసన్న",
  Manjunatha: "మంజునాథ",
  Sitarama: "సీతారామ",
  Nandini: "నందిని",
  Gayatri: "గాయత్రి",
  Tirumala: "తిరుమల",
  Bhagyalakshmi: "భాగ్యలక్ష్మి",
  Poultry: "పౌల్ట్రీ",
  Traders: "ట్రేడర్స్",
  Association: "అసోసియేషన్",
  Vencob: "వెన్‌కాబ్",
  Sneha: "స్నేహ",
  Vij: "విజ్",
  Gun: "గన్",
  Asso: "అసో",
  Paper: "పేపర్",
  Egg: "ఎగ్",
  Suppliers: "సప్లయర్స్",
  Farms: "ఫార్మ్స్",
  Farm: "ఫార్మ్",
  Outlet: "అవుట్‌లెట్",
  Point: "పాయింట్",
  Chicken: "చికెన్",
  Center: "సెంటర్",
  Broiler: "బ్రాయిలర్",
  Broilers: "బ్రాయిలర్స్",
  Giriraja: "గిరిరాజ",
  Kadaknath: "కడక్నాథ్",
  Layer: "లేయర్",
  Nati: "నాటి",
  Commercial: "వాణిజ్య",
  standard: "సాధారణ",
  catch: "క్యాచ్",
  Spent: "స్పెంట్",
  layer: "లేయర్",
  hen: "కోడి",
  Dual: "రెండు",
  purpose: "ఉపయోగాల",
  backyard: "ఇంటి",
  bird: "పక్షి",
  Premium: "ప్రీమియం",
  black: "నల్ల",
  meat: "మాంసం",
  Mart: "మార్ట్",
  Fresh: "ఫ్రెష్",
  Meat: "మీట్",
  Stores: "స్టోర్స్",
  Anand: "ఆనంద్",
  Agro: "అగ్రో",
  Godavari: "గోదావరి",
  Hatchery: "హ్యాచరీ",
  Krishna: "కృష్ణ",
  Valley: "వ్యాలీ",
  Nandi: "నంది",
  Estate: "ఎస్టేట్",
  Deccan: "దక్కన్",
  Green: "గ్రీన్",
  Survey: "సర్వే",
  Road: "రోడ్",
  Ameerpet: "అమీర్‌పేట్",
  Kukatpally: "కూకట్‌పల్లి",
  Begumpet: "బేగంపేట్",
  Hanamkonda: "హనుమకొండ",
  Miyapur: "మియాపూర్",
  LB: "ఎల్‌బీ",
  Nagar: "నగర్",
  Dilsukhnagar: "దిల్‌సుఖ్‌నగర్",
  Uppal: "ఉప్పల్",
  Charminar: "చార్మినార్",
  Kothapet: "కొత్తపేట",
  Vanastalipuram: "వనస్థలిపురం",
  Nacharam: "నాచారం",
  Balanagar: "బాలానగర్",
  Moosapet: "మూసాపేట్",
  Sanathnagar: "సనత్‌నగర్",
  Erragadda: "ఎర్రగడ్డ",
  Madhapur: "మాధాపూర్",
  Gachibowli: "గచ్చిబౌలి",
  Shamshabad: "శంషాబాద్",
  Ramachandrapuram: "రామచంద్రపురం",
  Medchal: "మెడ్చల్",
  Yadadri: "యాదాద్రి",
  Prattipadu: "ప్రత్తిపాడు",
  Keesara: "కీసర",
  Chevella: "చేవెళ్ల",
  Shadnagar: "షాద్‌నగర్",
  Bhongir: "భువనగిరి",
  Sangareddy: "సంగారెడ్డి",
  Siddipet: "సిద్దిపేట",
  Jangaon: "జనగాం",
  Warangal: "వరంగల్",
  Vijayawada: "విజయవాడ",
  Ravi: "రవి",
  Srinivas: "శ్రీనివాస్",
  Mohan: "మోహన్",
  Anil: "అనిల్",
  Imran: "ఇమ్రాన్",
  Kiran: "కిరణ్",
  Ramesh: "రమేష్",
  Suresh: "సురేష్",
  Chandra: "చంద్ర",
  Devi: "దేవి",
  Gopal: "గోపాల్",
  Hari: "హరి",
  Indira: "ఇందిర",
  Jagan: "జగన్",
  Kavya: "కావ్య",
  Madhu: "మధు",
  Naresh: "నరేష్",
  Padma: "పద్మ",
  Uma: "ఉమ",
  Venkat: "వెంకట్",
  Yadagiri: "యాదగిరి",
  Srinu: "శ్రీను",
  Prakash: "ప్రకాశ్",
  Naveen: "నవీన్",
  Vinay: "వినయ్",
  Mahesh: "మహేష్",
  Malli: "మల్లి",
  Basha: "బాషా",
  Raju: "రాజు",
  Sathish: "సతీష్",
  Satish: "సతీష్",
  Rajesh: "రాజేష్",
  Nagaraju: "నాగరాజు",
  Yesu: "యేసు",
  Bhaskar: "భాస్కర్",
  Chandu: "చందు",
  Dinesh: "దినేష్",
  Eswar: "ఈశ్వర్",
  Feroz: "ఫిరోజ్",
  Gopi: "గోపి",
  Harish: "హరీష్",
  Ismail: "ఇస్మాయిల్",
  Jagadish: "జగదీష్",
  Karthik: "కార్తీక్",
  Kumar: "కుమార్",
  Rao: "రావు",
  Reddy: "రెడ్డి",
  Naidu: "నాయుడు",
  Goud: "గౌడ్",
  Chary: "చారి",
  Prasad: "ప్రసాద్",
  Sharma: "శర్మ",
  Sarma: "శర్మ",
  Guptha: "గుప్తా",
  Yadav: "యాదవ్",
  Babu: "బాబు",
  Shaik: "షేక్",
  Varma: "వర్మ",
  Sastry: "శాస్త్రి",
  Murthy: "మూర్తి",
  Pillai: "పిళ్లై",
  K: "కె",
  M: "ఎం",
  D: "డి",
  R: "ఆర్",
  P: "పి",
  V: "వి",
  N: "ఎన్",
  S: "ఎస్",
  T: "టి",
  Y: "వై",
  Driver: "డ్రైవర్",
  Supervisor: "సూపర్వైజర్",
  Helper: "హెల్పర్",
  Loader: "లోడర్",
  Admin: "అడ్మిన్",
};

const LATIN_LETTER_TE: Record<string, string> = {
  a: "ఏ",
  b: "బి",
  c: "సి",
  d: "డి",
  e: "ఈ",
  f: "ఎఫ్",
  g: "జి",
  h: "హెచ్",
  i: "ఐ",
  j: "జె",
  k: "కె",
  l: "ఎల్",
  m: "ఎం",
  n: "ఎన్",
  o: "ఓ",
  p: "పి",
  q: "క్యూ",
  r: "ఆర్",
  s: "ఎస్",
  t: "టి",
  u: "యు",
  v: "వి",
  w: "డబ్ల్యూ",
  x: "ఎక్స్",
  y: "వై",
  z: "జెడ్",
};

function fallbackTeluguToken(token: string): string {
  if (!/[A-Za-z]/.test(token)) return token;
  return token
    .split("")
    .map((char) => LATIN_LETTER_TE[char.toLowerCase()] ?? char)
    .join("");
}

function lookupTeluguWord(part: string): string | undefined {
  return (
    WORD_TE[part] ??
    WORD_TE[part.toLocaleLowerCase()] ??
    WORD_TE[part.charAt(0).toLocaleUpperCase() + part.slice(1).toLocaleLowerCase()]
  );
}

function localizeWords(value: string): string {
  return value
    .split(/(\s+|[-–—,./()])/)
    .map((part) => {
      if (!part || /^\s+$/.test(part) || /^[-–—,./()]$/.test(part) || /^\d+$/.test(part)) return part;
      return lookupTeluguWord(part) ?? fallbackTeluguToken(part);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function localizeTripViewText(value: string | null | undefined, language: Language, options: { cleanShopCode?: boolean } = {}): string {
  const source = options.cleanShopCode ? cleanDeliveryShopName(value) : String(value ?? "").trim();
  if (!source || language !== "te") return source;
  return PHRASE_TE[source] ?? localizeWords(source);
}

export function formatTripViewStamp(value: unknown, language: Language): string {
  const formatted = formatIstStamp(value);
  return language === "te" ? formatted.replace(/\sIST$/, " ఐఎస్‌టి") : formatted;
}

export function localizeTripForView(trip: Trip, language: Language): Trip {
  if (language !== "te") return trip;
  return {
    ...trip,
    tripNo: localizeTripViewText(trip.tripNo, language),
    vehicleNo: localizeTripViewText(trip.vehicleNo, language),
    startTime: formatTripViewStamp(trip.startTime, language),
    startStepSubmittedAt: formatTripViewStamp(trip.startStepSubmittedAt, language),
    reachedTime: formatTripViewStamp(trip.reachedTime, language),
    farmStepSubmittedAt: formatTripViewStamp(trip.farmStepSubmittedAt, language),
    farmGpsTime: formatTripViewStamp(trip.farmGpsTime, language),
    pickupLoadTime: formatTripViewStamp(trip.pickupLoadTime, language),
    pickupStepSubmittedAt: formatTripViewStamp(trip.pickupStepSubmittedAt, language),
    endTime: formatTripViewStamp(trip.endTime, language),
    expensesStepSubmittedAt: formatTripViewStamp(trip.expensesStepSubmittedAt, language),
    submittedAtTimestamp: formatTripViewStamp(trip.submittedAtTimestamp, language),
    driverName: localizeTripViewText(trip.driverName, language),
    supervisorName: localizeTripViewText(trip.supervisorName, language),
    sourceFarm: localizeTripViewText(trip.sourceFarm, language),
    farmAddress: localizeTripViewText(trip.farmAddress, language),
    birdType: localizeTripViewText(trip.birdType, language),
    remarks: localizeTripViewText(trip.remarks, language),
    helpers: (trip.helpers || []).map((name) => localizeTripViewText(name, language)),
    loaders: (trip.loaders || []).map((name) => localizeTripViewText(name, language)),
    lastShop: localizeTripViewText(trip.lastShop, language, { cleanShopCode: true }),
    approvedBy: localizeTripViewText(trip.approvedBy, language),
    deliveries: (trip.deliveries || []).map((delivery) => ({
      ...delivery,
      shopName: localizeTripViewText(delivery.shopName, language, { cleanShopCode: true }),
      birdType: localizeTripViewText(delivery.birdType, language),
      remarks: localizeTripViewText(delivery.remarks, language),
      autoCaptureTime: formatTripViewStamp(delivery.autoCaptureTime, language),
      marketRate: delivery.marketRate
        ? {
            ...delivery.marketRate,
            shopName: localizeTripViewText(delivery.marketRate.shopName, language, { cleanShopCode: true }),
            birdType: localizeTripViewText(delivery.marketRate.birdType, language),
            lastTripNo: localizeTripViewText(delivery.marketRate.lastTripNo, language),
          }
        : delivery.marketRate,
    })),
    dieselEntries: (trip.dieselEntries || []).map((entry) => ({
      ...entry,
      bunkName: localizeTripViewText(entry.bunkName, language),
      submittedAt: formatTripViewStamp(entry.submittedAt, language),
      gpsCapturedAt: formatTripViewStamp(entry.gpsCapturedAt, language),
    })),
  };
}

export function localizeShopsForView(shops: Shop[], language: Language): Shop[] {
  if (language !== "te") return shops;
  return shops.map((shop) => ({
    ...shop,
    shopName: localizeTripViewText(shop.shopName, language, { cleanShopCode: true }),
    ownerName: localizeTripViewText(shop.ownerName, language),
    city: localizeTripViewText(shop.city, language),
    address: localizeTripViewText(shop.address, language),
  }));
}

export function localizeBirdTypesForView(birdTypes: BirdType[], language: Language): BirdType[] {
  if (language !== "te") return birdTypes;
  return birdTypes.map((birdType) => ({
    ...birdType,
    birdType: localizeTripViewText(birdType.birdType, language),
    description: localizeTripViewText(birdType.description, language),
  }));
}
