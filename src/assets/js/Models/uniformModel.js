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

// ============================ 🔧 CONFIG ============================
const COLLECTION_NAME = "UniformsDB";
const uniformCollection = collection(db, COLLECTION_NAME);

// ============================ 🔍 FETCH ============================
/**
 * ดึงข้อมูล Uniform ทั้งหมดจาก Firestore
 * - เรียงตาม uniformID (ถ้า orderBy ล้มเหลว → fallback เป็น client-side sort)
 * @returns {Promise<Array<Object>>} รายการยูนิฟอร์มทั้งหมด
 */
async function fetchAllUniforms() {
  try {
    const q = query(uniformCollection, orderBy("uniformID"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.warn("⚠️ orderBy ล้มเหลว → fallback เป็น client-side sort", e);
    const snapshot = await getDocs(uniformCollection);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return data.sort((a, b) =>
      (a.uniformID || "").localeCompare(b.uniformID || "")
    );
  }
}

/**
 * ดึงข้อมูลยูนิฟอร์มจาก Firestore ตาม document ID
 * @param {string} id - รหัส document (Firebase doc ID)
 * @returns {Promise<Object|null>} ข้อมูลยูนิฟอร์มหรือ null ถ้าไม่พบ
 */
async function fetchUniformById(id) {
  if (!id) throw new Error("⚠️ [fetchUniformById] ต้องระบุ Uniform ID");

  try {
    const ref = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.error(`❌ [fetchUniformById] ดึงข้อมูลล้มเหลว (ID: ${id})`, error);
    throw error;
  }
}

// ============================ ➕ CREATE ============================
/**
 * เพิ่มยูนิฟอร์มใหม่ลง Firestore
 * - ถ้า ID ซ้ำจะไม่อนุญาตให้เพิ่ม
 * @param {Object} data - ข้อมูลยูนิฟอร์ม
 */
async function createUniform(data) {
  const id = data.uniformID?.trim();
  if (!id) throw new Error("⚠️ [createUniform] ต้องระบุ Uniform ID");

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const existing = await getDoc(docRef);

    if (existing.exists()) {
      throw new Error(`⚠️ ยูนิฟอร์มรหัส ${id} มีอยู่แล้ว`);
    }

    await setDoc(docRef, data);
  } catch (error) {
    console.error(
      `❌ [createUniform] เพิ่มยูนิฟอร์มล้มเหลว (ID: ${id})`,
      error
    );
    throw error;
  }
}

// ============================ ✏️ UPDATE ============================
/**
 * อัปเดตข้อมูลยูนิฟอร์มจาก ID
 * - ถ้าไม่พบเอกสารจะโยน Error
 * @param {string} id - รหัส Uniform (Document ID)
 * @param {Object} data - ข้อมูลใหม่ที่จะอัปเดต
 */
async function updateUniform(id, data) {
  if (!id) throw new Error("⚠️ ต้องระบุ Uniform ID เพื่ออัปเดต");

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const existing = await getDoc(docRef);

    if (!existing.exists()) {
      throw new Error(`❌ ไม่พบยูนิฟอร์มที่มี ID: ${id}`);
    }

    await updateDoc(docRef, data);
  } catch (error) {
    console.error(`❌ [updateUniform] อัปเดตล้มเหลว (ID: ${id})`, error);
    throw error;
  }
}

// ============================ 🗑️ DELETE ============================
/**
 * ลบยูนิฟอร์มจาก Firestore โดยใช้รหัส ID
 * - ถ้าไม่พบเอกสาร จะโยน Error
 * @param {string} id - รหัสเอกสารยูนิฟอร์ม (Document ID)
 */
async function deleteUniform(id) {
  if (!id) throw new Error("⚠️ กรุณาระบุ Uniform ID สำหรับการลบ");

  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error(`❌ ไม่พบยูนิฟอร์มที่มี ID: ${id}`);
    }

    await deleteDoc(docRef);
  } catch (error) {
    console.error(`❌ [deleteUniform] ลบไม่สำเร็จ (ID: ${id})`, error);
    throw error;
  }
}

// ============================ 📤 EXPORT CSV ============================
/**
 * แปลงข้อมูล Array ของ Object ให้กลายเป็นไฟล์ CSV แล้วส่งกลับ URL สำหรับดาวน์โหลด
 * - รองรับ UTF-8 (BOM) เพื่อเปิดใน Excel ได้ไม่เพี้ยน
 * @param {Array<Object>} dataArray - ข้อมูลที่ต้องการ export
 * @param {Array<string>} headers - รายชื่อคอลัมน์ที่ต้องการ export
 * @returns {string} Blob URL สำหรับดาวน์โหลด
 */
function exportCSV(dataArray, headers) {
  // ✅ ตรวจสอบว่า headers เป็น array ของ string
  if (!Array.isArray(headers) || headers.some((h) => typeof h !== "string")) {
    throw new Error("❌ Headers ต้องเป็น array ของ string เท่านั้น");
  }

  // ✅ สร้างแถวแรกของไฟล์ CSV (Header)
  const csvRows = [headers.join(",")];

  // ✅ แปลงแต่ละ Object ใน dataArray ให้กลายเป็นแถว CSV
  for (const row of dataArray) {
    const line = headers.map((h) => `"${row[h] ?? ""}"`).join(",");
    csvRows.push(line);
  }
}
  // ============================ 📥 PARSE CSV ============================
  /**
   * แปลงข้อความ CSV เป็น Array ของ Object
   * หมายเหตุ: ไม่รองรับกรณีที่มี , อยู่ภายในเครื่องหมาย ""
   * @param {string} csvText - ข้อความ CSV (header อยู่บรรทัดแรก)
   * @returns {Array<Object>} - ข้อมูลแบบ Array ของ Object
   */
  function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
  
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = values[i];
      });
      return obj;
    });

    // 🔹 แปลงข้อมูลแต่ละบรรทัดเป็น Object ตาม header
    return rows.slice(1).map((line) => {
      const values = line
        .split(",")
        .map((cell) => cell.replace(/(^"|"$)/g, "").trim());

      const obj = {};
      headers.forEach((key, i) => {
        obj[key] = values[i] ?? "";
      });
      return obj;
    });
  } 


// ============================ 🧪 VALIDATION - UNIFORM ============================
/**
 * ตรวจสอบความถูกต้องของข้อมูล Uniform
 * - ต้องมี: uniformID, uniformType, uniformSize, uniformColor
 * - Qty ต้องเป็นตัวเลขจำนวนเต็ม >= 0
 * @param {Object} u - ข้อมูลยูนิฟอร์ม
 * @returns {boolean} - true = valid, false = invalid
 */
function isValidUniform(u) {
  if (!u || typeof u !== "object") return false;

  const { uniformID, uniformType, uniformSize, uniformColor, uniformQty } = u;

  const qty = parseInt(uniformQty ?? "0", 10);

  return (
    typeof uniformID === "string" &&
    uniformID.trim() !== "" &&
    typeof uniformType === "string" &&
    uniformType.trim() !== "" &&
    typeof uniformSize === "string" &&
    uniformSize.trim() !== "" &&
    typeof uniformColor === "string" &&
    uniformColor.trim() !== "" &&
    !isNaN(qty) &&
    qty >= 0
  );
}

// ============================ 📷 IMAGE BASE64 UTILS ============================
/**
 * แปลงไฟล์ภาพเป็น Base64 data URL
 * ใช้สำหรับแสดง Preview หรือเก็บภาพในฐานข้อมูล
 * @param {File} file - ไฟล์ภาพที่ผู้ใช้เลือก
 * @returns {Promise<string>} - ข้อมูล base64 ของภาพ
 */
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

// ============================ 📦 EXPORT: UNIFORM MODEL ============================

export const UniformModel = {
  fetchAllUniforms, // 🔍 ดึง Uniform ทั้งหมด
  fetchUniformById, // 🔍 ดึง Uniform ตาม ID
  createUniform, // ➕ เพิ่ม Uniform ใหม่
  updateUniform, // ✏️ อัปเดต Uniform ที่มีอยู่
  deleteUniform, // 🗑️ ลบ Uniform
  parseCSV, // 📥 แปลงข้อความ CSV เป็นอาร์เรย์ Object
  exportCSV, // 📤 แปลงข้อมูลเป็น CSV Blob URL
  isValidUniform, // ✅ ตรวจสอบความถูกต้องของข้อมูล Uniform
  toBase64, // 📷 แปลงรูปภาพเป็น Base64
};
