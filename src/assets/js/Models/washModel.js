import { db } from "@config/firebaseConfig.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  getDoc,
  query,
  where,
  addDoc,
  increment,
  deleteField,
} from "firebase/firestore";

/* ============================== 🔧 COLLECTION NAMES ============================== */
const COLLECTIONS = {
  WASH: "WashJobs",
  HISTORY: "WashHistory",
  INVENTORY: "InventoryDB",
  EMPLOYEE: "EmployeesDB",
  UNIFORMS: "UniformsDB",
};

// ============================== 🧺 WASH JOBS ==============================

/**
 * ดึงรายการ Wash ทั้งหมดจาก Firestore
 * @returns {Promise<Array>} ข้อมูล Wash ทั้งหมดในรูปแบบ Array
 */
export async function getAllWashes() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.WASH));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("❌ [getAllWashes] ไม่สามารถดึงข้อมูลได้:", error);
    return [];
  }
}

/**
 * ดึง Wash รายการเดียวจาก ID
 * @param {string} id - รหัสเอกสาร Wash
 * @returns {Promise<Object|null>} ข้อมูล Wash หรือ null ถ้าไม่พบ
 */
export async function getWashJobById(id) {
  try {
    const ref = doc(db, COLLECTIONS.WASH, id);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.error(`❌ [getWashJobById] ไม่พบ ID: ${id}`, error);
    return null;
  }
}

/**
 * เพิ่มหรืออัปเดต Wash Job
 * @param {Object} data - ข้อมูลที่จะบันทึก
 * @param {string|null} id - ถ้าใส่ id จะเป็นการอัปเดต
 * @returns {Promise<string>} รหัสเอกสารที่บันทึก
 */
export async function addWashJob(data, id = null) {
  try {
    const docId = id || data?.washId;

    if (typeof docId === "string" && docId.trim() !== "") {
      const docRef = doc(db, COLLECTIONS.WASH, docId);
      await setDoc(docRef, data);
      return docId;
    }

    const autoRef = await addDoc(collection(db, COLLECTIONS.WASH), data);
    return autoRef.id;

  } catch (error) {
    console.error("❌ [addWashJob] ไม่สามารถเพิ่มหรืออัปเดตได้:", error);
    throw error;
  }
}

/**
 * อัปเดตข้อมูล Wash Job
 * @param {string} id - รหัสเอกสาร
 * @param {Object} data - ข้อมูลใหม่ที่จะอัปเดต
 */
export async function updateWashJob(id, data) {
  try {
    await updateDoc(doc(db, COLLECTIONS.WASH, id), data);
  } catch (error) {
    console.error(`❌ [updateWashJob] อัปเดตไม่สำเร็จ: ${id}`, error);
    throw error;
  }
}

/**
 * ลบ Wash Job ตาม ID
 * @param {string} id - รหัสเอกสาร
 */
export async function deleteWashJob(id) {
  try {
    await deleteDoc(doc(db, COLLECTIONS.WASH, id));
  } catch (error) {
    console.error(`❌ [deleteWashJob] ลบไม่สำเร็จ: ${id}`, error);
    throw error;
  }
}


// ============================== 🧾 WASH HISTORY ==============================

/**
 * ดึงรายการประวัติการซักทั้งหมดจาก Firestore
 * @returns {Promise<Array>} ข้อมูล History ทั้งหมดในรูปแบบ Array
 */
export async function getAllWashHistory() {
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.HISTORY));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("❌ [getAllWashHistory] ไม่สามารถดึงข้อมูลได้:", error);
    return [];
  }
}

/**
 * เพิ่มข้อมูลเข้าสู่ประวัติการซัก
 * @param {Object} data - ข้อมูลที่ต้องการบันทึก
 * @param {string|null} id - ถ้าใส่ id จะเป็นการกำหนด ID เอง
 * @returns {Promise<string>} รหัสเอกสารที่ถูกบันทึก
 */
export async function addToWashHistory(data, id = null) {
  try {
    if (!data || typeof data !== "object") {
      throw new Error("ข้อมูลที่ส่งมาไม่ถูกต้อง");
    }

    const ref = collection(db, COLLECTIONS.HISTORY);

    if (id) {
      const docRef = doc(ref, id);
      await setDoc(docRef, {
        ...data,
        createdAt: data.createdAt || new Date().toISOString(),
      });
      return id;
    } else {
      const docRef = await addDoc(ref, {
        ...data,
        createdAt: data.createdAt || new Date().toISOString(),
      });
      return docRef.id;
    }

  } catch (error) {
    console.error("❌ [addToWashHistory] เพิ่มประวัติการซักไม่สำเร็จ:", error);
    throw error;
  }
}



// ============================== 👕 INVENTORY (UNIFORM CODE) ==============================

/**
 * ดึงข้อมูล Uniform จากรหัสและสี
 * @param {string} code - รหัส UniformCode
 * @param {string|null} color - สีของยูนิฟอร์ม (ไม่ระบุก็ได้)
 * @returns {Promise<Array>} รายการยูนิฟอร์มที่ตรงเงื่อนไข
 */
export async function getUniformByCode(code, color = null) {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.INVENTORY));
    let uniforms = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));

    uniforms = uniforms.filter(u =>
      String(u.UniformCode || "").toLowerCase().includes(code.toLowerCase())
    );

    if (color) {
      uniforms = uniforms.filter(u => u.UniformColor === color);
    }

    return uniforms;
  } catch (error) {
    console.error("❌ [getUniformByCode] Failed:", error);
    return [];
  }
}

/**
 * ดึงจำนวนการซักซ้ำจาก UniformCode
 */
export async function getRewashCount(uniformCode, color) {
  const uniforms = await getUniformByCode(uniformCode, color);
  return uniforms.length > 0 ? uniforms[0].RewashCount || 0 : 0;
}

/**
 * ตั้งค่า RewashCount แบบกำหนดเอง
 */
export async function setRewashCount(code, color, count) {
  const uniforms = await getUniformByCode(code, color);
  if (uniforms.length === 0) return;

  const docId = uniforms[0].id;
  await updateDoc(doc(db, COLLECTIONS.INVENTORY, docId), {
    RewashCount: count,
  });
}

/**
 * เพิ่มค่า RewashCount ทีละ 1
 */
export async function incrementRewashCount(uniformCode, color) {
  const uniforms = await getUniformByCode(uniformCode, color);
  if (uniforms.length === 0) return;

  await updateDoc(doc(db, COLLECTIONS.INVENTORY, uniforms[0].id), {
    RewashCount: increment(1),
  });
}

/**
 * เปลี่ยนสถานะยูนิฟอร์มเป็น scrap
 */
export async function scrapUniform(uniformCode, color) {
  const uniforms = await getUniformByCode(uniformCode, color);
  if (uniforms.length === 0) return;

  const docId = uniforms[0].id;
  await updateDoc(doc(db, COLLECTIONS.INVENTORY, docId), {
    Status: "scrap",
    usageStatus: "scrap",
    "status.assign": deleteField(),
    "status.washing": deleteField(),
  });
}


/**
 * คืนยูนิฟอร์มหลังจาก ESD Test เสร็จ
 */
export async function returnToStockAfterESD(washData) {
  try {
    const uniforms = await getUniformByCode(washData.uniformCode, washData.color);
    if (uniforms.length === 0) {
      console.warn("⚠️ [returnToStockAfterESD] ไม่พบ Uniform ที่ต้องการอัปเดต");
      return;
    }

    const docId = uniforms[0].id;
    const current = uniforms[0];

    let newStatus = current.Status || "available";

    if (washData.status === "ESD Failed") {
      const count = (washData.rewashCount || 0) + 1;
      newStatus = `Rewash #${count}`;
    } else if (washData.status === "ESD Passed") {
      newStatus = "available"; // ✅ ผ่าน ESD → available
    }

    await updateDoc(doc(db, COLLECTIONS.INVENTORY, docId), {
      Status: newStatus,
      usageStatus: newStatus === "available" ? "available" : "in-use",
    });

  } catch (error) {
    console.error("❌ [returnToStockAfterESD] error:", error);
    throw error;
  }
}

// ============================== 👤 EMPLOYEES ==============================ห
/**
 * ดึงข้อมูลพนักงานจาก UniformCode และสี
 * ใช้ค้นจาก InventoryDB
 * @param {string} uniformCode
 * @param {string} color
 * @returns {Promise<{EmployeeID: string, EmployeeName: string} | null>}
 */
export async function getEmployeeByUniform(uniformCode, color) {
  const uniforms = await getUniformByCode(uniformCode, color);
  if (uniforms.length === 0) return null;

  const { EmployeeID, EmployeeName } = uniforms[0];
  return { EmployeeID, EmployeeName };
}

/**
 * ดึงข้อมูลพนักงานจากรหัสพนักงาน (EmployeeID)
 * @param {string} empId
 * @returns {Promise<Object|null>}
 */
export async function getEmployeeById(empId) {
  try {
    const ref = doc(db, COLLECTIONS.EMPLOYEE, empId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error("❌ getEmployeeById error:", error);
    return null;
  }
}