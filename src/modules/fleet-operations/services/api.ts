import {
  getMaintenance, addMaintenance, updateMaintenance, deleteMaintenance,
  getDocuments, addDocument, updateDocument, deleteDocument,
  getFastags, addFastag, updateFastag, deleteFastag,
  getFastagTransactions, addFastagTransaction,
  getEMIRecords, addEMIRecord, updateEMIRecord, deleteEMIRecord
} from './storage';

export const fleetApi = {
  // Maintenance
  getMaintenance,
  addMaintenance,
  updateMaintenance,
  deleteMaintenance,

  // Documents
  getDocuments,
  addDocument,
  updateDocument,
  deleteDocument,

  // FASTag
  getFastags,
  addFastag,
  updateFastag,
  deleteFastag,
  getFastagTransactions,
  addFastagTransaction,

  // EMI
  getEMIRecords,
  addEMIRecord,
  updateEMIRecord,
  deleteEMIRecord,
};