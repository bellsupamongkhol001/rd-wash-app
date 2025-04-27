import { db } from "@config/firebaseConfig.js";
import {
  doc,
  updateDoc,
  query,            
  where,
  collection,
  getDocs,
  onSnapshot,
} from "firebase/firestore";

async function findByUniformCode(code) {
  if (!code) return [];
  const q    = query(
    collection(db, "WashJobs"),
    where("uniformCode", "==", code)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

import {
  getAllWashes,
  getWashJobById,
  addWashJob,
  updateWashJob,
  deleteWashJob,
  addToWashHistory,
  getUniformByCode,
  incrementRewashCount,
  scrapUniform,
  setRewashCount,
  returnToStockAfterESD,
  getAllWashHistory,
  getRewashCount,
} from "../Models/washModel.js";

import {
  renderWashTable,
  renderWashHistory,
  renderWashSummary,
  renderPagination,
  openESDModal
} from "../Views/washView.js";

import {
  formatDate,
  generateWashId,
  showLoading,
  hideLoading,
  confirmDeleteModal,
  getStatusFromDate,
} from "../Utils/washUtils.js";

import { debounce, safeGet } from "../Utils/globalUtils.js";

let currentPage = 1;
const rowsPerPage = 10;

let currentWashes = [];

export async function initWashPage() {
  try {
    showLoading("🔄 Loading Wash Page...");
    setupEventListeners();

    const washRef = collection(db, "WashJobs");

    onSnapshot(washRef, async (snapshot) => {
      const washes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const updatedWashes = await Promise.all(washes.map(checkAndUpdateWashStatus));

      renderWashTable(updatedWashes);
      renderWashSummary(updatedWashes);

      const historyData = await getAllWashHistory();
      renderWashHistory(historyData);
    });

    setupSearchAndFilter();
  } catch (error) {
    console.error("❌ Error loading Wash page:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "❌ Unable to load data. Please try again.",
    });
  } finally {
    hideLoading();
  }
}

export function setupSearchAndFilter() {
  const searchInput = document.getElementById("searchInput");
  const filterStatus = document.getElementById("filterStatus");

  if (searchInput) {
    searchInput.addEventListener("input", async () => {
      const snapshot = await getAllWashes();
      const updatedWashes = await Promise.all(snapshot.map(checkAndUpdateWashStatus));
      renderWashTable(updatedWashes, currentPage);
    });
  }

  if (filterStatus) {
    filterStatus.addEventListener("change", async () => {
      const snapshot = await getAllWashes();
      const updatedWashes = await Promise.all(snapshot.map(checkAndUpdateWashStatus));
      renderWashTable(updatedWashes, currentPage);
    });
  }
}

export function setupEventListeners() {
  safeGet("searchInput")?.addEventListener("input", debounce(async () => {
    const washes = await getAllWashes();
    const updatedWashes = await Promise.all(washes.map(checkAndUpdateWashStatus));
    renderWashTable(updatedWashes, currentPage);
  }, 300));

  safeGet("filterStatus")?.addEventListener("change", async () => {
    const washes = await getAllWashes();
    const updatedWashes = await Promise.all(washes.map(checkAndUpdateWashStatus));
    renderWashTable(updatedWashes, currentPage);
  });

  safeGet("btnSaveWash")?.addEventListener("click", saveWashJob);
  safeGet("btnAddWash")?.addEventListener("click", openAddWashModal);

  safeGet("uniformCode")?.addEventListener("input", debounce(autofillUniformInfo, 300));
  safeGet("color")?.addEventListener("change", autofillEmployeeInfo);

  safeGet("btnCloseModal")?.addEventListener("click", () => toggleModal(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") toggleModal(false);
  });

  safeGet("btnExportWashHistoryCSV")?.addEventListener("click", exportWashHistoryToCSV);
  safeGet("btnExportCSV")?.addEventListener("click", exportWashToCSV);

  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-esd-fail")) {
      const id = e.target.dataset.id;
      handleESDTestFail(id);
    }
  });
}

function toggleModal(show) {
  const modal = document.getElementById("washModal");
  if (!modal) return;

  modal.style.display = show ? "flex" : "none";

  if (!show) clearWashForm();
}

function clearWashForm() {
  const fields = ["empId", "empName", "uniformCode", "editIndex", "size"];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const colorSelect = document.getElementById("color");
  if (colorSelect) {
    colorSelect.innerHTML = `<option value="">Select Color</option>`;
    colorSelect.disabled = true;
  }
}

export function openAddWashModal() {
  const modal = document.getElementById("washModal");
  const title = document.getElementById("modalTitle");
  if (!modal || !title) return;

  clearWashForm();
  title.textContent = "Add Wash Job";
  modal.style.display = "flex";
}

export async function openEditWashModal(id) {
  const data = await getWashJobById(id);
  if (!data) {
    alert("❌ Data not found");
    return;
  }

  const fields = {
    editIndex: id,
    uniformCode: data.uniformCode,
    color: data.color,
    empId: data.empId,
    empName: data.empName,
  };

  for (const [key, value] of Object.entries(fields)) {
    const el = document.getElementById(key);
    if (el) el.value = value || "";
  }

  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "Edit Wash Job";

  toggleModal(true);
}

async function saveWashJob() {
  const saveBtn = document.getElementById("btnSaveWash");
  if (saveBtn) saveBtn.disabled = true;

  const uniformCode = document.getElementById("uniformCode")?.value.trim();
  const color = document.getElementById("color")?.value;
  const empIdRaw = document.getElementById("empId")?.value.trim();
  const empNameRaw = document.getElementById("empName")?.value.trim();
  const size = document.getElementById("size")?.value.trim() || "";

  const empId = empIdRaw || "-";
  const empName = empNameRaw || "-";

  if (!uniformCode || !color) {
    Swal.fire({
      icon: "warning",
      title: "Incomplete Data",
      text: "Please fill in all required fields.",
    });
    if (saveBtn) saveBtn.disabled = false;
    return;
  }

  try {
    showLoading("🔄 Checking...");

    const freshWashes = await getAllWashes();
    const duplicate = freshWashes.find(w =>
      w.uniformCode === uniformCode &&
      w.color === color &&
      !["ESD Passed", "Scrap"].includes(w.status)
    );
    if (duplicate) {
      Swal.fire({
        icon: "error",
        title: "Cannot Add",
        text: "This uniform is already being processed.",
      });
      return;
    }

    const washId = await generateWashId();
    const rewashCount = await getRewashCount(uniformCode, color);

    if (rewashCount > 3) {
      const scrapData = {
        washId,
        empId,
        empName,
        uniformCode,
        color,
        size,
        rewashCount,
        status: "Scrap",
        testResult: "FAIL",
        createdAt: new Date().toISOString(),
        testDate: new Date().toISOString(),
      };
      await addToWashHistory(scrapData);
      await scrapUniform(uniformCode, color);

      toggleModal(false);

      const updatedWashes = await getAllWashes();
      renderWashTable(updatedWashes);
      renderWashSummary(updatedWashes);

      Swal.fire({
        icon: "warning",
        title: "Uniform Scrapped",
        text: "Exceeded 3 washes.",
      });
      return;
    }

    const status = rewashCount > 0 ? `Waiting-Rewash #${rewashCount}` : "Waiting to Send";

    const washData = {
      washId,
      empId,
      empName,
      uniformCode,
      color,
      size,
      status,
      rewashCount,
      createdAt: new Date().toISOString(),
    };

    if (rewashCount > 0) {
      await setRewashCount(uniformCode, color, rewashCount);
    }

    await addWashJob(washData, washId);

    toggleModal(false);

    const updatedWashes = await getAllWashes();
    renderWashTable(updatedWashes);
    renderWashSummary(updatedWashes);

    Swal.fire({
      icon: "success",
      title: "Saved Successfully",
    });

  } catch (error) {
    console.error("❌ saveWashJob error:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Please try again.",
    });
  } finally {
    hideLoading();
    if (saveBtn) saveBtn.disabled = false;
  }
}

export function confirmDeleteWash(id) {
  confirmDeleteModal(id, async (confirmedId) => {
    try {
      showLoading("🗑️ Deleting wash job...");

      await deleteWashJob(confirmedId);

      await Swal.fire({
        icon: "success",
        title: "Deleted Successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("❌ Failed to delete wash job:", error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to delete wash job. Please try again.",
      });
    } finally {
      hideLoading();
    }
  });
}

const uniformCache = {};

async function autofillUniformInfo() {
  const code = document.getElementById("uniformCode")?.value.trim();
  const sizeInput = document.getElementById("size");
  const colorSelect = document.getElementById("color");

  if (!code) return;

  try {
    const uniforms = await getUniformByCode(code);

    if (!uniforms || uniforms.length === 0) {
      await Swal.fire({
        icon: "error",
        title: "Uniform Not Found",
        text: "No uniform found with this code.",
      });
      if (sizeInput) sizeInput.value = "";
      if (colorSelect) {
        colorSelect.innerHTML = '<option value="">No Color Available</option>';
        colorSelect.disabled = true;
      }
      return;
    }

    if (sizeInput) sizeInput.value = uniforms[0].UniformSize || "";

    if (colorSelect) {
      colorSelect.innerHTML = '<option value="">Select Color</option>';
      const uniqueColors = [...new Set(uniforms.map(u => u.UniformColor))];
      uniqueColors.forEach(color => {
        const opt = document.createElement("option");
        opt.value = color;
        opt.textContent = color;
        colorSelect.appendChild(opt);
      });
      colorSelect.disabled = false;
    }
  } catch (error) {
    console.error("❌ autofillUniformInfo error:", error);
    await Swal.fire({
      icon: "error",
      title: "Error",
      text: "Failed to load uniform information. Please try again.",
    });
  }
}

const employeeCache = {};

async function autofillEmployeeInfo() {
  const code = document.getElementById("uniformCode")?.value.trim();
  const color = document.getElementById("color")?.value;

  if (!code || !color) return;

  try {
    const matches = await getUniformByCode(code, color);

    if (matches.length > 0) {
      const u = matches[0];
      const empIdInput = document.getElementById("empId");
      const empNameInput = document.getElementById("empName");
      const sizeInput = document.getElementById("size");

      if (empIdInput) empIdInput.value = u.EmployeeID || "-";
      if (empNameInput) empNameInput.value = u.EmployeeName || "-";
      if (sizeInput) sizeInput.value = u.UniformSize || "";
    } else {
      const empIdInput = document.getElementById("empId");
      const empNameInput = document.getElementById("empName");
      const sizeInput = document.getElementById("size");

      if (empIdInput) empIdInput.value = "-";
      if (empNameInput) empNameInput.value = "-";
      if (sizeInput) sizeInput.value = "";
    }
  } catch (error) {
    console.error("❌ autofillEmployeeInfo error:", error);
    await Swal.fire({
      icon: "error",
      title: "Error",
      text: "Failed to autofill employee information. Please try again.",
    });
  }
}

const washJobCache = {};

export async function handleESDRequest(id) {
  try {
    showLoading("🔍 Checking ESD...");

    const data = await getWashJobById(id);

    if (!data || data.status !== "Completed") {
      await Swal.fire({
        icon: "warning",
        title: "Warning",
        text: "Data not found or status is not Completed.",
      });
      return;
    }

    openESDModal(data);
  } catch (err) {
    console.error("❌ handleESDRequest error:", err);
    await Swal.fire({
      icon: "error",
      title: "Error",
      text: "Failed to load ESD data. Please try again.",
    });
  } finally {
    hideLoading();
  }
}
 
export async function markAsESDPass(washData) {
  try {
    showLoading("✅ Saving ESD Pass...");

    const updatedData = {
      ...washData,
      testResult: "PASS",
      testDate: new Date().toISOString(),
      status: "ESD Passed",
    };

    if ((washData.rewashCount ?? 0) > 0) {
      await setRewashCount(washData.uniformCode, washData.color, 0);
    }

    await addToWashHistory(updatedData);
    await returnToStockAfterESD(updatedData);
    await deleteWashJob(washData.id || washData.washId);

    const freshWashes = await getAllWashes();
    renderWashTable(freshWashes);
    renderWashSummary(freshWashes);

    await Swal.fire({
      icon: "success",
      title: "ESD Pass recorded successfully",
      timer: 1500,
      showConfirmButton: false,
    });
  } catch (err) {
    console.error("❌ markAsESDPass error:", err);
    await Swal.fire({
      icon: "error",
      title: "Error",
      text: "Failed to record ESD Pass.",
    });
  } finally {
    hideLoading();
  }
}

export async function markAsESDFail(washData) {
  try {
    showLoading("⛔ Saving ESD Fail...");

    const currentCount = washData.rewashCount ?? 0;
    const newCount = currentCount + 1;

    const failData = {
      ...washData,
      testResult: "FAIL",
      testDate: new Date().toISOString(),
      status: "ESD Failed",
    };

    await addToWashHistory(failData);

    if (newCount > 3) {
      await scrapUniform(washData.uniformCode, washData.color);
    } else {
      await setRewashCount(washData.uniformCode, washData.color, newCount);
    }

    await deleteWashJob(washData.id || washData.washId);

    const freshWashes = await getAllWashes();
    renderWashTable(freshWashes);
    renderWashSummary(freshWashes);

    await Swal.fire({
      icon: "warning",
      title: "ESD Fail recorded",
      text: "Action completed successfully.",
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (err) {
    console.error("❌ markAsESDFail error:", err);
    await Swal.fire({
      icon: "error",
      title: "Error",
      text: "Failed to record ESD Fail.",
    });
  } finally {
    hideLoading();
  }
}

export async function handleESDTestFail(washData) {
  try {
    showLoading("⛔ Processing ESD Fail...");
    await markAsESDFail(washData);
  } catch (err) {
    console.error("❌ handleESDTestFail error:", err);
    await Swal.fire({
      icon: "error",
      title: "Error",
      text: "Failed to process ESD Fail.",
    });
  } finally {
    hideLoading();
  }
}

export async function checkAndUpdateWashStatus(wash) {
  if (!wash?.createdAt || ["Scrap", "ESD Passed"].includes(wash.status)) {
    return wash;
  }

  const createdAt = new Date(wash.createdAt);
  const now = new Date();
  const daysElapsed = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
  const rewashCount = wash.rewashCount || 0;

  let newStatus;

  if (daysElapsed >= 3) {
    newStatus = "Completed";
  } else if (daysElapsed >= 1) {
    newStatus = rewashCount === 0 ? "Washing" : `Re-Washing #${rewashCount}`;
  } else {
    newStatus = rewashCount === 0 ? "Waiting to Send" : `Waiting-Rewash #${rewashCount}`;
  }

  if (newStatus !== wash.status) {
    console.log(`🔁 Status changed: ${wash.status} → ${newStatus}`);
    await updateWashJob(wash.id, { status: newStatus });
    wash.status = newStatus;
  }

  return wash;
}

export async function shiftWashDate(washId, days) {
  try {
    const washes = await getAllWashes();
    const wash = washes.find(w => w.washId === washId);

    if (!wash) {
      await Swal.fire({
        icon: "error",
        title: "Wash job not found",
        text: "No data found in the system",
      });
      return;
    }

    const originalDate = new Date(wash.createdAt);
    const shiftedDate = new Date(originalDate);
    shiftedDate.setDate(originalDate.getDate() + days);

    if (originalDate.toISOString() === shiftedDate.toISOString()) {
      await Swal.fire({
        icon: "info",
        title: "No date change",
      });
      return;
    }

    await updateWashJob(wash.id, {
      createdAt: shiftedDate.toISOString(),
    });

    const updatedWashes = await getAllWashes();
    renderWashTable(updatedWashes);
    renderWashSummary(updatedWashes);

    const formatted = shiftedDate.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    await Swal.fire({
      icon: "success",
      title: "Date shifted successfully",
      text: `→ ${formatted}`,
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (err) {
    console.error("❌ shiftWashDate error:", err);
    await Swal.fire({
      icon: "error",
      title: "Error occurred",
      text: "Failed to shift date",
    });
  }
}

async function exportWashToCSV() {
  try {
    showLoading("📤 Exporting wash job data...");

    const washes = await getAllWashes();
    if (!washes || washes.length === 0) {
      await Swal.fire({
        icon: "warning",
        title: "No data to export",
      });
      hideLoading();
      return;
    }

    const headers = [
      "Wash ID",
      "Uniform Code",
      "Color",
      "Size",
      "Employee ID",
      "Employee Name",
      "Status",
      "Rewash Count",
      "Created At",
    ];

    const rows = washes.map((wash) => [
      wash.washId || "",
      wash.uniformCode || "",
      wash.color || "",
      wash.size || "",
      wash.empId || "",
      wash.empName || "",
      wash.status || "",
      wash.rewashCount ?? 0,
      formatDate(wash.createdAt),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `wash-export-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    await Swal.fire({
      icon: "success",
      title: "CSV exported successfully",
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (err) {
    console.error("❌ exportWashToCSV error:", err);
    await Swal.fire({
      icon: "error",
      title: "Error occurred",
      text: "Failed to export data",
    });
  } finally {
    hideLoading();
  }
}

async function exportWashHistoryToCSV() {
  try {
    showLoading("📤 Exporting wash history...");

    const history = await getAllWashHistory();
    if (!history || history.length === 0) {
      await Swal.fire({
        icon: "warning",
        title: "No wash history to export",
      });
      hideLoading();
      return;
    }

    const headers = [
      "Wash ID",
      "Uniform Code",
      "Color",
      "Size",
      "Employee ID",
      "Employee Name",
      "Status",
      "Rewash Count",
      "Test Result",
      "Test Date",
      "Created At",
    ];

    const rows = history.map((entry) => [
      entry.washId || "",
      entry.uniformCode || "",
      entry.color || "",
      entry.size || "",
      entry.empId || "",
      entry.empName || "",
      entry.status || "",
      entry.rewashCount ?? 0,
      entry.testResult || "-",
      formatDate(entry.testDate),
      formatDate(entry.createdAt),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `wash-history-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    await Swal.fire({
      icon: "success",
      title: "Wash history exported successfully",
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (err) {
    console.error("❌ Export wash history error:", err);
    await Swal.fire({
      icon: "error",
      title: "Error occurred",
      text: "Failed to export wash history",
    });
  } finally {
    hideLoading();
  }
}
