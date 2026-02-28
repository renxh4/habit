Page({
  data: {
    dateText: "",
    habits: [],
    pendingCount: 0,
    showAddDialog: false,
    newHabitName: "",
    activeDeleteId: null
  },

  onLoad() {
    this.initDate();
    try {
      const info = wx.getSystemInfoSync();
      this._rpxPerPx = 750 / (info.windowWidth || 375);
    } catch (e) {
      this._rpxPerPx = 2;
    }
    this._deleteWidthRpx = 180;
    this.loadState();
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
    if (!this.isCloudAvailable()) {
      this.ensureInitialData();
      this.refreshHabits();
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
        } else {
          this.ensureInitialData();
        }
        this.refreshHabits();
      })
      .catch(() => {
        this.ensureInitialData();
        this.refreshHabits();
      });
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
    if (!this.isCloudAvailable()) {
      return;
    }
    const habits = this.loadBaseHabits();
    const habitLogs = this.loadLogs();
    const userInfo = wx.getStorageSync("userInfo") || null;
    wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: {
          type: "saveHabitState",
          data: {
            habits,
            habitLogs,
            userInfo,
          },
        },
      })
      .catch(() => {});
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
    const currentActiveId = this.data.activeDeleteId;
    const viewHabits = habits.map((item) => {
      const id = item.id;
      const offsetX =
        currentActiveId === id && this._deleteWidthRpx
          ? -this._deleteWidthRpx
          : 0;
      return {
        id,
        name: item.name,
        days: daysCount[id] || 0,
        completed: !!todayLogs[id],
        offsetX
      };
    });
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
      dayLog[id] = true;
    }
    logs[todayKey] = dayLog;
    wx.setStorageSync("habitLogs", logs);
    this.saveStateToCloud();
  },

  onToggleHabit(e) {
    const id = Number(e.currentTarget.dataset.id);
    this.toggleTodayForHabit(id);
    this.refreshHabits();
  },

  onHabitTouchStart(e) {
    const touch = e.touches[0] || {};
    this._habitTouchStartX = touch.clientX || 0;
    this._habitTouchStartY = touch.clientY || 0;
    const id = Number(e.currentTarget.dataset.id);
    this._swipeItemId = id;
    const habits = this.data.habits || [];
    const current = habits.find((item) => item.id === id) || {};
    this._swipeStartOffset = current.offsetX || 0;
  },

  onHabitTouchMove(e) {
    const touch = e.touches[0] || {};
    const moveX = touch.clientX || 0;
    const moveY = touch.clientY || 0;
    const deltaXpx = moveX - (this._habitTouchStartX || 0);
    const deltaYpx = moveY - (this._habitTouchStartY || 0);
    if (Math.abs(deltaYpx) > Math.abs(deltaXpx)) {
      return;
    }
    const id = Number(e.currentTarget.dataset.id);
    if (this._swipeItemId !== id) {
      return;
    }
    const rpxPerPx = this._rpxPerPx || 2;
    const deltaRpx = deltaXpx * rpxPerPx;
    const startOffset = this._swipeStartOffset || 0;
    let offsetX = startOffset + deltaRpx;
    const min = -(this._deleteWidthRpx || 180);
    const max = 0;
    if (offsetX < min) offsetX = min;
    if (offsetX > max) offsetX = max;
    this._swipeOffsetRpx = offsetX;
    const habits = (this.data.habits || []).map((item) =>
      item.id === id ? Object.assign({}, item, { offsetX }) : item
    );
    this.setData({
      habits
    });
  },

  onHabitTouchEnd(e) {
    const touch = e.changedTouches[0] || {};
    const endX = touch.clientX || 0;
    const endY = touch.clientY || 0;
    const deltaX = endX - (this._habitTouchStartX || 0);
    const deltaY = endY - (this._habitTouchStartY || 0);
    const id = Number(e.currentTarget.dataset.id);

    // 纵向滑动视为滚动，不处理
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }
    const habits = this.data.habits || [];
    const current = habits.find((item) => item.id === id) || {};
    const currentOffset = current.offsetX || 0;
    const half = -(this._deleteWidthRpx || 180) / 2;
    let targetOffset = 0;
    let activeDeleteId = this.data.activeDeleteId;

    if (currentOffset <= half || deltaX < -40) {
      targetOffset = -(this._deleteWidthRpx || 180);
      activeDeleteId = id;
    } else if (deltaX > 40) {
      targetOffset = 0;
      activeDeleteId = null;
    } else {
      targetOffset = 0;
      activeDeleteId = null;
      if (Math.abs(deltaX) < 10) {
        this.onToggleHabit(e);
      }
    }

    const nextHabits = habits.map((item) =>
      item.id === id
        ? Object.assign({}, item, {
            offsetX: targetOffset
          })
        : item
    );

    this._swipeItemId = null;
    this._swipeOffsetRpx = 0;
    this._swipeStartOffset = 0;

    this.setData({
      habits: nextHabits,
      activeDeleteId
    });
  },

  onDeleteHabit(e) {
    const id = Number(e.currentTarget.dataset.id);
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
    this.setData({
      activeDeleteId: null
    });
    this.refreshHabits();
    this.saveStateToCloud();
  },

  onAddHabit() {
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
    const name = (this.data.newHabitName || "").trim();
    if (!name) {
      wx.showToast({
        title: "请输入习惯名称",
        icon: "none"
      });
      return;
    }
    const baseHabits = this.loadBaseHabits();
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
