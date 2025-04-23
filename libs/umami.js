'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class Umami {
  constructor(options = {}) {
    __publicField(this, "options");
    __publicField(this, "properties");
    this.options = options;
    this.properties = {};
  }
  init(options) {
    this.options = { ...this.options, ...options };
  }
    send(payload, type = "event") {
    const { hostUrl, userAgent } = this.options;
    const httpModule = hostUrl.startsWith('https:') ? require('https') : require('http');
    const parsedUrl = new URL(hostUrl);

    return new Promise((resolve, reject) => {
      const req = httpModule.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: '/api/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': userAgent || `Mozilla/5.0 (${(() => {
              const os = require('os');
              const platformMap = {
                'darwin': `Macintosh; Intel Mac OS X ${os.release().replace(/\./g, '_')}`,
                'win32': `Windows NT ${os.release().split('.')[0]}; Win64; x64`,
                'linux': `X11; Linux ${os.release().split('-')[0]}`
              };
              return platformMap[process.platform] || 'Unknown Platform';
            })()}) Chrome/${process.versions.chrome}`//`Mozilla/5.0 Umami/${process.version}`
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`Request failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify({ type, payload }));
      req.end();
    });
  }
  send2(payload, type = "event") {
    const { hostUrl, userAgent } = this.options;
    return fetch(`${hostUrl}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": userAgent || `Mozilla/5.0 Umami/${process.version}`
      },
      body: JSON.stringify({ type, payload })
    });
  }
  track(event, eventData) {
    const type = typeof event;
    const { websiteId } = this.options;
    switch (type) {
      case "string":
        return this.send({
          website: websiteId,
          name: event,
          data: eventData
        });
      case "object":
        return this.send({ website: websiteId, ...event });
    }
    return Promise.reject("Invalid payload.");
  }
  identify(properties = {}) {
    this.properties = { ...this.properties, ...properties };
    const { websiteId } = this.options;
    return this.send({ website: websiteId, data: { ...this.properties } }, "identify");
  }
  reset() {
    this.properties = {};
  }
}
const umami = new Umami();

exports.Umami = Umami;
exports.default = umami;
//# sourceMappingURL=index.js.map
