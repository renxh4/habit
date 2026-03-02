const REMINDER_TEMPLATE_ID = "siFWEoBkxvgPO8HjBUxPGvc55Z3skgZ7WLB9g5U1gYM";

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
        this.afterLogin(info);
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
    this.afterLogin(info);
  },

  afterLogin(info) {
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

  onTapSubscribeReminder() {
    if (!wx.requestSubscribeMessage) {
      wx.showToast({
        title: "当前微信版本不支持订阅消息",
        icon: "none",
      });
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: [REMINDER_TEMPLATE_ID],
      success: (res) => {
        const status = res[REMINDER_TEMPLATE_ID];
        if (status === "accept") {
          if (!wx.cloud) {
            wx.showToast({
              title: "云环境未配置",
              icon: "none",
            });
            return;
          }
          wx.cloud
            .callFunction({
              name: "quickstartFunctions",
              data: {
                type: "sendHabitReminder",
                templateId: REMINDER_TEMPLATE_ID,
              },
            })
            .then(() => {
              wx.showToast({
                title: "提醒已发送",
                icon: "none",
              });
            })
            .catch(() => {
              wx.showToast({
                title: "发送失败",
                icon: "none",
              });
            });
        } else {
          wx.showToast({
            title: "已取消授权",
            icon: "none",
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: "请求订阅失败",
          icon: "none",
        });
      },
    });
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
  }
});
