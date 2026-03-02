const { envList } = require("./envList.js");

App({
  onLaunch: function () {
    const envId = envList && envList.length ? envList[0].envId : "";
    this.globalData = {
      env: envId,
      reminderTemplateId: "siFWEoBkxvgPO8HjBUxPGvc55Z3skgZ7WLB9g5U1gYM",
      needDailySubscribeRequest: false,
    };
    if (!wx.cloud || !envId) {
      return;
    }
    wx.cloud.init({
      env: envId,
      traceUser: true,
    });
  },
  onShow: function () {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const mm = m < 10 ? `0${m}` : `${m}`;
    const dd = d < 10 ? `0${d}` : `${d}`;
    const today = `${y}-${mm}-${dd}`;
    const key = "lastDailySubscribeDate";
    const last = wx.getStorageSync(key);
    if (last !== today) {
      wx.setStorageSync(key, today);
      this.globalData.needDailySubscribeRequest = true;
    } else {
      this.globalData.needDailySubscribeRequest = false;
    }
  },
});
