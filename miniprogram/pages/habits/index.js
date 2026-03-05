const REMINDER_TEMPLATE_ID = "siFWEoBkxvgPO8HjBUxPGvc55Z3skgZ7WLB9g5U1gYM";

Page({
  data: {
    dateText: "",
    habits: [],
    pendingCount: 0,
    showAddDialog: false,
    newHabitName: "",
    newHabitRemindEnabled: false,
    newHabitRemindTime: "08:00"
  },

  onLoad() {
    this.initDate();
  },

  onShow() {
    this.loadState();
    this.maybeRequestDailySubscribe();
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
    if (wx.cloud) {
      wx.cloud
        .callFunction({
          name: "quickstartFunctions",
          data: {
            type: "deleteHabitReminderByHabitId",
            data: {
              habitId: id
            }
          }
        })
        .catch(() => {});
    }
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
      newHabitName: "",
      newHabitRemindEnabled: false,
      newHabitRemindTime: "08:00"
    });
  },

  onHabitNameInput(e) {
    this.setData({
      newHabitName: e.detail.value
    });
  },

  onToggleNewHabitRemind(e) {
    const value = !!(e.detail && e.detail.value);
    this.setData({
      newHabitRemindEnabled: value
    });
  },

  onNewHabitRemindTimeChange(e) {
    const value = (e.detail && e.detail.value) || "";
    this.setData({
      newHabitRemindTime: value || "08:00"
    });
  },

  onCancelAdd() {
    this.setData({
      showAddDialog: false,
      newHabitName: "",
      newHabitRemindEnabled: false,
      newHabitRemindTime: "08:00"
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
    if (this.data.newHabitRemindEnabled && this.data.newHabitRemindTime) {
      newHabit.remindEnabled = true;
      newHabit.remindTime = this.data.newHabitRemindTime;
      this.upsertHabitReminderToCloud(newHabit.id, true, this.data.newHabitRemindTime);
    } else {
      this.upsertHabitReminderToCloud(newHabit.id, false, "");
    }
    const nextHabits = baseHabits.concat(newHabit);
    wx.setStorageSync("habits", nextHabits);
    if (this.data.newHabitRemindEnabled && this.data.newHabitRemindTime) {
      this.requestSubscribeForReminder();
    }
    this.setData({
      showAddDialog: false,
      newHabitName: "",
      newHabitRemindEnabled: false,
      newHabitRemindTime: "08:00"
    });
    this.refreshHabits();
    this.saveStateToCloud();
  },

  requestSubscribeForReminder() {
    if (!wx.requestSubscribeMessage) {
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: [REMINDER_TEMPLATE_ID],
      success: (res) => {
        const status = res && res[REMINDER_TEMPLATE_ID];
        if (status === "accept") {
          wx.showToast({
            title: "订阅成功，将按提醒时间发送通知",
            icon: "none"
          });
        }
      }
    });
  },

  maybeRequestDailySubscribe() {
    if (!this.isLoggedIn()) {
      return;
    }
    if (!wx.requestSubscribeMessage) {
      return;
    }
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const mm = m < 10 ? `0${m}` : `${m}`;
    const dd = d < 10 ? `0${d}` : `${d}`;
    const today = `${y}-${mm}-${dd}`;
    const key = "lastDailySubscribeDate";
    const last = wx.getStorageSync(key);
    if (last === today) {
      return;
    }
    wx.setStorageSync(key, today);
    this.requestSubscribeForReminder();
  },

  upsertHabitReminderToCloud(habitId, active, remindTime) {
    if (!wx.cloud) {
      return;
    }
    const app = getApp();
    if (!app || !app.globalData || !app.globalData.env) {
      return;
    }
    wx.cloud.callFunction({
      name: "quickstartFunctions",
      data: {
        type: "upsertHabitReminder",
        data: {
          habitId,
          active: !!active,
          remindTime: remindTime || ""
        }
      }
    }).catch(() => {});
  },

  onCloseDialog() {
    this.setData({
      showAddDialog: false
    });
  },

  noop() {}
});
