import { UniformModel } from "../Models/uniformModel.js";

const DEFAULT_IMG = "https://cdn-icons-png.flaticon.com/512/892/892458.png";

export const UniformView = {
  currentPage: 1,
  rowsPerPage: 10,
  currentSortField: "employeeId",
  currentSortDirection: "asc",

  // ============================ 📋 RENDER TABLE ============================
  renderTable(uniforms) {
    const tbody = document.getElementById("uniformTableBody");
    const tableWrapper = document.querySelector(".table-wrapper");
    const loading = document.getElementById("loadingOverlay");

    tbody.innerHTML = "";
    loading?.classList.add("hidden");
    tableWrapper?.classList.remove("hidden");

    if (!uniforms || uniforms.length === 0) {
      tbody.innerHTML = `<tr>
      <td colspan="7" style="text-align:center;padding:20px;color:#888;">
        🚫 No data found
      </td>
    </tr>`;
      this.renderPagination(0);
      return;
    }

    const sorted = [...uniforms].sort((a, b) => {
      const field = this.currentSortField;
      const dir = this.currentSortDirection === "asc" ? 1 : -1;
      return (a[field] || "").localeCompare(b[field] || "") * dir;
    });

    const start = (this.currentPage - 1) * this.rowsPerPage;
    const paginated = sorted.slice(start, start + this.rowsPerPage);

    // 🧾 วนแสดงข้อมูลทีละรายการ
    paginated.forEach((uni) => {
      const img =
        uni.img?.startsWith("data:image") || uni.img?.startsWith("http")
          ? uni.img
          : DEFAULT_IMG;

      const tr = document.createElement("tr");
      tr.innerHTML = `
      <td>${uni.uniformID}</td>
      <td>${uni.uniformType}</td>
      <td>${uni.uniformSize}</td>
      <td>${uni.uniformColor}</td>
      <td>${uni.uniformQty}</td>
      <td>
        <img src="${img}" width="40" height="40" style="object-fit:cover;border-radius:8px;border:1px solid #ccc;" />
      </td>
      <td>
        <button class="btn action-btn edit" data-id="${uni.uniformID}" style="background:orange;color:#fff">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn action-btn delete" data-id="${uni.uniformID}" style="background:red;color:#fff">
          <i class="fas fa-trash"></i>
        </button>
      </td>`;
      tbody.appendChild(tr);
    });

    document.querySelectorAll(".action-btn.edit").forEach((btn) => {
      btn.addEventListener("click", () =>
        window.handleEditUniform?.(btn.dataset.id)
      );
    });

    document.querySelectorAll(".action-btn.delete").forEach((btn) => {
      btn.addEventListener("click", () =>
        window.promptDeleteUniform?.(btn.dataset.id)
      );
    });

    this.renderPagination(uniforms.length);
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
        window.reloadUniformTable?.();
      };
      container.appendChild(btn);
    }
  },

  resetForm() {
    const fields = [
      "uniformID",
      "uniformType",
      "uniformSize",
      "uniformColor",
      "uniformQty",
      "uniformPhoto",
    ];
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    const preview = document.getElementById("previewPhoto");
    if (preview) {
      preview.src = "";
      preview.style.display = "none";
    }

    const idField = document.getElementById("uniformID");
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

  setModalTitle(title = "Add Uniform", icon = "fas fa-plus") {
    const titleEl = document.querySelector("#uniformModal h3");

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
    const inputFile = document.getElementById("uniformPhoto");
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

  showLoading() {
    document.querySelector(".table-wrapper")?.classList.add("hidden");
    document.getElementById("loadingOverlay")?.classList.remove("hidden");
  },

  hideLoading() {
    document.getElementById("loadingOverlay")?.classList.add("hidden");
    document.querySelector(".table-wrapper")?.classList.remove("hidden");
  },

  exportUniformsToCSV(uniforms) {
    const headers = [
      "uniformID",
      "uniformType",
      "uniformSize",
      "uniformColor",
      "uniformQty",
    ];
    const csvContent = [
      headers.join(","),
      ...uniforms.map((uni) =>
        headers.map((h) => `"${uni[h] || ""}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "uniforms.csv";
    a.click();
    URL.revokeObjectURL(url);
  },
};

window.reloadUniformTable = async () => {
  try {
    UniformView.setFormLoading(true); 
    const uniforms = await UniformModel.fetchAllUniforms();
    UniformView.renderTable(uniforms); // 🧾 แสดงผลบนตาราง
  } catch (err) {
    console.error("❌ reloadUniformTable error:", err);
    Swal.fire({
      icon: "error",
      title: "เกิดข้อผิดพลาด",
      text: err.message || "ไม่สามารถโหลดข้อมูลยูนิฟอร์มได้",
    });
  } finally {
    UniformView.setFormLoading(false);
  }
};
