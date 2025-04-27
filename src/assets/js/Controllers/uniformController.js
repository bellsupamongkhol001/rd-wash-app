import { UniformModel } from '../Models/uniformModel.js';
import { UniformView } from '../Views/uniformView.js';

const DEFAULT_IMG = "https://cdn-icons-png.flaticon.com/512/892/892458.png";
let selectedUniformId = null;

export async function initUniformPage() {
  try {
    UniformView.showLoading(true);
    setupEvents();
    const uniforms = await UniformModel.fetchAllUniforms();
    UniformView.renderTable(uniforms);
  } catch (err) {
    console.error("❌ UniformPage Error:", error);
    Swal.fire({
      icon: "error",
      title: "❌ Failed to load data",
      text: error.message || "An error occurred while loading data",
    });
  } finally {
    UniformView.hideLoading(false);
  }
}

async function reloadTable() {
  try {
    const uniforms = await UniformModel.fetchAllUniforms();
    UniformView.renderTable(uniforms);
  } catch (err) {
    console.error("❌ reloadTable error:", err);
    Swal.fire({
      icon: "error",
      title: "An error occurred",
      text: err.message || "Unable to load uniform data",
    });
  }
}
window.reloadUniformTable = reloadTable;

function setupEvents() {
  document.querySelector('.btn-add')?.addEventListener('click', async () => {
    try {
      selectedUniformId = null;
      UniformView.resetForm();
      UniformView.setModalTitle('Add Uniform', 'fas fa-plus');
      UniformView.toggleModal('uniformModal', true);
      UniformView.initDropzone();
  
      const uniforms = await UniformModel.fetchAllUniforms();
      const newID = generateUniformID(uniforms);
  
      const idInput = document.getElementById("uniformID");
      if (idInput) {
        idInput.value = newID;
        idInput.disabled = true;
      }
    } catch (err) {
      console.error("❌ Error on Add Uniform:", err);
      Swal.fire({
        icon: "error",
        title: "An error occurred",
        text: err.message || "Unable to open add uniform form",
        customClass: {
          popup: "swal-on-top"
        }
      });
    }
  });

  document.querySelector('#cancelBtn')?.addEventListener('click', () => {
    try {
      UniformView.toggleModal('uniformModal', false);
    } catch (err) {
      console.error("❌ Error closing modal:", err);
      Swal.fire({
        icon: "error",
        title: "An error occurred",
        text: err.message || "Unable to close the window",
      });
    }
  });

  document.querySelector("#searchUniform")?.addEventListener("input", async (e) => {
    try {
      const keyword = e.target.value.toLowerCase().trim();
      const uniforms = await UniformModel.fetchAllUniforms();
  
      const filtered = !keyword
        ? uniforms
        : uniforms.filter(
            (u) =>
              u.uniformID?.toLowerCase().includes(keyword) ||
              u.uniformType?.toLowerCase().includes(keyword) ||
              u.uniformSize?.toLowerCase().includes(keyword) ||
              u.uniformColor?.toLowerCase().includes(keyword)
          );
  
      UniformView.renderTable(filtered);
    } catch (err) {
      console.error("❌ Search Uniform Error:", err);
      Swal.fire({
        icon: "error",
        title: "An error occurred during search",
        text: err.message || "Unable to search for uniforms",
      });
    }
  });
  
  document.querySelector('.btn-import')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
  
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
  
      try {
        const text = await file.text();
        const records = UniformModel.parseCSV(text);
  
        const previewHtml = records.map((r) =>
          `<tr>
            <td>${r.uniformID}</td>
            <td>${r.uniformType}</td>
            <td>${r.uniformSize}</td>
            <td>${r.uniformColor}</td>
          </tr>`).join('');
  
        const result = await Swal.fire({
          title: 'Preview Import',
          html: `<table border="1" style="width:100%;font-size:0.9rem">
                  <thead><tr><th>ID </th><th>Type</th><th>Size</th><th>Color</th></tr></thead>
                  <tbody>${previewHtml}</tbody>
                </table>`,
          showCancelButton: true,
          confirmButtonText: 'Import Now',
          cancelButtonText: 'Cancel',
          width: 600,
          buttonsStyling: true,
      customClass: {
        confirmButton: 'swal2-confirm btn-success', // เพิ่ม class สำหรับปุ่ม Confirm
        cancelButton: 'swal2-cancel btn-danger'   // เพิ่ม class สำหรับปุ่ม Cancel
      }
        });
  
        if (!result.isConfirmed) return;
  
        let imported = 0;
        let duplicates = 0;
  
        for (const item of records) {
          if (UniformModel.isValidUniform(item)) {
            const exists = await UniformModel.fetchUniformById(item.uniformID);
            if (exists) {
              duplicates++;
              continue;
            }
  
            item.uniformQty = parseInt(item.uniformQty || '0');
            item.img = '';
            await UniformModel.createUniform(item);
            imported++;
          }
        }
  
        let message = `✅ Imported ${imported} items successfully`;
        if (duplicates > 0) message += `\n⚠️ Skipped ${duplicates} duplicate items`;
  
        Swal.fire({
          icon: 'success',
          title: 'Import Result',
          text: message,
          confirmButtonText: 'Close',
        });
  
        await reloadTable();
  
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

  document.querySelector('.btn-export')?.addEventListener('click', async () => {
    try {
      UniformView.setFormLoading(true);
  
      const uniforms = await UniformModel.fetchAllUniforms();
  
      if (!uniforms || uniforms.length === 0) {
        return Swal.fire({
          icon: "info",
          title: "No Uniform Data",
          text: "No data available for export",
        });
      }
  
      const result = await Swal.fire({
        title: "Do you want to export uniform data?",
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
        const url = UniformModel.exportCSV(uniforms, [
          "uniformID",
          "uniformType",
          "uniformSize",
          "uniformColor",
          "uniformQty",
        ]);
        const link = document.createElement("a");
        link.href = url;
        link.download = "uniforms.csv";
        link.click();
        URL.revokeObjectURL(url);
  
        Swal.fire({
          icon: "success",
          title: "Export successful",
          text: `Total of ${uniforms.length} items exported`,
          timer: 500,
          showConfirmButton: false,
        });
      }
  
    } catch (err) {
      console.error("❌ Export Uniform Error:", err);
      Swal.fire({
        icon: "error",
        title: "An error occurred",
        text: err.message || "Unable to export data",
      });
    } finally {
      UniformView.setFormLoading(false);
    }
  });
  
  document.querySelector('#uniformForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const file = document.getElementById('uniformPhoto')?.files[0];
    const uniformData = {
      uniformID: form.uniformID.value.trim(),
      uniformType: form.uniformType.value.trim(),
      uniformSize: form.uniformSize.value.trim(),
      uniformColor: form.uniformColor.value.trim(),
      uniformQty: parseInt(form.uniformQty.value || '0'),
      img: '',
    };

    if (!UniformModel.isValidUniform(uniformData)) {
      return Swal.fire({ icon: 'warning', title: 'Please fill out all fields', timer: 500, showConfirmButton: false });
    }

    UniformView.setFormLoading(true);
    try {
      if (file) {
        uniformData.img = await UniformModel.toBase64(file);
      }
      if (selectedUniformId) {
        await UniformModel.updateUniform(selectedUniformId, uniformData);
      } else {
        await UniformModel.createUniform(uniformData);
      }
      await reloadTable();
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "An error occurred",
        text: err.message || "Unable to save data",
      });
    } finally {
      UniformView.setFormLoading(false);
    }
  });
}

function generateUniformID(existingList = []) {
  const prefix = "RD-Uniform-";
  try {
    const numbers = existingList
      .map((u) => parseInt(u.uniformID?.replace(prefix, "") || "0"))
      .filter((n) => !isNaN(n));
    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNumber = (max + 1).toString().padStart(3, "0");
    return `${prefix}${nextNumber}`;
  } catch (err) {
    console.error("❌ generateUniformID error:", err);
    return `${prefix}001`;
  }
}

window.handleEditUniform = async (uniformID) => {
  try {
    const uniform = await UniformModel.fetchUniformById(uniformID);
    if (!uniform) {
      return Swal.fire({
        icon: "warning",
        title: "Data not found",
        text: `Uniform with ID: ${uniformID} not found`,
      });
    }

    selectedUniformId = uniformID;

    const form = document.querySelector("#uniformForm");
    form.uniformID.value = uniform.uniformID;
    form.uniformID.disabled = true;
    form.uniformType.value = uniform.uniformType;
    form.uniformSize.value = uniform.uniformSize;
    form.uniformColor.value = uniform.uniformColor;
    form.uniformQty.value = uniform.uniformQty || 0;

    const preview = document.getElementById("previewPhoto");
    if (uniform.img) {
      preview.src = uniform.img;
      preview.style.display = "block";
    } else {
      preview.src = "";
      preview.style.display = "none";
    }

    UniformView.setModalTitle("Edit Uniform", "fas fa-edit");
    UniformView.toggleModal("uniformModal", true);
    UniformView.initDropzone();

  } catch (err) {
    console.error("❌ Edit error:", err);
    Swal.fire({
      icon: "error",
      title: "An error occurred",
      text: err.message || "Unable to load uniform data",
    });
  }
};


window.promptDeleteUniform = async (uniformID) => {
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
      await UniformModel.deleteUniform(uniformID);
      await reloadTable();

      Swal.fire({
        icon: 'success',
        title: 'Deleted successfully',
        timer: 500,
        showConfirmButton: false
      });
    }

  } catch (err) {
    console.error("❌ Delete Uniform Error:", err);
    Swal.fire({
      icon: "error",
      title: "An error occurred",
      text: err.message || "Unable to delete data",
    });
  }
};
