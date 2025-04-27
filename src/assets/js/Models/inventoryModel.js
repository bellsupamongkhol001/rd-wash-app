import { db } from "@config/firebaseConfig.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";


const UniformsDB   = collection(db, "UniformsDB");
const InventoryDB  = collection(db, "InventoryDB");
const EmployeesDB  = collection(db, "EmployeesDB");

let _uniformsCache = null;

export function clearUniformCache() {
  _uniformsCache = null;
}

export async function fetchUniforms() {
  if (_uniformsCache && Array.isArray(_uniformsCache)) {
    return _uniformsCache;
  }

  try {
    const snapshot = await getDocs(UniformsDB);
    _uniformsCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return _uniformsCache;
  } catch (err) {
    console.error("❌ Failed to fetch uniforms:", err);
    _uniformsCache = null;
    throw err;
  }
}


export async function fetchUniformById(uniformId) {
  if (!uniformId) {
    console.warn("⚠️ fetchUniformById: No ID provided");
    return null;
  }

  try {
    const snap = await getDoc(doc(UniformsDB, uniformId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.error("❌ fetchUniformById error:", err);
    return null;
  }
}


export async function fetchEmployeeById(empId) {
  if (!empId) {
    console.warn("⚠️ fetchEmployeeById: Employee ID not provided");
    return null;
  }

  try {
    const snap = await getDoc(doc(EmployeesDB, empId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.error("❌ fetchEmployeeById error:", err);
    return null;
  }
}

export async function fetchInventoryWithOptionalSort() {
  try {
    const snap = await getDocs(query(InventoryDB, orderBy("UniformType")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("⚠️ orderBy('UniformType') failed, using fallback:", err?.message || err);
    const snap = await getDocs(InventoryDB);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

export async function validateUniformCode(code) {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return false;

  const snap = await getDocs(query(InventoryDB, where("UniformCode", "==", normalized)));
  return !snap.empty;
}

export async function assignUniformToEmployee(data) {
  const id = data.UniformCode?.trim().toUpperCase();
  if (!id) throw new Error("Missing UniformCode");

  if (!data.UniformID || !data.UniformType || !data.UniformSize || !data.UniformColor) {
    throw new Error("Missing base uniform info");
  }

  const payload = {
    UniformID:          data.UniformID,
    UniformType:        data.UniformType,
    UniformSize:        data.UniformSize,
    UniformColor:       data.UniformColor,
    UniformCode:        id, //
    UniformQty:         data.UniformQty  || 1,
    img:                data.img         || "",
    EmployeeID:         data.EmployeeID  || "",
    EmployeeName:       data.EmployeeName|| "",
    EmployeDepartment:  data.EmployeDepartment || "",
    Status:             data.Status      || "available",
    RewashCount:        typeof data.RewashCount === "number"
                          ? data.RewashCount
                          : 0
  };

  await setDoc(doc(InventoryDB, id), payload, { merge: true });
}


export async function assignFromAvailableCode(code, employeeData) {
  const normalizedCode = code?.trim().toUpperCase();
  if (!normalizedCode) throw new Error("Missing uniform code");

  const snap = await getDocs(query(
    InventoryDB,
    where("UniformCode", "==", normalizedCode),
    where("Status", "==", "available")
  ));

  if (snap.empty) {
    throw new Error("This code is either not found or already assigned.");
  }

  const ref = snap.docs[0].ref;

  await updateDoc(ref, {
    Status: "assigned",
    EmployeeID: employeeData.employeeId,
    EmployeeName: employeeData.employeeName,
    EmployeDepartment: employeeData.employeeDept
  });
}

export async function returnUniform(code) {
  const normalizedCode = code?.trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error("Invalid uniform code");
  }

  const snap = await getDocs(query(
    InventoryDB,
    where("UniformCode", "==", normalizedCode),
    where("Status", "==", "assigned")
  ));

  if (snap.empty) {
    throw new Error("Code not found or not currently assigned.");
  }

  const ref = snap.docs[0].ref;
  await updateDoc(ref, {
    Status: "available",
    EmployeeID: "",
    EmployeeName: "",
    EmployeDepartment: ""
  });
}

export async function deleteUniformEntry(code) {
  const normalizedCode = code?.trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error("Invalid uniform code");
  }

  const snap = await getDocs(query(InventoryDB, where("UniformCode", "==", normalizedCode)));

  if (snap.empty) {
    throw new Error("Uniform code not found in the system.");
  }

  const batchDeletes = snap.docs.map(docSnap => deleteDoc(docSnap.ref));
  await Promise.all(batchDeletes);
}

export async function updateUniformCode(code, payload = {}) {
  const normalizedCode = code?.trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error("Invalid Uniform Code");
  }

  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid payload: must be an object");
  }

  const snap = await getDocs(query(InventoryDB, where("UniformCode", "==", normalizedCode)));

  if (snap.empty) {
    throw new Error("Uniform code not found in the system.");
  }

  const updates = snap.docs.map(docSnap => updateDoc(docSnap.ref, payload));
  await Promise.all(updates); 
}

export async function getAllCodesByUniformID(uniformId) {
  const id = uniformId?.trim();
  if (!id) return [];

  try {
    const snap = await getDocs(query(InventoryDB, where("UniformID", "==", id)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("❌ getAllCodesByUniformID error:", err);
    return [];
  }
}


export async function getUniformCodeCountById(uniformId) {
  const id = uniformId?.trim();
  if (!id) return 0;

  try {
    const snap = await getDocs(query(InventoryDB, where("UniformID", "==", id)));
    return snap.size;
  } catch (err) {
    console.error("❌ getUniformCodeCountById error:", err);
    return 0;
  }
}

export async function getInventorySummary() {
  try {
    const ref = doc(db, "Stats", "InventorySummary");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.warn("⚠️ Inventory summary not found.");
      return { total: 0, assigned: 0, available: 0 };
    }

    return snap.data();
  } catch (err) {
    console.error("❌ Failed to get inventory summary:", err);
    return {
      total: 0,
      assigned: 0,
      available: 0
    };
  }
}
export async function fetchAllForExport() {
  try {
    const snap = await getDocs(InventoryDB);
    return snap.docs.map(d => d.data());
  } catch (err) {
    console.error("❌ Export Error:", err);
    return [];
  }
}

export function parseCSV(text) {
  const rows = text.trim().split("\n");
  const headers = rows[0].split(",").map(h => h.trim());
  return rows.slice(1).map(line => {
    const vals = line.split(",");
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i]?.trim() || "");
    return obj;
  });
}

export function exportCSV(dataArray, headers) {
  const csv   = [ headers.join(","), 
                  ...dataArray.map(row => 
                    headers.map(h => `"${row[h]||""}"`).join(",")
                  )
                ].join("\n");
  const blob  = new Blob([ "\uFEFF" + csv ], { type: "text/csv;charset=utf-8;" });
  return URL.createObjectURL(blob);
}

export async function getUniformIdByCode(code) {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return null;

  try {
    const q = query(InventoryDB, where("UniformCode", "==", normalized));
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data().UniformID;
  } catch (err) {
    console.error("❌ getUniformIdByCode Error:", err);
    return null;
  }
}


export const InventoryModel = {
  clearUniformCache,
  fetchUniforms,
  fetchUniformById,
  fetchEmployeeById,
  validateUniformCode,
  assignUniformToEmployee,
  assignFromAvailableCode,
  returnUniform,
  deleteUniformEntry,
  updateUniformCode,
  getAllCodesByUniformID,
  getUniformCodeCountById,
  getInventorySummary,
  fetchAllForExport,
  parseCSV,
  exportCSV,
  getUniformIdByCode,
  getAllEmployeesAsMap,
  getAllUniformsAsMap,
  fetchUniformCodeByCode,
  fetchInventoryItemsLimited,
  fetchInventoryItems,
  createInventorySummaryDoc,
  syncAllEmployeeDataToInventory
};



export async function getAllEmployeesAsMap() {
  const snap = await getDocs(EmployeeDB);
  const map = {};
  snap.docs.forEach(doc => map[doc.id] = { id: doc.id, ...doc.data() });
  return map;
}

export async function getAllUniformsAsMap() {
  const snap = await getDocs(UniformsDB);
  const map = {};
  snap.docs.forEach(doc => map[doc.id] = { id: doc.id, ...doc.data() });
  return map;
}

export async function fetchUniformCodeByCode(code) {
  const q = query(InventoryDB, where("UniformCode", "==", code.trim().toUpperCase()));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}


export async function fetchInventoryItemsLimited(count = 50) {
  const q = query(InventoryDB, orderBy("UniformCode"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function createInventorySummaryDoc() {
  try {
    const ref = doc(db, "Stats", "InventorySummary");
    await setDoc(ref, {
      total: 0,
      assigned: 0,
      available: 0,
      updatedAt: new Date().toISOString()
    });
    console.log("✅ InventorySummary document created.");
  } catch (err) {
    console.error("❌ Failed to create InventorySummary:", err);
  }
}

export async function fetchInventoryItems() {
  try {
    const snap = await getDocs(query(InventoryDB, orderBy("UniformType")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(InventoryDB);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

export async function syncAllEmployeeDataToInventory() {
  const empSnap = await getDocs(EmployeesDB);
  const employeeMap = {};
  empSnap.forEach(doc => {
    const data = doc.data();
    employeeMap[data.employeeId] = {
      name: data.employeeName,
      dept: data.employeeDept
    };
  });

  const invSnap = await getDocs(InventoryDB);
  const updates = [];

  for (const docSnap of invSnap.docs) {
    const item = docSnap.data();
    const emp = employeeMap[item.EmployeeID];
    if (emp && (item.EmployeeName !== emp.name || item.EmployeDepartment !== emp.dept)) {
      updates.push(updateDoc(docSnap.ref, {
        EmployeeName: emp.name,
        EmployeDepartment: emp.dept
      }));
    }
  }

  await Promise.all(updates);
  console.log("✅ Synced employee info to Inventory.");
}

