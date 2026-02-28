const { envList } = require("./envList.js");

App({
  onLaunch: function () {
    const envId = envList && envList.length ? envList[0].envId : "";
    this.globalData = {
      env: envId,
      openid: "",
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      return;
    }
    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true,
    });
    if (this.globalData.env) {
      wx.cloud
        .callFunction({
          name: "quickstartFunctions",
          data: {
            type: "getOpenId",
          },
        })
        .then((res) => {
          if (res && res.result && res.result.openid) {
            this.globalData.openid = res.result.openid;
          }
        })
        .catch(() => {});
    }
  },
});
