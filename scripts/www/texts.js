/* ==========================================================================
   texts.js — 所有用户可见文字的统一配置文件
   修改这个文件里的文字，即可同时更新：
   ① 首页 home.html 的标题 / 按钮 / 弹窗内容 / 版权信息 / 作者信息
   ② 扫码页 index.html 的标题 / 按钮 / 状态提示 / 重复警告 / 列表列名
   ③ renderer.js 里所有 Toast 提示、文件名表头等
   仅需要修改 = 等号右边引号内的内容，不要删除或修改变量名。
   ========================================================================== */

(function () {
  // ---------- 基本信息 ----------
  var SYSTEM = {
    name: '扫码序列号管理',
    homeName: '扫码管理系统',
    pageTitle: '扫码管理系统 - 项目管理',
    envTag: '均好科技·序列号检测系统',
    homeSubTitle: '选择或创建一个项目，开始扫码',
    emptyProjectTitle: '暂无项目',
    emptyProjectTip: '点击上方"新建项目"创建一个新项目开始扫码',
    placeholderSerial: '在此输入或粘贴序列号，回车提交...',
    placeholderSearch: '搜索序列号...',
    placeholderModel: '例如：ABC-2024',
    previewHint: '温馨提示：操作完成后请及时保存数据，避免数据丢失。误触可能导致删除，请谨慎操作。'
  };

  // ---------- 作者与联系方式（会同时出现在两个页面的"关于作者"弹窗中） ----------
  var AUTHOR = {
    name: '夏宇铖',
    phone: '15960360875',
    wechat: 'XiaLL68',
    btnOpen: '关于作者 / 联系客服',
    labelPhone: '电话',
    labelWechat: '微信号',
    titleText: '作者',
    copyWechat: '复制微信号',
    copyPhone: '复制电话',
    qrcodeWechatTitle: '添加微信',
    qrcodeWechatDesc: '扫码添加作者微信',
    qrcodeRewardTitle: '扫码打赏',
    qrcodeRewardDesc: '扫码打赏支持作者'
  };

  // ---------- 作者图片资源（统一放在 author-assets/ 文件夹，修改文件名时只需改这里） ----------
  // 所有图片都放在 src/author-assets/ 目录，方便统一替换
  // 替换方法：把你的图片（推荐 .jpg 或 .png）命名为下方的文件名，放到 src/author-assets/ 文件夹即可
  var AUTHOR_ASSETS = {
    dir: 'author-assets',                       // 资源文件夹名称（不要修改，除非你确实想改文件夹）
    avatar: 'author-assets/头像.jpg',         // 作者头像（圆形展示）——把你的头像图片命名为 avatar.jpg 放到这个文件夹
    wechatQrcode: 'author-assets/微信.jpg', // 微信添加二维码图片 —— 替换为你自己的微信二维码（推荐 wechat-qrcode.jpg/png）
    rewardQrcode: 'author-assets/赞赏码.jpg'  // 扫码打赏二维码图片 —— 替换为你自己的打赏码（推荐 reward-qrcode.jpg/png）
  };

  // ---------- 按钮 ----------
  var BUTTON = {
    createProject: '新建项目',
    settings: '设置',
    goHome: '返回项目管理',
    submit: '提交',
    exportExcel: '导出Excel',
    clear: '清空',
    cancel: '取消',
    ok: '确定',
    save: '保存',
    delete_: '删除',
    confirmDelete: '确认删除',
    startScan: '开始扫码',
    currentProject: '当前项目',
    switchProject: '切换',
    close: '关闭',
    closeShort: '知道了',
    author: '作者'
  };

  // ---------- 状态与计数 ----------
  var STATUS = {
    loading: '加载中...',
    idleHint: '请在下方输入序列号，按回车提交（扫码枪也是回车提交）',
    noProject: '请先点击"+ 新建项目"后再扫码',
    duplicate: '重复！序列号已扫描过',
    success: '扫码成功',
    errorHint: '异常',
    serialCountLabel: '已扫描',
    successCountLabel: '本次成功',
    duplicateCountLabel: '本次重复'
  };

  // ---------- 表格列名 / 分类 ----------
  var TABLE = {
    indexHeader: '序号',
    serialHeader: '序列号',
    timeHeader: '扫描时间',
    actionHeader: '操作',
    modelField: '型号',
    timeField: '时间',
    sectionTitle: '扫描记录',
    empty: '暂无记录',
    emptyNoProject: '请先点击"+ 新建项目"创建项目后再扫码',
    searchNoMatch: '未找到匹配的记录',
    scanTimeField: '项目时间',
    exportTimeField: '导出时间',
    sheetName: '扫描记录'
  };

  // ---------- 弹窗：新建项目 ----------
  var MODAL = {
    createTitle: '新建项目',
    modelLabel: '型号',
    timeLabel: '时间',
    createConfirm: '创建并开始扫码'
  };

  // ---------- 弹窗：删除 / 清空 ----------
  var CLEAR = {
    title: '提示',
    bodyConfirmClear: '确定要清空所有已扫描记录吗？',
    bodyConfirmDelete: '确定要删除该项目吗？删除后数据无法恢复。',
    bodyGeneric: '确定要继续吗？'
  };

  // ---------- 弹窗：重复警告 ----------
  var DUP = {
    title: '序列号重复',
    label: '重复号码',
    tip: '该序列号已存在于扫描记录，请确认后再扫描',
    autoClose1: '（',
    autoClose2: ' 秒后自动关闭）',
    settingsTitle: '设置',
    countdownLabel: '重复弹窗倒计时（秒）',
    countdownHint: '当扫描到重复的序列号时，提示弹窗将在该秒数后自动关闭。可输入 1 ~ 300 秒，默认 4 秒。',
    countdownInvalid: '请输入 1 到 300 之间的整数秒数',
    countdownSaved: '已保存，重复弹窗倒计时 ',
    focusReturnLabel: '光标自动吸附延迟（秒）',
    focusReturnHint: '鼠标点击其他地方后，光标延迟多少秒自动回到输入框。设为 0 则关闭自动吸附，可输入 0 ~ 300 秒，默认 2 秒。',
    focusReturnInvalid: '请输入 0 到 300 之间的整数秒数',
    focusReturnSaved: '已保存，光标自动吸附延迟 '
  };

  // ---------- Toast 通用文字 ----------
  var TOAST = {
    // 扫码页操作
    serialInputEmpty: '请输入序列号',
    noProjectHint: '请先创建项目',
    noRecordToExport: '没有可导出的记录',
    excelLibFailed: 'Excel 导出库加载失败，请检查网络或重试',
    exportSuccessElectron: '已导出到：',
    exportSavedAs: '已保存到：',
    exportSaveFailed: '保存失败：',
    exportSuccessBrowser: '已导出 Excel',
    exportBrowserBlocked: '浏览器阻止了下载',
    exportFailed: '导出失败',
    deletedOne: '已删除 1 条记录',
    deleteFailed: '删除失败',
    clearedAll: '已清空所有记录',
    clearFailed: '清空失败',
    submitException: '操作异常',
    // 项目操作
    modelRequired: '请输入型号',
    timeRequired: '请选择时间',
    projectCreated: '已创建项目，开始扫码吧',
    projectCreateFailed: '创建项目失败',
    projectNotExist: '项目不存在',
    projectSwitchTo: '已切换到：',
    projectSwitchFailed: '切换项目失败',
    projectDeleted: '已删除项目：',
    projectAllDeleted: '已删除所有项目，请重新创建',
    projectDeleteFailed: '删除项目失败',
    noRecord: '当前没有记录',
    // 作者/复制
    copiedPrefix: '已复制',
    copyFailed: '复制失败',
    // 设置
    settingsSaved: '已保存，重复弹窗倒计时 ',
    // 未命名项目兜底
    unnamedProject: '未命名'
  };

  // ---------- 项目卡片 / 列表文字 ----------
  var PROJECT = {
    serialCountSuffix: ' 条序列号',
    noProjectYet: '未命名',
    scanCount: '已扫描 ',
    currentTag: '[当前]'
  };

  // ---------- 底部版权 ----------
  var COPYRIGHT = {
    text: '© 2026 扫码序列号管理 · 版权所有'
  };

  // ---------- 状态排序 / 序号 ----------
  var MISC = {
    indexSortHint: '点击切换排序'
  };

  // 暴露到全局，供 home.html / index.html / renderer.js 使用
  window.TEXTS = {
    SYSTEM: SYSTEM,
    AUTHOR: AUTHOR,
    AUTHOR_ASSETS: AUTHOR_ASSETS,
    BUTTON: BUTTON,
    STATUS: STATUS,
    TABLE: TABLE,
    MODAL: MODAL,
    CLEAR: CLEAR,
    DUP: DUP,
    TOAST: TOAST,
    PROJECT: PROJECT,
    COPYRIGHT: COPYRIGHT,
    MISC: MISC
  };
})();
