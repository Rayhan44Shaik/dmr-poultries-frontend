// src/i18n/translations.ts
// Global translation catalog for the DMR Poultries ERP.
//
// Coverage: global chrome, shared UI primitives, Masters module surface, and
// common/status/pagination/validation terms used across every module.
// Business data (shop names, farmer names, vehicle numbers, phone numbers,
// addresses, remarks, IDs) is NEVER translated — only the UI labels around it.
//
// When a key is missing for the active locale, the LanguageProvider falls back
// to the English catalog and then to the raw key, so users never see
// "undefined".

export type Locale = "en" | "te";

export interface TranslationCatalog {
  common: {
    appName: string;
    appSubtitle: string;
    save: string;
    cancel: string;
    close: string;
    reset: string;
    search: string;
    filter: string;
    export: string;
    view: string;
    edit: string;
    delete: string;
    add: string;
    actions: string;
    status: string;
    date: string;
    from: string;
    to: string;
    total: string;
    all: string;
    loading: string;
    noRecords: string;
    confirm: string;
    areYouSure: string;
    error: string;
    success: string;
    viewDetails: string;
    selectModule: string;
    showing: string;
    records: string;
    previous: string;
    next: string;
    page: string;
    of: string;
    required: string;
    invalid: string;
    download: string;
    print: string;
    generate: string;
    summary: string;
    saving: string;
    retry: string;
    bulkImport: string;
    searchPlaceholder: string;
    editShop: string;
    deleteShop: string;
    saveShop: string;
    updateShop: string;
    directory: string;
    loadingEntities: string;
    noEntities: string;
    addToStart: string;
    bulkImportDone: string;
    confidentialReport: string;
  };
  nav: {
    dashboard: string;
    masters: string;
    operations: string;
    vehicles: string;
    staff: string;
    accounts: string;
    reports: string;
    settings: string;
  };
  masters: {
    title: string;
    shops: string;
    farms: string;
    vehicles: string;
    employees: string;
    banks: string;
    birdTypes: string;
    routes: string;
    searchPlaceholder: string;
  };
  shops: {
    shopNo: string;
    shopName: string;
    owner: string;
    mobile: string;
    phone: string;
    village: string;
    openingBalance: string;
    addShop: string;
    search: string;
    edit: string;
    delete: string;
    address: string;
    form: {
      titleAdd: string;
      titleEdit: string;
      subtitleAdd: string;
      subtitleEdit: string;
      shopName: string;
      ownerName: string;
      village: string;
      address: string;
      enterShopName: string;
      enterOwnerName: string;
      enterMobile: string;
      enterVillage: string;
      enterAddress: string;
      errShopNameShort: string;
      errOwnerNameShort: string;
      errMobile10: string;
      errVillageRequired: string;
      errOpeningBalance: string;
      ownerNameLabel: string;
    };
    duplicate: string;
    updated: string;
    added: string;
    deactivateConfirm: string;
    deactivated: string;
  };
  farms: {
    farmNo: string;
    farmName: string;
    capacity: string;
  };
  vehicles: {
    vehicleNo: string;
    vehicleNumber: string;
    vehicleType: string;
    driver: string;
  };
  employees: {
    employee: string;
    department: string;
    salary: string;
  };
  operations: {
    title: string;
    trip: string;
    supervisor: string;
    farm: string;
    weight: string;
    rate: string;
    amount: string;
    mortality: string;
    delivery: string;
    dispatch: string;
    birds: string;
    history: string;
  };
  accounts: {
    title: string;
    ledger: string;
    collection: string;
    payment: string;
    expense: string;
    credit: string;
    debit: string;
    balance: string;
    outstanding: string;
    profit: string;
    loss: string;
    cashBook: string;
    bankTransactions: string;
    farmerPayments: string;
    dayClosing: string;
  };
  reports: {
    title: string;
    report: string;
  };
  status: {
    active: string;
    inactive: string;
    pending: string;
    approved: string;
    rejected: string;
    completed: string;
    paid: string;
    unpaid: string;
    draft: string;
    deleted: string;
    partiallyPaid: string;
  };
  settings: {
    profilePreferences: string;
    users: string;
    permissions: string;
    about: string;
    applicationLanguage: string;
  };
}

export const translations: Record<Locale, TranslationCatalog> = {
  en: {
    common: {
      appName: "DMR Poultries",
      appSubtitle: "ERP System",
      save: "Save",
      cancel: "Cancel",
      close: "Close",
      reset: "Reset",
      search: "Search",
      filter: "Filter",
      export: "Export",
      view: "View",
      edit: "Edit",
      delete: "Delete",
      add: "Add",
      actions: "Actions",
      status: "Status",
      date: "Date",
      from: "From",
      to: "To",
      total: "Total",
      all: "All",
      loading: "Loading...",
      noRecords: "No records found",
      confirm: "Confirm",
      areYouSure: "Are you sure?",
      error: "Something went wrong",
      success: "Saved successfully",
      viewDetails: "View Details",
      selectModule: "Select Module",
      showing: "Showing",
      records: "Record(s)",
      previous: "Previous",
      next: "Next",
      page: "Page",
      of: "of",
      required: "Required",
      invalid: "Invalid",
      download: "Download",
      print: "Print",
      generate: "Generate",
      summary: "Summary",
      saving: "Saving...",
      retry: "Retry",
      bulkImport: "Bulk Import",
      searchPlaceholder: "Search Shop...",
      editShop: "Edit Shop",
      deleteShop: "Delete Shop",
      saveShop: "Save Shop",
      updateShop: "Update Shop",
      directory: "Outlets Directory",
      loadingEntities: "Loading shops...",
      noEntities: "No shops found.",
      addToStart: "Add a shop to get started.",
      bulkImportDone: "Imported {imported} of {total} shops.",
      confidentialReport: "Confidential Business Report",
    },
    nav: {
      dashboard: "Dashboard",
      masters: "Masters",
      operations: "Operations",
      vehicles: "Vehicles",
      staff: "Staff",
      accounts: "Accounts",
      reports: "Reports",
      settings: "Settings",
    },
    masters: {
      title: "Masters",
      shops: "Shops",
      farms: "Farms",
      vehicles: "Vehicles",
      employees: "Employees",
      banks: "Banks",
      birdTypes: "Bird Types",
      routes: "Routes",
      searchPlaceholder: "Search Shops, Farms, Vehicles, Employees...",
    },
    shops: {
      shopNo: "Shop No",
      shopName: "Shop Name",
      owner: "Owner",
      mobile: "Mobile",
      phone: "Phone",
      village: "Village",
      openingBalance: "Opening Balance",
      addShop: "Add Shop",
      search: "Search Shop...",
      edit: "Edit",
      delete: "Delete",
      address: "Address",
      form: {
        titleAdd: "Add Shop",
        titleEdit: "Edit Shop",
        subtitleAdd: "Fill in the information",
        subtitleEdit: "Update details",
        shopName: "Shop Name",
        ownerName: "Owner Name",
        village: "Village",
        address: "Address",
        enterShopName: "Enter Shop Name",
        enterOwnerName: "Enter Owner Name",
        enterMobile: "Enter Mobile Number",
        enterVillage: "Enter Village",
        enterAddress: "Enter Address",
        errShopNameShort: "Shop Name must contain at least 3 characters.",
        errOwnerNameShort: "Owner Name must contain at least 3 characters.",
        errMobile10: "Mobile Number must be exactly 10 digits.",
        errVillageRequired: "Village is required.",
        errOpeningBalance: "Opening Balance is required and must be a valid number.",
        ownerNameLabel: "Owner Name",
      },
      duplicate: "Shop Name already exists.",
      updated: "Shop updated successfully!",
      added: "Shop added successfully!",
      deactivateConfirm: "Deactivate this shop? It will be marked Inactive (history is kept).",
      deactivated: "Shop deactivated successfully!",
    },
    farms: { farmNo: "Farm No", farmName: "Farm Name", capacity: "Capacity" },
    vehicles: { vehicleNo: "Vehicle No", vehicleNumber: "Vehicle Number", vehicleType: "Vehicle Type", driver: "Driver" },
    employees: { employee: "Employee", department: "Department", salary: "Salary" },
    operations: {
      title: "Operations",
      trip: "Trip",
      supervisor: "Supervisor",
      farm: "Farm",
      weight: "Weight",
      rate: "Rate",
      amount: "Amount",
      mortality: "Mortality",
      delivery: "Delivery",
      dispatch: "Dispatch",
      birds: "Birds",
      history: "History",
    },
    accounts: {
      title: "Accounts",
      ledger: "Ledger",
      collection: "Collection",
      payment: "Payment",
      expense: "Expense",
      credit: "Credit",
      debit: "Debit",
      balance: "Balance",
      outstanding: "Outstanding",
      profit: "Profit",
      loss: "Loss",
      cashBook: "Cash Book",
      bankTransactions: "Bank Transactions",
      farmerPayments: "Farmer Payments",
      dayClosing: "Day Closing",
    },
    reports: { title: "Reports", report: "Report" },
    status: {
      active: "Active",
      inactive: "Inactive",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      completed: "Completed",
      paid: "Paid",
      unpaid: "Unpaid",
      draft: "Draft",
      deleted: "Deleted",
      partiallyPaid: "Partially Paid",
    },
    settings: {
      profilePreferences: "My Profile & Preferences",
      users: "Users",
      permissions: "Permissions",
      about: "About ERP",
      applicationLanguage: "Application Language",
    },
  },
  te: {
    common: {
      appName: "డి.యం.ఆర్ పౌల్ట్రీస్",
      appSubtitle: "ERP వ్యవస్థ",
      save: "సేవ్",
      cancel: "రద్దు",
      close: "మూసివేయి",
      reset: "రీసెట్",
      search: "వెతకండి",
      filter: "ఫిల్టర్",
      export: "ఎగుమతి",
      view: "వీక్షించండి",
      edit: "సవరించు",
      delete: "తొలగించు",
      add: "జోడించు",
      actions: "చర్యలు",
      status: "స్థితి",
      date: "తేదీ",
      from: "నుండి",
      to: "వరకు",
      total: "మొత్తం",
      all: "అన్నీ",
      loading: "లోడ్ అవుతోంది...",
      noRecords: "రికార్డులు కనుగొనబడలేదు",
      confirm: "నిర్ధారించండి",
      areYouSure: "మీరు ఖచ్చితంగా ఉన్నారా?",
      error: "ఏదో తప్పు జరిగింది",
      success: "విజయవంతంగా సేవ్ చేయబడింది",
      viewDetails: "వివరాలు చూడండి",
      selectModule: "మాడ్యూల్ ఎంచుకోండి",
      showing: "చూపిస్తోంది",
      records: "రికార్డు(లు)",
      previous: "మునుపటి",
      next: "తదుపరి",
      page: "పేజీ",
      of: "యొక్క",
      required: "అవసరం",
      invalid: "చెల్లదు",
      download: "డౌన్‌లోడ్",
      print: "ప్రింట్",
      generate: "రూపొందించండి",
      summary: "సారాంశం",
      saving: "సేవ్ అవుతోంది...",
      retry: "మళ్ళీ ప్రయత్నించండి",
      bulkImport: "బల్క్ ఇంపోర్ట్",
      searchPlaceholder: "దుకాణం వెతకండి...",
      editShop: "దుకాణం సవరించు",
      deleteShop: "దుకాణం తొలగించు",
      saveShop: "దుకాణం సేవ్ చేయండి",
      updateShop: "దుకాణం నవీకరించండి",
      directory: "అవుట్‌లెట్స్ డైరెక్టరీ",
      loadingEntities: "దుకాణాలు లోడ్ అవుతోంది...",
      noEntities: "దుకాణాలు కనుగొనబడలేదు.",
      addToStart: "ప్రారంభించడానికి ఒక దుకాణాన్ని జోడించండి.",
      bulkImportDone: "{imported} నుండి {total} దుకాణాలు దిగుమతి చేయబడ్డాయి.",
      confidentialReport: "గోప్య వ్యాపార నివేదిక",
    },
    nav: {
      dashboard: "డాష్‌బోర్డ్",
      masters: "మాస్టర్స్",
      operations: "కార్యకలాపాలు",
      vehicles: "వాహనాలు",
      staff: "సిబ్బంది",
      accounts: "అకౌంట్స్",
      reports: "నివేదికలు",
      settings: "సెట్టింగ్‌లు",
    },
    masters: {
      title: "మాస్టర్స్",
      shops: "దుకాణాలు",
      farms: "పొలాలు",
      vehicles: "వాహనాలు",
      employees: "ఉద్యోగులు",
      banks: "బ్యాంకులు",
      birdTypes: "పక్షి రకాలు",
      routes: "మార్గాలు",
      searchPlaceholder: "దుకాణాలు, పొలాలు, వాహనాలు, ఉద్యోగులు వెతకండి...",
    },
    shops: {
      shopNo: "దుకాణం నెం.",
      shopName: "దుకాణం పేరు",
      owner: "యజమాని",
      mobile: "మొబైల్",
      phone: "ఫోన్",
      village: "గ్రామం",
      openingBalance: "ప్రారంభ నిల్వ",
      addShop: "దుకాణం జోడించు",
      search: "దుకాణం వెతకండి...",
      edit: "సవరించు",
      delete: "తొలగించు",
      address: "చిరునామా",
      form: {
        titleAdd: "దుకాణం జోడించు",
        titleEdit: "దుకాణం సవరించు",
        subtitleAdd: "సమాచారాన్ని నింపండి",
        subtitleEdit: "వివరాలు నవీకరించండి",
        shopName: "దుకాణం పేరు",
        ownerName: "యజమాని పేరు",
        village: "గ్రామం",
        address: "చిరునామా",
        enterShopName: "దుకాణం పేరు నమోదు చేయండి",
        enterOwnerName: "యజమాని పేరు నమోదు చేయండి",
        enterMobile: "మొబైల్ నంబర్ నమోదు చేయండి",
        enterVillage: "గ్రామం నమోదు చేయండి",
        enterAddress: "చిరునామా నమోదు చేయండి",
        errShopNameShort: "దుకాణం పేరు కనీసం 3 అక్షరాలు ఉండాలి.",
        errOwnerNameShort: "యజమాని పేరు కనీసం 3 అక్షరాలు ఉండాలి.",
        errMobile10: "మొబైల్ నంబర్ సరిగ్గా 10 అంకెలు ఉండాలి.",
        errVillageRequired: "గ్రామం అవసరం.",
        errOpeningBalance: "ప్రారంభ నిల్వ అవసరం మరియు చెల్లుబాటు అయ్యే సంఖ్య అయి ఉండాలి.",
        ownerNameLabel: "యజమాని పేరు",
      },
      duplicate: "దుకాణం పేరు ఇప్పటికే ఉంది.",
      updated: "దుకాణం విజయవంతంగా నవీకరించబడింది!",
      added: "దుకాణం విజయవంతంగా జోడించబడింది!",
      deactivateConfirm: "ఈ దుకాణాన్ని నిష్క్రియం చేయాలా? ఇది నిష్క్రియంగా గుర్తించబడుతుంది (చరిత్ర భద్రపరచబడుతుంది).",
      deactivated: "దుకాణం విజయవంతంగా నిష్క్రియం చేయబడింది!",
    },
    farms: { farmNo: "పొలం నెం.", farmName: "పొలం పేరు", capacity: "సామర్థ్యం" },
    vehicles: { vehicleNo: "వాహనం నెం.", vehicleNumber: "వాహన సంఖ్య", vehicleType: "వాహన రకం", driver: "డ్రైవర్" },
    employees: { employee: "ఉద్యోగి", department: "శాఖ", salary: "జీతం" },
    operations: {
      title: "కార్యకలాపాలు",
      trip: "ప్రయాణం",
      supervisor: "పర్యవేక్షకుడు",
      farm: "పొలం",
      weight: "బరువు",
      rate: "రేటు",
      amount: "మొత్తం",
      mortality: "మరణాలు",
      delivery: "డెలివరీ",
      dispatch: "రవాణా",
      birds: "పక్షులు",
      history: "చరిత్ర",
    },
    accounts: {
      title: "అకౌంట్స్",
      ledger: "లెడ్జర్",
      collection: "వసూలు",
      payment: "చెల్లింపు",
      expense: "ఖర్చు",
      credit: "క్రెడిట్",
      debit: "డెబిట్",
      balance: "నిల్వ",
      outstanding: "బకాయి",
      profit: "లాభం",
      loss: "నష్టం",
      cashBook: "క్యాష్ బుక్",
      bankTransactions: "బ్యాంక్ లావాదేవీలు",
      farmerPayments: "రైతు చెల్లింపులు",
      dayClosing: "రోజు ముగింపు",
    },
    reports: { title: "నివేదికలు", report: "నివేదిక" },
    status: {
      active: "చురుకైన",
      inactive: "నిష్క్రియ",
      pending: "పెండింగ్",
      approved: "ఆమోదించబడింది",
      rejected: "తిరస్కరించబడింది",
      completed: "పూర్తయింది",
      paid: "చెల్లించారు",
      unpaid: "చెల్లించలేదు",
      draft: "డ్రాఫ్ట్",
      deleted: "తొలగించబడింది",
      partiallyPaid: "పాక్షికంగా చెల్లించారు",
    },
    settings: {
      profilePreferences: "నా ప్రొఫైల్ & ప్రాధాన్యతలు",
      users: "వినియోగదారులు",
      permissions: "అనుమతులు",
      about: "ERP గురించి",
      applicationLanguage: "అప్లికేషన్ భాష",
    },
  },
};
