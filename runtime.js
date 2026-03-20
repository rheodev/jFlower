const os = require('os');
const userData = require('./userdata');
const md5 = require('./libs/md5');

function safeDecode(value) {
    if (!value) return '';
    try {
        return decodeURIComponent(value);
    } catch (e) {
        return value;
    }
}

function clone(data) {
    return JSON.parse(JSON.stringify(data));
}

module.exports = {
    init: function () {
        this.localId = utools.getLocalId();
        this.loadSettings();
        if (!this._settings.downloadPath) {
            this._settings.downloadPath = utools.getPath('downloads');
        }
        if (!this._settings.sharePath) {
            this._settings.sharePath = utools.getPath('downloads');
        }
        this.loadHistory();
    },
    client: {
        targetIp: '',
        targetId: '',
        type: '',
        content: '',
        fileSend: {
            name: '',
            size: 0,
            sent: 0,
            to: '',
            startTime: 0
        }
    },
    server: {
        fromIp: '',
        fromId: '',
        type: '',
        content: '',
        fileReceive: {
            name: '',
            size: 0,
            receive: 0,
            from: '',
            position: '',
            startTime: 0
        }
    },
    waitingFiles: {
        token: {
            path: '',
            time: 0,
            ip: '',
        },
        check(token, ip) {
            if (token.length != 32) return false;
            var file = this[token];
            if (!file) return false;
            if (file.ip != ip) return false;
            if ((new Date().getTime()) - file.time > 60000) return false;
            let path = file.path;
            delete this[token];
            return path;
        }
    },

    localIp: '',
    localId: '',
    platform: '',
    hosts: {
        ids: {},
        ips: {}
    },
    lastIpCheckTime: 0,

    _settings: {
        log: false,
        sharePath: '',
        downloadPath: '',
        sharing: false,
        name: os.hostname(),
        otherIpSeg: '',
        canBeFound: true,
        findingCode: {
            isOnly: false,
            code: ''
        },
        localIp: '',
        localPort: 18891,
        targetPort: 18891,
        freeWin: true
    },
    get settings() {
        this.loadSettings();
        return this._settings;
    },
    get setting() {
        var _this = this;
        setTimeout(() => {
            _this.updSettings();
        }, 0);
        return this._settings;
    },

    loadSettings: function () {
        var res = utools.db.get(this.localId + ':settings');
        if (res) {
            for (let i in res.data) {
                this._settings[i] = res.data[i];
            }
        }
    },

    updSettings: function () {
        let res = utools.db.get(this.localId + ':settings');
        let rev = res ? res._rev : '';
        utools.db.put({
            _id: this.localId + ':settings',
            _rev: rev,
            data: clone(this._settings)
        });
    },

    history: [],
    loadHistory: function () {
        this.history = userData.get('history', []);
    },
    addHistory: function (data) {
        data._id = data._id || md5((new Date()).getTime() + Math.random());
        data.hostName = safeDecode(data.hostName);
        this.history.push(data);
        userData.put('history', this.history);
        return data._id;
    },
    updHistory: function () {
        userData.put('history', this.history);
    },
    getHistoryIndex: function (key) {
        if (typeof key == 'number') {
            return key >= 0 && key < this.history.length ? key : -1;
        }
        for (let i = 0; i < this.history.length; i++) {
            if (this.history[i] && this.history[i]._id === key) return i;
        }
        return -1;
    },
    delHistory: function (key) {
        let index = this.getHistoryIndex(key);
        if (index < 0) return null;
        let curr = this.history.splice(index, 1);
        this.updHistory();
        return curr[0] || null;
    },
    getHistory: function (key) {
        let index = this.getHistoryIndex(key);
        return index < 0 ? null : this.history[index];
    },
    resolveHost: function (item) {
        if (!item) return null;
        if (item.id && this.hosts.ids[item.id]) return this.hosts.ids[item.id];
        if (item.ip && this.hosts.ips[item.ip]) return this.hosts.ips[item.ip];
        return null;
    },
    getSessionId: function (item) {
        let host = this.resolveHost(item);
        return (host && host.id) || (item && item.id) || (item && item.ip) || '';
    },
    getSessionMeta: function (item) {
        let host = this.resolveHost(item);
        let sessionId = this.getSessionId(item);
        let ip = (host && host.ip) || (item && item.ip) || sessionId;
        let hostName = safeDecode((host && host.hostName) || (item && item.hostName) || ip || '未知设备');
        return {
            id: sessionId,
            ip: ip,
            hostName: hostName,
            online: !!host
        };
    },
    toMessage: function (item) {
        let meta = this.getSessionMeta(item);
        let file = item.contentType === 'file' ? item.content || {} : null;
        let transferred = file ? (file.transferred || 0) : 0;
        let total = file ? (file.total || 0) : 0;
        let percent = total > 0 ? Math.min(100, Math.round(transferred / total * 100)) : 0;
        return {
            _id: item._id,
            sessionId: meta.id,
            direction: item.type === 2 ? 'out' : 'in',
            type: item.contentType,
            content: item.content,
            status: file ? (file.status || (percent >= 100 ? 'completed' : 'paused')) : 'completed',
            progress: {
                transferred: transferred,
                total: total,
                percent: percent,
                elapsed: file ? (file.elapsed || 0) : 0
            },
            time: item.time || 0,
            ip: meta.ip,
            hostName: meta.hostName
        };
    },
    mergeSession: function (target, source) {
        if (!target) return source;
        if (!source) return target;

        target.id = (target.online && target.id) || source.id || target.id;
        target.ip = target.ip || source.ip;
        target.hostName = target.hostName || source.hostName;
        target.online = !!(target.online || source.online);
        target.unread = Math.max(target.unread || 0, source.unread || 0);
        target.lastMessageTime = Math.max(target.lastMessageTime || 0, source.lastMessageTime || 0);
        target.messages = (target.messages || []).concat(source.messages || []);

        if (source.online) {
            target.id = source.id || target.id;
            target.ip = source.ip || target.ip;
            target.hostName = source.hostName || target.hostName;
        }

        return target;
    },
    buildSessions: function () {
        let sessions = {};

        Object.keys(this.hosts.ids).forEach((id) => {
            let host = this.hosts.ids[id];
            sessions[id] = {
                id: id,
                ip: host.ip,
                hostName: safeDecode(host.hostName) || host.ip,
                online: true,
                unread: 0,
                lastMessageTime: 0,
                messages: []
            };
        });

        this.history.forEach((item) => {
            if (!item) return;
            let meta = this.getSessionMeta(item);
            if (!meta.id) return;
            let session = sessions[meta.id];
            if (!session) {
                session = sessions[meta.id] = {
                    id: meta.id,
                    ip: meta.ip,
                    hostName: meta.hostName,
                    online: meta.online,
                    unread: 0,
                    lastMessageTime: 0,
                    messages: []
                };
            }
            session.ip = meta.ip || session.ip;
            session.hostName = meta.hostName || session.hostName;
            session.online = meta.online;
            session.messages.push(this.toMessage(item));
            if ((item.time || 0) >= session.lastMessageTime) {
                session.lastMessageTime = item.time || 0;
            }
        });

        let merged = {};

        Object.keys(sessions).forEach((key) => {
            let session = sessions[key];
            session.messages.sort((a, b) => a.time - b.time);
            if (!session.lastMessageTime && session.messages.length) {
                session.lastMessageTime = session.messages[session.messages.length - 1].time;
            }
            let mergeKey = session.ip ? ('ip:' + session.ip) : ('id:' + session.id);
            if (!merged[mergeKey]) {
                merged[mergeKey] = session;
            } else {
                merged[mergeKey] = this.mergeSession(merged[mergeKey], session);
                merged[mergeKey].messages.sort((a, b) => {
                    if ((a.time || 0) !== (b.time || 0)) return (a.time || 0) - (b.time || 0);
                    return String(a._id || '').localeCompare(String(b._id || ''));
                });
            }
        });

        return Object.keys(merged).map((key) => {
            return merged[key];
        }).sort((a, b) => {
            if (b.lastMessageTime !== a.lastMessageTime) return b.lastMessageTime - a.lastMessageTime;
            return a.hostName.localeCompare(b.hostName);
        });
    },
    getSessions: function () {
        return this.buildSessions();
    },
    getSession: function (sessionId) {
        return this.getSessions().find((session) => session.id === sessionId) || null;
    },
    findSessionByIp: function (ip) {
        return this.getSessions().find((session) => session.ip === ip) || null;
    },
    getChatState: function () {
        return {
            localIp: this.localIp,
            localId: this.localId,
            settings: {
                name: this.settings.name,
                sharing: this.settings.sharing,
                sharePath: this.settings.sharePath,
                localPort: this.settings.localPort
            },
            sessions: this.getSessions()
        };
    }
};
