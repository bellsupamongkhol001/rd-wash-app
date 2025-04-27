
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
  orderBy,
} from "firebase/firestore";

const COLLECTION_NAME = "EmployeesDB";
const employeeCollection = collection(db, COLLECTION_NAME);

// ============================== 🔄 CRUD ==============================

/**
 * ดึงข้อมูลพนักงานทั้งหมด (เรียงตามชื่อ)
 * @returns {Promise<Array>} รายการพนักงานทั้งหมด
 */
async function fetchAllEmployees() {
  const q = query(employeeCollection, orderBy("employeeName"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * ดึงข้อมูลพนักงานตามรหัส ID
 * @param {string} employeeId - รหัสพนักงาน
 * @returns {Promise<Object|null>} ข้อมูลพนักงาน หรือ null ถ้าไม่พบ
 */
export async function fetchEmployeeById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, "EmployeesDB", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}


/**
 * สร้างข้อมูลพนักงานใหม่ (ใช้ ID ที่กรอกเป็น doc ID)
 * @param {Object} employeeData - ข้อมูลพนักงานใหม่
 */
export async function createEmployee(data) {
  const docRef = doc(db, "EmployeesDB", data.employeeId);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    throw new Error(`Employee ID ${data.employeeId} already exists`);
  }
  await setDoc(docRef, data);
}


/**
 * อัปเดตข้อมูลพนักงานจากรหัส
 * @param {string} employeeId - รหัสพนักงานที่ต้องการอัปเดต
 * @param {Object} updateData - ข้อมูลใหม่ที่จะอัปเดต
 */
async function updateEmployee(employeeId, updateData) {
  if (!employeeId) throw new Error("⚠️ Employee ID is required for update");
  await updateDoc(doc(db, COLLECTION_NAME, employeeId), updateData);
}

/**
 * ลบข้อมูลพนักงานจากรหัส
 * @param {string} employeeId - รหัสพนักงานที่ต้องการลบ
 */
async function deleteEmployee(employeeId) {
  if (!employeeId) throw new Error("⚠️ Employee ID is required for deletion");
  await deleteDoc(doc(db, COLLECTION_NAME, employeeId));
}

// ============================== 🖼️ IMAGE UTILS ==============================

/**
 * แปลงไฟล์รูปภาพเป็น Base64 (Data URL)
 * ใช้สำหรับจัดเก็บรูปพนักงานใน Firestore โดยไม่ใช้ Firebase Storage
 * 
 * @param {File} file - ไฟล์ภาพที่ผู้ใช้เลือก
 * @returns {Promise<string>} ค่า Base64 string ที่พร้อมใช้งาน
 */
async function convertImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

// ============================== 📑 CSV PARSER ==============================

/**
 * แปลงข้อความ CSV เป็น Array ของออบเจกต์พนักงาน
 * รองรับ header: employeeId, employeeName, employeeDept
 *
 * @param {string} csvText - ข้อมูล CSV ทั้งหมดเป็นข้อความ
 * @returns {Array<Object>} รายการพนักงานที่แปลงแล้ว
 */
function parseCSV(csvText) {
  const rows = csvText.trim().split("\n");
  const headers = rows[0].split(",").map((h) => h.trim().toLowerCase());

  return rows.slice(1).map((line) => {
    const values = line.split(",");
    const employee = {};

    headers.forEach((header, i) => {
      const value = values[i]?.trim() ?? "";

      switch (header) {
        case "employeeid":
          employee.employeeId = value;
          break;
        case "employeename":
          employee.employeeName = value;
          break;
        case "employeedept":
          employee.employeeDept = value;
          break;
      }
    });

    return employee;
  });
}


// ============================== ✅ VALIDATION ==============================

/**
 * ตรวจสอบความถูกต้องของข้อมูลพนักงาน
 * - ต้องมี employeeId, employeeName, และ employeeDept
 *
 * @param {Object} emp - ข้อมูลพนักงาน
 * @returns {boolean} ผลลัพธ์ว่าข้อมูลถูกต้องหรือไม่
 */
function isValidEmployee(emp) {
  return (
    Boolean(emp?.employeeId?.trim()) &&
    Boolean(emp?.employeeName?.trim()) &&
    Boolean(emp?.employeeDept?.trim())
  );
}

// ============================== 📦 EMPLOYEE MODEL ==============================
/**
 * รวมฟังก์ชันทั้งหมดเกี่ยวกับพนักงาน
 * - ดึง / เพิ่ม / แก้ไข / ลบ
 * - แปลงภาพเป็น Base64
 * - Import/Export CSV
 * - ตรวจสอบความถูกต้องของข้อมูล
 */

export const EmployeeModel = {
  fetchAllEmployees,
  fetchEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  parseCSV,
  convertImageToBase64,
  isValidEmployee,
};

