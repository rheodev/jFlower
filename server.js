const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const Utils = require('./utils');
const mime = require('./mime').types;
const mp4 = require('./libs/mp4');
const {
    Transform,
    pipeline
} = require('stream');
const Clients = require('./clients');
const utils = require('./utils');

function decodeName(name) {
    if (!name) return '';
    try {
        return decodeURIComponent(name);
    } catch (e) {
        return name;
    }
}

function renderWapPage() {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
    <title>jFlower Chat</title>
    <style>
        :root {
            --bg: #f5ecdf;
            --panel: rgba(255, 250, 244, 0.88);
            --panel-strong: #fffaf2;
            --panel-muted: rgba(255, 255, 255, 0.66);
            --line: rgba(72, 47, 20, 0.12);
            --ink: #2f2417;
            --muted: #7f6a53;
            --accent: #c86f31;
            --accent-soft: rgba(200, 111, 49, 0.12);
            --bubble-in: #fffdfa;
            --bubble-out: #2f2417;
            --bubble-out-ink: #fff3e3;
            --shadow: 0 18px 46px rgba(62, 42, 20, 0.12);
        }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            min-height: 100vh;
            color: var(--ink);
            font-family: "Avenir Next", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
            background:
                radial-gradient(circle at top left, rgba(200, 111, 49, 0.2), transparent 28%),
                radial-gradient(circle at top right, rgba(121, 153, 115, 0.14), transparent 26%),
                linear-gradient(180deg, #f0e4d1 0%, var(--bg) 42%, #ebe2d6 100%);
        }

        button:focus-visible,
        a:focus-visible {
            outline: 3px solid rgba(200, 111, 49, 0.28);
            outline-offset: 2px;
        }

        .shell {
            padding: 14px 12px 20px;
        }

        .hero, .sessions, .chat {
            border: 1px solid var(--line);
            background: var(--panel);
            backdrop-filter: blur(18px);
            border-radius: 24px;
            box-shadow: var(--shadow);
        }

        .hero {
            padding: 16px;
            margin-bottom: 12px;
        }

        .hero-top, .hero-stats, .chat-head, .file-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }

        .badge,
        .hero-stats span {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-height: 32px;
            padding: 6px 10px;
            border-radius: 999px;
            font-size: 12px;
            color: var(--accent);
            background: var(--accent-soft);
            border: 1px solid rgba(200, 111, 49, 0.1);
        }

        .hero-stats {
            margin-top: 12px;
            flex-wrap: wrap;
        }

        .hero-stats span {
            color: var(--muted);
            background: rgba(255, 255, 255, 0.62);
        }

        .hero-stats strong {
            color: var(--ink);
        }

        .title {
            margin: 12px 0 4px;
            font-size: 28px;
            line-height: 0.96;
            font-weight: 800;
            letter-spacing: -0.04em;
        }

        .meta {
            color: var(--muted);
            font-size: 13px;
        }

        .toolbar {
            margin-top: 14px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .toolbar a, .toolbar button {
            appearance: none;
            min-height: 44px;
            border: 1px solid rgba(72, 47, 20, 0.1);
            padding: 10px 14px;
            border-radius: 999px;
            font-size: 13px;
            color: var(--ink);
            background: rgba(255, 255, 255, 0.78);
            text-decoration: none;
        }

        .sessions {
            padding: 10px;
            overflow-x: auto;
            white-space: nowrap;
            margin-bottom: 12px;
        }

        .session-chip {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            min-width: 150px;
            margin-right: 10px;
            padding: 12px 14px;
            border-radius: 20px;
            border: 1px solid transparent;
            background: var(--panel-muted);
            color: var(--ink);
            text-align: left;
        }

        .session-chip.active {
            border-color: rgba(200, 111, 49, 0.3);
            background: var(--panel-strong);
            box-shadow: inset 0 0 0 1px rgba(200, 111, 49, 0.08);
        }

        .session-avatar {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 14px;
            flex: none;
            background: linear-gradient(135deg, rgba(200, 111, 49, 0.16), rgba(89, 138, 98, 0.12));
            color: #a5521d;
            font-size: 12px;
            font-weight: 800;
        }

        .session-copy {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 0;
        }

        .session-copy strong,
        .session-copy small {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .session-copy small {
            color: var(--muted);
        }

        .chat {
            min-height: 58vh;
            padding: 16px;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #cbb89f;
            flex: none;
        }

        .status-dot.online {
            background: #5f9c67;
            box-shadow: 0 0 0 6px rgba(95, 156, 103, 0.12);
        }

        .messages {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 16px;
        }

        .message {
            display: flex;
            flex-direction: column;
            gap: 6px;
            max-width: 90%;
        }

        .message.out {
            align-self: flex-end;
            text-align: right;
        }

        .message .time {
            color: var(--muted);
            font-size: 11px;
        }

        .bubble {
            padding: 14px 15px;
            border-radius: 20px;
            background: var(--bubble-in);
            border: 1px solid rgba(72, 47, 20, 0.08);
            box-shadow: 0 10px 24px rgba(48, 34, 18, 0.08);
            word-break: break-word;
            line-height: 1.7;
        }

        .message.out .bubble {
            background: var(--bubble-out);
            color: var(--bubble-out-ink);
            border-color: transparent;
        }

        .bubble img {
            display: block;
            max-width: 100%;
            border-radius: 16px;
        }

        .file-card {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .file-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }

        .file-top strong {
            line-height: 1.5;
        }

        .file-type {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 42px;
            height: 26px;
            padding: 0 8px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 800;
            color: #a5521d;
            background: rgba(200, 111, 49, 0.12);
        }

        .message.out .file-type {
            background: rgba(255, 255, 255, 0.12);
            color: #fff1de;
        }

        .file-meta {
            color: inherit;
            font-size: 12px;
            opacity: 0.82;
        }

        .progress {
            overflow: hidden;
            height: 6px;
            border-radius: 999px;
            background: rgba(127, 106, 83, 0.14);
        }

        .progress span {
            display: block;
            height: 100%;
            width: 0;
            border-radius: inherit;
            background: linear-gradient(90deg, #c86f31, #dd9958);
        }

        .empty {
            padding: 36px 12px;
            text-align: center;
            color: var(--muted);
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.54);
            border: 1px solid rgba(72, 47, 20, 0.08);
        }

        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation: none !important;
                transition: none !important;
                scroll-behavior: auto !important;
            }
        }
    </style>
</head>
<body>
    <div class="shell">
        <section class="hero">
            <div class="hero-top">
                <div class="badge">jFlower Chat</div>
                <div class="badge" id="refreshStatus">等待刷新</div>
            </div>
            <div class="title" id="localTitle">正在连接…</div>
            <div class="meta" id="localMeta">准备读取本机会话</div>
            <div class="hero-stats">
                <span><strong id="sessionCount">0</strong> 个会话</span>
                <span><strong id="shareState">未开启</strong> 目录分享</span>
            </div>
            <div class="toolbar">
                <a href="/share" target="_blank" rel="noreferrer">打开目录分享</a>
                <button id="manualRefresh" type="button">立即刷新</button>
            </div>
        </section>
        <section class="sessions" id="sessions"></section>
        <section class="chat">
            <div class="chat-head">
                <div>
                    <div class="title" id="sessionTitle" style="font-size:22px;margin:0 0 4px;">暂无会话</div>
                    <div class="meta" id="sessionMeta">等待设备上线</div>
                </div>
                <div class="status-dot" id="sessionDot"></div>
            </div>
            <div class="messages" id="messages"></div>
        </section>
    </div>
    <script>
        const state = {
            sessions: [],
            activeId: '',
        };

        function escapeHtml(text) {
            return String(text || '').replace(/[&<>"']/g, (char) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[char]));
        }

        function initials(text) {
            const value = String(text || 'JF').trim();
            if (!value) return 'JF';
            return value.length <= 2 ? value.toUpperCase() : value.slice(0, 2).toUpperCase();
        }

        function formatTime(value) {
            if (!value) return '';
            const date = new Date(value);
            return date.toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function formatSize(size) {
            if (!size) return '0 B';
            const units = ['B', 'KB', 'MB', 'GB'];
            let value = size;
            let index = 0;
            while (value >= 1024 && index < units.length - 1) {
                value = value / 1024;
                index++;
            }
            return value.toFixed(value >= 100 ? 0 : 1) + ' ' + units[index];
        }

        function currentSession() {
            return state.sessions.find((session) => session.id === state.activeId) || state.sessions[0] || null;
        }

        function renderSessions() {
            const el = document.getElementById('sessions');
            if (!state.sessions.length) {
                el.innerHTML = '<div class="empty">暂无在线或历史设备</div>';
                return;
            }

            el.innerHTML = state.sessions.map((session) => {
                const active = session.id === state.activeId ? 'active' : '';
                const last = session.messages.length ? session.messages[session.messages.length - 1] : null;
                const preview = last ? (last.type === 'text' ? String(last.content).slice(0, 18) : last.type === 'img' ? '图片' : '文件') : '暂无消息';
                return '<button class="session-chip ' + active + '" data-session-id="' + escapeHtml(session.id) + '">' +
                    '<span class="session-avatar">' + initials(session.hostName) + '</span>' +
                    '<span class="session-copy">' +
                    '<strong>' + escapeHtml(session.hostName) + '</strong>' +
                    '<small>' + escapeHtml(session.ip || '未知 IP') + '</small>' +
                    '<small>' + escapeHtml(preview) + '</small>' +
                    '</span>' +
                '</button>';
            }).join('');

            el.querySelectorAll('[data-session-id]').forEach((node) => {
                node.addEventListener('click', () => {
                    state.activeId = node.getAttribute('data-session-id');
                    renderAll();
                });
            });
        }

        function renderMessages() {
            const session = currentSession();
            const titleEl = document.getElementById('sessionTitle');
            const metaEl = document.getElementById('sessionMeta');
            const dotEl = document.getElementById('sessionDot');
            const messagesEl = document.getElementById('messages');

            if (!session) {
                titleEl.textContent = '暂无会话';
                metaEl.textContent = '等待设备上线';
                dotEl.className = 'status-dot';
                messagesEl.innerHTML = '<div class="empty">进入插件并完成一次局域网扫描后，这里会显示聊天记录。</div>';
                return;
            }

            titleEl.textContent = session.hostName;
            metaEl.textContent = (session.ip || '未知 IP') + ' · ' + (session.online ? '在线' : '离线');
            dotEl.className = 'status-dot' + (session.online ? ' online' : '');

            if (!session.messages.length) {
                messagesEl.innerHTML = '<div class="empty">这个设备还没有消息。</div>';
                return;
            }

            messagesEl.innerHTML = session.messages.map((message) => {
                const file = message.type === 'file' ? message.content || {} : null;
                let body = '';
                if (message.type === 'text') {
                    body = '<div class="bubble">' + escapeHtml(message.content) + '</div>';
                } else if (message.type === 'img') {
                    body = '<div class="bubble"><img src="' + message.content + '" alt="image" /></div>';
                } else if (message.type === 'file') {
                    const percent = message.progress && message.progress.percent ? message.progress.percent : 0;
                    body = '<div class="bubble"><div class="file-card">' +
                        '<div class="file-top"><strong>' + escapeHtml(file.name || '文件') + '</strong><span class="file-type">' + escapeHtml(((file.name || 'file').split('.').pop() || 'file').slice(0, 4)) + '</span></div>' +
                        '<div class="file-meta"><span>' + escapeHtml(message.status || '') + '</span><span>' + percent + '%</span></div>' +
                        '<div class="progress"><span style="width:' + percent + '%"></span></div>' +
                        '<div class="file-meta"><span>' + formatSize(message.progress.transferred) + '</span><span>' + formatSize(message.progress.total) + '</span></div>' +
                    '</div></div>';
                }
                return '<div class="message ' + message.direction + '">' +
                    '<div class="time">' + formatTime(message.time) + '</div>' +
                    body +
                '</div>';
            }).join('');
        }

        function renderAll() {
            if (!currentSession() && state.sessions.length) {
                state.activeId = state.sessions[0].id;
            }
            renderSessions();
            renderMessages();
        }

        async function refresh() {
            try {
                const response = await fetch('/chatState?_=' + Date.now(), { cache: 'no-store' });
                const data = await response.json();
                state.sessions = data.sessions || [];
                if (!state.activeId && state.sessions.length) {
                    state.activeId = state.sessions[0].id;
                }
                document.getElementById('localTitle').textContent = (data.settings && data.settings.name ? data.settings.name : 'jFlower') + ' · ' + (data.localIp || '未获取到本机 IP');
                document.getElementById('localMeta').textContent = '端口 ' + ((data.settings && data.settings.localPort) || '') + ' · 最近在局域网内同步会话';
                document.getElementById('sessionCount').textContent = state.sessions.length;
                document.getElementById('shareState').textContent = data.settings && data.settings.sharing ? '已开启' : '未开启';
                document.getElementById('refreshStatus').textContent = '已刷新 ' + new Date().toLocaleTimeString('zh-CN');
                renderAll();
            } catch (error) {
                document.getElementById('refreshStatus').textContent = '刷新失败';
            }
        }

        document.getElementById('manualRefresh').addEventListener('click', refresh);
        refresh();
        setInterval(refresh, 4000);
    </script>
</body>
</html>`;
}

class MyIncome extends http.IncomingMessage {

}

var server = {

    instance: null,
    port: null,
    runTime: runTime.server,
    getClientIp: function (req) {
        return req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;
    },
    init: function () {
        this.port = runTime.settings.localPort;
    },
    check: function (cb) {
        this.init();
        var _this = this;
        http.get('http://127.0.0.1:' + this.port + '/check', (res) => {
            res.resume();
            //cb();console.log('ok');
            http.get('http://127.0.0.1:' + this.port + '/check', (res) => {
                res.resume();
                cb();
                console.log('ok');

            }).on('error', (err) => {

                console.log('err');
                _this.create(cb);
            });
        }).on('error', (err) => {

            console.log('err:', err);
            _this.create(cb);
        });
    },

    create: function (cb) {

        var _this = this;
        this.instance = http.createServer({
            IncomingMessage: MyIncome //http.IncomingMessage
        }, (req, res) => {
            console.log(req.headers);
            //限制客户端请求host为127.0.0.1或本机ip，预防dns rebind攻击
            //if (req.headers.host !== '127.0.0.1:' + _this.port && req.headers.host !== runTime.localIp + ':' + _this.port) {
            if (/[^0-9\.:]/.test(req.headers.host)) { //只允许ip访问
                res.writeHead(403, {
                    'Content-Type': 'text/plain' + ';charset=utf-8'
                });
                res.end();
                return;
            }

            if (req.url == "/favicon.ico") {
                res.end();
                return;
            }

            //检查暗号
            if (runTime.settings.findingCode.isOnly && req.headers.findingcode != runTime.settings.findingCode.code) {
                res.writeHead(404, {
                    'Content-Type': 'text/plain' + ';charset=utf-8'
                });
                res.end();
                return;
            }

            //req.setEncoding('utf8');
            //console.log('req:', req);
            res.on('end', () => {
                console.log('res end');
            });
            //var url = req.url.split('?');
            var cmd = `on_${req.headers.cmd}`;
            //req.ip = _this.getClientIp(req).replace('::ffff:', '');
            if (this[cmd])
                this[cmd](req, res);
            else if (req.url.indexOf('/share') === 0)
                this['on_share'](req, res);
            else if (req.url.indexOf('/wap') === 0)
                this['on_wap'](req, res);
            else if (req.url.indexOf('/chatState') === 0)
                this['on_chatState'](req, res);
            else {
                res.writeHead(200, {
                    'Content-Type': 'text/plain' + ';charset=utf-8'
                });
                res.write('jFlower (局发) is running ...\n');
                res.end();
            }


        }).listen(this.port, cb); //ipv6 ,'::'
        this.instance.on('clientError', (err, socket) => {
            socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
            console.log(err);
        });
        //this.instance.setTimeout(2000);
        //this.instance.keepAliveTimeout(1000);


    },
    on_share: function (req, res) {
        //检查分享开关
        if (!runTime.settings.sharing) {
            res.writeHead(404, {
                'Content-Type': 'text/plain' + ';charset=utf-8'
            });
            res.end();
            return;
        }
        var root = runTime.settings.sharePath;
        console.log(root);
        var pathname = decodeURIComponent(url.parse(req.url.replace('/share', '/')).pathname);
        var realPath = path.join(root, pathname);
        console.log(realPath);

        //限制目录请求范围
        if (realPath.indexOf(root) !== 0) {
            res.writeHead(404, {
                'Content-Type': 'text/plain' + ';charset=utf-8'
            });
            res.end();
            return;
        }
        //判断文件 或 目录
        fs.stat(realPath, function (err, stats) {

            if (err) {
                res.writeHead(404, {
                    'Content-Type': 'text/plain' + ';charset=utf-8'
                });

                res.write("This request URL " + pathname + " was not found on this server.[jFlower]");
                res.end();
                return;
            }

            if (stats.isFile()) { //文件


                let ext = path.extname(realPath);
                ext = ext ? ext.slice(1) : 'unknown';
                var contentType = mime[ext] || "application/octet-stream";
                console.log(contentType);
                if (/(audio|video)/.test(contentType)) {
                    //断点续传，获取分段的位置
                    var range = req.headers.range;
                    if (range) {
                        //替换、切分，请求范围格式为：Content-Range: bytes 0-2000/4932
                        var positions = range.replace(/bytes=/, "").split("-");
                        //获取客户端请求文件的开始位置
                        var start = parseInt(positions[0]);
                        //获得文件大小
                        var total = stats.size;
                        //获取客户端请求文件的结束位置
                        var end = positions[1] ? parseInt(positions[1], 10) : total - 1;
                        //获取需要读取的文件大小
                        var chunksize = (end - start) + 1;
                        res.writeHead(206, {
                            "Content-Range": "bytes " + start + "-" + end + "/" + total,
                            "Accept-Ranges": "bytes",
                            "Content-Length": chunksize,
                            "Content-Type": contentType
                        });
                    } else
                        res.writeHead(200, {
                            "Accept-Ranges": "bytes",
                            "Content-Length": stats.size,
                            "Content-Type": contentType
                        });

                } else {
                    res.writeHead(200, {
                        'Content-Type': contentType
                    });
                }
                var rs = fs.createReadStream(realPath, start ? {
                    start: start,
                    end: end,
                    //highWaterMark: 2560 * 1024
                } : {
                    // highWaterMark: 1280 * 1024
                });
                // rs.on('data', function (chunk) {
                //     res.write(chunk);
                //     });

                rs.on('ready', function () {
                    rs.pipe(res);
                });
                rs.on('end', function () {
                    res.end();
                });
                rs.on('error', function (err) {
                    res.writeHead(500, {
                        'Content-Type': 'text/plain' + ';charset=utf-8'
                    });
                    res.end(err);
                });




            } else if (stats.isDirectory()) {

                fs.readdir(realPath, function (err, files) {
                    if (err) {
                        res.writeHead(500, {
                            'Content-Type': 'text/plain' + ';charset=utf-8'
                        });
                        res.end(err);
                    } else {
                        var contentType = mime['html'] || "text/plain";
                        res.writeHead(200, {
                            'Content-Type': contentType + ';charset=utf-8'
                        });
                        res.write(`
                        <head><meta name="viewport" content="width=device-width,minimum-scale=1.0,maximum-scale=1.0,user-scalable=no"></head>
                        `);
                        
                        res.write(`
                        <style>
                        body{font-family: "Helvetica Neue",Helvetica,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","微软雅黑",Arial,sans-serif;color:#9ea7b4;}
                        a {
                        color:#464c5b;
                        font-size: 20px;
                        font-weight: bold;
                        text-decoration: none;
                        word-break: break-word;
                    }
                    a.dir{color:#3399ff;}
                    .time ,.size {
                        color:#9ea7b4;
                        font-size: 14px;
                    }
                    .size{color:#657180;font-weight: bold;}
                    hr{border: none;
                        border-bottom: solid 1px #e8eaec;}
                        </style>
                        `);
                        var size_unit=['B','KB','MB','GB'];
                        function parseSize(size ,i){
                            return size<1000?size.toFixed(2)+' '+size_unit[i]:parseSize(size/1000 ,i+1);
                        }
                        files.map(function (fileName) {
                            if(fileName.indexOf('.')===0)return null;
                            let stat = fs.statSync(realPath + '/' + fileName);
                            console.log(stat);
                            size = stat.size;
                            return {
                              name: fileName,
                              time: stat.mtimeMs,
                              localTime :(new Date().toLocaleDateString() == stat.mtime.toLocaleDateString()?'':stat.mtime.toLocaleDateString()) +' '+ stat.mtime.toLocaleTimeString('chinese',{hour12:false}),
                              size:parseSize(size ,0),
                              isDir:stat.isDirectory()
                            };
                          })
                          .filter((i)=>{return !!i;})
                          .sort(function (a, b) {
                            return b.time - a.time; })
                          .map(function (v) {
                            res.write(`<br><a ${v.isDir ? `class="dir"`:'' } href="${url.format(url.parse(path.join('/share', pathname, encodeURIComponent(v.name))))}">${v.name}</a>
                            <br>
                            ${v.isDir ? '':`[<span class="size">${v.size}</span>]` }
                            <span class="time">${v.localTime}</span>
                            <hr>
                            
                            `);
                        });
                        
                        res.end();
                    }
                });
            }

        });

    },
    on_getFile: function (req, res) {
        let h = runTime.getHistory(req.headers.key);
        if (!h) {
            res.writeHead(404, {
                'Content-Type': 'text/plain' + ';charset=utf-8'
            });
            res.end();
            return;
        }
        console.log(h);
        let runData = h.content;
        let realPath = runData.path;
        fs.stat(realPath, function (err, stats) {
            if (err) {
                res.writeHead(404, {
                    'Content-Type': 'text/plain' + ';charset=utf-8'
                });
                res.end();
                return;
            }
            //替换、切分，请求范围格式为：Content-Range: bytes 0-2000/4932
            var positions = req.headers.range.replace(/bytes=/, "").split("-");
            //获取客户端请求文件的开始位置
            var start = parseInt(positions[0]);
            //获得文件大小
            var total = stats.size;
            //获取客户端请求文件的结束位置
            var end = positions[1] ? parseInt(positions[1], 10) : total - 1;
            //获取需要读取的文件大小
            var chunksize = (end - start) + 1;
            console.log(total, end, chunksize);
            let ext = path.extname(realPath);
                ext = ext ? ext.slice(1) : 'unknown';
            res.writeHead(206, {
                "Content-Range": "bytes " + start + "-" + end + "/" + total,
                "Accept-Ranges": "bytes",
                "Content-Length": chunksize,
                "Content-Type":  mime[ext] || "application/octet-stream"
            });

            var rs = fs.createReadStream(realPath, {
                start: start,
                end: end,
                //highWaterMark: 2560 * 1024
            });

            runData.status = 'sending';
            runData.startTime = new Date().getTime();
            var transferred = 0;
            var elapsed = 0;
            this.RSpool[req.headers.key] = [res, rs];
            rs.on('data', function (chunk) { //console.log('server.data')
                transferred += chunk.length;
                elapsed = (new Date().getTime()) - runData.startTime;
                if (elapsed - runData.elapsed > 500) {
                    Object.assign(runData, {
                        transferred: transferred,
                        elapsed: elapsed
                    });
                    if (runData.status == 'paused') {
                        console.log(runData.status);
                        res.destroy();
                        rs.destroy();
                    }
                }

            });
            rs.on('ready', function () {
                rs.pipe(res);
            });
            rs.on('end', function () {
                Object.assign(runData, {
                    transferred: transferred,
                    elapsed: elapsed,
                    status: 'completed'
                });
                delete server.RSpool[req.headers.key];
                res.end();
            });
            rs.on('error', function (err) {
                Object.assign(runData, {
                    transferred: transferred,
                    elapsed: elapsed,
                    status: 'paused'
                });
                delete server.RSpool[req.headers.key];
                res.writeHead(500, {
                    'Content-Type': 'text/plain' + ';charset=utf-8'
                });
                res.end(err);
            });
            res.on('error', function (err) {
                Object.assign(runData, {
                    transferred: transferred,
                    elapsed: elapsed,
                    status: 'paused'
                });
                delete server.RSpool[req.headers.key];
                rs.destroy();
            });
            req.on('error', function (err) {
                Object.assign(runData, {
                    transferred: transferred,
                    elapsed: elapsed,
                    status: 'paused'
                });
                delete server.RSpool[req.headers.key];
                rs.destroy();
            });
            req.on('end', function (err) {
                Object.assign(runData, {
                    transferred: transferred,
                    elapsed: elapsed,
                    status: 'paused'
                });
                delete server.RSpool[req.headers.key];
                rs.destroy();
            });

        });
    },
    on_wap: function (req, res) {
        res.writeHead(200, {
            'Content-Type': 'text/html;charset=utf-8'
        });
        res.end(renderWapPage());
    },
    on_chatState: function (req, res) {
        res.writeHead(200, {
            'Content-Type': 'application/json;charset=utf-8',
            'Cache-Control': 'no-store'
        });
        res.end(JSON.stringify(runTime.getChatState()));
    },
    on_detect: function (req, res) {
        if (!runTime.settings.canBeFound) {
            res.end();
            return;
        }


        if (req.headers.ip == runTime.localIp) {
            res.end();
            return;
        }

        console.log('req.headers:', req.headers);

        if (runTime.settings.findingCode.isOnly && req.headers.findingcode != runTime.settings.findingCode.code) {
            //如果暗号不一样 则不要被动添加对方
            res.end();
            return;
        }
        res.setHeader('id', runTime.localId);
        res.setHeader('name', encodeURIComponent(runTime.settings.name));
        res.end();

        Utils.addFeature(req.headers.ip, decodeURIComponent(req.headers.name));
        // Utils.toast(`${decodeURIComponent(req.headers.name)}(${req.headers.ip})发现了你`);

    },
    on_close: function (req, res) {
        res.end();
        this.instance && this.instance.close();
    },
    on_text: function (req, res) {
        var _this = this;
        req.setEncoding('utf8');
        let rawData = '';
        req.on('data', (chunk) => {
            rawData += chunk;
        });
        req.on('end', () => {
            if (/^https{0,1}:\/\/\S+$/.test(rawData)) {
                utools.copyText(rawData);
                utools.shellOpenExternal(rawData);
            } else {
                utools.copyText(rawData);
                Utils.toast(`"${rawData}"已复制到剪贴板`);
            }
            res.end();
            //let ip = _this.getClientIp(req);
            //console.log('ip', req.ip)
            runTime.addHistory({
                ip: req.headers.ip,
                hostName: runTime.hosts.ips[req.headers.ip]?runTime.hosts.ips[req.headers.ip].hostName:decodeName(req.headers.name),
                id: '',
                type: 1, //1 from,2 to
                content: rawData,
                contentType: 'text', //text file
                time: new Date().getTime()
            });
        });

    },
    on_fileAsk: function (req, res) {
        var runData = {};
        runData.path = runTime.settings.downloadPath + path.sep;
        runData.name = utils.checkFileExists(runData.path, decodeURI(req.headers.file_name));
        runData.path += runData.name;

        runData.total = parseInt(req.headers.file_size);
        runData.transferred = 0;
        runData.elapsed = 0;
        runData.startTime = (new Date()).getTime();
        runData.status = 'paused';
        runData.key = req.headers.key;

        var key = runTime.addHistory({
            ip: req.headers.ip,
            hostName: runTime.hosts.ips[req.headers.ip]?runTime.hosts.ips[req.headers.ip].hostName:decodeName(req.headers.name),
            id: '',
            type: 1,
            content: runData,
            contentType: 'file', //text file
            time: new Date().getTime()
        });
        req.on('end', () => {

            res.end();
        })
        req.resume();

        setTimeout(() => {
            Clients.acceptFile(key);
        });

    },
    RSpool: {}, //sendFile 的 rs对象池
    on_file: function (req, res) {
        var _this = this;
        var runData = {};console.log('on_file',req.headers);
        runData.name = decodeURI(req.headers.file_name);
        var target_file = runData.path = runTime.settings.downloadPath + path.sep + runData.name;
        var size = runData.total = parseInt(req.headers['content-length']);

        if (fs.existsSync(target_file) && fs.statSync(target_file).isDirectory()) {
            Utils.toast(`[err]"${runData.name}"是一个目录`);
            res.end();
        } else {
            var ws = fs.createWriteStream(target_file, {
                flags: 'w',
                //highWaterMark: 5120*1024
            });
            runData.transferred = 0;
            runData.elapsed = 0;
            runData.startTime = (new Date()).getTime();
            runData.status = 'sending';
            // req.onDataListener = (chunk) => {
            //     runData.transferred += chunk.length;
            //     runData.elapsed = (new Date().getTime()) - runData.startTime;
            //     //
            //     //ws.write(chunk);
            // };

            // req.on('end', () => {
            //     // console.log('finish:', (new Date()).getTime());
            //     //     runData.status = 'completed';
            //     //     runTime.updHistory();
            //     //     //utools.outPlugin();
            //     //     utools.shellShowItemInFolder(target_file);
            //     //res.end();
            // });
            var transferred = runData.transferred;
            var elapsed = runData.elapsed;
            var updateProgress = function(status){
                Object.assign(runData, {
                    transferred: transferred,
                    elapsed: elapsed,
                    status:status?status:runData.status
                });
            }

            req.on('error', (err) => {
                console.log('err:', err);
                runData.status = 'error';
                updateProgress();
                runTime.updHistory();
                // ws.destroy();
            });
            ws.on('error', function (err) {
                console.log('err:', err);
                runData.status = 'error';
                updateProgress();
                runTime.updHistory();
                // req.destroy(err);
            });
            

            
            let transform = new Transform({
                transform(chunk, encoding, callback) {
                    transferred += chunk.length;console.log(transferred)
                    elapsed = (new Date().getTime()) - runData.startTime;
                    if (elapsed - runData.elapsed > 500) {
                        updateProgress();
                        if (runData.status == 'paused') {
                            console.log(runData.status);
                            // res.destroy();
                            // rs.destroy();
                        }
                    }
                    callback(null, chunk);
                }
            });

            pipeline(
                req,
                transform,
                ws,
                (err) => {
                    updateProgress();
                    delete _this.RSpool[key];
                    if (err) {
                        console.log('err:', err);
                        runData.status = 'error';
                        runTime.updHistory();
                        //req.destroy(err);
                        res.end();
                    } else {
                        console.log('finish:', (new Date()).getTime());
                        runData.status = 'completed';
                        runTime.updHistory();
                        //utools.outPlugin();
                        utools.shellShowItemInFolder(target_file);
                        res.end();
                    }
                }
            );

            //req.pipe(transform).pipe(ws);//
            // req.on('data', req.onDataListener);


            utools.showMainWindow();
            Utils.toast(`收到文件[${runData.name}]`);

            let key = runTime.addHistory({
                ip: req.headers.ip, //req.ip,
                hostName: runTime.hosts.ips[req.headers.ip] ? runTime.hosts.ips[req.headers.ip].hostName : decodeName(req.headers.name),
                id: '',
                type: 1, //1 from,2 to
                content: runData,
                contentType: 'file', //text file
                time: new Date().getTime()
            });
            _this.RSpool[key] = [req, transform];
        }

    },
    pauseFileSend: function (key) {
        let h = runTime.getHistory(key);
        console.log(h);
        if(!h)return;
        let runData = h.content;
        runData.status = 'paused';
        let pool = this.RSpool[key];
        if(pool){
            pool.forEach((target)=>{
                if(target && typeof target.destroy === 'function'){
                    target.destroy();
                }
            });
            delete this.RSpool[key];
        }
    },
    resumeFileSend: function (key) {
        utils.toast('续传只能由接收方发起');
    },
    cancelFileSend: function (key) {
        let h = runTime.getHistory(key);
        if(!h)return;
        h.content.status = 'canceled';
        let pool = this.RSpool[key];
        if(pool){
            pool.forEach((target)=>{
                if(target && typeof target.destroy === 'function'){
                    target.destroy();
                }
            });
            delete this.RSpool[key];
        }
    },

    // cancelFileSend:function(key){
    //     if(typeof this.RSpool[key][0] == "object"){
    //       this.RSpool[key][0].unpipe();
    //       this.RSpool[key][0].destroy(new Error('User canceled'));
    //     }
    //   },
    //   pauseFileSend:function(key){console.log(key);console.log(this.RSpool[key])
    //     if(typeof this.RSpool[key][0] == "object"){
    //         this.RSpool[key][0].socket.pause();
    //         //this.RSpool[key][1].pause();
    //         this.RSpool[key][0].pause();
    //         //this.RSpool[key][0].unpipe();
    //         //this.RSpool[key].removeListener('data',this.RSpool[key].onDataListener);
    //       let h = runTime.getHistory(key);
    //       if(h)
    //         h.content.status = 'paused';
    //     }
    //   },
    //   resumeFileSend:function(key){
    //     if(typeof this.RSpool[key][0] == "object"){
    //       //this.RSpool[key][0].pipe(this.RSpool[key][1]);
    //       //this.RSpool[key].on('data', this.RSpool[key].onDataListener);
    //       //this.RSpool[key][1].resume();
    //       this.RSpool[key][0].resume();
    //       this.RSpool[key][0].socket.resume();
    //       let h = runTime.getHistory(key);
    //       if(h)
    //         h.content.status = 'sending';
    //     }
    //   },
    on_img: function (req, res) {
        console.log('img');
        req.setEncoding('utf8');
        let rawData = '';
        req.on('data', (chunk) => {
            rawData += chunk;
            console.log(chunk);
        });
        req.on('end', () => {
            console.log('end');
            utools.copyImage(rawData);
            res.end();
            Utils.toast(`收到[图片]已复制到剪贴板`);
            runTime.addHistory({
                ip: req.headers.ip,
                hostName: runTime.hosts.ips[req.headers.ip]?runTime.hosts.ips[req.headers.ip].hostName :decodeName(req.headers.name),
                id: '',
                type: 1, //1 from,2 to
                content: rawData,
                contentType: 'img', //text file
                time: new Date().getTime()
            });
        });

    }
};

module.exports = server;
