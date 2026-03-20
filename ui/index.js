var app = window.app;

function escapeHtml(text) {
    return String(text || '').replace(/[&<>"']/g, function (char) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char];
    });
}

app.ui = new Vue({
    el: '#ui',
    data: {
        sessions: [],
        activeSessionId: '',
        composer: '',
        drawer: false,
        serverState: app.serverState,
        localIp: app.localIp,
        localPort: app.localPort,
        settings: app.settings,
        imgPreView: '',
        pollTimer: null,
        sessionQuery: '',
        sessionFilter: 'all',
        isAtBottom: true,
        shouldStickToBottom: true,
        lastMessageKey: '',
        statusMessage: '插件已就绪',
        actions: {
            scan: false,
            text: false,
            file: false,
            image: false
        }
    },
    computed: {
        filteredSessions: function () {
            var query = this.sessionQuery.trim().toLowerCase();
            var filter = this.sessionFilter;
            return this.sessions.filter(function (session) {
                if (filter === 'online' && !session.online) return false;
                if (!query) return true;
                return [session.hostName, session.ip, session.id].join(' ').toLowerCase().indexOf(query) >= 0;
            });
        },
        activeSession: function () {
            for (let i = 0; i < this.sessions.length; i++) {
                if (this.sessions[i].id === this.activeSessionId) return this.sessions[i];
            }
            return this.sessions[0] || null;
        },
        activeMessages: function () {
            return this.activeSession ? this.activeSession.messages : [];
        },
        onlineCount: function () {
            return this.sessions.filter(function (session) {
                return session.online;
            }).length;
        },
        filteredCount: function () {
            return this.filteredSessions.length;
        },
        canSend: function () {
            return !!(this.activeSession && this.activeSession.online && !this.actions.text && !this.actions.file && !this.actions.image);
        },
        canSubmitText: function () {
            return this.canSend && !!String(this.composer || '').trim();
        },
        showJumpBottom: function () {
            return this.activeMessages.length > 0 && !this.isAtBottom;
        },
        ipPrefix: function () {
            var currentIp = this.localIp || '0.0.0.0';
            var seg = currentIp.split('.');
            return seg[0] + '.' + seg[1] + '.' + seg[2];
        },
        composerHint: function () {
            if (!this.activeSession) return '从左侧选择终端后即可发送文字、图片或文件。';
            if (!this.activeSession.online) return this.activeSession.hostName + ' 当前离线，仅可查看历史记录。';
            if (this.actions.text) return '正在发送文字消息…';
            if (this.actions.file) return '正在准备文件发送…';
            if (this.actions.image) return '正在准备图片发送…';
            return this.activeSession.hostName + ' 当前在线，回车发送，Shift + Enter 换行。';
        }
    },
    methods: {
        messageKeyOf: function (messages) {
            if (!messages || !messages.length) return '';
            var last = messages[messages.length - 1];
            var progress = last.progress ? [last.progress.percent, last.progress.transferred].join(':') : '';
            return [messages.length, last._id, last.status, progress].join('|');
        },
        refreshSessions: function () {
            var previousActiveId = this.activeSessionId;
            var nextSessions = app.getSessions();
            this.sessions = nextSessions;

            if (!this.activeSessionId || !nextSessions.some((session) => session.id === this.activeSessionId)) {
                this.activeSessionId = this.filteredSessions[0] ? this.filteredSessions[0].id : (nextSessions[0] ? nextSessions[0].id : '');
            }

            var nextKey = this.messageKeyOf(this.activeMessages);
            var changed = nextKey !== this.lastMessageKey;
            this.lastMessageKey = nextKey;

            if (changed && (this.shouldStickToBottom || previousActiveId !== this.activeSessionId)) {
                this.scrollMessagesSoon();
            }
        },
        scrollMessages: function () {
            var target = this.$refs.messagesPanel;
            if (!target) return;
            target.scrollTop = target.scrollHeight;
            this.isAtBottom = true;
            this.shouldStickToBottom = true;
        },
        scrollMessagesSoon: function () {
            this.$nextTick(this.scrollMessages);
        },
        onMessagesScroll: function () {
            var target = this.$refs.messagesPanel;
            if (!target) return;
            var distance = target.scrollHeight - target.scrollTop - target.clientHeight;
            var nearBottom = distance < 72;
            this.isAtBottom = nearBottom;
            this.shouldStickToBottom = nearBottom;
        },
        setStatus: function (message) {
            this.statusMessage = message;
        },
        selectSession: function (sessionId) {
            this.activeSessionId = sessionId;
            this.shouldStickToBottom = true;
            this.imgPreView = '';
            var session = this.sessions.find(function (item) {
                return item.id === sessionId;
            });
            if (session) {
                this.setStatus('已切换到 ' + session.hostName);
            }
            this.scrollMessagesSoon();
        },
        handleSessionKeydown: function (index, event) {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            var buttons = this.$refs.sessionButtons || [];
            if (!buttons.length) return;
            var nextIndex = event.key === 'ArrowDown' ? index + 1 : index - 1;
            if (nextIndex < 0) nextIndex = buttons.length - 1;
            if (nextIndex >= buttons.length) nextIndex = 0;
            buttons[nextIndex] && buttons[nextIndex].focus();
        },
        clearSessionQuery: function () {
            this.sessionQuery = '';
        },
        sessionPreview: function (session) {
            if (!session || !session.messages.length) return '暂无消息';
            var last = session.messages[session.messages.length - 1];
            if (last.type === 'text') return String(last.content || '').slice(0, 26);
            if (last.type === 'img') return '图片';
            if (last.type === 'file') return (last.content && last.content.name) || '文件';
            return '系统消息';
        },
        getInitials: function (name) {
            var value = String(name || 'JF').trim();
            if (!value) return 'JF';
            if (value.length <= 2) return value.toUpperCase();
            return value.slice(0, 2).toUpperCase();
        },
        shortPath: function (path) {
            if (!path) return '未设置';
            if (path.length <= 36) return path;
            return path.slice(0, 16) + '...' + path.slice(-16);
        },
        formatTime: function (time) {
            if (!time) return '';
            return new Date(time).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        formatSize: function (size) {
            if (!size) return '0 B';
            var units = ['B', 'KB', 'MB', 'GB'];
            var value = size;
            var index = 0;
            while (value >= 1024 && index < units.length - 1) {
                value = value / 1024;
                index++;
            }
            return value.toFixed(value >= 100 ? 0 : 1) + ' ' + units[index];
        },
        formatSpeed: function (message) {
            if (!message.progress || !message.progress.elapsed || !message.progress.transferred) return '--';
            var speed = message.progress.transferred / (message.progress.elapsed / 1000);
            return this.formatSize(speed) + '/s';
        },
        formatStatus: function (message) {
            var statusMap = {
                sending: '传输中',
                paused: '已暂停',
                completed: '已完成',
                canceled: '已取消',
                error: '失败'
            };
            return statusMap[message.status] || '待处理';
        },
        filePercent: function (message) {
            return message.progress ? message.progress.percent : 0;
        },
        parseText: function (text) {
            return escapeHtml(text).replace(/(https?:\/\/[^\s]+)/g, (match) => {
                return '<a class="msg-link" onclick="app.openUrl(\'' + match.replace(/'/g, "\\'") + '\')">' + match + '</a>';
            });
        },
        copyMessage: function (message) {
            var content = message.type === 'file' ? message.content.path : message.content;
            if (app.copy(content, message.type)) {
                this.$Message.success('已复制');
                this.setStatus('内容已复制到剪贴板');
            } else {
                this.$Message.error('复制失败');
                this.setStatus('复制失败');
            }
        },
        saveImg: function (content) {
            let arr = content.split(',');
            let type = arr[0].match(/:.*\/(.*?);/)[1];
            let bstr = atob(arr[1]);
            let n = bstr.length;
            let u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            let fileName = 'jFlower.' + Math.ceil(Math.random() * 1000) + '.' + type;
            let filePath = this.settings.downloadPath + app.path.sep + fileName;
            fs.writeFileSync(filePath, new DataView(u8arr.buffer));
            app.showFile(filePath);
            this.setStatus('图片已保存到接收目录');
        },
        submitText: function () {
            if (!this.activeSession || !this.canSubmitText) return;
            this.actions.text = true;
            if (app.sendText(this.activeSession.id, this.composer)) {
                this.composer = '';
                this.setStatus('消息已发送');
                setTimeout(() => {
                    this.actions.text = false;
                    this.refreshSessions();
                }, 220);
            } else {
                this.actions.text = false;
                this.setStatus('发送失败');
            }
        },
        sendFile: function () {
            if (!this.activeSession || !this.canSend || this.actions.file) return;
            this.actions.file = true;
            if (app.pickAndSendFile(this.activeSession.id)) {
                this.setStatus('文件发送请求已发出');
                setTimeout(() => {
                    this.actions.file = false;
                    this.refreshSessions();
                }, 260);
            } else {
                this.actions.file = false;
            }
        },
        sendImage: function () {
            if (!this.activeSession || !this.canSend || this.actions.image) return;
            this.actions.image = true;
            if (app.pickAndSendImage(this.activeSession.id)) {
                this.setStatus('图片发送请求已发出');
                setTimeout(() => {
                    this.actions.image = false;
                    this.refreshSessions();
                }, 260);
            } else {
                this.actions.image = false;
            }
        },
        openMessageFile: function (message) {
            if (message.type === 'file' && message.content && message.content.path) {
                app.showFile(message.content.path);
                this.setStatus('已打开文件所在目录');
            }
        },
        removeMessage: function (message) {
            var removeRecord = () => {
                app.delHistory(message._id);
                this.refreshSessions();
                this.setStatus('记录已删除');
            };

            if (message.type !== 'file') {
                removeRecord();
                return;
            }

            if (message.status === 'sending' || message.status === 'paused') {
                app.fileSend.cancel(message);
            }

            if (message.direction === 'in' && message.content && message.content.path) {
                this.$Modal.confirm({
                    title: '删除记录',
                    content: '同时删除本地文件？',
                    okText: '删除文件',
                    cancelText: '仅删记录',
                    onOk: () => {
                        try {
                            app.unlink(message.content.path);
                        } catch (e) {
                            console.log(e);
                        }
                        removeRecord();
                    },
                    onCancel: removeRecord
                });
                return;
            }

            removeRecord();
        },
        pauseFile: function (message) {
            app.fileSend.pause(message);
            this.refreshSessions();
            this.setStatus('文件已暂停');
        },
        resumeFile: function (message) {
            app.fileSend.resume(message);
            this.refreshSessions();
            this.setStatus('文件继续传输');
        },
        cancelFile: function (message) {
            app.fileSend.cancel(message);
            this.refreshSessions();
            this.setStatus('文件已取消');
        },
        openShare: function () {
            app.openShareUrl();
            this.setStatus('已打开目录分享');
        },
        openWap: function () {
            app.openWapUrl();
            this.setStatus('已打开移动端页面');
        },
        selectSharePath: function () {
            if (app.selectPath('sharePath')) {
                this.setStatus('分享目录已更新');
            }
        },
        selectDownloadPath: function () {
            if (app.selectPath('downloadPath')) {
                this.setStatus('接收目录已更新');
            }
        },
        openLogFile: function () {
            app.showFile(utools.getPath('documents') + '/jflower.log');
            this.setStatus('已打开日志文件');
        },
        triggerDetect: function (ipSeg) {
            if (this.actions.scan) return;
            this.actions.scan = true;
            this.setStatus('正在扫描设备…');
            app.detect(ipSeg);
            setTimeout(() => {
                this.actions.scan = false;
                this.refreshSessions();
                this.setStatus('设备列表已刷新');
            }, 900);
        }
    },
    mounted() {
        this.refreshSessions();
        this.lastMessageKey = this.messageKeyOf(this.activeMessages);
        this.pollTimer = setInterval(() => this.refreshSessions(), 1200);
    },
    beforeDestroy() {
        clearInterval(this.pollTimer);
    },
    watch: {
        settings: {
            handler() {
                app.updSettings();
            },
            deep: true
        },
        activeSessionId() {
            this.imgPreView = '';
            this.shouldStickToBottom = true;
            this.scrollMessagesSoon();
        },
        sessionFilter() {
            if (!this.filteredSessions.some((session) => session.id === this.activeSessionId) && this.filteredSessions[0]) {
                this.activeSessionId = this.filteredSessions[0].id;
            }
        },
        sessionQuery() {
            if (!this.filteredSessions.some((session) => session.id === this.activeSessionId) && this.filteredSessions[0]) {
                this.activeSessionId = this.filteredSessions[0].id;
            }
        }
    }
});
