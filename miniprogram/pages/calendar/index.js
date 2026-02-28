Page({
  data: {
    year: 0,
    month: 0,
    weekDays: ["日", "一", "二", "三", "四", "五", "六"],
    days: [],
    selectedDate: "",
    selectedDateText: "",
    selectedDateSummary: "",
    selectedHabits: []
  },

  onLoad() {
    this.loadStateAndInit();
  },

  onShow() {
    if (!this.data.year || !this.data.month) {
      return;
    }
    if (this.isCloudAvailable()) {
      wx.cloud
        .callFunction({
          name: "quickstartFunctions",
          data: {
            type: "getHabitState",
          },
        })
        .then((res) => {
          const result = res.result || {};
          if (result.success && result.data) {
            const habits = result.data.habits || [];
            const habitLogs = result.data.habitLogs || {};
            wx.setStorageSync("habits", habits);
            wx.setStorageSync("habitLogs", habitLogs);
          }
          const logs = this.loadLogs();
          this.buildDays(this.data.year, this.data.month, logs);
          if (this.data.selectedDate) {
            this.updateSelectedDate(this.data.selectedDate, logs);
          }
        })
        .catch(() => {
          const logs = this.loadLogs();
          this.buildDays(this.data.year, this.data.month, logs);
          if (this.data.selectedDate) {
            this.updateSelectedDate(this.data.selectedDate, logs);
          }
        });
    } else {
      const logs = this.loadLogs();
      this.buildDays(this.data.year, this.data.month, logs);
      if (this.data.selectedDate) {
        this.updateSelectedDate(this.data.selectedDate, logs);
      }
    }
  },

  getCloudEnv() {
    const app = getApp();
    if (!app || !app.globalData || !app.globalData.env) {
      return "";
    }
    return app.globalData.env;
  },

  isCloudAvailable() {
    return !!wx.cloud && !!this.getCloudEnv();
  },

  loadStateAndInit() {
    if (!this.isCloudAvailable()) {
      this.initCalendar();
      return;
    }
    wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: {
          type: "getHabitState",
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (result.success && result.data) {
          const habits = result.data.habits || [];
          const habitLogs = result.data.habitLogs || {};
          wx.setStorageSync("habits", habits);
          wx.setStorageSync("habitLogs", habitLogs);
        }
        this.initCalendar();
      })
      .catch(() => {
        this.initCalendar();
      });
  },

  formatDateKey(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const mm = m < 10 ? `0${m}` : `${m}`;
    const dd = d < 10 ? `0${d}` : `${d}`;
    return `${y}-${mm}-${dd}`;
  },

  loadBaseHabits() {
    const stored = wx.getStorageSync("habits");
    if (stored && Array.isArray(stored)) {
      return stored.map((item, index) => ({
        id: item.id || index + 1,
        name: item.name,
        createdAt: item.createdAt || ""
      }));
    }
    return [];
  },

  loadLogs() {
    const stored = wx.getStorageSync("habitLogs");
    if (stored && typeof stored === "object") {
      return stored;
    }
    return {};
  },

  initCalendar() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const logs = this.loadLogs();
    this.setData({
      year,
      month
    });
    this.buildDays(year, month, logs);
    this.updateSelectedDate(this.formatDateKey(today), logs);
  },

  buildDays(year, month, logs) {
    const firstDay = new Date(year, month - 1, 1);
    const firstWeekDay = firstDay.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();
    const todayKey = this.formatDateKey(new Date());
    const list = [];

    for (let i = firstWeekDay - 1; i >= 0; i--) {
      const date = prevMonthDays - i;
      const dateKey = this.formatDateKey(new Date(year, month - 2, date));
      const dayLog = logs[dateKey] || {};
      const hasCheck = Object.keys(dayLog).length > 0;
      list.push({
        date,
        dateKey,
        isCurrentMonth: false,
        isToday: dateKey === todayKey,
        hasCheck
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = this.formatDateKey(new Date(year, month - 1, d));
      const dayLog = logs[dateKey] || {};
      const hasCheck = Object.keys(dayLog).length > 0;
      list.push({
        date: d,
        dateKey,
        isCurrentMonth: true,
        isToday: dateKey === todayKey,
        hasCheck
      });
    }

    const total = list.length;
    const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
    const nextMonthDate = new Date(year, month, 1);
    for (let d = 1; d <= remaining; d++) {
      const dateKey = this.formatDateKey(
        new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), d)
      );
      const dayLog = logs[dateKey] || {};
      const hasCheck = Object.keys(dayLog).length > 0;
      list.push({
        date: d,
        dateKey,
        isCurrentMonth: false,
        isToday: dateKey === todayKey,
        hasCheck
      });
    }

    this.setData({
      days: list
    });
  },

  onPrevMonth() {
    let { year, month } = this.data;
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    const logs = this.loadLogs();
    this.setData({
      year,
      month
    });
    this.buildDays(year, month, logs);
    const firstDayKey = this.data.days.find((item) => item.isCurrentMonth)?.dateKey;
    if (firstDayKey) {
      this.updateSelectedDate(firstDayKey, logs);
    }
  },

  onNextMonth() {
    let { year, month } = this.data;
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
    const logs = this.loadLogs();
    this.setData({
      year,
      month
    });
    this.buildDays(year, month, logs);
    const firstDayKey = this.data.days.find((item) => item.isCurrentMonth)?.dateKey;
    if (firstDayKey) {
      this.updateSelectedDate(firstDayKey, logs);
    }
  },

  onSelectDate(e) {
    const dateKey = e.currentTarget.dataset.date;
    const logs = this.loadLogs();
    this.updateSelectedDate(dateKey, logs);
  },

  updateSelectedDate(dateKey, logsOverride) {
    if (!dateKey) return;
    const parts = dateKey.split("-");
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    const dateText = `${month}月${day}日`;
    const logs = logsOverride || this.loadLogs();
    const habits = this.loadBaseHabits();
    const dayLog = logs[dateKey] || {};
    const selectedHabits = habits.map((item) => ({
      id: item.id,
      name: item.name,
      completed: !!dayLog[item.id]
    }));
    const doneCount = selectedHabits.filter((h) => h.completed).length;
    const summary = selectedHabits.length
      ? `已打卡 ${doneCount} 个习惯`
      : "暂无习惯";
    this.setData({
      selectedDate: dateKey,
      selectedDateText: dateText,
      selectedDateSummary: summary,
      selectedHabits
    });
  }
});
