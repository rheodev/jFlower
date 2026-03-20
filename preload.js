global.runTime = require('./runtime');
var Server = require('./server');
var Utils = require('./utils');
var Clients = require('./clients');
var umami = require('./libs/umami').default;

const fs = require('fs');
const path = require('path');
const mime = require('./mime').types;
const { versions } = require('process');

console.log(versions);

window.fs = fs;
var initTime = 0;

function getSessionTarget(sessionId) {
    if (!sessionId) return null;
    if (runTime.hosts.ids[sessionId]) return runTime.hosts.ids[sessionId];
    let session = runTime.getSession(sessionId);
    if (!session) return null;
    if (session.ip && runTime.hosts.ips[session.ip]) return runTime.hosts.ips[session.ip];
    return null;
}

function fileToPayload(filePath) {
    return {
        path: filePath,
        name: path.basename(filePath)
    };
}

function imageFileToDataUrl(filePath) {
    let ext = path.extname(filePath).slice(1).toLowerCase();
    let fileMime = mime[ext] || 'image/png';
    return `data:${fileMime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function init() {
    if (Math.abs((new Date()).getTime() - initTime) < 5000) return;
    initTime = (new Date()).getTime();

    if (window.app && window.app.ui) {
        window.app.ui.serverState = false;
    }

    Server.check(() => {
        setTimeout(function () {
            try {
                Utils.detectDevice();
            } catch (e) {
                Utils.log('e:', e);
            }

            if (window.app && window.app.ui) {
                window.app.ui.serverState = true;
                window.app.ui.localIp = runTime.localIp;
                window.app.ui.localPort = Server.port;
                window.app.ui.refreshSessions();
            }
        }, 0);
    });
}

function checkNetwork(cb) {
    let currIp = runTime.localIp;
    let ip = Utils.getLocalIp();
    if (ip != currIp) {
        Utils.detectDevice(0, 0, cb);
    } else {
        cb && cb();
    }
}

utools.onPluginEnter(({
    code,
    type,
    payload
}) => {
    console.log('用户进入插件', code, type, payload);
    setTimeout(() => {
        umami.track({ url: '/onPluginEnter' });
    });

    if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(code)) {
        let inputIp = code;
        let host = runTime.hosts.ips[inputIp];
        let targetId = host ? host.id : inputIp;

        checkNetwork(() => {
            let target = getSessionTarget(targetId) || runTime.hosts.ips[inputIp];
            if (!target) {
                Utils.toast('目标主机未找到，请尝试重连');
                return;
            }

            if (window.app) {
                window.app.selectSession(target.id || target.ip);
            }

            if (type == 'files') {
                Clients.sendFileAsk(target.ip, payload, Clients.sentCallback);
            } else if (type == 'img') {
                Clients.sendImg(target.ip, payload, Clients.sentCallback);
            } else {
                Clients.sendText(target.ip, payload, Clients.sentCallback);
            }

            if (window.app && window.app.ui) {
                window.app.ui.refreshSessions();
            }
        });
    } else {
        init();
    }
});

utools.onPluginOut(() => {
    console.log('用户退出插件');
});

utools.onPluginReady(() => {
    console.log('onPluginReady');
    runTime.init();

    window.app = {
        ready: false,
        localIp: runTime.localIp,
        path: path,
        settings: runTime.settings,
        history: runTime.history,
        serverState: false,
        localPort: runTime.settings.localPort,
        openShareUrl: () => {
            utools.shellOpenExternal('http://' + runTime.localIp + ':' + Server.port + '/share');
        },
        openWapUrl: () => {
            utools.shellOpenExternal('http://' + runTime.localIp + ':' + Server.port + '/wap');
        },
        openUrl: (url) => {
            utools.shellOpenExternal(url);
        },
        checkServer: function (cb) {
            Server.check(cb);
        },
        getSessions() {
            return runTime.getSessions();
        },
        getChatState() {
            return runTime.getChatState();
        },
        getSession(sessionId) {
            return runTime.getSession(sessionId);
        },
        selectSession(sessionId) {
            if (window.app.ui) {
                window.app.ui.activeSessionId = sessionId;
                window.app.ui.scrollMessagesSoon();
            }
        },
        sendText(sessionId, text) {
            let target = getSessionTarget(sessionId);
            if (!target) {
                Utils.toast('目标设备当前不在线');
                return false;
            }
            let value = String(text || '').trim();
            if (!value) return false;
            Clients.sendText(target.ip, value, Clients.sentCallback);
            this.selectSession(target.id || target.ip);
            return true;
        },
        pickAndSendFile(sessionId) {
            let target = getSessionTarget(sessionId);
            if (!target) {
                Utils.toast('目标设备当前不在线');
                return false;
            }
            let selected = utools.showOpenDialog({
                title: '选择文件',
                buttonLabel: '发送',
                properties: ['openFile']
            });
            if (!selected || !selected[0]) return false;
            Clients.sendFileAsk(target.ip, [fileToPayload(selected[0])], Clients.sentCallback);
            this.selectSession(target.id || target.ip);
            return true;
        },
        pickAndSendImage(sessionId) {
            let target = getSessionTarget(sessionId);
            if (!target) {
                Utils.toast('目标设备当前不在线');
                return false;
            }
            let selected = utools.showOpenDialog({
                title: '选择图片',
                buttonLabel: '发送',
                filters: [{
                    name: 'Images',
                    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']
                }],
                properties: ['openFile']
            });
            if (!selected || !selected[0]) return false;
            Clients.sendImg(target.ip, imageFileToDataUrl(selected[0]), Clients.sentCallback);
            this.selectSession(target.id || target.ip);
            return true;
        },
        updSettings() {
            runTime.updSettings();
        },
        showFile: function (targetPath) {
            utools.shellShowItemInFolder(targetPath);
        },
        selectPath: function (target) {
            let selected = utools.showOpenDialog({
                title: '选择文件夹',
                defaultPath: runTime.settings[target],
                buttonLabel: '选择',
                properties: ['openDirectory']
            });
            if (selected) {
                runTime.setting[target] = selected[0];
            }
            return !!selected;
        },
        detect: function (ipSeg) {
            setTimeout(function () {
                Utils.detectDevice(ipSeg);
                if (window.app && window.app.ui) {
                    window.app.ui.refreshSessions();
                }
            }, 0);
        },
        clearDB: function (doc) {
            if (doc) return utools.db.remove(runTime.localId + ':' + doc);
            utools.db.remove(runTime.localId + ':settings');
            utools.db.remove(runTime.localId + ':history');
        },
        copy: function (content, type) {
            if (type == 'file') return utools.copyFile(content);
            if (type == 'img') return utools.copyImage(content);
            return utools.copyText(content);
        },
        delHistory: function (key) {
            return runTime.delHistory(key);
        },
        updHistory() {
            runTime.updHistory();
        },
        fileSend: {
            cancel(message) {
                if (message.direction == 'in') {
                    Clients.cancelFileSend(message._id);
                } else {
                    Server.cancelFileSend(message._id);
                }
            },
            pause(message) {
                if (message.direction == 'in') {
                    Clients.pauseFileSend(message._id);
                } else {
                    Server.pauseFileSend(message._id);
                }
            },
            resume(message) {
                if (message.direction == 'in') {
                    Clients.resumeFileSend(message._id);
                } else {
                    Server.resumeFileSend(message._id);
                }
            },
        },
        unlink(targetPath) {
            fs.unlinkSync(targetPath);
        },
        init() {
        }
    };

    require('./ui/index');
    init();
    Utils.log("onPluginReady:runTime:", JSON.parse(JSON.stringify(runTime._settings)));
    try {
        setTimeout(() => {
            umami.init({
                websiteId: '5412c0d4-12dc-43a7-a98c-3c4588ddab43',
                hostUrl: 'https://cloud.umami.is',
            });
            umami.track({ url: '/onPluginReady' });
        });
    } catch (e) {
        console.log(e);
    }
});
