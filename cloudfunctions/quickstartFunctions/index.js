const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const REMINDER_TEMPLATE_ID =
  "siFWEoBkxvgPO8HjBUxPGvc55Z3skgZ7WLB9g5U1gYM";

const db = cloud.database();
const _ = db.command;
const habitStateCollection = db.collection("habit_state");
const usersCollection = db.collection("users");
const habitRemindersCollection = db.collection("habit_reminders");
// 获取openid
const getOpenId = async () => {
  // 获取基础信息
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 获取小程序二维码
const getMiniProgramCode = async () => {
  // 获取小程序二维码的buffer
  const resp = await cloud.openapi.wxacode.get({
    path: "pages/index/index",
  });
  const { buffer } = resp;
  // 将图片上传云存储空间
  const upload = await cloud.uploadFile({
    cloudPath: "code.png",
    fileContent: buffer,
  });
  return upload.fileID;
};

// 创建集合
const createCollection = async () => {
  try {
    // 创建集合
    await db.createCollection("sales");
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "上海",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "南京",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "广州",
        sales: 22,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "深圳",
        sales: 22,
      },
    });
    return {
      success: true,
    };
  } catch (e) {
    // 这里catch到的是该collection已经存在，从业务逻辑上来说是运行成功的，所以catch返回success给前端，避免工具在前端抛出异常
    return {
      success: true,
      data: "create collection success",
    };
  }
};

// 查询数据
const selectRecord = async () => {
  // 返回数据库查询结果
  return await db.collection("sales").get();
};

// 更新数据
const updateRecord = async (event) => {
  try {
    // 遍历修改数据库信息
    for (let i = 0; i < event.data.length; i++) {
      await db
        .collection("sales")
        .where({
          _id: event.data[i]._id,
        })
        .update({
          data: {
            sales: event.data[i].sales,
          },
        });
    }
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 新增数据
const insertRecord = async (event) => {
  try {
    const insertRecord = event.data;
    // 插入数据
    await db.collection("sales").add({
      data: {
        region: insertRecord.region,
        city: insertRecord.city,
        sales: Number(insertRecord.sales),
      },
    });
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 删除数据
const deleteRecord = async (event) => {
  try {
    await db
      .collection("sales")
      .where({
        _id: event.data._id,
      })
      .remove();
    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

const getHabitState = async () => {
  const wxContext = cloud.getWXContext();
  const res = await habitStateCollection
    .where({
      _openid: wxContext.OPENID,
    })
    .limit(1)
    .get();
  if (!res.data || !res.data.length) {
    return {
      success: true,
      data: null,
    };
  }
  const doc = res.data[0];
  return {
    success: true,
    data: {
      habits: doc.habits || [],
      habitLogs: doc.habitLogs || {},
    },
  };
};

const saveHabitState = async (event) => {
  const wxContext = cloud.getWXContext();
  const payload = event.data || {};
  const habits = payload.habits || [];
  const habitLogs = payload.habitLogs || {};
  const userInfo = payload.userInfo || null;
  const now = new Date();
  const res = await habitStateCollection
    .where({
      _openid: wxContext.OPENID,
    })
    .limit(1)
    .get();
  const baseData = {
    habits,
    habitLogs,
    updatedAt: now,
  };
  if (userInfo) {
    baseData.userInfo = {
      nickName: userInfo.nickName || "",
      avatarUrl: userInfo.avatarUrl || "",
    };
  }
  if (!res.data || !res.data.length) {
    await habitStateCollection.add({
      data: baseData,
    });
  } else {
    await habitStateCollection.doc(res.data[0]._id).update({
      data: baseData,
    });
  }
  return {
    success: true,
  };
};

const deleteHabitReminderByHabitId = async (event) => {
  const wxContext = cloud.getWXContext();
  const payload = event.data || {};
  const habitId = payload.habitId;
  if (typeof habitId !== "number" && typeof habitId !== "string") {
    return {
      success: false,
      errMsg: "invalid habitId",
    };
  }
  const res = await habitRemindersCollection
    .where({
      _openid: wxContext.OPENID,
      habitId,
    })
    .remove();
  return {
    success: true,
    data: {
      deleted: (res && res.stats && res.stats.removed) || 0,
    },
  };
};

const upsertHabitReminder = async (event) => {
  const wxContext = cloud.getWXContext();
  const payload = event.data || {};
  const habitId = payload.habitId;
  if (typeof habitId !== "number" && typeof habitId !== "string") {
    return {
      success: false,
      errMsg: "invalid habitId",
    };
  }
  const active = !!payload.active;
  const remindTime = payload.remindTime || "";
  let remindMinutes = null;
  if (remindTime && typeof remindTime === "string") {
    const parts = remindTime.split(":");
    if (parts.length === 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!Number.isNaN(h) && !Number.isNaN(m)) {
        remindMinutes = h * 60 + m;
      }
    }
  }
  const now = new Date();
  const res = await habitRemindersCollection
    .where({
      _openid: wxContext.OPENID,
      habitId,
    })
    .limit(1)
    .get();
  const base = {
    active,
    updatedAt: now,
  };
  if (remindMinutes !== null) {
    base.remindTime = remindTime;
    base.remindMinutes = remindMinutes;
  }
  if (!res.data || !res.data.length) {
    await habitRemindersCollection.add({
      data: {
        _openid: wxContext.OPENID,
        habitId,
        active,
        remindTime: remindTime || "",
        remindMinutes: remindMinutes !== null ? remindMinutes : 0,
        lastSentDate: "",
        createdAt: now,
        updatedAt: now,
      },
    });
  } else {
    await habitRemindersCollection.doc(res.data[0]._id).update({
      data: base,
    });
  }
  return {
    success: true,
  };
};

const sendDailyReminders = async (event) => {
  const templateId =
    (event && event.templateId) || REMINDER_TEMPLATE_ID;
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  const now = new Date();
  const local = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const today = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(
    local.getDate()
  )}`;
  const localHours = local.getHours();
  const currentMinutes = localHours * 60 + local.getMinutes();
  const windowSize = (event && event.windowMinutes) || 10;
  const half = Math.floor(windowSize / 2);
  const start = currentMinutes - half;
  const end = currentMinutes + half;
  let res;
  try {
    res = await habitRemindersCollection
      .where({
        active: true,
        remindMinutes: _.gte(start).and(_.lte(end)),
        lastSentDate: _.neq(today),
      })
      .get();
  } catch (e) {
    const code = e && (e.errCode || e.code || e.message || "");
    const msg = typeof code === "string" ? code : "";
    if (
      (e && e.errCode === -502005) ||
      msg.indexOf("collection not exists") >= 0 ||
      msg.indexOf("Db or Table not exist") >= 0 ||
      msg.indexOf("DATABASE_COLLECTION_NOT_EXIST") >= 0
    ) {
      await db.createCollection("habit_reminders");
      console.log("sendDailyReminders created collection", {
        today,
        currentMinutes,
      });
      return {
        success: true,
        data: {
          sent: 0,
          createdCollection: true,
          reason: "collectionCreated",
        },
      };
    }
    throw e;
  }
  const total = (res && res.data && res.data.length) || 0;
  if (!total) {
    console.log("sendDailyReminders no reminders in window", {
      today,
      currentMinutes,
      start,
      end,
    });
    return {
      success: true,
      data: {
        sent: 0,
        total: 0,
        reason: "noRemindersInWindow",
      },
    };
  }
  const byUser = {};
  res.data.forEach((doc) => {
    const openid = doc._openid;
    if (!byUser[openid]) {
      byUser[openid] = [];
    }
    byUser[openid].push(doc);
  });
  const userCount = Object.keys(byUser).length;
  let sentCount = 0;
  let failCount = 0;
  const allUpdates = [];
  for (const openid of Object.keys(byUser)) {
    const list = byUser[openid];
    const any = list[0];
    const timeValue =
      any && typeof any.remindTime === "string" && any.remindTime
        ? any.remindTime
        : `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: openid,
        templateId,
        page: "pages/habits/index",
        data: {
          date2: {
            value: today,
          },
          thing3: {
            value: `今日有${list.length}个习惯待打卡`,
          },
          time11: {
            value: timeValue,
          },
          phrase5: {
            value: "习惯打卡",
          },
          thing10: {
            value: "打卡",
          },
        },
      });
      sentCount += 1;
      list.forEach((doc) => {
        allUpdates.push(
          habitRemindersCollection.doc(doc._id).update({
            data: {
              lastSentDate: today,
            },
          })
        );
      });
    } catch (e) {
      failCount += 1;
      console.error("sendDailyReminders send error", {
        openid,
        today,
        currentMinutes,
        error: e,
      });
    }
  }
  if (allUpdates.length) {
    await Promise.all(allUpdates);
  }
  console.log("sendDailyReminders finished", {
    today,
    currentMinutes,
    start,
    end,
    total,
    userCount,
    sentCount,
    failCount,
  });
  return {
    success: true,
    data: {
      sent: sentCount,
      total,
      userCount,
      failCount,
      reason:
        sentCount > 0
          ? "ok"
          : failCount > 0
          ? "sendFailed"
          : "noSendTarget",
    },
  };
};

const upsertUser = async (event) => {
  const wxContext = cloud.getWXContext();
  const payload = event.data || {};
  const info = payload.userInfo || {};
  const now = new Date();
  const base = {
    nickName: info.nickName || "",
    avatarUrl: info.avatarUrl || "",
    gender: info.gender,
    country: info.country,
    province: info.province,
    city: info.city,
    updatedAt: now,
  };
  const res = await usersCollection
    .where({
      _openid: wxContext.OPENID,
    })
    .limit(1)
    .get();
  if (!res.data || !res.data.length) {
    await usersCollection.add({
      data: {
        ...base,
        createdAt: now,
      },
    });
  } else {
    await usersCollection.doc(res.data[0]._id).update({
      data: base,
    });
  }
  return {
    success: true,
  };
};

const sendHabitReminder = async (event) => {
  const wxContext = cloud.getWXContext();
  const templateId = event && event.templateId;
  if (!templateId) {
    return {
      success: false,
      errMsg: "missing templateId",
    };
  }
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  const now = new Date();
  const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}`;
  const timePart = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  await cloud.openapi.subscribeMessage.send({
    touser: wxContext.OPENID,
    templateId,
    page: "pages/habits/index",
    data: {
      date2: {
        value: datePart,
      },
      thing3: {
        value: "今日习惯打卡提醒",
      },
      time11: {
        value: timePart,
      },
      phrase5: {
        value: "习惯打卡",
      },
      thing10: {
        value: "打卡",
      },
    },
  });
  return {
    success: true,
  };
};

const getUserProfile = async () => {
  const wxContext = cloud.getWXContext();
  const res = await usersCollection
    .where({
      _openid: wxContext.OPENID,
    })
    .limit(1)
    .get();
  if (!res.data || !res.data.length) {
    return {
      success: true,
      data: null,
    };
  }
  const doc = res.data[0];
  return {
    success: true,
    data: {
      nickName: doc.nickName || "",
      avatarUrl: doc.avatarUrl || "",
      gender: doc.gender,
      country: doc.country,
      province: doc.province,
      city: doc.city,
    },
  };
};

// const getOpenId = require('./getOpenId/index');
// const getMiniProgramCode = require('./getMiniProgramCode/index');
// const createCollection = require('./createCollection/index');
// const selectRecord = require('./selectRecord/index');
// const updateRecord = require('./updateRecord/index');
// const fetchGoodsList = require('./fetchGoodsList/index');
// const genMpQrcode = require('./genMpQrcode/index');
exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  if (!event || !event.type) {
    if (wxContext.SOURCE === "wx_trigger") {
      return await sendDailyReminders({
        templateId: REMINDER_TEMPLATE_ID,
        windowMinutes: 10,
      });
    }
    return {
      success: false,
      errMsg: "missing type",
    };
  }
  switch (event.type) {
    case "getOpenId":
      return await getOpenId();
    case "getMiniProgramCode":
      return await getMiniProgramCode();
    case "createCollection":
      return await createCollection();
    case "selectRecord":
      return await selectRecord();
    case "updateRecord":
      return await updateRecord(event);
    case "insertRecord":
      return await insertRecord(event);
    case "deleteRecord":
      return await deleteRecord(event);
    case "getHabitState":
      return await getHabitState(event);
    case "saveHabitState":
      return await saveHabitState(event);
    case "upsertUser":
      return await upsertUser(event);
    case "getUserProfile":
      return await getUserProfile(event);
    case "sendHabitReminder":
      return await sendHabitReminder(event);
    case "upsertHabitReminder":
      return await upsertHabitReminder(event);
    case "deleteHabitReminderByHabitId":
      return await deleteHabitReminderByHabitId(event);
    case "sendDailyReminders":
      return await sendDailyReminders(event);
  }
};
