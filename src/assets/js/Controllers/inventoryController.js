import { InventoryModel,syncAllEmployeeDataToInventory } from "../Models/inventoryModel.js";
import { InventoryView } from "../Views/inventoryView.js";
import { debounce } from "../Utils/globalUtils.js";

import { db } from "@config/firebaseConfig.js";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";
const InventoryDB = collection(db, "InventoryDB");

let allInventory = [];
let allUniforms  = [];
let selectedUniform = null;
let allCodesCache = new Set();

export async function initInventoryPage() {
  try {
    InventoryView.setFormLoading?.(true);
    await loadUniforms();
    InventoryView.renderUniformBaseCards(allUniforms);
    await watchInventory();
    setupEvents();
  } catch (err) {
    console.error("❌ InventoryPage Error:", err);
    Swal.fire({
      icon: "error",
      title: "An error occurred",
      text: err.message || "Failed to load inventory data",
    });
  } finally {
    InventoryView.setFormLoading?.(false);
  }
}


async function watchInventory() {
  try {
    const q = query(InventoryDB, orderBy("UniformCode"), limit(100));
    const snapshot = await getDocs(q);

    allInventory = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    allCodesCache = new Set(allInventory.map(i => i.UniformCode));

    InventoryView.renderInventoryCards?.(allInventory);

  } catch (err) {
    console.error("❌ Error loading inventory data: ", err);
    Swal.fire({
      icon: "error",
      title: "Failed to load data",
      text: err.message || "Could not load Inventory data",
    });
  }
}

export function codeExists(code) {
  return allCodesCache.has(code);
}

async function loadUniforms() {
  try {
    const uniforms = await InventoryModel.fetchUniforms();
    if (!Array.isArray(uniforms)) {
      console.warn("⚠️ Uniform data is not an array:", uniforms);
      allUniforms = [];
      return;
    }
    allUniforms = uniforms;
  } catch (err) {
    console.error("❌ Failed to load uniforms:", err);
    allUniforms = [];
  }
}

function bindSearchEvent() {
  const searchInput = document.getElementById("searchByUniformAndEmployee");
  if (!searchInput) return;

  searchInput.addEventListener("input", debounce((e) => {
    const keyword = e.target.value.trim().toLowerCase();
    if (!keyword || !Array.isArray(allInventory)) {
      InventoryView.renderInventoryCards(allInventory);
      return;
    }

    const filtered = allInventory.filter(item =>
      item.UniformID?.toLowerCase().includes(keyword) ||
      item.UniformCode?.toLowerCase().includes(keyword) ||
      item.EmployeeName?.toLowerCase().includes(keyword)
    );

    InventoryView.renderInventoryCards(filtered);
  }, 300));
}

function bindImportEvent() {
  const btn = document.getElementById("btnImportReport");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";

    input.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const records = InventoryModel.parseCSV(text);

        if (!Array.isArray(records) || records.length === 0) {
          return Swal.fire({ icon: "warning", title: "No data in the CSV file" });
        }

        const allEmployees = await InventoryModel.getAllEmployeesAsMap();
        const allUniforms  = await InventoryModel.getAllUniformsAsMap();

        const valid = [];

        for (const r of records) {
          const emp     = allEmployees[r.EmployeeID];
          const uniform = allUniforms[r.UniformID];
          if (emp && uniform) {
            valid.push({
              UniformID: uniform.uniformID || uniform.id || "",
              UniformCode: r.UniformCode,
              UniformType: uniform.uniformType || "",
              UniformSize: uniform.uniformSize || "",
              UniformColor: uniform.uniformColor || "",
              UniformQty: 1,
              img: uniform.img || "",
              EmployeeID: emp.employeeId,
              EmployeeName: emp.employeeName,
              EmployeeDepartment: emp.employeeDept,
              Status: "assigned",
              RewashCount: 0,
            });
          }
        }

        if (valid.length === 0) {
          return Swal.fire({
            icon: "warning",
            title: "Import Failed",
            text: "No valid data found",
          });
        }

        InventoryView.previewImportData(valid, async () => {
          for (const v of valid) {
            await InventoryModel.assignUniformToEmployee(v);
          }
          await reload();
          Swal.fire({
            icon: "success",
            title: "Import successful",
            timer: 1500,
            showConfirmButton: false,
          });
        });

      } catch (err) {
        console.error("❌ CSV Import Error:", err);
        Swal.fire({
          icon: "error",
          title: "An error occurred",
          text: err.message || "Unable to import data",
        });
      }
    });

    input.click();
  });
}


function bindAssignSubmit() {
  const form = document.getElementById("assignForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const empId = document.getElementById("assignEmployeeId")?.value.trim();
    const code = document.getElementById("assignUniformCode")?.value.trim().toUpperCase();

    if (!empId || !code) {
      return Swal.fire({ icon: "warning", title: "Incomplete data" });
    }

    try {
      const emp = await InventoryModel.fetchEmployeeById(empId);
      if (!emp) {
        return Swal.fire({ icon: "error", title: "Employee not found" });
      }

      const target = await InventoryModel.fetchUniformCodeByCode(code);

      if (!target) {
        return Swal.fire({ icon: "error", title: "Uniform code not found" });
      }

      if (target.Status !== "available") {
        return Swal.fire({ icon: "warning", title: "This code is already assigned" });
      }

      await InventoryModel.assignFromAvailableCode(code, {
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        employeeDept: emp.employeeDept,
      });

      InventoryView.toggleModal("assignModal", false);
      await InventoryView.reloadDetailModal(target.UniformID);
      await refreshItemInView(code);

      Swal.fire({
        icon: "success",
        title: "Assignment successful",
        timer: 1500,
        showConfirmButton: false
      });

    } catch (err) {
      console.error("❌ Assign Error:", err);
      Swal.fire({ icon: "error", title: "An error occurred", text: err.message });
    }
  });
}

function bindAddCodeSubmit() {
  const form = document.getElementById("codeForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const uniformId = document.getElementById("addCodeUniformId")?.value;
    const codeInput = document.getElementById("addUniformCode")?.value;

    const code = codeInput?.trim().toUpperCase();

    if (!uniformId || !code) {
      return Swal.fire({ icon: "warning", title: "Incomplete data" });
    }

    if (allCodesCache.has(code)) {
      return Swal.fire({
        icon: "warning",
        title: "Duplicate Code",
        text: "Please use a different code",
      });
    }

    try {
      const base = await InventoryModel.fetchUniformById(uniformId);
      if (!base) {
        return Swal.fire({ icon: "error", title: "Uniform not found" });
      }

      await InventoryModel.assignUniformToEmployee({
        UniformID: base.uniformID || base.id || "",
        UniformType: base.uniformType || "",
        UniformSize: base.uniformSize || "",
        UniformColor: base.uniformColor || "",
        UniformCode: code,
        UniformQty: base.qty || 1,
        img: base.img || "",
        EmployeeID: "",
        EmployeeName: "",
        EmployeeDepartment: "",
        Status: "available",
        RewashCount: 0,
      });

      Swal.fire({
        icon: "success",
        title: "Code added successfully",
        timer: 1500,
        showConfirmButton: false,
      });

      InventoryView.toggleModal("codeModal", false);
      await InventoryView.reloadDetailModal(base.uniformID);
      await refreshItemInView(code);

    } catch (err) {
      console.error("❌ Add Code Error:", err);
      Swal.fire({
        icon: "error",
        title: "An error occurred",
        text: err.message || "Unable to add the code",
      });
    }
  });
}

function bindAutoFillEmployee() {
  const input = document.getElementById("assignEmployeeId");
  const nameEl = document.getElementById("assignEmployeeName");

  if (!input || !nameEl) return;

  const empCache = {};

  input.addEventListener("blur", async () => {
    const empId = input.value.trim();
    if (!empId) {
      nameEl.value = "";
      return;
    }

    if (empCache[empId]) {
      nameEl.value = empCache[empId].employeeName || "";
      return;
    }

    try {
      const emp = await InventoryModel.fetchEmployeeById(empId);
      if (emp) {
        empCache[empId] = emp;
        nameEl.value = emp.employeeName || "";
      } else {
        nameEl.value = "";
      }
    } catch (err) {
      console.error("❌ AutoFill Error:", err);
      nameEl.value = "";
    }
  });
}

function bindInlineUpdateCode() {
  window.updateCodeInline = async (el, oldCode) => {
    const newCode = el.textContent.trim().toUpperCase();

    if (!newCode || newCode === oldCode.toUpperCase()) return;

    if (allCodesCache.has(newCode)) {
      Swal.fire({
        icon: "warning",
        title: "This code is already in use",
        text: "Please use a different code",
      });
      el.textContent = oldCode;
      return;
    }

    const confirm = await Swal.fire({
      title: "Confirm change of code?",
      text: `${oldCode} → ${newCode}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Confirm"
    });

    if (!confirm.isConfirmed) {
      el.textContent = oldCode;
      return;
    }

    try {
      await InventoryModel.updateUniformCode(oldCode, { UniformCode: newCode });

      allCodesCache.delete(oldCode.toUpperCase());
      allCodesCache.add(newCode);

      Swal.fire({
        icon: "success",
        title: "Code updated successfully",
        timer: 1200,
        showConfirmButton: false
      });

      await refreshItemInView(code);
    } catch (err) {
      console.error("❌ Update Code Error:", err);
      Swal.fire({
        icon: "error",
        title: "An error occurred",
        text: err.message || "Unable to update the code",
      });
      el.textContent = oldCode;
    }
  };
}

function bindAssignFromAvailableCode() {
  window.openAssignFromCode = async (code = "") => {
    const searchCode = code.trim().toUpperCase();
    if (!searchCode) {
      Swal.fire({ icon: "warning", title: "Invalid code" });
      return;
    }

    try {
      // ✅ Fetch the item data directly from Firestore
      const item = await InventoryModel.fetchUniformCodeByCode(searchCode);

      // ❌ Code not found or already in use
      if (!item || item.Status !== "available") {
        Swal.fire({
          icon: "warning",
          title: "Code not found or already in use",
          text: searchCode
        });
        return;
      }

      selectedUniform = item;
      InventoryView.prepareAssignForm(item);

      const codeEl = document.getElementById("assignUniformCode");
      if (codeEl) codeEl.value = item.UniformCode;

      InventoryView.toggleModal("assignModal", true);
      
    } catch (err) {
      console.error("❌ openAssignFromCode Error:", err);
      Swal.fire({
        icon: "error",
        title: "An error occurred",
        text: err.message || "Unable to open the Assign form",
      });
    }
  };
}

async function handleAddCodeClick(e) {
  const uniformId = e?.detail?.id;
  if (!uniformId) {
    Swal.fire({ icon: "warning", title: "Uniform ID not found" });
    return;
  }

  try {
    const base = await InventoryModel.fetchUniformById(uniformId);
    if (!base) {
      return Swal.fire({ icon: "error", title: "Uniform data not found" });
    }

    selectedUniform = base;

    const inputId   = document.getElementById("addCodeUniformId");
    const inputCode = document.getElementById("addUniformCode");

    if (inputId)   inputId.value = base.uniformID || base.id || "";
    if (inputCode) inputCode.value = "";

    InventoryView.toggleModal("codeModal", true);
    
  } catch (err) {
    console.error("❌ handleAddCodeClick Error:", err);
    Swal.fire({
      icon: "error",
      title: "An error occurred",
      text: err.message || "Unable to open the add code form",
    });
  }
}

async function handleDetailClick(e) {
  const uniformId = e?.detail?.id;
  if (!uniformId) {
    Swal.fire({ icon: "warning", title: "ไม่พบรหัสยูนิฟอร์ม" });
    return;
  }

  try {
    await InventoryView.reloadDetailModal(uniformId);

    InventoryView.toggleModal("codeListModal", true);

  } catch (err) {
    console.error("❌ handleDetailClick Error:", err);
    Swal.fire({
      icon: "error",
      title: "ไม่สามารถโหลดรายละเอียดได้",
      text: err.message || "เกิดข้อผิดพลาด",
    });
  }
}

window.returnUniformByCode = async (code = "") => {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return;

  const confirm = await Swal.fire({
    title: "Return uniform?",
    text:  `Are you sure you want to return code: ${normalizedCode}?`,
    icon:  "question",
    showCancelButton: true,
    confirmButtonText: "Confirm"
  });

  if (!confirm.isConfirmed) return;

  try {
    await InventoryModel.returnUniform(normalizedCode);

    // ✅ Use cache if available, or query just one document
    const uniformId = await InventoryModel.getUniformIdByCode(normalizedCode);
    if (!uniformId) {
      return Swal.fire({ icon: "error", title: "UniformID not found" });
    }

    await InventoryView.reloadDetailModal(uniformId);
    Swal.fire({
      icon: "success",
      title: "Uniform returned successfully!",
      timer: 1500,
      showConfirmButton: false
    });

  } catch (err) {
    console.error("❌ RETURN ERROR:", err);
    Swal.fire({
      icon: "error",
      title: "An error occurred",
      text: err.message || "Unable to return the uniform",
    });
  }
};

window.confirmDeleteUniform = async (code = "") => {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return;

  const confirm = await Swal.fire({
    title: "Delete this item?",
    text:  `Are you sure you want to delete code: ${normalizedCode}?`,
    icon:  "warning",
    showCancelButton: true,
    confirmButtonText: "Confirm",
    cancelButtonText: "Cancel"
  });

  if (!confirm.isConfirmed) return;

  try {
    const uniformId = await InventoryModel.getUniformIdByCode(normalizedCode);
    if (!uniformId) {
      return Swal.fire({
        icon: "error",
        title: "UniformID not found"
      });
    }

    await InventoryModel.deleteUniformEntry(normalizedCode);

    await InventoryView.reloadDetailModal(uniformId);

    Swal.fire({
      icon: "success",
      title: "Code deleted successfully!",
      timer: 1500,
      showConfirmButton: false
    });

  } catch (err) {
    console.error("❌ DELETE ERROR:", err);
    Swal.fire({
      icon: "error",
      title: "An error occurred",
      text: err.message || "Unable to delete this code",
    });
  }
};



window.closeAssignModal   = () => InventoryView.toggleModal("assignModal", false);
window.closeCodeListModal = () => InventoryView.toggleModal("codeListModal", false);
window.closeAddCodeModal  = () => InventoryView.toggleModal("codeModal", false);

async function handleImportCodeClick(e) {
  const uniformId = e?.detail?.id;
  if (!uniformId) return;

  try {
    const base = await InventoryModel.fetchUniformById(uniformId);
    if (!base) {
      return Swal.fire({
        icon: "error",
        title: "Uniform data not found",
      });
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";

    input.addEventListener("change", async (evt) => {
      const file = evt.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const records = InventoryModel.parseCSV(text);

        const filtered = records
          .map(r => r.UniformCode?.trim().toUpperCase())
          .filter(code => !!code);

        if (filtered.length === 0) {
          return Swal.fire({
            icon: "warning",
            title: "No data",
            text: "The file must contain at least one UniformCode column",
          });
        }

        const previewHtml = filtered.map(code => `<tr><td>${code}</td></tr>`).join("");
        const result = await Swal.fire({
          title: `📥 Import Codes to ${base.uniformID}`,
          html: ` 
            <table border="1" style="width:100%;font-size:0.9rem">
              <thead><tr><th>Code</th></tr></thead>
              <tbody>${previewHtml}</tbody>
            </table>`,
          showCancelButton: true,
          confirmButtonText: "Import",
        });

        if (!result.isConfirmed) return;

        let imported = 0;
        let duplicates = 0;

        for (const code of filtered) {
          if (allCodesCache.has(code)) {
            duplicates++;
            continue;
          }

          await InventoryModel.assignUniformToEmployee({
            UniformID: base.uniformID,
            UniformType: base.uniformType,
            UniformSize: base.uniformSize,
            UniformColor: base.uniformColor,
            UniformQty: 1,
            UniformCode: code,
            img: base.img || "",
            EmployeeID: "",
            EmployeeName: "",
            EmployeeDepartment: "",
            Status: "available",
            RewashCount: 0
          });

          allCodesCache.add(code);
          imported++;
        }

        await InventoryView.reloadDetailModal(base.uniformID);
        Swal.fire({
          icon: "success",
          title: "Import Complete",
          html: `✅ Imported: ${imported}<br>⚠️ Duplicates skipped: ${duplicates}`
        });

      } catch (err) {
        console.error("❌ CSV Import Error:", err);
        Swal.fire({
          icon: "error",
          title: "An error occurred",
          text: err.message || "Unable to import data",
        });
      }
    });

    input.click();

  } catch (err) {
    console.error("❌ handleImportCodeClick Error:", err);
    Swal.fire({
      icon: "error",
      title: "Unable to load data",
      text: err.message || "An error occurred",
    });
  }
}

async function reload() {
  try {
    if (!allUniforms || allUniforms.length === 0) {
      await loadUniforms();
    }
    InventoryView.renderUniformBaseCards(allUniforms);

    const inventory = await InventoryModel.fetchInventoryItemsLimited(50);
    allInventory = inventory;
    allCodesCache = new Set(inventory.map(i => i.UniformCode));
    
    InventoryView.renderInventoryCards(inventory);

  } catch (error) {
    console.error("❌ Failed to reload inventory data:", error);
    Swal.fire({
      icon: "error",
      title: "Failed to load data",
      text: error.message || "Unable to reload data",
    });
  }
}


function setupEvents() {
  bindSearchEvent();
  bindExportEvent();
  bindImportEvent();
  bindAssignSubmit();
  bindAddCodeSubmit();
  bindAutoFillEmployee();
  bindInlineUpdateCode();
  bindAssignFromAvailableCode();

  window.addEventListener("addCodeClick", handleAddCodeClick);
  window.addEventListener("detailClick", handleDetailClick);
  window.addEventListener("importCodeClick", handleImportCodeClick);
  window.addEventListener("beforeunload", () => {
    InventoryView.resetModals?.(); // Automatically close modals when SPA reloads
  });

  window.closeBulkImportModal = () => {
    InventoryView.toggleModal("bulkImportModal", false);
  };
}

function bindExportEvent() {
  document.getElementById("btnExportReport")?.addEventListener("click", async () => {
    const data = await InventoryModel.fetchAllForExport();
    const url = InventoryModel.exportCSV(data, [
      "UniformID", "UniformCode", "UniformType", "UniformSize", "UniformColor",
      "UniformQty", "EmployeeID", "EmployeeName", "EmployeeDepartment", "Status", "RewashCount"
    ]);

    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory_report.csv";
    a.click();
    URL.revokeObjectURL(url);
  });
}

window.InventoryModel = InventoryModel;

async function refreshItemInView(code) {
  try {
    const updated = await InventoryModel.fetchUniformCodeByCode(code);
    if (!updated) return;

    const idx = allInventory.findIndex(i => i.UniformCode === code);
    if (idx >= 0) {
      allInventory[idx] = updated;
    } else {
      allInventory.unshift(updated);
    }

    allCodesCache.add(code);

    InventoryView.replaceInventoryCard(updated);

  } catch (err) {
    console.error("❌ Failed to refresh item in view:", err);
  }
}

window.syncAllEmployeeDataToInventory = async () => {
  try {
    await syncAllEmployeeDataToInventory();
    await watchInventory(); // 🔁 Reload UI after sync
    Swal.fire({
      icon: "success",
      title: "Employee data updated in Inventory!",
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    console.error("❌ Sync Error:", err);
    Swal.fire({
      icon: "error",
      title: "Error during Sync",
      text: err.message || "Unable to update data"
    });
  }
};
