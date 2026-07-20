const State = {
    data: {
        settings: {
            password: '1234',
            theme: 'dark',
            accent: '#d4af37',
            secondary: '#bb86fc'
        },
        gowns: [],
        users: [],
        transactions: [],
        events: [] 
    },
    
    isSaving: false,
    saveQueue: false,

    async init() {
        let gistData = await Api.fetchGistData();
        
        if (!gistData) {
            this.data.gowns = [];
            await this.save(); 
        } else {
            this.data = gistData;
            // Ensure settings exists for older datasets
            if(!this.data.settings) {
                this.data.settings = { password: '1234', theme: 'dark', accent: '#d4af37', secondary: '#bb86fc' };
            } else if (!this.data.settings.secondary) {
                this.data.settings.secondary = '#bb86fc';
            }
        }
        
        this.applySettings();
    },
    
    applySettings() {
        document.documentElement.setAttribute('data-theme', this.data.settings.theme);
        document.documentElement.style.setProperty('--primary', this.data.settings.accent);
        document.documentElement.style.setProperty('--secondary', this.data.settings.secondary);
    },
    
    updateSettings(newSettings) {
        this.data.settings = newSettings;
        this.applySettings();
        return this.save();
    },

    async save() {
        if (this.isSaving) {
            this.saveQueue = true;
            return;
        }
        this.isSaving = true;
        const btn = document.getElementById('submit-transaction');
        if(btn) { btn.textContent = "Saving..."; btn.disabled = true; }
        
        await Api.saveGistData(this.data);
        
        this.isSaving = false;
        if(btn) { btn.textContent = "Save Transaction"; btn.disabled = false; }

        if (this.saveQueue) {
            this.saveQueue = false;
            this.save(); 
        }
    },

    addTransaction(transaction) {
        transaction.id = 'T-' + Date.now();
        this.data.transactions.push(transaction);
        return this.save();
    },
    
    deleteTransaction(id) {
        this.data.transactions = this.data.transactions.filter(t => t.id !== id);
        return this.save();
    },

    addUser(user) {
        user.id = 'U-' + Date.now();
        this.data.users.push(user);
        return this.save();
    },

    getNextGownId() {
        if (this.data.gowns.length === 0) return "GWN-0001";
        let max = 0;
        this.data.gowns.forEach(g => {
            const match = g.id.match(/^GWN-(\d+)$/i);
            if(match) {
                const num = parseInt(match[1], 10);
                if(num > max) max = num;
            }
        });
        if (max === 0) return `GWN-${String(this.data.gowns.length + 1).padStart(4, '0')}`;
        return `GWN-${String(max + 1).padStart(4, '0')}`;
    },

    async addGown(id, name, base64Img) {
        if (this.data.gowns.find(g => g.id === id)) return false; 

        let hasImage = false;
        if (base64Img) {
            await Api.uploadImage(id, base64Img);
            hasImage = true;
        }

        this.data.gowns.push({ id, name, hasImage });
        await this.save();
        return true;
    },

    async updateGown(oldId, newId, newName, newBase64Img) {
        if (oldId !== newId && this.data.gowns.find(x => x.id === newId)) return false; 
        
        const g = this.data.gowns.find(x => x.id === oldId);
        if(g) {
            g.id = newId;
            g.name = newName;

            if (newBase64Img) {
                await Api.uploadImage(newId, newBase64Img);
                g.hasImage = true;
            } else if (newBase64Img === undefined && oldId !== newId && g.hasImage) {
                const oldImgData = await Api.fetchImage(oldId);
                if (oldImgData) await Api.uploadImage(newId, oldImgData);
            }

            this.data.transactions.forEach(t => {
                if (t.gownId === oldId) t.gownId = newId;
            });
        }
        await this.save();
        return true;
    },

    deleteGown(id) {
        this.data.gowns = this.data.gowns.filter(x => x.id !== id);
        return this.save();
    },
    
    getGownHistory(id) {
        const history = [];
        this.data.transactions.forEach(t => {
            if (t.gownId === id) {
                const u = this.getUser(t.userId);
                const userName = u ? u.name : 'Unknown Customer';
                
                if(t.cleaningDate) history.push({ type: 'clean', action: 'Cleaned', date: t.cleaningDate, user: userName });
                if(t.lendDate) history.push({ type: 'lend', action: 'Lent Out', date: t.lendDate, user: userName });
            }
        });
        return history.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    addMemo(memo) {
        memo.id = 'M-' + Date.now();
        this.data.events.push({ id: memo.id, title: memo.text, date: memo.date });
        return this.save();
    },
    
    deleteMemo(id) {
        this.data.events = this.data.events.filter(e => e.id !== id);
        return this.save();
    },

    reschedule(id, type, newDate) {
        if(type === 'LEND') {
            const t = this.data.transactions.find(x => x.id === id);
            if(t) t.lendDate = newDate;
        } else if (type === 'CLEAN') {
            const t = this.data.transactions.find(x => x.id === id);
            if(t) t.cleaningDate = newDate;
        } else if (type === 'EVENT') {
            const e = this.data.events.find(x => x.id === id);
            if(e) e.date = newDate;
        }
        return this.save();
    },

    getUser(userId) { return this.data.users.find(u => u.id === userId); },
    getGown(gownId) { return this.data.gowns.find(g => g.id === gownId); }
};
