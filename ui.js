const UI = {
    imageCache: {},

    async init() {
        await State.init();
        this.checkAuth();
        Calendar.init();
        this.setupEventListeners();
        this.populateDropdowns();
    },

    async loadAsyncImages() {
        const imgs = document.querySelectorAll('.async-image:not(.loaded)');
        for (let img of imgs) {
            img.classList.add('loaded');
            const id = img.getAttribute('data-gown-id');
            if (this.imageCache[id]) {
                img.src = this.imageCache[id];
            } else {
                const base64 = await Api.fetchImage(id);
                if (base64) {
                    this.imageCache[id] = base64;
                    img.src = base64;
                } else if (img.parentElement.classList.contains('detail-card-image-wrap')) {
                    img.parentElement.innerHTML = '<div class="detail-card-image placeholder">Error Loading</div>';
                }
            }
        }
    },
    
    checkAuth() {
        const overlay = document.getElementById('auth-overlay');
        const savedAuth = localStorage.getItem('gemach_auth');
        if(savedAuth === State.data.settings.password) {
            overlay.style.display = 'none';
        } else {
            overlay.style.display = 'flex';
        }
        
        document.getElementById('form-auth').addEventListener('submit', (e) => {
            e.preventDefault();
            const pass = document.getElementById('auth-password').value;
            if(pass === State.data.settings.password) {
                localStorage.setItem('gemach_auth', pass);
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display = 'none', 300);
            } else {
                document.getElementById('auth-error').style.display = 'block';
            }
        });
    },

    setupEventListeners() {
        document.getElementById('prev-month-btn').addEventListener('click', () => Calendar.changeMonth(-1));
        document.getElementById('next-month-btn').addEventListener('click', () => Calendar.changeMonth(1));
        
        document.getElementById('btn-today').addEventListener('click', () => {
            const today = new Date();
            Calendar.currentDate = today;
            Calendar.selectedDateStr = Calendar.formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());
            Calendar.render();
            this.renderSidebar(Calendar.selectedDateStr);
        });

        // Open Modals
        document.getElementById('btn-add-transaction').addEventListener('click', () => {
            this.populateDropdowns();
            this.openModal('modal-transaction');
        });
        
        // Open Gowns Manager
        document.getElementById('btn-manage-gowns').addEventListener('click', () => {
            if (this._debounce('openGownsMenu', 1000)) return;
            document.getElementById('search-manage-gowns').value = '';
            this.showLoading();
            setTimeout(() => {
                this.renderGowns();
                this.hideLoading();
                this.openModal('modal-gowns');
            }, 50);
        });

        // Open Add New Gown inside Gowns Manager
        document.getElementById('btn-open-add-gown').addEventListener('click', () => {
            document.getElementById('new-gown-id').value = State.getNextGownId();
            this.openModal('modal-add-gown');
        });

        document.getElementById('btn-open-gown-selector').addEventListener('click', () => {
            this.renderGownSelectionGrid();
            this.openModal('modal-select-gown');
        });
        document.getElementById('btn-settings').addEventListener('click', () => {
            document.getElementById('set-password').value = State.data.settings.password;
            document.getElementById('set-theme').value = State.data.settings.theme;
            document.getElementById('set-accent').value = State.data.settings.accent;
            document.getElementById('set-secondary').value = State.data.settings.secondary;
            this.openModal('modal-settings');
        });

        // Close Modals
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.closeModal(e.target.dataset.modal));
        });

        // Forms
        document.getElementById('trans-user').addEventListener('change', (e) => {
            document.getElementById('new-user-fields').style.display = e.target.value === 'NEW' ? 'block' : 'none';
        });
        document.getElementById('trans-deposit').addEventListener('change', (e) => {
            document.getElementById('custom-deposit-field').style.display = e.target.value === 'CUSTOM' ? 'block' : 'none';
        });
        
        // Search filters
        document.getElementById('search-gown').addEventListener('input', (e) => this.renderGownSelectionGrid(e.target.value));
        document.getElementById('search-manage-gowns').addEventListener('input', (e) => this.renderGowns(e.target.value));

        document.getElementById('form-transaction').addEventListener('submit', this.handleTransactionSubmit.bind(this));
        document.getElementById('form-add-gown').addEventListener('submit', this.handleAddGownSubmit.bind(this));
        document.getElementById('form-edit-gown').addEventListener('submit', this.handleEditGownSubmit.bind(this));
        document.getElementById('form-memo').addEventListener('submit', this.handleMemoSubmit.bind(this));
        document.getElementById('form-reschedule').addEventListener('submit', this.handleRescheduleSubmit.bind(this));
        document.getElementById('form-settings').addEventListener('submit', this.handleSettingsSubmit.bind(this));
    },

    openModal(id) { document.getElementById(id).classList.add('active'); },
    closeModal(id) { 
        document.getElementById(id).classList.remove('active'); 
        const form = document.getElementById(id).querySelector('form');
        if(form) form.reset();
        if(id === 'modal-transaction') {
            document.getElementById('new-user-fields').style.display = 'none';
            document.getElementById('custom-deposit-field').style.display = 'none';
            document.getElementById('trans-gown').value = '';
            document.getElementById('selected-gown-text').textContent = 'No Gown Selected';
        }
    },

    _busy: false,
    _debounceMap: {},
    // Returns true (blocked) if currently saving OR called again within `ms` ms.
    _debounce(key, ms = 4000) {
        if (this._busy) return true;
        const now = Date.now();
        if (this._debounceMap[key] && now - this._debounceMap[key] < ms) return true;
        this._debounceMap[key] = now;
        return false;
    },
    showLoading() { this._busy = true; document.getElementById('loading-overlay').classList.add('active'); },
    hideLoading() { this._busy = false; document.getElementById('loading-overlay').classList.remove('active'); },
    
    compressImage(file, callback) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 300; 
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                callback(canvas.toDataURL('image/jpeg', 0.6)); 
            }
        }
    },

    populateDropdowns() {
        const userSelect = document.getElementById('trans-user');
        userSelect.innerHTML = `<option value="">-- Select Existing or Add New --</option><option value="NEW">+ Add New Customer</option>`;
        State.data.users.forEach(u => {
            userSelect.innerHTML += `<option value="${u.id}">${u.name} (${u.phone})</option>`;
        });
    },
    
    renderGownSelectionGrid(searchQuery = '') {
        const grid = document.getElementById('gown-selection-grid');
        grid.innerHTML = '';
        const lowerSearch = searchQuery.toLowerCase();
        
        State.data.gowns.forEach(g => {
            if (g.id.toLowerCase().includes(lowerSearch) || g.name.toLowerCase().includes(lowerSearch)) {
                const imgHTML = g.hasImage ? `<img data-gown-id="${g.id}" src="" class="gown-image async-image" alt="Gown">` : `<div class="gown-image placeholder">No Image</div>`;
                
                const card = document.createElement('div');
                card.className = 'gown-card';
                card.innerHTML = `
                    ${imgHTML}
                    <div class="gown-info" style="padding: 10px;">
                        <div style="font-size:0.9rem;"><strong>${g.id}</strong><br><span style="color:var(--text-muted);">${g.name}</span></div>
                    </div>
                `;
                card.onclick = () => {
                    document.getElementById('trans-gown').value = g.id;
                    document.getElementById('selected-gown-text').textContent = `${g.id} - ${g.name}`;
                    this.closeModal('modal-select-gown');
                };
                grid.appendChild(card);
            }
        });
        this.loadAsyncImages();
    },

    calculateCleaningDate(lendDateStr) {
        const d = new Date(lendDateStr);
        d.setDate(d.getDate() - 21);
        return d.toISOString().split('T')[0];
    },

    async handleTransactionSubmit(e) {
        e.preventDefault();
        if (this._debounce('addTransaction')) return;
        
        const gownId = document.getElementById('trans-gown').value;
        if (!gownId) { alert("Please select a gown."); return; }

        // --- NEW: Grab date early & check for 3-day conflict ---
        const lendDate = document.getElementById('trans-date').value;
        const newLendDate = new Date(lendDate + 'T00:00:00');
        
        const conflict = State.data.transactions.find(t => {
            if (t.gownId === gownId && t.lendDate) {
                const existingDate = new Date(t.lendDate + 'T00:00:00');
                const diffTime = Math.abs(newLendDate - existingDate);
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                return diffDays <= 3; // Within 3 days before OR after
            }
            return false;
        });

        if (conflict) {
            alert(`Cannot complete: This gown is already scheduled to be lent out on ${conflict.lendDate}, which is within 3 days of your selected date.`);
            return; // Stop form submission
        }
        // --- END CONFLICT CHECK ---

        let userId = document.getElementById('trans-user').value;
        if (userId === 'NEW') {
            const newUser = {
                name: document.getElementById('nu-name').value,
                phone: document.getElementById('nu-phone').value,
                email: document.getElementById('nu-email').value
            };
            await State.addUser(newUser);
            userId = State.data.users[State.data.users.length - 1].id;
        }

        let depositVal = document.getElementById('trans-deposit').value;
        if(depositVal === 'CUSTOM') depositVal = document.getElementById('trans-custom-deposit').value;

        // (lendDate was already defined at the top, so we just calculate cleaningDate)
        const cleaningDate = this.calculateCleaningDate(lendDate);

        this.showLoading();
        await State.addTransaction({
            gownId: gownId,
            userId: userId,
            lendDate: lendDate,
            cleaningDate: cleaningDate,
            deposit: depositVal
        });
        this.hideLoading();

        this.closeModal('modal-transaction');
        Calendar.render();
        if(Calendar.selectedDateStr) this.renderSidebar(Calendar.selectedDateStr);
    },

    async handleSettingsSubmit(e) {
        e.preventDefault();
        if (this._debounce('saveSettings')) return;
        const newSettings = {
            password: document.getElementById('set-password').value,
            theme: document.getElementById('set-theme').value,
            accent: document.getElementById('set-accent').value,
            secondary: document.getElementById('set-secondary').value
        };
        this.showLoading();
        await State.updateSettings(newSettings);
        this.hideLoading();
        localStorage.setItem('gemach_auth', newSettings.password); 
        this.closeModal('modal-settings');
    },

    renderGowns(searchQuery = '') {
        const list = document.getElementById('gown-list');
        list.innerHTML = '';
        const lowerSearch = searchQuery.toLowerCase();
        
        State.data.gowns.forEach(g => {
            if (g.id.toLowerCase().includes(lowerSearch) || g.name.toLowerCase().includes(lowerSearch)) {
                const imgHTML = g.hasImage ? `<img data-gown-id="${g.id}" src="" class="gown-image async-image" alt="Gown">` : `<div class="gown-image placeholder">No Image</div>`;
                
                // Use createElement instead of innerHTML += to prevent lag
                const card = document.createElement('div');
                card.className = 'gown-card';
                card.innerHTML = `
                    ${imgHTML}
                    <div class="gown-info">
                        <div><strong>${g.id}</strong><br><span style="color:var(--text-muted);font-size:0.9rem;">${g.name}</span></div>
                        <div style="display:flex; gap:5px; flex-wrap:wrap;">
                            <button type="button" class="btn secondary small" style="flex:1;" onclick="UI.promptEditGown('${g.id}')">Edit</button>
                            <button type="button" class="btn danger small" style="flex:1;" onclick="UI.deleteGown('${g.id}')">Delete</button>
                        </div>
                        <button type="button" class="btn small" style="background:var(--surface); color:var(--text-main); border: 1px solid var(--border-color);" onclick="UI.openHistoryModal('${g.id}')">View History</button>
                    </div>
                `;
                list.appendChild(card);
            }
        });
        
        this.loadAsyncImages(); // Trigger background load
    },

    openHistoryModal(id) {
        const g = State.getGown(id);
        if(!g) return;
        
        document.getElementById('history-modal-title').textContent = `History: ${g.id}`;
        
        const history = State.getGownHistory(id);
        const container = document.getElementById('history-modal-content');
        container.innerHTML = '';
        
        if (history.length === 0) {
            container.innerHTML = '<p class="empty-state">No history found for this gown.</p>';
        } else {
            history.forEach(h => {
                const typeClass = h.type === 'clean' ? 'clean' : 'lend';
                const icon = h.type === 'clean' ? '🧹' : '👗';
                container.innerHTML += `
                    <div class="history-modal-item ${typeClass}">
                        <strong class="action-title">${icon} ${h.action}</strong>
                        <span><strong>Date:</strong> ${h.date}</span>
                        <span><strong>Customer:</strong> ${h.user}</span>
                    </div>
                `;
            });
        }
        
        this.openModal('modal-gown-history');
    },
    
    async handleAddGownSubmit(e) {
        e.preventDefault();
        if (this._debounce('addGown')) return;

        const id = document.getElementById('new-gown-id').value;
        const name = document.getElementById('new-gown-name').value;
        const fileInput = document.getElementById('new-gown-image-file');

        const performAdd = async (base64Img) => {
            this.showLoading();
            const result = await State.addGown(id, name, base64Img);
            this.hideLoading();

            if (!result) {
                alert("This Gown ID already exists!");
                return;
            }

            document.getElementById('form-add-gown').reset();
            this.closeModal('modal-add-gown');
            this.renderGowns(document.getElementById('search-manage-gowns').value);
            this.populateDropdowns();
        };

        if (fileInput.files && fileInput.files[0]) {
            this.compressImage(fileInput.files[0], (b64) => performAdd(b64));
        } else {
            await performAdd('');
        }
    },
    
    promptEditGown(id) {
        const g = State.getGown(id);
        document.getElementById('edit-gown-original-id').value = g.id;
        document.getElementById('edit-gown-id').value = g.id;
        document.getElementById('edit-gown-name').value = g.name;
        document.getElementById('edit-gown-image-file').value = '';
        this.openModal('modal-edit-gown');
    },

    async handleEditGownSubmit(e) {
        e.preventDefault();
        if (this._debounce('editGown')) return;

        const oldId = document.getElementById('edit-gown-original-id').value;
        const newId = document.getElementById('edit-gown-id').value.trim();
        const newName = document.getElementById('edit-gown-name').value.trim();
        const fileInput = document.getElementById('edit-gown-image-file');

        const performEdit = async (base64Img) => {
            this.showLoading();
            const result = await State.updateGown(oldId, newId, newName, base64Img);
            this.hideLoading();
            if (result === false) {
                alert("Update Failed: That Barcode/ID is already in use by another gown.");
            } else {
                this.closeModal('modal-edit-gown');
                if (base64Img) delete this.imageCache[newId];
                this.renderGowns(document.getElementById('search-manage-gowns').value);
                this.populateDropdowns();
                Calendar.render();
                if(Calendar.selectedDateStr) this.renderSidebar(Calendar.selectedDateStr);
            }
        };

        if (fileInput.files && fileInput.files[0]) {
            this.compressImage(fileInput.files[0], (b64) => performEdit(b64));
        } else {
            await performEdit(undefined);
        }
    },
    
    async deleteGown(id) {
        if (this._debounce('deleteGown-' + id)) return;
        if(confirm(`Are you sure you want to delete gown ${id}?`)) {
            this.showLoading();
            await State.deleteGown(id);
            this.hideLoading();
            this.renderGowns(document.getElementById('search-manage-gowns').value);
            this.populateDropdowns();
            Calendar.render();
        }
    },

    async deleteTransaction(id) {
        if (this._debounce('deleteTransaction-' + id)) return;
        if(confirm("Are you sure you want to delete this event? This will remove BOTH the scheduled cleaning and lending for this transaction.")) {
            this.showLoading();
            await State.deleteTransaction(id);
            this.hideLoading();
            Calendar.render();
            if(Calendar.selectedDateStr) this.renderSidebar(Calendar.selectedDateStr);
        }
    },

    renderSidebar(dateStr) {
        const localDate = new Date(dateStr + 'T00:00:00');
        document.getElementById('sidebar-date-title').textContent = localDate.toDateString();
        
        const content = document.getElementById('sidebar-content');
        content.innerHTML = '';
        let hasItems = false;

        State.data.transactions.filter(t => t.cleaningDate === dateStr).forEach(t => {
            hasItems = true;
            const u = State.getUser(t.userId);
            const g = State.getGown(t.gownId);
            const imgHTML = g && g.hasImage 
                ? `<div class="detail-card-image-wrap" onclick="UI.openImageModal(this.querySelector('img').src, '${(g.name || '').replace(/'/g, "&apos;")}')">
                       <img data-gown-id="${g.id}" src="" class="detail-card-image async-image" alt="${g.name}">
                       <div class="image-expand-label">Expand</div>
                   </div>` 
                : `<div class="detail-card-image placeholder">No Image</div>`;

            content.innerHTML += `
                <div class="detail-card clean has-image">
                    <div class="detail-card-content">
                        <h4>🧹 Gown Cleaning (${g ? g.id : t.gownId})</h4>
                        <p>Reserved for: ${u ? u.name : 'Unknown'}</p>
                        <div style="display:flex; gap:5px;">
                            <button class="btn secondary small" onclick="UI.promptReschedule('${t.id}', 'CLEAN', '${dateStr}')">Reschedule</button>
                        </div>
                    </div>
                    ${imgHTML}
                </div>`;
        });

        State.data.transactions.filter(t => t.lendDate === dateStr).forEach(t => {
            hasItems = true;
            const u = State.getUser(t.userId);
            const g = State.getGown(t.gownId);
            const imgHTML = g && g.hasImage 
                ? `<div class="detail-card-image-wrap" onclick="UI.openImageModal(this.querySelector('img').src, '${(g.name || '').replace(/'/g, "&apos;")}')">
                       <img data-gown-id="${g.id}" src="" class="detail-card-image async-image" alt="${g.name}">
                       <div class="image-expand-label">Expand</div>
                   </div>` 
                : `<div class="detail-card-image placeholder">No Image</div>`;

            content.innerHTML += `
                <div class="detail-card lend has-image">
                    <div class="detail-card-content">
                        <h4>👗 Lending Out (${g ? g.id : t.gownId})</h4>
                        <p>Customer: ${u ? u.name : 'Unknown'} (${u ? u.phone : 'No Phone'})</p>
                        <p>Deposit: $${t.deposit}</p>
                        <div style="display:flex; gap:5px;">
                            <button class="btn secondary small" onclick="UI.promptReschedule('${t.id}', 'LEND', '${dateStr}')">Reschedule</button>
                            <button class="btn danger small" onclick="UI.deleteTransaction('${t.id}')">Delete</button>
                        </div>
                    </div>
                    ${imgHTML}
                </div>`;
        });

        State.data.events.filter(e => e.date === dateStr).forEach(e => {
            hasItems = true;
            content.innerHTML += `<div class="detail-card event"><h4>📝 Memo</h4><p>${e.title}</p><div style="display:flex; gap:5px; margin-top:10px;"><button class="btn secondary small" onclick="UI.promptReschedule('${e.id}', 'EVENT', '${dateStr}')">Reschedule</button><button class="btn danger small" onclick="UI.deleteMemo('${e.id}')">Delete</button></div></div>`;
        });

        if(!hasItems) { content.innerHTML += '<p class="empty-state">No cleanings, lendings, or memos scheduled for this day.</p>'; }
        content.innerHTML += `<div style="margin-top: 20px;"><button class="btn secondary full-width" onclick="UI.promptAddMemo('${dateStr}')">+ Add Memo for this Date</button></div>`;
        this.loadAsyncImages();
    },

    promptAddMemo(dateStr) { document.getElementById('memo-date').value = dateStr; this.openModal('modal-memo'); },

    openImageModal(src, alt) {
        document.getElementById('image-expand-img').src = src;
        document.getElementById('image-expand-img').alt = alt || 'Gown';
        this.openModal('modal-image-expand');
    },
    closeImageModal() {
        const modal = document.getElementById('modal-image-expand');
        modal.classList.remove('active');
        setTimeout(() => { document.getElementById('image-expand-img').src = ''; }, 300);
    },

    async handleMemoSubmit(e) { e.preventDefault(); if (this._debounce('addMemo')) return; this.showLoading(); await State.addMemo({ date: document.getElementById('memo-date').value, text: document.getElementById('memo-text').value }); this.hideLoading(); this.closeModal('modal-memo'); Calendar.render(); if(Calendar.selectedDateStr) this.renderSidebar(Calendar.selectedDateStr); },
    async deleteMemo(id) { if (this._debounce('deleteMemo-' + id)) return; if(confirm("Delete this memo?")) { this.showLoading(); await State.deleteMemo(id); this.hideLoading(); Calendar.render(); if(Calendar.selectedDateStr) this.renderSidebar(Calendar.selectedDateStr); } },
    
    promptReschedule(id, type, currentDate) {
        document.getElementById('reschedule-id').value = id;
        document.getElementById('reschedule-type').value = type;
        document.getElementById('reschedule-date').value = currentDate;
        const typeStr = type === 'LEND' ? 'Lending Date' : (type === 'CLEAN' ? 'Cleaning Date' : 'Memo Date');
        document.getElementById('reschedule-desc').textContent = `Select a new date for this ${typeStr}.`;
        this.openModal('modal-reschedule');
    },

    async handleRescheduleSubmit(e) {
        e.preventDefault();
        if (this._debounce('reschedule')) return;
        this.closeModal('modal-reschedule');
        this.showLoading();
        await State.reschedule(document.getElementById('reschedule-id').value, document.getElementById('reschedule-type').value, document.getElementById('reschedule-date').value);
        this.hideLoading();
        Calendar.render();
        if(Calendar.selectedDateStr) this.renderSidebar(Calendar.selectedDateStr);
    }
};

document.addEventListener('DOMContentLoaded', () => UI.init());
