(function () {
  var STORAGE_KEY = 'serial-scanner:data';
  // Electron 环境判断：只要有 serialAPI 即视为桌面版
  var inElectron = !!(window.serialAPI && (typeof window.serialAPI.exportExcel === 'function' || typeof window.serialAPI.submitSerial === 'function'));

  try {
    run();
  } catch (e) {
    console.error('初始化失败:', e);
    document.body.innerHTML =
      '<div style="padding:40px 24px;font-family:sans-serif;color:#991b1b;line-height:1.6;">' +
      '<h2 style="margin-top:0;">页面初始化失败</h2>' +
      '<p>请刷新页面重试。错误信息：</p>' +
      '<pre style="background:#fef2f2;padding:12px;border-radius:8px;overflow:auto;">' +
      (e.message || String(e)) + '</pre>' +
      '</div>';
  }

  function run() {
      // DOM 就绪才初始化
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
      } else {
        start();
      }
    }

    function _t(part, key, fallback) {
      try {
        var T = window.TEXTS;
        if (!T) return fallback;
        var p = T[part];
        if (!p) return fallback;
        var v = p[key];
        if (v === undefined || v === null || v === '') return fallback;
        return v;
      } catch (_) { return fallback; }
    }

    function _author() { return (window.TEXTS && window.TEXTS.AUTHOR) || {}; }

  function start() {
    var els = {
      input: document.getElementById('serial-input'),
      submit: document.getElementById('btn-submit'),
      status: document.getElementById('status'),
      total: document.getElementById('stat-total'),
      success: document.getElementById('stat-success'),
      duplicate: document.getElementById('stat-duplicate'),
      tbody: document.getElementById('tbody'),
      empty: document.getElementById('empty'),
      search: document.getElementById('search'),
      clear: document.getElementById('btn-clear'),
      exportBtn: document.getElementById('btn-export'),
      recordCount: document.getElementById('record-count'),
      toast: document.getElementById('toast'),
      dupAlert: document.getElementById('duplicate-alert'),
      dupSerial: document.getElementById('dup-serial'),
      dupClose: document.getElementById('dup-close'),
      dupCountdown: document.getElementById('dup-countdown-num'),
      thIndex: document.getElementById('th-index'),
      thIndexLabel: document.getElementById('th-index-label'),
      envTag: document.getElementById('env-tag'),
      modal: document.getElementById('confirm-modal'),
      modalTitle: document.getElementById('confirm-title'),
      modalBody: document.getElementById('confirm-body'),
      modalOk: document.getElementById('confirm-ok'),
      modalCancel: document.getElementById('confirm-cancel'),
      authorBtn: document.getElementById('btn-author'),
      authorModal: document.getElementById('author-modal'),
      // 扫码页用 -scan 后缀的 ID，与 home.html 区分开
      qrcodeImg: document.getElementById('author-qrcode-img-scan') || document.getElementById('author-qrcode-img'),
      avatarImg: document.getElementById('author-avatar-img-scan') || document.getElementById('author-avatar-img'),
      rewardImg: document.getElementById('author-reward-img-scan') || document.getElementById('author-reward-img'),
      copyWechat: document.getElementById('btn-copy-wechat-scan') || document.getElementById('btn-copy-wechat'),
      copyPhone: document.getElementById('btn-copy-phone-scan') || document.getElementById('btn-copy-phone'),
      // 项目相关元素（简化版）
      currentProjectName: document.getElementById('current-project-name')
    };

    // 关键节点缺失检查
    var missing = [];
    ['input', 'status', 'tbody', 'clear'].forEach(function (id) {
      if (!els[id]) missing.push(id);
    });
    if (missing.length) {
      throw new Error('DOM 结构不完整（缺失节点: ' + missing.join(', ') + '），请刷新页面重试。');
    }

    var state = { 
      list: [], 
      success: 0, 
      duplicate: 0, 
      keyword: '', 
      indexSortAsc: true,
      currentProjectId: null,
      projects: {}
    };
    var autoSubmitTimer = null;
    var toastTimer = null;
    var modalResolver = null;
    var newProjectResolver = null;
    var historyResolver = null;

    /* ---------------- 工具函数 ---------------- */

    function pad(n) { return String(n).length < 2 ? '0' + n : String(n); }
    function formatTime(iso) {
      try {
        var d = new Date(iso);
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
               pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      } catch (e) { return iso; }
    }

    function setText(node, text) { if (node) node.textContent = text; }
    function setDisplay(node, v) { if (node) node.style.display = v; }
    function setClass(node, cls) { if (node) node.className = cls; }

    /* ---------------- 项目存储管理 ---------------- */

    function generateId() {
      return 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function buildProject(model, dateStr) {
      var now = new Date().toISOString();
      var createdTime = dateStr ? (new Date(dateStr).toISOString()) : now;
      var projectName = String(model || '').trim() + ' ' + formatTime(createdTime).split(' ')[0];
      return {
        id: generateId(),
        model: String(model || '').trim(),
        projectTime: createdTime,
        name: projectName,
        createdAt: now,
        lastModifiedAt: now,
        serials: []
      };
    }

    function formatDateForName(date) {
      return (date.getMonth() + 1) + '月' + date.getDate() + '日';
    }

    function loadData() {
      // 无论网页版还是 Electron 桌面版，统一使用 localStorage
      // 这样项目数据结构完全一致，用户从浏览器切换到桌面版也能直接复用
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return Promise.resolve(initDefaultData());
        var data = JSON.parse(raw);
        return Promise.resolve(parseStorageData(data));
      } catch (e) {
        console.warn('读取本地数据失败:', e);
        return Promise.resolve(initDefaultData());
      }
    }

    function parseStorageData(data) {
      if (!data || typeof data !== 'object') return initDefaultData();
      
      var projects = data.projects || {};
      var currentId = data.currentProjectId;
      
      // 如果没有任何项目，则返回空状态 —— 必须先新建项目才能扫码
      var projectIds = Object.keys(projects);
      if (projectIds.length === 0) {
        return { projects: {}, currentProjectId: null };
      }
      
      // 确保当前项目有效
      if (!currentId || !projects[currentId]) {
        currentId = Object.keys(projects)[0];
      }
      
      return {
        projects: projects,
        currentProjectId: currentId
      };
    }

    function initDefaultData() {
      return {
        projects: {},
        currentProjectId: null
      };
    }

    function saveData() {
      if (inElectron) return Promise.resolve(true);
      try {
        var data = {
          currentProjectId: state.currentProjectId,
          projects: state.projects
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return Promise.resolve(true);
      } catch (e) {
        console.warn('保存失败:', e);
        return Promise.resolve(false);
      }
    }

    function getCurrentProject() {
      if (!state.currentProjectId) return null;
      return state.projects[state.currentProjectId] || null;
    }

    function getCurrentList() {
      var proj = getCurrentProject();
      return proj ? proj.serials : [];
    }

    function setCurrentList(list) {
      var proj = getCurrentProject();
      if (proj) {
        proj.serials = list || [];
        proj.lastModifiedAt = new Date().toISOString();
      }
    }

    /* ---------------- 渲染 ---------------- */

    function renderProjectName() {
      var proj = getCurrentProject();
      if (!proj) {
        var noProject = _t('STATUS', 'noProject', '未选择项目');
        setText(els.currentProjectName, noProject);
        return;
      }
      var display = (proj.model ? proj.model : '') + ' ' + formatTime(proj.projectTime).split(' ')[0];
      setText(els.currentProjectName, display.trim());
    }

    function renderStats() {
      if (!getCurrentProject()) {
        setText(els.total, '0');
        setText(els.success, '0');
        setText(els.duplicate, '0');
        return;
      }
      var list = getCurrentList();
      setText(els.total, list.length);
      setText(els.success, state.success);
      setText(els.duplicate, state.duplicate);
    }

    function renderRecordCount() {
      if (!els.recordCount) return;
      var list = getCurrentList();
      els.recordCount.textContent = list.length ? '（共 ' + list.length + ' 条）' : '';
    }

    function renderList() {
      if (!getCurrentProject()) {
        if (els.tbody) els.tbody.innerHTML = '';
        setDisplay(els.empty, 'block');
        if (els.empty) els.empty.textContent = _t('TABLE', 'emptyNoProject', '请先点击"+ 新建项目"创建项目后再扫码');
        renderStats();
        renderRecordCount();
        return;
      }

      var kw = String(state.keyword || '').trim().toLowerCase();
      var list = getCurrentList();
      var filtered = kw.length
        ? list.filter(function (item) { return (item.serial || '').toLowerCase().indexOf(kw) !== -1; })
        : list.slice();

      // 序号排序
      if (typeof window.__indexSortAsc !== 'undefined' && !window.__indexSortAsc) filtered.reverse();

      // 更新序号表头的排序方向箭头
      var labelEl = document.getElementById('th-index-label');
      if (labelEl) labelEl.textContent = (_t('TABLE', 'indexHeader', '序号') || '序号') + ' ' + (window.__indexSortAsc ? '↑' : '↓');

      if (els.tbody) els.tbody.innerHTML = '';
      if (filtered.length === 0) {
        setDisplay(els.empty, 'block');
        if (els.empty) els.empty.textContent = kw.length ? _t('TABLE', 'searchNoMatch', '未找到匹配的记录') : _t('TABLE', 'empty', '暂无记录');
        renderStats();
        renderRecordCount();
        return;
      }
      setDisplay(els.empty, 'none');

      if (!els.tbody) return;
      var frag = document.createDocumentFragment();
      var btnText = _t('BUTTON', 'delete_', '删除');
      for (var i = 0; i < filtered.length; i++) {
        var item = filtered[i];
        // 序号永远按扫描顺序编号
        var displayIndex = list.indexOf(item) + 1;
        var tr = document.createElement('tr');

        var tdIndex = document.createElement('td'); tdIndex.textContent = displayIndex; tr.appendChild(tdIndex);
        var tdSerial = document.createElement('td'); tdSerial.textContent = item.serial; tr.appendChild(tdSerial);
        var tdTime = document.createElement('td'); tdTime.textContent = formatTime(item.scannedAt); tr.appendChild(tdTime);

        var tdAction = document.createElement('td');
        var btn = document.createElement('button');
        btn.textContent = btnText;
        btn.style.cssText = 'padding:4px 10px;background:#ef4444;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;';
        (function (serial) {
          btn.addEventListener('click', function () {
            try {
              deleteOne(serial);
            } catch (e) {
              console.error('删除失败:', e);
              showToast('error', _t('TOAST', 'deleteFailed', '删除失败') + '：' + (e.message || e));
            }
          });
        })(item.serial);
        tdAction.appendChild(btn);
        tr.appendChild(tdAction);

        frag.appendChild(tr);
      }
      els.tbody.appendChild(frag);
      renderStats();
      renderRecordCount();
    }

    function refresh() {
      renderProjectName();
      renderList();
      if (els.input) els.input.focus();
    }

    function setStatus(type, message) {
      setClass(els.status, 'status ' + (type || 'idle'));
      setText(els.status, message);
    }

    function showToast(type, message) {
      var cls = 'info';
      if (type === 'success') cls = 'success';
      else if (type === 'duplicate') cls = 'duplicate';
      else if (type === 'error') cls = 'error';
      setClass(els.toast, 'toast ' + cls);
      setText(els.toast, message);
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { setClass(els.toast, 'toast hidden'); }, 2500);
    }

    // 画面中间弹出大号的重复警告（带倒计时自动关闭）
    // 倒计时秒数从 localStorage 的 serial-scanner:settings 读取，默认 4 秒
    function getDuplicateCountdown() {
      try {
        var raw = localStorage.getItem('serial-scanner:settings');
        if (!raw) return 4;
        var obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return 4;
        var cd = parseInt(obj.duplicateCountdown, 10);
        if (!isFinite(cd) || cd < 1) return 4;
        if (cd > 300) return 300;
        return cd;
      } catch (e) {
        return 4;
      }
    }
    var dupCountdownTimer = null;
    function showDuplicateAlert(serial) {
      if (!els.dupAlert) return;
      if (els.dupSerial) els.dupSerial.textContent = serial;
      els.dupAlert.classList.remove('hidden');
      var sec = getDuplicateCountdown();
      if (els.dupCountdown) els.dupCountdown.textContent = String(sec);
      if (dupCountdownTimer) clearInterval(dupCountdownTimer);
      dupCountdownTimer = setInterval(function () {
        sec -= 1;
        if (sec <= 0) {
          clearInterval(dupCountdownTimer);
          dupCountdownTimer = null;
          closeDuplicateAlert();
          return;
        }
        if (els.dupCountdown) els.dupCountdown.textContent = String(sec);
      }, 1000);
    }

    function closeDuplicateAlert() {
      if (els.dupAlert) els.dupAlert.classList.add('hidden');
      if (dupCountdownTimer) {
        clearInterval(dupCountdownTimer);
        dupCountdownTimer = null;
      }
    }

    if (els.dupClose) {
      els.dupClose.addEventListener('click', function () { closeDuplicateAlert(); });
    }
    if (els.dupAlert) {
      els.dupAlert.addEventListener('click', function (e) {
        try {
          if (e.target && e.target.classList && e.target.classList.contains('dup-alert-mask')) {
            closeDuplicateAlert();
          }
        } catch (_) {}
      });
    }
    document.addEventListener('keydown', function (e) {
      try {
        if (e.key === 'Escape' && els.dupAlert && !els.dupAlert.classList.contains('hidden')) {
          closeDuplicateAlert();
        }
      } catch (_) {}
    });

    // 页面内二次确认（替代原生 confirm），返回 Promise<boolean>
    function showConfirm(message) {
      return new Promise(function (resolve) {
        if (!els.modal) return resolve(true);
        setText(els.modalBody, message || '确定要继续吗？');
        setClass(els.modal, 'modal');

        function cleanup() {
          setClass(els.modal, 'modal hidden');
          modalResolver = null;
        }

        modalResolver = function (v) {
          cleanup();
          resolve(v);
        };
      });
    }

    // 页面内新建项目弹窗，返回 Promise<{model, date}|null>
    function showNewProjectDialog() {
      return new Promise(function (resolve) {
        if (!els.newProjectModal) return resolve(null);
        
        // 清空输入框
        if (els.newProjectModel) els.newProjectModel.value = '';
        if (els.newProjectDate) {
          // 默认填充当前本地时间（datetime-local 使用 yyyy-mm-ddThh:mm 格式）
          var now = new Date();
          var y = now.getFullYear();
          var m = String(now.getMonth() + 1).padStart(2, '0');
          var d = String(now.getDate()).padStart(2, '0');
          var hh = String(now.getHours()).padStart(2, '0');
          var mm = String(now.getMinutes()).padStart(2, '0');
          els.newProjectDate.value = y + '-' + m + '-' + d + 'T' + hh + ':' + mm;
        }
        
        setClass(els.newProjectModal, 'modal');
        if (els.newProjectModel) els.newProjectModel.focus();

        function cleanup() {
          setClass(els.newProjectModal, 'modal hidden');
          newProjectResolver = null;
        }

        newProjectResolver = function (result) {
          cleanup();
          resolve(result);
        };
      });
    }

    // 页面内历史项目弹窗，返回 Promise<项目ID|null>
    function showHistoryDialog() {
      return new Promise(function (resolve) {
        if (!els.historyModal) return resolve(null);
        
        // 渲染项目列表
        var projectIds = Object.keys(state.projects);
        if (els.historyEmpty) els.historyEmpty.style.display = projectIds.length ? 'none' : 'block';
        
        if (els.historyProjectList) {
          els.historyProjectList.innerHTML = '';
          
          if (projectIds.length === 0) {
            if (els.historyEmpty) els.historyEmpty.style.display = 'block';
          } else {
            if (els.historyEmpty) els.historyEmpty.style.display = 'none';
            
            // 按最后修改时间倒序排列
            var sortedIds = projectIds.sort(function (a, b) {
              var timeA = state.projects[a].lastModifiedAt || '';
              var timeB = state.projects[b].lastModifiedAt || '';
              return timeB.localeCompare(timeA);
            });
            
            var curLabel = _t('PROJECT', 'currentTag', '[当前]');
            var switchLabel = _t('BUTTON', 'switchProject', '切换');
            var delLabel = _t('BUTTON', 'delete_', '删除');
            var serialCountSuffix = _t('PROJECT', 'serialCountSuffix', ' 条');
            var unnamed = _t('TOAST', 'unnamedProject', '未命名');

            sortedIds.forEach(function (pid) {
              var proj = state.projects[pid];
              var isCurrent = pid === state.currentProjectId;
              var projModel = proj.model || proj.name || unnamed;
              var projTimeStr = proj.projectTime ? formatTime(proj.projectTime).split(' ')[0] : formatTime(proj.createdAt).split(' ')[0];
              var item = document.createElement('div');
              item.className = 'history-project-item' + (isCurrent ? ' current' : '');
              item.innerHTML = 
                '<div class="history-project-info">' +
                  '<div class="history-project-name">' + projModel + ' ' + projTimeStr + (isCurrent ? ' <span class="current-tag">' + curLabel + '</span>' : '') + '</div>' +
                  '<div class="history-project-meta">' +
                    '<span>' + _t('TABLE', 'serialHeader', '序列号') + '：' + proj.serials.length + serialCountSuffix + '</span>' +
                  '</div>' +
                '</div>' +
                '<div class="history-project-actions">' +
                  (isCurrent ? '<button class="btn-switch-current" disabled>' + curLabel.replace(/[\[\]]/g, '') + '</button>' : '<button class="btn-switch" data-pid="' + pid + '">' + switchLabel + '</button>') +
                  '<button class="btn-delete-project" data-pid="' + pid + '">' + delLabel + '</button>' +
                '</div>';
              els.historyProjectList.appendChild(item);
            });
            
            // 绑定切换按钮事件
            els.historyProjectList.querySelectorAll('.btn-switch').forEach(function (btn) {
              btn.addEventListener('click', function () {
                var pid = this.getAttribute('data-pid');
                if (newProjectResolver) newProjectResolver({ action: 'switch', pid: pid });
                cleanup();
                resolve({ action: 'switch', pid: pid });
              });
            });
            
            // 绑定删除按钮事件 + 二次确认
            els.historyProjectList.querySelectorAll('.btn-delete-project').forEach(function (btn) {
              btn.addEventListener('click', function () {
                var pid = this.getAttribute('data-pid');
                var p = state.projects[pid];
                var modelName = p ? (p.model || p.name || _t('TOAST', 'unnamedProject', '未命名')) : _t('TOAST', 'unnamedProject', '未命名');
                var confirmMsg = _t('CLEAR', 'bodyConfirmDelete', '确定要删除该项目吗？删除后数据无法恢复。') + '：' + modelName;
                showConfirm(confirmMsg).then(function (ok) {
                  if (!ok) return;
                  if (newProjectResolver) newProjectResolver({ action: 'delete', pid: pid });
                  cleanup();
                  resolve({ action: 'delete', pid: pid });
                });
              });
            });
          }
        }
        
        setClass(els.historyModal, 'modal');

        function cleanup() {
          setClass(els.historyModal, 'modal hidden');
          historyResolver = null;
        }

        historyResolver = function (result) {
          cleanup();
          resolve(result);
        };
      });
    }

    /* ---------------- 业务逻辑 ---------------- */

    function submitCurrent() {
      try {
        // 没有项目时，提示先建项目
        if (!getCurrentProject()) {
          showToast('error', _t('STATUS', 'noProject', '请先点击"+ 新建项目"后再扫码'));
          if (els.input) els.input.value = '';
          return;
        }
        var value = els.input ? els.input.value : '';
        if (!value || !String(value).trim()) return;
        if (els.input) els.input.value = '';
        var serial = String(value).trim();

        var list = getCurrentList();
        var exists = list.some(function (it) { return it.serial === serial; });
        
        if (exists) {
          state.duplicate += 1;
          setStatus('duplicate', _t('STATUS', 'duplicate', '重复！序列号') + ' ' + serial + ' 已扫描过');
          showDuplicateAlert(serial);
          renderStats();
        } else {
          list.push({ serial: serial, scannedAt: new Date().toISOString() });
          setCurrentList(list);
          state.success += 1;
          setStatus('success', _t('STATUS', 'success', '扫码成功') + '：' + serial + '（共 ' + list.length + ' 条）');
          showToast('success', _t('STATUS', 'success', '扫码成功'));
          saveData();
          renderList();
        }
      } catch (e) {
        console.error('提交异常:', e);
        setStatus('error', _t('STATUS', 'errorHint', '异常') + '：' + (e.message || e));
        showToast('error', _t('TOAST', 'submitException', '操作异常'));
      }
    }

    function deleteOne(serial) {
      try {
        var list = getCurrentList();
        list = list.filter(function (it) { return it.serial !== serial; });
        setCurrentList(list);
        saveData().then(function () { renderList(); });
        showToast('info', _t('TOAST', 'deletedOne', '已删除 1 条记录'));
      } catch (e) {
        console.error('删除异常:', e);
        showToast('error', _t('TOAST', 'deleteFailed', '删除失败'));
      }
    }

    function clearAll() {
      try {
        setCurrentList([]);
        state.success = 0;
        state.duplicate = 0;
        saveData();
        renderList();
        showToast('info', _t('TOAST', 'clearedAll', '已清空所有记录'));
      } catch (e) {
        console.error('清空异常:', e);
        showToast('error', _t('TOAST', 'clearFailed', '清空失败'));
      }
    }

    function exportCsv() {
      try {
        var list = getCurrentList();
        var proj = getCurrentProject();
        if (!proj) {
          showToast('error', _t('TOAST', 'noProjectHint', '请先创建项目'));
          return;
        }
        if (!list || !list.length) {
          showToast('error', _t('TOAST', 'noRecordToExport', '没有可导出的记录'));
          return;
        }
        if (typeof XLSX === 'undefined') {
          showToast('error', _t('TOAST', 'excelLibFailed', 'Excel 导出库加载失败，请检查网络或重试'));
          return;
        }

        var projModel = proj.model || proj.name || _t('TOAST', 'unnamedProject', '未命名');
        var projTime = proj.projectTime ? formatTime(proj.projectTime).split(' ')[0] : formatTime(proj.createdAt).split(' ')[0];

        // 组装 Excel 数据，包含项目型号和时间
        var data = [
          [_t('TABLE', 'modelField', '型号'), projModel],
          [_t('TABLE', 'scanTimeField', '项目时间'), projTime],
          [_t('TABLE', 'exportTimeField', '导出时间'), formatTime(new Date().toISOString())],
          [],
          [_t('TABLE', 'indexHeader', '序号'), _t('TABLE', 'serialHeader', '序列号'), _t('TABLE', 'timeHeader', '扫描时间')]
        ];
        for (var i = 0; i < list.length; i++) {
          data.push([i + 1, String(list[i].serial || ''), formatTime(list[i].scannedAt)]);
        }

        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 30 }, { wch: 22 }];
        XLSX.utils.book_append_sheet(wb, ws, _t('TABLE', 'sheetName', '扫描记录'));

        var filename = 'serial-scan-' + projModel.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-') + '-' + projTime.replace(/[-/]/g, '') + '-' + new Date().toISOString().slice(0, 10) + '.xlsx';

        if (inElectron && window.serialAPI && typeof window.serialAPI.saveDialog === 'function') {
          var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          var payload = { filename: filename, data: new Uint8Array(wbout) };
          window.serialAPI.saveDialog(payload).then(function(result) {
            if (result && result.ok && result.path) {
              showToast('success', _t('TOAST', 'exportSuccessElectron', '已导出到：') + result.path);
              if (typeof window.serialAPI.showInFolder === 'function') {
                window.serialAPI.showInFolder(result.path);
              }
              return;
            }
            if (result && result.canceled) return;
            return window.serialAPI.exportExcel(payload).then(function(r) {
              if (r && r.ok) showToast('success', _t('TOAST', 'exportSavedAs', '已保存到：') + r.path);
              else showToast('error', _t('TOAST', 'exportSaveFailed', '保存失败：') + (r && r.message ? r.message : ''));
            });
          }).catch(function(e) {
            console.error('导出异常:', e);
            showToast('error', _t('TOAST', 'exportFailed', '导出失败') + '：' + (e.message || e));
          });
          return;
        }

        // 浏览器预览版
        try {
          XLSX.writeFile(wb, filename);
          showToast('success', _t('TOAST', 'exportSuccessBrowser', '已导出 Excel') + '（' + list.length + ' 条）');
        } catch (e) {
          showToast('error', _t('TOAST', 'exportBrowserBlocked', '浏览器阻止了下载'));
        }
      } catch (e) {
        console.error('导出异常:', e);
        showToast('error', _t('TOAST', 'exportFailed', '导出失败'));
      }
    }

    /* ---------------- 项目操作 ---------------- */

    function createNewProject(model, dateStr) {
      try {
        var newProj = buildProject(model, dateStr);
        state.projects[newProj.id] = newProj;
        state.currentProjectId = newProj.id;
        state.success = 0;
        state.duplicate = 0;
        saveData();
        refresh();
        showToast('success', _t('TOAST', 'projectCreated', '已创建项目，开始扫码吧'));
        return true;
      } catch (e) {
        console.error('创建项目失败:', e);
        showToast('error', _t('TOAST', 'projectCreateFailed', '创建项目失败'));
        return false;
      }
    }

    function switchProject(projectId) {
      try {
        if (!state.projects[projectId]) {
          showToast('error', _t('TOAST', 'projectNotExist', '项目不存在'));
          return false;
        }
        state.currentProjectId = projectId;
        state.success = 0;
        state.duplicate = 0;
        saveData();
        refresh();
        var proj = getCurrentProject();
        var display = (proj && proj.model ? proj.model : proj ? proj.name : _t('TOAST', 'unnamedProject', '未命名')) + ' ' + formatTime(proj.projectTime).split(' ')[0];
        showToast('info', _t('TOAST', 'projectSwitchTo', '已切换到：') + display);
        return true;
      } catch (e) {
        console.error('切换项目失败:', e);
        showToast('error', _t('TOAST', 'projectSwitchFailed', '切换项目失败'));
        return false;
      }
    }

    function deleteProject(projectId) {
      try {
        var proj = state.projects[projectId];
        if (!proj) return false;

        delete state.projects[projectId];

        // 如果删除的是当前项目，切换到第一个（如果还有）
        var remaining = Object.keys(state.projects);
        if (state.currentProjectId === projectId) {
          state.currentProjectId = remaining.length ? remaining[0] : null;
        }

        state.success = 0;
        state.duplicate = 0;
        saveData();
        refresh();

        var deletedName = (proj.model || proj.name || _t('TOAST', 'unnamedProject', '未命名')) + ' ' + formatTime(proj.projectTime).split(' ')[0];
        showToast('info', _t('TOAST', 'projectDeleted', '已删除项目：') + deletedName);
        if (remaining.length === 0) {
          showToast('info', _t('TOAST', 'projectAllDeleted', '已删除所有项目，请重新创建'));
        }
        return true;
      } catch (e) {
        console.error('删除项目失败:', e);
        showToast('error', _t('TOAST', 'projectDeleteFailed', '删除项目失败'));
        return false;
      }
    }

    /* ---------------- 事件绑定 ---------------- */

    function scheduleAutoSubmit() {
      if (autoSubmitTimer) clearTimeout(autoSubmitTimer);
      autoSubmitTimer = setTimeout(function () {
        autoSubmitTimer = null;
        try {
          var val = els.input ? els.input.value : '';
          if (val && String(val).trim()) submitCurrent();
        } catch (e) {
          console.error('自动提交异常:', e);
        }
      }, 200);
    }

    // 回车提交
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (autoSubmitTimer) { clearTimeout(autoSubmitTimer); autoSubmitTimer = null; }
        submitCurrent();
      }
    });

    // 扫码枪连发结束后自动提交
    els.input.addEventListener('input', function () {
      scheduleAutoSubmit();
    });

    // 粘贴后自动提交
    els.input.addEventListener('paste', function () {
      setTimeout(function () { scheduleAutoSubmit(); }, 10);
    });

    if (els.submit) {
      els.submit.addEventListener('click', function () {
        try { submitCurrent(); } catch (e) { showToast('error', '提交异常'); }
      });
    }

    if (els.exportBtn) {
      els.exportBtn.addEventListener('click', function () {
        try { exportCsv(); } catch (e) { showToast('error', '导出异常'); }
      });
    }

    if (els.search) {
      els.search.addEventListener('input', function (e) {
        try {
          state.keyword = e.target.value || '';
          renderList();
        } catch (e) {
          console.error('搜索异常:', e);
        }
      });
    }

    // 清空按钮
    els.clear.addEventListener('click', function () {
      try {
        var list = getCurrentList();
        if (!list.length) {
          showToast('info', _t('TOAST', 'noRecord', '当前没有记录'));
          return;
        }
        var clearMsg = _t('CLEAR', 'bodyConfirmClear', '确定要清空所有扫描记录吗？此操作不可恢复。');
        showConfirm(clearMsg).then(function (ok) {
          if (ok) clearAll();
        });
      } catch (e) {
        console.error('清空流程异常:', e);
        showToast('error', _t('TOAST', 'submitException', '操作异常'));
      }
    });

    // 弹窗按钮点击
    if (els.modalOk) {
      els.modalOk.addEventListener('click', function () {
        try { if (modalResolver) modalResolver(true); } catch (e) { console.error(e); }
      });
    }
    if (els.modalCancel) {
      els.modalCancel.addEventListener('click', function () {
        try { if (modalResolver) modalResolver(false); } catch (e) { console.error(e); }
      });
    }
    if (els.modal) {
      els.modal.addEventListener('click', function (e) {
        try {
          if (e.target && e.target.classList && e.target.classList.contains('modal-mask')) {
            if (modalResolver) modalResolver(false);
          }
        } catch (_) {}
      });
    }

    // Esc 键关闭弹窗
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (els.modal && !els.modal.classList.contains('hidden')) {
          if (modalResolver) modalResolver(false);
        }
      }
    });

    window.addEventListener('focus', function () { if (els.input) els.input.focus(); });

    /* ---------------- 项目相关事件 ---------------- */

    // 新建项目按钮
    if (els.btnNewProject) {
      els.btnNewProject.addEventListener('click', function () {
        showNewProjectDialog().then(function (result) {
          if (result && result.model) {
            createNewProject(result.model, result.date);
          }
        });
      });
    }

    // 新建项目弹窗确认
    if (els.newProjectConfirm) {
      els.newProjectConfirm.addEventListener('click', function () {
        var model = els.newProjectModel ? els.newProjectModel.value.trim() : '';
        var date = els.newProjectDate ? els.newProjectDate.value : '';
        if (!model) {
          showToast('error', '请输入型号');
          if (els.newProjectModel) els.newProjectModel.focus();
          return;
        }
        if (!date) {
          showToast('error', '请选择时间');
          if (els.newProjectDate) els.newProjectDate.focus();
          return;
        }
        if (newProjectResolver) newProjectResolver({ model: model, date: date });
      });
    }
    if (els.newProjectCancel) {
      els.newProjectCancel.addEventListener('click', function () {
        if (newProjectResolver) newProjectResolver(null);
      });
    }
    if (els.newProjectModal) {
      els.newProjectModal.addEventListener('click', function (e) {
        try {
          if (e.target && e.target.classList && e.target.classList.contains('modal-mask')) {
            if (newProjectResolver) newProjectResolver(null);
          }
        } catch (_) {}
      });
    }
    // 新建项目弹窗 - 型号输入框按 Enter 提交
    if (els.newProjectModel) {
      els.newProjectModel.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var model = els.newProjectModel ? els.newProjectModel.value.trim() : '';
          var date = els.newProjectDate ? els.newProjectDate.value : '';
          if (!model) {
            showToast('error', '请输入型号');
            return;
          }
          if (!date) {
            showToast('error', '请选择时间');
            if (els.newProjectDate) els.newProjectDate.focus();
            return;
          }
          if (newProjectResolver) newProjectResolver({ model: model, date: date });
        }
        if (e.key === 'Escape') {
          if (newProjectResolver) newProjectResolver(null);
        }
      });
    }
    // 新建项目弹窗 - 时间选择器按 Enter 提交
    if (els.newProjectDate) {
      els.newProjectDate.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var model = els.newProjectModel ? els.newProjectModel.value.trim() : '';
          var date = els.newProjectDate ? els.newProjectDate.value : '';
          if (!model) {
            showToast('error', '请输入型号');
            if (els.newProjectModel) els.newProjectModel.focus();
            return;
          }
          if (!date) {
            showToast('error', '请选择时间');
            return;
          }
          if (newProjectResolver) newProjectResolver({ model: model, date: date });
        }
        if (e.key === 'Escape') {
          if (newProjectResolver) newProjectResolver(null);
        }
      });
    }

    // 历史项目按钮
    if (els.btnHistory) {
      els.btnHistory.addEventListener('click', function () {
        showHistoryDialog().then(function (result) {
          if (!result) return;
          if (result.action === 'switch') {
            switchProject(result.pid);
          } else if (result.action === 'delete') {
            showConfirm('确定要删除该项目吗？删除后数据无法恢复。').then(function (ok) {
              if (ok) deleteProject(result.pid);
            });
          }
        });
      });
    }
    if (els.historyClose) {
      els.historyClose.addEventListener('click', function () {
        if (historyResolver) historyResolver(null);
      });
    }
    if (els.historyModal) {
      els.historyModal.addEventListener('click', function (e) {
        try {
          if (e.target && e.target.classList && e.target.classList.contains('modal-mask')) {
            if (historyResolver) historyResolver(null);
          }
        } catch (_) {}
      });
    }

    /* ---------------- 作者卡片弹窗 ---------------- */

    function openAuthor() {
      if (!els.authorModal) return;
      els.authorModal.classList.remove('hidden');
    }

    function closeAuthor() {
      if (!els.authorModal) return;
      els.authorModal.classList.add('hidden');
    }

    function copyText(text, label) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            showToast('success', _t('TOAST', 'copiedPrefix', '已复制') + (label || '') + '：' + text);
          }, function () {
            fallbackCopy(text, label);
          });
          return;
        }
        fallbackCopy(text, label);
      } catch (e) {
        console.warn('复制失败:', e);
        showToast('error', _t('TOAST', 'copyFailed', '复制失败'));
      }
    }

    function fallbackCopy(text, label) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (_) {}
        document.body.removeChild(ta);
        if (ok) showToast('success', _t('TOAST', 'copiedPrefix', '已复制') + (label || '') + '：' + text);
        else showToast('error', _t('TOAST', 'copyFailed', '复制失败'));
      } catch (e) {
        showToast('error', _t('TOAST', 'copyFailed', '复制失败'));
      }
    }

    if (els.authorBtn) {
      els.authorBtn.addEventListener('click', function () { openAuthor(); });
    }

    if (els.authorModal) {
      els.authorModal.addEventListener('click', function (e) {
        try {
          var t = e.target;
          if (t && t.getAttribute && t.getAttribute('data-close-author') === '1') {
            closeAuthor();
          }
        } catch (_) {}
      });
    }

    if (els.qrcodeImg) {
      els.qrcodeImg.addEventListener('click', function () {
        try {
          var src = els.qrcodeImg.getAttribute('src');
          if (!src) return;
          var overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(17,24,39,0.85);z-index:300;display:flex;align-items:center;justify-content:center;cursor:pointer;';
          var bigImg = document.createElement('img');
          bigImg.setAttribute('src', src);
          bigImg.style.cssText = 'max-width:80vw;max-height:80vh;border-radius:12px;background:#fff;box-shadow:0 20px 50px rgba(0,0,0,0.3);';
          overlay.appendChild(bigImg);
          overlay.addEventListener('click', function () {
            try { document.body.removeChild(overlay); } catch (_) {}
          });
          document.body.appendChild(overlay);
        } catch (e) {
          console.warn('预览大图失败:', e);
        }
      });
    }

    if (els.copyWechat) {
      els.copyWechat.addEventListener('click', function () {
        var AUTHOR = _author();
        var wx = AUTHOR.wechat || 'XiaLL68';
        var wxLabel = AUTHOR.labelWechat || '微信号';
        copyText(wx, wxLabel);
      });
    }

    if (els.copyPhone) {
      els.copyPhone.addEventListener('click', function () {
        var AUTHOR = _author();
        var ph = AUTHOR.phone || '15960360875';
        var phLabel = AUTHOR.labelPhone || '电话';
        copyText(ph, phLabel);
      });
    }

    // Esc 关闭作者卡片
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && els.authorModal && !els.authorModal.classList.contains('hidden')) {
        closeAuthor();
      }
    });

    if (els.envTag) {
      els.envTag.textContent = inElectron ? '' : _t('SYSTEM', 'envTag', '均好科技·序列号检测系统');
    }

    // 作者卡片的图片资源统一从 TEXTS.AUTHOR_ASSETS 读取路径
    // 这样以后想换头像/微信二维码/打赏码，只需把图片放进 author-assets/ 目录
    // 或者修改 texts.js 中 AUTHOR_ASSETS 对应的文件名即可
    try {
      var T = window.TEXTS;
      if (T && T.AUTHOR_ASSETS) {
        var AA = T.AUTHOR_ASSETS;
        if (els.avatarImg && AA.avatar) els.avatarImg.setAttribute('src', AA.avatar);
        if (els.qrcodeImg && AA.wechatQrcode) els.qrcodeImg.setAttribute('src', AA.wechatQrcode);
        if (els.rewardImg && AA.rewardQrcode) els.rewardImg.setAttribute('src', AA.rewardQrcode);
      }
    } catch (e) { /* 忽略图片路径设置失败 */ }

    /* ---------------- 初始化 ---------------- */

    loadData().then(function (data) {
      state.projects = data.projects || {};
      state.currentProjectId = data.currentProjectId;

      var projectIds = Object.keys(state.projects);

      state.success = 0;
      state.duplicate = 0;

      if (projectIds.length === 0 || !state.currentProjectId || !state.projects[state.currentProjectId]) {
        // 没有项目或当前项目无效，跳转到首页
        renderProjectName();
        setStatus('idle', _t('STATUS', 'noProject', '请先在首页创建项目'));
        // 3秒后自动跳转到首页
        setTimeout(function() {
          window.location.href = 'home.html';
        }, 2000);
        return;
      }

      setStatus('idle', _t('STATUS', 'idleHint', '请在下方输入序列号，按回车提交（扫码枪也是回车提交）'));
      refresh();
      if (els.input) els.input.focus();

      // 菜单：文件 → 导出 Excel
      if (inElectron && window.serialAPI && typeof window.serialAPI.onMenuExportExcel === 'function') {
        window.serialAPI.onMenuExportExcel(function () {
          try { exportCsv(); } catch (e) { showToast('error', _t('TOAST', 'exportFailed', '菜单导出失败')); }
        });
      }
    }).catch(function (e) {
      console.error('初始化失败:', e);
      showToast('error', _t('TOAST', 'submitException', '初始化失败，即将跳转到首页'));
      setTimeout(function() { window.location.href = 'home.html'; }, 2000);
    });
  }
})();
