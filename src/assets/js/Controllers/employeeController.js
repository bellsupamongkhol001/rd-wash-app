import { EmployeeModel } from "../Models/employeeModel.js";
import { EmployeeView } from "../Views/employeeView.js";

const DEFAULT_PROFILE = "https://cdn-icons-png.flaticon.com/512/1077/1077114.png";
let selectedEmployeeId = null;

export async function initEmployeePage() {
  try {
    EmployeeView.showLoading();
    setupEvents();
    const employees = await EmployeeModel.fetchAllEmployees();
    EmployeeView.renderTable(employees);
  } catch (error) {
    console.error("❌ Error loading Employee page:", error);
    Swal.fire({
      icon: "error",
      title: "❌ Failed to load data",
      text: error.message || "An error occurred while loading data",
    });
  } finally {
    EmployeeView.hideLoading();
  }
}

async function reloadTable() {
  try {
    const employees = await EmployeeModel.fetchAllEmployees();
    EmployeeView.renderTable(employees);
  } catch (err) {
    console.error("❌ reloadTable error:", err);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: err.message || "Unable to load employee data",
    });
  }
}
window.reloadEmployeeTable = reloadTable;

function setupEvents() {
  document.querySelector(".btn-add")?.addEventListener("click", () => {
    try {
      selectedEmployeeId = null;
      EmployeeView.resetForm();
      EmployeeView.setModalTitle("Add Employee", "fas fa-user-plus");
      EmployeeView.toggleModal("employeeFormModal", true);
      EmployeeView.initDropzone();
    } catch (err) {
      console.error("❌ Failed to open Add Employee form:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Unable to open Add Employee form",
        customClass: {
          popup: "swal-on-top"
        }
      });
    }
  });

  document.querySelector("#cancelBtn")?.addEventListener("click", () => {
    try {
      EmployeeView.toggleModal("employeeFormModal", false);
    } catch (err) {
      console.error("❌ Failed to close Modal:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Unable to close the window",
      });
    }
  });
  

  document.querySelector("#searchEmployee")?.addEventListener("input", async (e) => {
    try {
      const keyword = e.target.value.toLowerCase().trim();
      if (!keyword) {
        const employees = await EmployeeModel.fetchAllEmployees();
        return EmployeeView.renderTable(employees);
      }
  
      const employees = await EmployeeModel.fetchAllEmployees();
      const filtered = employees.filter(
        (emp) =>
          emp.employeeId.toLowerCase().includes(keyword) ||
          emp.employeeName.toLowerCase().includes(keyword)
      );
  
      EmployeeView.renderTable(filtered);
    } catch (err) {
      console.error("❌ Search error:", err);
      Swal.fire({
        icon: "error",
        title: "Search Error",
        text: err.message || "Unable to search data",
      });
    }
  });
  

  document.querySelector(".btn-import")?.addEventListener("click", () => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv";
  
      input.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
  
        EmployeeView.showLoading();
  
        try {
          const text = await file.text();
          const records = EmployeeModel.parseCSV(text);
          let count = 0;
          let skipped = 0;
  
          for (const emp of records) {
            if (EmployeeModel.isValidEmployee(emp)) {
              emp.photoURL = DEFAULT_PROFILE;
  
              const exists = await EmployeeModel.fetchEmployeeById(emp.employeeId);
              if (!exists) {
                await EmployeeModel.createEmployee(emp);
                count++;
              } else {
                skipped++;
                console.warn(`🚫 Duplicate ID skipped: ${emp.employeeId}`);
              }
            } else {
              console.warn(`⚠️ Invalid employee skipped:`, emp);
            }
          }
  
          Swal.fire({
            icon: "success",
            title: `✅ Import Successful`,
            html: `Newly added: ${count} items<br>Skipped/duplicates: ${skipped} items`,
            timer: 3000,
            showConfirmButton: false,
          });
  
          await reloadTable();
        } catch (err) {
          console.error("❌ CSV Import Error:", err);
          Swal.fire({
            icon: "error",
            title: "Error",
            text: err.message || "Unable to import data",
          });
        } finally {
          EmployeeView.hideLoading();
        }
      });
  
      input.click();
    } catch (outerErr) {
      console.error("❌ Import CSV outer error:", outerErr);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: outerErr.message || "Unable to open import function",
      });
    }
  });

  document.querySelector(".btn-export")?.addEventListener("click", async () => {
    try {
      EmployeeView.showLoading();
  
      const employees = await EmployeeModel.fetchAllEmployees();
  
      if (!employees || employees.length === 0) {
        return Swal.fire({
          icon: "info",
          title: "No employee data",
          text: "No data available for export",
        });
      }

      const result = await Swal.fire({
        title: "Do you want to export the data?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Export",
        cancelButtonText: "Cancel",
        buttonsStyling: true,
      customClass: {
        confirmButton: 'swal2-confirm btn-success', // เพิ่ม class สำหรับปุ่ม Confirm
        cancelButton: 'swal2-cancel btn-danger'   // เพิ่ม class สำหรับปุ่ม Cancel
      }
      });

      if (result.isConfirmed) {
        const url = EmployeeView.exportEmployeesToCSV(employees,[ "employeeId", "employeeName", "employeeDept"]);
        const link = document.createElement("a");
        link.href = url;
        link.download = "employees.csv";
        link.click();
        URL.revokeObjectURL(url);
  
        Swal.fire({
          icon: "success",
          title: "Export Successful",
          text: `Total: ${employees.length} items`,
          timer: 2000,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      console.error("❌ Export Error:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Unable to export data",
      });
    } finally {
      EmployeeView.hideLoading();
    }
  });
  

  document.querySelector("#employeeForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const file = document.getElementById("employeePhoto")?.files[0];

    const employeeData = {
      employeeId: form.employeeId.value.trim(),
      employeeName: form.employeeName.value.trim(),
      employeeDept: form.employeeDept.value.trim(),
      photoURL: "",
    };

    if (!EmployeeModel.isValidEmployee(employeeData)) {
      return Swal.fire({
        icon: "warning",
        title: "Please fill in all fields",
        timer: 2000,
        showConfirmButton: false,
      });
    }

    EmployeeView.setFormLoading(true);

    try {
      if (!selectedEmployeeId) {
        const exists = await EmployeeModel.fetchEmployeeById(employeeData.employeeId);
        if (exists) {
          EmployeeView.setFormLoading(false);
          return Swal.fire({
            icon: "warning",
            title: "Duplicate Employee ID",
            text: `Employee ID "${employeeData.employeeId}" already exists`,
          });
        }
      }

      employeeData.photoURL = file
        ? await EmployeeModel.convertImageToBase64(file)
        : DEFAULT_PROFILE;

      if (selectedEmployeeId) {
        await EmployeeModel.updateEmployee(selectedEmployeeId, employeeData);
      } else {
        await EmployeeModel.createEmployee(employeeData);
      }

      await reloadTable();
      EmployeeView.toggleModal("employeeFormModal", false);

      Swal.fire({
        icon: "success",
        title: "Save Successful",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("❌ Save Error:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Unable to save data",
      });
    } finally {
      EmployeeView.setFormLoading(false);
    }
  });
}

window.handleEditById = async (employeeId) => {
  try {
    const employee = await EmployeeModel.fetchEmployeeById(employeeId);
    if (!employee) {
      return Swal.fire({
        icon: "warning",
        title: "Not Found",
        text: `Employee with ID: ${employeeId} not found`,
      });
    }

    selectedEmployeeId = employeeId;

    const form = document.querySelector("#employeeForm");
    form.employeeId.value = employee.employeeId;
    form.employeeId.disabled = true;
    form.employeeName.value = employee.employeeName;
    form.employeeDept.value = employee.employeeDept;

    const preview = document.getElementById("previewPhoto");
    if (employee.photoURL) {
      preview.src = employee.photoURL;
      preview.style.display = "block";
    }
    else{
      preview.src = "";
      preview.style.display = "none";
    }

    EmployeeView.setModalTitle("Edit Employee", "fas fa-user-edit");
    EmployeeView.toggleModal("employeeFormModal", true);
    EmployeeView.initDropzone();

  } catch (err) {
    console.error("❌ Edit error:", err);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: err.message || "Unable to load employee data",
    });
  }
};


window.promptDeleteEmployee = async (employeeId) => {
  try {
    const result = await Swal.fire({
      title: 'Delete data?',
      text: 'Are you sure you want to delete this item?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      buttonsStyling: true,
      customClass: {
        confirmButton: 'swal2-confirm btn-success', // เพิ่ม class สำหรับปุ่ม Confirm
        cancelButton: 'swal2-cancel btn-danger'   // เพิ่ม class สำหรับปุ่ม Cancel
      }
    });

    if (result.isConfirmed) {
      await EmployeeModel.deleteEmployee(employeeId);
      await reloadTable();
      Swal.fire({
        icon: "success",
        title: "Deleted successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    }
  } catch (err) {
    console.error("❌ Delete error:", err);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: err.message || "Unable to delete data",
    });
  }
};