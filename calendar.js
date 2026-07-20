const Calendar = {
    currentDate: new Date(),
    selectedDateStr: null,

    init() {
        this.renderWeekdays();
        this.render();
    },
    
    renderWeekdays() {
        const weekdaysGrid = document.getElementById('calendar-weekdays');
        if (weekdaysGrid.innerHTML === '') {
            const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Shabbos'];
            weekdays.forEach(day => {
                const header = document.createElement('div');
                header.className = 'weekday-header';
                // Uses spans matched with CSS to automatically shorten text on mobile screens
                header.innerHTML = `<span class="full-day">${day}</span><span class="short-day">${day.substring(0,3)}</span>`;
                weekdaysGrid.appendChild(header);
            });
        }
    },

    changeMonth(offset) {
        this.currentDate.setMonth(this.currentDate.getMonth() + offset);
        this.render();
    },

    formatDateStr(year, month, day) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    },

    render() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        document.getElementById('calendar-month-year').textContent = `${monthNames[month]} ${year}`;

        let monthlyCount = 0;
        State.data.transactions.forEach(t => {
            if (t.lendDate) {
                const d = new Date(t.lendDate + 'T00:00:00');
                if (d.getFullYear() === year && d.getMonth() === month) monthlyCount++;
            }
        });
        const statsEl = document.getElementById('monthly-stats');
        if (statsEl) {
            statsEl.textContent = `${monthlyCount} Gown${monthlyCount !== 1 ? 's' : ''} Lent This Month`;
        }

        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Empty padding for days before the 1st of the month
        for(let i = 0; i < firstDay; i++) {
            const pad = document.createElement('div');
            pad.className = 'calendar-day empty';
            grid.appendChild(pad);
        }

        const todayStr = this.formatDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

        for(let day = 1; day <= daysInMonth; day++) {
            const dateStr = this.formatDateStr(year, month, day);
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            
            if (dateStr === todayStr) dayEl.classList.add('today');
            if (dateStr === this.selectedDateStr) dayEl.classList.add('selected');

            dayEl.innerHTML = `<div class="day-number">${day}</div>`;
            dayEl.addEventListener('click', () => {
                document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
                dayEl.classList.add('selected');
                this.selectedDateStr = dateStr;
                UI.renderSidebar(dateStr);
            });

            this.appendDayBadges(dateStr, dayEl);
            grid.appendChild(dayEl);
        }
    },

    appendDayBadges(dateStr, dayEl) {
        State.data.transactions.filter(t => t.cleaningDate === dateStr).forEach(t => {
            const g = State.getGown(t.gownId);
            dayEl.innerHTML += `<div class="badge clean">Clean: ${g ? g.id : 'Unknown'}</div>`;
        });

        State.data.transactions.filter(t => t.lendDate === dateStr).forEach(t => {
            const g = State.getGown(t.gownId);
            dayEl.innerHTML += `<div class="badge lend">Lend: ${g ? g.id : 'Unknown'}</div>`;
        });

        State.data.events.filter(e => e.date === dateStr).forEach(e => {
            dayEl.innerHTML += `<div class="badge event">Memo: ${e.title}</div>`;
        });
    }
};
