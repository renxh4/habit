const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const habitStateCollection = db.collection("habit_state");
const usersCollection = db.collection("users");
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

// const getOpenId = require('./getOpenId/index');
// const getMiniProgramCode = require('./getMiniProgramCode/index');
// const createCollection = require('./createCollection/index');
// const selectRecord = require('./selectRecord/index');
// const updateRecord = require('./updateRecord/index');
// const fetchGoodsList = require('./fetchGoodsList/index');
// const genMpQrcode = require('./genMpQrcode/index');
// 云函数入口函数
exports.main = async (event, context) => {
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
  }
};
