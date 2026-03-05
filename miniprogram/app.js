const { envList } = require("./envList.js");

App({
  onLaunch: function () {
    const envId = envList && envList.length ? envList[0].envId : "";
    this.globalData = {
      env: envId
    };
    if (!wx.cloud || !envId) {
      return;
    }
    wx.cloud.init({
      env: envId,
      traceUser: true,
    });
  },
});
