import { EmployeeModel } from "../Models/employeeModel.js";

const DEFAULT_PROFILE =
  "https://cdn-icons-png.flaticon.com/512/1077/1077114.png";

// ============================== 📦 VIEW OBJECT ==============================
export const EmployeeView = {
  currentPage: 1,
  rowsPerPage: 20,
  currentSortField: "employeeId",
  currentSortDirection: "asc",

  // ========================== 📋 RENDER TABLE ==========================
  renderTable(employees) {
    const tbody = document.getElementById("employeeTableBody");
    const tableWrapper = document.querySelector(".table-wrapper");
    const loading = document.getElementById("loadingOverlay");

    tbody.innerHTML = "";
    loading?.classList.add("hidden");
    tableWrapper?.classList.remove("hidden");

    if (!employees || employees.length === 0) {
      tbody.innerHTML = `<tr>
        <td colspan="5" style="text-align:center; color:#888; padding:20px;">
          🚫 No data found
        </td>
      </tr>`;
      this.renderPagination(0);
      return;
    }

    const sorted = [...employees].sort((a, b) => {
      const field = this.currentSortField;
      const dir = this.currentSortDirection === "asc" ? 1 : -1;
      return (a[field] || "").localeCompare(b[field] || "") * dir;
    });

    const start = (this.currentPage - 1) * this.rowsPerPage;
    const paginated = sorted.slice(start, start + this.rowsPerPage);

    paginated.forEach((emp) => {
      const photo =
        emp.photoURL?.startsWith("data:image") ||
        emp.photoURL?.startsWith("http")
          ? emp.photoURL
          : DEFAULT_PROFILE;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${emp.employeeId}</td>
        <td>${emp.employeeName}</td>
        <td>${emp.employeeDept}</td>
        <td><img src="${photo}" width="40" height="40" style="object-fit:cover;border-radius:8px;border:1px solid #ccc;" /></td>
        <td>
          <button class="btn action-btn edit" style="background-color: orange; color: white;" data-id="${emp.employeeId}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn action-btn delete" style="background-color: red; color: white;" data-id="${emp.employeeId}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll(".btn.action-btn.edit").forEach((btn) => {
      btn.addEventListener("click", () =>
        window.handleEditById?.(btn.dataset.id)
      );
    });

    document.querySelectorAll(".btn.action-btn.delete").forEach((btn) => {
      btn.addEventListener("click", () =>
        window.promptDeleteEmployee?.(btn.dataset.id)
      );
    });

    this.renderPagination(employees.length);
  },

  renderPagination(totalItems) {
    const container = document.getElementById("pagination");
    if (!container) return;
    container.innerHTML = "";

    const totalPages = Math.ceil(totalItems / this.rowsPerPage);
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement("button");
      btn.textContent = i;
      btn.classList.add("pagination-btn");

      if (i === this.currentPage) btn.classList.add("active");
      btn.onclick = () => {
        this.currentPage = i;
        window.reloadEmployeeTable?.();
      };
      container.appendChild(btn);
    }
  },

  resetForm() {
    [
      "employeeId",
      "employeeName",
      "employeeDept",
      "employeePhoto"
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      }
    );

    const preview = document.getElementById("previewPhoto");
    if (preview) {
      preview.src = "";
      preview.style.display = "none";
    }

    const idField = document.getElementById("employeeId");
    if (idField) idField.disabled = false;
  },

  toggleModal(id, show = true) {
    const modal = document.getElementById(id);
    if (!modal) {
      console.warn(`⚠️ toggleModal: ไม่พบ modal ที่มี id = "${id}"`);
      return;
    }
    modal.classList.toggle("hidden", !show);
  },

  setModalTitle(title = "Add Employee", icon = "fas fa-user-plus") {
    const titleEl = document.querySelector("#employeeFormModal h3");
    if (titleEl) {
      titleEl.innerHTML = `<i class="${icon}"></i> ${title}`;
    }
  },

  setFormLoading(isLoading = false) {
    const saveBtn = document.querySelector(".btn-save");
    if (!saveBtn) return;
    saveBtn.disabled = isLoading;
    saveBtn.innerHTML = isLoading
      ? '<i class="fas fa-spinner fa-spin"></i> Saving...'
      : '<i class="fas fa-save"></i> Save';
  },

  showPreviewImage(file) {
    const preview = document.getElementById("previewPhoto");
    if (!file || !preview) return (preview.style.display = "none");

    const reader = new FileReader();
    reader.onload = () => {
      preview.src = reader.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);
  },

  initDropzone() {
    const dropZone = document.getElementById("dropZone");
    const inputFile = document.getElementById("employeePhoto");
    const previewImg = document.getElementById("previewPhoto");

    if (!dropZone || !inputFile || !previewImg) return;

    dropZone.addEventListener("click", () => inputFile.click());
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("dragover");
    });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        inputFile.files = e.dataTransfer.files;
        this.showPreviewImage(file);
      }
    });

    inputFile.addEventListener("change", () => {
      const file = inputFile.files[0];
      this.showPreviewImage(file);
    });
  },

  // ========================== 🔄 LOADING ==========================
  showLoading() {
    document.querySelector(".table-wrapper")?.classList.add("hidden");
    document.getElementById("loadingOverlay")?.classList.remove("hidden");
  },

  hideLoading() {
    document.getElementById("loadingOverlay")?.classList.add("hidden");
    document.querySelector(".table-wrapper")?.classList.remove("hidden");
  },

  // ========================== 📤 EXPORT CSV ==========================
  exportEmployeesToCSV(employees) {
    const headers = ["employeeId", "employeeName", "employeeDept"];
    const csvContent = [
      headers.join(","),
      ...employees.map((emp) =>
        headers.map((h) => `"${emp[h] || ""}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees.csv";
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ============================== 🌐 GLOBAL TRIGGER ==============================
window.reloadEmployeeTable = async () => {
  try{
    EmployeeView.setFormLoading(true);
    const employees = await EmployeeModel.fetchAllEmployees();
    EmployeeView.renderTable(employees);
  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: "error",
      title: "เกิดข้อผิดพลาด",
      text: err.message || "ไม่สามารถโหลดข้อมูลได้",
    });
  } finally {
    EmployeeView.setFormLoading(false);
  }
};
