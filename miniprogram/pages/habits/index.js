Page({
  data: {
    dateText: "",
    habits: [],
    pendingCount: 0,
    showAddDialog: false,
    newHabitName: ""
  },

  onLoad() {
    this.initDate();
  },

  onShow() {
    this.loadState();
  },

  getCloudEnv() {
    return "";
  },
 
  isCloudAvailable() {
    return false;
  },

  isLoggedIn() {
    const info = wx.getStorageSync("userInfo");
    return !!(info && info.nickName);
  },

  initDate() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    this.setData({
      dateText: `${month}月${day}日`
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

  getTodayKey() {
    return this.formatDateKey(new Date());
  },

  formatTime(date) {
    const h = date.getHours();
    const m = date.getMinutes();
    const hh = h < 10 ? `0${h}` : `${h}`;
    const mm = m < 10 ? `0${m}` : `${m}`;
    return `${hh}:${mm}`;
  },

  ensureInitialData() {
    const storedHabits = wx.getStorageSync("habits");
    if (!storedHabits || !Array.isArray(storedHabits)) {
      wx.setStorageSync("habits", []);
    }
    const storedLogs = wx.getStorageSync("habitLogs");
    if (!storedLogs || typeof storedLogs !== "object") {
      wx.setStorageSync("habitLogs", {});
    }
  },

  loadState() {
    if (!this.isLoggedIn()) {
      this.setData({
        habits: [],
        pendingCount: 0
      });
      return;
    }
    this.ensureInitialData();
    this.refreshHabits();
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

  saveStateToCloud() {
    return;
  },

  getPendingCount(habits) {
    return habits.filter((item) => !item.completed).length;
  },

  refreshHabits() {
    const habits = this.loadBaseHabits();
    const logs = this.loadLogs();
    const todayKey = this.getTodayKey();
    const daysCount = {};
    Object.keys(logs).forEach((dateKey) => {
      const dayLog = logs[dateKey];
      Object.keys(dayLog || {}).forEach((idStr) => {
        const id = Number(idStr);
        daysCount[id] = (daysCount[id] || 0) + 1;
      });
    });
    const todayLogs = logs[todayKey] || {};
    const viewHabits = habits.map((item) => ({
      id: item.id,
      name: item.name,
      days: daysCount[item.id] || 0,
      completed: !!todayLogs[item.id]
    }));
    this.setData({
      habits: viewHabits,
      pendingCount: this.getPendingCount(viewHabits)
    });
  },

  toggleTodayForHabit(id) {
    const logs = this.loadLogs();
    const todayKey = this.getTodayKey();
    const dayLog = logs[todayKey] || {};
    if (dayLog[id]) {
      delete dayLog[id];
    } else {
      dayLog[id] = this.formatTime(new Date());
    }
    logs[todayKey] = dayLog;
    wx.setStorageSync("habitLogs", logs);
    this.saveStateToCloud();
  },

  onToggleHabit(e) {
    if (!this.isLoggedIn()) {
      wx.showToast({
        title: "请先登录后再打卡",
        icon: "none"
      });
      return;
    }
    const id = Number(e.currentTarget.dataset.id);
    this.toggleTodayForHabit(id);
    this.refreshHabits();
  },
  onLongPressHabit(e) {
    if (!this.isLoggedIn()) {
      wx.showToast({
        title: "请先登录后再编辑习惯",
        icon: "none"
      });
      return;
    }
    const id = Number(e.currentTarget.dataset.id);
    const habits = this.data.habits || [];
    const target = habits.find((item) => item.id === id) || null;
    const name = target ? target.name : "";
    const content = name
      ? `确定删除「${name}」？将删除所有相关打卡记录。`
      : "确定删除这个习惯？将删除所有相关打卡记录。";
    wx.showModal({
      title: "删除习惯",
      content,
      confirmText: "删除",
      cancelText: "取消",
      confirmColor: "#f97373",
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        this.deleteHabitById(id);
      }
    });
  },

  deleteHabitById(id) {
    const baseHabits = this.loadBaseHabits();
    const nextHabits = baseHabits.filter((item) => item.id !== id);
    const logs = this.loadLogs();
    Object.keys(logs).forEach((dateKey) => {
      const dayLog = logs[dateKey] || {};
      if (dayLog[id]) {
        delete dayLog[id];
      }
      logs[dateKey] = dayLog;
    });
    wx.setStorageSync("habits", nextHabits);
    wx.setStorageSync("habitLogs", logs);
    this.refreshHabits();
    this.saveStateToCloud();
  },

  onAddHabit() {
    if (!this.isLoggedIn()) {
      wx.showToast({
        title: "请先登录后再创建习惯",
        icon: "none"
      });
      return;
    }
    this.setData({
      showAddDialog: true,
      newHabitName: ""
    });
  },

  onHabitNameInput(e) {
    this.setData({
      newHabitName: e.detail.value
    });
  },

  onCancelAdd() {
    this.setData({
      showAddDialog: false,
      newHabitName: ""
    });
  },

  onConfirmAdd() {
    if (!this.isLoggedIn()) {
      wx.showToast({
        title: "请先登录后再创建习惯",
        icon: "none"
      });
      return;
    }
    const name = (this.data.newHabitName || "").trim();
    if (!name) {
      wx.showToast({
        title: "请输入习惯名称",
        icon: "none"
      });
      return;
    }
    const baseHabits = this.loadBaseHabits();
    const lowerName = name.toLowerCase();
    const exists = baseHabits.some((item) => {
      const n = (item.name || "").trim().toLowerCase();
      return n === lowerName;
    });
    if (exists) {
      wx.showToast({
        title: "该习惯已存在",
        icon: "none"
      });
      return;
    }
    const maxId = baseHabits.reduce(
      (max, item) => (item.id > max ? item.id : max),
      0
    );
    const newHabit = {
      id: maxId + 1,
      name,
      createdAt: this.getTodayKey()
    };
    const nextHabits = baseHabits.concat(newHabit);
    wx.setStorageSync("habits", nextHabits);
    this.setData({
      showAddDialog: false,
      newHabitName: ""
    });
    this.refreshHabits();
    this.saveStateToCloud();
  },

  onCloseDialog() {
    this.setData({
      showAddDialog: false
    });
  },

  noop() {}
});
