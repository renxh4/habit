Page({
  data: {
    loggedIn: false,
    userInfo: null,
    stats: {
      habitCount: 0,
      successRate: 0
    }
  },

  onLoad() {
    console.log("profile onLoad");
    this.loadUserInfo();
    this.loadStats();
  },

  onShow() {
    console.log("profile onShow");
    this.loadUserInfo();
    this.loadStats();
  },

  loadUserInfo() {
    console.log("profile loadUserInfo start");
    const stored = wx.getStorageSync("userInfo");
    console.log("profile loadUserInfo stored", stored);
    if (stored && stored.nickName) {
      console.log("profile loadUserInfo logged in with stored userInfo");
      this.setData({
        loggedIn: true,
        userInfo: stored
      });
    } else {
      console.log("profile loadUserInfo no stored userInfo, treat as logged out");
      this.setData({
        loggedIn: false,
        userInfo: null
      });
    }
  },

  loadStats() {
    const habits = wx.getStorageSync("habits") || [];
    const habitLogs = wx.getStorageSync("habitLogs") || {};
    const dates = Object.keys(habitLogs || {});
    const habitCount = habits.length;
    let totalCompleted = 0;
    dates.forEach((dateKey) => {
      const dayLog = habitLogs[dateKey] || {};
      const ids = Object.keys(dayLog);
      if (ids.length > 0) {
        totalCompleted += ids.length;
      }
    });
    let successRate = 0;
    if (habits.length > 0 && dates.length > 0) {
      const totalPossible = habits.length * dates.length;
      if (totalPossible > 0) {
        successRate = Math.round((totalCompleted / totalPossible) * 100);
        if (successRate < 0) successRate = 0;
        if (successRate > 100) successRate = 100;
      }
    }
    this.setData({
      stats: {
        habitCount,
        successRate
      }
    });
  },

  onTapLogin() {
    console.log("profile onTapLogin clicked");
    console.log("profile onTapLogin wx.getUserProfile available", !!wx.getUserProfile);
    if (!wx.getUserProfile) {
      console.log("profile onTapLogin wx.getUserProfile not available, rely on open-type getUserInfo");
      wx.showToast({
        title: "点击按钮授权获取头像昵称",
        icon: "none"
      });
      return;
    }
    wx.getUserProfile({
      desc: "用于展示个人资料",
      success: (res) => {
        console.log("profile onTapLogin getUserProfile success", res);
        const info = res.userInfo || {};
        this.handleUserInfo(info);
      },
      fail: (err) => {
        console.log("profile onTapLogin getUserProfile fail", err);
        wx.showToast({
          title: "已取消授权",
          icon: "none"
        });
      }
    });
  },

  onGetUserInfo(e) {
    console.log("profile onGetUserInfo triggered", e);
    const detail = e.detail || {};
    const info = detail.userInfo;
    if (!info) {
      console.log("profile onGetUserInfo no userInfo in event.detail");
      wx.showToast({
        title: "已取消授权",
        icon: "none"
      });
      return;
    }
    console.log("profile onGetUserInfo got userInfo", info);
    this.handleUserInfo(info);
  },

  handleUserInfo(info) {
    console.log("profile handleUserInfo start", info);
    wx.setStorageSync("userInfo", info);
    console.log("profile handleUserInfo userInfo saved to storage");
    this.setData({
      loggedIn: true,
      userInfo: info
    });
    console.log("profile handleUserInfo state updated to loggedIn");
    if (wx.cloud) {
      const app = getApp();
      console.log("profile handleUserInfo wx.cloud available, app.globalData", app && app.globalData);
      if (app && app.globalData && app.globalData.env) {
        console.log("profile handleUserInfo env set, preparing to sync to cloud");
        const habits = wx.getStorageSync("habits") || [];
        const habitLogs = wx.getStorageSync("habitLogs") || {};
        console.log("profile handleUserInfo local habits", habits);
        console.log("profile handleUserInfo local habitLogs", habitLogs);
        wx.cloud
          .callFunction({
            name: "quickstartFunctions",
            data: {
              type: "upsertUser",
              data: {
                userInfo: info
              }
            }
          })
          .then((res) => {
            console.log("profile handleUserInfo upsertUser success", res);
          })
          .catch((err) => {
            console.log("profile handleUserInfo upsertUser fail", err);
          });
        wx.cloud
          .callFunction({
            name: "quickstartFunctions",
            data: {
              type: "saveHabitState",
              data: {
                habits,
                habitLogs,
                userInfo: info
              }
            }
          })
          .then((res) => {
            console.log("profile handleUserInfo saveHabitState success", res);
          })
          .catch((err) => {
            console.log("profile handleUserInfo saveHabitState fail", err);
          });
      } else {
        console.log("profile handleUserInfo env not set, skip cloud sync");
      }
    } else {
      console.log("profile handleUserInfo wx.cloud not available, skip cloud sync");
    }
  },

  onChooseAvatar(e) {
    console.log("profile onChooseAvatar", e);
    const detail = e.detail || {};
    const avatarUrl = detail.avatarUrl;
    if (!avatarUrl) {
      return;
    }
    const current = this.data.userInfo || {};
    const merged = Object.assign({}, current, {
      avatarUrl
    });
    this.handleUserInfo(merged);
  },

  onChangeNickName(e) {
    console.log("profile onChangeNickName", e);
    const value = (e.detail && e.detail.value) || "";
    const name = value.trim();
    if (!name) {
      return;
    }
    const current = this.data.userInfo || {};
    const merged = Object.assign({}, current, {
      nickName: name
    });
    this.handleUserInfo(merged);
  },

  onTapLogout() {
    console.log("profile onTapLogout clicked");
    wx.showModal({
      title: "确认退出登录",
      content: "退出后将不再展示你的头像和昵称，习惯数据仍保留在云端。",
      confirmText: "退出登录",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) {
          console.log("profile onTapLogout user cancelled");
          return;
        }
        console.log("profile onTapLogout confirmed, clearing local userInfo");
        wx.removeStorageSync("userInfo");
        this.setData({
          loggedIn: false,
          userInfo: null
        });
      }
    });
  }
});
