import { InventoryModel } from "../Models/inventoryModel.js";

export const InventoryView = {
  currentPage: 1,
  rowsPerPage: 21,

  async refreshAll() {
    try {
      const [uniforms, inventory] = await Promise.all([
        InventoryModel.fetchUniforms(),
        InventoryModel.fetchInventoryItems()
      ]);
  
      await this.renderUniformBaseCards(uniforms);
  
      await this.renderInventoryCards(inventory);
    } catch (error) {
      console.error("❌ Failed to refresh inventory data:", error);
      const container1 = document.getElementById("uniformBaseList");
      const container2 = document.getElementById("inventoryList");
      if (container1) container1.innerHTML = `<p style="color:red;text-align:center;">⚠️ Failed to load uniform base</p>`;
      if (container2) container2.innerHTML = `<p style="color:red;text-align:center;">⚠️ Failed to load inventory</p>`;
    }
  },
  

  async reloadDetailModal(uniformId) {
    try {
      const items = await InventoryModel.getAllCodesByUniformID(uniformId);
      const tbody = document.getElementById("codeListBody");
  
      if (!tbody) return;
      tbody.innerHTML = "";
  
      if (!items || items.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center; color: #999;">🚫 No data found</td>
          </tr>`;
        return;
      }
      this.fillDetailModal(items);
      this.updateDetailModalHeader(items[0]);
      
    } catch (error) {
      console.error("❌ Error loading detail modal:", error);
    }
  },
  
  updateDetailModalHeader(item = {}) {
    const map = {
      detailUniformId: item.UniformID,
      detailUniformType: item.UniformType,
      detailUniformSize: item.UniformSize,
      detailUniformColor: item.UniformColor,
    };
  
    Object.entries(map).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || "-";
    });
  },

  async renderUniformBaseCards(uniforms = []) {
    const container = document.getElementById("uniformBaseList");
    if (!container) return;
    container.innerHTML = "";
  
    if (!uniforms || uniforms.length === 0) {
      container.innerHTML = `<p style="text-align:center;color:#888;">🚫 No uniform data found</p>`;
      return;
    }
  
    const start = (this.currentPage - 1) * this.rowsPerPage;
    const paginated = uniforms.slice(start, start + this.rowsPerPage);
  
    for (const uniform of paginated) {
      const card = await this.createUniformCard(uniform);
      container.appendChild(card);
    }
  
    this.renderPagination(uniforms.length);
    this.bindUniformCardEvents(container);
  },
  
  async createUniformCard(uniform) {
    const codeCount = await InventoryModel.getUniformCodeCountById(uniform.uniformID);
    const showImage = uniform.img && uniform.img.startsWith("data:image");
  
    const card = document.createElement("div");
    card.className = "inventory-card";
  
    card.innerHTML = `
      <div class="card-header"><strong>${uniform.uniformID}</strong></div>
      <div class="card-body">
        ${showImage
          ? `<img src="${uniform.img}" alt="Uniform" />`
          : `<div class="uniform-placeholder">No Picture</div>`}
        <div class="card-details-grid">
          <p><strong>Type:</strong> ${uniform.uniformType}</p>
          <p><strong>Size:</strong> ${uniform.uniformSize}</p>
          <p><strong>Color:</strong> ${uniform.uniformColor}</p>
          <p><strong>Qty:</strong> ${codeCount}</p>
        </div>
      </div>
      <div class="card-footer">
        <button class="action-btn add" data-id="${uniform.uniformID}">➕ Add Code</button>
        <button class="action-btn detail" data-id="${uniform.uniformID}">📄 Detail</button>
      </div>
    `;
    return card;
  },
  
  bindUniformCardEvents(container) {
    container.querySelectorAll(".action-btn.add").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        window.dispatchEvent(new CustomEvent("addCodeClick", { detail: { id } }));
      });
    });
  
    container.querySelectorAll(".action-btn.detail").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        window.dispatchEvent(new CustomEvent("detailClick", { detail: { id } }));
      });
    });
    
  },  

  async renderInventoryCards(inventoryList = []) {
    const container = document.getElementById("inventoryList");
    if (!container) return;
    container.innerHTML = "";
  
    if (!inventoryList || inventoryList.length === 0) {
      container.innerHTML = `<p style="text-align:center;color:#888;">🚫 No inventory data</p>`;
      return;
    }
  
    for (const item of inventoryList) {
      const card = this.createInventoryCard(item);
      container.appendChild(card);
      this.bindInventoryCardEvents(card, item);
    }
  },
  
  createInventoryCard(item) {
    const card = document.createElement("div");
    card.className = "inventory-card";
  
    card.innerHTML = `
      <div class="card-header">
        <strong contenteditable="true" onblur="updateCodeInline(this, '${item.UniformCode}')">${item.UniformCode}</strong>
        <span class="badge ${item.Status}">${item.Status.toUpperCase()}</span>
      </div>
      <div class="card-body">
        <p><strong>Type:</strong> ${item.UniformType}</p>
        <p><strong>Size:</strong> ${item.UniformSize}</p>
        <p><strong>Color:</strong> ${item.UniformColor}</p>
        <p><strong>Employee:</strong> 
          <span contenteditable="true" onblur="updateEmployeeInline(this, '${item.UniformCode}')">
            ${item.EmployeeName || "-"}
          </span>
        </p>
      </div>
      <div class="card-footer">
        ${
          item.Status === "available"
            ? `<button class="action-btn assign">Assign</button>`
            : `<button class="action-btn return">Return</button>`
        }
        <button class="action-btn delete">Delete</button>
      </div>
    `;
    return card;
  },
  
  bindInventoryCardEvents(card, item) {
    const assignBtn = card.querySelector(".action-btn.assign");
    const returnBtn = card.querySelector(".action-btn.return");
    const deleteBtn = card.querySelector(".action-btn.delete");
  
    if (assignBtn) {
      assignBtn.addEventListener("click", () => {
        window.openAssignFromCode(item.UniformCode);
      });
    }
  
    if (returnBtn) {
      returnBtn.addEventListener("click", () => {
        window.returnUniformByCode(item.UniformCode);
      });
    }
  
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        console.log("🧨 Delete clicked (inventory card):", item.UniformCode);
        window.confirmDeleteUniform(item.UniformCode);
      });
    }
  },
  
  fillDetailModal(items = []) {
    const tbody = document.getElementById("codeListBody");
    if (!tbody) return;
  
    tbody.innerHTML = "";
  
    if (!Array.isArray(items)) items = [items];
  
    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; color: #999;">🚫 No uniform code data found</td>
        </tr>`;
      return;
    }
  
    for (const item of items) {
      const row = this.createDetailRow(item);
      tbody.appendChild(row);
      this.bindDetailRowEvents(row, item);
    }
  },
  
  createDetailRow(item) {
    const row = document.createElement("tr");
  
    row.innerHTML = `
      <td>${item.UniformCode}</td>
      <td>${item.EmployeeID || "-"}</td>
      <td>${item.EmployeeName || "-"}</td>
      <td>${item.EmployeDepartment || "-"}</td>
      <td>${item.Status}</td>
      <td>
        <div class="action-group">
          ${
            item.Status === "available"
              ? `<button class="action-btn assign" title="Assign">
                  <i class="fas fa-user-plus"></i>
                </button>`
              : `<button class="action-btn return" title="Return">
                  <i class="fas fa-undo-alt"></i>
                </button>`
          }
          <button class="action-btn delete" title="Delete">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    `;
  
    return row;
  },

  bindDetailRowEvents(row, item) {
    const assignBtn = row.querySelector(".action-btn.assign");
    const returnBtn = row.querySelector(".action-btn.return");
    const deleteBtn = row.querySelector(".action-btn.delete");
  
    if (assignBtn) {
      assignBtn.addEventListener("click", () => {
        window.openAssignFromCode(item.UniformCode);
      });
    }
  
    if (returnBtn) {
      returnBtn.addEventListener("click", () => {
        window.returnUniformByCode(item.UniformCode);
      });
    }
  
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        console.log("🧨 Delete clicked (modal row):", item.UniformCode);
        window.confirmDeleteUniform(item.UniformCode);
      });
    }
  },  

renderPagination(totalItems) {
  const container = document.getElementById("pagination");
  if (!container) return;

  container.innerHTML = "";

  const totalPages = Math.ceil(totalItems / this.rowsPerPage);
  for (let i = 1; i <= totalPages; i++) {
    const btn = this.createPaginationButton(i);
    container.appendChild(btn);
  }
},

createPaginationButton(page) {
  const btn = document.createElement("button");
  btn.textContent = page;
  btn.className = "pagination-btn";
  if (page === this.currentPage) btn.classList.add("active");

  btn.addEventListener("click", async () => {
    this.currentPage = page;
    const uniforms = await InventoryModel.fetchUniforms();
    await this.renderUniformBaseCards(uniforms);
  });
  return btn;
},

toggleModal(id, show = true) {
  const modal = document.getElementById(id);
  if (!modal) {
    console.warn(`Modal with ID "${id}" not found.`);
    return;
  }

  if (show) {
    modal.classList.remove("hidden");
  } else {
    modal.classList.add("hidden");
  }
},

prepareAssignForm() {
  const fields = ["assignEmployeeId", "assignEmployeeName", "assignUniformCode"];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
},

resetModals() {
  // Clear Add Code Form
  const addForm = document.getElementById("codeForm");
  if (addForm) addForm.reset();

  // Clear Assign Form
  const assignForm = document.getElementById("assignForm");
  if (assignForm) assignForm.reset();

  // Clear Table in Code List Modal
  const tbody = document.getElementById("codeListBody");
  if (tbody) tbody.innerHTML = "";
},

previewImportData(data = [], onConfirm = () => {}) {
  const generateTableRow = (item) => `
    <tr>
      <td>${item.UniformCode}</td>
      <td>${item.EmployeeID}</td>
      <td>${item.EmployeeName}</td>
      <td>${item.UniformType}</td>
      <td>${item.UniformSize}</td>
      <td>${item.UniformColor}</td>
      <td>${item.Status}</td>
    </tr>
  `;

  const tableHeader = `
    <thead>
      <tr>
        <th>Code</th>
        <th>ID</th>
        <th>Name</th>
        <th>Type</th>
        <th>Size</th>
        <th>Color</th>
        <th>Status</th>
      </tr>
    </thead>`;

  const tableBody = `<tbody>${data.map(generateTableRow).join("")}</tbody>`;

  Swal.fire({
    title: "📥 Preview Import",
    html: `
      <div class="preview-scroll">
        <table class="preview-table">
          ${tableHeader}
          ${tableBody}
        </table>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Import",
    cancelButtonText: "Cancel",
  }).then((result) => {
    if (result.isConfirmed) onConfirm();
  });


window.reloadUniformCards = async () => {
  try {
    await InventoryView.refreshAll();
  } catch (error) {
    console.error("❌ Failed to reload uniforms:", error);
  }
}}}
