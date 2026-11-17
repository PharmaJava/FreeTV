/* Stremio Claude Torrents 1.0.0 for FreeTV: src/service.js with torrent-stream (MIT) and its dependencies. Built by build.js; do not edit. */
var global = this;
"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// node_modules/hat/index.js
var require_hat = __commonJS({
  "node_modules/hat/index.js"(exports2, module2) {
    var hat = module2.exports = function(bits, base) {
      if (!base) base = 16;
      if (bits === void 0) bits = 128;
      if (bits <= 0) return "0";
      var digits = Math.log(Math.pow(2, bits)) / Math.log(base);
      for (var i = 2; digits === Infinity; i *= 2) {
        digits = Math.log(Math.pow(2, bits / i)) / Math.log(base) * i;
      }
      var rem = digits - Math.floor(digits);
      var res = "";
      for (var i = 0; i < Math.floor(digits); i++) {
        var x = Math.floor(Math.random() * base).toString(base);
        res = x + res;
      }
      if (rem) {
        var b = Math.pow(base, rem);
        var x = Math.floor(Math.random() * b).toString(base);
        res = x + res;
      }
      var parsed = parseInt(res, base);
      if (parsed !== Infinity && parsed >= Math.pow(2, bits)) {
        return hat(bits, base);
      } else return res;
    };
    hat.rack = function(bits, base, expandBy) {
      var fn = function(data) {
        var iters = 0;
        do {
          if (iters++ > 10) {
            if (expandBy) bits += expandBy;
            else throw new Error("too many ID collisions, use more bits");
          }
          var id = hat(bits, base);
        } while (Object.hasOwnProperty.call(hats, id));
        hats[id] = data;
        return id;
      };
      var hats = fn.hats = {};
      fn.get = function(id) {
        return fn.hats[id];
      };
      fn.set = function(id, value) {
        fn.hats[id] = value;
        return fn;
      };
      fn.bits = bits || 128;
      fn.base = base || 16;
      return fn;
    };
  }
});

// node_modules/cyclist/index.js
var require_cyclist = __commonJS({
  "node_modules/cyclist/index.js"(exports2, module2) {
    var Cyclist = function(size) {
      if (!(this instanceof Cyclist)) return new Cyclist(size);
      this.mask = 0;
      this.values = [];
      this.indexes = [];
      if (size) this.fit(size);
    };
    Cyclist.prototype.__defineGetter__("size", function() {
      return this.mask + 1;
    });
    Cyclist.prototype.put = function(index, val) {
      var pos = index & this.mask;
      this.indexes[pos] = index;
      this.values[pos] = val;
    };
    Cyclist.prototype.get = function(index) {
      return this.values[index & this.mask];
    };
    Cyclist.prototype.del = function(index) {
      var pos = index & this.mask;
      var val = this.values[pos];
      this.indexes[pos] = this.values[pos] = void 0;
      return val;
    };
    Cyclist.prototype.fit = function(size) {
      if (size <= this.size) return;
      while (this.size < size) this.mask = 2 * (this.mask + 1) - 1;
      var values = this.values;
      var indexes = this.indexes;
      this.values = new Array(this.size);
      this.indexes = new Array(this.size);
      for (var i = 0; i < indexes.length; i++) {
        if (indexes[i] !== void 0) this.put(indexes[i], values[i]);
      }
    };
    module2.exports = Cyclist;
  }
});

// node_modules/utp/index.js
var require_utp = __commonJS({
  "node_modules/utp/index.js"(exports2) {
    var dgram = require("dgram");
    var cyclist = require_cyclist();
    var util = require("util");
    var EventEmitter = require("events").EventEmitter;
    var Duplex = require("stream").Duplex;
    var EXTENSION = 0;
    var VERSION2 = 1;
    var UINT16 = 65535;
    var ID_MASK = 15 << 4;
    var MTU = 1400;
    var PACKET_DATA = 0 << 4;
    var PACKET_FIN = 1 << 4;
    var PACKET_STATE = 2 << 4;
    var PACKET_RESET = 3 << 4;
    var PACKET_SYN = 4 << 4;
    var MIN_PACKET_SIZE = 20;
    var DEFAULT_WINDOW_SIZE = 1 << 18;
    var CLOSE_GRACE = 5e3;
    var BUFFER_SIZE = 512;
    var uint32 = function(n) {
      return n >>> 0;
    };
    var uint16 = function(n) {
      return n & UINT16;
    };
    var timestamp = (function() {
      var offset = process.hrtime();
      var then = Date.now() * 1e3;
      return function() {
        var diff = process.hrtime(offset);
        return uint32(then + 1e6 * diff[0] + (diff[1] / 1e3 | 0));
      };
    })();
    var bufferToPacket = function(buffer) {
      var packet = {};
      packet.id = buffer[0] & ID_MASK;
      packet.connection = buffer.readUInt16BE(2);
      packet.timestamp = buffer.readUInt32BE(4);
      packet.timediff = buffer.readUInt32BE(8);
      packet.window = buffer.readUInt32BE(12);
      packet.seq = buffer.readUInt16BE(16);
      packet.ack = buffer.readUInt16BE(18);
      packet.data = buffer.length > 20 ? buffer.slice(20) : null;
      return packet;
    };
    var packetToBuffer = function(packet) {
      var buffer = new Buffer(20 + (packet.data ? packet.data.length : 0));
      buffer[0] = packet.id | VERSION2;
      buffer[1] = EXTENSION;
      buffer.writeUInt16BE(packet.connection, 2);
      buffer.writeUInt32BE(packet.timestamp, 4);
      buffer.writeUInt32BE(packet.timediff, 8);
      buffer.writeUInt32BE(packet.window, 12);
      buffer.writeUInt16BE(packet.seq, 16);
      buffer.writeUInt16BE(packet.ack, 18);
      if (packet.data) packet.data.copy(buffer, 20);
      return buffer;
    };
    var createPacket = function(connection, id, data) {
      return {
        id,
        connection: id === PACKET_SYN ? connection._recvId : connection._sendId,
        seq: connection._seq,
        ack: connection._ack,
        timestamp: timestamp(),
        timediff: 0,
        window: DEFAULT_WINDOW_SIZE,
        data,
        sent: 0
      };
    };
    var Connection = function(port, host, socket, syn) {
      Duplex.call(this);
      var self2 = this;
      this.port = port;
      this.host = host;
      this.socket = socket;
      this._outgoing = cyclist(BUFFER_SIZE);
      this._incoming = cyclist(BUFFER_SIZE);
      this._inflightPackets = 0;
      this._closed = false;
      this._alive = false;
      if (syn) {
        this._connecting = false;
        this._recvId = uint16(syn.connection + 1);
        this._sendId = syn.connection;
        this._seq = Math.random() * UINT16 | 0;
        this._ack = syn.seq;
        this._synack = createPacket(this, PACKET_STATE, null);
        this._transmit(this._synack);
      } else {
        this._connecting = true;
        this._recvId = 0;
        this._sendId = 0;
        this._seq = Math.random() * UINT16 | 0;
        this._ack = 0;
        this._synack = null;
        socket.on("listening", function() {
          self2._recvId = socket.address().port;
          self2._sendId = uint16(self2._recvId + 1);
          self2._sendOutgoing(createPacket(self2, PACKET_SYN, null));
        });
        socket.on("error", function(err) {
          self2.emit("error", err);
        });
        socket.bind();
      }
      var resend = setInterval(this._resend.bind(this), 500);
      var keepAlive = setInterval(this._keepAlive.bind(this), 10 * 1e3);
      var tick = 0;
      var closed = function() {
        if (++tick === 2) self2._closing();
      };
      var sendFin = function() {
        if (self2._connecting) return self2.once("connect", sendFin);
        self2._sendOutgoing(createPacket(self2, PACKET_FIN, null));
        self2.once("flush", closed);
      };
      this.once("finish", sendFin);
      this.once("close", function() {
        if (!syn) setTimeout(socket.close.bind(socket), CLOSE_GRACE);
        clearInterval(resend);
        clearInterval(keepAlive);
      });
      this.once("end", function() {
        process.nextTick(closed);
      });
    };
    util.inherits(Connection, Duplex);
    Connection.prototype.setTimeout = function() {
    };
    Connection.prototype.destroy = function() {
      this.end();
    };
    Connection.prototype.address = function() {
      return { port: this.port, address: this.host };
    };
    Connection.prototype._read = function() {
    };
    Connection.prototype._write = function(data, enc, callback) {
      if (this._connecting) return this._writeOnce("connect", data, enc, callback);
      while (this._writable()) {
        var payload = this._payload(data);
        this._sendOutgoing(createPacket(this, PACKET_DATA, payload));
        if (payload.length === data.length) return callback();
        data = data.slice(payload.length);
      }
      this._writeOnce("flush", data, enc, callback);
    };
    Connection.prototype._writeOnce = function(event, data, enc, callback) {
      this.once(event, function() {
        this._write(data, enc, callback);
      });
    };
    Connection.prototype._writable = function() {
      return this._inflightPackets < BUFFER_SIZE - 1;
    };
    Connection.prototype._payload = function(data) {
      if (data.length > MTU) return data.slice(0, MTU);
      return data;
    };
    Connection.prototype._resend = function() {
      var offset = this._seq - this._inflightPackets;
      var first = this._outgoing.get(offset);
      if (!first) return;
      var timeout = 5e5;
      var now = timestamp();
      if (uint32(first.sent - now) < timeout) return;
      for (var i = 0; i < this._inflightPackets; i++) {
        var packet = this._outgoing.get(offset + i);
        if (uint32(packet.sent - now) >= timeout) this._transmit(packet);
      }
    };
    Connection.prototype._keepAlive = function() {
      if (this._alive) return this._alive = false;
      this._sendAck();
    };
    Connection.prototype._closing = function() {
      if (this._closed) return;
      this._closed = true;
      process.nextTick(this.emit.bind(this, "close"));
    };
    Connection.prototype._recvAck = function(ack) {
      var offset = this._seq - this._inflightPackets;
      var acked = uint16(ack - offset) + 1;
      if (acked >= BUFFER_SIZE) return;
      for (var i = 0; i < acked; i++) {
        this._outgoing.del(offset + i);
        this._inflightPackets--;
      }
      if (!this._inflightPackets) this.emit("flush");
    };
    Connection.prototype._recvIncoming = function(packet) {
      if (this._closed) return;
      if (packet.id === PACKET_SYN && this._connecting) {
        this._transmit(this._synack);
        return;
      }
      if (packet.id === PACKET_RESET) {
        this.push(null);
        this.end();
        this._closing();
        return;
      }
      if (this._connecting) {
        if (packet.id !== PACKET_STATE) return this._incoming.put(packet.seq, packet);
        this._ack = uint16(packet.seq - 1);
        this._recvAck(packet.ack);
        this._connecting = false;
        this.emit("connect");
        packet = this._incoming.del(packet.seq);
        if (!packet) return;
      }
      if (uint16(packet.seq - this._ack) >= BUFFER_SIZE) return this._sendAck();
      this._recvAck(packet.ack);
      if (packet.id === PACKET_STATE) return;
      this._incoming.put(packet.seq, packet);
      while (packet = this._incoming.del(this._ack + 1)) {
        this._ack = uint16(this._ack + 1);
        if (packet.id === PACKET_DATA) this.push(packet.data);
        if (packet.id === PACKET_FIN) this.push(null);
      }
      this._sendAck();
    };
    Connection.prototype._sendAck = function() {
      this._transmit(createPacket(this, PACKET_STATE, null));
    };
    Connection.prototype._sendOutgoing = function(packet) {
      this._outgoing.put(packet.seq, packet);
      this._seq = uint16(this._seq + 1);
      this._inflightPackets++;
      this._transmit(packet);
    };
    Connection.prototype._transmit = function(packet) {
      packet.sent = packet.sent === 0 ? packet.timestamp : timestamp();
      var message = packetToBuffer(packet);
      this._alive = true;
      this.socket.send(message, 0, message.length, this.port, this.host);
    };
    var Server = function() {
      EventEmitter.call(this);
      this._socket = null;
      this._connections = {};
    };
    util.inherits(Server, EventEmitter);
    Server.prototype.address = function() {
      return this._socket.address();
    };
    Server.prototype.listen = function(port, onlistening) {
      var socket = this._socket = dgram.createSocket("udp4");
      var connections = this._connections;
      var self2 = this;
      socket.on("message", function(message, rinfo) {
        if (message.length < MIN_PACKET_SIZE) return;
        var packet = bufferToPacket(message);
        var id = rinfo.address + ":" + (packet.id === PACKET_SYN ? uint16(packet.connection + 1) : packet.connection);
        if (connections[id]) return connections[id]._recvIncoming(packet);
        if (packet.id !== PACKET_SYN) return;
        connections[id] = new Connection(rinfo.port, rinfo.address, socket, packet);
        connections[id].on("close", function() {
          delete connections[id];
        });
        self2.emit("connection", connections[id]);
      });
      socket.once("listening", function() {
        self2.emit("listening");
      });
      if (onlistening) self2.once("listening", onlistening);
      socket.bind(port);
    };
    exports2.createServer = function(onconnection) {
      var server2 = new Server();
      if (onconnection) server2.on("connection", onconnection);
      return server2;
    };
    exports2.connect = function(port, host) {
      var socket = dgram.createSocket("udp4");
      var connection = new Connection(port, host || "127.0.0.1", socket, null);
      socket.on("message", function(message) {
        if (message.length < MIN_PACKET_SIZE) return;
        var packet = bufferToPacket(message);
        if (packet.id === PACKET_SYN) return;
        if (packet.connection !== connection._recvId) return;
        connection._recvIncoming(packet);
      });
      return connection;
    };
  }
});

// node_modules/fifo/index.js
var require_fifo = __commonJS({
  "node_modules/fifo/index.js"(exports2, module2) {
    var Node = function(list, val) {
      this.prev = this.next = this;
      this.value = val;
      this.list = list;
    };
    Node.prototype.link = function(next) {
      this.next = next;
      next.prev = this;
      return next;
    };
    var FIFO = function() {
      if (!(this instanceof FIFO)) return new FIFO();
      this.node = null;
      this.length = 0;
    };
    FIFO.prototype.set = function(node, value) {
      if (!node || node.list !== this) return null;
      node.value = value;
      return node;
    };
    FIFO.prototype.get = function(node) {
      if (!node || node.list !== this) return null;
      return node.value;
    };
    FIFO.prototype.remove = function(node) {
      if (!node || node.list !== this) return null;
      this.length--;
      node.list = null;
      node.prev.link(node.next);
      if (node === this.node) this.node = node.next === node ? null : node.next;
      return node.value;
    };
    FIFO.prototype.unshift = function(value) {
      return this.node = this.push(value);
    };
    FIFO.prototype.push = function(value) {
      var node = new Node(this, value);
      this.length++;
      if (!this.node) return this.node = node;
      this.node.prev.link(node);
      node.link(this.node);
      return node;
    };
    FIFO.prototype.first = function() {
      return this.node && this.node.value;
    };
    FIFO.prototype.last = function() {
      return this.node && this.node.prev.value;
    };
    FIFO.prototype.shift = function() {
      return this.node && this.remove(this.node);
    };
    FIFO.prototype.pop = function() {
      return this.node && this.remove(this.node.prev);
    };
    module2.exports = FIFO;
  }
});

// node_modules/wrappy/wrappy.js
var require_wrappy = __commonJS({
  "node_modules/wrappy/wrappy.js"(exports2, module2) {
    module2.exports = wrappy;
    function wrappy(fn, cb) {
      if (fn && cb) return wrappy(fn)(cb);
      if (typeof fn !== "function")
        throw new TypeError("need wrapper function");
      Object.keys(fn).forEach(function(k) {
        wrapper[k] = fn[k];
      });
      return wrapper;
      function wrapper() {
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        var ret = fn.apply(this, args);
        var cb2 = args[args.length - 1];
        if (typeof ret === "function" && ret !== cb2) {
          Object.keys(cb2).forEach(function(k) {
            ret[k] = cb2[k];
          });
        }
        return ret;
      }
    }
  }
});

// node_modules/once/once.js
var require_once = __commonJS({
  "node_modules/once/once.js"(exports2, module2) {
    var wrappy = require_wrappy();
    module2.exports = wrappy(once);
    once.proto = once(function() {
      Object.defineProperty(Function.prototype, "once", {
        value: function() {
          return once(this);
        },
        configurable: true
      });
    });
    function once(fn) {
      var f = function() {
        if (f.called) return f.value;
        f.called = true;
        return f.value = fn.apply(this, arguments);
      };
      f.called = false;
      return f;
    }
  }
});

// node_modules/speedometer/index.js
var require_speedometer = __commonJS({
  "node_modules/speedometer/index.js"(exports2, module2) {
    var tick = 1;
    var maxTick = 65535;
    var resolution = 4;
    var inc = function() {
      tick = tick + 1 & maxTick;
    };
    var timer = setInterval(inc, 1e3 / resolution | 0);
    if (timer.unref) timer.unref();
    module2.exports = function(seconds) {
      var size = resolution * (seconds || 5);
      var buffer = [0];
      var pointer = 1;
      var last = tick - 1 & maxTick;
      return function(delta) {
        var dist = tick - last & maxTick;
        if (dist > size) dist = size;
        last = tick;
        while (dist--) {
          if (pointer === size) pointer = 0;
          buffer[pointer] = buffer[pointer === 0 ? size - 1 : pointer - 1];
          pointer++;
        }
        if (delta) buffer[pointer - 1] += delta;
        var top = buffer[pointer - 1];
        var btm = buffer.length < size ? 0 : buffer[pointer === size ? 0 : pointer];
        return buffer.length < resolution ? top : (top - btm) * resolution / buffer.length;
      };
    };
  }
});

// node_modules/isarray/index.js
var require_isarray = __commonJS({
  "node_modules/isarray/index.js"(exports2, module2) {
    module2.exports = Array.isArray || function(arr) {
      return Object.prototype.toString.call(arr) == "[object Array]";
    };
  }
});

// node_modules/core-util-is/lib/util.js
var require_util = __commonJS({
  "node_modules/core-util-is/lib/util.js"(exports2) {
    function isArray(arg) {
      if (Array.isArray) {
        return Array.isArray(arg);
      }
      return objectToString(arg) === "[object Array]";
    }
    exports2.isArray = isArray;
    function isBoolean(arg) {
      return typeof arg === "boolean";
    }
    exports2.isBoolean = isBoolean;
    function isNull(arg) {
      return arg === null;
    }
    exports2.isNull = isNull;
    function isNullOrUndefined(arg) {
      return arg == null;
    }
    exports2.isNullOrUndefined = isNullOrUndefined;
    function isNumber(arg) {
      return typeof arg === "number";
    }
    exports2.isNumber = isNumber;
    function isString(arg) {
      return typeof arg === "string";
    }
    exports2.isString = isString;
    function isSymbol(arg) {
      return typeof arg === "symbol";
    }
    exports2.isSymbol = isSymbol;
    function isUndefined(arg) {
      return arg === void 0;
    }
    exports2.isUndefined = isUndefined;
    function isRegExp(re) {
      return objectToString(re) === "[object RegExp]";
    }
    exports2.isRegExp = isRegExp;
    function isObject(arg) {
      return typeof arg === "object" && arg !== null;
    }
    exports2.isObject = isObject;
    function isDate(d) {
      return objectToString(d) === "[object Date]";
    }
    exports2.isDate = isDate;
    function isError(e) {
      return objectToString(e) === "[object Error]" || e instanceof Error;
    }
    exports2.isError = isError;
    function isFunction(arg) {
      return typeof arg === "function";
    }
    exports2.isFunction = isFunction;
    function isPrimitive(arg) {
      return arg === null || typeof arg === "boolean" || typeof arg === "number" || typeof arg === "string" || typeof arg === "symbol" || // ES6 symbol
      typeof arg === "undefined";
    }
    exports2.isPrimitive = isPrimitive;
    exports2.isBuffer = require("buffer").Buffer.isBuffer;
    function objectToString(o) {
      return Object.prototype.toString.call(o);
    }
  }
});

// node_modules/inherits/inherits_browser.js
var require_inherits_browser = __commonJS({
  "node_modules/inherits/inherits_browser.js"(exports2, module2) {
    if (typeof Object.create === "function") {
      module2.exports = function inherits(ctor, superCtor) {
        if (superCtor) {
          ctor.super_ = superCtor;
          ctor.prototype = Object.create(superCtor.prototype, {
            constructor: {
              value: ctor,
              enumerable: false,
              writable: true,
              configurable: true
            }
          });
        }
      };
    } else {
      module2.exports = function inherits(ctor, superCtor) {
        if (superCtor) {
          ctor.super_ = superCtor;
          var TempCtor = function() {
          };
          TempCtor.prototype = superCtor.prototype;
          ctor.prototype = new TempCtor();
          ctor.prototype.constructor = ctor;
        }
      };
    }
  }
});

// node_modules/inherits/inherits.js
var require_inherits = __commonJS({
  "node_modules/inherits/inherits.js"(exports2, module2) {
    try {
      util = require("util");
      if (typeof util.inherits !== "function") throw "";
      module2.exports = util.inherits;
    } catch (e) {
      module2.exports = require_inherits_browser();
    }
    var util;
  }
});

// node_modules/readable-stream/lib/_stream_writable.js
var require_stream_writable = __commonJS({
  "node_modules/readable-stream/lib/_stream_writable.js"(exports2, module2) {
    module2.exports = Writable;
    var Buffer2 = require("buffer").Buffer;
    Writable.WritableState = WritableState;
    var util = require_util();
    util.inherits = require_inherits();
    var Stream = require("stream");
    util.inherits(Writable, Stream);
    function WriteReq(chunk, encoding, cb) {
      this.chunk = chunk;
      this.encoding = encoding;
      this.callback = cb;
    }
    function WritableState(options, stream) {
      var Duplex = require_stream_duplex();
      options = options || {};
      var hwm = options.highWaterMark;
      var defaultHwm = options.objectMode ? 16 : 16 * 1024;
      this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;
      this.objectMode = !!options.objectMode;
      if (stream instanceof Duplex)
        this.objectMode = this.objectMode || !!options.writableObjectMode;
      this.highWaterMark = ~~this.highWaterMark;
      this.needDrain = false;
      this.ending = false;
      this.ended = false;
      this.finished = false;
      var noDecode = options.decodeStrings === false;
      this.decodeStrings = !noDecode;
      this.defaultEncoding = options.defaultEncoding || "utf8";
      this.length = 0;
      this.writing = false;
      this.corked = 0;
      this.sync = true;
      this.bufferProcessing = false;
      this.onwrite = function(er) {
        onwrite(stream, er);
      };
      this.writecb = null;
      this.writelen = 0;
      this.buffer = [];
      this.pendingcb = 0;
      this.prefinished = false;
      this.errorEmitted = false;
    }
    function Writable(options) {
      var Duplex = require_stream_duplex();
      if (!(this instanceof Writable) && !(this instanceof Duplex))
        return new Writable(options);
      this._writableState = new WritableState(options, this);
      this.writable = true;
      Stream.call(this);
    }
    Writable.prototype.pipe = function() {
      this.emit("error", new Error("Cannot pipe. Not readable."));
    };
    function writeAfterEnd(stream, state, cb) {
      var er = new Error("write after end");
      stream.emit("error", er);
      process.nextTick(function() {
        cb(er);
      });
    }
    function validChunk(stream, state, chunk, cb) {
      var valid = true;
      if (!util.isBuffer(chunk) && !util.isString(chunk) && !util.isNullOrUndefined(chunk) && !state.objectMode) {
        var er = new TypeError("Invalid non-string/buffer chunk");
        stream.emit("error", er);
        process.nextTick(function() {
          cb(er);
        });
        valid = false;
      }
      return valid;
    }
    Writable.prototype.write = function(chunk, encoding, cb) {
      var state = this._writableState;
      var ret = false;
      if (util.isFunction(encoding)) {
        cb = encoding;
        encoding = null;
      }
      if (util.isBuffer(chunk))
        encoding = "buffer";
      else if (!encoding)
        encoding = state.defaultEncoding;
      if (!util.isFunction(cb))
        cb = function() {
        };
      if (state.ended)
        writeAfterEnd(this, state, cb);
      else if (validChunk(this, state, chunk, cb)) {
        state.pendingcb++;
        ret = writeOrBuffer(this, state, chunk, encoding, cb);
      }
      return ret;
    };
    Writable.prototype.cork = function() {
      var state = this._writableState;
      state.corked++;
    };
    Writable.prototype.uncork = function() {
      var state = this._writableState;
      if (state.corked) {
        state.corked--;
        if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.buffer.length)
          clearBuffer(this, state);
      }
    };
    function decodeChunk(state, chunk, encoding) {
      if (!state.objectMode && state.decodeStrings !== false && util.isString(chunk)) {
        chunk = new Buffer2(chunk, encoding);
      }
      return chunk;
    }
    function writeOrBuffer(stream, state, chunk, encoding, cb) {
      chunk = decodeChunk(state, chunk, encoding);
      if (util.isBuffer(chunk))
        encoding = "buffer";
      var len = state.objectMode ? 1 : chunk.length;
      state.length += len;
      var ret = state.length < state.highWaterMark;
      if (!ret)
        state.needDrain = true;
      if (state.writing || state.corked)
        state.buffer.push(new WriteReq(chunk, encoding, cb));
      else
        doWrite(stream, state, false, len, chunk, encoding, cb);
      return ret;
    }
    function doWrite(stream, state, writev, len, chunk, encoding, cb) {
      state.writelen = len;
      state.writecb = cb;
      state.writing = true;
      state.sync = true;
      if (writev)
        stream._writev(chunk, state.onwrite);
      else
        stream._write(chunk, encoding, state.onwrite);
      state.sync = false;
    }
    function onwriteError(stream, state, sync, er, cb) {
      if (sync)
        process.nextTick(function() {
          state.pendingcb--;
          cb(er);
        });
      else {
        state.pendingcb--;
        cb(er);
      }
      stream._writableState.errorEmitted = true;
      stream.emit("error", er);
    }
    function onwriteStateUpdate(state) {
      state.writing = false;
      state.writecb = null;
      state.length -= state.writelen;
      state.writelen = 0;
    }
    function onwrite(stream, er) {
      var state = stream._writableState;
      var sync = state.sync;
      var cb = state.writecb;
      onwriteStateUpdate(state);
      if (er)
        onwriteError(stream, state, sync, er, cb);
      else {
        var finished = needFinish(stream, state);
        if (!finished && !state.corked && !state.bufferProcessing && state.buffer.length) {
          clearBuffer(stream, state);
        }
        if (sync) {
          process.nextTick(function() {
            afterWrite(stream, state, finished, cb);
          });
        } else {
          afterWrite(stream, state, finished, cb);
        }
      }
    }
    function afterWrite(stream, state, finished, cb) {
      if (!finished)
        onwriteDrain(stream, state);
      state.pendingcb--;
      cb();
      finishMaybe(stream, state);
    }
    function onwriteDrain(stream, state) {
      if (state.length === 0 && state.needDrain) {
        state.needDrain = false;
        stream.emit("drain");
      }
    }
    function clearBuffer(stream, state) {
      state.bufferProcessing = true;
      if (stream._writev && state.buffer.length > 1) {
        var cbs = [];
        for (var c = 0; c < state.buffer.length; c++)
          cbs.push(state.buffer[c].callback);
        state.pendingcb++;
        doWrite(stream, state, true, state.length, state.buffer, "", function(err) {
          for (var i = 0; i < cbs.length; i++) {
            state.pendingcb--;
            cbs[i](err);
          }
        });
        state.buffer = [];
      } else {
        for (var c = 0; c < state.buffer.length; c++) {
          var entry = state.buffer[c];
          var chunk = entry.chunk;
          var encoding = entry.encoding;
          var cb = entry.callback;
          var len = state.objectMode ? 1 : chunk.length;
          doWrite(stream, state, false, len, chunk, encoding, cb);
          if (state.writing) {
            c++;
            break;
          }
        }
        if (c < state.buffer.length)
          state.buffer = state.buffer.slice(c);
        else
          state.buffer.length = 0;
      }
      state.bufferProcessing = false;
    }
    Writable.prototype._write = function(chunk, encoding, cb) {
      cb(new Error("not implemented"));
    };
    Writable.prototype._writev = null;
    Writable.prototype.end = function(chunk, encoding, cb) {
      var state = this._writableState;
      if (util.isFunction(chunk)) {
        cb = chunk;
        chunk = null;
        encoding = null;
      } else if (util.isFunction(encoding)) {
        cb = encoding;
        encoding = null;
      }
      if (!util.isNullOrUndefined(chunk))
        this.write(chunk, encoding);
      if (state.corked) {
        state.corked = 1;
        this.uncork();
      }
      if (!state.ending && !state.finished)
        endWritable(this, state, cb);
    };
    function needFinish(stream, state) {
      return state.ending && state.length === 0 && !state.finished && !state.writing;
    }
    function prefinish(stream, state) {
      if (!state.prefinished) {
        state.prefinished = true;
        stream.emit("prefinish");
      }
    }
    function finishMaybe(stream, state) {
      var need = needFinish(stream, state);
      if (need) {
        if (state.pendingcb === 0) {
          prefinish(stream, state);
          state.finished = true;
          stream.emit("finish");
        } else
          prefinish(stream, state);
      }
      return need;
    }
    function endWritable(stream, state, cb) {
      state.ending = true;
      finishMaybe(stream, state);
      if (cb) {
        if (state.finished)
          process.nextTick(cb);
        else
          stream.once("finish", cb);
      }
      state.ended = true;
    }
  }
});

// node_modules/readable-stream/lib/_stream_duplex.js
var require_stream_duplex = __commonJS({
  "node_modules/readable-stream/lib/_stream_duplex.js"(exports2, module2) {
    module2.exports = Duplex;
    var objectKeys = Object.keys || function(obj) {
      var keys = [];
      for (var key in obj) keys.push(key);
      return keys;
    };
    var util = require_util();
    util.inherits = require_inherits();
    var Readable = require_stream_readable();
    var Writable = require_stream_writable();
    util.inherits(Duplex, Readable);
    forEach(objectKeys(Writable.prototype), function(method) {
      if (!Duplex.prototype[method])
        Duplex.prototype[method] = Writable.prototype[method];
    });
    function Duplex(options) {
      if (!(this instanceof Duplex))
        return new Duplex(options);
      Readable.call(this, options);
      Writable.call(this, options);
      if (options && options.readable === false)
        this.readable = false;
      if (options && options.writable === false)
        this.writable = false;
      this.allowHalfOpen = true;
      if (options && options.allowHalfOpen === false)
        this.allowHalfOpen = false;
      this.once("end", onend);
    }
    function onend() {
      if (this.allowHalfOpen || this._writableState.ended)
        return;
      process.nextTick(this.end.bind(this));
    }
    function forEach(xs, f) {
      for (var i = 0, l = xs.length; i < l; i++) {
        f(xs[i], i);
      }
    }
  }
});

// node_modules/string_decoder/index.js
var require_string_decoder = __commonJS({
  "node_modules/string_decoder/index.js"(exports2) {
    var Buffer2 = require("buffer").Buffer;
    var isBufferEncoding = Buffer2.isEncoding || function(encoding) {
      switch (encoding && encoding.toLowerCase()) {
        case "hex":
        case "utf8":
        case "utf-8":
        case "ascii":
        case "binary":
        case "base64":
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
        case "raw":
          return true;
        default:
          return false;
      }
    };
    function assertEncoding(encoding) {
      if (encoding && !isBufferEncoding(encoding)) {
        throw new Error("Unknown encoding: " + encoding);
      }
    }
    var StringDecoder = exports2.StringDecoder = function(encoding) {
      this.encoding = (encoding || "utf8").toLowerCase().replace(/[-_]/, "");
      assertEncoding(encoding);
      switch (this.encoding) {
        case "utf8":
          this.surrogateSize = 3;
          break;
        case "ucs2":
        case "utf16le":
          this.surrogateSize = 2;
          this.detectIncompleteChar = utf16DetectIncompleteChar;
          break;
        case "base64":
          this.surrogateSize = 3;
          this.detectIncompleteChar = base64DetectIncompleteChar;
          break;
        default:
          this.write = passThroughWrite;
          return;
      }
      this.charBuffer = new Buffer2(6);
      this.charReceived = 0;
      this.charLength = 0;
    };
    StringDecoder.prototype.write = function(buffer) {
      var charStr = "";
      while (this.charLength) {
        var available = buffer.length >= this.charLength - this.charReceived ? this.charLength - this.charReceived : buffer.length;
        buffer.copy(this.charBuffer, this.charReceived, 0, available);
        this.charReceived += available;
        if (this.charReceived < this.charLength) {
          return "";
        }
        buffer = buffer.slice(available, buffer.length);
        charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);
        var charCode = charStr.charCodeAt(charStr.length - 1);
        if (charCode >= 55296 && charCode <= 56319) {
          this.charLength += this.surrogateSize;
          charStr = "";
          continue;
        }
        this.charReceived = this.charLength = 0;
        if (buffer.length === 0) {
          return charStr;
        }
        break;
      }
      this.detectIncompleteChar(buffer);
      var end = buffer.length;
      if (this.charLength) {
        buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
        end -= this.charReceived;
      }
      charStr += buffer.toString(this.encoding, 0, end);
      var end = charStr.length - 1;
      var charCode = charStr.charCodeAt(end);
      if (charCode >= 55296 && charCode <= 56319) {
        var size = this.surrogateSize;
        this.charLength += size;
        this.charReceived += size;
        this.charBuffer.copy(this.charBuffer, size, 0, size);
        buffer.copy(this.charBuffer, 0, 0, size);
        return charStr.substring(0, end);
      }
      return charStr;
    };
    StringDecoder.prototype.detectIncompleteChar = function(buffer) {
      var i = buffer.length >= 3 ? 3 : buffer.length;
      for (; i > 0; i--) {
        var c = buffer[buffer.length - i];
        if (i == 1 && c >> 5 == 6) {
          this.charLength = 2;
          break;
        }
        if (i <= 2 && c >> 4 == 14) {
          this.charLength = 3;
          break;
        }
        if (i <= 3 && c >> 3 == 30) {
          this.charLength = 4;
          break;
        }
      }
      this.charReceived = i;
    };
    StringDecoder.prototype.end = function(buffer) {
      var res = "";
      if (buffer && buffer.length)
        res = this.write(buffer);
      if (this.charReceived) {
        var cr = this.charReceived;
        var buf = this.charBuffer;
        var enc = this.encoding;
        res += buf.slice(0, cr).toString(enc);
      }
      return res;
    };
    function passThroughWrite(buffer) {
      return buffer.toString(this.encoding);
    }
    function utf16DetectIncompleteChar(buffer) {
      this.charReceived = buffer.length % 2;
      this.charLength = this.charReceived ? 2 : 0;
    }
    function base64DetectIncompleteChar(buffer) {
      this.charReceived = buffer.length % 3;
      this.charLength = this.charReceived ? 3 : 0;
    }
  }
});

// node_modules/readable-stream/lib/_stream_readable.js
var require_stream_readable = __commonJS({
  "node_modules/readable-stream/lib/_stream_readable.js"(exports2, module2) {
    module2.exports = Readable;
    var isArray = require_isarray();
    var Buffer2 = require("buffer").Buffer;
    Readable.ReadableState = ReadableState;
    var EE = require("events").EventEmitter;
    if (!EE.listenerCount) EE.listenerCount = function(emitter, type) {
      return emitter.listeners(type).length;
    };
    var Stream = require("stream");
    var util = require_util();
    util.inherits = require_inherits();
    var StringDecoder;
    var debug = require("util");
    if (debug && debug.debuglog) {
      debug = debug.debuglog("stream");
    } else {
      debug = function() {
      };
    }
    util.inherits(Readable, Stream);
    function ReadableState(options, stream) {
      var Duplex = require_stream_duplex();
      options = options || {};
      var hwm = options.highWaterMark;
      var defaultHwm = options.objectMode ? 16 : 16 * 1024;
      this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;
      this.highWaterMark = ~~this.highWaterMark;
      this.buffer = [];
      this.length = 0;
      this.pipes = null;
      this.pipesCount = 0;
      this.flowing = null;
      this.ended = false;
      this.endEmitted = false;
      this.reading = false;
      this.sync = true;
      this.needReadable = false;
      this.emittedReadable = false;
      this.readableListening = false;
      this.objectMode = !!options.objectMode;
      if (stream instanceof Duplex)
        this.objectMode = this.objectMode || !!options.readableObjectMode;
      this.defaultEncoding = options.defaultEncoding || "utf8";
      this.ranOut = false;
      this.awaitDrain = 0;
      this.readingMore = false;
      this.decoder = null;
      this.encoding = null;
      if (options.encoding) {
        if (!StringDecoder)
          StringDecoder = require_string_decoder().StringDecoder;
        this.decoder = new StringDecoder(options.encoding);
        this.encoding = options.encoding;
      }
    }
    function Readable(options) {
      var Duplex = require_stream_duplex();
      if (!(this instanceof Readable))
        return new Readable(options);
      this._readableState = new ReadableState(options, this);
      this.readable = true;
      Stream.call(this);
    }
    Readable.prototype.push = function(chunk, encoding) {
      var state = this._readableState;
      if (util.isString(chunk) && !state.objectMode) {
        encoding = encoding || state.defaultEncoding;
        if (encoding !== state.encoding) {
          chunk = new Buffer2(chunk, encoding);
          encoding = "";
        }
      }
      return readableAddChunk(this, state, chunk, encoding, false);
    };
    Readable.prototype.unshift = function(chunk) {
      var state = this._readableState;
      return readableAddChunk(this, state, chunk, "", true);
    };
    function readableAddChunk(stream, state, chunk, encoding, addToFront) {
      var er = chunkInvalid(state, chunk);
      if (er) {
        stream.emit("error", er);
      } else if (util.isNullOrUndefined(chunk)) {
        state.reading = false;
        if (!state.ended)
          onEofChunk(stream, state);
      } else if (state.objectMode || chunk && chunk.length > 0) {
        if (state.ended && !addToFront) {
          var e = new Error("stream.push() after EOF");
          stream.emit("error", e);
        } else if (state.endEmitted && addToFront) {
          var e = new Error("stream.unshift() after end event");
          stream.emit("error", e);
        } else {
          if (state.decoder && !addToFront && !encoding)
            chunk = state.decoder.write(chunk);
          if (!addToFront)
            state.reading = false;
          if (state.flowing && state.length === 0 && !state.sync) {
            stream.emit("data", chunk);
            stream.read(0);
          } else {
            state.length += state.objectMode ? 1 : chunk.length;
            if (addToFront)
              state.buffer.unshift(chunk);
            else
              state.buffer.push(chunk);
            if (state.needReadable)
              emitReadable(stream);
          }
          maybeReadMore(stream, state);
        }
      } else if (!addToFront) {
        state.reading = false;
      }
      return needMoreData(state);
    }
    function needMoreData(state) {
      return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
    }
    Readable.prototype.setEncoding = function(enc) {
      if (!StringDecoder)
        StringDecoder = require_string_decoder().StringDecoder;
      this._readableState.decoder = new StringDecoder(enc);
      this._readableState.encoding = enc;
      return this;
    };
    var MAX_HWM = 8388608;
    function roundUpToNextPowerOf2(n) {
      if (n >= MAX_HWM) {
        n = MAX_HWM;
      } else {
        n--;
        for (var p = 1; p < 32; p <<= 1) n |= n >> p;
        n++;
      }
      return n;
    }
    function howMuchToRead(n, state) {
      if (state.length === 0 && state.ended)
        return 0;
      if (state.objectMode)
        return n === 0 ? 0 : 1;
      if (isNaN(n) || util.isNull(n)) {
        if (state.flowing && state.buffer.length)
          return state.buffer[0].length;
        else
          return state.length;
      }
      if (n <= 0)
        return 0;
      if (n > state.highWaterMark)
        state.highWaterMark = roundUpToNextPowerOf2(n);
      if (n > state.length) {
        if (!state.ended) {
          state.needReadable = true;
          return 0;
        } else
          return state.length;
      }
      return n;
    }
    Readable.prototype.read = function(n) {
      debug("read", n);
      var state = this._readableState;
      var nOrig = n;
      if (!util.isNumber(n) || n > 0)
        state.emittedReadable = false;
      if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
        debug("read: emitReadable", state.length, state.ended);
        if (state.length === 0 && state.ended)
          endReadable(this);
        else
          emitReadable(this);
        return null;
      }
      n = howMuchToRead(n, state);
      if (n === 0 && state.ended) {
        if (state.length === 0)
          endReadable(this);
        return null;
      }
      var doRead = state.needReadable;
      debug("need readable", doRead);
      if (state.length === 0 || state.length - n < state.highWaterMark) {
        doRead = true;
        debug("length less than watermark", doRead);
      }
      if (state.ended || state.reading) {
        doRead = false;
        debug("reading or ended", doRead);
      }
      if (doRead) {
        debug("do read");
        state.reading = true;
        state.sync = true;
        if (state.length === 0)
          state.needReadable = true;
        this._read(state.highWaterMark);
        state.sync = false;
      }
      if (doRead && !state.reading)
        n = howMuchToRead(nOrig, state);
      var ret;
      if (n > 0)
        ret = fromList(n, state);
      else
        ret = null;
      if (util.isNull(ret)) {
        state.needReadable = true;
        n = 0;
      }
      state.length -= n;
      if (state.length === 0 && !state.ended)
        state.needReadable = true;
      if (nOrig !== n && state.ended && state.length === 0)
        endReadable(this);
      if (!util.isNull(ret))
        this.emit("data", ret);
      return ret;
    };
    function chunkInvalid(state, chunk) {
      var er = null;
      if (!util.isBuffer(chunk) && !util.isString(chunk) && !util.isNullOrUndefined(chunk) && !state.objectMode) {
        er = new TypeError("Invalid non-string/buffer chunk");
      }
      return er;
    }
    function onEofChunk(stream, state) {
      if (state.decoder && !state.ended) {
        var chunk = state.decoder.end();
        if (chunk && chunk.length) {
          state.buffer.push(chunk);
          state.length += state.objectMode ? 1 : chunk.length;
        }
      }
      state.ended = true;
      emitReadable(stream);
    }
    function emitReadable(stream) {
      var state = stream._readableState;
      state.needReadable = false;
      if (!state.emittedReadable) {
        debug("emitReadable", state.flowing);
        state.emittedReadable = true;
        if (state.sync)
          process.nextTick(function() {
            emitReadable_(stream);
          });
        else
          emitReadable_(stream);
      }
    }
    function emitReadable_(stream) {
      debug("emit readable");
      stream.emit("readable");
      flow(stream);
    }
    function maybeReadMore(stream, state) {
      if (!state.readingMore) {
        state.readingMore = true;
        process.nextTick(function() {
          maybeReadMore_(stream, state);
        });
      }
    }
    function maybeReadMore_(stream, state) {
      var len = state.length;
      while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
        debug("maybeReadMore read 0");
        stream.read(0);
        if (len === state.length)
          break;
        else
          len = state.length;
      }
      state.readingMore = false;
    }
    Readable.prototype._read = function(n) {
      this.emit("error", new Error("not implemented"));
    };
    Readable.prototype.pipe = function(dest, pipeOpts) {
      var src = this;
      var state = this._readableState;
      switch (state.pipesCount) {
        case 0:
          state.pipes = dest;
          break;
        case 1:
          state.pipes = [state.pipes, dest];
          break;
        default:
          state.pipes.push(dest);
          break;
      }
      state.pipesCount += 1;
      debug("pipe count=%d opts=%j", state.pipesCount, pipeOpts);
      var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;
      var endFn = doEnd ? onend : cleanup;
      if (state.endEmitted)
        process.nextTick(endFn);
      else
        src.once("end", endFn);
      dest.on("unpipe", onunpipe);
      function onunpipe(readable) {
        debug("onunpipe");
        if (readable === src) {
          cleanup();
        }
      }
      function onend() {
        debug("onend");
        dest.end();
      }
      var ondrain = pipeOnDrain(src);
      dest.on("drain", ondrain);
      function cleanup() {
        debug("cleanup");
        dest.removeListener("close", onclose);
        dest.removeListener("finish", onfinish);
        dest.removeListener("drain", ondrain);
        dest.removeListener("error", onerror);
        dest.removeListener("unpipe", onunpipe);
        src.removeListener("end", onend);
        src.removeListener("end", cleanup);
        src.removeListener("data", ondata);
        if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain))
          ondrain();
      }
      src.on("data", ondata);
      function ondata(chunk) {
        debug("ondata");
        var ret = dest.write(chunk);
        if (false === ret) {
          debug(
            "false write response, pause",
            src._readableState.awaitDrain
          );
          src._readableState.awaitDrain++;
          src.pause();
        }
      }
      function onerror(er) {
        debug("onerror", er);
        unpipe();
        dest.removeListener("error", onerror);
        if (EE.listenerCount(dest, "error") === 0)
          dest.emit("error", er);
      }
      if (!dest._events || !dest._events.error)
        dest.on("error", onerror);
      else if (isArray(dest._events.error))
        dest._events.error.unshift(onerror);
      else
        dest._events.error = [onerror, dest._events.error];
      function onclose() {
        dest.removeListener("finish", onfinish);
        unpipe();
      }
      dest.once("close", onclose);
      function onfinish() {
        debug("onfinish");
        dest.removeListener("close", onclose);
        unpipe();
      }
      dest.once("finish", onfinish);
      function unpipe() {
        debug("unpipe");
        src.unpipe(dest);
      }
      dest.emit("pipe", src);
      if (!state.flowing) {
        debug("pipe resume");
        src.resume();
      }
      return dest;
    };
    function pipeOnDrain(src) {
      return function() {
        var state = src._readableState;
        debug("pipeOnDrain", state.awaitDrain);
        if (state.awaitDrain)
          state.awaitDrain--;
        if (state.awaitDrain === 0 && EE.listenerCount(src, "data")) {
          state.flowing = true;
          flow(src);
        }
      };
    }
    Readable.prototype.unpipe = function(dest) {
      var state = this._readableState;
      if (state.pipesCount === 0)
        return this;
      if (state.pipesCount === 1) {
        if (dest && dest !== state.pipes)
          return this;
        if (!dest)
          dest = state.pipes;
        state.pipes = null;
        state.pipesCount = 0;
        state.flowing = false;
        if (dest)
          dest.emit("unpipe", this);
        return this;
      }
      if (!dest) {
        var dests = state.pipes;
        var len = state.pipesCount;
        state.pipes = null;
        state.pipesCount = 0;
        state.flowing = false;
        for (var i = 0; i < len; i++)
          dests[i].emit("unpipe", this);
        return this;
      }
      var i = indexOf(state.pipes, dest);
      if (i === -1)
        return this;
      state.pipes.splice(i, 1);
      state.pipesCount -= 1;
      if (state.pipesCount === 1)
        state.pipes = state.pipes[0];
      dest.emit("unpipe", this);
      return this;
    };
    Readable.prototype.on = function(ev, fn) {
      var res = Stream.prototype.on.call(this, ev, fn);
      if (ev === "data" && false !== this._readableState.flowing) {
        this.resume();
      }
      if (ev === "readable" && this.readable) {
        var state = this._readableState;
        if (!state.readableListening) {
          state.readableListening = true;
          state.emittedReadable = false;
          state.needReadable = true;
          if (!state.reading) {
            var self2 = this;
            process.nextTick(function() {
              debug("readable nexttick read 0");
              self2.read(0);
            });
          } else if (state.length) {
            emitReadable(this, state);
          }
        }
      }
      return res;
    };
    Readable.prototype.addListener = Readable.prototype.on;
    Readable.prototype.resume = function() {
      var state = this._readableState;
      if (!state.flowing) {
        debug("resume");
        state.flowing = true;
        if (!state.reading) {
          debug("resume read 0");
          this.read(0);
        }
        resume(this, state);
      }
      return this;
    };
    function resume(stream, state) {
      if (!state.resumeScheduled) {
        state.resumeScheduled = true;
        process.nextTick(function() {
          resume_(stream, state);
        });
      }
    }
    function resume_(stream, state) {
      state.resumeScheduled = false;
      stream.emit("resume");
      flow(stream);
      if (state.flowing && !state.reading)
        stream.read(0);
    }
    Readable.prototype.pause = function() {
      debug("call pause flowing=%j", this._readableState.flowing);
      if (false !== this._readableState.flowing) {
        debug("pause");
        this._readableState.flowing = false;
        this.emit("pause");
      }
      return this;
    };
    function flow(stream) {
      var state = stream._readableState;
      debug("flow", state.flowing);
      if (state.flowing) {
        do {
          var chunk = stream.read();
        } while (null !== chunk && state.flowing);
      }
    }
    Readable.prototype.wrap = function(stream) {
      var state = this._readableState;
      var paused = false;
      var self2 = this;
      stream.on("end", function() {
        debug("wrapped end");
        if (state.decoder && !state.ended) {
          var chunk = state.decoder.end();
          if (chunk && chunk.length)
            self2.push(chunk);
        }
        self2.push(null);
      });
      stream.on("data", function(chunk) {
        debug("wrapped data");
        if (state.decoder)
          chunk = state.decoder.write(chunk);
        if (!chunk || !state.objectMode && !chunk.length)
          return;
        var ret = self2.push(chunk);
        if (!ret) {
          paused = true;
          stream.pause();
        }
      });
      for (var i in stream) {
        if (util.isFunction(stream[i]) && util.isUndefined(this[i])) {
          this[i] = /* @__PURE__ */ (function(method) {
            return function() {
              return stream[method].apply(stream, arguments);
            };
          })(i);
        }
      }
      var events = ["error", "close", "destroy", "pause", "resume"];
      forEach(events, function(ev) {
        stream.on(ev, self2.emit.bind(self2, ev));
      });
      self2._read = function(n) {
        debug("wrapped _read", n);
        if (paused) {
          paused = false;
          stream.resume();
        }
      };
      return self2;
    };
    Readable._fromList = fromList;
    function fromList(n, state) {
      var list = state.buffer;
      var length = state.length;
      var stringMode = !!state.decoder;
      var objectMode = !!state.objectMode;
      var ret;
      if (list.length === 0)
        return null;
      if (length === 0)
        ret = null;
      else if (objectMode)
        ret = list.shift();
      else if (!n || n >= length) {
        if (stringMode)
          ret = list.join("");
        else
          ret = Buffer2.concat(list, length);
        list.length = 0;
      } else {
        if (n < list[0].length) {
          var buf = list[0];
          ret = buf.slice(0, n);
          list[0] = buf.slice(n);
        } else if (n === list[0].length) {
          ret = list.shift();
        } else {
          if (stringMode)
            ret = "";
          else
            ret = new Buffer2(n);
          var c = 0;
          for (var i = 0, l = list.length; i < l && c < n; i++) {
            var buf = list[0];
            var cpy = Math.min(n - c, buf.length);
            if (stringMode)
              ret += buf.slice(0, cpy);
            else
              buf.copy(ret, c, 0, cpy);
            if (cpy < buf.length)
              list[0] = buf.slice(cpy);
            else
              list.shift();
            c += cpy;
          }
        }
      }
      return ret;
    }
    function endReadable(stream) {
      var state = stream._readableState;
      if (state.length > 0)
        throw new Error("endReadable called on non-empty stream");
      if (!state.endEmitted) {
        state.ended = true;
        process.nextTick(function() {
          if (!state.endEmitted && state.length === 0) {
            state.endEmitted = true;
            stream.readable = false;
            stream.emit("end");
          }
        });
      }
    }
    function forEach(xs, f) {
      for (var i = 0, l = xs.length; i < l; i++) {
        f(xs[i], i);
      }
    }
    function indexOf(xs, x) {
      for (var i = 0, l = xs.length; i < l; i++) {
        if (xs[i] === x) return i;
      }
      return -1;
    }
  }
});

// node_modules/readable-stream/lib/_stream_transform.js
var require_stream_transform = __commonJS({
  "node_modules/readable-stream/lib/_stream_transform.js"(exports2, module2) {
    module2.exports = Transform;
    var Duplex = require_stream_duplex();
    var util = require_util();
    util.inherits = require_inherits();
    util.inherits(Transform, Duplex);
    function TransformState(options, stream) {
      this.afterTransform = function(er, data) {
        return afterTransform(stream, er, data);
      };
      this.needTransform = false;
      this.transforming = false;
      this.writecb = null;
      this.writechunk = null;
    }
    function afterTransform(stream, er, data) {
      var ts = stream._transformState;
      ts.transforming = false;
      var cb = ts.writecb;
      if (!cb)
        return stream.emit("error", new Error("no writecb in Transform class"));
      ts.writechunk = null;
      ts.writecb = null;
      if (!util.isNullOrUndefined(data))
        stream.push(data);
      if (cb)
        cb(er);
      var rs = stream._readableState;
      rs.reading = false;
      if (rs.needReadable || rs.length < rs.highWaterMark) {
        stream._read(rs.highWaterMark);
      }
    }
    function Transform(options) {
      if (!(this instanceof Transform))
        return new Transform(options);
      Duplex.call(this, options);
      this._transformState = new TransformState(options, this);
      var stream = this;
      this._readableState.needReadable = true;
      this._readableState.sync = false;
      this.once("prefinish", function() {
        if (util.isFunction(this._flush))
          this._flush(function(er) {
            done(stream, er);
          });
        else
          done(stream);
      });
    }
    Transform.prototype.push = function(chunk, encoding) {
      this._transformState.needTransform = false;
      return Duplex.prototype.push.call(this, chunk, encoding);
    };
    Transform.prototype._transform = function(chunk, encoding, cb) {
      throw new Error("not implemented");
    };
    Transform.prototype._write = function(chunk, encoding, cb) {
      var ts = this._transformState;
      ts.writecb = cb;
      ts.writechunk = chunk;
      ts.writeencoding = encoding;
      if (!ts.transforming) {
        var rs = this._readableState;
        if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark)
          this._read(rs.highWaterMark);
      }
    };
    Transform.prototype._read = function(n) {
      var ts = this._transformState;
      if (!util.isNull(ts.writechunk) && ts.writecb && !ts.transforming) {
        ts.transforming = true;
        this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
      } else {
        ts.needTransform = true;
      }
    };
    function done(stream, er) {
      if (er)
        return stream.emit("error", er);
      var ws = stream._writableState;
      var ts = stream._transformState;
      if (ws.length)
        throw new Error("calling transform done when ws.length != 0");
      if (ts.transforming)
        throw new Error("calling transform done when still transforming");
      return stream.push(null);
    }
  }
});

// node_modules/readable-stream/lib/_stream_passthrough.js
var require_stream_passthrough = __commonJS({
  "node_modules/readable-stream/lib/_stream_passthrough.js"(exports2, module2) {
    module2.exports = PassThrough;
    var Transform = require_stream_transform();
    var util = require_util();
    util.inherits = require_inherits();
    util.inherits(PassThrough, Transform);
    function PassThrough(options) {
      if (!(this instanceof PassThrough))
        return new PassThrough(options);
      Transform.call(this, options);
    }
    PassThrough.prototype._transform = function(chunk, encoding, cb) {
      cb(null, chunk);
    };
  }
});

// node_modules/readable-stream/readable.js
var require_readable = __commonJS({
  "node_modules/readable-stream/readable.js"(exports2, module2) {
    exports2 = module2.exports = require_stream_readable();
    exports2.Stream = require("stream");
    exports2.Readable = exports2;
    exports2.Writable = require_stream_writable();
    exports2.Duplex = require_stream_duplex();
    exports2.Transform = require_stream_transform();
    exports2.PassThrough = require_stream_passthrough();
    if (!process.browser && process.env.READABLE_STREAM === "disable") {
      module2.exports = require("stream");
    }
  }
});

// node_modules/bitfield/index.js
var require_bitfield = __commonJS({
  "node_modules/bitfield/index.js"(exports2, module2) {
    var Container = typeof Buffer !== "undefined" ? Buffer : typeof Int8Array !== "undefined" ? Int8Array : function(l) {
      var a = new Array(l);
      for (var i = 0; i < l; i++) a[i] = 0;
    };
    function BitField(data) {
      if (!(this instanceof BitField)) {
        return new BitField(data);
      }
      if (typeof data === "number") {
        if (data % 8 !== 0) data += 1 << 3;
        data = new Container(data >> 3);
        if (data.fill) data.fill(0);
      }
      this.buffer = data;
    }
    BitField.prototype.get = function(i) {
      return !!(this.buffer[i >> 3] & 128 >> i % 8);
    };
    BitField.prototype.set = function(i, b) {
      if (b || arguments.length === 1) {
        this.buffer[i >> 3] |= 128 >> i % 8;
      } else {
        this.buffer[i >> 3] &= ~(128 >> i % 8);
      }
    };
    if (typeof module2 !== "undefined") module2.exports = BitField;
  }
});

// node_modules/peer-wire-protocol/node_modules/bncode/bencode.js
var require_bencode = __commonJS({
  "node_modules/peer-wire-protocol/node_modules/bncode/bencode.js"(exports2) {
    var I = "i".charCodeAt(0);
    var L = "l".charCodeAt(0);
    var E = "e".charCodeAt(0);
    var D = "d".charCodeAt(0);
    var COLON = ":".charCodeAt(0);
    var INITIAL = 0;
    var STRING_LEN = INITIAL + 1;
    var STRING = STRING_LEN + 1;
    var COLON = STRING + 1;
    var SINTEGER = COLON + 1;
    var INTEGER = SINTEGER + 1;
    var BdecodeSMachine = function(cb, cb_list, cb_dict, cb_end) {
      var self2 = this;
      var pos = 0;
      var depth = 0;
      var state = INITIAL;
      var cb = cb;
      var cb_list = cb_list;
      var cb_dict = cb_dict;
      var cb_end = cb_end;
      this.consistent = function() {
        return state === INITIAL && depth === 0;
      };
      var strLen = 0;
      var str = "";
      var _int = 0;
      var neg = false;
      var strLen = 0;
      this.parse = function(buffer, encoding) {
        encoding = encoding ? encoding : "UTF-8";
        if ("string" === typeof buffer) {
          buffer = new Buffer(buffer, encoding);
        }
        for (var pos2 = 0; pos2 != buffer.length; ++pos2) {
          switch (state) {
            case INITIAL:
              switch (buffer[pos2]) {
                case 48:
                case 49:
                case 50:
                case 51:
                case 52:
                case 53:
                case 54:
                case 55:
                case 56:
                case 57:
                  state = STRING_LEN;
                  strLen = 0;
                  strLen += buffer[pos2] - 48;
                  break;
                case I:
                  state = SINTEGER;
                  _int = 0;
                  neg = false;
                  break;
                case L:
                  state = INITIAL;
                  depth += 1;
                  cb_list();
                  break;
                case D:
                  state = INITIAL;
                  depth += 1;
                  cb_dict();
                  break;
                case E:
                  state = INITIAL;
                  depth -= 1;
                  if (depth < 0) {
                    throw new Error("end with no beginning: " + pos2);
                  } else {
                    cb_end();
                  }
                  break;
              }
              break;
            case STRING_LEN:
              if (integer(buffer[pos2])) {
                strLen *= 10;
                strLen += buffer[pos2] - 48;
              } else {
                str = new Buffer(strLen);
                pos2 -= 1;
                state = COLON;
              }
              break;
            case COLON:
              if (buffer[pos2] != ":".charCodeAt(0)) {
                throw new Error("not a colon at:" + pos2.toString(16));
              }
              state = STRING;
              if (0 === strLen) {
                cb(new Buffer(0));
                state = INITIAL;
              }
              break;
            case STRING:
              if (0 === strLen) {
                cb(str);
                state = INITIAL;
              } else {
                str[str.length - strLen] = buffer[pos2];
                strLen -= 1;
                if (0 === strLen) {
                  cb(str);
                  state = INITIAL;
                }
              }
              break;
            case SINTEGER:
              state = INTEGER;
              if (buffer[pos2] == "-".charCodeAt(0)) {
                neg = true;
                break;
              }
            // else fall through 
            case INTEGER:
              if (integer(buffer[pos2])) {
                _int *= 10;
                _int += buffer[pos2] - 48;
              } else if (buffer[pos2] == "e".charCodeAt(0)) {
                var ret = neg ? 0 - _int : _int;
                cb(ret);
                state = INITIAL;
              } else {
                throw new Error("not part of int at:" + pos2.toString(16));
              }
              break;
          }
        }
      };
      var integer = function(value) {
        if (!(typeof value === "number")) {
          return false;
        }
        return between(value, 48, 57);
      };
      var between = function(val, min, max) {
        return min <= val && val <= max;
      };
    };
    var Bdecode = function() {
      var DICTIONARY_START = {};
      var LIST_START = {};
      var Context = function() {
        var self3 = this;
        var stack = [];
        this.cb = function(o) {
          stack.push(o);
        };
        this.cb_list = function() {
          self3.cb(LIST_START);
        };
        this.cb_dict = function() {
          self3.cb(DICTIONARY_START);
        };
        this.cb_end = function() {
          var obj = null, tmp_stack = [];
          while (void 0 !== (obj = stack.pop())) {
            if (LIST_START === obj) {
              var obj2 = null;
              var list = [];
              while (void 0 !== (obj2 = tmp_stack.pop())) {
                list.push(obj2);
              }
              self3.cb(list);
              break;
            } else if (DICTIONARY_START === obj) {
              var key = null, val = null, dic = {};
              while (void 0 !== (key = tmp_stack.pop()) && void 0 !== (val = tmp_stack.pop())) {
                dic[key.toString()] = val;
              }
              if (void 0 !== key && void 0 === dic[key]) {
                throw new Error("uneven number of keys and values A");
              }
              self3.cb(dic);
              break;
            } else {
              tmp_stack.push(obj);
            }
          }
          if (tmp_stack.length > 0) {
            throw new Error("uneven number of keys and values B");
          }
        };
        this.result = function() {
          return stack;
        };
      };
      var self2 = this, ctx = new Context(), smachine = new BdecodeSMachine(ctx.cb, ctx.cb_list, ctx.cb_dict, ctx.cb_end);
      this.result = function() {
        if (!smachine.consistent()) {
          throw new Error("not in consistent state. More bytes coming?");
        }
        return ctx.result();
      };
      this.decode = function(buf, encoding) {
        smachine.parse(buf, encoding);
      };
    };
    var Bencode = function(obj) {
      var self2 = this;
      var to_encode = obj;
      switch (typeof obj) {
        case "string":
          return encodeString(obj);
        case "number":
          return encodeNumber(obj);
          break;
        case "object":
          if (obj instanceof Array) {
            return encodeList(obj);
          } else if (obj instanceof Buffer) {
            return encodeBuffer(obj);
          }
          {
            return encodeDict(obj);
          }
      }
      function encodeString(obj2) {
        var blen = Buffer.byteLength(obj2), len = blen.toString(10), buf = new Buffer(len.length + 1 + blen);
        buf.write(len, 0, "ascii");
        buf.write(":", len.length, "ascii");
        buf.write(obj2, len.length + 1, "utf8");
        return buf;
      }
      function encodeNumber(num) {
        var n = num.toString(10), buf = new Buffer(n.length + 2);
        buf.write("i", 0);
        buf.write(n, 1);
        buf.write("e", n.length + 1);
        return buf;
      }
      function encodeDict(obj2) {
        var func = function(obj3, pos) {
          for (var p in obj3) {
            var key = Bencode(p), val = Bencode(obj3[p]);
            ensure(key.length + val.length, pos);
            key.copy(buffer, pos, 0);
            pos += key.length;
            val.copy(buffer, pos, 0);
            pos += val.length;
          }
          return pos;
        };
        return assemble(obj2, "d", func);
      }
      function encodeList(obj2) {
        var func = function(obj3, pos) {
          obj3.forEach(function(o) {
            var elem = Bencode(o);
            ensure(elem.length, pos);
            elem.copy(buffer, pos, 0);
            pos += elem.length;
          });
          return pos;
        };
        return assemble(obj2, "l", func);
      }
      function encodeBuffer(obj2) {
        var len = obj2.length.toString(10), buf = new Buffer(len.length + 1 + obj2.length);
        buf.write(len, 0, "ascii");
        buf.write(":", len.length, "ascii");
        obj2.copy(buf, len.length + 1, 0);
        return buf;
      }
      var buffer = null;
      function assemble(obj2, prefix, func) {
        var pos = 0;
        ensure(1024, 0);
        buffer.write(prefix, pos++);
        pos = func(obj2, pos);
        ensure(1, pos);
        buffer.write("e", pos++);
        return buffer.slice(0, pos);
      }
      function ensure(num, pos) {
        if (!buffer) {
          buffer = new Buffer(num);
        } else {
          if (buffer.length > num + pos + 1) {
            return;
          } else {
            var buf2 = new Buffer(buffer.length + num);
            buffer.copy(buf2, 0, 0);
            buffer = buf2;
          }
        }
      }
    };
    function decode(buffer, encoding) {
      var decoder = new Bdecode();
      decoder.decode(buffer, encoding);
      return decoder.result()[0];
    }
    exports2.encode = Bencode;
    exports2.decoder = Bdecode;
    exports2.decode = decode;
  }
});

// node_modules/buffer-from/index.js
var require_buffer_from = __commonJS({
  "node_modules/buffer-from/index.js"(exports2, module2) {
    var toString = Object.prototype.toString;
    var isModern = typeof Buffer !== "undefined" && typeof Buffer.alloc === "function" && typeof Buffer.allocUnsafe === "function" && typeof Buffer.from === "function";
    function isArrayBuffer(input) {
      return toString.call(input).slice(8, -1) === "ArrayBuffer";
    }
    function fromArrayBuffer(obj, byteOffset, length) {
      byteOffset >>>= 0;
      var maxLength = obj.byteLength - byteOffset;
      if (maxLength < 0) {
        throw new RangeError("'offset' is out of bounds");
      }
      if (length === void 0) {
        length = maxLength;
      } else {
        length >>>= 0;
        if (length > maxLength) {
          throw new RangeError("'length' is out of bounds");
        }
      }
      return isModern ? Buffer.from(obj.slice(byteOffset, byteOffset + length)) : new Buffer(new Uint8Array(obj.slice(byteOffset, byteOffset + length)));
    }
    function fromString(string, encoding) {
      if (typeof encoding !== "string" || encoding === "") {
        encoding = "utf8";
      }
      if (!Buffer.isEncoding(encoding)) {
        throw new TypeError('"encoding" must be a valid string encoding');
      }
      return isModern ? Buffer.from(string, encoding) : new Buffer(string, encoding);
    }
    function bufferFrom(value, encodingOrOffset, length) {
      if (typeof value === "number") {
        throw new TypeError('"value" argument must not be a number');
      }
      if (isArrayBuffer(value)) {
        return fromArrayBuffer(value, encodingOrOffset, length);
      }
      if (typeof value === "string") {
        return fromString(value, encodingOrOffset);
      }
      return isModern ? Buffer.from(value) : new Buffer(value);
    }
    module2.exports = bufferFrom;
  }
});

// node_modules/buffer-fill/index.js
var require_buffer_fill = __commonJS({
  "node_modules/buffer-fill/index.js"(exports2, module2) {
    var hasFullSupport = (function() {
      try {
        if (!Buffer.isEncoding("latin1")) {
          return false;
        }
        var buf = Buffer.alloc ? Buffer.alloc(4) : new Buffer(4);
        buf.fill("ab", "ucs2");
        return buf.toString("hex") === "61006200";
      } catch (_) {
        return false;
      }
    })();
    function isSingleByte(val) {
      return val.length === 1 && val.charCodeAt(0) < 256;
    }
    function fillWithNumber(buffer, val, start, end) {
      if (start < 0 || end > buffer.length) {
        throw new RangeError("Out of range index");
      }
      start = start >>> 0;
      end = end === void 0 ? buffer.length : end >>> 0;
      if (end > start) {
        buffer.fill(val, start, end);
      }
      return buffer;
    }
    function fillWithBuffer(buffer, val, start, end) {
      if (start < 0 || end > buffer.length) {
        throw new RangeError("Out of range index");
      }
      if (end <= start) {
        return buffer;
      }
      start = start >>> 0;
      end = end === void 0 ? buffer.length : end >>> 0;
      var pos = start;
      var len = val.length;
      while (pos <= end - len) {
        val.copy(buffer, pos);
        pos += len;
      }
      if (pos !== end) {
        val.copy(buffer, pos, 0, end - pos);
      }
      return buffer;
    }
    function fill(buffer, val, start, end, encoding) {
      if (hasFullSupport) {
        return buffer.fill(val, start, end, encoding);
      }
      if (typeof val === "number") {
        return fillWithNumber(buffer, val, start, end);
      }
      if (typeof val === "string") {
        if (typeof start === "string") {
          encoding = start;
          start = 0;
          end = buffer.length;
        } else if (typeof end === "string") {
          encoding = end;
          end = buffer.length;
        }
        if (encoding !== void 0 && typeof encoding !== "string") {
          throw new TypeError("encoding must be a string");
        }
        if (encoding === "latin1") {
          encoding = "binary";
        }
        if (typeof encoding === "string" && !Buffer.isEncoding(encoding)) {
          throw new TypeError("Unknown encoding: " + encoding);
        }
        if (val === "") {
          return fillWithNumber(buffer, 0, start, end);
        }
        if (isSingleByte(val)) {
          return fillWithNumber(buffer, val.charCodeAt(0), start, end);
        }
        val = new Buffer(val, encoding);
      }
      if (Buffer.isBuffer(val)) {
        return fillWithBuffer(buffer, val, start, end);
      }
      return fillWithNumber(buffer, 0, start, end);
    }
    module2.exports = fill;
  }
});

// node_modules/buffer-alloc-unsafe/index.js
var require_buffer_alloc_unsafe = __commonJS({
  "node_modules/buffer-alloc-unsafe/index.js"(exports2, module2) {
    function allocUnsafe(size) {
      if (typeof size !== "number") {
        throw new TypeError('"size" argument must be a number');
      }
      if (size < 0) {
        throw new RangeError('"size" argument must not be negative');
      }
      if (Buffer.allocUnsafe) {
        return Buffer.allocUnsafe(size);
      } else {
        return new Buffer(size);
      }
    }
    module2.exports = allocUnsafe;
  }
});

// node_modules/buffer-alloc/index.js
var require_buffer_alloc = __commonJS({
  "node_modules/buffer-alloc/index.js"(exports2, module2) {
    var bufferFill = require_buffer_fill();
    var allocUnsafe = require_buffer_alloc_unsafe();
    module2.exports = function alloc(size, fill, encoding) {
      if (typeof size !== "number") {
        throw new TypeError('"size" argument must be a number');
      }
      if (size < 0) {
        throw new RangeError('"size" argument must not be negative');
      }
      if (Buffer.alloc) {
        return Buffer.alloc(size, fill, encoding);
      }
      var buffer = allocUnsafe(size);
      if (size === 0) {
        return buffer;
      }
      if (fill === void 0) {
        return bufferFill(buffer, 0);
      }
      if (typeof encoding !== "string") {
        encoding = void 0;
      }
      return bufferFill(buffer, fill, encoding);
    };
  }
});

// node_modules/peer-wire-protocol/index.js
var require_peer_wire_protocol = __commonJS({
  "node_modules/peer-wire-protocol/index.js"(exports2, module2) {
    var Duplex = require("stream").Duplex || require_readable().Duplex;
    var EventEmitter = require("events").EventEmitter;
    var bitfield = require_bitfield();
    var util = require("util");
    var bncode = require_bencode();
    var speedometer = require_speedometer();
    var bufferFrom = require_buffer_from();
    var bufferAlloc = require_buffer_alloc();
    var MESSAGE_PROTOCOL = bufferFrom([19, 66, 105, 116, 84, 111, 114, 114, 101, 110, 116, 32, 112, 114, 111, 116, 111, 99, 111, 108]);
    var MESSAGE_KEEP_ALIVE = bufferFrom([0, 0, 0, 0]);
    var MESSAGE_CHOKE = bufferFrom([0, 0, 0, 1, 0]);
    var MESSAGE_UNCHOKE = bufferFrom([0, 0, 0, 1, 1]);
    var MESSAGE_INTERESTED = bufferFrom([0, 0, 0, 1, 2]);
    var MESSAGE_UNINTERESTED = bufferFrom([0, 0, 0, 1, 3]);
    var MESSAGE_RESERVED = [0, 0, 0, 0, 0, 0, 0, 0];
    var MESSAGE_PORT = [0, 0, 0, 3, 9, 0, 0];
    var noop = function() {
    };
    var pull = function(requests, piece, offset, length) {
      for (var i = 0; i < requests.length; i++) {
        var req = requests[i];
        if (req.piece !== piece || req.offset !== offset || req.length !== length) continue;
        if (i === 0) requests.shift();
        else requests.splice(i, 1);
        return req;
      }
      return null;
    };
    var Request = function(piece, offset, length, callback) {
      this.piece = piece;
      this.offset = offset;
      this.length = length;
      this.callback = callback;
      this.timeout = null;
    };
    var Wire = function(opts) {
      if (!(this instanceof Wire)) return new Wire(opts);
      if (!opts) opts = {};
      Duplex.call(this);
      var self2 = this;
      this.amChoking = true;
      this.amInterested = false;
      this.peerChoking = true;
      this.peerInterested = false;
      this.peerPieces = [];
      this.peerExtensions = {};
      this.peerAddress = null;
      this.uploaded = 0;
      this.downloaded = 0;
      this.uploadSpeed = speedometer(opts.speed);
      this.downloadSpeed = speedometer(opts.speed);
      this.requests = [];
      this.peerRequests = [];
      this._keepAlive = null;
      this._finished = false;
      this.on("finish", function() {
        self2._finished = true;
        self2.push(null);
        clearInterval(self2._keepAlive);
        self2._parse(Number.MAX_VALUE, noop);
        while (self2.peerRequests.length) self2.peerRequests.pop();
        while (self2.requests.length) self2._callback(self2.requests.shift(), new Error("wire is closed"), null);
      });
      var ontimeout = function() {
        self2._callback(self2.requests.shift(), new Error("request has timed out"), null);
        self2.emit("timeout");
      };
      this._timeout = 0;
      this._ontimeout = ontimeout;
      var onmessagelength = function(buffer) {
        var length = buffer.readUInt32BE(0);
        if (length) return self2._parse(length, onmessage);
        self2._parse(4, onmessagelength);
        self2.emit("keep-alive");
      };
      var onmessage = function(buffer) {
        self2._parse(4, onmessagelength);
        switch (buffer[0]) {
          case 0:
            return self2._onchoke();
          case 1:
            return self2._onunchoke();
          case 2:
            return self2._oninterested();
          case 3:
            return self2._onuninterested();
          case 4:
            return self2._onhave(buffer.readUInt32BE(1));
          case 5:
            return self2._onbitfield(buffer.slice(1));
          case 6:
            return self2._onrequest(buffer.readUInt32BE(1), buffer.readUInt32BE(5), buffer.readUInt32BE(9));
          case 7:
            return self2._onpiece(buffer.readUInt32BE(1), buffer.readUInt32BE(5), buffer.slice(9));
          case 8:
            return self2._oncancel(buffer.readUInt32BE(1), buffer.readUInt32BE(5), buffer.readUInt32BE(9));
          case 9:
            return self2._onport(buffer.readUInt16BE(1));
          case 20:
            return self2._onextended(buffer.readUInt8(1), buffer.slice(2));
        }
        self2.emit("unknownmessage", buffer);
      };
      this._buffer = [];
      this._bufferSize = 0;
      this._parser = null;
      this._parserSize = 0;
      this._parse(1, function(buffer) {
        var pstrlen = buffer.readUInt8(0);
        self2._parse(pstrlen + 48, function(handshake) {
          handshake = handshake.slice(pstrlen);
          self2._onhandshake(handshake.slice(8, 28), handshake.slice(28, 48), {
            dht: !!(handshake[7] & 1),
            extended: !!(handshake[5] & 16)
          });
          self2._parse(4, onmessagelength);
        });
      });
    };
    util.inherits(Wire, Duplex);
    Wire.prototype.handshake = function(infoHash, peerId, extensions) {
      if (typeof infoHash === "string") infoHash = bufferFrom(infoHash, "hex");
      if (typeof peerId === "string") peerId = bufferFrom(peerId);
      if (infoHash.length !== 20 || peerId.length !== 20) throw new Error("infoHash and peerId MUST have length 20");
      var reserved = bufferFrom(MESSAGE_RESERVED);
      if (extensions && extensions.dht) reserved[7] |= 1;
      reserved[5] |= 16;
      this._push(Buffer.concat([MESSAGE_PROTOCOL, reserved, infoHash, peerId], MESSAGE_PROTOCOL.length + 48));
    };
    Wire.prototype.choke = function() {
      if (this.amChoking) return;
      this.amChoking = true;
      while (this.peerRequests.length) this.peerRequests.pop();
      this._push(MESSAGE_CHOKE);
    };
    Wire.prototype.unchoke = function() {
      if (!this.amChoking) return;
      this.amChoking = false;
      this._push(MESSAGE_UNCHOKE);
    };
    Wire.prototype.interested = function() {
      if (this.amInterested) return;
      this.amInterested = true;
      this._push(MESSAGE_INTERESTED);
    };
    Wire.prototype.uninterested = function() {
      if (!this.amInterested) return;
      this.amInterested = false;
      this._push(MESSAGE_UNINTERESTED);
    };
    Wire.prototype.have = function(i) {
      this._message(4, [i], null);
    };
    Wire.prototype.bitfield = function(bitfield2) {
      if (bitfield2.buffer) bitfield2 = bitfield2.buffer;
      this._message(5, [], bitfield2);
    };
    Wire.prototype.request = function(i, offset, length, callback) {
      if (!callback) callback = noop;
      if (this._finished) return callback(new Error("wire is closed"));
      if (this.peerChoking) return callback(new Error("peer is choking"));
      this.requests.push(new Request(i, offset, length, callback));
      this._updateTimeout();
      this._message(6, [i, offset, length], null);
    };
    Wire.prototype.piece = function(i, offset, buffer) {
      this.uploaded += buffer.length;
      this.uploadSpeed(buffer.length);
      this.emit("upload", buffer.length);
      this._message(7, [i, offset], buffer);
    };
    Wire.prototype.cancel = function(i, offset, length) {
      this._callback(pull(this.requests, i, offset, length), new Error("request was cancelled"), null);
      this._message(8, [i, offset, length], null);
    };
    Wire.prototype.extended = function(id, msg) {
      this._message(20, [], Buffer.concat([bufferFrom([id]), Buffer.isBuffer(msg) ? msg : bncode.encode(msg)]));
    };
    Wire.prototype.port = function(port) {
      var message = bufferFrom(MESSAGE_PORT);
      message.writeUInt16BE(port, 5);
      this._push(message);
    };
    Wire.prototype.setKeepAlive = function(bool) {
      clearInterval(this._keepAlive);
      if (bool === false) return;
      this._keepAlive = setInterval(this._push.bind(this, MESSAGE_KEEP_ALIVE), 6e4);
    };
    Wire.prototype.setTimeout = function(ms, fn) {
      if (this.requests.length) clearTimeout(this.requests[0].timeout);
      this._timeout = ms;
      this._updateTimeout();
      if (fn) this.on("timeout", fn);
    };
    Wire.prototype.destroy = function() {
      this.emit("close");
      this.end();
    };
    Wire.prototype._onhandshake = function(infoHash, peerId, extensions) {
      this.peerExtensions = extensions;
      this.emit("handshake", infoHash, peerId, extensions);
    };
    Wire.prototype._oninterested = function() {
      this.peerInterested = true;
      this.emit("interested");
    };
    Wire.prototype._onuninterested = function() {
      this.peerInterested = false;
      this.emit("uninterested");
    };
    Wire.prototype._onchoke = function() {
      this.peerChoking = true;
      this.emit("choke");
      while (this.requests.length) this._callback(this.requests.shift(), new Error("peer is choking"), null);
    };
    Wire.prototype._onunchoke = function() {
      this.peerChoking = false;
      this.emit("unchoke");
    };
    Wire.prototype._onbitfield = function(buffer) {
      var pieces = bitfield(buffer);
      for (var i = 0; i < 8 * buffer.length; i++) {
        this.peerPieces[i] = pieces.get(i);
      }
      this.emit("bitfield", buffer);
    };
    Wire.prototype._onhave = function(i) {
      this.peerPieces[i] = true;
      this.emit("have", i);
    };
    Wire.prototype._onrequest = function(i, offset, length) {
      if (this.amChoking) return;
      var self2 = this;
      var respond = function(err, buffer) {
        if (request !== pull(self2.peerRequests, i, offset, length)) return;
        if (err) return;
        self2.piece(i, offset, buffer);
      };
      var request = new Request(i, offset, length, respond);
      this.peerRequests.push(request);
      this.emit("request", i, offset, length, respond);
    };
    Wire.prototype._oncancel = function(i, offset, length) {
      pull(this.peerRequests, i, offset, length);
      this.emit("cancel", i, offset, length);
    };
    Wire.prototype._onpiece = function(i, offset, buffer) {
      this._callback(pull(this.requests, i, offset, buffer.length), null, buffer);
      this.downloaded += buffer.length;
      this.downloadSpeed(buffer.length);
      this.emit("download", buffer.length);
      this.emit("piece", i, offset, buffer);
    };
    Wire.prototype._onport = function(port) {
      this.emit("port", port);
    };
    Wire.prototype._onextended = function(id, ext) {
      this.emit("extended", id, ext);
    };
    Wire.prototype._callback = function(request, err, buffer) {
      if (!request) return;
      if (request.timeout) clearTimeout(request.timeout);
      if (!this.peerChoking && !this._finished) this._updateTimeout();
      request.callback(err, buffer);
    };
    Wire.prototype._updateTimeout = function() {
      if (!this._timeout || !this.requests.length || this.requests[0].timeout) return;
      this.requests[0].timeout = setTimeout(this._ontimeout, this._timeout);
    };
    Wire.prototype._message = function(id, numbers, data) {
      var dataLength = data ? data.length : 0;
      var buffer = bufferAlloc(5 + 4 * numbers.length);
      buffer.writeUInt32BE(buffer.length + dataLength - 4, 0);
      buffer[4] = id;
      for (var i = 0; i < numbers.length; i++) {
        buffer.writeUInt32BE(numbers[i], 5 + 4 * i);
      }
      this._push(buffer);
      if (data) this._push(data);
    };
    Wire.prototype._push = function(data) {
      if (this._finished) return;
      this.push(data);
    };
    Wire.prototype._parse = function(size, parser) {
      this._parserSize = size;
      this._parser = parser;
    };
    Wire.prototype._write = function(data, encoding, callback) {
      this._bufferSize += data.length;
      this._buffer.push(data);
      while (this._bufferSize >= this._parserSize) {
        var buffer = this._buffer.length === 1 ? this._buffer[0] : Buffer.concat(this._buffer, this._bufferSize);
        this._bufferSize -= this._parserSize;
        this._buffer = this._bufferSize ? [buffer.slice(this._parserSize)] : [];
        this._parser(buffer.slice(0, this._parserSize));
      }
      callback();
    };
    Wire.prototype._read = noop;
    module2.exports = Wire;
  }
});

// node_modules/peer-wire-swarm/index.js
var require_peer_wire_swarm = __commonJS({
  "node_modules/peer-wire-swarm/index.js"(exports2, module2) {
    var utp = require_utp();
    var net = require("net");
    var fifo = require_fifo();
    var once = require_once();
    var speedometer = require_speedometer();
    var peerWireProtocol = require_peer_wire_protocol();
    var EventEmitter = require("events").EventEmitter;
    var util = require("util");
    var bufferFrom = require_buffer_from();
    var HANDSHAKE_TIMEOUT = 25e3;
    var CONNECTION_TIMEOUT = 3e3;
    var RECONNECT_WAIT = [1e3, 5e3, 15e3];
    var DEFAULT_SIZE = 100;
    var toBuffer = function(str, encoding) {
      return Buffer.isBuffer(str) ? str : bufferFrom(str, encoding);
    };
    var toAddress = function(wire) {
      if (typeof wire === "string") return wire;
      return wire.peerAddress;
    };
    var onwire = function(swarm, connection, onhandshake, isServer) {
      var wire = peerWireProtocol(swarm._pwp);
      var destroy = function() {
        connection.destroy();
        connection.emit("timeout");
      };
      var connectTimeout = !isServer && setTimeout(destroy, swarm.connectTimeout);
      var handshakeTimeout = setTimeout(destroy, swarm.handshakeTimeout);
      if (handshakeTimeout.unref) handshakeTimeout.unref();
      if (connectTimeout.unref) connectTimeout.unref();
      connection.on("connect", function() {
        clearTimeout(connectTimeout);
      });
      wire.once("handshake", function(infoHash, peerId) {
        clearTimeout(handshakeTimeout);
        onhandshake(infoHash, peerId);
      });
      connection.on("end", function() {
        connection.destroy();
      });
      connection.on("error", function() {
        connection.destroy();
      });
      connection.on("close", function() {
        clearTimeout(connectTimeout);
        clearTimeout(handshakeTimeout);
        wire.destroy();
      });
      connection.pipe(wire).pipe(connection);
      return wire;
    };
    var pools = {};
    var leave = function(port, swarm) {
      if (!pools[port]) return;
      delete pools[port].swarms[swarm.infoHash.toString("hex")];
      if (Object.keys(pools[port].swarms).length) return;
      pools[port].servers.forEach(function(server2) {
        server2.close();
      });
      delete pools[port];
    };
    var join = function(port, swarm) {
      var pool = pools[port];
      if (!pool) {
        var swarms = {};
        var servers = [];
        var onconnection = function(connection) {
          var wire = onwire(swarm, connection, function(infoHash2, peerId) {
            var swarm2 = swarms[infoHash2.toString("hex")];
            if (!swarm2) return connection.destroy();
            swarm2._onincoming(connection, wire);
          }, true);
        };
        servers.push(net.createServer(onconnection));
        if (swarm.utp) servers.push(utp.createServer(onconnection));
        var loop = function(i) {
          if (i < servers.length) return servers[i].listen(port, loop.bind(null, i + 1));
          pool.listening = true;
          Object.keys(swarms).forEach(function(infoHash2) {
            swarms[infoHash2].emit("listening");
          });
        };
        loop(0);
        pool = pools[port] = {
          servers,
          swarms,
          listening: false
        };
      }
      var infoHash = swarm.infoHash.toString("hex");
      if (pool.listening) {
        process.nextTick(function() {
          swarm.emit("listening");
        });
      }
      if (pool.swarms[infoHash]) {
        process.nextTick(function() {
          swarm.emit("error", new Error("port and info hash already in use"));
        });
        return;
      }
      pool.swarms[infoHash] = swarm;
    };
    var Swarm = function(infoHash, peerId, options) {
      if (!(this instanceof Swarm)) return new Swarm(infoHash, peerId, options);
      EventEmitter.call(this);
      options = options || {};
      this.handshake = options.handshake;
      this.port = 0;
      this.size = options.size || DEFAULT_SIZE;
      this.utp = options.utp || false;
      this.handshakeTimeout = options.handshakeTimeout || HANDSHAKE_TIMEOUT;
      this.connectTimeout = options.connectTimeout || CONNECTION_TIMEOUT;
      this.infoHash = toBuffer(infoHash, "hex");
      this.peerId = toBuffer(peerId, "utf-8");
      this.downloaded = 0;
      this.uploaded = 0;
      this.connections = [];
      this.wires = [];
      this.paused = false;
      this.uploaded = 0;
      this.downloaded = 0;
      this.downloadSpeed = speedometer();
      this.uploadSpeed = speedometer();
      this._destroyed = false;
      this._queues = [fifo()];
      this._peers = {};
      this._pwp = { speed: options.speed };
    };
    util.inherits(Swarm, EventEmitter);
    Swarm.prototype.__defineGetter__("queued", function() {
      return this._queues.reduce(function(prev, queue) {
        return prev + queue.length;
      }, 0);
    });
    Swarm.prototype.pause = function() {
      this.paused = true;
    };
    Swarm.prototype.resume = function() {
      this.paused = false;
      this._drain();
    };
    Swarm.prototype.priority = function(addr, level) {
      addr = toAddress(addr);
      var peer = this._peers[addr];
      if (!peer) return 0;
      if (typeof level !== "number" || peer.priority === level) return level;
      if (!this._queues[level]) this._queues[level] = fifo();
      if (peer.node) {
        this._queues[peer.priority].remove(peer.node);
        peer.node = this._queues[level].push(addr);
      }
      return peer.priority = level;
    };
    Swarm.prototype.add = function(addr) {
      if (this._destroyed || this._peers[addr]) return;
      var port = Number(addr.split(":")[1]);
      if (!(port > 0 && port < 65535)) return;
      this._peers[addr] = {
        node: this._queues[0].push(addr),
        wire: null,
        timeout: null,
        reconnect: false,
        priority: 0,
        retries: 0,
        noUtp: false
      };
      this._drain();
    };
    Swarm.prototype.remove = function(addr) {
      this._remove(toAddress(addr));
      this._drain();
    };
    Swarm.prototype.listen = function(port, onlistening) {
      if (onlistening) this.once("listening", onlistening);
      this.port = port;
      join(this.port, this);
    };
    Swarm.prototype.destroy = function() {
      this._destroyed = true;
      var self2 = this;
      Object.keys(this._peers).forEach(function(addr) {
        self2._remove(addr);
      });
      this.wires.forEach(function(wire) {
        wire.destroy();
      });
      leave(this.port, this);
      process.nextTick(function() {
        self2.emit("close");
      });
    };
    Swarm.prototype._remove = function(addr) {
      var peer = this._peers[addr];
      if (!peer) return;
      delete this._peers[addr];
      if (peer.node) this._queues[peer.priority].remove(peer.node);
      if (peer.timeout) clearTimeout(peer.timeout);
      if (peer.wire) peer.wire.destroy();
    };
    Swarm.prototype._drain = function() {
      if (this.connections.length >= this.size || this.paused) return;
      var self2 = this;
      var addr = this._shift();
      if (!addr) return;
      var peer = this._peers[addr];
      if (!peer) return;
      var repush = function() {
        peer.node = self2._queues[peer.priority].push(addr);
        self2._drain();
      };
      var parts = addr.split(":");
      var connection;
      if (this.utp && !peer.noUtp) {
        connection = utp.connect(parts[1], parts[0]);
        connection.on("timeout", function() {
          peer.noUtp = true;
          repush();
        });
      } else {
        connection = net.connect(parts[1], parts[0]);
      }
      if (peer.timeout) clearTimeout(peer.timeout);
      peer.node = null;
      peer.timeout = null;
      var wire = onwire(this, connection, function(infoHash) {
        if (infoHash.toString("hex") !== self2.infoHash.toString("hex")) return connection.destroy();
        peer.reconnect = true;
        peer.retries = 0;
        self2._onwire(connection, wire);
      });
      wire.on("end", function() {
        peer.wire = null;
        if (!peer.reconnect || self2._destroyed || peer.retries >= RECONNECT_WAIT.length) return self2._remove(addr);
        peer.timeout = setTimeout(repush, RECONNECT_WAIT[peer.retries++]);
      });
      peer.wire = wire;
      self2._onconnection(connection);
      wire.peerAddress = addr;
      wire.handshake(this.infoHash, this.peerId, this.handshake);
    };
    Swarm.prototype._shift = function() {
      for (var i = this._queues.length - 1; i >= 0; i--) {
        if (this._queues[i] && this._queues[i].length) return this._queues[i].shift();
      }
      return null;
    };
    Swarm.prototype._onincoming = function(connection, wire) {
      wire.peerAddress = connection.address().address + ":" + connection.address().port;
      wire.handshake(this.infoHash, this.peerId, this.handshake);
      this._onconnection(connection);
      this._onwire(connection, wire);
    };
    Swarm.prototype._onconnection = function(connection) {
      var self2 = this;
      connection.once("close", function() {
        self2.connections.splice(self2.connections.indexOf(connection), 1);
        self2._drain();
      });
      this.connections.push(connection);
    };
    Swarm.prototype._onwire = function(connection, wire) {
      var self2 = this;
      wire.on("download", function(downloaded) {
        self2.downloaded += downloaded;
        self2.downloadSpeed(downloaded);
        self2.emit("download", downloaded);
      });
      wire.on("upload", function(uploaded) {
        self2.uploaded += uploaded;
        self2.uploadSpeed(uploaded);
        self2.emit("upload", uploaded);
      });
      var cleanup = once(function() {
        self2.emit("wire-disconnect", wire, connection);
        self2.wires.splice(self2.wires.indexOf(wire), 1);
        connection.destroy();
      });
      connection.on("close", cleanup);
      connection.on("error", cleanup);
      connection.on("end", cleanup);
      wire.on("end", cleanup);
      wire.on("close", cleanup);
      wire.on("finish", cleanup);
      this.wires.push(wire);
      this.emit("wire", wire, connection);
    };
    module2.exports = Swarm;
  }
});

// node_modules/bncode/bncode.js
var require_bncode = __commonJS({
  "node_modules/bncode/bncode.js"(exports2) {
    exports2.encode = Bencode;
    exports2.decoder = Bdecode;
    exports2.decode = decode;
    exports2.Stream = Stream;
    var inherits = require("util").inherits;
    var Transform = require("stream").Transform;
    var I = "i".charCodeAt(0);
    var L = "l".charCodeAt(0);
    var E = "e".charCodeAt(0);
    var D = "d".charCodeAt(0);
    var COLON = ":".charCodeAt(0);
    var DASH = "-".charCodeAt(0);
    var STATE_INITIAL = 0;
    var STATE_STATE_STRING_LEN = STATE_INITIAL + 1;
    var STATE_STRING = STATE_STATE_STRING_LEN + 1;
    var STATE_COLON = STATE_STRING + 1;
    var STATE_STATE_INTEGER = STATE_COLON + 1;
    var STATE_INTEGER = STATE_STATE_INTEGER + 1;
    function BdecodeSMachine(cb, cb_list, cb_dict, cb_end) {
      var depth = 0;
      var state = STATE_INITIAL;
      this.consistent = function() {
        return state === STATE_INITIAL && depth === 0;
      };
      var strLen = 0;
      var str = "";
      var _int = 0;
      var neg = false;
      this.parse = function(buffer, encoding) {
        if (typeof buffer === "string") {
          buffer = new Buffer(buffer, encoding || "utf8");
        }
        for (var pos = 0; pos !== buffer.length; ++pos) {
          switch (state) {
            case STATE_INITIAL:
              switch (buffer[pos]) {
                case 48:
                case 49:
                case 50:
                case 51:
                case 52:
                case 53:
                case 54:
                case 55:
                case 56:
                case 57:
                  state = STATE_STATE_STRING_LEN;
                  strLen = 0;
                  strLen += buffer[pos] - 48;
                  break;
                case I:
                  state = STATE_STATE_INTEGER;
                  _int = 0;
                  neg = false;
                  break;
                case L:
                  state = STATE_INITIAL;
                  depth += 1;
                  cb_list();
                  break;
                case D:
                  state = STATE_INITIAL;
                  depth += 1;
                  cb_dict();
                  break;
                case E:
                  state = STATE_INITIAL;
                  depth -= 1;
                  if (depth < 0) {
                    throw new Error("end with no beginning: " + pos);
                  } else {
                    cb_end();
                  }
                  break;
              }
              break;
            case STATE_STATE_STRING_LEN:
              if (integer(buffer[pos])) {
                strLen *= 10;
                strLen += buffer[pos] - 48;
              } else {
                str = new Buffer(strLen);
                pos -= 1;
                state = STATE_COLON;
              }
              break;
            case STATE_COLON:
              if (buffer[pos] !== COLON) {
                throw new Error("not a colon at: " + pos.toString(16));
              }
              state = STATE_STRING;
              if (0 === strLen) {
                cb(new Buffer(0));
                state = STATE_INITIAL;
              }
              break;
            case STATE_STRING:
              if (0 === strLen) {
                cb(str);
                state = STATE_INITIAL;
              } else {
                str[str.length - strLen] = buffer[pos];
                strLen -= 1;
                if (0 === strLen) {
                  cb(str);
                  state = STATE_INITIAL;
                }
              }
              break;
            case STATE_STATE_INTEGER:
              state = STATE_INTEGER;
              if (buffer[pos] === DASH) {
                neg = true;
                break;
              }
            // else fall through
            case STATE_INTEGER:
              if (integer(buffer[pos])) {
                _int *= 10;
                _int += buffer[pos] - 48;
              } else if (buffer[pos] === E) {
                var ret = neg ? 0 - _int : _int;
                cb(ret);
                state = STATE_INITIAL;
              } else {
                throw new Error("not part of int at:" + pos.toString(16));
              }
              break;
          }
        }
      };
      function integer(value) {
        if (typeof value !== "number") {
          return false;
        }
        return between(value, 48, 57);
      }
      function between(val, min, max) {
        return min <= val && val <= max;
      }
    }
    function Bdecode() {
      var DICTIONARY_START = {};
      var LIST_START = {};
      var Context = function() {
        var self3 = this;
        var stack = [];
        this.cb = function(o) {
          stack.push(o);
        };
        this.cb_list = function() {
          self3.cb(LIST_START);
        };
        this.cb_dict = function() {
          self3.cb(DICTIONARY_START);
        };
        this.cb_end = function() {
          var obj = null;
          var tmp_stack = [];
          while ((obj = stack.pop()) !== void 0) {
            if (LIST_START === obj) {
              var obj2 = null;
              var list = [];
              while ((obj2 = tmp_stack.pop()) !== void 0) {
                list.push(obj2);
              }
              self3.cb(list);
              break;
            } else if (DICTIONARY_START === obj) {
              var key = null;
              var val = null;
              var dic = {};
              while ((key = tmp_stack.pop()) !== void 0 && (val = tmp_stack.pop()) !== void 0) {
                dic[key.toString()] = val;
              }
              if (key !== void 0 && dic[key] === void 0) {
                throw new Error("uneven number of keys and values A");
              }
              self3.cb(dic);
              break;
            } else {
              tmp_stack.push(obj);
            }
          }
          if (tmp_stack.length > 0) {
            throw new Error("uneven number of keys and values B");
          }
        };
        this.result = function() {
          return stack;
        };
      };
      var self2 = this;
      var ctx = new Context();
      var smachine = new BdecodeSMachine(ctx.cb, ctx.cb_list, ctx.cb_dict, ctx.cb_end);
      this.result = function() {
        if (!smachine.consistent()) {
          throw new Error("not in consistent state. More bytes coming?");
        }
        return ctx.result();
      };
      this.decode = function(buf, encoding) {
        smachine.parse(buf, encoding);
      };
    }
    function Bencode(obj) {
      var self2 = this;
      var to_encode = obj;
      var buffer = null;
      switch (typeof obj) {
        case "string":
          return encodeString(obj);
        case "number":
          return encodeNumber(obj);
        case "object":
          if (obj instanceof Array) {
            return encodeList(obj);
          } else if (Buffer.isBuffer(obj)) {
            return encodeBuffer(obj);
          } else {
            return encodeDict(obj);
          }
      }
      function encodeString(obj2) {
        var blen = Buffer.byteLength(obj2);
        var len = blen.toString(10);
        var buf = new Buffer(len.length + 1 + blen);
        buf.write(len, 0, "ascii");
        buf.write(":", len.length, "ascii");
        buf.write(obj2, len.length + 1, "utf8");
        return buf;
      }
      function encodeNumber(num) {
        var n = num.toString(10);
        var buf = new Buffer(n.length + 2);
        buf.write("i", 0);
        buf.write(n, 1);
        buf.write("e", n.length + 1);
        return buf;
      }
      function encodeDict(obj2) {
        var func = function(obj3, pos) {
          var keys = Object.keys(obj3).sort();
          keys.forEach(function(key) {
            var val = new Bencode(obj3[key]);
            key = new Bencode(key);
            ensure(key.length + val.length, pos);
            key.copy(buffer, pos, 0);
            pos += key.length;
            val.copy(buffer, pos, 0);
            pos += val.length;
          });
          return pos;
        };
        return assemble(obj2, "d", func);
      }
      function encodeList(obj2) {
        var func = function(obj3, pos) {
          obj3.forEach(function(o) {
            var elem = new Bencode(o);
            ensure(elem.length, pos);
            elem.copy(buffer, pos, 0);
            pos += elem.length;
          });
          return pos;
        };
        return assemble(obj2, "l", func);
      }
      function encodeBuffer(obj2) {
        var len = obj2.length.toString(10);
        var buf = new Buffer(len.length + 1 + obj2.length);
        buf.write(len, 0, "ascii");
        buf.write(":", len.length, "ascii");
        obj2.copy(buf, len.length + 1, 0);
        return buf;
      }
      function assemble(obj2, prefix, func) {
        var pos = 0;
        ensure(1024, 0);
        buffer.write(prefix, pos++);
        pos = func(obj2, pos);
        ensure(1, pos);
        buffer.write("e", pos++);
        return buffer.slice(0, pos);
      }
      function ensure(num, pos) {
        if (!buffer) {
          buffer = new Buffer(num);
        } else {
          if (buffer.length > num + pos + 1) {
            return;
          } else {
            var buf2 = new Buffer(buffer.length + num);
            buffer.copy(buf2, 0, 0);
            buffer = buf2;
          }
        }
      }
    }
    function decode(buffer, encoding) {
      var decoder = new Bdecode();
      decoder.decode(buffer, encoding);
      return decoder.result()[0];
    }
    function Stream(options) {
      options = options || {};
      options.objectMode = true;
      Transform.call(this, options);
      this._decoder = new Bdecode();
    }
    inherits(Stream, Transform);
    Stream.prototype._transform = function(chunk, encoding, callback) {
      try {
        this._decoder.decode(chunk, encoding);
        callback(null);
      } catch (err) {
        callback(err);
      }
    };
    Stream.prototype._flush = function(callback) {
      this.push(this._decoder.result()[0]);
      callback(null);
    };
  }
});

// node_modules/thirty-two/lib/thirty-two/thirty-two.js
var require_thirty_two = __commonJS({
  "node_modules/thirty-two/lib/thirty-two/thirty-two.js"(exports2) {
    var charTable = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    var byteTable = [
      255,
      255,
      26,
      27,
      28,
      29,
      30,
      31,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      17,
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      25,
      255,
      255,
      255,
      255,
      255,
      255,
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      17,
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      25,
      255,
      255,
      255,
      255,
      255
    ];
    function quintetCount(buff) {
      var quintets = Math.floor(buff.length / 5);
      return buff.length % 5 == 0 ? quintets : quintets + 1;
    }
    exports2.encode = function(plain) {
      var i = 0;
      var j = 0;
      var shiftIndex = 0;
      var digit = 0;
      var encoded = new Buffer(quintetCount(plain) * 8);
      if (!Buffer.isBuffer(plain)) {
        plain = new Buffer(plain);
      }
      while (i < plain.length) {
        var current2 = plain[i];
        if (shiftIndex > 3) {
          digit = current2 & 255 >> shiftIndex;
          shiftIndex = (shiftIndex + 5) % 8;
          digit = digit << shiftIndex | (i + 1 < plain.length ? plain[i + 1] : 0) >> 8 - shiftIndex;
          i++;
        } else {
          digit = current2 >> 8 - (shiftIndex + 5) & 31;
          shiftIndex = (shiftIndex + 5) % 8;
          if (shiftIndex == 0) i++;
        }
        encoded[j] = charTable.charCodeAt(digit);
        j++;
      }
      for (i = j; i < encoded.length; i++)
        encoded[i] = 61;
      return encoded;
    };
    exports2.decode = function(encoded) {
      var shiftIndex = 0;
      var plainDigit = 0;
      var plainChar;
      var plainPos = 0;
      if (!Buffer.isBuffer(encoded)) {
        encoded = new Buffer(encoded);
      }
      var decoded = new Buffer(Math.ceil(encoded.length * 5 / 8));
      for (var i = 0; i < encoded.length; i++) {
        if (encoded[i] == 61) {
          break;
        }
        var encodedByte = encoded[i] - 48;
        if (encodedByte < byteTable.length) {
          plainDigit = byteTable[encodedByte];
          if (shiftIndex <= 3) {
            shiftIndex = (shiftIndex + 5) % 8;
            if (shiftIndex == 0) {
              plainChar |= plainDigit;
              decoded[plainPos] = plainChar;
              plainPos++;
              plainChar = 0;
            } else {
              plainChar |= 255 & plainDigit << 8 - shiftIndex;
            }
          } else {
            shiftIndex = (shiftIndex + 5) % 8;
            plainChar |= 255 & plainDigit >>> shiftIndex;
            decoded[plainPos] = plainChar;
            plainPos++;
            plainChar = 255 & plainDigit << 8 - shiftIndex;
          }
        } else {
          throw new Error("Invalid input - it is not base32 encoded string");
        }
      }
      return decoded.slice(0, plainPos);
    };
  }
});

// node_modules/thirty-two/lib/thirty-two/index.js
var require_thirty_two2 = __commonJS({
  "node_modules/thirty-two/lib/thirty-two/index.js"(exports2) {
    var base32 = require_thirty_two();
    exports2.encode = base32.encode;
    exports2.decode = base32.decode;
  }
});

// node_modules/xtend/immutable.js
var require_immutable = __commonJS({
  "node_modules/xtend/immutable.js"(exports2, module2) {
    module2.exports = extend;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    function extend() {
      var target = {};
      for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    }
  }
});

// node_modules/flatten/index.js
var require_flatten = __commonJS({
  "node_modules/flatten/index.js"(exports2, module2) {
    module2.exports = function flatten(list, depth) {
      depth = typeof depth == "number" ? depth : Infinity;
      return _flatten(list, 1);
      function _flatten(list2, d) {
        return list2.reduce(function(acc, item) {
          if (Array.isArray(item) && d < depth) {
            return acc.concat(_flatten(item, d + 1));
          } else {
            return acc.concat(item);
          }
        }, []);
      }
    };
  }
});

// node_modules/magnet-uri/index.js
var require_magnet_uri = __commonJS({
  "node_modules/magnet-uri/index.js"(exports2, module2) {
    module2.exports = magnetURIDecode;
    module2.exports.decode = magnetURIDecode;
    module2.exports.encode = magnetURIEncode;
    var base32 = require_thirty_two2();
    var extend = require_immutable();
    var flatten = require_flatten();
    function magnetURIDecode(uri) {
      var result = {};
      var data = uri.split("magnet:?")[1];
      var params = data && data.length >= 0 ? data.split("&") : [];
      params.forEach(function(param) {
        var keyval = param.split("=");
        if (keyval.length !== 2) return;
        var key = keyval[0];
        var val = keyval[1];
        if (key === "dn") val = decodeURIComponent(val).replace(/\+/g, " ");
        if (key === "tr" || key === "xs" || key === "as" || key === "ws") {
          val = decodeURIComponent(val);
        }
        if (key === "kt") val = decodeURIComponent(val).split("+");
        if (result[key]) {
          if (Array.isArray(result[key])) {
            result[key].push(val);
          } else {
            var old = result[key];
            result[key] = [old, val];
          }
        } else {
          result[key] = val;
        }
      });
      var m;
      if (result.xt) {
        var xts = Array.isArray(result.xt) ? result.xt : [result.xt];
        xts.forEach(function(xt) {
          if (m = xt.match(/^urn:btih:(.{40})/)) {
            result.infoHash = new Buffer(m[1], "hex").toString("hex");
          } else if (m = xt.match(/^urn:btih:(.{32})/)) {
            var decodedStr = base32.decode(m[1]);
            result.infoHash = new Buffer(decodedStr, "binary").toString("hex");
          }
        });
      }
      if (result.dn) result.name = result.dn;
      if (result.kt) result.keywords = result.kt;
      if (typeof result.tr === "string") result.announce = [result.tr];
      else if (Array.isArray(result.tr)) result.announce = result.tr;
      else result.announce = [];
      result.announceList = result.announce.map(function(url) {
        return [url];
      });
      result.urlList = [];
      if (typeof result.as === "string" || Array.isArray(result.as)) {
        result.urlList = result.urlList.concat(result.as);
      }
      if (typeof result.ws === "string" || Array.isArray(result.ws)) {
        result.urlList = result.urlList.concat(result.ws);
      }
      return result;
    }
    function magnetURIEncode(obj) {
      obj = extend(obj);
      if (obj.infoHash) obj.xt = "urn:btih:" + obj.infoHash;
      if (obj.name) obj.dn = obj.name;
      if (obj.keywords) obj.kt = obj.keywords;
      if (obj.announce) obj.tr = obj.announce;
      if (obj.announceList) obj.tr = flatten(obj.announceList);
      if (obj.urlList) {
        obj.ws = flatten(obj.urlList);
        delete obj.as;
      }
      var result = "magnet:?";
      Object.keys(obj).filter(function(key) {
        return key.length === 2;
      }).forEach(function(key, i) {
        var values = Array.isArray(obj[key]) ? obj[key] : [obj[key]];
        values.forEach(function(val, j) {
          if ((i > 0 || j > 0) && (key !== "kt" || j === 0)) result += "&";
          if (key === "dn") val = encodeURIComponent(val).replace(/%20/g, "+");
          if (key === "tr" || key === "xs" || key === "as" || key === "ws") {
            val = encodeURIComponent(val);
          }
          if (key === "kt") val = encodeURIComponent(val);
          if (key === "kt" && j > 0) result += "+" + val;
          else result += key + "=" + val;
        });
      });
      return result;
    }
  }
});

// node_modules/bencode/lib/encode.js
var require_encode = __commonJS({
  "node_modules/bencode/lib/encode.js"(exports2, module2) {
    function encode(data) {
      var buffers = [];
      encode._encode(buffers, data);
      return Buffer.concat(buffers);
    }
    encode._floatConversionDetected = false;
    encode._encode = function(buffers, data) {
      if (Buffer.isBuffer(data)) {
        buffers.push(new Buffer(data.length + ":"));
        buffers.push(data);
        return;
      }
      switch (typeof data) {
        case "string":
          encode.bytes(buffers, data);
          break;
        case "number":
          encode.number(buffers, data);
          break;
        case "object":
          data.constructor === Array ? encode.list(buffers, data) : encode.dict(buffers, data);
          break;
      }
    };
    var buff_e = new Buffer("e");
    var buff_d = new Buffer("d");
    var buff_l = new Buffer("l");
    encode.bytes = function(buffers, data) {
      buffers.push(new Buffer(Buffer.byteLength(data) + ":" + data));
    };
    encode.number = function(buffers, data) {
      var maxLo = 2147483648;
      var hi = data / maxLo << 0;
      var lo = data % maxLo << 0;
      var val = hi * maxLo + lo;
      buffers.push(new Buffer("i" + val + "e"));
      if (val !== data && !encode._floatConversionDetected) {
        encode._floatConversionDetected = true;
        console.warn(
          'WARNING: Possible data corruption detected with value "' + data + '":',
          'Bencoding only defines support for integers, value was converted to "' + val + '"'
        );
        console.trace();
      }
    };
    encode.dict = function(buffers, data) {
      buffers.push(buff_d);
      var j = 0;
      var k;
      var keys = Object.keys(data).sort();
      var kl = keys.length;
      for (; j < kl; j++) {
        k = keys[j];
        encode.bytes(buffers, k);
        encode._encode(buffers, data[k]);
      }
      buffers.push(buff_e);
    };
    encode.list = function(buffers, data) {
      var i = 0, j = 1;
      var c = data.length;
      buffers.push(buff_l);
      for (; i < c; i++) {
        encode._encode(buffers, data[i]);
      }
      buffers.push(buff_e);
    };
    module2.exports = encode;
  }
});

// node_modules/bencode/lib/dict.js
var require_dict = __commonJS({
  "node_modules/bencode/lib/dict.js"(exports2, module2) {
    var Dict = module2.exports = function Dict2() {
      Object.defineProperty(this, "_keys", {
        enumerable: false,
        value: []
      });
    };
    Dict.prototype.binaryKeys = function binaryKeys() {
      return this._keys.slice();
    };
    Dict.prototype.binarySet = function binarySet(key, value) {
      this._keys.push(key);
      this[key] = value;
    };
  }
});

// node_modules/bencode/lib/decode.js
var require_decode = __commonJS({
  "node_modules/bencode/lib/decode.js"(exports2, module2) {
    var Dict = require_dict();
    function decode(data, encoding) {
      decode.position = 0;
      decode.encoding = encoding || null;
      decode.data = !Buffer.isBuffer(data) ? new Buffer(data) : data;
      return decode.next();
    }
    decode.position = 0;
    decode.data = null;
    decode.encoding = null;
    decode.next = function() {
      switch (decode.data[decode.position]) {
        case 100:
          return decode.dictionary();
          break;
        case 108:
          return decode.list();
          break;
        case 105:
          return decode.integer();
          break;
        default:
          return decode.bytes();
          break;
      }
    };
    decode.find = function(chr) {
      var i = decode.position;
      var c = decode.data.length;
      var d = decode.data;
      while (i < c) {
        if (d[i] === chr)
          return i;
        i++;
      }
      throw new Error(
        'Invalid data: Missing delimiter "' + String.fromCharCode(chr) + '" [0x' + chr.toString(16) + "]"
      );
    };
    decode.dictionary = function() {
      decode.position++;
      var dict = new Dict();
      while (decode.data[decode.position] !== 101) {
        dict.binarySet(decode.bytes(), decode.next());
      }
      decode.position++;
      return dict;
    };
    decode.list = function() {
      decode.position++;
      var lst = [];
      while (decode.data[decode.position] !== 101) {
        lst.push(decode.next());
      }
      decode.position++;
      return lst;
    };
    decode.integer = function() {
      var end = decode.find(101);
      var number = decode.data.toString("ascii", decode.position + 1, end);
      decode.position += end + 1 - decode.position;
      return parseInt(number, 10);
    };
    decode.bytes = function() {
      var sep = decode.find(58);
      var length = parseInt(decode.data.toString("ascii", decode.position, sep), 10);
      var end = ++sep + length;
      decode.position = end;
      return decode.encoding ? decode.data.toString(decode.encoding, sep, end) : decode.data.slice(sep, end);
    };
    module2.exports = decode;
  }
});

// node_modules/bencode/bencode.js
var require_bencode2 = __commonJS({
  "node_modules/bencode/bencode.js"(exports2, module2) {
    module2.exports = {
      encode: require_encode(),
      decode: require_decode()
    };
  }
});

// node_modules/simple-sha1/index.js
var require_simple_sha1 = __commonJS({
  "node_modules/simple-sha1/index.js"(exports2, module2) {
    var crypto = require("crypto");
    function sha1(buf, cb) {
      var hash = sha1sync(buf);
      process.nextTick(function() {
        cb(hash);
      });
    }
    function sha1sync(buf) {
      return crypto.createHash("sha1").update(buf).digest("hex");
    }
    module2.exports = sha1;
    module2.exports.sync = sha1sync;
  }
});

// node_modules/parse-torrent-file/index.js
var require_parse_torrent_file = __commonJS({
  "node_modules/parse-torrent-file/index.js"(exports2, module2) {
    module2.exports = decodeTorrentFile;
    module2.exports.decode = decodeTorrentFile;
    module2.exports.encode = encodeTorrentFile;
    var bencode = require_bencode2();
    var path2 = require("path");
    var sha1 = require_simple_sha1();
    function decodeTorrentFile(torrent) {
      if (Buffer.isBuffer(torrent)) {
        torrent = bencode.decode(torrent);
      }
      ensure(torrent.info, "info");
      ensure(torrent.info.name, "info.name");
      ensure(torrent.info["piece length"], "info['piece length']");
      ensure(torrent.info.pieces, "info.pieces");
      if (torrent.info.files) {
        torrent.info.files.forEach(function(file) {
          ensure(typeof file.length === "number", "info.files[0].length");
          ensure(file.path, "info.files[0].path");
        });
      } else {
        ensure(typeof torrent.info.length === "number", "info.length");
      }
      var result = {};
      result.info = torrent.info;
      result.infoBuffer = bencode.encode(torrent.info);
      result.infoHash = sha1.sync(result.infoBuffer);
      result.name = torrent.info.name.toString();
      result.private = !!torrent.info.private;
      if (torrent["creation date"]) result.created = new Date(torrent["creation date"] * 1e3);
      if (Buffer.isBuffer(torrent.comment)) result.comment = torrent.comment.toString();
      var announce = torrent["announce-list"];
      if (!announce) {
        if (torrent.announce) {
          announce = [[torrent.announce]];
        } else {
          announce = [];
        }
      }
      if (!Array.isArray(announce)) announce = [];
      result.announceList = announce.map(function(urls) {
        return urls.map(function(url) {
          return url.toString();
        });
      });
      result.announce = [].concat.apply([], result.announceList);
      if (Buffer.isBuffer(torrent["url-list"])) {
        torrent["url-list"] = torrent["url-list"].length > 0 ? [torrent["url-list"]] : [];
      }
      result.urlList = (torrent["url-list"] || []).map(function(url) {
        return url.toString();
      });
      var files = torrent.info.files || [torrent.info];
      result.files = files.map(function(file, i) {
        var parts = [].concat(file.name || result.name, file.path || []).map(function(p) {
          return p.toString();
        });
        return {
          path: path2.join.apply(null, [path2.sep].concat(parts)).slice(1),
          name: parts[parts.length - 1],
          length: file.length,
          offset: files.slice(0, i).reduce(sumLength, 0)
        };
      });
      result.length = files.reduce(sumLength, 0);
      var lastFile = result.files[result.files.length - 1];
      result.pieceLength = torrent.info["piece length"];
      result.lastPieceLength = (lastFile.offset + lastFile.length) % result.pieceLength || result.pieceLength;
      result.pieces = splitPieces(torrent.info.pieces);
      return result;
    }
    function encodeTorrentFile(parsed) {
      var torrent = {
        info: parsed.info
      };
      if (parsed.announce && parsed.announce[0]) {
        torrent.announce = parsed.announce[0];
      }
      if (parsed.announceList) {
        torrent["announce-list"] = parsed.announceList.map(function(urls) {
          return urls.map(function(url) {
            url = new Buffer(url, "utf8");
            if (!torrent.announce) {
              torrent.announce = url;
            }
            return url;
          });
        });
      }
      if (parsed.created) {
        torrent["creation date"] = parsed.created.getTime() / 1e3 | 0;
      }
      return bencode.encode(torrent);
    }
    function sumLength(sum, file) {
      return sum + file.length;
    }
    function splitPieces(buf) {
      var pieces = [];
      for (var i = 0; i < buf.length; i += 20) {
        pieces.push(buf.slice(i, i + 20).toString("hex"));
      }
      return pieces;
    }
    function ensure(bool, fieldName) {
      if (!bool) throw new Error("Torrent is missing required field: " + fieldName);
    }
  }
});

// node_modules/parse-torrent/index.js
var require_parse_torrent = __commonJS({
  "node_modules/parse-torrent/index.js"(exports2, module2) {
    var magnet = require_magnet_uri();
    var parseTorrentFile = require_parse_torrent_file();
    module2.exports = function parseTorrent(torrentId) {
      var len = torrentId && torrentId.length;
      if (typeof torrentId === "string" && /magnet:/.test(torrentId)) {
        return magnet(torrentId);
      } else if (typeof torrentId === "string" && (len === 40 || len === 32)) {
        return magnet("magnet:?xt=urn:btih:" + torrentId);
      } else if (Buffer.isBuffer(torrentId) && len === 20) {
        return magnet("magnet:?xt=urn:btih:" + torrentId.toString("hex"));
      } else if (Buffer.isBuffer(torrentId)) {
        return parseTorrentFile(torrentId);
      } else if (torrentId && torrentId.infoHash) {
        return torrentId;
      } else {
        throw new Error("Invalid torrent identifier");
      }
    };
    module2.exports.toMagnetURI = magnet.encode;
    module2.exports.toTorrentFile = parseTorrentFile.encode;
  }
});

// node_modules/mkdirp/index.js
var require_mkdirp = __commonJS({
  "node_modules/mkdirp/index.js"(exports2, module2) {
    var path2 = require("path");
    var fs2 = require("fs");
    module2.exports = mkdirP.mkdirp = mkdirP.mkdirP = mkdirP;
    function mkdirP(p, mode, f, made) {
      if (typeof mode === "function" || mode === void 0) {
        f = mode;
        mode = 511 & ~process.umask();
      }
      if (!made) made = null;
      var cb = f || function() {
      };
      if (typeof mode === "string") mode = parseInt(mode, 8);
      p = path2.resolve(p);
      fs2.mkdir(p, mode, function(er) {
        if (!er) {
          made = made || p;
          return cb(null, made);
        }
        switch (er.code) {
          case "ENOENT":
            mkdirP(path2.dirname(p), mode, function(er2, made2) {
              if (er2) cb(er2, made2);
              else mkdirP(p, mode, cb, made2);
            });
            break;
          // In the case of any other error, just see if there's a dir
          // there already.  If so, then hooray!  If not, then something
          // is borked.
          default:
            fs2.stat(p, function(er2, stat) {
              if (er2 || !stat.isDirectory()) cb(er, made);
              else cb(null, made);
            });
            break;
        }
      });
    }
    mkdirP.sync = function sync(p, mode, made) {
      if (mode === void 0) {
        mode = 511 & ~process.umask();
      }
      if (!made) made = null;
      if (typeof mode === "string") mode = parseInt(mode, 8);
      p = path2.resolve(p);
      try {
        fs2.mkdirSync(p, mode);
        made = made || p;
      } catch (err0) {
        switch (err0.code) {
          case "ENOENT":
            made = sync(path2.dirname(p), mode, made);
            sync(p, mode, made);
            break;
          // In the case of any other error, just see if there's a dir
          // there already.  If so, then hooray!  If not, then something
          // is borked.
          default:
            var stat;
            try {
              stat = fs2.statSync(p);
            } catch (err1) {
              throw err0;
            }
            if (!stat.isDirectory()) throw err0;
            break;
        }
      }
      return made;
    };
  }
});

// node_modules/end-of-stream/index.js
var require_end_of_stream = __commonJS({
  "node_modules/end-of-stream/index.js"(exports2, module2) {
    var once = require_once();
    var noop = function() {
    };
    var isRequest = function(stream) {
      return stream.setHeader && typeof stream.abort === "function";
    };
    var eos = function(stream, opts, callback) {
      if (typeof opts === "function") return eos(stream, null, opts);
      if (!opts) opts = {};
      callback = once(callback || noop);
      var ws = stream._writableState;
      var rs = stream._readableState;
      var readable = opts.readable || opts.readable !== false && stream.readable;
      var writable2 = opts.writable || opts.writable !== false && stream.writable;
      var onlegacyfinish = function() {
        if (!stream.writable) onfinish();
      };
      var onfinish = function() {
        writable2 = false;
        if (!readable) callback();
      };
      var onend = function() {
        readable = false;
        if (!writable2) callback();
      };
      var onclose = function() {
        if (readable && !(rs && rs.ended)) return callback(new Error("premature close"));
        if (writable2 && !(ws && ws.ended)) return callback(new Error("premature close"));
      };
      var onrequest = function() {
        stream.req.on("finish", onfinish);
      };
      if (isRequest(stream)) {
        stream.on("complete", onfinish);
        stream.on("abort", onclose);
        if (stream.req) onrequest();
        else stream.on("request", onrequest);
      } else if (writable2 && !ws) {
        stream.on("end", onlegacyfinish);
        stream.on("close", onlegacyfinish);
      }
      stream.on("end", onend);
      stream.on("finish", onfinish);
      if (opts.error !== false) stream.on("error", callback);
      stream.on("close", onclose);
      return stream;
    };
    module2.exports = eos;
  }
});

// node_modules/torrent-piece/index.js
var require_torrent_piece = __commonJS({
  "node_modules/torrent-piece/index.js"(exports2, module2) {
    module2.exports = Piece;
    var BLOCK_LENGTH = 1 << 14;
    function Piece(length) {
      if (!(this instanceof Piece)) return new Piece(length);
      this.length = length;
      this.missing = length;
      this.sources = null;
      this._chunks = Math.ceil(length / BLOCK_LENGTH);
      this._remainder = length % BLOCK_LENGTH || BLOCK_LENGTH;
      this._buffered = 0;
      this._buffer = null;
      this._cancellations = null;
      this._reservations = 0;
      this._flushed = false;
    }
    Piece.BLOCK_LENGTH = BLOCK_LENGTH;
    Piece.prototype.chunkLength = function(i) {
      return i === this._chunks - 1 ? this._remainder : BLOCK_LENGTH;
    };
    Piece.prototype.chunkLengthRemaining = function(i) {
      return this.length - i * BLOCK_LENGTH;
    };
    Piece.prototype.chunkOffset = function(i) {
      return i * BLOCK_LENGTH;
    };
    Piece.prototype.reserve = function() {
      if (!this.init()) return -1;
      if (this._cancellations.length) return this._cancellations.pop();
      if (this._reservations < this._chunks) return this._reservations++;
      return -1;
    };
    Piece.prototype.reserveRemaining = function() {
      if (!this.init()) return -1;
      if (this._reservations < this._chunks) {
        var min = this._reservations;
        this._reservations = this._chunks;
        return min;
      }
      return -1;
    };
    Piece.prototype.cancel = function(i) {
      if (!this.init()) return;
      this._cancellations.push(i);
    };
    Piece.prototype.cancelRemaining = function(i) {
      if (!this.init()) return;
      this._reservations = i;
    };
    Piece.prototype.get = function(i) {
      if (!this.init()) return null;
      return this._buffer[i];
    };
    Piece.prototype.set = function(i, data, source) {
      if (!this.init()) return false;
      var len = data.length;
      var blocks = Math.ceil(len / BLOCK_LENGTH);
      for (var j = 0; j < blocks; j++) {
        if (!this._buffer[i + j]) {
          var offset = j * BLOCK_LENGTH;
          var splitData = data.slice(offset, offset + BLOCK_LENGTH);
          this._buffered++;
          this._buffer[i + j] = splitData;
          this.missing -= splitData.length;
          if (this.sources.indexOf(source) === -1) {
            this.sources.push(source);
          }
        }
      }
      return this._buffered === this._chunks;
    };
    Piece.prototype.flush = function() {
      if (!this._buffer || this._chunks !== this._buffered) return null;
      var buffer = Buffer.concat(this._buffer, this.length);
      this._buffer = null;
      this._cancellations = null;
      this.sources = null;
      this._flushed = true;
      return buffer;
    };
    Piece.prototype.init = function() {
      if (this._flushed) return false;
      if (this._buffer) return true;
      this._buffer = new Array(this._chunks);
      this._cancellations = [];
      this.sources = [];
      return true;
    };
  }
});

// node_modules/fs.realpath/old.js
var require_old = __commonJS({
  "node_modules/fs.realpath/old.js"(exports2) {
    var pathModule = require("path");
    var isWindows = process.platform === "win32";
    var fs2 = require("fs");
    var DEBUG = process.env.NODE_DEBUG && /fs/.test(process.env.NODE_DEBUG);
    function rethrow() {
      var callback;
      if (DEBUG) {
        var backtrace = new Error();
        callback = debugCallback;
      } else
        callback = missingCallback;
      return callback;
      function debugCallback(err) {
        if (err) {
          backtrace.message = err.message;
          err = backtrace;
          missingCallback(err);
        }
      }
      function missingCallback(err) {
        if (err) {
          if (process.throwDeprecation)
            throw err;
          else if (!process.noDeprecation) {
            var msg = "fs: missing callback " + (err.stack || err.message);
            if (process.traceDeprecation)
              console.trace(msg);
            else
              console.error(msg);
          }
        }
      }
    }
    function maybeCallback(cb) {
      return typeof cb === "function" ? cb : rethrow();
    }
    var normalize = pathModule.normalize;
    if (isWindows) {
      nextPartRe = /(.*?)(?:[\/\\]+|$)/g;
    } else {
      nextPartRe = /(.*?)(?:[\/]+|$)/g;
    }
    var nextPartRe;
    if (isWindows) {
      splitRootRe = /^(?:[a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/][^\\\/]+)?[\\\/]*/;
    } else {
      splitRootRe = /^[\/]*/;
    }
    var splitRootRe;
    exports2.realpathSync = function realpathSync(p, cache) {
      p = pathModule.resolve(p);
      if (cache && Object.prototype.hasOwnProperty.call(cache, p)) {
        return cache[p];
      }
      var original = p, seenLinks = {}, knownHard = {};
      var pos;
      var current2;
      var base;
      var previous;
      start();
      function start() {
        var m = splitRootRe.exec(p);
        pos = m[0].length;
        current2 = m[0];
        base = m[0];
        previous = "";
        if (isWindows && !knownHard[base]) {
          fs2.lstatSync(base);
          knownHard[base] = true;
        }
      }
      while (pos < p.length) {
        nextPartRe.lastIndex = pos;
        var result = nextPartRe.exec(p);
        previous = current2;
        current2 += result[0];
        base = previous + result[1];
        pos = nextPartRe.lastIndex;
        if (knownHard[base] || cache && cache[base] === base) {
          continue;
        }
        var resolvedLink;
        if (cache && Object.prototype.hasOwnProperty.call(cache, base)) {
          resolvedLink = cache[base];
        } else {
          var stat = fs2.lstatSync(base);
          if (!stat.isSymbolicLink()) {
            knownHard[base] = true;
            if (cache) cache[base] = base;
            continue;
          }
          var linkTarget = null;
          if (!isWindows) {
            var id = stat.dev.toString(32) + ":" + stat.ino.toString(32);
            if (seenLinks.hasOwnProperty(id)) {
              linkTarget = seenLinks[id];
            }
          }
          if (linkTarget === null) {
            fs2.statSync(base);
            linkTarget = fs2.readlinkSync(base);
          }
          resolvedLink = pathModule.resolve(previous, linkTarget);
          if (cache) cache[base] = resolvedLink;
          if (!isWindows) seenLinks[id] = linkTarget;
        }
        p = pathModule.resolve(resolvedLink, p.slice(pos));
        start();
      }
      if (cache) cache[original] = p;
      return p;
    };
    exports2.realpath = function realpath(p, cache, cb) {
      if (typeof cb !== "function") {
        cb = maybeCallback(cache);
        cache = null;
      }
      p = pathModule.resolve(p);
      if (cache && Object.prototype.hasOwnProperty.call(cache, p)) {
        return process.nextTick(cb.bind(null, null, cache[p]));
      }
      var original = p, seenLinks = {}, knownHard = {};
      var pos;
      var current2;
      var base;
      var previous;
      start();
      function start() {
        var m = splitRootRe.exec(p);
        pos = m[0].length;
        current2 = m[0];
        base = m[0];
        previous = "";
        if (isWindows && !knownHard[base]) {
          fs2.lstat(base, function(err) {
            if (err) return cb(err);
            knownHard[base] = true;
            LOOP();
          });
        } else {
          process.nextTick(LOOP);
        }
      }
      function LOOP() {
        if (pos >= p.length) {
          if (cache) cache[original] = p;
          return cb(null, p);
        }
        nextPartRe.lastIndex = pos;
        var result = nextPartRe.exec(p);
        previous = current2;
        current2 += result[0];
        base = previous + result[1];
        pos = nextPartRe.lastIndex;
        if (knownHard[base] || cache && cache[base] === base) {
          return process.nextTick(LOOP);
        }
        if (cache && Object.prototype.hasOwnProperty.call(cache, base)) {
          return gotResolvedLink(cache[base]);
        }
        return fs2.lstat(base, gotStat);
      }
      function gotStat(err, stat) {
        if (err) return cb(err);
        if (!stat.isSymbolicLink()) {
          knownHard[base] = true;
          if (cache) cache[base] = base;
          return process.nextTick(LOOP);
        }
        if (!isWindows) {
          var id = stat.dev.toString(32) + ":" + stat.ino.toString(32);
          if (seenLinks.hasOwnProperty(id)) {
            return gotTarget(null, seenLinks[id], base);
          }
        }
        fs2.stat(base, function(err2) {
          if (err2) return cb(err2);
          fs2.readlink(base, function(err3, target) {
            if (!isWindows) seenLinks[id] = target;
            gotTarget(err3, target);
          });
        });
      }
      function gotTarget(err, target, base2) {
        if (err) return cb(err);
        var resolvedLink = pathModule.resolve(previous, target);
        if (cache) cache[base2] = resolvedLink;
        gotResolvedLink(resolvedLink);
      }
      function gotResolvedLink(resolvedLink) {
        p = pathModule.resolve(resolvedLink, p.slice(pos));
        start();
      }
    };
  }
});

// node_modules/fs.realpath/index.js
var require_fs = __commonJS({
  "node_modules/fs.realpath/index.js"(exports2, module2) {
    module2.exports = realpath;
    realpath.realpath = realpath;
    realpath.sync = realpathSync;
    realpath.realpathSync = realpathSync;
    realpath.monkeypatch = monkeypatch;
    realpath.unmonkeypatch = unmonkeypatch;
    var fs2 = require("fs");
    var origRealpath = fs2.realpath;
    var origRealpathSync = fs2.realpathSync;
    var version = process.version;
    var ok = /^v[0-5]\./.test(version);
    var old = require_old();
    function newError(er) {
      return er && er.syscall === "realpath" && (er.code === "ELOOP" || er.code === "ENOMEM" || er.code === "ENAMETOOLONG");
    }
    function realpath(p, cache, cb) {
      if (ok) {
        return origRealpath(p, cache, cb);
      }
      if (typeof cache === "function") {
        cb = cache;
        cache = null;
      }
      origRealpath(p, cache, function(er, result) {
        if (newError(er)) {
          old.realpath(p, cache, cb);
        } else {
          cb(er, result);
        }
      });
    }
    function realpathSync(p, cache) {
      if (ok) {
        return origRealpathSync(p, cache);
      }
      try {
        return origRealpathSync(p, cache);
      } catch (er) {
        if (newError(er)) {
          return old.realpathSync(p, cache);
        } else {
          throw er;
        }
      }
    }
    function monkeypatch() {
      fs2.realpath = realpath;
      fs2.realpathSync = realpathSync;
    }
    function unmonkeypatch() {
      fs2.realpath = origRealpath;
      fs2.realpathSync = origRealpathSync;
    }
  }
});

// node_modules/concat-map/index.js
var require_concat_map = __commonJS({
  "node_modules/concat-map/index.js"(exports2, module2) {
    module2.exports = function(xs, fn) {
      var res = [];
      for (var i = 0; i < xs.length; i++) {
        var x = fn(xs[i], i);
        if (isArray(x)) res.push.apply(res, x);
        else res.push(x);
      }
      return res;
    };
    var isArray = Array.isArray || function(xs) {
      return Object.prototype.toString.call(xs) === "[object Array]";
    };
  }
});

// node_modules/balanced-match/index.js
var require_balanced_match = __commonJS({
  "node_modules/balanced-match/index.js"(exports2, module2) {
    "use strict";
    module2.exports = balanced;
    function balanced(a, b, str) {
      if (a instanceof RegExp) a = maybeMatch(a, str);
      if (b instanceof RegExp) b = maybeMatch(b, str);
      var r = range(a, b, str);
      return r && {
        start: r[0],
        end: r[1],
        pre: str.slice(0, r[0]),
        body: str.slice(r[0] + a.length, r[1]),
        post: str.slice(r[1] + b.length)
      };
    }
    function maybeMatch(reg, str) {
      var m = str.match(reg);
      return m ? m[0] : null;
    }
    balanced.range = range;
    function range(a, b, str) {
      var begs, beg, left, right, result;
      var ai = str.indexOf(a);
      var bi = str.indexOf(b, ai + 1);
      var i = ai;
      if (ai >= 0 && bi > 0) {
        if (a === b) {
          return [ai, bi];
        }
        begs = [];
        left = str.length;
        while (i >= 0 && !result) {
          if (i == ai) {
            begs.push(i);
            ai = str.indexOf(a, i + 1);
          } else if (begs.length == 1) {
            result = [begs.pop(), bi];
          } else {
            beg = begs.pop();
            if (beg < left) {
              left = beg;
              right = bi;
            }
            bi = str.indexOf(b, i + 1);
          }
          i = ai < bi && ai >= 0 ? ai : bi;
        }
        if (begs.length) {
          result = [left, right];
        }
      }
      return result;
    }
  }
});

// node_modules/brace-expansion/index.js
var require_brace_expansion = __commonJS({
  "node_modules/brace-expansion/index.js"(exports2, module2) {
    var concatMap = require_concat_map();
    var balanced = require_balanced_match();
    module2.exports = expandTop;
    var escSlash = "\0SLASH" + Math.random().toFixed(16) + "\0";
    var escOpen = "\0OPEN" + Math.random().toFixed(16) + "\0";
    var escClose = "\0CLOSE" + Math.random().toFixed(16) + "\0";
    var escComma = "\0COMMA" + Math.random().toFixed(16) + "\0";
    var escPeriod = "\0PERIOD" + Math.random().toFixed(16) + "\0";
    var EXPANSION_MAX = 1e5;
    var EXPANSION_MAX_LENGTH = 4e6;
    var EXPANSION_MAX_DEPTH = 1e3;
    var EXPANSION_MAX_REWRITES = 1e3;
    var EXPANSION_MAX_STEPS = 2e7;
    var CALL_STEPS = 16;
    function numeric(str) {
      return parseInt(str, 10) == str ? parseInt(str, 10) : str.charCodeAt(0);
    }
    function escapeBraces(str) {
      return str.split("\\\\").join(escSlash).split("\\{").join(escOpen).split("\\}").join(escClose).split("\\,").join(escComma).split("\\.").join(escPeriod);
    }
    function unescapeBraces(str) {
      return str.split(escSlash).join("\\").split(escOpen).join("{").split(escClose).join("}").split(escComma).join(",").split(escPeriod).join(".");
    }
    function pushAll(target, items) {
      for (var i = 0; i < items.length; i++) {
        target.push(items[i]);
      }
    }
    function balancedWithBudget(str, masked, budget) {
      if (budget.remaining < 0) {
        return void 0;
      }
      var r = balanced.range("{", "}", masked);
      var unmatched = r !== void 0 && masked.indexOf("{") < r[0];
      budget.remaining -= r && !unmatched ? r[1] + 1 : str.length;
      if (!r || budget.remaining < 0) {
        return void 0;
      }
      return {
        end: r[1],
        pre: str.slice(0, r[0]),
        body: str.slice(r[0] + 1, r[1]),
        post: str.slice(r[1] + 1),
        unmatched
      };
    }
    function maskUnmatchedOpens(masked, budget) {
      budget.remaining -= masked.length;
      var open2 = [];
      for (var i = 0; i < masked.length; i++) {
        var c = masked.charCodeAt(i);
        if (c === 123) {
          open2.push(i);
        } else if (c === 125 && open2.length) {
          open2.pop();
        }
      }
      var out = "";
      var last = 0;
      for (var j = 0; j < open2.length; j++) {
        out += masked.slice(last, open2[j]) + "\0";
        last = open2[j] + 1;
      }
      return out + masked.slice(last);
    }
    function commaSetFollows(str, budget) {
      budget.remaining -= str.length;
      if (budget.remaining < 0) {
        return false;
      }
      var close = false;
      for (var i = str.length - 1; i >= 0; i--) {
        var c = str.charCodeAt(i);
        if (c === 125) {
          close = true;
        } else if (c === 10 || c === 13 || c === 8232 || c === 8233) {
          close = false;
        } else if (c === 44 && close && str.charCodeAt(i + 1) !== 44) {
          return true;
        }
      }
      return false;
    }
    function parseCommaParts(str, budget) {
      var parts = [];
      var carry = "";
      for (; ; ) {
        var m = balancedWithBudget(str, str, budget);
        if (budget.remaining < 0) {
          return void 0;
        }
        if (!m) {
          var tail = str.split(",");
          tail[0] = carry + tail[0];
          pushAll(parts, tail);
          return parts;
        }
        var pre = m.pre;
        var body = m.body;
        var post = m.post;
        var p = pre.split(",");
        p[0] = carry + p[0];
        p[p.length - 1] += "{" + body + "}";
        if (!post.length) {
          pushAll(parts, p);
          return parts;
        }
        carry = p.pop();
        pushAll(parts, p);
        str = post;
      }
    }
    function bound(value, fallback) {
      return value == null || isNaN(value) ? fallback : value;
    }
    function expandTop(str, options) {
      if (!str) return [];
      options = options || {};
      var max = bound(options.max, EXPANSION_MAX);
      var maxLength = bound(options.maxLength, EXPANSION_MAX_LENGTH);
      var maxDepth = bound(options.maxDepth, EXPANSION_MAX_DEPTH);
      var maxRewrites = bound(options.maxRewrites, EXPANSION_MAX_REWRITES);
      var maxSteps = bound(options.maxSteps, EXPANSION_MAX_STEPS);
      if (str.substr(0, 2) === "{}") {
        str = "\\{\\}" + str.substr(2);
      }
      return expand(
        escapeBraces(str),
        max,
        maxLength,
        maxDepth,
        0,
        maxRewrites,
        { remaining: maxSteps },
        true
      ).map(unescapeBraces);
    }
    function embrace(str) {
      return "{" + str + "}";
    }
    function isPadded(el) {
      return /^-?0\d/.test(el);
    }
    function lte(i, y) {
      return i <= y;
    }
    function gte(i, y) {
      return i >= y;
    }
    function combine(acc, base, pre, values, max, maxLength, dropEmpties, outBase, budget) {
      var out = [];
      var length = 0;
      var nonEmpty;
      outer: for (var a = 0; a < acc.length; a++) {
        var prefix = acc[a] + pre;
        var vs = values;
        if (dropEmpties && prefix.length === base[a]) {
          if (!nonEmpty) nonEmpty = values.filter(Boolean);
          vs = nonEmpty;
        }
        for (var v = 0; v < vs.length; v++) {
          if (out.length >= max) break outer;
          var expansion = prefix + vs[v];
          if (length + expansion.length > maxLength) break outer;
          out.push(expansion);
          outBase.push(base[a]);
          length += expansion.length;
        }
      }
      budget.remaining -= out.length;
      return out;
    }
    function expandSequence(body, isAlphaSequence, max, maxLength, budget) {
      var n = body.split(/\.\./);
      var N = [];
      if (n[0] === void 0 || n[1] === void 0) {
        return N;
      }
      var x = numeric(n[0]);
      var y = numeric(n[1]);
      var width = Math.max(n[0].length, n[1].length);
      var incr = n.length === 3 && n[2] !== void 0 ? Math.max(Math.abs(numeric(n[2])), 1) : 1;
      var test = lte;
      var reverse = y < x;
      if (reverse) {
        incr *= -1;
        test = gte;
      }
      var pad = n.some(isPadded);
      var cost = pad ? width : 1;
      var length = 0;
      for (var i = x; test(i, y) && N.length < max; i += incr) {
        budget.remaining -= cost;
        if (budget.remaining < 0) {
          return void 0;
        }
        var c;
        if (isAlphaSequence) {
          c = String.fromCharCode(i);
          if (c === "\\") {
            c = "";
          }
        } else {
          c = String(i);
          if (pad) {
            var need = width - c.length;
            if (need > 0) {
              var z = new Array(need + 1).join("0");
              if (i < 0) {
                c = "-" + z + c.slice(1);
              } else {
                c = z + c;
              }
            }
          }
        }
        if (length + c.length > maxLength) break;
        N.push(c);
        length += c.length;
      }
      return N;
    }
    function expand(str, max, maxLength, maxDepth, depth, maxRewrites, budget, isTop) {
      budget.remaining -= CALL_STEPS;
      if (depth > maxDepth) {
        return [str];
      }
      var acc = [""];
      var accBase = [0];
      var rewrites = 0;
      var dropEmpties = false;
      var firstGroup = true;
      var masked = str;
      var nextBase;
      for (; ; ) {
        var m = balancedWithBudget(str, masked, budget);
        if (!m) {
          return combine(
            acc,
            accBase,
            str,
            [""],
            max,
            maxLength,
            dropEmpties,
            [],
            budget
          );
        }
        if (m.unmatched) {
          masked = maskUnmatchedOpens(masked, budget);
        }
        var pre = m.pre;
        var literal = function() {
          return combine(
            acc,
            accBase,
            pre + "{" + m.body + "}" + m.post,
            [""],
            max,
            maxLength,
            dropEmpties,
            [],
            budget
          );
        };
        if (/\$$/.test(pre)) {
          return combine(
            acc,
            accBase,
            str,
            [""],
            max,
            maxLength,
            dropEmpties,
            [],
            budget
          );
        }
        var isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
        var isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(
          m.body
        );
        var isSequence = isNumericSequence || isAlphaSequence;
        var isOptions = m.body.indexOf(",") >= 0;
        if (!isSequence && !isOptions) {
          if (rewrites < maxRewrites && commaSetFollows(m.post, budget)) {
            rewrites++;
            str = m.pre + "{" + m.body + escClose + m.post;
            masked = masked.slice(0, m.end) + escClose + masked.slice(m.end + 1);
            isTop = true;
            firstGroup = true;
            dropEmpties = false;
            accBase = [];
            for (var b = 0; b < acc.length; b++) {
              accBase.push(acc[b].length);
            }
            continue;
          }
          return literal();
        }
        if (firstGroup) {
          dropEmpties = isTop && !isSequence;
          firstGroup = false;
        }
        var values;
        if (isSequence) {
          values = expandSequence(
            m.body,
            isAlphaSequence,
            max,
            maxLength,
            budget
          );
          if (!values) {
            return literal();
          }
        } else {
          var n = parseCommaParts(m.body, budget);
          if (!n) {
            return literal();
          }
          if (n.length === 1 && n[0] !== void 0) {
            n = expand(
              n[0],
              max,
              maxLength,
              maxDepth,
              depth + 1,
              maxRewrites,
              budget,
              false
            ).map(embrace);
            if (budget.remaining < 0) {
              return literal();
            }
            if (n.length === 1) {
              nextBase = [];
              var single = combine(
                acc,
                accBase,
                pre + n[0],
                [""],
                max,
                maxLength,
                dropEmpties && !m.post.length,
                nextBase,
                budget
              );
              if (budget.remaining < 0) {
                return literal();
              }
              acc = single;
              accBase = nextBase;
              if (!m.post.length) break;
              str = m.post;
              masked = masked.slice(m.end + 1);
              continue;
            }
          }
          var dropsEmpties = dropEmpties && !m.post.length && !pre;
          for (var d = 0; dropsEmpties && d < acc.length; d++) {
            if (acc[d].length !== accBase[d]) {
              dropsEmpties = false;
            }
          }
          values = [];
          var valuesLength = 0;
          outer: for (var j = 0; j < n.length; j++) {
            var expanded = expand(
              n[j],
              max,
              maxLength,
              maxDepth,
              depth + 1,
              maxRewrites,
              budget,
              false
            );
            if (budget.remaining < 0) {
              return literal();
            }
            for (var k = 0; k < expanded.length; k++) {
              var v = expanded[k];
              if (dropsEmpties && !v) continue;
              if (values.length >= max || valuesLength + v.length > maxLength) {
                break outer;
              }
              values.push(v);
              valuesLength += v.length;
            }
          }
        }
        nextBase = [];
        var next = combine(
          acc,
          accBase,
          pre,
          values,
          max,
          maxLength,
          dropEmpties && !m.post.length,
          nextBase,
          budget
        );
        if (budget.remaining < 0) {
          return literal();
        }
        acc = next;
        accBase = nextBase;
        if (!m.post.length) break;
        str = m.post;
        masked = masked.slice(m.end + 1);
      }
      return acc;
    }
  }
});

// node_modules/minimatch/minimatch.js
var require_minimatch = __commonJS({
  "node_modules/minimatch/minimatch.js"(exports2, module2) {
    module2.exports = minimatch;
    minimatch.Minimatch = Minimatch;
    var path2 = (function() {
      try {
        return require("path");
      } catch (e) {
      }
    })() || {
      sep: "/"
    };
    minimatch.sep = path2.sep;
    var GLOBSTAR = minimatch.GLOBSTAR = Minimatch.GLOBSTAR = {};
    var expand = require_brace_expansion();
    var plTypes = {
      "!": { open: "(?:(?!(?:", close: "))[^/]*?)" },
      "?": { open: "(?:", close: ")?" },
      "+": { open: "(?:", close: ")+" },
      "*": { open: "(?:", close: ")*" },
      "@": { open: "(?:", close: ")" }
    };
    var qmark = "[^/]";
    var star = qmark + "*?";
    var twoStarDot = "(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?";
    var twoStarNoDot = "(?:(?!(?:\\/|^)\\.).)*?";
    var reSpecials = charSet("().*{}+?[]^$\\!");
    function charSet(s) {
      return s.split("").reduce(function(set, c) {
        set[c] = true;
        return set;
      }, {});
    }
    var slashSplit = /\/+/;
    minimatch.filter = filter;
    function filter(pattern, options) {
      options = options || {};
      return function(p, i, list) {
        return minimatch(p, pattern, options);
      };
    }
    function ext(a, b) {
      b = b || {};
      var t = {};
      Object.keys(a).forEach(function(k) {
        t[k] = a[k];
      });
      Object.keys(b).forEach(function(k) {
        t[k] = b[k];
      });
      return t;
    }
    minimatch.defaults = function(def) {
      if (!def || typeof def !== "object" || !Object.keys(def).length) {
        return minimatch;
      }
      var orig = minimatch;
      var m = function minimatch2(p, pattern, options) {
        return orig(p, pattern, ext(def, options));
      };
      m.Minimatch = function Minimatch2(pattern, options) {
        return new orig.Minimatch(pattern, ext(def, options));
      };
      m.Minimatch.defaults = function defaults(options) {
        return orig.defaults(ext(def, options)).Minimatch;
      };
      m.filter = function filter2(pattern, options) {
        return orig.filter(pattern, ext(def, options));
      };
      m.defaults = function defaults(options) {
        return orig.defaults(ext(def, options));
      };
      m.makeRe = function makeRe2(pattern, options) {
        return orig.makeRe(pattern, ext(def, options));
      };
      m.braceExpand = function braceExpand2(pattern, options) {
        return orig.braceExpand(pattern, ext(def, options));
      };
      m.match = function(list, pattern, options) {
        return orig.match(list, pattern, ext(def, options));
      };
      return m;
    };
    Minimatch.defaults = function(def) {
      return minimatch.defaults(def).Minimatch;
    };
    function minimatch(p, pattern, options) {
      assertValidPattern(pattern);
      if (!options) options = {};
      if (!options.nocomment && pattern.charAt(0) === "#") {
        return false;
      }
      return new Minimatch(pattern, options).match(p);
    }
    function Minimatch(pattern, options) {
      if (!(this instanceof Minimatch)) {
        return new Minimatch(pattern, options);
      }
      assertValidPattern(pattern);
      if (!options) options = {};
      pattern = pattern.trim();
      if (!options.allowWindowsEscape && path2.sep !== "/") {
        pattern = pattern.split(path2.sep).join("/");
      }
      this.options = options;
      this.maxGlobstarRecursion = options.maxGlobstarRecursion !== void 0 ? options.maxGlobstarRecursion : 200;
      this.set = [];
      this.pattern = pattern;
      this.regexp = null;
      this.negate = false;
      this.comment = false;
      this.empty = false;
      this.partial = !!options.partial;
      this.make();
    }
    Minimatch.prototype.debug = function() {
    };
    Minimatch.prototype.make = make;
    function make() {
      var pattern = this.pattern;
      var options = this.options;
      if (!options.nocomment && pattern.charAt(0) === "#") {
        this.comment = true;
        return;
      }
      if (!pattern) {
        this.empty = true;
        return;
      }
      this.parseNegate();
      var set = this.globSet = this.braceExpand();
      if (options.debug) this.debug = function debug() {
        console.error.apply(console, arguments);
      };
      this.debug(this.pattern, set);
      set = this.globParts = set.map(function(s) {
        return s.split(slashSplit);
      });
      this.debug(this.pattern, set);
      set = set.map(function(s, si, set2) {
        return s.map(this.parse, this);
      }, this);
      this.debug(this.pattern, set);
      set = set.filter(function(s) {
        return s.indexOf(false) === -1;
      });
      this.debug(this.pattern, set);
      this.set = set;
    }
    Minimatch.prototype.parseNegate = parseNegate;
    function parseNegate() {
      var pattern = this.pattern;
      var negate = false;
      var options = this.options;
      var negateOffset = 0;
      if (options.nonegate) return;
      for (var i = 0, l = pattern.length; i < l && pattern.charAt(i) === "!"; i++) {
        negate = !negate;
        negateOffset++;
      }
      if (negateOffset) this.pattern = pattern.substr(negateOffset);
      this.negate = negate;
    }
    minimatch.braceExpand = function(pattern, options) {
      return braceExpand(pattern, options);
    };
    Minimatch.prototype.braceExpand = braceExpand;
    function braceExpand(pattern, options) {
      if (!options) {
        if (this instanceof Minimatch) {
          options = this.options;
        } else {
          options = {};
        }
      }
      pattern = typeof pattern === "undefined" ? this.pattern : pattern;
      assertValidPattern(pattern);
      if (options.nobrace || !/\{(?:(?!\{).)*\}/.test(pattern)) {
        return [pattern];
      }
      return expand(pattern);
    }
    var MAX_PATTERN_LENGTH = 1024 * 64;
    var assertValidPattern = function(pattern) {
      if (typeof pattern !== "string") {
        throw new TypeError("invalid pattern");
      }
      if (pattern.length > MAX_PATTERN_LENGTH) {
        throw new TypeError("pattern is too long");
      }
    };
    Minimatch.prototype.parse = parse;
    var SUBPARSE = {};
    function parse(pattern, isSub) {
      assertValidPattern(pattern);
      var options = this.options;
      if (pattern === "**") {
        if (!options.noglobstar)
          return GLOBSTAR;
        else
          pattern = "*";
      }
      if (pattern === "") return "";
      var re = "";
      var hasMagic = !!options.nocase;
      var escaping = false;
      var patternListStack = [];
      var negativeLists = [];
      var stateChar;
      var inClass = false;
      var reClassStart = -1;
      var classStart = -1;
      var patternStart = pattern.charAt(0) === "." ? "" : options.dot ? "(?!(?:^|\\/)\\.{1,2}(?:$|\\/))" : "(?!\\.)";
      var self2 = this;
      function clearStateChar() {
        if (stateChar) {
          switch (stateChar) {
            case "*":
              re += star;
              hasMagic = true;
              break;
            case "?":
              re += qmark;
              hasMagic = true;
              break;
            default:
              re += "\\" + stateChar;
              break;
          }
          self2.debug("clearStateChar %j %j", stateChar, re);
          stateChar = false;
        }
      }
      for (var i = 0, len = pattern.length, c; i < len && (c = pattern.charAt(i)); i++) {
        this.debug("%s	%s %s %j", pattern, i, re, c);
        if (escaping && reSpecials[c]) {
          re += "\\" + c;
          escaping = false;
          continue;
        }
        switch (c) {
          /* istanbul ignore next */
          case "/": {
            return false;
          }
          case "\\":
            clearStateChar();
            escaping = true;
            continue;
          // the various stateChar values
          // for the "extglob" stuff.
          case "?":
          case "*":
          case "+":
          case "@":
          case "!":
            this.debug("%s	%s %s %j <-- stateChar", pattern, i, re, c);
            if (inClass) {
              this.debug("  in class");
              if (c === "!" && i === classStart + 1) c = "^";
              re += c;
              continue;
            }
            if (c === "*" && stateChar === "*") continue;
            self2.debug("call clearStateChar %j", stateChar);
            clearStateChar();
            stateChar = c;
            if (options.noext) clearStateChar();
            continue;
          case "(":
            if (inClass) {
              re += "(";
              continue;
            }
            if (!stateChar) {
              re += "\\(";
              continue;
            }
            patternListStack.push({
              type: stateChar,
              start: i - 1,
              reStart: re.length,
              open: plTypes[stateChar].open,
              close: plTypes[stateChar].close
            });
            re += stateChar === "!" ? "(?:(?!(?:" : "(?:";
            this.debug("plType %j %j", stateChar, re);
            stateChar = false;
            continue;
          case ")":
            if (inClass || !patternListStack.length) {
              re += "\\)";
              continue;
            }
            clearStateChar();
            hasMagic = true;
            var pl = patternListStack.pop();
            re += pl.close;
            if (pl.type === "!") {
              negativeLists.push(pl);
            }
            pl.reEnd = re.length;
            continue;
          case "|":
            if (inClass || !patternListStack.length || escaping) {
              re += "\\|";
              escaping = false;
              continue;
            }
            clearStateChar();
            re += "|";
            continue;
          // these are mostly the same in regexp and glob
          case "[":
            clearStateChar();
            if (inClass) {
              re += "\\" + c;
              continue;
            }
            inClass = true;
            classStart = i;
            reClassStart = re.length;
            re += c;
            continue;
          case "]":
            if (i === classStart + 1 || !inClass) {
              re += "\\" + c;
              escaping = false;
              continue;
            }
            var cs = pattern.substring(classStart + 1, i);
            try {
              RegExp("[" + cs + "]");
            } catch (er) {
              var sp = this.parse(cs, SUBPARSE);
              re = re.substr(0, reClassStart) + "\\[" + sp[0] + "\\]";
              hasMagic = hasMagic || sp[1];
              inClass = false;
              continue;
            }
            hasMagic = true;
            inClass = false;
            re += c;
            continue;
          default:
            clearStateChar();
            if (escaping) {
              escaping = false;
            } else if (reSpecials[c] && !(c === "^" && inClass)) {
              re += "\\";
            }
            re += c;
        }
      }
      if (inClass) {
        cs = pattern.substr(classStart + 1);
        sp = this.parse(cs, SUBPARSE);
        re = re.substr(0, reClassStart) + "\\[" + sp[0];
        hasMagic = hasMagic || sp[1];
      }
      for (pl = patternListStack.pop(); pl; pl = patternListStack.pop()) {
        var tail = re.slice(pl.reStart + pl.open.length);
        this.debug("setting tail", re, pl);
        tail = tail.replace(/((?:\\{2}){0,64})(\\?)\|/g, function(_, $1, $2) {
          if (!$2) {
            $2 = "\\";
          }
          return $1 + $1 + $2 + "|";
        });
        this.debug("tail=%j\n   %s", tail, tail, pl, re);
        var t = pl.type === "*" ? star : pl.type === "?" ? qmark : "\\" + pl.type;
        hasMagic = true;
        re = re.slice(0, pl.reStart) + t + "\\(" + tail;
      }
      clearStateChar();
      if (escaping) {
        re += "\\\\";
      }
      var addPatternStart = false;
      switch (re.charAt(0)) {
        case "[":
        case ".":
        case "(":
          addPatternStart = true;
      }
      for (var n = negativeLists.length - 1; n > -1; n--) {
        var nl = negativeLists[n];
        var nlBefore = re.slice(0, nl.reStart);
        var nlFirst = re.slice(nl.reStart, nl.reEnd - 8);
        var nlLast = re.slice(nl.reEnd - 8, nl.reEnd);
        var nlAfter = re.slice(nl.reEnd);
        nlLast += nlAfter;
        var openParensBefore = nlBefore.split("(").length - 1;
        var cleanAfter = nlAfter;
        for (i = 0; i < openParensBefore; i++) {
          cleanAfter = cleanAfter.replace(/\)[+*?]?/, "");
        }
        nlAfter = cleanAfter;
        var dollar = "";
        if (nlAfter === "" && isSub !== SUBPARSE) {
          dollar = "$";
        }
        var newRe = nlBefore + nlFirst + nlAfter + dollar + nlLast;
        re = newRe;
      }
      if (re !== "" && hasMagic) {
        re = "(?=.)" + re;
      }
      if (addPatternStart) {
        re = patternStart + re;
      }
      if (isSub === SUBPARSE) {
        return [re, hasMagic];
      }
      if (!hasMagic) {
        return globUnescape(pattern);
      }
      var flags = options.nocase ? "i" : "";
      try {
        var regExp = new RegExp("^" + re + "$", flags);
      } catch (er) {
        return new RegExp("$.");
      }
      regExp._glob = pattern;
      regExp._src = re;
      return regExp;
    }
    minimatch.makeRe = function(pattern, options) {
      return new Minimatch(pattern, options || {}).makeRe();
    };
    Minimatch.prototype.makeRe = makeRe;
    function makeRe() {
      if (this.regexp || this.regexp === false) return this.regexp;
      var set = this.set;
      if (!set.length) {
        this.regexp = false;
        return this.regexp;
      }
      var options = this.options;
      var twoStar = options.noglobstar ? star : options.dot ? twoStarDot : twoStarNoDot;
      var flags = options.nocase ? "i" : "";
      var re = set.map(function(pattern) {
        return pattern.map(function(p) {
          return p === GLOBSTAR ? twoStar : typeof p === "string" ? regExpEscape(p) : p._src;
        }).join("\\/");
      }).join("|");
      re = "^(?:" + re + ")$";
      if (this.negate) re = "^(?!" + re + ").*$";
      try {
        this.regexp = new RegExp(re, flags);
      } catch (ex) {
        this.regexp = false;
      }
      return this.regexp;
    }
    minimatch.match = function(list, pattern, options) {
      options = options || {};
      var mm = new Minimatch(pattern, options);
      list = list.filter(function(f) {
        return mm.match(f);
      });
      if (mm.options.nonull && !list.length) {
        list.push(pattern);
      }
      return list;
    };
    Minimatch.prototype.match = function match(f, partial) {
      if (typeof partial === "undefined") partial = this.partial;
      this.debug("match", f, this.pattern);
      if (this.comment) return false;
      if (this.empty) return f === "";
      if (f === "/" && partial) return true;
      var options = this.options;
      if (path2.sep !== "/") {
        f = f.split(path2.sep).join("/");
      }
      f = f.split(slashSplit);
      this.debug(this.pattern, "split", f);
      var set = this.set;
      this.debug(this.pattern, "set", set);
      var filename;
      var i;
      for (i = f.length - 1; i >= 0; i--) {
        filename = f[i];
        if (filename) break;
      }
      for (i = 0; i < set.length; i++) {
        var pattern = set[i];
        var file = f;
        if (options.matchBase && pattern.length === 1) {
          file = [filename];
        }
        var hit = this.matchOne(file, pattern, partial);
        if (hit) {
          if (options.flipNegate) return true;
          return !this.negate;
        }
      }
      if (options.flipNegate) return false;
      return this.negate;
    };
    Minimatch.prototype.matchOne = function(file, pattern, partial) {
      if (pattern.indexOf(GLOBSTAR) !== -1) {
        return this._matchGlobstar(file, pattern, partial, 0, 0);
      }
      return this._matchOne(file, pattern, partial, 0, 0);
    };
    Minimatch.prototype._matchGlobstar = function(file, pattern, partial, fileIndex, patternIndex) {
      var i;
      var firstgs = -1;
      for (i = patternIndex; i < pattern.length; i++) {
        if (pattern[i] === GLOBSTAR) {
          firstgs = i;
          break;
        }
      }
      var lastgs = -1;
      for (i = pattern.length - 1; i >= 0; i--) {
        if (pattern[i] === GLOBSTAR) {
          lastgs = i;
          break;
        }
      }
      var head = pattern.slice(patternIndex, firstgs);
      var body = partial ? pattern.slice(firstgs + 1) : pattern.slice(firstgs + 1, lastgs);
      var tail = partial ? [] : pattern.slice(lastgs + 1);
      if (head.length) {
        var fileHead = file.slice(fileIndex, fileIndex + head.length);
        if (!this._matchOne(fileHead, head, partial, 0, 0)) {
          return false;
        }
        fileIndex += head.length;
      }
      var fileTailMatch = 0;
      if (tail.length) {
        if (tail.length + fileIndex > file.length) return false;
        var tailStart = file.length - tail.length;
        if (this._matchOne(file, tail, partial, tailStart, 0)) {
          fileTailMatch = tail.length;
        } else {
          if (file[file.length - 1] !== "" || fileIndex + tail.length === file.length) {
            return false;
          }
          tailStart--;
          if (!this._matchOne(file, tail, partial, tailStart, 0)) {
            return false;
          }
          fileTailMatch = tail.length + 1;
        }
      }
      if (!body.length) {
        var sawSome = !!fileTailMatch;
        for (i = fileIndex; i < file.length - fileTailMatch; i++) {
          var f = String(file[i]);
          sawSome = true;
          if (f === "." || f === ".." || !this.options.dot && f.charAt(0) === ".") {
            return false;
          }
        }
        return partial || sawSome;
      }
      var bodySegments = [[[], 0]];
      var currentBody = bodySegments[0];
      var nonGsParts = 0;
      var nonGsPartsSums = [0];
      for (var bi = 0; bi < body.length; bi++) {
        var b = body[bi];
        if (b === GLOBSTAR) {
          nonGsPartsSums.push(nonGsParts);
          currentBody = [[], 0];
          bodySegments.push(currentBody);
        } else {
          currentBody[0].push(b);
          nonGsParts++;
        }
      }
      var idx = bodySegments.length - 1;
      var fileLength = file.length - fileTailMatch;
      for (var si = 0; si < bodySegments.length; si++) {
        bodySegments[si][1] = fileLength - (nonGsPartsSums[idx--] + bodySegments[si][0].length);
      }
      return !!this._matchGlobStarBodySections(
        file,
        bodySegments,
        fileIndex,
        0,
        partial,
        0,
        !!fileTailMatch
      );
    };
    Minimatch.prototype._matchGlobStarBodySections = function(file, bodySegments, fileIndex, bodyIndex, partial, globStarDepth, sawTail) {
      var bs = bodySegments[bodyIndex];
      if (!bs) {
        for (var i = fileIndex; i < file.length; i++) {
          sawTail = true;
          var f = file[i];
          if (f === "." || f === ".." || !this.options.dot && f.charAt(0) === ".") {
            return false;
          }
        }
        return sawTail;
      }
      var body = bs[0];
      var after = bs[1];
      while (fileIndex <= after) {
        var m = this._matchOne(
          file.slice(0, fileIndex + body.length),
          body,
          partial,
          fileIndex,
          0
        );
        if (m && globStarDepth < this.maxGlobstarRecursion) {
          var sub = this._matchGlobStarBodySections(
            file,
            bodySegments,
            fileIndex + body.length,
            bodyIndex + 1,
            partial,
            globStarDepth + 1,
            sawTail
          );
          if (sub !== false) {
            return sub;
          }
        }
        var f = file[fileIndex];
        if (f === "." || f === ".." || !this.options.dot && f.charAt(0) === ".") {
          return false;
        }
        fileIndex++;
      }
      return partial || null;
    };
    Minimatch.prototype._matchOne = function(file, pattern, partial, fileIndex, patternIndex) {
      var fi, pi, fl, pl;
      for (fi = fileIndex, pi = patternIndex, fl = file.length, pl = pattern.length; fi < fl && pi < pl; fi++, pi++) {
        this.debug("matchOne loop");
        var p = pattern[pi];
        var f = file[fi];
        this.debug(pattern, p, f);
        if (p === false || p === GLOBSTAR) return false;
        var hit;
        if (typeof p === "string") {
          hit = f === p;
          this.debug("string match", p, f, hit);
        } else {
          hit = f.match(p);
          this.debug("pattern match", p, f, hit);
        }
        if (!hit) return false;
      }
      if (fi === fl && pi === pl) {
        return true;
      } else if (fi === fl) {
        return partial;
      } else if (pi === pl) {
        return fi === fl - 1 && file[fi] === "";
      }
      throw new Error("wtf?");
    };
    function globUnescape(s) {
      return s.replace(/\\(.)/g, "$1");
    }
    function regExpEscape(s) {
      return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    }
  }
});

// node_modules/path-is-absolute/index.js
var require_path_is_absolute = __commonJS({
  "node_modules/path-is-absolute/index.js"(exports2, module2) {
    "use strict";
    function posix(path2) {
      return path2.charAt(0) === "/";
    }
    function win32(path2) {
      var splitDeviceRe = /^([a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/]+)?([\\\/])?([\s\S]*?)$/;
      var result = splitDeviceRe.exec(path2);
      var device = result[1] || "";
      var isUnc = Boolean(device && device.charAt(1) !== ":");
      return Boolean(result[2] || isUnc);
    }
    module2.exports = process.platform === "win32" ? win32 : posix;
    module2.exports.posix = posix;
    module2.exports.win32 = win32;
  }
});

// node_modules/glob/common.js
var require_common = __commonJS({
  "node_modules/glob/common.js"(exports2) {
    exports2.setopts = setopts;
    exports2.ownProp = ownProp;
    exports2.makeAbs = makeAbs;
    exports2.finish = finish;
    exports2.mark = mark;
    exports2.isIgnored = isIgnored;
    exports2.childrenIgnored = childrenIgnored;
    function ownProp(obj, field) {
      return Object.prototype.hasOwnProperty.call(obj, field);
    }
    var fs2 = require("fs");
    var path2 = require("path");
    var minimatch = require_minimatch();
    var isAbsolute = require_path_is_absolute();
    var Minimatch = minimatch.Minimatch;
    function alphasort(a, b) {
      return a.localeCompare(b, "en");
    }
    function setupIgnores(self2, options) {
      self2.ignore = options.ignore || [];
      if (!Array.isArray(self2.ignore))
        self2.ignore = [self2.ignore];
      if (self2.ignore.length) {
        self2.ignore = self2.ignore.map(ignoreMap);
      }
    }
    function ignoreMap(pattern) {
      var gmatcher = null;
      if (pattern.slice(-3) === "/**") {
        var gpattern = pattern.replace(/(\/\*\*)+$/, "");
        gmatcher = new Minimatch(gpattern, { dot: true });
      }
      return {
        matcher: new Minimatch(pattern, { dot: true }),
        gmatcher
      };
    }
    function setopts(self2, pattern, options) {
      if (!options)
        options = {};
      if (options.matchBase && -1 === pattern.indexOf("/")) {
        if (options.noglobstar) {
          throw new Error("base matching requires globstar");
        }
        pattern = "**/" + pattern;
      }
      self2.silent = !!options.silent;
      self2.pattern = pattern;
      self2.strict = options.strict !== false;
      self2.realpath = !!options.realpath;
      self2.realpathCache = options.realpathCache || /* @__PURE__ */ Object.create(null);
      self2.follow = !!options.follow;
      self2.dot = !!options.dot;
      self2.mark = !!options.mark;
      self2.nodir = !!options.nodir;
      if (self2.nodir)
        self2.mark = true;
      self2.sync = !!options.sync;
      self2.nounique = !!options.nounique;
      self2.nonull = !!options.nonull;
      self2.nosort = !!options.nosort;
      self2.nocase = !!options.nocase;
      self2.stat = !!options.stat;
      self2.noprocess = !!options.noprocess;
      self2.absolute = !!options.absolute;
      self2.fs = options.fs || fs2;
      self2.maxLength = options.maxLength || Infinity;
      self2.cache = options.cache || /* @__PURE__ */ Object.create(null);
      self2.statCache = options.statCache || /* @__PURE__ */ Object.create(null);
      self2.symlinks = options.symlinks || /* @__PURE__ */ Object.create(null);
      setupIgnores(self2, options);
      self2.changedCwd = false;
      var cwd = process.cwd();
      if (!ownProp(options, "cwd"))
        self2.cwd = cwd;
      else {
        self2.cwd = path2.resolve(options.cwd);
        self2.changedCwd = self2.cwd !== cwd;
      }
      self2.root = options.root || path2.resolve(self2.cwd, "/");
      self2.root = path2.resolve(self2.root);
      if (process.platform === "win32")
        self2.root = self2.root.replace(/\\/g, "/");
      self2.cwdAbs = isAbsolute(self2.cwd) ? self2.cwd : makeAbs(self2, self2.cwd);
      if (process.platform === "win32")
        self2.cwdAbs = self2.cwdAbs.replace(/\\/g, "/");
      self2.nomount = !!options.nomount;
      options.nonegate = true;
      options.nocomment = true;
      options.allowWindowsEscape = false;
      self2.minimatch = new Minimatch(pattern, options);
      self2.options = self2.minimatch.options;
    }
    function finish(self2) {
      var nou = self2.nounique;
      var all = nou ? [] : /* @__PURE__ */ Object.create(null);
      for (var i = 0, l = self2.matches.length; i < l; i++) {
        var matches = self2.matches[i];
        if (!matches || Object.keys(matches).length === 0) {
          if (self2.nonull) {
            var literal = self2.minimatch.globSet[i];
            if (nou)
              all.push(literal);
            else
              all[literal] = true;
          }
        } else {
          var m = Object.keys(matches);
          if (nou)
            all.push.apply(all, m);
          else
            m.forEach(function(m2) {
              all[m2] = true;
            });
        }
      }
      if (!nou)
        all = Object.keys(all);
      if (!self2.nosort)
        all = all.sort(alphasort);
      if (self2.mark) {
        for (var i = 0; i < all.length; i++) {
          all[i] = self2._mark(all[i]);
        }
        if (self2.nodir) {
          all = all.filter(function(e) {
            var notDir = !/\/$/.test(e);
            var c = self2.cache[e] || self2.cache[makeAbs(self2, e)];
            if (notDir && c)
              notDir = c !== "DIR" && !Array.isArray(c);
            return notDir;
          });
        }
      }
      if (self2.ignore.length)
        all = all.filter(function(m2) {
          return !isIgnored(self2, m2);
        });
      self2.found = all;
    }
    function mark(self2, p) {
      var abs = makeAbs(self2, p);
      var c = self2.cache[abs];
      var m = p;
      if (c) {
        var isDir = c === "DIR" || Array.isArray(c);
        var slash = p.slice(-1) === "/";
        if (isDir && !slash)
          m += "/";
        else if (!isDir && slash)
          m = m.slice(0, -1);
        if (m !== p) {
          var mabs = makeAbs(self2, m);
          self2.statCache[mabs] = self2.statCache[abs];
          self2.cache[mabs] = self2.cache[abs];
        }
      }
      return m;
    }
    function makeAbs(self2, f) {
      var abs = f;
      if (f.charAt(0) === "/") {
        abs = path2.join(self2.root, f);
      } else if (isAbsolute(f) || f === "") {
        abs = f;
      } else if (self2.changedCwd) {
        abs = path2.resolve(self2.cwd, f);
      } else {
        abs = path2.resolve(f);
      }
      if (process.platform === "win32")
        abs = abs.replace(/\\/g, "/");
      return abs;
    }
    function isIgnored(self2, path3) {
      if (!self2.ignore.length)
        return false;
      return self2.ignore.some(function(item) {
        return item.matcher.match(path3) || !!(item.gmatcher && item.gmatcher.match(path3));
      });
    }
    function childrenIgnored(self2, path3) {
      if (!self2.ignore.length)
        return false;
      return self2.ignore.some(function(item) {
        return !!(item.gmatcher && item.gmatcher.match(path3));
      });
    }
  }
});

// node_modules/glob/sync.js
var require_sync = __commonJS({
  "node_modules/glob/sync.js"(exports2, module2) {
    module2.exports = globSync;
    globSync.GlobSync = GlobSync;
    var rp = require_fs();
    var minimatch = require_minimatch();
    var Minimatch = minimatch.Minimatch;
    var Glob = require_glob().Glob;
    var util = require("util");
    var path2 = require("path");
    var assert = require("assert");
    var isAbsolute = require_path_is_absolute();
    var common = require_common();
    var setopts = common.setopts;
    var ownProp = common.ownProp;
    var childrenIgnored = common.childrenIgnored;
    var isIgnored = common.isIgnored;
    function globSync(pattern, options) {
      if (typeof options === "function" || arguments.length === 3)
        throw new TypeError("callback provided to sync glob\nSee: https://github.com/isaacs/node-glob/issues/167");
      return new GlobSync(pattern, options).found;
    }
    function GlobSync(pattern, options) {
      if (!pattern)
        throw new Error("must provide pattern");
      if (typeof options === "function" || arguments.length === 3)
        throw new TypeError("callback provided to sync glob\nSee: https://github.com/isaacs/node-glob/issues/167");
      if (!(this instanceof GlobSync))
        return new GlobSync(pattern, options);
      setopts(this, pattern, options);
      if (this.noprocess)
        return this;
      var n = this.minimatch.set.length;
      this.matches = new Array(n);
      for (var i = 0; i < n; i++) {
        this._process(this.minimatch.set[i], i, false);
      }
      this._finish();
    }
    GlobSync.prototype._finish = function() {
      assert.ok(this instanceof GlobSync);
      if (this.realpath) {
        var self2 = this;
        this.matches.forEach(function(matchset, index) {
          var set = self2.matches[index] = /* @__PURE__ */ Object.create(null);
          for (var p in matchset) {
            try {
              p = self2._makeAbs(p);
              var real = rp.realpathSync(p, self2.realpathCache);
              set[real] = true;
            } catch (er) {
              if (er.syscall === "stat")
                set[self2._makeAbs(p)] = true;
              else
                throw er;
            }
          }
        });
      }
      common.finish(this);
    };
    GlobSync.prototype._process = function(pattern, index, inGlobStar) {
      assert.ok(this instanceof GlobSync);
      var n = 0;
      while (typeof pattern[n] === "string") {
        n++;
      }
      var prefix;
      switch (n) {
        // if not, then this is rather simple
        case pattern.length:
          this._processSimple(pattern.join("/"), index);
          return;
        case 0:
          prefix = null;
          break;
        default:
          prefix = pattern.slice(0, n).join("/");
          break;
      }
      var remain = pattern.slice(n);
      var read;
      if (prefix === null)
        read = ".";
      else if (isAbsolute(prefix) || isAbsolute(pattern.map(function(p) {
        return typeof p === "string" ? p : "[*]";
      }).join("/"))) {
        if (!prefix || !isAbsolute(prefix))
          prefix = "/" + prefix;
        read = prefix;
      } else
        read = prefix;
      var abs = this._makeAbs(read);
      if (childrenIgnored(this, read))
        return;
      var isGlobStar = remain[0] === minimatch.GLOBSTAR;
      if (isGlobStar)
        this._processGlobStar(prefix, read, abs, remain, index, inGlobStar);
      else
        this._processReaddir(prefix, read, abs, remain, index, inGlobStar);
    };
    GlobSync.prototype._processReaddir = function(prefix, read, abs, remain, index, inGlobStar) {
      var entries = this._readdir(abs, inGlobStar);
      if (!entries)
        return;
      var pn = remain[0];
      var negate = !!this.minimatch.negate;
      var rawGlob = pn._glob;
      var dotOk = this.dot || rawGlob.charAt(0) === ".";
      var matchedEntries = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.charAt(0) !== "." || dotOk) {
          var m;
          if (negate && !prefix) {
            m = !e.match(pn);
          } else {
            m = e.match(pn);
          }
          if (m)
            matchedEntries.push(e);
        }
      }
      var len = matchedEntries.length;
      if (len === 0)
        return;
      if (remain.length === 1 && !this.mark && !this.stat) {
        if (!this.matches[index])
          this.matches[index] = /* @__PURE__ */ Object.create(null);
        for (var i = 0; i < len; i++) {
          var e = matchedEntries[i];
          if (prefix) {
            if (prefix.slice(-1) !== "/")
              e = prefix + "/" + e;
            else
              e = prefix + e;
          }
          if (e.charAt(0) === "/" && !this.nomount) {
            e = path2.join(this.root, e);
          }
          this._emitMatch(index, e);
        }
        return;
      }
      remain.shift();
      for (var i = 0; i < len; i++) {
        var e = matchedEntries[i];
        var newPattern;
        if (prefix)
          newPattern = [prefix, e];
        else
          newPattern = [e];
        this._process(newPattern.concat(remain), index, inGlobStar);
      }
    };
    GlobSync.prototype._emitMatch = function(index, e) {
      if (isIgnored(this, e))
        return;
      var abs = this._makeAbs(e);
      if (this.mark)
        e = this._mark(e);
      if (this.absolute) {
        e = abs;
      }
      if (this.matches[index][e])
        return;
      if (this.nodir) {
        var c = this.cache[abs];
        if (c === "DIR" || Array.isArray(c))
          return;
      }
      this.matches[index][e] = true;
      if (this.stat)
        this._stat(e);
    };
    GlobSync.prototype._readdirInGlobStar = function(abs) {
      if (this.follow)
        return this._readdir(abs, false);
      var entries;
      var lstat;
      var stat;
      try {
        lstat = this.fs.lstatSync(abs);
      } catch (er) {
        if (er.code === "ENOENT") {
          return null;
        }
      }
      var isSym = lstat && lstat.isSymbolicLink();
      this.symlinks[abs] = isSym;
      if (!isSym && lstat && !lstat.isDirectory())
        this.cache[abs] = "FILE";
      else
        entries = this._readdir(abs, false);
      return entries;
    };
    GlobSync.prototype._readdir = function(abs, inGlobStar) {
      var entries;
      if (inGlobStar && !ownProp(this.symlinks, abs))
        return this._readdirInGlobStar(abs);
      if (ownProp(this.cache, abs)) {
        var c = this.cache[abs];
        if (!c || c === "FILE")
          return null;
        if (Array.isArray(c))
          return c;
      }
      try {
        return this._readdirEntries(abs, this.fs.readdirSync(abs));
      } catch (er) {
        this._readdirError(abs, er);
        return null;
      }
    };
    GlobSync.prototype._readdirEntries = function(abs, entries) {
      if (!this.mark && !this.stat) {
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (abs === "/")
            e = abs + e;
          else
            e = abs + "/" + e;
          this.cache[e] = true;
        }
      }
      this.cache[abs] = entries;
      return entries;
    };
    GlobSync.prototype._readdirError = function(f, er) {
      switch (er.code) {
        case "ENOTSUP":
        // https://github.com/isaacs/node-glob/issues/205
        case "ENOTDIR":
          var abs = this._makeAbs(f);
          this.cache[abs] = "FILE";
          if (abs === this.cwdAbs) {
            var error = new Error(er.code + " invalid cwd " + this.cwd);
            error.path = this.cwd;
            error.code = er.code;
            throw error;
          }
          break;
        case "ENOENT":
        // not terribly unusual
        case "ELOOP":
        case "ENAMETOOLONG":
        case "UNKNOWN":
          this.cache[this._makeAbs(f)] = false;
          break;
        default:
          this.cache[this._makeAbs(f)] = false;
          if (this.strict)
            throw er;
          if (!this.silent)
            console.error("glob error", er);
          break;
      }
    };
    GlobSync.prototype._processGlobStar = function(prefix, read, abs, remain, index, inGlobStar) {
      var entries = this._readdir(abs, inGlobStar);
      if (!entries)
        return;
      var remainWithoutGlobStar = remain.slice(1);
      var gspref = prefix ? [prefix] : [];
      var noGlobStar = gspref.concat(remainWithoutGlobStar);
      this._process(noGlobStar, index, false);
      var len = entries.length;
      var isSym = this.symlinks[abs];
      if (isSym && inGlobStar)
        return;
      for (var i = 0; i < len; i++) {
        var e = entries[i];
        if (e.charAt(0) === "." && !this.dot)
          continue;
        var instead = gspref.concat(entries[i], remainWithoutGlobStar);
        this._process(instead, index, true);
        var below = gspref.concat(entries[i], remain);
        this._process(below, index, true);
      }
    };
    GlobSync.prototype._processSimple = function(prefix, index) {
      var exists = this._stat(prefix);
      if (!this.matches[index])
        this.matches[index] = /* @__PURE__ */ Object.create(null);
      if (!exists)
        return;
      if (prefix && isAbsolute(prefix) && !this.nomount) {
        var trail = /[\/\\]$/.test(prefix);
        if (prefix.charAt(0) === "/") {
          prefix = path2.join(this.root, prefix);
        } else {
          prefix = path2.resolve(this.root, prefix);
          if (trail)
            prefix += "/";
        }
      }
      if (process.platform === "win32")
        prefix = prefix.replace(/\\/g, "/");
      this._emitMatch(index, prefix);
    };
    GlobSync.prototype._stat = function(f) {
      var abs = this._makeAbs(f);
      var needDir = f.slice(-1) === "/";
      if (f.length > this.maxLength)
        return false;
      if (!this.stat && ownProp(this.cache, abs)) {
        var c = this.cache[abs];
        if (Array.isArray(c))
          c = "DIR";
        if (!needDir || c === "DIR")
          return c;
        if (needDir && c === "FILE")
          return false;
      }
      var exists;
      var stat = this.statCache[abs];
      if (!stat) {
        var lstat;
        try {
          lstat = this.fs.lstatSync(abs);
        } catch (er) {
          if (er && (er.code === "ENOENT" || er.code === "ENOTDIR")) {
            this.statCache[abs] = false;
            return false;
          }
        }
        if (lstat && lstat.isSymbolicLink()) {
          try {
            stat = this.fs.statSync(abs);
          } catch (er) {
            stat = lstat;
          }
        } else {
          stat = lstat;
        }
      }
      this.statCache[abs] = stat;
      var c = true;
      if (stat)
        c = stat.isDirectory() ? "DIR" : "FILE";
      this.cache[abs] = this.cache[abs] || c;
      if (needDir && c === "FILE")
        return false;
      return c;
    };
    GlobSync.prototype._mark = function(p) {
      return common.mark(this, p);
    };
    GlobSync.prototype._makeAbs = function(f) {
      return common.makeAbs(this, f);
    };
  }
});

// node_modules/inflight/inflight.js
var require_inflight = __commonJS({
  "node_modules/inflight/inflight.js"(exports2, module2) {
    var wrappy = require_wrappy();
    var reqs = /* @__PURE__ */ Object.create(null);
    var once = require_once();
    module2.exports = wrappy(inflight);
    function inflight(key, cb) {
      if (reqs[key]) {
        reqs[key].push(cb);
        return null;
      } else {
        reqs[key] = [cb];
        return makeres(key);
      }
    }
    function makeres(key) {
      return once(function RES() {
        var cbs = reqs[key];
        var len = cbs.length;
        var args = slice(arguments);
        try {
          for (var i = 0; i < len; i++) {
            cbs[i].apply(null, args);
          }
        } finally {
          if (cbs.length > len) {
            cbs.splice(0, len);
            process.nextTick(function() {
              RES.apply(null, args);
            });
          } else {
            delete reqs[key];
          }
        }
      });
    }
    function slice(args) {
      var length = args.length;
      var array = [];
      for (var i = 0; i < length; i++) array[i] = args[i];
      return array;
    }
  }
});

// node_modules/glob/glob.js
var require_glob = __commonJS({
  "node_modules/glob/glob.js"(exports2, module2) {
    module2.exports = glob;
    var rp = require_fs();
    var minimatch = require_minimatch();
    var Minimatch = minimatch.Minimatch;
    var inherits = require_inherits();
    var EE = require("events").EventEmitter;
    var path2 = require("path");
    var assert = require("assert");
    var isAbsolute = require_path_is_absolute();
    var globSync = require_sync();
    var common = require_common();
    var setopts = common.setopts;
    var ownProp = common.ownProp;
    var inflight = require_inflight();
    var util = require("util");
    var childrenIgnored = common.childrenIgnored;
    var isIgnored = common.isIgnored;
    var once = require_once();
    function glob(pattern, options, cb) {
      if (typeof options === "function") cb = options, options = {};
      if (!options) options = {};
      if (options.sync) {
        if (cb)
          throw new TypeError("callback provided to sync glob");
        return globSync(pattern, options);
      }
      return new Glob(pattern, options, cb);
    }
    glob.sync = globSync;
    var GlobSync = glob.GlobSync = globSync.GlobSync;
    glob.glob = glob;
    function extend(origin, add) {
      if (add === null || typeof add !== "object") {
        return origin;
      }
      var keys = Object.keys(add);
      var i = keys.length;
      while (i--) {
        origin[keys[i]] = add[keys[i]];
      }
      return origin;
    }
    glob.hasMagic = function(pattern, options_) {
      var options = extend({}, options_);
      options.noprocess = true;
      var g = new Glob(pattern, options);
      var set = g.minimatch.set;
      if (!pattern)
        return false;
      if (set.length > 1)
        return true;
      for (var j = 0; j < set[0].length; j++) {
        if (typeof set[0][j] !== "string")
          return true;
      }
      return false;
    };
    glob.Glob = Glob;
    inherits(Glob, EE);
    function Glob(pattern, options, cb) {
      if (typeof options === "function") {
        cb = options;
        options = null;
      }
      if (options && options.sync) {
        if (cb)
          throw new TypeError("callback provided to sync glob");
        return new GlobSync(pattern, options);
      }
      if (!(this instanceof Glob))
        return new Glob(pattern, options, cb);
      setopts(this, pattern, options);
      this._didRealPath = false;
      var n = this.minimatch.set.length;
      this.matches = new Array(n);
      if (typeof cb === "function") {
        cb = once(cb);
        this.on("error", cb);
        this.on("end", function(matches) {
          cb(null, matches);
        });
      }
      var self2 = this;
      this._processing = 0;
      this._emitQueue = [];
      this._processQueue = [];
      this.paused = false;
      if (this.noprocess)
        return this;
      if (n === 0)
        return done();
      var sync = true;
      for (var i = 0; i < n; i++) {
        this._process(this.minimatch.set[i], i, false, done);
      }
      sync = false;
      function done() {
        --self2._processing;
        if (self2._processing <= 0) {
          if (sync) {
            process.nextTick(function() {
              self2._finish();
            });
          } else {
            self2._finish();
          }
        }
      }
    }
    Glob.prototype._finish = function() {
      assert(this instanceof Glob);
      if (this.aborted)
        return;
      if (this.realpath && !this._didRealpath)
        return this._realpath();
      common.finish(this);
      this.emit("end", this.found);
    };
    Glob.prototype._realpath = function() {
      if (this._didRealpath)
        return;
      this._didRealpath = true;
      var n = this.matches.length;
      if (n === 0)
        return this._finish();
      var self2 = this;
      for (var i = 0; i < this.matches.length; i++)
        this._realpathSet(i, next);
      function next() {
        if (--n === 0)
          self2._finish();
      }
    };
    Glob.prototype._realpathSet = function(index, cb) {
      var matchset = this.matches[index];
      if (!matchset)
        return cb();
      var found = Object.keys(matchset);
      var self2 = this;
      var n = found.length;
      if (n === 0)
        return cb();
      var set = this.matches[index] = /* @__PURE__ */ Object.create(null);
      found.forEach(function(p, i) {
        p = self2._makeAbs(p);
        rp.realpath(p, self2.realpathCache, function(er, real) {
          if (!er)
            set[real] = true;
          else if (er.syscall === "stat")
            set[p] = true;
          else
            self2.emit("error", er);
          if (--n === 0) {
            self2.matches[index] = set;
            cb();
          }
        });
      });
    };
    Glob.prototype._mark = function(p) {
      return common.mark(this, p);
    };
    Glob.prototype._makeAbs = function(f) {
      return common.makeAbs(this, f);
    };
    Glob.prototype.abort = function() {
      this.aborted = true;
      this.emit("abort");
    };
    Glob.prototype.pause = function() {
      if (!this.paused) {
        this.paused = true;
        this.emit("pause");
      }
    };
    Glob.prototype.resume = function() {
      if (this.paused) {
        this.emit("resume");
        this.paused = false;
        if (this._emitQueue.length) {
          var eq = this._emitQueue.slice(0);
          this._emitQueue.length = 0;
          for (var i = 0; i < eq.length; i++) {
            var e = eq[i];
            this._emitMatch(e[0], e[1]);
          }
        }
        if (this._processQueue.length) {
          var pq = this._processQueue.slice(0);
          this._processQueue.length = 0;
          for (var i = 0; i < pq.length; i++) {
            var p = pq[i];
            this._processing--;
            this._process(p[0], p[1], p[2], p[3]);
          }
        }
      }
    };
    Glob.prototype._process = function(pattern, index, inGlobStar, cb) {
      assert(this instanceof Glob);
      assert(typeof cb === "function");
      if (this.aborted)
        return;
      this._processing++;
      if (this.paused) {
        this._processQueue.push([pattern, index, inGlobStar, cb]);
        return;
      }
      var n = 0;
      while (typeof pattern[n] === "string") {
        n++;
      }
      var prefix;
      switch (n) {
        // if not, then this is rather simple
        case pattern.length:
          this._processSimple(pattern.join("/"), index, cb);
          return;
        case 0:
          prefix = null;
          break;
        default:
          prefix = pattern.slice(0, n).join("/");
          break;
      }
      var remain = pattern.slice(n);
      var read;
      if (prefix === null)
        read = ".";
      else if (isAbsolute(prefix) || isAbsolute(pattern.map(function(p) {
        return typeof p === "string" ? p : "[*]";
      }).join("/"))) {
        if (!prefix || !isAbsolute(prefix))
          prefix = "/" + prefix;
        read = prefix;
      } else
        read = prefix;
      var abs = this._makeAbs(read);
      if (childrenIgnored(this, read))
        return cb();
      var isGlobStar = remain[0] === minimatch.GLOBSTAR;
      if (isGlobStar)
        this._processGlobStar(prefix, read, abs, remain, index, inGlobStar, cb);
      else
        this._processReaddir(prefix, read, abs, remain, index, inGlobStar, cb);
    };
    Glob.prototype._processReaddir = function(prefix, read, abs, remain, index, inGlobStar, cb) {
      var self2 = this;
      this._readdir(abs, inGlobStar, function(er, entries) {
        return self2._processReaddir2(prefix, read, abs, remain, index, inGlobStar, entries, cb);
      });
    };
    Glob.prototype._processReaddir2 = function(prefix, read, abs, remain, index, inGlobStar, entries, cb) {
      if (!entries)
        return cb();
      var pn = remain[0];
      var negate = !!this.minimatch.negate;
      var rawGlob = pn._glob;
      var dotOk = this.dot || rawGlob.charAt(0) === ".";
      var matchedEntries = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.charAt(0) !== "." || dotOk) {
          var m;
          if (negate && !prefix) {
            m = !e.match(pn);
          } else {
            m = e.match(pn);
          }
          if (m)
            matchedEntries.push(e);
        }
      }
      var len = matchedEntries.length;
      if (len === 0)
        return cb();
      if (remain.length === 1 && !this.mark && !this.stat) {
        if (!this.matches[index])
          this.matches[index] = /* @__PURE__ */ Object.create(null);
        for (var i = 0; i < len; i++) {
          var e = matchedEntries[i];
          if (prefix) {
            if (prefix !== "/")
              e = prefix + "/" + e;
            else
              e = prefix + e;
          }
          if (e.charAt(0) === "/" && !this.nomount) {
            e = path2.join(this.root, e);
          }
          this._emitMatch(index, e);
        }
        return cb();
      }
      remain.shift();
      for (var i = 0; i < len; i++) {
        var e = matchedEntries[i];
        var newPattern;
        if (prefix) {
          if (prefix !== "/")
            e = prefix + "/" + e;
          else
            e = prefix + e;
        }
        this._process([e].concat(remain), index, inGlobStar, cb);
      }
      cb();
    };
    Glob.prototype._emitMatch = function(index, e) {
      if (this.aborted)
        return;
      if (isIgnored(this, e))
        return;
      if (this.paused) {
        this._emitQueue.push([index, e]);
        return;
      }
      var abs = isAbsolute(e) ? e : this._makeAbs(e);
      if (this.mark)
        e = this._mark(e);
      if (this.absolute)
        e = abs;
      if (this.matches[index][e])
        return;
      if (this.nodir) {
        var c = this.cache[abs];
        if (c === "DIR" || Array.isArray(c))
          return;
      }
      this.matches[index][e] = true;
      var st = this.statCache[abs];
      if (st)
        this.emit("stat", e, st);
      this.emit("match", e);
    };
    Glob.prototype._readdirInGlobStar = function(abs, cb) {
      if (this.aborted)
        return;
      if (this.follow)
        return this._readdir(abs, false, cb);
      var lstatkey = "lstat\0" + abs;
      var self2 = this;
      var lstatcb = inflight(lstatkey, lstatcb_);
      if (lstatcb)
        self2.fs.lstat(abs, lstatcb);
      function lstatcb_(er, lstat) {
        if (er && er.code === "ENOENT")
          return cb();
        var isSym = lstat && lstat.isSymbolicLink();
        self2.symlinks[abs] = isSym;
        if (!isSym && lstat && !lstat.isDirectory()) {
          self2.cache[abs] = "FILE";
          cb();
        } else
          self2._readdir(abs, false, cb);
      }
    };
    Glob.prototype._readdir = function(abs, inGlobStar, cb) {
      if (this.aborted)
        return;
      cb = inflight("readdir\0" + abs + "\0" + inGlobStar, cb);
      if (!cb)
        return;
      if (inGlobStar && !ownProp(this.symlinks, abs))
        return this._readdirInGlobStar(abs, cb);
      if (ownProp(this.cache, abs)) {
        var c = this.cache[abs];
        if (!c || c === "FILE")
          return cb();
        if (Array.isArray(c))
          return cb(null, c);
      }
      var self2 = this;
      self2.fs.readdir(abs, readdirCb(this, abs, cb));
    };
    function readdirCb(self2, abs, cb) {
      return function(er, entries) {
        if (er)
          self2._readdirError(abs, er, cb);
        else
          self2._readdirEntries(abs, entries, cb);
      };
    }
    Glob.prototype._readdirEntries = function(abs, entries, cb) {
      if (this.aborted)
        return;
      if (!this.mark && !this.stat) {
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (abs === "/")
            e = abs + e;
          else
            e = abs + "/" + e;
          this.cache[e] = true;
        }
      }
      this.cache[abs] = entries;
      return cb(null, entries);
    };
    Glob.prototype._readdirError = function(f, er, cb) {
      if (this.aborted)
        return;
      switch (er.code) {
        case "ENOTSUP":
        // https://github.com/isaacs/node-glob/issues/205
        case "ENOTDIR":
          var abs = this._makeAbs(f);
          this.cache[abs] = "FILE";
          if (abs === this.cwdAbs) {
            var error = new Error(er.code + " invalid cwd " + this.cwd);
            error.path = this.cwd;
            error.code = er.code;
            this.emit("error", error);
            this.abort();
          }
          break;
        case "ENOENT":
        // not terribly unusual
        case "ELOOP":
        case "ENAMETOOLONG":
        case "UNKNOWN":
          this.cache[this._makeAbs(f)] = false;
          break;
        default:
          this.cache[this._makeAbs(f)] = false;
          if (this.strict) {
            this.emit("error", er);
            this.abort();
          }
          if (!this.silent)
            console.error("glob error", er);
          break;
      }
      return cb();
    };
    Glob.prototype._processGlobStar = function(prefix, read, abs, remain, index, inGlobStar, cb) {
      var self2 = this;
      this._readdir(abs, inGlobStar, function(er, entries) {
        self2._processGlobStar2(prefix, read, abs, remain, index, inGlobStar, entries, cb);
      });
    };
    Glob.prototype._processGlobStar2 = function(prefix, read, abs, remain, index, inGlobStar, entries, cb) {
      if (!entries)
        return cb();
      var remainWithoutGlobStar = remain.slice(1);
      var gspref = prefix ? [prefix] : [];
      var noGlobStar = gspref.concat(remainWithoutGlobStar);
      this._process(noGlobStar, index, false, cb);
      var isSym = this.symlinks[abs];
      var len = entries.length;
      if (isSym && inGlobStar)
        return cb();
      for (var i = 0; i < len; i++) {
        var e = entries[i];
        if (e.charAt(0) === "." && !this.dot)
          continue;
        var instead = gspref.concat(entries[i], remainWithoutGlobStar);
        this._process(instead, index, true, cb);
        var below = gspref.concat(entries[i], remain);
        this._process(below, index, true, cb);
      }
      cb();
    };
    Glob.prototype._processSimple = function(prefix, index, cb) {
      var self2 = this;
      this._stat(prefix, function(er, exists) {
        self2._processSimple2(prefix, index, er, exists, cb);
      });
    };
    Glob.prototype._processSimple2 = function(prefix, index, er, exists, cb) {
      if (!this.matches[index])
        this.matches[index] = /* @__PURE__ */ Object.create(null);
      if (!exists)
        return cb();
      if (prefix && isAbsolute(prefix) && !this.nomount) {
        var trail = /[\/\\]$/.test(prefix);
        if (prefix.charAt(0) === "/") {
          prefix = path2.join(this.root, prefix);
        } else {
          prefix = path2.resolve(this.root, prefix);
          if (trail)
            prefix += "/";
        }
      }
      if (process.platform === "win32")
        prefix = prefix.replace(/\\/g, "/");
      this._emitMatch(index, prefix);
      cb();
    };
    Glob.prototype._stat = function(f, cb) {
      var abs = this._makeAbs(f);
      var needDir = f.slice(-1) === "/";
      if (f.length > this.maxLength)
        return cb();
      if (!this.stat && ownProp(this.cache, abs)) {
        var c = this.cache[abs];
        if (Array.isArray(c))
          c = "DIR";
        if (!needDir || c === "DIR")
          return cb(null, c);
        if (needDir && c === "FILE")
          return cb();
      }
      var exists;
      var stat = this.statCache[abs];
      if (stat !== void 0) {
        if (stat === false)
          return cb(null, stat);
        else {
          var type = stat.isDirectory() ? "DIR" : "FILE";
          if (needDir && type === "FILE")
            return cb();
          else
            return cb(null, type, stat);
        }
      }
      var self2 = this;
      var statcb = inflight("stat\0" + abs, lstatcb_);
      if (statcb)
        self2.fs.lstat(abs, statcb);
      function lstatcb_(er, lstat) {
        if (lstat && lstat.isSymbolicLink()) {
          return self2.fs.stat(abs, function(er2, stat2) {
            if (er2)
              self2._stat2(f, abs, null, lstat, cb);
            else
              self2._stat2(f, abs, er2, stat2, cb);
          });
        } else {
          self2._stat2(f, abs, er, lstat, cb);
        }
      }
    };
    Glob.prototype._stat2 = function(f, abs, er, stat, cb) {
      if (er && (er.code === "ENOENT" || er.code === "ENOTDIR")) {
        this.statCache[abs] = false;
        return cb();
      }
      var needDir = f.slice(-1) === "/";
      this.statCache[abs] = stat;
      if (abs.slice(-1) === "/" && stat && !stat.isDirectory())
        return cb(null, false, stat);
      var c = true;
      if (stat)
        c = stat.isDirectory() ? "DIR" : "FILE";
      this.cache[abs] = this.cache[abs] || c;
      if (needDir && c === "FILE")
        return cb();
      return cb(null, c, stat);
    };
  }
});

// node_modules/rimraf/rimraf.js
var require_rimraf = __commonJS({
  "node_modules/rimraf/rimraf.js"(exports2, module2) {
    module2.exports = rimraf;
    rimraf.sync = rimrafSync;
    var assert = require("assert");
    var path2 = require("path");
    var fs2 = require("fs");
    var glob = void 0;
    try {
      glob = require_glob();
    } catch (_err) {
    }
    var _0666 = parseInt("666", 8);
    var defaultGlobOpts = {
      nosort: true,
      silent: true
    };
    var timeout = 0;
    var isWindows = process.platform === "win32";
    function defaults(options) {
      var methods = [
        "unlink",
        "chmod",
        "stat",
        "lstat",
        "rmdir",
        "readdir"
      ];
      methods.forEach(function(m) {
        options[m] = options[m] || fs2[m];
        m = m + "Sync";
        options[m] = options[m] || fs2[m];
      });
      options.maxBusyTries = options.maxBusyTries || 3;
      options.emfileWait = options.emfileWait || 1e3;
      if (options.glob === false) {
        options.disableGlob = true;
      }
      if (options.disableGlob !== true && glob === void 0) {
        throw Error("glob dependency not found, set `options.disableGlob = true` if intentional");
      }
      options.disableGlob = options.disableGlob || false;
      options.glob = options.glob || defaultGlobOpts;
    }
    function rimraf(p, options, cb) {
      if (typeof options === "function") {
        cb = options;
        options = {};
      }
      assert(p, "rimraf: missing path");
      assert.equal(typeof p, "string", "rimraf: path should be a string");
      assert.equal(typeof cb, "function", "rimraf: callback function required");
      assert(options, "rimraf: invalid options argument provided");
      assert.equal(typeof options, "object", "rimraf: options should be object");
      defaults(options);
      var busyTries = 0;
      var errState = null;
      var n = 0;
      if (options.disableGlob || !glob.hasMagic(p))
        return afterGlob(null, [p]);
      options.lstat(p, function(er, stat) {
        if (!er)
          return afterGlob(null, [p]);
        glob(p, options.glob, afterGlob);
      });
      function next(er) {
        errState = errState || er;
        if (--n === 0)
          cb(errState);
      }
      function afterGlob(er, results) {
        if (er)
          return cb(er);
        n = results.length;
        if (n === 0)
          return cb();
        results.forEach(function(p2) {
          rimraf_(p2, options, function CB(er2) {
            if (er2) {
              if ((er2.code === "EBUSY" || er2.code === "ENOTEMPTY" || er2.code === "EPERM") && busyTries < options.maxBusyTries) {
                busyTries++;
                var time = busyTries * 100;
                return setTimeout(function() {
                  rimraf_(p2, options, CB);
                }, time);
              }
              if (er2.code === "EMFILE" && timeout < options.emfileWait) {
                return setTimeout(function() {
                  rimraf_(p2, options, CB);
                }, timeout++);
              }
              if (er2.code === "ENOENT") er2 = null;
            }
            timeout = 0;
            next(er2);
          });
        });
      }
    }
    function rimraf_(p, options, cb) {
      assert(p);
      assert(options);
      assert(typeof cb === "function");
      options.lstat(p, function(er, st) {
        if (er && er.code === "ENOENT")
          return cb(null);
        if (er && er.code === "EPERM" && isWindows)
          fixWinEPERM(p, options, er, cb);
        if (st && st.isDirectory())
          return rmdir(p, options, er, cb);
        options.unlink(p, function(er2) {
          if (er2) {
            if (er2.code === "ENOENT")
              return cb(null);
            if (er2.code === "EPERM")
              return isWindows ? fixWinEPERM(p, options, er2, cb) : rmdir(p, options, er2, cb);
            if (er2.code === "EISDIR")
              return rmdir(p, options, er2, cb);
          }
          return cb(er2);
        });
      });
    }
    function fixWinEPERM(p, options, er, cb) {
      assert(p);
      assert(options);
      assert(typeof cb === "function");
      if (er)
        assert(er instanceof Error);
      options.chmod(p, _0666, function(er2) {
        if (er2)
          cb(er2.code === "ENOENT" ? null : er);
        else
          options.stat(p, function(er3, stats) {
            if (er3)
              cb(er3.code === "ENOENT" ? null : er);
            else if (stats.isDirectory())
              rmdir(p, options, er, cb);
            else
              options.unlink(p, cb);
          });
      });
    }
    function fixWinEPERMSync(p, options, er) {
      assert(p);
      assert(options);
      if (er)
        assert(er instanceof Error);
      try {
        options.chmodSync(p, _0666);
      } catch (er2) {
        if (er2.code === "ENOENT")
          return;
        else
          throw er;
      }
      try {
        var stats = options.statSync(p);
      } catch (er3) {
        if (er3.code === "ENOENT")
          return;
        else
          throw er;
      }
      if (stats.isDirectory())
        rmdirSync(p, options, er);
      else
        options.unlinkSync(p);
    }
    function rmdir(p, options, originalEr, cb) {
      assert(p);
      assert(options);
      if (originalEr)
        assert(originalEr instanceof Error);
      assert(typeof cb === "function");
      options.rmdir(p, function(er) {
        if (er && (er.code === "ENOTEMPTY" || er.code === "EEXIST" || er.code === "EPERM"))
          rmkids(p, options, cb);
        else if (er && er.code === "ENOTDIR")
          cb(originalEr);
        else
          cb(er);
      });
    }
    function rmkids(p, options, cb) {
      assert(p);
      assert(options);
      assert(typeof cb === "function");
      options.readdir(p, function(er, files) {
        if (er)
          return cb(er);
        var n = files.length;
        if (n === 0)
          return options.rmdir(p, cb);
        var errState;
        files.forEach(function(f) {
          rimraf(path2.join(p, f), options, function(er2) {
            if (errState)
              return;
            if (er2)
              return cb(errState = er2);
            if (--n === 0)
              options.rmdir(p, cb);
          });
        });
      });
    }
    function rimrafSync(p, options) {
      options = options || {};
      defaults(options);
      assert(p, "rimraf: missing path");
      assert.equal(typeof p, "string", "rimraf: path should be a string");
      assert(options, "rimraf: missing options");
      assert.equal(typeof options, "object", "rimraf: options should be object");
      var results;
      if (options.disableGlob || !glob.hasMagic(p)) {
        results = [p];
      } else {
        try {
          options.lstatSync(p);
          results = [p];
        } catch (er) {
          results = glob.sync(p, options.glob);
        }
      }
      if (!results.length)
        return;
      for (var i = 0; i < results.length; i++) {
        var p = results[i];
        try {
          var st = options.lstatSync(p);
        } catch (er) {
          if (er.code === "ENOENT")
            return;
          if (er.code === "EPERM" && isWindows)
            fixWinEPERMSync(p, options, er);
        }
        try {
          if (st && st.isDirectory())
            rmdirSync(p, options, null);
          else
            options.unlinkSync(p);
        } catch (er) {
          if (er.code === "ENOENT")
            return;
          if (er.code === "EPERM")
            return isWindows ? fixWinEPERMSync(p, options, er) : rmdirSync(p, options, er);
          if (er.code !== "EISDIR")
            throw er;
          rmdirSync(p, options, er);
        }
      }
    }
    function rmdirSync(p, options, originalEr) {
      assert(p);
      assert(options);
      if (originalEr)
        assert(originalEr instanceof Error);
      try {
        options.rmdirSync(p);
      } catch (er) {
        if (er.code === "ENOENT")
          return;
        if (er.code === "ENOTDIR")
          throw originalEr;
        if (er.code === "ENOTEMPTY" || er.code === "EEXIST" || er.code === "EPERM")
          rmkidsSync(p, options);
      }
    }
    function rmkidsSync(p, options) {
      assert(p);
      assert(options);
      options.readdirSync(p).forEach(function(f) {
        rimrafSync(path2.join(p, f), options);
      });
      var retries = isWindows ? 100 : 1;
      var i = 0;
      do {
        var threw = true;
        try {
          var ret = options.rmdirSync(p, options);
          threw = false;
          return ret;
        } finally {
          if (++i < retries && threw)
            continue;
        }
      } while (true);
    }
  }
});

// node_modules/fs-chunk-store/node_modules/mkdirp/index.js
var require_mkdirp2 = __commonJS({
  "node_modules/fs-chunk-store/node_modules/mkdirp/index.js"(exports2, module2) {
    var path2 = require("path");
    var fs2 = require("fs");
    var _0777 = parseInt("0777", 8);
    module2.exports = mkdirP.mkdirp = mkdirP.mkdirP = mkdirP;
    function mkdirP(p, opts, f, made) {
      if (typeof opts === "function") {
        f = opts;
        opts = {};
      } else if (!opts || typeof opts !== "object") {
        opts = { mode: opts };
      }
      var mode = opts.mode;
      var xfs = opts.fs || fs2;
      if (mode === void 0) {
        mode = _0777;
      }
      if (!made) made = null;
      var cb = f || /* istanbul ignore next */
      function() {
      };
      p = path2.resolve(p);
      xfs.mkdir(p, mode, function(er) {
        if (!er) {
          made = made || p;
          return cb(null, made);
        }
        switch (er.code) {
          case "ENOENT":
            if (path2.dirname(p) === p) return cb(er);
            mkdirP(path2.dirname(p), opts, function(er2, made2) {
              if (er2) cb(er2, made2);
              else mkdirP(p, opts, cb, made2);
            });
            break;
          // In the case of any other error, just see if there's a dir
          // there already.  If so, then hooray!  If not, then something
          // is borked.
          default:
            xfs.stat(p, function(er2, stat) {
              if (er2 || !stat.isDirectory()) cb(er, made);
              else cb(null, made);
            });
            break;
        }
      });
    }
    mkdirP.sync = function sync(p, opts, made) {
      if (!opts || typeof opts !== "object") {
        opts = { mode: opts };
      }
      var mode = opts.mode;
      var xfs = opts.fs || fs2;
      if (mode === void 0) {
        mode = _0777;
      }
      if (!made) made = null;
      p = path2.resolve(p);
      try {
        xfs.mkdirSync(p, mode);
        made = made || p;
      } catch (err0) {
        switch (err0.code) {
          case "ENOENT":
            made = sync(path2.dirname(p), opts, made);
            sync(p, opts, made);
            break;
          // In the case of any other error, just see if there's a dir
          // there already.  If so, then hooray!  If not, then something
          // is borked.
          default:
            var stat;
            try {
              stat = xfs.statSync(p);
            } catch (err1) {
              throw err0;
            }
            if (!stat.isDirectory()) throw err0;
            break;
        }
      }
      return made;
    };
  }
});

// node_modules/queue-microtask/index.js
var require_queue_microtask = __commonJS({
  "node_modules/queue-microtask/index.js"(exports2, module2) {
    var promise;
    module2.exports = typeof queueMicrotask === "function" ? queueMicrotask.bind(typeof window !== "undefined" ? window : global) : (cb) => (promise || (promise = Promise.resolve())).then(cb).catch((err) => setTimeout(() => {
      throw err;
    }, 0));
  }
});

// node_modules/run-parallel/index.js
var require_run_parallel = __commonJS({
  "node_modules/run-parallel/index.js"(exports2, module2) {
    module2.exports = runParallel;
    var queueMicrotask2 = require_queue_microtask();
    function runParallel(tasks, cb) {
      let results, pending, keys;
      let isSync = true;
      if (Array.isArray(tasks)) {
        results = [];
        pending = tasks.length;
      } else {
        keys = Object.keys(tasks);
        results = {};
        pending = keys.length;
      }
      function done(err) {
        function end() {
          if (cb) cb(err, results);
          cb = null;
        }
        if (isSync) queueMicrotask2(end);
        else end();
      }
      function each(i, err, result) {
        results[i] = result;
        if (--pending === 0 || err) {
          done(err);
        }
      }
      if (!pending) {
        done(null);
      } else if (keys) {
        keys.forEach(function(key) {
          tasks[key](function(err, result) {
            each(key, err, result);
          });
        });
      } else {
        tasks.forEach(function(task, i) {
          task(function(err, result) {
            each(i, err, result);
          });
        });
      }
      isSync = false;
    }
  }
});

// node_modules/queue-tick/queue-microtask.js
var require_queue_microtask2 = __commonJS({
  "node_modules/queue-tick/queue-microtask.js"(exports2, module2) {
    module2.exports = typeof queueMicrotask === "function" ? queueMicrotask : (fn) => Promise.resolve().then(fn);
  }
});

// node_modules/queue-tick/process-next-tick.js
var require_process_next_tick = __commonJS({
  "node_modules/queue-tick/process-next-tick.js"(exports2, module2) {
    module2.exports = typeof process !== "undefined" && typeof process.nextTick === "function" ? process.nextTick.bind(process) : require_queue_microtask2();
  }
});

// node_modules/random-access-storage/index.js
var require_random_access_storage = __commonJS({
  "node_modules/random-access-storage/index.js"(exports2, module2) {
    var events = require("events");
    var inherits = require_inherits();
    var queueTick = require_process_next_tick();
    var NOT_READABLE = defaultImpl(new Error("Not readable"));
    var NOT_WRITABLE = defaultImpl(new Error("Not writable"));
    var NOT_DELETABLE = defaultImpl(new Error("Not deletable"));
    var NOT_STATABLE = defaultImpl(new Error("Not statable"));
    var NO_OPEN_READABLE = defaultImpl(new Error("No readonly open"));
    var READ_OP = 0;
    var WRITE_OP = 1;
    var DEL_OP = 2;
    var STAT_OP = 3;
    var OPEN_OP = 4;
    var CLOSE_OP = 5;
    var DESTROY_OP = 6;
    module2.exports = RandomAccess;
    function RandomAccess(opts) {
      if (!(this instanceof RandomAccess)) return new RandomAccess(opts);
      events.EventEmitter.call(this);
      this._queued = [];
      this._pending = 0;
      this._needsOpen = true;
      this.opened = false;
      this.closed = false;
      this.destroyed = false;
      if (opts) {
        if (opts.openReadonly) this._openReadonly = opts.openReadonly;
        if (opts.open) this._open = opts.open;
        if (opts.read) this._read = opts.read;
        if (opts.write) this._write = opts.write;
        if (opts.del) this._del = opts.del;
        if (opts.stat) this._stat = opts.stat;
        if (opts.close) this._close = opts.close;
        if (opts.destroy) this._destroy = opts.destroy;
      }
      this.preferReadonly = this._openReadonly !== NO_OPEN_READABLE;
      this.readable = this._read !== NOT_READABLE;
      this.writable = this._write !== NOT_WRITABLE;
      this.deletable = this._del !== NOT_DELETABLE;
      this.statable = this._stat !== NOT_STATABLE;
    }
    inherits(RandomAccess, events.EventEmitter);
    RandomAccess.prototype.read = function(offset, size, cb) {
      this.run(new Request(this, READ_OP, offset, size, null, cb));
    };
    RandomAccess.prototype._read = NOT_READABLE;
    RandomAccess.prototype.write = function(offset, data, cb) {
      if (!cb) cb = noop;
      openWritable(this);
      this.run(new Request(this, WRITE_OP, offset, data.length, data, cb));
    };
    RandomAccess.prototype._write = NOT_WRITABLE;
    RandomAccess.prototype.del = function(offset, size, cb) {
      if (!cb) cb = noop;
      openWritable(this);
      this.run(new Request(this, DEL_OP, offset, size, null, cb));
    };
    RandomAccess.prototype._del = NOT_DELETABLE;
    RandomAccess.prototype.stat = function(cb) {
      this.run(new Request(this, STAT_OP, 0, 0, null, cb));
    };
    RandomAccess.prototype._stat = NOT_STATABLE;
    RandomAccess.prototype.open = function(cb) {
      if (!cb) cb = noop;
      if (this.opened && !this._needsOpen) return queueTick(() => cb(null));
      queueAndRun(this, new Request(this, OPEN_OP, 0, 0, null, cb));
    };
    RandomAccess.prototype._open = defaultImpl(null);
    RandomAccess.prototype._openReadonly = NO_OPEN_READABLE;
    RandomAccess.prototype.close = function(cb) {
      if (!cb) cb = noop;
      if (this.closed) return queueTick(() => cb(null));
      queueAndRun(this, new Request(this, CLOSE_OP, 0, 0, null, cb));
    };
    RandomAccess.prototype._close = defaultImpl(null);
    RandomAccess.prototype.destroy = function(cb) {
      if (!cb) cb = noop;
      if (!this.closed) this.close(noop);
      queueAndRun(this, new Request(this, DESTROY_OP, 0, 0, null, cb));
    };
    RandomAccess.prototype._destroy = defaultImpl(null);
    RandomAccess.prototype.run = function(req) {
      if (this._needsOpen) this.open(noop);
      if (this._queued.length) this._queued.push(req);
      else req._run();
    };
    function noop() {
    }
    function Request(self2, type, offset, size, data, cb) {
      this.type = type;
      this.offset = offset;
      this.data = data;
      this.size = size;
      this.storage = self2;
      this._sync = false;
      this._callback = cb;
      this._openError = null;
    }
    Request.prototype._maybeOpenError = function(err) {
      if (this.type !== OPEN_OP) return;
      var queued = this.storage._queued;
      for (var i = 0; i < queued.length; i++) queued[i]._openError = err;
    };
    Request.prototype._unqueue = function(err) {
      var ra = this.storage;
      var queued = ra._queued;
      if (!err) {
        switch (this.type) {
          case OPEN_OP:
            if (!ra.opened) {
              ra.opened = true;
              ra.emit("open");
            }
            break;
          case CLOSE_OP:
            if (!ra.closed) {
              ra.closed = true;
              ra.emit("close");
            }
            break;
          case DESTROY_OP:
            if (!ra.destroyed) {
              ra.destroyed = true;
              ra.emit("destroy");
            }
            break;
        }
      } else {
        this._maybeOpenError(err);
      }
      if (queued.length && queued[0] === this) queued.shift();
      if (!--ra._pending) drainQueue(ra);
    };
    Request.prototype.callback = function(err, val) {
      if (this._sync) return nextTick(this, err, val);
      this._unqueue(err);
      this._callback(err, val);
    };
    Request.prototype._openAndNotClosed = function() {
      var ra = this.storage;
      if (ra.opened && !ra.closed) return true;
      if (!ra.opened) nextTick(this, this._openError || new Error("Not opened"));
      else if (ra.closed) nextTick(this, new Error("Closed"));
      return false;
    };
    Request.prototype._open = function() {
      var ra = this.storage;
      if (ra.opened && !ra._needsOpen) return nextTick(this, null);
      if (ra.closed) return nextTick(this, new Error("Closed"));
      ra._needsOpen = false;
      if (ra.preferReadonly) ra._openReadonly(this);
      else ra._open(this);
    };
    Request.prototype._run = function() {
      var ra = this.storage;
      ra._pending++;
      this._sync = true;
      switch (this.type) {
        case READ_OP:
          if (this._openAndNotClosed()) ra._read(this);
          break;
        case WRITE_OP:
          if (this._openAndNotClosed()) ra._write(this);
          break;
        case DEL_OP:
          if (this._openAndNotClosed()) ra._del(this);
          break;
        case STAT_OP:
          if (this._openAndNotClosed()) ra._stat(this);
          break;
        case OPEN_OP:
          this._open();
          break;
        case CLOSE_OP:
          if (ra.closed || !ra.opened) nextTick(this, null);
          else ra._close(this);
          break;
        case DESTROY_OP:
          if (ra.destroyed) nextTick(this, null);
          else ra._destroy(this);
          break;
      }
      this._sync = false;
    };
    function queueAndRun(self2, req) {
      self2._queued.push(req);
      if (!self2._pending) req._run();
    }
    function drainQueue(self2) {
      var queued = self2._queued;
      while (queued.length > 0) {
        var blocking = queued[0].type > 3;
        if (!blocking || !self2._pending) queued[0]._run();
        if (blocking) return;
        queued.shift();
      }
    }
    function openWritable(self2) {
      if (self2.preferReadonly) {
        self2._needsOpen = true;
        self2.preferReadonly = false;
      }
    }
    function defaultImpl(err) {
      return overridable;
      function overridable(req) {
        nextTick(req, err);
      }
    }
    function nextTick(req, err, val) {
      queueTick(() => req.callback(err, val));
    }
  }
});

// node_modules/mkdirp-classic/index.js
var require_mkdirp_classic = __commonJS({
  "node_modules/mkdirp-classic/index.js"(exports2, module2) {
    var path2 = require("path");
    var fs2 = require("fs");
    var _0777 = parseInt("0777", 8);
    module2.exports = mkdirP.mkdirp = mkdirP.mkdirP = mkdirP;
    function mkdirP(p, opts, f, made) {
      if (typeof opts === "function") {
        f = opts;
        opts = {};
      } else if (!opts || typeof opts !== "object") {
        opts = { mode: opts };
      }
      var mode = opts.mode;
      var xfs = opts.fs || fs2;
      if (mode === void 0) {
        mode = _0777 & ~process.umask();
      }
      if (!made) made = null;
      var cb = f || function() {
      };
      p = path2.resolve(p);
      xfs.mkdir(p, mode, function(er) {
        if (!er) {
          made = made || p;
          return cb(null, made);
        }
        switch (er.code) {
          case "ENOENT":
            mkdirP(path2.dirname(p), opts, function(er2, made2) {
              if (er2) cb(er2, made2);
              else mkdirP(p, opts, cb, made2);
            });
            break;
          // In the case of any other error, just see if there's a dir
          // there already.  If so, then hooray!  If not, then something
          // is borked.
          default:
            xfs.stat(p, function(er2, stat) {
              if (er2 || !stat.isDirectory()) cb(er, made);
              else cb(null, made);
            });
            break;
        }
      });
    }
    mkdirP.sync = function sync(p, opts, made) {
      if (!opts || typeof opts !== "object") {
        opts = { mode: opts };
      }
      var mode = opts.mode;
      var xfs = opts.fs || fs2;
      if (mode === void 0) {
        mode = _0777 & ~process.umask();
      }
      if (!made) made = null;
      p = path2.resolve(p);
      try {
        xfs.mkdirSync(p, mode);
        made = made || p;
      } catch (err0) {
        switch (err0.code) {
          case "ENOENT":
            made = sync(path2.dirname(p), opts, made);
            sync(p, opts, made);
            break;
          // In the case of any other error, just see if there's a dir
          // there already.  If so, then hooray!  If not, then something
          // is borked.
          default:
            var stat;
            try {
              stat = xfs.statSync(p);
            } catch (err1) {
              throw err0;
            }
            if (!stat.isDirectory()) throw err0;
            break;
        }
      }
      return made;
    };
  }
});

// node_modules/random-access-file/index.js
var require_random_access_file = __commonJS({
  "node_modules/random-access-file/index.js"(exports2, module2) {
    var inherits = require("util").inherits;
    var RandomAccess = require_random_access_storage();
    var fs2 = require("fs");
    var mkdirp = require_mkdirp_classic();
    var path2 = require("path");
    var constants = fs2.constants || require("constants");
    var READONLY = constants.O_RDONLY;
    var READWRITE = constants.O_RDWR | constants.O_CREAT;
    module2.exports = RandomAccessFile;
    function RandomAccessFile(filename, opts) {
      if (!(this instanceof RandomAccessFile)) return new RandomAccessFile(filename, opts);
      RandomAccess.call(this);
      if (!opts) opts = {};
      if (opts.directory) filename = path2.join(opts.directory, path2.resolve("/", filename).replace(/^\w+:\\/, ""));
      this.directory = opts.directory || null;
      this.filename = filename;
      this.fd = 0;
      if (opts.writable || opts.truncate) this.preferReadonly = false;
      this._size = opts.size || opts.length || 0;
      this._truncate = !!opts.truncate || this._size > 0;
      this._rmdir = !!opts.rmdir;
      this._lock = opts.lock || noLock;
      this._sparse = opts.sparse || noLock;
      this._alloc = opts.alloc || Buffer.allocUnsafe;
    }
    inherits(RandomAccessFile, RandomAccess);
    RandomAccessFile.prototype._open = function(req) {
      var self2 = this;
      mkdirp(path2.dirname(this.filename), ondir);
      function ondir(err) {
        if (err) return req.callback(err);
        open2(self2, READWRITE, req);
      }
    };
    RandomAccessFile.prototype._openReadonly = function(req) {
      open2(this, READONLY, req);
    };
    RandomAccessFile.prototype._write = function(req) {
      var data = req.data;
      var fd = this.fd;
      fs2.write(fd, data, 0, req.size, req.offset, onwrite);
      function onwrite(err, wrote) {
        if (err) return req.callback(err);
        req.size -= wrote;
        req.offset += wrote;
        if (!req.size) return req.callback(null);
        fs2.write(fd, data, data.length - req.size, req.size, req.offset, onwrite);
      }
    };
    RandomAccessFile.prototype._read = function(req) {
      var self2 = this;
      var data = req.data || this._alloc(req.size);
      var fd = this.fd;
      if (!req.size) return process.nextTick(readEmpty, req);
      fs2.read(fd, data, 0, req.size, req.offset, onread);
      function onread(err, read) {
        if (err) return req.callback(err);
        if (!read) return req.callback(createReadError(self2.filename, req.offset, req.size));
        req.size -= read;
        req.offset += read;
        if (!req.size) return req.callback(null, data);
        fs2.read(fd, data, data.length - req.size, req.size, req.offset, onread);
      }
    };
    RandomAccessFile.prototype._del = function(req) {
      var fd = this.fd;
      fs2.fstat(fd, onstat);
      function onstat(err, st) {
        if (err) return req.callback(err);
        if (req.offset + req.size < st.size) return req.callback(null);
        fs2.ftruncate(fd, req.offset, ontruncate);
      }
      function ontruncate(err) {
        req.callback(err);
      }
    };
    RandomAccessFile.prototype._stat = function(req) {
      fs2.fstat(this.fd, onstat);
      function onstat(err, st) {
        req.callback(err, st);
      }
    };
    RandomAccessFile.prototype._close = function(req) {
      var self2 = this;
      fs2.close(this.fd, onclose);
      function onclose(err) {
        if (err) return req.callback(err);
        self2.fd = 0;
        req.callback(null);
      }
    };
    RandomAccessFile.prototype._destroy = function(req) {
      var self2 = this;
      var root = this.directory && path2.resolve(path2.join(this.directory, "."));
      var dir = path2.resolve(path2.dirname(this.filename));
      fs2.unlink(this.filename, onunlink);
      function onunlink(err) {
        if (!self2._rmdir || !root || dir === root) return req.callback(err);
        fs2.rmdir(dir, onrmdir);
      }
      function onrmdir(err) {
        dir = path2.join(dir, "..");
        if (err || dir === root) return req.callback(null);
        fs2.rmdir(dir, onrmdir);
      }
    };
    function open2(self2, mode, req) {
      if (self2.fd) fs2.close(self2.fd, oncloseold);
      else fs2.open(self2.filename, mode, onopen);
      function onopen(err, fd) {
        if (err) return req.callback(err);
        self2.fd = fd;
        if (!self2._lock(self2.fd)) return req.callback(createLockError(self2.filename));
        if (!self2._sparse(self2.fd)) return req.callback(createSparseError(self2.filename));
        if (!self2._truncate || mode === READONLY) return req.callback(null);
        fs2.ftruncate(self2.fd, self2._size, ontruncate);
      }
      function oncloseold(err) {
        if (err) return onerrorafteropen(err);
        self2.fd = 0;
        fs2.open(self2.filename, mode, onopen);
      }
      function ontruncate(err) {
        if (err) return onerrorafteropen(err);
        req.callback(null);
      }
      function onerrorafteropen(err) {
        fs2.close(self2.fd, function() {
          self2.fd = 0;
          req.callback(err);
        });
      }
    }
    function readEmpty(req) {
      req.callback(null, Buffer.alloc(0));
    }
    function noLock(fd) {
      return true;
    }
    function createSparseError(path3) {
      var err = new Error("ENOTSPARSE: File could not be marked as sparse");
      err.code = "ENOTSPARSE";
      err.path = path3;
      return err;
    }
    function createLockError(path3) {
      var err = new Error("ELOCKED: File is locked");
      err.code = "ELOCKED";
      err.path = path3;
      return err;
    }
    function createReadError(path3, offset, size) {
      var err = new Error("Could not satisfy length");
      err.code = "EPARTIALREAD";
      err.path = path3;
      err.offset = offset;
      err.size = size;
      return err;
    }
  }
});

// node_modules/randombytes/index.js
var require_randombytes = __commonJS({
  "node_modules/randombytes/index.js"(exports2, module2) {
    module2.exports = require("crypto").randomBytes;
  }
});

// node_modules/thunky/index.js
var require_thunky = __commonJS({
  "node_modules/thunky/index.js"(exports2, module2) {
    "use strict";
    var nextTick = nextTickArgs;
    process.nextTick(upgrade, 42);
    module2.exports = thunky;
    function thunky(fn) {
      var state = run;
      return thunk;
      function thunk(callback) {
        state(callback || noop);
      }
      function run(callback) {
        var stack = [callback];
        state = wait;
        fn(done);
        function wait(callback2) {
          stack.push(callback2);
        }
        function done(err) {
          var args = arguments;
          state = isError(err) ? run : finished;
          while (stack.length) finished(stack.shift());
          function finished(callback2) {
            nextTick(apply, callback2, args);
          }
        }
      }
    }
    function isError(err) {
      return Object.prototype.toString.call(err) === "[object Error]";
    }
    function noop() {
    }
    function apply(callback, args) {
      callback.apply(null, args);
    }
    function upgrade(val) {
      if (val === 42) nextTick = process.nextTick;
    }
    function nextTickArgs(fn, a, b) {
      process.nextTick(function() {
        fn(a, b);
      });
    }
  }
});

// node_modules/fs-chunk-store/index.js
var require_fs_chunk_store = __commonJS({
  "node_modules/fs-chunk-store/index.js"(exports2, module2) {
    module2.exports = Storage;
    var fs2 = require("fs");
    var mkdirp = require_mkdirp2();
    var os2 = require("os");
    var parallel = require_run_parallel();
    var path2 = require("path");
    var raf = require_random_access_file();
    var randombytes = require_randombytes();
    var rimraf = require_rimraf();
    var thunky = require_thunky();
    var TMP;
    try {
      TMP = fs2.statSync("/tmp") && "/tmp";
    } catch (err) {
      TMP = os2.tmpdir();
    }
    function Storage(chunkLength, opts) {
      var self2 = this;
      if (!(self2 instanceof Storage)) return new Storage(chunkLength, opts);
      if (!opts) opts = {};
      self2.chunkLength = Number(chunkLength);
      if (!self2.chunkLength) throw new Error("First argument must be a chunk length");
      if (opts.files) {
        if (!Array.isArray(opts.files)) {
          throw new Error("`files` option must be an array");
        }
        self2.files = opts.files.slice(0).map(function(file, i, files) {
          if (file.path == null) throw new Error("File is missing `path` property");
          if (file.length == null) throw new Error("File is missing `length` property");
          if (file.offset == null) {
            if (i === 0) {
              file.offset = 0;
            } else {
              var prevFile = files[i - 1];
              file.offset = prevFile.offset + prevFile.length;
            }
          }
          return file;
        });
        self2.length = self2.files.reduce(function(sum, file) {
          return sum + file.length;
        }, 0);
        if (opts.length != null && opts.length !== self2.length) {
          throw new Error("total `files` length is not equal to explicit `length` option");
        }
      } else {
        var len = Number(opts.length) || Infinity;
        self2.files = [{
          offset: 0,
          path: path2.resolve(opts.path || path2.join(TMP, "fs-chunk-store", randombytes(20).toString("hex"))),
          length: len
        }];
        self2.length = len;
      }
      self2.chunkMap = [];
      self2.closed = false;
      self2.files.forEach(function(file) {
        file.open = thunky(function(cb) {
          if (self2.closed) return cb(new Error("Storage is closed"));
          mkdirp(path2.dirname(file.path), function(err) {
            if (err) return cb(err);
            if (self2.closed) return cb(new Error("Storage is closed"));
            cb(null, raf(file.path));
          });
        });
      });
      if (self2.length !== Infinity) {
        self2.lastChunkLength = self2.length % self2.chunkLength || self2.chunkLength;
        self2.lastChunkIndex = Math.ceil(self2.length / self2.chunkLength) - 1;
        self2.files.forEach(function(file) {
          var fileStart = file.offset;
          var fileEnd = file.offset + file.length;
          var firstChunk = Math.floor(fileStart / self2.chunkLength);
          var lastChunk = Math.floor((fileEnd - 1) / self2.chunkLength);
          for (var p = firstChunk; p <= lastChunk; ++p) {
            var chunkStart = p * self2.chunkLength;
            var chunkEnd = chunkStart + self2.chunkLength;
            var from = fileStart < chunkStart ? 0 : fileStart - chunkStart;
            var to = fileEnd > chunkEnd ? self2.chunkLength : fileEnd - chunkStart;
            var offset = fileStart > chunkStart ? 0 : chunkStart - fileStart;
            if (!self2.chunkMap[p]) self2.chunkMap[p] = [];
            self2.chunkMap[p].push({
              from,
              to,
              offset,
              file
            });
          }
        });
      }
    }
    Storage.prototype.put = function(index, buf, cb) {
      var self2 = this;
      if (typeof cb !== "function") cb = noop;
      if (self2.closed) return nextTick(cb, new Error("Storage is closed"));
      var isLastChunk = index === self2.lastChunkIndex;
      if (isLastChunk && buf.length !== self2.lastChunkLength) {
        return nextTick(cb, new Error("Last chunk length must be " + self2.lastChunkLength));
      }
      if (!isLastChunk && buf.length !== self2.chunkLength) {
        return nextTick(cb, new Error("Chunk length must be " + self2.chunkLength));
      }
      if (self2.length === Infinity) {
        self2.files[0].open(function(err, file) {
          if (err) return cb(err);
          file.write(index * self2.chunkLength, buf, cb);
        });
      } else {
        var targets = self2.chunkMap[index];
        if (!targets) return nextTick(cb, new Error("no files matching the request range"));
        var tasks = targets.map(function(target) {
          return function(cb2) {
            target.file.open(function(err, file) {
              if (err) return cb2(err);
              file.write(target.offset, buf.slice(target.from, target.to), cb2);
            });
          };
        });
        parallel(tasks, cb);
      }
    };
    Storage.prototype.get = function(index, opts, cb) {
      var self2 = this;
      if (typeof opts === "function") return self2.get(index, null, opts);
      if (self2.closed) return nextTick(cb, new Error("Storage is closed"));
      var chunkLength = index === self2.lastChunkIndex ? self2.lastChunkLength : self2.chunkLength;
      var rangeFrom = opts && opts.offset || 0;
      var rangeTo = opts && opts.length ? rangeFrom + opts.length : chunkLength;
      if (rangeFrom < 0 || rangeFrom < 0 || rangeTo > chunkLength) {
        return nextTick(cb, new Error("Invalid offset and/or length"));
      }
      if (self2.length === Infinity) {
        if (rangeFrom === rangeTo) return nextTick(cb, null, Buffer.from(0));
        self2.files[0].open(function(err, file) {
          if (err) return cb(err);
          var offset = index * self2.chunkLength + rangeFrom;
          file.read(offset, rangeTo - rangeFrom, cb);
        });
      } else {
        var targets = self2.chunkMap[index];
        if (!targets) return nextTick(cb, new Error("no files matching the request range"));
        if (opts) {
          targets = targets.filter(function(target) {
            return target.to > rangeFrom && target.from < rangeTo;
          });
          if (targets.length === 0) {
            return nextTick(cb, new Error("no files matching the requested range"));
          }
        }
        if (rangeFrom === rangeTo) return nextTick(cb, null, Buffer.from(0));
        var tasks = targets.map(function(target) {
          return function(cb2) {
            var from = target.from;
            var to = target.to;
            var offset = target.offset;
            if (opts) {
              if (to > rangeTo) to = rangeTo;
              if (from < rangeFrom) {
                offset += rangeFrom - from;
                from = rangeFrom;
              }
            }
            target.file.open(function(err, file) {
              if (err) return cb2(err);
              file.read(offset, to - from, cb2);
            });
          };
        });
        parallel(tasks, function(err, buffers) {
          if (err) return cb(err);
          cb(null, Buffer.concat(buffers));
        });
      }
    };
    Storage.prototype.close = function(cb) {
      var self2 = this;
      if (self2.closed) return nextTick(cb, new Error("Storage is closed"));
      self2.closed = true;
      var tasks = self2.files.map(function(file) {
        return function(cb2) {
          file.open(function(err, file2) {
            if (err) return cb2(null);
            file2.close(cb2);
          });
        };
      });
      parallel(tasks, cb);
    };
    Storage.prototype.destroy = function(cb) {
      var self2 = this;
      self2.close(function() {
        var tasks = self2.files.map(function(file) {
          return function(cb2) {
            rimraf(file.path, { maxBusyTries: 10 }, cb2);
          };
        });
        parallel(tasks, cb);
      });
    };
    function nextTick(cb, err, val) {
      process.nextTick(function() {
        if (cb) cb(err, val);
      });
    }
    function noop() {
    }
  }
});

// node_modules/immediate-chunk-store/index.js
var require_immediate_chunk_store = __commonJS({
  "node_modules/immediate-chunk-store/index.js"(exports2, module2) {
    module2.exports = ImmediateStore;
    function ImmediateStore(store) {
      if (!(this instanceof ImmediateStore)) return new ImmediateStore(store);
      this.store = store;
      this.chunkLength = store.chunkLength;
      if (!this.store || !this.store.get || !this.store.put) {
        throw new Error("First argument must be abstract-chunk-store compliant");
      }
      this.mem = [];
    }
    ImmediateStore.prototype.put = function(index, buf, cb) {
      var self2 = this;
      self2.mem[index] = buf;
      self2.store.put(index, buf, function(err) {
        self2.mem[index] = null;
        if (cb) cb(err);
      });
    };
    ImmediateStore.prototype.get = function(index, opts, cb) {
      if (typeof opts === "function") return this.get(index, null, opts);
      var start = opts && opts.offset || 0;
      var end = opts && opts.length && start + opts.length;
      var buf = this.mem[index];
      if (buf) return nextTick(cb, null, opts ? buf.slice(start, end) : buf);
      this.store.get(index, opts, cb);
    };
    ImmediateStore.prototype.close = function(cb) {
      this.store.close(cb);
    };
    ImmediateStore.prototype.destroy = function(cb) {
      this.store.destroy(cb);
    };
    function nextTick(cb, err, val) {
      process.nextTick(function() {
        if (cb) cb(err, val);
      });
    }
  }
});

// node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/ms/index.js"(exports2, module2) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var y = d * 365.25;
    module2.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isNaN(val) === false) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      if (ms >= d) {
        return Math.round(ms / d) + "d";
      }
      if (ms >= h) {
        return Math.round(ms / h) + "h";
      }
      if (ms >= m) {
        return Math.round(ms / m) + "m";
      }
      if (ms >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      return plural(ms, d, "day") || plural(ms, h, "hour") || plural(ms, m, "minute") || plural(ms, s, "second") || ms + " ms";
    }
    function plural(ms, n, name) {
      if (ms < n) {
        return;
      }
      if (ms < n * 1.5) {
        return Math.floor(ms / n) + " " + name;
      }
      return Math.ceil(ms / n) + " " + name + "s";
    }
  }
});

// node_modules/debug/src/debug.js
var require_debug = __commonJS({
  "node_modules/debug/src/debug.js"(exports2, module2) {
    exports2 = module2.exports = createDebug.debug = createDebug["default"] = createDebug;
    exports2.coerce = coerce;
    exports2.disable = disable;
    exports2.enable = enable;
    exports2.enabled = enabled;
    exports2.humanize = require_ms();
    exports2.names = [];
    exports2.skips = [];
    exports2.formatters = {};
    var prevTime;
    function selectColor(namespace) {
      var hash = 0, i;
      for (i in namespace) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0;
      }
      return exports2.colors[Math.abs(hash) % exports2.colors.length];
    }
    function createDebug(namespace) {
      function debug() {
        if (!debug.enabled) return;
        var self2 = debug;
        var curr = +/* @__PURE__ */ new Date();
        var ms = curr - (prevTime || curr);
        self2.diff = ms;
        self2.prev = prevTime;
        self2.curr = curr;
        prevTime = curr;
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        args[0] = exports2.coerce(args[0]);
        if ("string" !== typeof args[0]) {
          args.unshift("%O");
        }
        var index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
          if (match === "%%") return match;
          index++;
          var formatter = exports2.formatters[format];
          if ("function" === typeof formatter) {
            var val = args[index];
            match = formatter.call(self2, val);
            args.splice(index, 1);
            index--;
          }
          return match;
        });
        exports2.formatArgs.call(self2, args);
        var logFn = debug.log || exports2.log || console.log.bind(console);
        logFn.apply(self2, args);
      }
      debug.namespace = namespace;
      debug.enabled = exports2.enabled(namespace);
      debug.useColors = exports2.useColors();
      debug.color = selectColor(namespace);
      if ("function" === typeof exports2.init) {
        exports2.init(debug);
      }
      return debug;
    }
    function enable(namespaces) {
      exports2.save(namespaces);
      exports2.names = [];
      exports2.skips = [];
      var split = (typeof namespaces === "string" ? namespaces : "").split(/[\s,]+/);
      var len = split.length;
      for (var i = 0; i < len; i++) {
        if (!split[i]) continue;
        namespaces = split[i].replace(/\*/g, ".*?");
        if (namespaces[0] === "-") {
          exports2.skips.push(new RegExp("^" + namespaces.substr(1) + "$"));
        } else {
          exports2.names.push(new RegExp("^" + namespaces + "$"));
        }
      }
    }
    function disable() {
      exports2.enable("");
    }
    function enabled(name) {
      var i, len;
      for (i = 0, len = exports2.skips.length; i < len; i++) {
        if (exports2.skips[i].test(name)) {
          return false;
        }
      }
      for (i = 0, len = exports2.names.length; i < len; i++) {
        if (exports2.names[i].test(name)) {
          return true;
        }
      }
      return false;
    }
    function coerce(val) {
      if (val instanceof Error) return val.stack || val.message;
      return val;
    }
  }
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "node_modules/debug/src/browser.js"(exports2, module2) {
    exports2 = module2.exports = require_debug();
    exports2.log = log2;
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.storage = "undefined" != typeof chrome && "undefined" != typeof chrome.storage ? chrome.storage.local : localstorage();
    exports2.colors = [
      "lightseagreen",
      "forestgreen",
      "goldenrod",
      "dodgerblue",
      "darkorchid",
      "crimson"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && window.process.type === "renderer") {
        return true;
      }
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31 || // double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    exports2.formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (err) {
        return "[UnexpectedJSONParseError]: " + err.message;
      }
    };
    function formatArgs(args) {
      var useColors2 = this.useColors;
      args[0] = (useColors2 ? "%c" : "") + this.namespace + (useColors2 ? " %c" : " ") + args[0] + (useColors2 ? "%c " : " ") + "+" + exports2.humanize(this.diff);
      if (!useColors2) return;
      var c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      var index = 0;
      var lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, function(match) {
        if ("%%" === match) return;
        index++;
        if ("%c" === match) {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    function log2() {
      return "object" === typeof console && console.log && Function.prototype.apply.call(console.log, console, arguments);
    }
    function save(namespaces) {
      try {
        if (null == namespaces) {
          exports2.storage.removeItem("debug");
        } else {
          exports2.storage.debug = namespaces;
        }
      } catch (e) {
      }
    }
    function load() {
      var r;
      try {
        r = exports2.storage.debug;
      } catch (e) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    exports2.enable(load());
    function localstorage() {
      try {
        return window.localStorage;
      } catch (e) {
      }
    }
  }
});

// node_modules/debug/src/node.js
var require_node = __commonJS({
  "node_modules/debug/src/node.js"(exports2, module2) {
    var tty = require("tty");
    var util = require("util");
    exports2 = module2.exports = require_debug();
    exports2.init = init;
    exports2.log = log2;
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.colors = [6, 2, 3, 4, 5, 1];
    exports2.inspectOpts = Object.keys(process.env).filter(function(key) {
      return /^debug_/i.test(key);
    }).reduce(function(obj, key) {
      var prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, function(_, k) {
        return k.toUpperCase();
      });
      var val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) val = true;
      else if (/^(no|off|false|disabled)$/i.test(val)) val = false;
      else if (val === "null") val = null;
      else val = Number(val);
      obj[prop] = val;
      return obj;
    }, {});
    var fd = parseInt(process.env.DEBUG_FD, 10) || 2;
    if (1 !== fd && 2 !== fd) {
      util.deprecate(function() {
      }, "except for stderr(2) and stdout(1), any other usage of DEBUG_FD is deprecated. Override debug.log if you want to use a different log function (https://git.io/debug_fd)")();
    }
    var stream = 1 === fd ? process.stdout : 2 === fd ? process.stderr : createWritableStdioStream(fd);
    function useColors() {
      return "colors" in exports2.inspectOpts ? Boolean(exports2.inspectOpts.colors) : tty.isatty(fd);
    }
    exports2.formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map(function(str) {
        return str.trim();
      }).join(" ");
    };
    exports2.formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
    function formatArgs(args) {
      var name = this.namespace;
      var useColors2 = this.useColors;
      if (useColors2) {
        var c = this.color;
        var prefix = "  \x1B[3" + c + ";1m" + name + " \x1B[0m";
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push("\x1B[3" + c + "m+" + exports2.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = (/* @__PURE__ */ new Date()).toUTCString() + " " + name + " " + args[0];
      }
    }
    function log2() {
      return stream.write(util.format.apply(util, arguments) + "\n");
    }
    function save(namespaces) {
      if (null == namespaces) {
        delete process.env.DEBUG;
      } else {
        process.env.DEBUG = namespaces;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function createWritableStdioStream(fd2) {
      var stream2;
      var tty_wrap = process.binding("tty_wrap");
      switch (tty_wrap.guessHandleType(fd2)) {
        case "TTY":
          stream2 = new tty.WriteStream(fd2);
          stream2._type = "tty";
          if (stream2._handle && stream2._handle.unref) {
            stream2._handle.unref();
          }
          break;
        case "FILE":
          var fs2 = require("fs");
          stream2 = new fs2.SyncWriteStream(fd2, { autoClose: false });
          stream2._type = "fs";
          break;
        case "PIPE":
        case "TCP":
          var net = require("net");
          stream2 = new net.Socket({
            fd: fd2,
            readable: false,
            writable: true
          });
          stream2.readable = false;
          stream2.read = null;
          stream2._type = "pipe";
          if (stream2._handle && stream2._handle.unref) {
            stream2._handle.unref();
          }
          break;
        default:
          throw new Error("Implement me. Unknown stream file type!");
      }
      stream2.fd = fd2;
      stream2._isStdio = true;
      return stream2;
    }
    function init(debug) {
      debug.inspectOpts = {};
      var keys = Object.keys(exports2.inspectOpts);
      for (var i = 0; i < keys.length; i++) {
        debug.inspectOpts[keys[i]] = exports2.inspectOpts[keys[i]];
      }
    }
    exports2.enable(load());
  }
});

// node_modules/debug/src/index.js
var require_src = __commonJS({
  "node_modules/debug/src/index.js"(exports2, module2) {
    if (typeof process !== "undefined" && process.type === "renderer") {
      module2.exports = require_browser();
    } else {
      module2.exports = require_node();
    }
  }
});

// node_modules/k-rpc-socket/node_modules/bencode/lib/util.js
var require_util2 = __commonJS({
  "node_modules/k-rpc-socket/node_modules/bencode/lib/util.js"(exports2, module2) {
    var util = module2.exports;
    util.digitCount = function digitCount(value) {
      const sign = value < 0 ? 1 : 0;
      value = Math.abs(Number(value || 1));
      return Math.floor(Math.log10(value)) + 1 + sign;
    };
    util.getType = function getType(value) {
      if (Buffer.isBuffer(value)) return "buffer";
      if (ArrayBuffer.isView(value)) return "arraybufferview";
      if (Array.isArray(value)) return "array";
      if (value instanceof Number) return "number";
      if (value instanceof Boolean) return "boolean";
      if (value instanceof Set) return "set";
      if (value instanceof Map) return "map";
      if (value instanceof String) return "string";
      if (value instanceof ArrayBuffer) return "arraybuffer";
      return typeof value;
    };
  }
});

// node_modules/k-rpc-socket/node_modules/bencode/lib/encode.js
var require_encode2 = __commonJS({
  "node_modules/k-rpc-socket/node_modules/bencode/lib/encode.js"(exports2, module2) {
    var { getType } = require_util2();
    function encode(data, buffer, offset) {
      const buffers = [];
      let result = null;
      encode._encode(buffers, data);
      result = Buffer.concat(buffers);
      encode.bytes = result.length;
      if (Buffer.isBuffer(buffer)) {
        result.copy(buffer, offset);
        return buffer;
      }
      return result;
    }
    encode.bytes = -1;
    encode._floatConversionDetected = false;
    encode._encode = function(buffers, data) {
      if (data == null) {
        return;
      }
      switch (getType(data)) {
        case "buffer":
          encode.buffer(buffers, data);
          break;
        case "object":
          encode.dict(buffers, data);
          break;
        case "map":
          encode.dictMap(buffers, data);
          break;
        case "array":
          encode.list(buffers, data);
          break;
        case "set":
          encode.listSet(buffers, data);
          break;
        case "string":
          encode.string(buffers, data);
          break;
        case "number":
          encode.number(buffers, data);
          break;
        case "boolean":
          encode.number(buffers, data);
          break;
        case "arraybufferview":
          encode.buffer(buffers, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
          break;
        case "arraybuffer":
          encode.buffer(buffers, Buffer.from(data));
          break;
      }
    };
    var buffE = Buffer.from("e");
    var buffD = Buffer.from("d");
    var buffL = Buffer.from("l");
    encode.buffer = function(buffers, data) {
      buffers.push(Buffer.from(data.length + ":"), data);
    };
    encode.string = function(buffers, data) {
      buffers.push(Buffer.from(Buffer.byteLength(data) + ":" + data));
    };
    encode.number = function(buffers, data) {
      const maxLo = 2147483648;
      const hi = data / maxLo << 0;
      const lo = data % maxLo << 0;
      const val = hi * maxLo + lo;
      buffers.push(Buffer.from("i" + val + "e"));
      if (val !== data && !encode._floatConversionDetected) {
        encode._floatConversionDetected = true;
        console.warn(
          'WARNING: Possible data corruption detected with value "' + data + '":',
          'Bencoding only defines support for integers, value was converted to "' + val + '"'
        );
        console.trace();
      }
    };
    encode.dict = function(buffers, data) {
      buffers.push(buffD);
      let j = 0;
      let k;
      const keys = Object.keys(data).sort();
      const kl = keys.length;
      for (; j < kl; j++) {
        k = keys[j];
        if (data[k] == null) continue;
        encode.string(buffers, k);
        encode._encode(buffers, data[k]);
      }
      buffers.push(buffE);
    };
    encode.dictMap = function(buffers, data) {
      buffers.push(buffD);
      const keys = Array.from(data.keys()).sort();
      for (const key of keys) {
        if (data.get(key) == null) continue;
        Buffer.isBuffer(key) ? encode._encode(buffers, key) : encode.string(buffers, String(key));
        encode._encode(buffers, data.get(key));
      }
      buffers.push(buffE);
    };
    encode.list = function(buffers, data) {
      let i = 0;
      const c = data.length;
      buffers.push(buffL);
      for (; i < c; i++) {
        if (data[i] == null) continue;
        encode._encode(buffers, data[i]);
      }
      buffers.push(buffE);
    };
    encode.listSet = function(buffers, data) {
      buffers.push(buffL);
      for (const item of data) {
        if (item == null) continue;
        encode._encode(buffers, item);
      }
      buffers.push(buffE);
    };
    module2.exports = encode;
  }
});

// node_modules/k-rpc-socket/node_modules/bencode/lib/decode.js
var require_decode2 = __commonJS({
  "node_modules/k-rpc-socket/node_modules/bencode/lib/decode.js"(exports2, module2) {
    var INTEGER_START = 105;
    var STRING_DELIM = 58;
    var DICTIONARY_START = 100;
    var LIST_START = 108;
    var END_OF_TYPE = 101;
    function getIntFromBuffer(buffer, start, end) {
      let sum = 0;
      let sign = 1;
      for (let i = start; i < end; i++) {
        const num = buffer[i];
        if (num < 58 && num >= 48) {
          sum = sum * 10 + (num - 48);
          continue;
        }
        if (i === start && num === 43) {
          continue;
        }
        if (i === start && num === 45) {
          sign = -1;
          continue;
        }
        if (num === 46) {
          break;
        }
        throw new Error("not a number: buffer[" + i + "] = " + num);
      }
      return sum * sign;
    }
    function decode(data, start, end, encoding) {
      if (data == null || data.length === 0) {
        return null;
      }
      if (typeof start !== "number" && encoding == null) {
        encoding = start;
        start = void 0;
      }
      if (typeof end !== "number" && encoding == null) {
        encoding = end;
        end = void 0;
      }
      decode.position = 0;
      decode.encoding = encoding || null;
      decode.data = !Buffer.isBuffer(data) ? Buffer.from(data) : data.slice(start, end);
      decode.bytes = decode.data.length;
      return decode.next();
    }
    decode.bytes = 0;
    decode.position = 0;
    decode.data = null;
    decode.encoding = null;
    decode.next = function() {
      switch (decode.data[decode.position]) {
        case DICTIONARY_START:
          return decode.dictionary();
        case LIST_START:
          return decode.list();
        case INTEGER_START:
          return decode.integer();
        default:
          return decode.buffer();
      }
    };
    decode.find = function(chr) {
      let i = decode.position;
      const c = decode.data.length;
      const d = decode.data;
      while (i < c) {
        if (d[i] === chr) return i;
        i++;
      }
      throw new Error(
        'Invalid data: Missing delimiter "' + String.fromCharCode(chr) + '" [0x' + chr.toString(16) + "]"
      );
    };
    decode.dictionary = function() {
      decode.position++;
      const dict = {};
      while (decode.data[decode.position] !== END_OF_TYPE) {
        dict[decode.buffer()] = decode.next();
      }
      decode.position++;
      return dict;
    };
    decode.list = function() {
      decode.position++;
      const lst = [];
      while (decode.data[decode.position] !== END_OF_TYPE) {
        lst.push(decode.next());
      }
      decode.position++;
      return lst;
    };
    decode.integer = function() {
      const end = decode.find(END_OF_TYPE);
      const number = getIntFromBuffer(decode.data, decode.position + 1, end);
      decode.position += end + 1 - decode.position;
      return number;
    };
    decode.buffer = function() {
      let sep = decode.find(STRING_DELIM);
      const length = getIntFromBuffer(decode.data, decode.position, sep);
      const end = ++sep + length;
      decode.position = end;
      return decode.encoding ? decode.data.toString(decode.encoding, sep, end) : decode.data.slice(sep, end);
    };
    module2.exports = decode;
  }
});

// node_modules/k-rpc-socket/node_modules/bencode/lib/encoding-length.js
var require_encoding_length = __commonJS({
  "node_modules/k-rpc-socket/node_modules/bencode/lib/encoding-length.js"(exports2, module2) {
    var { digitCount, getType } = require_util2();
    function listLength(list) {
      let length = 1 + 1;
      for (const value of list) {
        length += encodingLength(value);
      }
      return length;
    }
    function mapLength(map) {
      let length = 1 + 1;
      for (const [key, value] of map) {
        const keyLength = Buffer.byteLength(key);
        length += digitCount(keyLength) + 1 + keyLength;
        length += encodingLength(value);
      }
      return length;
    }
    function objectLength(value) {
      let length = 1 + 1;
      const keys = Object.keys(value);
      for (let i = 0; i < keys.length; i++) {
        const keyLength = Buffer.byteLength(keys[i]);
        length += digitCount(keyLength) + 1 + keyLength;
        length += encodingLength(value[keys[i]]);
      }
      return length;
    }
    function stringLength(value) {
      const length = Buffer.byteLength(value);
      return digitCount(length) + 1 + length;
    }
    function arrayBufferLength(value) {
      const length = value.byteLength - value.byteOffset;
      return digitCount(length) + 1 + length;
    }
    function encodingLength(value) {
      const length = 0;
      if (value == null) return length;
      const type = getType(value);
      switch (type) {
        case "buffer":
          return digitCount(value.length) + 1 + value.length;
        case "arraybufferview":
          return arrayBufferLength(value);
        case "string":
          return stringLength(value);
        case "array":
        case "set":
          return listLength(value);
        case "number":
          return 1 + digitCount(Math.floor(value)) + 1;
        case "bigint":
          return 1 + value.toString().length + 1;
        case "object":
          return objectLength(value);
        case "map":
          return mapLength(value);
        default:
          throw new TypeError(`Unsupported value of type "${type}"`);
      }
    }
    module2.exports = encodingLength;
  }
});

// node_modules/k-rpc-socket/node_modules/bencode/lib/index.js
var require_lib = __commonJS({
  "node_modules/k-rpc-socket/node_modules/bencode/lib/index.js"(exports2, module2) {
    var bencode = module2.exports;
    bencode.encode = require_encode2();
    bencode.decode = require_decode2();
    bencode.byteLength = bencode.encodingLength = require_encoding_length();
  }
});

// node_modules/k-rpc-socket/index.js
var require_k_rpc_socket = __commonJS({
  "node_modules/k-rpc-socket/index.js"(exports2, module2) {
    var dgram = require("dgram");
    var bencode = require_lib();
    var isIP = require("net").isIP;
    var dns = require("dns");
    var util = require("util");
    var events = require("events");
    var ETIMEDOUT = new Error("Query timed out");
    ETIMEDOUT.code = "ETIMEDOUT";
    var EUNEXPECTEDNODE = new Error("Unexpected node id");
    EUNEXPECTEDNODE.code = "EUNEXPECTEDNODE";
    module2.exports = RPC;
    function RPC(opts) {
      if (!(this instanceof RPC)) return new RPC(opts);
      if (!opts) opts = {};
      var self2 = this;
      this.timeout = opts.timeout || 2e3;
      this.inflight = 0;
      this.destroyed = false;
      this.isIP = opts.isIP || isIP;
      this.socket = opts.socket || dgram.createSocket("udp4");
      this.socket.on("message", onmessage);
      this.socket.on("error", onerror);
      this.socket.on("listening", onlistening);
      this._tick = 0;
      this._ids = [];
      this._reqs = [];
      this._timer = setInterval(check, Math.floor(this.timeout / 4));
      events.EventEmitter.call(this);
      function check() {
        var missing = self2.inflight;
        if (!missing) return;
        for (var i = 0; i < self2._reqs.length; i++) {
          var req = self2._reqs[i];
          if (!req) continue;
          if (req.ttl) req.ttl--;
          else self2._cancel(i, ETIMEDOUT);
          if (!--missing) return;
        }
      }
      function onlistening() {
        self2.emit("listening");
      }
      function onerror(err) {
        if (err.code === "EACCES" || err.code === "EADDRINUSE") self2.emit("error", err);
        else self2.emit("warning", err);
      }
      function onmessage(buf, rinfo) {
        if (self2.destroyed) return;
        if (!rinfo.port) return;
        try {
          var message = bencode.decode(buf);
        } catch (e) {
          return self2.emit("warning", e);
        }
        var type = message && message.y && message.y.toString();
        if (type === "r" || type === "e") {
          if (!Buffer.isBuffer(message.t)) return;
          try {
            var tid = message.t.readUInt16BE(0);
          } catch (err2) {
            return self2.emit("warning", err2);
          }
          var index = self2._ids.indexOf(tid);
          if (index === -1 || tid === 0) {
            self2.emit("response", message, rinfo);
            self2.emit("warning", new Error("Unexpected transaction id: " + tid));
            return;
          }
          var req = self2._reqs[index];
          if (req.peer.host !== rinfo.address) {
            self2.emit("response", message, rinfo);
            self2.emit("warning", new Error("Out of order response"));
            return;
          }
          self2._ids[index] = 0;
          self2._reqs[index] = null;
          self2.inflight--;
          if (type === "e") {
            var isArray = Array.isArray(message.e);
            var err = new Error(isArray ? message.e.join(" ") : "Unknown error");
            err.code = isArray && message.e.length && typeof message.e[0] === "number" ? message.e[0] : 0;
            req.callback(err, message, rinfo, req.message);
            self2.emit("update");
            self2.emit("postupdate");
            return;
          }
          var rid = message.r && message.r.id;
          if (req.peer && req.peer.id && rid && !req.peer.id.equals(rid)) {
            req.callback(EUNEXPECTEDNODE, null, rinfo);
            self2.emit("update");
            self2.emit("postupdate");
            return;
          }
          req.callback(null, message, rinfo, req.message);
          self2.emit("update");
          self2.emit("postupdate");
          self2.emit("response", message, rinfo);
        } else if (type === "q") {
          self2.emit("query", message, rinfo);
        } else {
          self2.emit("warning", new Error("Unknown type: " + type));
        }
      }
    }
    util.inherits(RPC, events.EventEmitter);
    RPC.prototype.address = function() {
      return this.socket.address();
    };
    RPC.prototype.response = function(peer, req, res, cb) {
      this.send(peer, { t: req.t, y: "r", r: res }, cb);
    };
    RPC.prototype.error = function(peer, req, error, cb) {
      this.send(peer, { t: req.t, y: "e", e: [].concat(error.message || error) }, cb);
    };
    RPC.prototype.send = function(peer, message, cb) {
      var buf = bencode.encode(message);
      this.socket.send(buf, 0, buf.length, peer.port, peer.address || peer.host, cb || noop);
    };
    RPC.prototype.bind = function() {
      this.socket.bind.apply(this.socket, arguments);
    };
    RPC.prototype.destroy = function(cb) {
      this.destroyed = true;
      clearInterval(this._timer);
      if (cb) this.socket.on("close", cb);
      for (var i = 0; i < this._ids.length; i++) this._cancel(i);
      this.socket.close();
    };
    RPC.prototype.query = function(peer, query, cb) {
      if (!cb) cb = noop;
      if (!this.isIP(peer.host)) return this._resolveAndQuery(peer, query, cb);
      var message = {
        t: Buffer.allocUnsafe(2),
        y: "q",
        q: query.q,
        a: query.a
      };
      var req = {
        ttl: 4,
        peer,
        message,
        callback: cb
      };
      if (this._tick === 65535) this._tick = 0;
      var tid = ++this._tick;
      var free = this._ids.indexOf(0);
      if (free === -1) free = this._ids.push(0) - 1;
      this._ids[free] = tid;
      while (this._reqs.length < free) this._reqs.push(null);
      this._reqs[free] = req;
      this.inflight++;
      message.t.writeUInt16BE(tid, 0);
      this.send(peer, message);
      return tid;
    };
    RPC.prototype.cancel = function(tid, err) {
      var index = this._ids.indexOf(tid);
      if (index > -1) this._cancel(index, err);
    };
    RPC.prototype._cancel = function(index, err) {
      var req = this._reqs[index];
      this._ids[index] = 0;
      this._reqs[index] = null;
      if (req) {
        this.inflight--;
        req.callback(err || new Error("Query was cancelled"), null, req.peer);
        this.emit("update");
        this.emit("postupdate");
      }
    };
    RPC.prototype._resolveAndQuery = function(peer, query, cb) {
      var self2 = this;
      dns.lookup(peer.host, function(err, ip) {
        if (err) return cb(err);
        if (self2.destroyed) return cb(new Error("k-rpc-socket is destroyed"));
        self2.query({ host: ip, port: peer.port }, query, cb);
      });
    };
    function noop() {
    }
  }
});

// node_modules/buffer-equal/index.js
var require_buffer_equal = __commonJS({
  "node_modules/buffer-equal/index.js"(exports2, module2) {
    var Buffer2 = require("buffer").Buffer;
    module2.exports = function(a, b) {
      if (!Buffer2.isBuffer(a)) return void 0;
      if (!Buffer2.isBuffer(b)) return void 0;
      if (typeof a.equals === "function") return a.equals(b);
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    };
  }
});

// node_modules/k-rpc/node_modules/k-bucket/index.js
var require_k_bucket = __commonJS({
  "node_modules/k-rpc/node_modules/k-bucket/index.js"(exports2, module2) {
    "use strict";
    var bufferEqual = require_buffer_equal();
    var randomBytes = require_randombytes();
    var KBucket = module2.exports = function KBucket2(options) {
      var self2 = this;
      options = options || {};
      self2.arbiter = options.arbiter || function arbiter(incumbent, candidate) {
        if (incumbent.vectorClock > candidate.vectorClock) {
          return incumbent;
        }
        return candidate;
      };
      self2.bucket = [];
      self2.localNodeId = options.localNodeId || randomBytes(20);
      if (!Buffer.isBuffer(self2.localNodeId)) {
        throw new TypeError("localNodeId is not a Buffer");
      }
      self2.numberOfNodesPerKBucket = options.numberOfNodesPerKBucket || 20;
      self2.numberOfNodesToPing = options.numberOfNodesToPing || 3;
      self2.ping = options.ping || function() {
      };
      self2.dontSplit = null;
      self2.low = null;
      self2.high = null;
    };
    KBucket.distance = function distance(firstId, secondId) {
      var distance2 = 0;
      var min = Math.min(firstId.length, secondId.length);
      var max = Math.max(firstId.length, secondId.length);
      for (var i = 0; i < min; ++i) {
        distance2 = distance2 * 256 + (firstId[i] ^ secondId[i]);
      }
      for (; i < max; ++i) {
        distance2 = distance2 * 256 + 255;
      }
      return distance2;
    };
    KBucket.prototype.add = function add(contact, bitIndex) {
      var self2 = this;
      if (!self2.bucket) {
        bitIndex = bitIndex || 0;
        if (self2.determineBucket(contact.id, bitIndex++) < 0) {
          return self2.low.add(contact, bitIndex);
        } else {
          return self2.high.add(contact, bitIndex);
        }
      }
      var index = self2.indexOf(contact);
      if (index >= 0) {
        self2.update(contact, index);
        return self2;
      }
      if (self2.bucket.length < self2.numberOfNodesPerKBucket) {
        self2.bucket.push(contact);
        return self2;
      }
      if (self2.dontSplit) {
        self2.ping(self2.bucket.slice(0, self2.numberOfNodesToPing), contact);
        return self2;
      }
      return self2.splitAndAdd(contact, bitIndex);
    };
    KBucket.prototype.closest = function closest(contact, n, bitIndex) {
      var self2 = this;
      var contacts;
      if (!self2.bucket) {
        bitIndex = bitIndex || 0;
        if (self2.determineBucket(contact.id, bitIndex++) < 0) {
          contacts = self2.low.closest(contact, n, bitIndex);
          if (contacts.length < n) {
            contacts = contacts.concat(self2.high.closest(contact, n, bitIndex));
          }
        } else {
          contacts = self2.high.closest(contact, n, bitIndex);
          if (contacts.length < n) {
            contacts = contacts.concat(self2.low.closest(contact, n, bitIndex));
          }
        }
        return contacts.slice(0, n);
      }
      contacts = self2.bucket.slice();
      contacts.forEach(function(storedContact) {
        storedContact.distance = KBucket.distance(storedContact.id, contact.id);
      });
      contacts.sort(function(a, b) {
        return a.distance - b.distance;
      });
      return contacts.slice(0, n);
    };
    KBucket.prototype.count = function count() {
      var self2 = this;
      if (self2.bucket) {
        return self2.bucket.length;
      } else {
        return self2.high.count() + self2.low.count();
      }
    };
    KBucket.prototype.determineBucket = function determineBucket(id, bitIndex) {
      var self2 = this;
      bitIndex = bitIndex || 0;
      var bytesDescribedByBitIndex = parseInt(bitIndex / 8, 10);
      var bitIndexWithinByte = bitIndex % 8;
      if (id.length <= bytesDescribedByBitIndex && bitIndexWithinByte != 0)
        return -1;
      var byteUnderConsideration = id[bytesDescribedByBitIndex];
      if (byteUnderConsideration & Math.pow(2, 7 - bitIndexWithinByte)) {
        return 1;
      }
      return -1;
    };
    KBucket.prototype.get = function get(id, bitIndex) {
      var self2 = this;
      if (!self2.bucket) {
        bitIndex = bitIndex || 0;
        if (self2.determineBucket(id, bitIndex++) < 0) {
          return self2.low.get(id, bitIndex);
        } else {
          return self2.high.get(id, bitIndex);
        }
      }
      var index = self2.indexOf({ id });
      if (index < 0) {
        return null;
      }
      return self2.bucket[index];
    };
    KBucket.prototype.indexOf = function indexOf(contact) {
      var self2 = this;
      for (var i = 0; i < self2.bucket.length; i++) {
        if (bufferEqual(self2.bucket[i].id, contact.id)) return i;
      }
      return -1;
    };
    KBucket.prototype.remove = function remove(contact, bitIndex) {
      var self2 = this;
      if (!self2.bucket) {
        bitIndex = bitIndex || 0;
        if (self2.determineBucket(contact.id, bitIndex++) < 0) {
          return self2.low.remove(contact, bitIndex);
        } else {
          return self2.high.remove(contact, bitIndex);
        }
      }
      var index = self2.indexOf(contact);
      if (index >= 0) self2.bucket.splice(index, 1);
      return self2;
    };
    KBucket.prototype.splitAndAdd = function splitAndAdd(contact, bitIndex) {
      var self2 = this;
      self2.low = new KBucket({
        arbiter: self2.arbiter,
        localNodeId: self2.localNodeId,
        numberOfNodesPerKBucket: self2.numberOfNodesPerKBucket,
        numberOfNodesToPing: self2.numberOfNodesToPing,
        ping: self2.ping
      });
      self2.high = new KBucket({
        arbiter: self2.arbiter,
        localNodeId: self2.localNodeId,
        numberOfNodesPerKBucket: self2.numberOfNodesPerKBucket,
        numberOfNodesToPing: self2.numberOfNodesToPing,
        ping: self2.ping
      });
      bitIndex = bitIndex || 0;
      self2.bucket.forEach(function(storedContact) {
        if (self2.determineBucket(storedContact.id, bitIndex) < 0) {
          self2.low.add(storedContact);
        } else {
          self2.high.add(storedContact);
        }
      });
      self2.bucket = void 0;
      if (self2.determineBucket(self2.localNodeId, bitIndex) < 0) {
        self2.high.dontSplit = true;
      } else {
        self2.low.dontSplit = true;
      }
      self2.add(contact, bitIndex);
      return self2;
    };
    KBucket.prototype.toArray = function toArray() {
      var self2 = this;
      if (self2.bucket) {
        return self2.bucket.slice(0);
      } else {
        return self2.low.toArray().concat(self2.high.toArray());
      }
    };
    KBucket.prototype.update = function update(contact, index) {
      var self2 = this;
      if (!bufferEqual(self2.bucket[index].id, contact.id)) {
        throw new Error("indexOf() calculation resulted in wrong index");
      }
      var incumbent = self2.bucket[index];
      var selection = self2.arbiter(incumbent, contact);
      if (selection === incumbent && incumbent !== contact) {
        return;
      }
      self2.bucket.splice(index, 1);
      self2.bucket.push(selection);
    };
  }
});

// node_modules/buffer-equals/index.js
var require_buffer_equals = __commonJS({
  "node_modules/buffer-equals/index.js"(exports2, module2) {
    "use strict";
    module2.exports = function(a, b) {
      if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
        throw new TypeError("Arguments must be Buffers");
      }
      if (a === b) {
        return true;
      }
      if (typeof a.equals === "function") {
        return a.equals(b);
      }
      if (a.length !== b.length) {
        return false;
      }
      for (var i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          return false;
        }
      }
      return true;
    };
  }
});

// node_modules/k-rpc/index.js
var require_k_rpc = __commonJS({
  "node_modules/k-rpc/index.js"(exports2, module2) {
    var socket = require_k_rpc_socket();
    var KBucket = require_k_bucket();
    var equals = require_buffer_equals();
    var crypto = require("crypto");
    var events = require("events");
    var util = require("util");
    var K = 20;
    var MAX_CONCURRENCY = 16;
    var BOOTSTRAP_NODES = [
      { host: "router.bittorrent.com", port: 6881 },
      { host: "router.utorrent.com", port: 6881 },
      { host: "dht.transmissionbt.com", port: 6881 }
    ];
    module2.exports = RPC;
    function RPC(opts) {
      if (!(this instanceof RPC)) return new RPC(opts);
      if (!opts) opts = {};
      var self2 = this;
      this.id = toBuffer(opts.id || opts.nodeId || crypto.randomBytes(20));
      this.socket = socket(opts);
      this.bootstrap = toBootstrapArray(opts.nodes || opts.bootstrap);
      this.concurrency = opts.concurrency || MAX_CONCURRENCY;
      this.backgroundConcurrency = opts.backgroundConcurrency || this.concurrency / 4 | 0;
      this.k = opts.k || K;
      this.destroyed = false;
      this.pending = [];
      this.nodes = null;
      this.socket.on("query", onquery);
      this.socket.on("response", onresponse);
      this.socket.on("warning", onwarning);
      this.socket.on("error", onerror);
      this.socket.on("update", onupdate);
      this.socket.on("listening", onlistening);
      events.EventEmitter.call(this);
      this.clear();
      function onupdate() {
        while (self2.pending.length && self2.socket.inflight < self2.concurrency) {
          var next = self2.pending.shift();
          self2.query(next[0], next[1], next[2]);
        }
      }
      function onerror(err) {
        self2.emit("error", err);
      }
      function onlistening() {
        self2.emit("listening");
      }
      function onwarning(err) {
        self2.emit("warning", err);
      }
      function onquery(query, peer) {
        addNode(query.a, peer);
        self2.emit("query", query, peer);
      }
      function onresponse(reply, peer) {
        addNode(reply.r, peer);
      }
      function addNode(data, peer) {
        if (data && isNodeId(data.id) && !self2.nodes.get(data.id)) {
          self2._addNode({
            id: data.id,
            host: peer.address || peer.host,
            port: peer.port,
            distance: 0
          });
        }
      }
    }
    util.inherits(RPC, events.EventEmitter);
    RPC.prototype.response = function(node, query, response, nodes, cb) {
      if (typeof nodes === "function") {
        cb = nodes;
        nodes = null;
      }
      if (!response.id) response.id = this.id;
      if (nodes) response.nodes = encodeNodes(nodes);
      this.socket.response(node, query, response, cb);
    };
    RPC.prototype.error = function(node, query, error, cb) {
      this.socket.error(node, query, error, cb);
    };
    RPC.prototype.bind = function(port, cb) {
      this.socket.bind(port, cb);
    };
    RPC.prototype.address = function() {
      return this.socket.address();
    };
    RPC.prototype.queryAll = function(nodes, message, visit, cb) {
      if (!message.a) message.a = {};
      if (!message.a.id) message.a.id = this.id;
      var stop2 = false;
      var missing = nodes.length;
      var hits = 0;
      var error = null;
      if (!missing) return cb(new Error("No nodes to query"), 0);
      for (var i = 0; i < nodes.length; i++) {
        this.query(nodes[i], message, done);
      }
      function done(err, res, peer) {
        if (!err) hits++;
        else if (err.code >= 300 && err.code < 400) error = err;
        if (!err && !stop2) {
          if (visit && visit(res, peer) === false) stop2 = true;
        }
        if (!--missing) cb(hits ? null : error || new Error("All queries failed"), hits);
      }
    };
    RPC.prototype.query = function(node, message, cb) {
      if (this.socket.inflight >= this.concurrency) {
        this.pending.push([node, message, cb]);
      } else {
        if (!message.a) message.a = {};
        if (!message.a.id) message.a.id = this.id;
        if (node.token) message.a.token = node.token;
        this.socket.query(node, message, cb);
      }
    };
    RPC.prototype.destroy = function(cb) {
      this.destroyed = true;
      this.socket.destroy(cb);
    };
    RPC.prototype.clear = function() {
      var self2 = this;
      this.nodes = new KBucket({
        localNodeId: this.id,
        numberOfNodesPerKBucket: this.k,
        numberOfNodesToPing: this.concurrency,
        ping: onping
      });
      function onping(older, newer) {
        self2.emit("ping", older, newer);
      }
    };
    RPC.prototype.populate = function(target, message, cb) {
      this._closest(target, message, true, null, cb);
    };
    RPC.prototype.closest = function(target, message, visit, cb) {
      this._closest(target, message, false, visit, cb);
    };
    RPC.prototype._addNode = function(node) {
      var old = this.nodes.get(node.id);
      this.nodes.add(node);
      if (!old) this.emit("node", node);
    };
    RPC.prototype._closest = function(target, message, background, visit, cb) {
      if (!cb) cb = noop;
      var self2 = this;
      var count = 0;
      var queried = {};
      var pending = 0;
      var once = true;
      var stop2 = false;
      if (!message.a) message.a = {};
      if (!message.a.id) message.a.id = this.id;
      var table = new KBucket({
        localNodeId: target,
        numberOfNodesPerKBucket: this.k,
        numberOfNodesToPing: this.concurrency
      });
      var evt = background ? "postupdate" : "update";
      this.socket.on(evt, kick);
      kick();
      function kick() {
        if (self2.destroyed || self2.socket.inflight >= self2.concurrency) return;
        var otherInflight = self2.pending.length + self2.socket.inflight - pending;
        if (background && self2.socket.inflight >= self2.backgroundConcurrency && otherInflight) return;
        var closest = table.closest({ id: target }, self2.k);
        if (!closest.length || closest.length < self2.bootstrap.length) {
          closest = self2.nodes.closest({ id: target }, self2.k);
          if (!closest.length || closest.length < self2.bootstrap.length) bootstrap();
        }
        for (var i = 0; i < closest.length; i++) {
          if (stop2) break;
          if (self2.socket.inflight >= self2.concurrency) return;
          var peer = closest[i];
          var id = peer.host + ":" + peer.port;
          if (queried[id]) continue;
          queried[id] = true;
          pending++;
          self2.socket.query(peer, message, afterQuery);
        }
        if (!pending) {
          self2.socket.removeListener(evt, kick);
          process.nextTick(done);
        }
      }
      function done() {
        cb(null, count);
      }
      function bootstrap() {
        if (!once) return;
        once = false;
        self2.bootstrap.forEach(function(peer) {
          pending++;
          self2.socket.query(peer, message, afterQuery);
        });
      }
      function afterQuery(err, res, peer) {
        pending--;
        if (peer) queried[peer.address + ":" + peer.port] = true;
        var r = res && res.r;
        if (!r) return;
        if (peer && peer.id && self2.nodes.get(peer.id)) {
          if (err && err.code === "ETIMEDOUT") self2.nodes.remove(peer);
        }
        if (!err && isNodeId(r.id)) {
          count++;
          add({
            id: r.id,
            port: peer.port,
            host: peer.host || peer.address,
            distance: 0
          });
        }
        var nodes = r.nodes ? parseNodes(r.nodes) : [];
        for (var i = 0; i < nodes.length; i++) add(nodes[i]);
        if (visit && visit(res, peer) === false) stop2 = true;
        kick();
      }
      function add(node) {
        if (equals(node.id, self2.id)) return;
        table.add(node);
      }
    };
    function toBootstrapArray(val) {
      if (val === false) return [];
      if (val === true) return BOOTSTRAP_NODES;
      return [].concat(val || BOOTSTRAP_NODES).map(parsePeer);
    }
    function isNodeId(id) {
      return id && Buffer.isBuffer(id) && id.length === 20;
    }
    function encodeNodes(nodes) {
      var buf = new Buffer(nodes.length * 26);
      var ptr = 0;
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (!isNodeId(node.id)) continue;
        node.id.copy(buf, ptr);
        ptr += 20;
        var ip = (node.host || node.address).split(".");
        for (var j = 0; j < 4; j++) buf[ptr++] = parseInt(ip[j] || 0, 10);
        buf.writeUInt16BE(node.port, ptr);
        ptr += 2;
      }
      if (ptr === buf.length) return buf;
      return buf.slice(0, ptr);
    }
    function parseNodes(buf) {
      var contacts = [];
      try {
        for (var i = 0; i < buf.length; i += 26) {
          var port = buf.readUInt16BE(i + 24);
          if (!port) continue;
          contacts.push({
            id: buf.slice(i, i + 20),
            host: parseIp(buf, i + 20),
            port,
            distance: 0,
            token: null
          });
        }
      } catch (err) {
      }
      return contacts;
    }
    function parseIp(buf, offset) {
      return buf[offset++] + "." + buf[offset++] + "." + buf[offset++] + "." + buf[offset++];
    }
    function parsePeer(peer) {
      if (typeof peer === "string") return { host: peer.split(":")[0], port: Number(peer.split(":")[1]) };
      return peer;
    }
    function noop() {
    }
    function toBuffer(str) {
      if (typeof str === "string") return new Buffer(str, "hex");
      if (Buffer.isBuffer(str)) return str;
      throw new Error("Pass a buffer or a string");
    }
  }
});

// node_modules/k-bucket/index.js
var require_k_bucket2 = __commonJS({
  "node_modules/k-bucket/index.js"(exports2, module2) {
    "use strict";
    var assert = require("assert");
    var bufferEqual = require_buffer_equal();
    var crypto = require("crypto");
    var events = require("events");
    var inherits = require_inherits();
    var KBucket = module2.exports = function KBucket2(options) {
      var self2 = this;
      options = options || {};
      events.EventEmitter.call(self2);
      self2.arbiter = options.arbiter || function arbiter(incumbent, candidate) {
        if (incumbent.vectorClock > candidate.vectorClock) {
          return incumbent;
        }
        return candidate;
      };
      self2.bucket = [];
      self2.localNodeId = options.localNodeId || crypto.randomBytes(20);
      if (!Buffer.isBuffer(self2.localNodeId)) {
        throw new Error("localNodeId is not a Buffer");
      }
      self2.numberOfNodesPerKBucket = options.numberOfNodesPerKBucket || 20;
      self2.numberOfNodesToPing = options.numberOfNodesToPing || 3;
      self2.root = options.root || self2;
      self2.dontSplit = null;
      self2.low = null;
      self2.high = null;
    };
    inherits(KBucket, events.EventEmitter);
    KBucket.distance = function distance(firstId, secondId) {
      var max = Math.max(firstId.length, secondId.length);
      var accumulator = "";
      for (var i = 0; i < max; i++) {
        var maxDistance = firstId[i] === void 0 || secondId[i] === void 0;
        if (maxDistance) {
          accumulator += 255 .toString(16);
        } else {
          accumulator += (firstId[i] ^ secondId[i]).toString(16);
        }
      }
      return parseInt(accumulator, 16);
    };
    KBucket.prototype.add = function add(contact, bitIndex) {
      var self2 = this;
      if (!self2.bucket) {
        bitIndex = bitIndex || 0;
        if (self2.determineBucket(contact.id, bitIndex++) < 0) {
          return self2.low.add(contact, bitIndex);
        } else {
          return self2.high.add(contact, bitIndex);
        }
      }
      var index = self2.indexOf(contact);
      if (index >= 0) {
        self2.update(contact, index);
        return self2;
      }
      if (self2.bucket.length < self2.numberOfNodesPerKBucket) {
        self2.bucket.push(contact);
        return self2;
      }
      if (self2.dontSplit) {
        self2.root.emit(
          "ping",
          self2.bucket.slice(0, self2.numberOfNodesToPing),
          contact
        );
        return self2;
      }
      return self2.splitAndAdd(contact, bitIndex);
    };
    KBucket.prototype.closest = function closest(contact, n, bitIndex) {
      var self2 = this;
      var contacts;
      if (!self2.bucket) {
        bitIndex = bitIndex || 0;
        if (self2.determineBucket(contact.id, bitIndex++) < 0) {
          contacts = self2.low.closest(contact, n, bitIndex);
          if (contacts.length < n) {
            contacts = contacts.concat(self2.high.closest(contact, n, bitIndex));
          }
        } else {
          contacts = self2.high.closest(contact, n, bitIndex);
          if (contacts.length < n) {
            contacts = contacts.concat(self2.low.closest(contact, n, bitIndex));
          }
        }
        return contacts.slice(0, n);
      }
      contacts = self2.bucket.slice();
      contacts.forEach(function(storedContact) {
        storedContact.distance = KBucket.distance(storedContact.id, contact.id);
      });
      contacts.sort(function(a, b) {
        return a.distance - b.distance;
      });
      return contacts.slice(0, n);
    };
    KBucket.prototype.count = function count() {
      var self2 = this;
      if (self2.bucket) {
        return self2.bucket.length;
      } else {
        return self2.high.count() + self2.low.count();
      }
    };
    KBucket.prototype.determineBucket = function determineBucket(id, bitIndex) {
      var self2 = this;
      bitIndex = bitIndex || 0;
      var bytesDescribedByBitIndex = parseInt(bitIndex / 8, 10);
      var bitIndexWithinByte = bitIndex % 8;
      if (id.length <= bytesDescribedByBitIndex && bitIndexWithinByte != 0)
        return -1;
      var byteUnderConsideration = id[bytesDescribedByBitIndex];
      if (byteUnderConsideration & Math.pow(2, 7 - bitIndexWithinByte)) {
        return 1;
      }
      return -1;
    };
    KBucket.prototype.get = function get(id, bitIndex) {
      var self2 = this;
      if (!self2.bucket) {
        bitIndex = bitIndex || 0;
        if (self2.determineBucket(id, bitIndex++) < 0) {
          return self2.low.get(id, bitIndex);
        } else {
          return self2.high.get(id, bitIndex);
        }
      }
      var index = self2.indexOf({ id });
      if (index < 0) {
        return null;
      }
      return self2.bucket[index];
    };
    KBucket.prototype.indexOf = function indexOf(contact) {
      var self2 = this;
      for (var i = 0; i < self2.bucket.length; i++) {
        if (bufferEqual(self2.bucket[i].id, contact.id)) return i;
      }
      return -1;
    };
    KBucket.prototype.remove = function remove(contact, bitIndex) {
      var self2 = this;
      if (!self2.bucket) {
        bitIndex = bitIndex || 0;
        if (self2.determineBucket(contact.id, bitIndex++) < 0) {
          return self2.low.remove(contact, bitIndex);
        } else {
          return self2.high.remove(contact, bitIndex);
        }
      }
      var index = self2.indexOf(contact);
      if (index >= 0) self2.bucket.splice(index, 1);
      return self2;
    };
    KBucket.prototype.splitAndAdd = function splitAndAdd(contact, bitIndex) {
      var self2 = this;
      self2.low = new KBucket({
        arbiter: self2.arbiter,
        localNodeId: self2.localNodeId,
        root: self2.root,
        numberOfNodesPerKBucket: self2.numberOfNodesPerKBucket,
        numberOfNodesToPing: self2.numberOfNodesToPing
      });
      self2.high = new KBucket({
        arbiter: self2.arbiter,
        localNodeId: self2.localNodeId,
        root: self2.root,
        numberOfNodesPerKBucket: self2.numberOfNodesPerKBucket,
        numberOfNodesToPing: self2.numberOfNodesToPing
      });
      bitIndex = bitIndex || 0;
      self2.bucket.forEach(function(storedContact) {
        if (self2.determineBucket(storedContact.id, bitIndex) < 0) {
          self2.low.add(storedContact);
        } else {
          self2.high.add(storedContact);
        }
      });
      self2.bucket = void 0;
      if (self2.determineBucket(self2.localNodeId, bitIndex) < 0) {
        self2.high.dontSplit = true;
      } else {
        self2.low.dontSplit = true;
      }
      self2.add(contact, bitIndex);
      return self2;
    };
    KBucket.prototype.toArray = function toArray() {
      var self2 = this;
      if (self2.bucket) {
        return self2.bucket.slice(0);
      } else {
        return self2.low.toArray().concat(self2.high.toArray());
      }
    };
    KBucket.prototype.update = function update(contact, index) {
      var self2 = this;
      assert.ok(
        bufferEqual(self2.bucket[index].id, contact.id),
        "indexOf() calculation resulted in wrong index"
      );
      var incumbent = self2.bucket[index];
      var selection = self2.arbiter(incumbent, contact);
      if (selection === incumbent && incumbent !== contact) {
        return;
      }
      self2.bucket.splice(index, 1);
      self2.bucket.push(selection);
    };
  }
});

// node_modules/lru/index.js
var require_lru = __commonJS({
  "node_modules/lru/index.js"(exports2, module2) {
    var events = require("events");
    var inherits = require_inherits();
    module2.exports = LRU;
    function LRU(opts) {
      if (!(this instanceof LRU)) return new LRU(opts);
      if (typeof opts === "number") opts = { max: opts };
      if (!opts) opts = {};
      events.EventEmitter.call(this);
      this.cache = {};
      this.head = this.tail = null;
      this.length = 0;
      this.max = opts.max || 1e3;
      this.maxAge = opts.maxAge || 0;
    }
    inherits(LRU, events.EventEmitter);
    LRU.prototype.remove = function(key) {
      if (typeof key !== "string") key = "" + key;
      if (!this.cache.hasOwnProperty(key)) return;
      var element = this.cache[key];
      delete this.cache[key];
      this._unlink(key, element.prev, element.next);
      return element.value;
    };
    LRU.prototype._unlink = function(key, prev, next) {
      this.length--;
      if (this.length === 0) {
        this.head = this.tail = null;
      } else {
        if (this.head === key) {
          this.head = prev;
          this.cache[this.head].next = null;
        } else if (this.tail === key) {
          this.tail = next;
          this.cache[this.tail].prev = null;
        } else {
          this.cache[prev].next = next;
          this.cache[next].prev = prev;
        }
      }
    };
    LRU.prototype.peek = function(key) {
      return this.cache.hasOwnProperty(key) ? this.cache[key].value : null;
    };
    LRU.prototype.set = function(key, value) {
      if (typeof key !== "string") key = "" + key;
      var element;
      if (this.cache.hasOwnProperty(key)) {
        element = this.cache[key];
        element.value = value;
        if (this.maxAge) element.modified = Date.now();
        if (key === this.head) return value;
        this._unlink(key, element.prev, element.next);
      } else {
        element = { value, modified: 0, next: null, prev: null };
        if (this.maxAge) element.modified = Date.now();
        this.cache[key] = element;
        if (this.length === this.max) this.evict();
      }
      this.length++;
      element.next = null;
      element.prev = this.head;
      if (this.head) this.cache[this.head].next = key;
      this.head = key;
      if (!this.tail) this.tail = key;
      return value;
    };
    LRU.prototype.get = function(key) {
      if (typeof key !== "string") key = "" + key;
      if (!this.cache.hasOwnProperty(key)) return;
      var element = this.cache[key];
      if (this.maxAge && Date.now() - element.modified > this.maxAge) {
        this.remove(key);
        this.emit("evict", { key, value: element.value });
        return;
      }
      if (this.head !== key) {
        if (key === this.tail) {
          this.tail = element.next;
          this.cache[this.tail].prev = null;
        } else {
          this.cache[element.prev].next = element.next;
        }
        this.cache[element.next].prev = element.prev;
        this.cache[this.head].next = key;
        element.prev = this.head;
        element.next = null;
        this.head = key;
      }
      return element.value;
    };
    LRU.prototype.evict = function() {
      if (!this.tail) return;
      var key = this.tail;
      var value = this.remove(this.tail);
      this.emit("evict", { key, value });
    };
  }
});

// node_modules/bittorrent-dht/client.js
var require_client = __commonJS({
  "node_modules/bittorrent-dht/client.js"(exports2, module2) {
    module2.exports = DHT;
    var inherits = require_inherits();
    var EventEmitter = require("events").EventEmitter;
    var krpc = require_k_rpc();
    var KBucket = require_k_bucket2();
    var crypto = require("crypto");
    var bencode = require_bencode2();
    var equals = require_buffer_equals();
    var LRU = require_lru();
    var debug = require_src()("bittorrent-dht");
    var ROTATE_INTERVAL = 5 * 60 * 1e3;
    inherits(DHT, EventEmitter);
    function DHT(opts) {
      if (!(this instanceof DHT)) return new DHT(opts);
      if (!opts) opts = {};
      var self2 = this;
      this._tables = LRU({ maxAge: ROTATE_INTERVAL, max: opts.maxTables || 1e3 });
      this._values = LRU(opts.maxValues || 1e3);
      this._peers = new PeerStore(opts.maxPeers || 1e4);
      this._secrets = null;
      this._rpc = krpc(opts);
      this._rpc.on("query", onquery);
      this._rpc.on("node", onnode);
      this._rpc.on("warning", onwarning);
      this._rpc.on("error", onerror);
      this._rpc.on("listening", onlistening);
      this._rotateSecrets();
      this._verify = opts.verify || null;
      this._host = opts.host || null;
      this._interval = setInterval(rotateSecrets, ROTATE_INTERVAL);
      this.listening = false;
      this.destroyed = false;
      this.nodeId = this._rpc.id;
      this.nodes = this._rpc.nodes;
      process.nextTick(bootstrap);
      EventEmitter.call(this);
      this._debug("new DHT %s", this.nodeId);
      function onlistening() {
        self2.listening = true;
        self2._debug("listening %d", self2.address().port);
        self2.emit("listening");
      }
      function onquery(query, peer) {
        self2._onquery(query, peer);
      }
      function rotateSecrets() {
        self2._rotateSecrets();
      }
      function bootstrap() {
        if (!self2.destroyed) self2._bootstrap(opts.bootstrap !== false);
      }
      function onwarning(err) {
        self2.emit("warning", err);
      }
      function onerror(err) {
        self2.emit("error", err);
      }
      function onnode(node) {
        self2.emit("node", node);
      }
    }
    DHT.prototype.addNode = function(node) {
      var self2 = this;
      if (node.id) {
        node.id = toBuffer(node.id);
        var old = !!this._rpc.nodes.get(node.id);
        this._rpc.nodes.add(node);
        if (!old) this.emit("node", node);
        return;
      }
      this._sendPing(node, function(_, node2) {
        if (node2) self2.addNode(node2);
      });
    };
    DHT.prototype.removeNode = function(id) {
      this._rpc.nodes.remove({ id: toBuffer(id) });
    };
    DHT.prototype._sendPing = function(node, cb) {
      this._rpc.query(node, { q: "ping" }, function(err, pong, node2) {
        if (err) return cb(err);
        if (!pong.r || !pong.r.id || !Buffer.isBuffer(pong.r.id) || pong.r.id.length !== 20) {
          return cb(new Error("Bad reply"));
        }
        cb(null, {
          id: pong.r.id,
          host: node2.host || node2.address,
          port: node2.port
        });
      });
    };
    DHT.prototype.toJSON = DHT.prototype.toArray = function() {
      return this._rpc.nodes.toArray().map(toNode);
    };
    DHT.prototype.put = function(opts, cb) {
      if (Buffer.isBuffer(opts) || typeof opts === "string") opts = { v: opts };
      var isMutable = !!opts.k;
      if (opts.v === void 0) {
        throw new Error("opts.v not given");
      }
      if (opts.v.length >= 1e3) {
        throw new Error("v must be less than 1000 bytes in put()");
      }
      if (isMutable && opts.cas !== void 0 && typeof opts.cas !== "number") {
        throw new Error("opts.cas must be an integer if provided");
      }
      if (isMutable && !opts.k) {
        throw new Error("opts.k ed25519 public key required for mutable put");
      }
      if (isMutable && opts.k.length !== 32) {
        throw new Error("opts.k ed25519 public key must be 32 bytes");
      }
      if (isMutable && typeof opts.sign !== "function" && !Buffer.isBuffer(opts.sig)) {
        throw new Error("opts.sign function or options.sig signature is required for mutable put");
      }
      if (isMutable && opts.salt && opts.salt.length > 64) {
        throw new Error("opts.salt is > 64 bytes long");
      }
      if (isMutable && opts.seq === void 0) {
        throw new Error("opts.seq not provided for a mutable update");
      }
      if (isMutable && typeof opts.seq !== "number") {
        throw new Error("opts.seq not an integer");
      }
      return this._put(opts, cb);
    };
    DHT.prototype._put = function(opts, cb) {
      if (!cb) cb = noop;
      var isMutable = !!opts.k;
      var v = typeof opts.v === "string" ? new Buffer(opts.v) : opts.v;
      var key = isMutable ? sha1(opts.salt ? Buffer.concat([opts.salt, opts.k]) : opts.k) : sha1(bencode.encode(v));
      var table = this._tables.get(key.toString("hex"));
      if (!table) return this._preput(key, opts, cb);
      var message = {
        q: "put",
        a: {
          id: this._rpc.id,
          token: null,
          // queryAll sets this
          v
        }
      };
      if (isMutable) {
        if (typeof opts.cas === "number") message.a.cas = opts.cas;
        if (opts.salt) message.a.salt = opts.salt;
        message.a.k = opts.k;
        message.a.seq = opts.seq;
        if (typeof opts.sign === "function") message.a.sig = opts.sign(encodeSigData(message.a));
        else if (Buffer.isBuffer(opts.sig)) message.a.sig = opts.sig;
      }
      this._values.set(key.toString("hex"), message.a);
      this._rpc.queryAll(table.closest({ id: key }), message, null, function(err, n) {
        if (err) return cb(err, key, n);
        cb(null, key, n);
      });
      return key;
    };
    DHT.prototype._preput = function(key, opts, cb) {
      var self2 = this;
      this._closest(key, {
        q: "get",
        a: {
          id: this._rpc.id,
          target: key
        }
      }, null, function(err, n) {
        if (err) return cb(err);
        self2.put(opts, cb);
      });
      return key;
    };
    DHT.prototype.get = function(key, opts, cb) {
      key = toBuffer(key);
      if (typeof opts === "function") {
        cb = opts;
        opts = null;
      }
      if (!opts) opts = {};
      var verify = opts.verify || this._verify;
      var value = this._values.get(key.toString("hex")) || null;
      if (value) {
        value = createGetResponse(this._rpc.id, null, value);
        return process.nextTick(done);
      }
      this._closest(key, {
        q: "get",
        a: {
          id: this._rpc.id,
          target: key
        }
      }, onreply, done);
      function done(err) {
        if (err) return cb(err);
        cb(null, value);
      }
      function onreply(message) {
        var r = message.r;
        if (!r || !r.v) return true;
        var isMutable = r.k || r.sig;
        if (isMutable) {
          if (!verify || !r.sig || !r.k) return true;
          if (!verify(r.sig, encodeSigData(r), r.k)) return true;
          if (equals(sha1(r.salt ? Buffer.concat([r.salt, r.k]) : r.k), key)) {
            value = r;
            return false;
          }
        } else {
          if (equals(sha1(bencode.encode(r.v)), key)) {
            value = r;
            return false;
          }
        }
        return true;
      }
    };
    DHT.prototype.announce = function(infoHash, port, cb) {
      if (typeof port === "function") return this.announce(infoHash, 0, port);
      infoHash = toBuffer(infoHash);
      if (!cb) cb = noop;
      var table = this._tables.get(infoHash.toString("hex"));
      if (!table) return this._preannounce(infoHash, port, cb);
      if (this._host) {
        var dhtPort = this.listening ? this.address().port : 0;
        this._addPeer(
          { host: this._host, port: port || dhtPort },
          infoHash,
          { host: this._host, port: dhtPort }
        );
      }
      var message = {
        q: "announce_peer",
        a: {
          id: this._rpc.id,
          token: null,
          // queryAll sets this
          info_hash: infoHash,
          port,
          implied_port: port ? 0 : 1
        }
      };
      this._debug("announce %s %d", infoHash, port);
      this._rpc.queryAll(table.closest({ id: infoHash }), message, null, cb);
    };
    DHT.prototype._preannounce = function(infoHash, port, cb) {
      var self2 = this;
      this.lookup(infoHash, function(err) {
        if (self2.destroyed) return cb(new Error("dht is destroyed"));
        if (err) return cb(err);
        self2.announce(infoHash, port, cb);
      });
    };
    DHT.prototype.lookup = function(infoHash, cb) {
      infoHash = toBuffer(infoHash);
      if (!cb) cb = noop;
      var self2 = this;
      var aborted = false;
      this._debug("lookup %s", infoHash);
      process.nextTick(emit);
      this._closest(infoHash, {
        q: "get_peers",
        a: {
          id: this._rpc.id,
          info_hash: infoHash
        }
      }, onreply, cb);
      function emit(values, from) {
        if (!values) values = self2._peers.get(infoHash.toString("hex"));
        var peers = decodePeers(values);
        for (var i = 0; i < peers.length; i++) {
          self2.emit("peer", peers[i], infoHash, from || null);
        }
      }
      function onreply(message, node) {
        if (aborted) return false;
        if (message.r.values) emit(message.r.values, node);
      }
      return function abort() {
        aborted = true;
      };
    };
    DHT.prototype.address = function() {
      return this._rpc.address();
    };
    DHT.prototype.listen = function(port, cb) {
      if (typeof port === "function") return this.listen(0, port);
      this._rpc.bind(port, cb);
    };
    DHT.prototype.destroy = function(cb) {
      if (this.destroyed) {
        if (cb) process.nextTick(cb);
        return;
      }
      this.destroyed = true;
      var self2 = this;
      clearInterval(this._interval);
      this._debug("destroying");
      this._rpc.destroy(function() {
        self2.emit("close");
        if (cb) cb();
      });
    };
    DHT.prototype._onquery = function(query, peer) {
      var q = query.q.toString();
      this._debug("received %s query from %s:%d", q, peer.address, peer.port);
      if (!query.a) return;
      switch (q) {
        case "ping":
          return this._rpc.response(peer, query, { id: this._rpc.id });
        case "find_node":
          return this._onfindnode(query, peer);
        case "get_peers":
          return this._ongetpeers(query, peer);
        case "announce_peer":
          return this._onannouncepeer(query, peer);
        case "get":
          return this._onget(query, peer);
        case "put":
          return this._onput(query, peer);
      }
    };
    DHT.prototype._onfindnode = function(query, peer) {
      var target = query.a.target;
      if (!target) return this._rpc.error(peer, query, [203, "`find_node` missing required `a.target` field"]);
      var nodes = this._rpc.nodes.closest({ id: target });
      this._rpc.response(peer, query, { id: this._rpc.id }, nodes);
    };
    DHT.prototype._ongetpeers = function(query, peer) {
      var host = peer.address || peer.host;
      var infoHash = query.a.info_hash;
      if (!infoHash) return this._rpc.error(peer, query, [203, "`get_peers` missing required `a.info_hash` field"]);
      var r = { id: this._rpc.id, token: this._generateToken(host) };
      var peers = this._peers.get(infoHash.toString("hex"));
      if (peers.length) {
        r.values = peers;
        this._rpc.response(peer, query, r);
      } else {
        this._rpc.response(peer, query, r, this._rpc.nodes.closest({ id: infoHash }));
      }
    };
    DHT.prototype._onannouncepeer = function(query, peer) {
      var host = peer.address || peer.host;
      var port = query.a.implied_port ? peer.port : query.a.port;
      if (!port || typeof port !== "number") return;
      var infoHash = query.a.info_hash;
      var token = query.a.token;
      if (!infoHash || !token) return;
      if (!this._validateToken(host, token)) {
        return this._rpc.error(peer, query, [203, "cannot `announce_peer` with bad token"]);
      }
      this._addPeer({ host, port }, infoHash, { host, port: peer.port });
      this._rpc.response(peer, query, { id: this._rpc.id });
    };
    DHT.prototype._addPeer = function(peer, infoHash, from) {
      this._peers.add(infoHash.toString("hex"), encodePeer(peer.host, peer.port));
      this.emit("announce", peer, infoHash, from);
    };
    DHT.prototype._onget = function(query, peer) {
      var host = peer.address || peer.host;
      var target = query.a.target;
      if (!target) return;
      var token = this._generateToken(host);
      var value = this._values.get(target.toString("hex"));
      if (!value) {
        var nodes = this._rpc.nodes.closest({ id: target });
        this._rpc.response(peer, query, { id: this._rpc.id, token }, nodes);
      } else {
        this._rpc.response(peer, query, createGetResponse(this._rpc.id, token, value));
      }
    };
    DHT.prototype._onput = function(query, peer) {
      var host = peer.address || peer.host;
      var a = query.a;
      if (!a) return;
      var v = query.a.v;
      if (!v) return;
      var token = a.token;
      if (!token) return;
      if (!this._validateToken(host, token)) {
        return this._rpc.error(peer, query, [203, "cannot `put` with bad token"]);
      }
      if (v.length > 1e3) {
        return this._rpc.error(peer, query, [205, "data payload too large"]);
      }
      var isMutable = !!(a.k || a.sig);
      if (isMutable && !a.k && !a.sig) return;
      var key = isMutable ? sha1(a.salt ? Buffer.concat([a.salt, a.k]) : a.k) : sha1(bencode.encode(v));
      var keyHex = key.toString("hex");
      if (isMutable) {
        if (!this._verify) return this._rpc.error(peer, query, [400, "verification not supported"]);
        if (!this._verify(a.sig, encodeSigData(a), a.k)) return;
        var prev = this._values.get(keyHex);
        if (prev && typeof a.cas === "number" && prev.seq !== a.cas) {
          return this._rpc.error(peer, query, [301, "CAS mismatch, re-read and try again"]);
        }
        if (prev && typeof prev.seq === "number" && !(a.seq > prev.seq)) {
          return this._rpc.error(peer, query, [302, "sequence number less than current"]);
        }
        this._values.set(keyHex, { v, k: a.k, salt: a.salt, sig: a.sig, seq: a.seq });
      } else {
        this._values.set(keyHex, { v });
      }
      this._rpc.response(peer, query, { id: this._rpc.id });
    };
    DHT.prototype._bootstrap = function(populate) {
      var self2 = this;
      if (!populate) return process.nextTick(ready);
      this._rpc.populate(self2._rpc.id, {
        q: "find_node",
        a: {
          id: self2._rpc.id,
          target: self2._rpc.id
        }
      }, ready);
      function ready() {
        self2._debug("emit ready");
        self2.ready = true;
        self2.emit("ready");
      }
    };
    DHT.prototype._closest = function(target, message, onmessage, cb) {
      var self2 = this;
      var table = new KBucket({
        localNodeId: target,
        numberOfNodesPerKBucket: this._rpc.k
      });
      this._rpc.closest(target, message, onreply, done);
      function done(err, n) {
        if (err) return cb(err);
        self2._tables.set(target.toString("hex"), table);
        self2._debug("visited %d nodes", n);
        cb(null, n);
      }
      function onreply(message2, node) {
        if (!message2.r) return true;
        if (message2.r.token && message2.r.id && Buffer.isBuffer(message2.r.id) && message2.r.id.length === 20) {
          self2._debug("found node %s (target: %s)", message2.r.id, target);
          table.add({
            id: message2.r.id,
            host: node.host || node.address,
            port: node.port,
            token: message2.r.token
          });
        }
        if (!onmessage) return true;
        return onmessage(message2, node);
      }
    };
    DHT.prototype._debug = function() {
      if (!debug.enabled) return;
      var args = [].slice.call(arguments);
      args[0] = "[" + this.nodeId.toString("hex").substring(0, 7) + "] " + args[0];
      for (var i = 1; i < args.length; i++) {
        if (Buffer.isBuffer(args[i])) args[i] = args[i].toString("hex");
      }
      debug.apply(null, args);
    };
    DHT.prototype._validateToken = function(host, token) {
      var tokenA = this._generateToken(host, this._secrets[0]);
      var tokenB = this._generateToken(host, this._secrets[1]);
      return equals(token, tokenA) || equals(token, tokenB);
    };
    DHT.prototype._generateToken = function(host, secret) {
      if (!secret) secret = this._secrets[0];
      return crypto.createHash("sha1").update(new Buffer(host, "utf8")).update(secret).digest();
    };
    DHT.prototype._rotateSecrets = function() {
      if (!this._secrets) {
        this._secrets = [crypto.randomBytes(20), crypto.randomBytes(20)];
      } else {
        this._secrets[1] = this._secrets[0];
        this._secrets[0] = crypto.randomBytes(20);
      }
    };
    function noop() {
    }
    function sha1(buf) {
      return crypto.createHash("sha1").update(buf).digest();
    }
    function createGetResponse(id, token, value) {
      var r = { id, token, v: value.v };
      if (value.sig) {
        r.sig = value.sig;
        r.k = value.k;
        if (value.salt) r.salt = value.salt;
        if (typeof value.seq === "number") r.seq = value.seq;
      }
      return r;
    }
    function encodePeer(host, port) {
      var buf = new Buffer(6);
      var ip = host.split(".");
      for (var i = 0; i < 4; i++) buf[i] = parseInt(ip[i] || 0, 10);
      buf.writeUInt16BE(port, 4);
      return buf;
    }
    function decodePeers(buf) {
      var peers = [];
      try {
        for (var i = 0; i < buf.length; i++) {
          var port = buf[i].readUInt16BE(4);
          if (!port) continue;
          peers.push({
            host: parseIp(buf[i], 0),
            port
          });
        }
      } catch (err) {
      }
      return peers;
    }
    function parseIp(buf, offset) {
      return buf[offset++] + "." + buf[offset++] + "." + buf[offset++] + "." + buf[offset++];
    }
    function encodeSigData(msg) {
      var ref = { seq: msg.seq || 0, v: msg.v };
      if (msg.salt) ref.salt = msg.salt;
      return bencode.encode(ref).slice(1, -1);
    }
    function toNode(node) {
      return {
        host: node.host,
        port: node.port
      };
    }
    function PeerStore(max) {
      this.max = max || 1e4;
      this.used = 0;
      this.peers = LRU(Infinity);
    }
    PeerStore.prototype.add = function(key, peer) {
      var peers = this.peers.get(key);
      if (!peers) {
        peers = {
          values: [],
          map: LRU(Infinity)
        };
        this.peers.set(key, peers);
      }
      var id = peer.toString("hex");
      if (peers.map.get(id)) return;
      var node = { index: peers.values.length, peer };
      peers.map.set(id, node);
      peers.values.push(node);
      if (++this.used > this.max) this._evict();
    };
    PeerStore.prototype._evict = function() {
      var a = this.peers.peek(this.peers.tail);
      var b = a.map.remove(a.map.tail);
      var values = a.values;
      swap(values, b.index, values.length - 1);
      values.pop();
      this.used--;
      if (!values.length) this.peers.remove(this.peers.tail);
    };
    PeerStore.prototype.get = function(key) {
      var node = this.peers.get(key);
      if (!node) return [];
      return pick(node.values, 100);
    };
    function swap(list, a, b) {
      if (a === b) return;
      var tmp = list[a];
      list[a] = list[b];
      list[b] = tmp;
      list[a].index = a;
      list[b].index = b;
    }
    function pick(values, n) {
      var len = Math.min(values.length, n);
      var ptr = 0;
      var res = new Array(len);
      for (var i = 0; i < len; i++) {
        var next = ptr + Math.random() * (values.length - ptr) | 0;
        res[ptr] = values[next].peer;
        swap(values, ptr++, next);
      }
      return res;
    }
    function toBuffer(str) {
      if (Buffer.isBuffer(str)) return str;
      if (typeof str === "string") return new Buffer(str, "hex");
      throw new Error("Pass a buffer or a string");
    }
  }
});

// node_modules/re-emitter/index.js
var require_re_emitter = __commonJS({
  "node_modules/re-emitter/index.js"(exports2, module2) {
    module2.exports = reemit;
    module2.exports.filter = filter;
    var EventEmitter = require("events").EventEmitter;
    function reemit(source, target, events) {
      if (!Array.isArray(events)) events = [events];
      var listeners = [];
      events.forEach(function(event) {
        var listener = function() {
          var args = [].slice.call(arguments);
          args.unshift(event);
          target.emit.apply(target, args);
        };
        listeners.push(listener);
        source.on(event, listener);
      });
      return function cancel() {
        events.forEach(function(event, i) {
          source.removeListener(event, listeners[i]);
        });
      };
    }
    function filter(source, events) {
      var emitter = new EventEmitter();
      reemit(source, emitter, events);
      return emitter;
    }
  }
});

// node_modules/uniq/uniq.js
var require_uniq = __commonJS({
  "node_modules/uniq/uniq.js"(exports2, module2) {
    "use strict";
    function unique_pred(list, compare) {
      var ptr = 1, len = list.length, a = list[0], b = list[0];
      for (var i = 1; i < len; ++i) {
        b = a;
        a = list[i];
        if (compare(a, b)) {
          if (i === ptr) {
            ptr++;
            continue;
          }
          list[ptr++] = a;
        }
      }
      list.length = ptr;
      return list;
    }
    function unique_eq(list) {
      var ptr = 1, len = list.length, a = list[0], b = list[0];
      for (var i = 1; i < len; ++i, b = a) {
        b = a;
        a = list[i];
        if (a !== b) {
          if (i === ptr) {
            ptr++;
            continue;
          }
          list[ptr++] = a;
        }
      }
      list.length = ptr;
      return list;
    }
    function unique(list, compare, sorted) {
      if (list.length === 0) {
        return list;
      }
      if (compare) {
        if (!sorted) {
          list.sort(compare);
        }
        return unique_pred(list, compare);
      }
      if (!sorted) {
        list.sort();
      }
      return unique_eq(list);
    }
    module2.exports = unique;
  }
});

// node_modules/xtend/mutable.js
var require_mutable = __commonJS({
  "node_modules/xtend/mutable.js"(exports2, module2) {
    module2.exports = extend;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    function extend(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    }
  }
});

// node_modules/bittorrent-tracker/lib/common-node.js
var require_common_node = __commonJS({
  "node_modules/bittorrent-tracker/lib/common-node.js"(exports2) {
    var querystring = require("querystring");
    exports2.IPV4_RE = /^[\d\.]+$/;
    exports2.IPV6_RE = /^[\da-fA-F:]+$/;
    exports2.REMOVE_IPV4_MAPPED_IPV6_RE = /^::ffff:/;
    exports2.CONNECTION_ID = Buffer.concat([toUInt32(1047), toUInt32(655366528)]);
    exports2.ACTIONS = { CONNECT: 0, ANNOUNCE: 1, SCRAPE: 2, ERROR: 3 };
    exports2.EVENTS = { update: 0, completed: 1, started: 2, stopped: 3 };
    exports2.EVENT_IDS = {
      0: "update",
      1: "completed",
      2: "started",
      3: "stopped"
    };
    exports2.EVENT_NAMES = {
      update: "update",
      completed: "complete",
      started: "start",
      stopped: "stop"
    };
    function toUInt32(n) {
      var buf = new Buffer(4);
      buf.writeUInt32BE(n, 0);
      return buf;
    }
    exports2.toUInt32 = toUInt32;
    exports2.querystringParse = function(q) {
      var saved = querystring.unescape;
      querystring.unescape = unescape;
      var ret = querystring.parse(q);
      querystring.unescape = saved;
      return ret;
    };
    exports2.querystringStringify = function(obj) {
      var saved = querystring.escape;
      querystring.escape = escape;
      var ret = querystring.stringify(obj);
      ret = ret.replace(/[\@\*\/\+]/g, function(char) {
        return "%" + char.charCodeAt(0).toString(16).toUpperCase();
      });
      querystring.escape = saved;
      return ret;
    };
  }
});

// node_modules/bittorrent-tracker/lib/common.js
var require_common2 = __commonJS({
  "node_modules/bittorrent-tracker/lib/common.js"(exports2) {
    var extend = require_mutable();
    exports2.DEFAULT_ANNOUNCE_PEERS = 50;
    exports2.MAX_ANNOUNCE_PEERS = 82;
    exports2.binaryToHex = function(str) {
      return new Buffer(str, "binary").toString("hex");
    };
    exports2.hexToBinary = function(str) {
      return new Buffer(str, "hex").toString("binary");
    };
    var config = require_common_node();
    extend(exports2, config);
  }
});

// node_modules/bittorrent-tracker/node_modules/bencode/lib/encode.js
var require_encode3 = __commonJS({
  "node_modules/bittorrent-tracker/node_modules/bencode/lib/encode.js"(exports2, module2) {
    function encode(data) {
      var buffers = [];
      encode._encode(buffers, data);
      return Buffer.concat(buffers);
    }
    encode._floatConversionDetected = false;
    encode._encode = function(buffers, data) {
      if (Buffer.isBuffer(data)) {
        buffers.push(new Buffer(data.length + ":"));
        buffers.push(data);
        return;
      }
      switch (typeof data) {
        case "string":
          encode.bytes(buffers, data);
          break;
        case "number":
          encode.number(buffers, data);
          break;
        case "object":
          data.constructor === Array ? encode.list(buffers, data) : encode.dict(buffers, data);
          break;
        case "boolean":
          encode.number(buffers, data ? 1 : 0);
          break;
      }
    };
    var buff_e = new Buffer("e");
    var buff_d = new Buffer("d");
    var buff_l = new Buffer("l");
    encode.bytes = function(buffers, data) {
      buffers.push(new Buffer(Buffer.byteLength(data) + ":" + data));
    };
    encode.number = function(buffers, data) {
      var maxLo = 2147483648;
      var hi = data / maxLo << 0;
      var lo = data % maxLo << 0;
      var val = hi * maxLo + lo;
      buffers.push(new Buffer("i" + val + "e"));
      if (val !== data && !encode._floatConversionDetected) {
        encode._floatConversionDetected = true;
        console.warn(
          'WARNING: Possible data corruption detected with value "' + data + '":',
          'Bencoding only defines support for integers, value was converted to "' + val + '"'
        );
        console.trace();
      }
    };
    encode.dict = function(buffers, data) {
      buffers.push(buff_d);
      var j = 0;
      var k;
      var keys = Object.keys(data).sort();
      var kl = keys.length;
      for (; j < kl; j++) {
        k = keys[j];
        encode.bytes(buffers, k);
        encode._encode(buffers, data[k]);
      }
      buffers.push(buff_e);
    };
    encode.list = function(buffers, data) {
      var i = 0, j = 1;
      var c = data.length;
      buffers.push(buff_l);
      for (; i < c; i++) {
        encode._encode(buffers, data[i]);
      }
      buffers.push(buff_e);
    };
    module2.exports = encode;
  }
});

// node_modules/bittorrent-tracker/node_modules/bencode/lib/dict.js
var require_dict2 = __commonJS({
  "node_modules/bittorrent-tracker/node_modules/bencode/lib/dict.js"(exports2, module2) {
    var Dict = module2.exports = function Dict2() {
      Object.defineProperty(this, "_keys", {
        enumerable: false,
        value: []
      });
    };
    Dict.prototype.binaryKeys = function binaryKeys() {
      return this._keys.slice();
    };
    Dict.prototype.binarySet = function binarySet(key, value) {
      this._keys.push(key);
      this[key] = value;
    };
  }
});

// node_modules/bittorrent-tracker/node_modules/bencode/lib/decode.js
var require_decode3 = __commonJS({
  "node_modules/bittorrent-tracker/node_modules/bencode/lib/decode.js"(exports2, module2) {
    var Dict = require_dict2();
    function decode(data, encoding) {
      decode.position = 0;
      decode.encoding = encoding || null;
      decode.data = !Buffer.isBuffer(data) ? new Buffer(data) : data;
      return decode.next();
    }
    decode.position = 0;
    decode.data = null;
    decode.encoding = null;
    decode.next = function() {
      switch (decode.data[decode.position]) {
        case 100:
          return decode.dictionary();
          break;
        case 108:
          return decode.list();
          break;
        case 105:
          return decode.integer();
          break;
        default:
          return decode.bytes();
          break;
      }
    };
    decode.find = function(chr) {
      var i = decode.position;
      var c = decode.data.length;
      var d = decode.data;
      while (i < c) {
        if (d[i] === chr)
          return i;
        i++;
      }
      throw new Error(
        'Invalid data: Missing delimiter "' + String.fromCharCode(chr) + '" [0x' + chr.toString(16) + "]"
      );
    };
    decode.dictionary = function() {
      decode.position++;
      var dict = new Dict();
      while (decode.data[decode.position] !== 101) {
        dict.binarySet(decode.bytes(), decode.next());
      }
      decode.position++;
      return dict;
    };
    decode.list = function() {
      decode.position++;
      var lst = [];
      while (decode.data[decode.position] !== 101) {
        lst.push(decode.next());
      }
      decode.position++;
      return lst;
    };
    decode.integer = function() {
      var end = decode.find(101);
      var number = decode.data.toString("ascii", decode.position + 1, end);
      decode.position += end + 1 - decode.position;
      return parseInt(number, 10);
    };
    decode.bytes = function() {
      var sep = decode.find(58);
      var length = parseInt(decode.data.toString("ascii", decode.position, sep), 10);
      var end = ++sep + length;
      decode.position = end;
      return decode.encoding ? decode.data.toString(decode.encoding, sep, end) : decode.data.slice(sep, end);
    };
    module2.exports = decode;
  }
});

// node_modules/bittorrent-tracker/node_modules/bencode/bencode.js
var require_bencode3 = __commonJS({
  "node_modules/bittorrent-tracker/node_modules/bencode/bencode.js"(exports2, module2) {
    module2.exports = {
      encode: require_encode3(),
      decode: require_decode3()
    };
  }
});

// node_modules/ipaddr.js/lib/ipaddr.js
var require_ipaddr = __commonJS({
  "node_modules/ipaddr.js/lib/ipaddr.js"(exports2, module2) {
    (function() {
      var expandIPv6, ipaddr, ipv4Part, ipv4Regexes, ipv6Part, ipv6Regexes, matchCIDR, root, zoneIndex;
      ipaddr = {};
      root = this;
      if (typeof module2 !== "undefined" && module2 !== null && module2.exports) {
        module2.exports = ipaddr;
      } else {
        root["ipaddr"] = ipaddr;
      }
      matchCIDR = function(first, second, partSize, cidrBits) {
        var part, shift;
        if (first.length !== second.length) {
          throw new Error("ipaddr: cannot match CIDR for objects with different lengths");
        }
        part = 0;
        while (cidrBits > 0) {
          shift = partSize - cidrBits;
          if (shift < 0) {
            shift = 0;
          }
          if (first[part] >> shift !== second[part] >> shift) {
            return false;
          }
          cidrBits -= partSize;
          part += 1;
        }
        return true;
      };
      ipaddr.subnetMatch = function(address, rangeList, defaultName) {
        var k, len, rangeName, rangeSubnets, subnet;
        if (defaultName == null) {
          defaultName = "unicast";
        }
        for (rangeName in rangeList) {
          rangeSubnets = rangeList[rangeName];
          if (rangeSubnets[0] && !(rangeSubnets[0] instanceof Array)) {
            rangeSubnets = [rangeSubnets];
          }
          for (k = 0, len = rangeSubnets.length; k < len; k++) {
            subnet = rangeSubnets[k];
            if (address.kind() === subnet[0].kind()) {
              if (address.match.apply(address, subnet)) {
                return rangeName;
              }
            }
          }
        }
        return defaultName;
      };
      ipaddr.IPv4 = (function() {
        function IPv4(octets) {
          var k, len, octet;
          if (octets.length !== 4) {
            throw new Error("ipaddr: ipv4 octet count should be 4");
          }
          for (k = 0, len = octets.length; k < len; k++) {
            octet = octets[k];
            if (!(0 <= octet && octet <= 255)) {
              throw new Error("ipaddr: ipv4 octet should fit in 8 bits");
            }
          }
          this.octets = octets;
        }
        IPv4.prototype.kind = function() {
          return "ipv4";
        };
        IPv4.prototype.toString = function() {
          return this.octets.join(".");
        };
        IPv4.prototype.toNormalizedString = function() {
          return this.toString();
        };
        IPv4.prototype.toByteArray = function() {
          return this.octets.slice(0);
        };
        IPv4.prototype.match = function(other, cidrRange) {
          var ref;
          if (cidrRange === void 0) {
            ref = other, other = ref[0], cidrRange = ref[1];
          }
          if (other.kind() !== "ipv4") {
            throw new Error("ipaddr: cannot match ipv4 address with non-ipv4 one");
          }
          return matchCIDR(this.octets, other.octets, 8, cidrRange);
        };
        IPv4.prototype.SpecialRanges = {
          unspecified: [[new IPv4([0, 0, 0, 0]), 8]],
          broadcast: [[new IPv4([255, 255, 255, 255]), 32]],
          multicast: [[new IPv4([224, 0, 0, 0]), 4]],
          linkLocal: [[new IPv4([169, 254, 0, 0]), 16]],
          loopback: [[new IPv4([127, 0, 0, 0]), 8]],
          carrierGradeNat: [[new IPv4([100, 64, 0, 0]), 10]],
          "private": [[new IPv4([10, 0, 0, 0]), 8], [new IPv4([172, 16, 0, 0]), 12], [new IPv4([192, 168, 0, 0]), 16]],
          reserved: [[new IPv4([192, 0, 0, 0]), 24], [new IPv4([192, 0, 2, 0]), 24], [new IPv4([192, 88, 99, 0]), 24], [new IPv4([198, 51, 100, 0]), 24], [new IPv4([203, 0, 113, 0]), 24], [new IPv4([240, 0, 0, 0]), 4]]
        };
        IPv4.prototype.range = function() {
          return ipaddr.subnetMatch(this, this.SpecialRanges);
        };
        IPv4.prototype.toIPv4MappedAddress = function() {
          return ipaddr.IPv6.parse("::ffff:" + this.toString());
        };
        IPv4.prototype.prefixLengthFromSubnetMask = function() {
          var cidr, i, k, octet, stop2, zeros, zerotable;
          zerotable = {
            0: 8,
            128: 7,
            192: 6,
            224: 5,
            240: 4,
            248: 3,
            252: 2,
            254: 1,
            255: 0
          };
          cidr = 0;
          stop2 = false;
          for (i = k = 3; k >= 0; i = k += -1) {
            octet = this.octets[i];
            if (octet in zerotable) {
              zeros = zerotable[octet];
              if (stop2 && zeros !== 0) {
                return null;
              }
              if (zeros !== 8) {
                stop2 = true;
              }
              cidr += zeros;
            } else {
              return null;
            }
          }
          return 32 - cidr;
        };
        return IPv4;
      })();
      ipv4Part = "(0?\\d+|0x[a-f0-9]+)";
      ipv4Regexes = {
        fourOctet: new RegExp("^" + ipv4Part + "\\." + ipv4Part + "\\." + ipv4Part + "\\." + ipv4Part + "$", "i"),
        longValue: new RegExp("^" + ipv4Part + "$", "i")
      };
      ipaddr.IPv4.parser = function(string) {
        var match, parseIntAuto, part, shift, value;
        parseIntAuto = function(string2) {
          if (string2[0] === "0" && string2[1] !== "x") {
            return parseInt(string2, 8);
          } else {
            return parseInt(string2);
          }
        };
        if (match = string.match(ipv4Regexes.fourOctet)) {
          return (function() {
            var k, len, ref, results;
            ref = match.slice(1, 6);
            results = [];
            for (k = 0, len = ref.length; k < len; k++) {
              part = ref[k];
              results.push(parseIntAuto(part));
            }
            return results;
          })();
        } else if (match = string.match(ipv4Regexes.longValue)) {
          value = parseIntAuto(match[1]);
          if (value > 4294967295 || value < 0) {
            throw new Error("ipaddr: address outside defined range");
          }
          return (function() {
            var k, results;
            results = [];
            for (shift = k = 0; k <= 24; shift = k += 8) {
              results.push(value >> shift & 255);
            }
            return results;
          })().reverse();
        } else {
          return null;
        }
      };
      ipaddr.IPv6 = (function() {
        function IPv6(parts, zoneId) {
          var i, k, l, len, part, ref;
          if (parts.length === 16) {
            this.parts = [];
            for (i = k = 0; k <= 14; i = k += 2) {
              this.parts.push(parts[i] << 8 | parts[i + 1]);
            }
          } else if (parts.length === 8) {
            this.parts = parts;
          } else {
            throw new Error("ipaddr: ipv6 part count should be 8 or 16");
          }
          ref = this.parts;
          for (l = 0, len = ref.length; l < len; l++) {
            part = ref[l];
            if (!(0 <= part && part <= 65535)) {
              throw new Error("ipaddr: ipv6 part should fit in 16 bits");
            }
          }
          if (zoneId) {
            this.zoneId = zoneId;
          }
        }
        IPv6.prototype.kind = function() {
          return "ipv6";
        };
        IPv6.prototype.toString = function() {
          return this.toNormalizedString().replace(/((^|:)(0(:|$))+)/, "::");
        };
        IPv6.prototype.toRFC5952String = function() {
          var bestMatchIndex, bestMatchLength, match, regex, string;
          regex = /((^|:)(0(:|$)){2,})/g;
          string = this.toNormalizedString();
          bestMatchIndex = 0;
          bestMatchLength = -1;
          while (match = regex.exec(string)) {
            if (match[0].length > bestMatchLength) {
              bestMatchIndex = match.index;
              bestMatchLength = match[0].length;
            }
          }
          if (bestMatchLength < 0) {
            return string;
          }
          return string.substring(0, bestMatchIndex) + "::" + string.substring(bestMatchIndex + bestMatchLength);
        };
        IPv6.prototype.toByteArray = function() {
          var bytes, k, len, part, ref;
          bytes = [];
          ref = this.parts;
          for (k = 0, len = ref.length; k < len; k++) {
            part = ref[k];
            bytes.push(part >> 8);
            bytes.push(part & 255);
          }
          return bytes;
        };
        IPv6.prototype.toNormalizedString = function() {
          var addr, part, suffix;
          addr = (function() {
            var k, len, ref, results;
            ref = this.parts;
            results = [];
            for (k = 0, len = ref.length; k < len; k++) {
              part = ref[k];
              results.push(part.toString(16));
            }
            return results;
          }).call(this).join(":");
          suffix = "";
          if (this.zoneId) {
            suffix = "%" + this.zoneId;
          }
          return addr + suffix;
        };
        IPv6.prototype.toFixedLengthString = function() {
          var addr, part, suffix;
          addr = (function() {
            var k, len, ref, results;
            ref = this.parts;
            results = [];
            for (k = 0, len = ref.length; k < len; k++) {
              part = ref[k];
              results.push(part.toString(16).padStart(4, "0"));
            }
            return results;
          }).call(this).join(":");
          suffix = "";
          if (this.zoneId) {
            suffix = "%" + this.zoneId;
          }
          return addr + suffix;
        };
        IPv6.prototype.match = function(other, cidrRange) {
          var ref;
          if (cidrRange === void 0) {
            ref = other, other = ref[0], cidrRange = ref[1];
          }
          if (other.kind() !== "ipv6") {
            throw new Error("ipaddr: cannot match ipv6 address with non-ipv6 one");
          }
          return matchCIDR(this.parts, other.parts, 16, cidrRange);
        };
        IPv6.prototype.SpecialRanges = {
          unspecified: [new IPv6([0, 0, 0, 0, 0, 0, 0, 0]), 128],
          linkLocal: [new IPv6([65152, 0, 0, 0, 0, 0, 0, 0]), 10],
          multicast: [new IPv6([65280, 0, 0, 0, 0, 0, 0, 0]), 8],
          loopback: [new IPv6([0, 0, 0, 0, 0, 0, 0, 1]), 128],
          uniqueLocal: [new IPv6([64512, 0, 0, 0, 0, 0, 0, 0]), 7],
          ipv4Mapped: [new IPv6([0, 0, 0, 0, 0, 65535, 0, 0]), 96],
          rfc6145: [new IPv6([0, 0, 0, 0, 65535, 0, 0, 0]), 96],
          rfc6052: [new IPv6([100, 65435, 0, 0, 0, 0, 0, 0]), 96],
          "6to4": [new IPv6([8194, 0, 0, 0, 0, 0, 0, 0]), 16],
          teredo: [new IPv6([8193, 0, 0, 0, 0, 0, 0, 0]), 32],
          reserved: [[new IPv6([8193, 3512, 0, 0, 0, 0, 0, 0]), 32]]
        };
        IPv6.prototype.range = function() {
          return ipaddr.subnetMatch(this, this.SpecialRanges);
        };
        IPv6.prototype.isIPv4MappedAddress = function() {
          return this.range() === "ipv4Mapped";
        };
        IPv6.prototype.toIPv4Address = function() {
          var high, low, ref;
          if (!this.isIPv4MappedAddress()) {
            throw new Error("ipaddr: trying to convert a generic ipv6 address to ipv4");
          }
          ref = this.parts.slice(-2), high = ref[0], low = ref[1];
          return new ipaddr.IPv4([high >> 8, high & 255, low >> 8, low & 255]);
        };
        IPv6.prototype.prefixLengthFromSubnetMask = function() {
          var cidr, i, k, part, stop2, zeros, zerotable;
          zerotable = {
            0: 16,
            32768: 15,
            49152: 14,
            57344: 13,
            61440: 12,
            63488: 11,
            64512: 10,
            65024: 9,
            65280: 8,
            65408: 7,
            65472: 6,
            65504: 5,
            65520: 4,
            65528: 3,
            65532: 2,
            65534: 1,
            65535: 0
          };
          cidr = 0;
          stop2 = false;
          for (i = k = 7; k >= 0; i = k += -1) {
            part = this.parts[i];
            if (part in zerotable) {
              zeros = zerotable[part];
              if (stop2 && zeros !== 0) {
                return null;
              }
              if (zeros !== 16) {
                stop2 = true;
              }
              cidr += zeros;
            } else {
              return null;
            }
          }
          return 128 - cidr;
        };
        return IPv6;
      })();
      ipv6Part = "(?:[0-9a-f]+::?)+";
      zoneIndex = "%[0-9a-z]{1,}";
      ipv6Regexes = {
        zoneIndex: new RegExp(zoneIndex, "i"),
        "native": new RegExp("^(::)?(" + ipv6Part + ")?([0-9a-f]+)?(::)?(" + zoneIndex + ")?$", "i"),
        transitional: new RegExp("^((?:" + ipv6Part + ")|(?:::)(?:" + ipv6Part + ")?)" + (ipv4Part + "\\." + ipv4Part + "\\." + ipv4Part + "\\." + ipv4Part) + ("(" + zoneIndex + ")?$"), "i")
      };
      expandIPv6 = function(string, parts) {
        var colonCount, lastColon, part, replacement, replacementCount, zoneId;
        if (string.indexOf("::") !== string.lastIndexOf("::")) {
          return null;
        }
        zoneId = (string.match(ipv6Regexes["zoneIndex"]) || [])[0];
        if (zoneId) {
          zoneId = zoneId.substring(1);
          string = string.replace(/%.+$/, "");
        }
        colonCount = 0;
        lastColon = -1;
        while ((lastColon = string.indexOf(":", lastColon + 1)) >= 0) {
          colonCount++;
        }
        if (string.substr(0, 2) === "::") {
          colonCount--;
        }
        if (string.substr(-2, 2) === "::") {
          colonCount--;
        }
        if (colonCount > parts) {
          return null;
        }
        replacementCount = parts - colonCount;
        replacement = ":";
        while (replacementCount--) {
          replacement += "0:";
        }
        string = string.replace("::", replacement);
        if (string[0] === ":") {
          string = string.slice(1);
        }
        if (string[string.length - 1] === ":") {
          string = string.slice(0, -1);
        }
        parts = (function() {
          var k, len, ref, results;
          ref = string.split(":");
          results = [];
          for (k = 0, len = ref.length; k < len; k++) {
            part = ref[k];
            results.push(parseInt(part, 16));
          }
          return results;
        })();
        return {
          parts,
          zoneId
        };
      };
      ipaddr.IPv6.parser = function(string) {
        var addr, k, len, match, octet, octets, zoneId;
        if (ipv6Regexes["native"].test(string)) {
          return expandIPv6(string, 8);
        } else if (match = string.match(ipv6Regexes["transitional"])) {
          zoneId = match[6] || "";
          addr = expandIPv6(match[1].slice(0, -1) + zoneId, 6);
          if (addr.parts) {
            octets = [parseInt(match[2]), parseInt(match[3]), parseInt(match[4]), parseInt(match[5])];
            for (k = 0, len = octets.length; k < len; k++) {
              octet = octets[k];
              if (!(0 <= octet && octet <= 255)) {
                return null;
              }
            }
            addr.parts.push(octets[0] << 8 | octets[1]);
            addr.parts.push(octets[2] << 8 | octets[3]);
            return {
              parts: addr.parts,
              zoneId: addr.zoneId
            };
          }
        }
        return null;
      };
      ipaddr.IPv4.isIPv4 = ipaddr.IPv6.isIPv6 = function(string) {
        return this.parser(string) !== null;
      };
      ipaddr.IPv4.isValid = function(string) {
        var e;
        try {
          new this(this.parser(string));
          return true;
        } catch (error1) {
          e = error1;
          return false;
        }
      };
      ipaddr.IPv4.isValidFourPartDecimal = function(string) {
        if (ipaddr.IPv4.isValid(string) && string.match(/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){3}$/)) {
          return true;
        } else {
          return false;
        }
      };
      ipaddr.IPv6.isValid = function(string) {
        var addr, e;
        if (typeof string === "string" && string.indexOf(":") === -1) {
          return false;
        }
        try {
          addr = this.parser(string);
          new this(addr.parts, addr.zoneId);
          return true;
        } catch (error1) {
          e = error1;
          return false;
        }
      };
      ipaddr.IPv4.parse = function(string) {
        var parts;
        parts = this.parser(string);
        if (parts === null) {
          throw new Error("ipaddr: string is not formatted like ip address");
        }
        return new this(parts);
      };
      ipaddr.IPv6.parse = function(string) {
        var addr;
        addr = this.parser(string);
        if (addr.parts === null) {
          throw new Error("ipaddr: string is not formatted like ip address");
        }
        return new this(addr.parts, addr.zoneId);
      };
      ipaddr.IPv4.parseCIDR = function(string) {
        var maskLength, match, parsed;
        if (match = string.match(/^(.+)\/(\d+)$/)) {
          maskLength = parseInt(match[2]);
          if (maskLength >= 0 && maskLength <= 32) {
            parsed = [this.parse(match[1]), maskLength];
            Object.defineProperty(parsed, "toString", {
              value: function() {
                return this.join("/");
              }
            });
            return parsed;
          }
        }
        throw new Error("ipaddr: string is not formatted like an IPv4 CIDR range");
      };
      ipaddr.IPv4.subnetMaskFromPrefixLength = function(prefix) {
        var filledOctetCount, j, octets;
        prefix = parseInt(prefix);
        if (prefix < 0 || prefix > 32) {
          throw new Error("ipaddr: invalid IPv4 prefix length");
        }
        octets = [0, 0, 0, 0];
        j = 0;
        filledOctetCount = Math.floor(prefix / 8);
        while (j < filledOctetCount) {
          octets[j] = 255;
          j++;
        }
        if (filledOctetCount < 4) {
          octets[filledOctetCount] = Math.pow(2, prefix % 8) - 1 << 8 - prefix % 8;
        }
        return new this(octets);
      };
      ipaddr.IPv4.broadcastAddressFromCIDR = function(string) {
        var cidr, error, i, ipInterfaceOctets, octets, subnetMaskOctets;
        try {
          cidr = this.parseCIDR(string);
          ipInterfaceOctets = cidr[0].toByteArray();
          subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
          octets = [];
          i = 0;
          while (i < 4) {
            octets.push(parseInt(ipInterfaceOctets[i], 10) | parseInt(subnetMaskOctets[i], 10) ^ 255);
            i++;
          }
          return new this(octets);
        } catch (error1) {
          error = error1;
          throw new Error("ipaddr: the address does not have IPv4 CIDR format");
        }
      };
      ipaddr.IPv4.networkAddressFromCIDR = function(string) {
        var cidr, error, i, ipInterfaceOctets, octets, subnetMaskOctets;
        try {
          cidr = this.parseCIDR(string);
          ipInterfaceOctets = cidr[0].toByteArray();
          subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
          octets = [];
          i = 0;
          while (i < 4) {
            octets.push(parseInt(ipInterfaceOctets[i], 10) & parseInt(subnetMaskOctets[i], 10));
            i++;
          }
          return new this(octets);
        } catch (error1) {
          error = error1;
          throw new Error("ipaddr: the address does not have IPv4 CIDR format");
        }
      };
      ipaddr.IPv6.parseCIDR = function(string) {
        var maskLength, match, parsed;
        if (match = string.match(/^(.+)\/(\d+)$/)) {
          maskLength = parseInt(match[2]);
          if (maskLength >= 0 && maskLength <= 128) {
            parsed = [this.parse(match[1]), maskLength];
            Object.defineProperty(parsed, "toString", {
              value: function() {
                return this.join("/");
              }
            });
            return parsed;
          }
        }
        throw new Error("ipaddr: string is not formatted like an IPv6 CIDR range");
      };
      ipaddr.isValid = function(string) {
        return ipaddr.IPv6.isValid(string) || ipaddr.IPv4.isValid(string);
      };
      ipaddr.parse = function(string) {
        if (ipaddr.IPv6.isValid(string)) {
          return ipaddr.IPv6.parse(string);
        } else if (ipaddr.IPv4.isValid(string)) {
          return ipaddr.IPv4.parse(string);
        } else {
          throw new Error("ipaddr: the address has neither IPv6 nor IPv4 format");
        }
      };
      ipaddr.parseCIDR = function(string) {
        var e;
        try {
          return ipaddr.IPv6.parseCIDR(string);
        } catch (error1) {
          e = error1;
          try {
            return ipaddr.IPv4.parseCIDR(string);
          } catch (error12) {
            e = error12;
            throw new Error("ipaddr: the address has neither IPv6 nor IPv4 CIDR format");
          }
        }
      };
      ipaddr.fromByteArray = function(bytes) {
        var length;
        length = bytes.length;
        if (length === 4) {
          return new ipaddr.IPv4(bytes);
        } else if (length === 16) {
          return new ipaddr.IPv6(bytes);
        } else {
          throw new Error("ipaddr: the binary input is neither an IPv6 nor IPv4 address");
        }
      };
      ipaddr.process = function(string) {
        var addr;
        addr = this.parse(string);
        if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) {
          return addr.toIPv4Address();
        } else {
          return addr;
        }
      };
    }).call(exports2);
  }
});

// node_modules/compact2string/index.js
var require_compact2string = __commonJS({
  "node_modules/compact2string/index.js"(exports2, module2) {
    var ipaddr = require_ipaddr();
    var compact2string = function(buf) {
      switch (buf.length) {
        case 6:
          return buf[0] + "." + buf[1] + "." + buf[2] + "." + buf[3] + ":" + buf.readUInt16BE(4);
          break;
        case 18:
          var hexGroups = [];
          for (var i = 0; i < 8; i++) {
            hexGroups.push(buf.readUInt16BE(i * 2).toString(16));
          }
          var host = ipaddr.parse(hexGroups.join(":")).toString();
          return "[" + host + "]:" + buf.readUInt16BE(16);
        default:
          throw new Error("Invalid Compact IP/PORT, It should contain 6 or 18 bytes");
      }
    };
    compact2string.multi = function(buf) {
      if (buf.length % 6 !== 0)
        throw new Error("buf length isn't multiple of compact IP/PORTs (6 bytes)");
      var output = [];
      for (var i = 0; i <= buf.length - 1; i = i + 6) {
        output.push(compact2string(buf.slice(i, i + 6)));
      }
      return output;
    };
    compact2string.multi6 = function(buf) {
      if (buf.length % 18 !== 0)
        throw new Error("buf length isn't multiple of compact IP6/PORTs (18 bytes)");
      var output = [];
      for (var i = 0; i <= buf.length - 1; i = i + 18) {
        output.push(compact2string(buf.slice(i, i + 18)));
      }
      return output;
    };
    module2.exports = compact2string;
  }
});

// node_modules/simple-concat/index.js
var require_simple_concat = __commonJS({
  "node_modules/simple-concat/index.js"(exports2, module2) {
    module2.exports = function(stream, cb) {
      var chunks = [];
      stream.on("data", function(chunk) {
        chunks.push(chunk);
      });
      stream.once("end", function() {
        if (cb) cb(null, Buffer.concat(chunks));
        cb = null;
      });
      stream.once("error", function(err) {
        if (cb) cb(err);
        cb = null;
      });
    };
  }
});

// node_modules/mimic-response/index.js
var require_mimic_response = __commonJS({
  "node_modules/mimic-response/index.js"(exports2, module2) {
    "use strict";
    var knownProps = [
      "destroy",
      "setTimeout",
      "socket",
      "headers",
      "trailers",
      "rawHeaders",
      "statusCode",
      "httpVersion",
      "httpVersionMinor",
      "httpVersionMajor",
      "rawTrailers",
      "statusMessage"
    ];
    module2.exports = (fromStream, toStream) => {
      const fromProps = new Set(Object.keys(fromStream).concat(knownProps));
      for (const prop of fromProps) {
        if (prop in toStream) {
          continue;
        }
        toStream[prop] = typeof fromStream[prop] === "function" ? fromStream[prop].bind(fromStream) : fromStream[prop];
      }
    };
  }
});

// node_modules/decompress-response/index.js
var require_decompress_response = __commonJS({
  "node_modules/decompress-response/index.js"(exports2, module2) {
    "use strict";
    var PassThrough = require("stream").PassThrough;
    var zlib = require("zlib");
    var mimicResponse = require_mimic_response();
    module2.exports = (response) => {
      if (["gzip", "deflate"].indexOf(response.headers["content-encoding"]) === -1) {
        return response;
      }
      const unzip = zlib.createUnzip();
      const stream = new PassThrough();
      mimicResponse(response, stream);
      unzip.on("error", (err) => {
        if (err.code === "Z_BUF_ERROR") {
          stream.end();
          return;
        }
        stream.emit("error", err);
      });
      response.pipe(unzip).pipe(stream);
      return stream;
    };
  }
});

// node_modules/simple-get/index.js
var require_simple_get = __commonJS({
  "node_modules/simple-get/index.js"(exports2, module2) {
    module2.exports = simpleGet;
    var concat = require_simple_concat();
    var http2 = require("http");
    var https = require("https");
    var once = require_once();
    var querystring = require("querystring");
    var decompressResponse = require_decompress_response();
    var url = require("url");
    function simpleGet(opts, cb) {
      opts = typeof opts === "string" ? { url: opts } : Object.assign({}, opts);
      cb = once(cb);
      opts.headers = Object.assign({}, opts.headers);
      Object.keys(opts.headers).forEach(function(h) {
        if (h.toLowerCase() !== h) {
          opts.headers[h.toLowerCase()] = opts.headers[h];
          delete opts.headers[h];
        }
      });
      if (opts.url) {
        var loc = url.parse(opts.url);
        if (loc.hostname) opts.hostname = loc.hostname;
        if (loc.port) opts.port = loc.port;
        if (loc.protocol) opts.protocol = loc.protocol;
        if (loc.auth) opts.auth = loc.auth;
        opts.path = loc.path;
        delete opts.url;
      }
      if (opts.maxRedirects == null) opts.maxRedirects = 10;
      if (opts.method) opts.method = opts.method.toUpperCase();
      var body;
      if (opts.body) {
        body = opts.json && !isStream(opts.body) ? JSON.stringify(opts.body) : opts.body;
      } else if (opts.form) {
        body = typeof opts.form === "string" ? opts.form : querystring.stringify(opts.form);
        opts.headers["content-type"] = "application/x-www-form-urlencoded";
      }
      delete opts.body;
      delete opts.form;
      if (body) {
        if (!opts.method) opts.method = "POST";
        if (!isStream(body)) opts.headers["content-length"] = Buffer.byteLength(body);
        if (opts.json) opts.headers["content-type"] = "application/json";
      }
      if (opts.json) opts.headers.accept = "application/json";
      if (!opts.headers["accept-encoding"]) opts.headers["accept-encoding"] = "gzip, deflate";
      var originalHost = opts.hostname;
      var protocol = opts.protocol === "https:" ? https : http2;
      var req = protocol.request(opts, function(res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && "location" in res.headers) {
          opts.url = res.headers.location;
          delete opts.headers.host;
          res.resume();
          var redirectHost = url.parse(opts.url).hostname;
          if (redirectHost !== null && redirectHost !== originalHost) {
            delete opts.headers.cookie;
            delete opts.headers.authorization;
          }
          if ((res.statusCode === 301 || res.statusCode === 302) && opts.method === "POST") {
            opts.method = "GET";
            delete opts.headers["content-length"];
            delete opts.headers["content-type"];
          }
          if (opts.maxRedirects === 0) return cb(new Error("too many redirects"));
          opts.maxRedirects -= 1;
          return simpleGet(opts, cb);
        }
        var tryUnzip = typeof decompressResponse === "function" && opts.method !== "HEAD";
        cb(null, tryUnzip ? decompressResponse(res) : res);
      });
      req.on("timeout", function() {
        req.abort();
        cb(new Error("Request timed out"));
      });
      req.on("error", cb);
      if (body && isStream(body)) body.on("error", cb).pipe(req);
      else req.end(body);
      return req;
    }
    simpleGet.concat = function(opts, cb) {
      return simpleGet(opts, function(err, res) {
        if (err) return cb(err);
        concat(res, function(err2, data) {
          if (err2) return cb(err2);
          if (opts.json) {
            try {
              data = JSON.parse(data.toString());
            } catch (err3) {
              return cb(err3, res, data);
            }
          }
          cb(null, res, data);
        });
      });
    };
    ["get", "post", "put", "patch", "head", "delete"].forEach(function(method) {
      simpleGet[method] = function(opts, cb) {
        if (typeof opts === "string") opts = { url: opts };
        opts.method = method.toUpperCase();
        return simpleGet(opts, cb);
      };
    });
    function isStream(obj) {
      return typeof obj.pipe === "function";
    }
  }
});

// node_modules/bittorrent-tracker/lib/client/tracker.js
var require_tracker = __commonJS({
  "node_modules/bittorrent-tracker/lib/client/tracker.js"(exports2, module2) {
    module2.exports = Tracker;
    var EventEmitter = require("events").EventEmitter;
    var inherits = require_inherits();
    inherits(Tracker, EventEmitter);
    function Tracker(client, announceUrl) {
      var self2 = this;
      EventEmitter.call(self2);
      self2.client = client;
      self2.announceUrl = announceUrl;
      self2.interval = null;
      self2.destroyed = false;
    }
    Tracker.prototype.setInterval = function(intervalMs) {
      var self2 = this;
      if (intervalMs == null) intervalMs = self2.DEFAULT_ANNOUNCE_INTERVAL;
      clearInterval(self2.interval);
      if (intervalMs) {
        self2.interval = setInterval(function() {
          self2.announce(self2.client._defaultAnnounceOpts());
        }, intervalMs);
        if (self2.interval.unref) self2.interval.unref();
      }
    };
  }
});

// node_modules/bittorrent-tracker/lib/client/http-tracker.js
var require_http_tracker = __commonJS({
  "node_modules/bittorrent-tracker/lib/client/http-tracker.js"(exports2, module2) {
    module2.exports = HTTPTracker;
    var bencode = require_bencode3();
    var compact2string = require_compact2string();
    var debug = require_src()("bittorrent-tracker:http-tracker");
    var extend = require_immutable();
    var get = require_simple_get();
    var inherits = require_inherits();
    var common = require_common2();
    var Tracker = require_tracker();
    var HTTP_SCRAPE_SUPPORT = /\/(announce)[^\/]*$/;
    inherits(HTTPTracker, Tracker);
    function HTTPTracker(client, announceUrl, opts) {
      var self2 = this;
      Tracker.call(self2, client, announceUrl);
      debug("new http tracker %s", announceUrl);
      self2.scrapeUrl = null;
      var m;
      if (m = self2.announceUrl.match(HTTP_SCRAPE_SUPPORT)) {
        self2.scrapeUrl = self2.announceUrl.slice(0, m.index) + "/scrape" + self2.announceUrl.slice(m.index + 9);
      }
    }
    HTTPTracker.prototype.DEFAULT_ANNOUNCE_INTERVAL = 30 * 60 * 1e3;
    HTTPTracker.prototype.announce = function(opts) {
      var self2 = this;
      if (self2.destroyed) return;
      var params = extend(opts, {
        compact: opts.compact == null ? 1 : opts.compact,
        info_hash: self2.client._infoHashBinary,
        peer_id: self2.client._peerIdBinary,
        port: self2.client._port
      });
      if (self2._trackerId) params.trackerid = self2._trackerId;
      self2._request(self2.announceUrl, params, function(data) {
        self2._onAnnounceResponse(data);
      });
    };
    HTTPTracker.prototype.scrape = function(opts) {
      var self2 = this;
      if (self2.destroyed) return;
      if (!self2.scrapeUrl) {
        self2.client.emit("error", new Error("scrape not supported " + self2.announceUrl));
        return;
      }
      var infoHashes = Array.isArray(opts.infoHash) && opts.infoHash.length > 0 ? opts.infoHash.map(function(infoHash) {
        return infoHash.toString("binary");
      }) : opts.infoHash && opts.infoHash.toString("binary") || self2.client._infoHashBinary;
      var params = {
        info_hash: infoHashes
      };
      self2._request(self2.scrapeUrl, params, function(data) {
        self2._onScrapeResponse(data);
      });
    };
    HTTPTracker.prototype.destroy = function(cb) {
      var self2 = this;
      if (self2.destroyed) return cb(null);
      self2.destroyed = true;
      clearInterval(self2.interval);
      cb(null);
    };
    HTTPTracker.prototype._request = function(requestUrl, params, cb) {
      var self2 = this;
      var u = requestUrl + (requestUrl.indexOf("?") === -1 ? "?" : "&") + common.querystringStringify(params);
      get.concat(u, function(err, res, data) {
        if (self2.destroyed) return;
        if (err) return self2.client.emit("warning", err);
        if (res.statusCode !== 200) {
          return self2.client.emit("warning", new Error("Non-200 response code " + res.statusCode + " from " + self2.announceUrl));
        }
        if (!data || data.length === 0) {
          return self2.client.emit("warning", new Error("Invalid tracker response from" + self2.announceUrl));
        }
        try {
          data = bencode.decode(data);
        } catch (err2) {
          return self2.client.emit("warning", new Error("Error decoding tracker response: " + err2.message));
        }
        var failure = data["failure reason"];
        if (failure) {
          debug("failure from " + requestUrl + " (" + failure + ")");
          return self2.client.emit("warning", new Error(failure));
        }
        var warning = data["warning message"];
        if (warning) {
          debug("warning from " + requestUrl + " (" + warning + ")");
          self2.client.emit("warning", new Error(warning));
        }
        debug("response from " + requestUrl);
        cb(data);
      });
    };
    HTTPTracker.prototype._onAnnounceResponse = function(data) {
      var self2 = this;
      var interval = data.interval || data["min interval"];
      if (interval) self2.setInterval(interval * 1e3);
      var trackerId = data["tracker id"];
      if (trackerId) {
        self2._trackerId = trackerId;
      }
      self2.client.emit("update", {
        announce: self2.announceUrl,
        complete: data.complete,
        incomplete: data.incomplete
      });
      var addrs;
      if (Buffer.isBuffer(data.peers)) {
        try {
          addrs = compact2string.multi(data.peers);
        } catch (err) {
          return self2.client.emit("warning", err);
        }
        addrs.forEach(function(addr) {
          self2.client.emit("peer", addr);
        });
      } else if (Array.isArray(data.peers)) {
        data.peers.forEach(function(peer) {
          self2.client.emit("peer", peer.ip + ":" + peer.port);
        });
      }
      if (Buffer.isBuffer(data.peers6)) {
        try {
          addrs = compact2string.multi6(data.peers6);
        } catch (err) {
          return self2.client.emit("warning", err);
        }
        addrs.forEach(function(addr) {
          self2.client.emit("peer", addr);
        });
      } else if (Array.isArray(data.peers6)) {
        data.peers6.forEach(function(peer) {
          var ip = /^\[/.test(peer.ip) || !/:/.test(peer.ip) ? peer.ip : "[" + peer.ip + "]";
          self2.client.emit("peer", ip + ":" + peer.port);
        });
      }
    };
    HTTPTracker.prototype._onScrapeResponse = function(data) {
      var self2 = this;
      data = data.files || data.host || {};
      var keys = Object.keys(data);
      if (keys.length === 0) {
        self2.client.emit("warning", new Error("invalid scrape response"));
        return;
      }
      keys.forEach(function(infoHash) {
        var response = data[infoHash];
        self2.client.emit("scrape", {
          announce: self2.announceUrl,
          infoHash: common.binaryToHex(infoHash),
          complete: response.complete,
          incomplete: response.incomplete,
          downloaded: response.downloaded
        });
      });
    };
  }
});

// node_modules/bn.js/lib/bn.js
var require_bn = __commonJS({
  "node_modules/bn.js/lib/bn.js"(exports2, module2) {
    (function(module3, exports3) {
      "use strict";
      function assert(val, msg) {
        if (!val) throw new Error(msg || "Assertion failed");
      }
      function inherits(ctor, superCtor) {
        ctor.super_ = superCtor;
        var TempCtor = function() {
        };
        TempCtor.prototype = superCtor.prototype;
        ctor.prototype = new TempCtor();
        ctor.prototype.constructor = ctor;
      }
      function BN(number, base, endian) {
        if (BN.isBN(number)) {
          return number;
        }
        this.negative = 0;
        this.words = null;
        this.length = 0;
        this.red = null;
        if (number !== null) {
          if (base === "le" || base === "be") {
            endian = base;
            base = 10;
          }
          this._init(number || 0, base || 10, endian || "be");
        }
      }
      if (typeof module3 === "object") {
        module3.exports = BN;
      } else {
        exports3.BN = BN;
      }
      BN.BN = BN;
      BN.wordSize = 26;
      var Buffer2;
      try {
        if (typeof window !== "undefined" && typeof window.Buffer !== "undefined") {
          Buffer2 = window.Buffer;
        } else {
          Buffer2 = require("buffer").Buffer;
        }
      } catch (e) {
      }
      BN.isBN = function isBN(num) {
        if (num instanceof BN) {
          return true;
        }
        return num !== null && typeof num === "object" && num.constructor.wordSize === BN.wordSize && Array.isArray(num.words);
      };
      BN.max = function max(left, right) {
        if (left.cmp(right) > 0) return left;
        return right;
      };
      BN.min = function min(left, right) {
        if (left.cmp(right) < 0) return left;
        return right;
      };
      BN.prototype._init = function init(number, base, endian) {
        if (typeof number === "number") {
          return this._initNumber(number, base, endian);
        }
        if (typeof number === "object") {
          return this._initArray(number, base, endian);
        }
        if (base === "hex") {
          base = 16;
        }
        assert(base === (base | 0) && base >= 2 && base <= 36);
        number = number.toString().replace(/\s+/g, "");
        var start = 0;
        if (number[0] === "-") {
          start++;
          this.negative = 1;
        }
        if (start < number.length) {
          if (base === 16) {
            this._parseHex(number, start, endian);
          } else {
            this._parseBase(number, base, start);
            if (endian === "le") {
              this._initArray(this.toArray(), base, endian);
            }
          }
        }
      };
      BN.prototype._initNumber = function _initNumber(number, base, endian) {
        if (number < 0) {
          this.negative = 1;
          number = -number;
        }
        if (number < 67108864) {
          this.words = [number & 67108863];
          this.length = 1;
        } else if (number < 4503599627370496) {
          this.words = [
            number & 67108863,
            number / 67108864 & 67108863
          ];
          this.length = 2;
        } else {
          assert(number < 9007199254740992);
          this.words = [
            number & 67108863,
            number / 67108864 & 67108863,
            1
          ];
          this.length = 3;
        }
        if (endian !== "le") return;
        this._initArray(this.toArray(), base, endian);
      };
      BN.prototype._initArray = function _initArray(number, base, endian) {
        assert(typeof number.length === "number");
        if (number.length <= 0) {
          this.words = [0];
          this.length = 1;
          return this;
        }
        this.length = Math.ceil(number.length / 3);
        this.words = new Array(this.length);
        for (var i = 0; i < this.length; i++) {
          this.words[i] = 0;
        }
        var j, w;
        var off = 0;
        if (endian === "be") {
          for (i = number.length - 1, j = 0; i >= 0; i -= 3) {
            w = number[i] | number[i - 1] << 8 | number[i - 2] << 16;
            this.words[j] |= w << off & 67108863;
            this.words[j + 1] = w >>> 26 - off & 67108863;
            off += 24;
            if (off >= 26) {
              off -= 26;
              j++;
            }
          }
        } else if (endian === "le") {
          for (i = 0, j = 0; i < number.length; i += 3) {
            w = number[i] | number[i + 1] << 8 | number[i + 2] << 16;
            this.words[j] |= w << off & 67108863;
            this.words[j + 1] = w >>> 26 - off & 67108863;
            off += 24;
            if (off >= 26) {
              off -= 26;
              j++;
            }
          }
        }
        return this.strip();
      };
      function parseHex4Bits(string, index) {
        var c = string.charCodeAt(index);
        if (c >= 65 && c <= 70) {
          return c - 55;
        } else if (c >= 97 && c <= 102) {
          return c - 87;
        } else {
          return c - 48 & 15;
        }
      }
      function parseHexByte(string, lowerBound, index) {
        var r = parseHex4Bits(string, index);
        if (index - 1 >= lowerBound) {
          r |= parseHex4Bits(string, index - 1) << 4;
        }
        return r;
      }
      BN.prototype._parseHex = function _parseHex(number, start, endian) {
        this.length = Math.ceil((number.length - start) / 6);
        this.words = new Array(this.length);
        for (var i = 0; i < this.length; i++) {
          this.words[i] = 0;
        }
        var off = 0;
        var j = 0;
        var w;
        if (endian === "be") {
          for (i = number.length - 1; i >= start; i -= 2) {
            w = parseHexByte(number, start, i) << off;
            this.words[j] |= w & 67108863;
            if (off >= 18) {
              off -= 18;
              j += 1;
              this.words[j] |= w >>> 26;
            } else {
              off += 8;
            }
          }
        } else {
          var parseLength = number.length - start;
          for (i = parseLength % 2 === 0 ? start + 1 : start; i < number.length; i += 2) {
            w = parseHexByte(number, start, i) << off;
            this.words[j] |= w & 67108863;
            if (off >= 18) {
              off -= 18;
              j += 1;
              this.words[j] |= w >>> 26;
            } else {
              off += 8;
            }
          }
        }
        this.strip();
      };
      function parseBase(str, start, end, mul) {
        var r = 0;
        var len = Math.min(str.length, end);
        for (var i = start; i < len; i++) {
          var c = str.charCodeAt(i) - 48;
          r *= mul;
          if (c >= 49) {
            r += c - 49 + 10;
          } else if (c >= 17) {
            r += c - 17 + 10;
          } else {
            r += c;
          }
        }
        return r;
      }
      BN.prototype._parseBase = function _parseBase(number, base, start) {
        this.words = [0];
        this.length = 1;
        for (var limbLen = 0, limbPow = 1; limbPow <= 67108863; limbPow *= base) {
          limbLen++;
        }
        limbLen--;
        limbPow = limbPow / base | 0;
        var total = number.length - start;
        var mod = total % limbLen;
        var end = Math.min(total, total - mod) + start;
        var word = 0;
        for (var i = start; i < end; i += limbLen) {
          word = parseBase(number, i, i + limbLen, base);
          this.imuln(limbPow);
          if (this.words[0] + word < 67108864) {
            this.words[0] += word;
          } else {
            this._iaddn(word);
          }
        }
        if (mod !== 0) {
          var pow = 1;
          word = parseBase(number, i, number.length, base);
          for (i = 0; i < mod; i++) {
            pow *= base;
          }
          this.imuln(pow);
          if (this.words[0] + word < 67108864) {
            this.words[0] += word;
          } else {
            this._iaddn(word);
          }
        }
        this.strip();
      };
      BN.prototype.copy = function copy(dest) {
        dest.words = new Array(this.length);
        for (var i = 0; i < this.length; i++) {
          dest.words[i] = this.words[i];
        }
        dest.length = this.length;
        dest.negative = this.negative;
        dest.red = this.red;
      };
      BN.prototype.clone = function clone() {
        var r = new BN(null);
        this.copy(r);
        return r;
      };
      BN.prototype._expand = function _expand(size) {
        while (this.length < size) {
          this.words[this.length++] = 0;
        }
        return this;
      };
      BN.prototype.strip = function strip() {
        while (this.length > 1 && this.words[this.length - 1] === 0) {
          this.length--;
        }
        return this._normSign();
      };
      BN.prototype._normSign = function _normSign() {
        if (this.length === 1 && this.words[0] === 0) {
          this.negative = 0;
        }
        return this;
      };
      BN.prototype.inspect = function inspect() {
        return (this.red ? "<BN-R: " : "<BN: ") + this.toString(16) + ">";
      };
      var zeros = [
        "",
        "0",
        "00",
        "000",
        "0000",
        "00000",
        "000000",
        "0000000",
        "00000000",
        "000000000",
        "0000000000",
        "00000000000",
        "000000000000",
        "0000000000000",
        "00000000000000",
        "000000000000000",
        "0000000000000000",
        "00000000000000000",
        "000000000000000000",
        "0000000000000000000",
        "00000000000000000000",
        "000000000000000000000",
        "0000000000000000000000",
        "00000000000000000000000",
        "000000000000000000000000",
        "0000000000000000000000000"
      ];
      var groupSizes = [
        0,
        0,
        25,
        16,
        12,
        11,
        10,
        9,
        8,
        8,
        7,
        7,
        7,
        7,
        6,
        6,
        6,
        6,
        6,
        6,
        6,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5
      ];
      var groupBases = [
        0,
        0,
        33554432,
        43046721,
        16777216,
        48828125,
        60466176,
        40353607,
        16777216,
        43046721,
        1e7,
        19487171,
        35831808,
        62748517,
        7529536,
        11390625,
        16777216,
        24137569,
        34012224,
        47045881,
        64e6,
        4084101,
        5153632,
        6436343,
        7962624,
        9765625,
        11881376,
        14348907,
        17210368,
        20511149,
        243e5,
        28629151,
        33554432,
        39135393,
        45435424,
        52521875,
        60466176
      ];
      BN.prototype.toString = function toString(base, padding) {
        base = base || 10;
        padding = padding | 0 || 1;
        var out;
        if (base === 16 || base === "hex") {
          out = "";
          var off = 0;
          var carry = 0;
          for (var i = 0; i < this.length; i++) {
            var w = this.words[i];
            var word = ((w << off | carry) & 16777215).toString(16);
            carry = w >>> 24 - off & 16777215;
            off += 2;
            if (off >= 26) {
              off -= 26;
              i--;
            }
            if (carry !== 0 || i !== this.length - 1) {
              out = zeros[6 - word.length] + word + out;
            } else {
              out = word + out;
            }
          }
          if (carry !== 0) {
            out = carry.toString(16) + out;
          }
          while (out.length % padding !== 0) {
            out = "0" + out;
          }
          if (this.negative !== 0) {
            out = "-" + out;
          }
          return out;
        }
        if (base === (base | 0) && base >= 2 && base <= 36) {
          var groupSize = groupSizes[base];
          var groupBase = groupBases[base];
          out = "";
          var c = this.clone();
          c.negative = 0;
          while (!c.isZero()) {
            var r = c.modn(groupBase).toString(base);
            c = c.idivn(groupBase);
            if (!c.isZero()) {
              out = zeros[groupSize - r.length] + r + out;
            } else {
              out = r + out;
            }
          }
          if (this.isZero()) {
            out = "0" + out;
          }
          while (out.length % padding !== 0) {
            out = "0" + out;
          }
          if (this.negative !== 0) {
            out = "-" + out;
          }
          return out;
        }
        assert(false, "Base should be between 2 and 36");
      };
      BN.prototype.toNumber = function toNumber() {
        var ret = this.words[0];
        if (this.length === 2) {
          ret += this.words[1] * 67108864;
        } else if (this.length === 3 && this.words[2] === 1) {
          ret += 4503599627370496 + this.words[1] * 67108864;
        } else if (this.length > 2) {
          assert(false, "Number can only safely store up to 53 bits");
        }
        return this.negative !== 0 ? -ret : ret;
      };
      BN.prototype.toJSON = function toJSON() {
        return this.toString(16);
      };
      BN.prototype.toBuffer = function toBuffer(endian, length) {
        assert(typeof Buffer2 !== "undefined");
        return this.toArrayLike(Buffer2, endian, length);
      };
      BN.prototype.toArray = function toArray(endian, length) {
        return this.toArrayLike(Array, endian, length);
      };
      BN.prototype.toArrayLike = function toArrayLike(ArrayType, endian, length) {
        var byteLength = this.byteLength();
        var reqLength = length || Math.max(1, byteLength);
        assert(byteLength <= reqLength, "byte array longer than desired length");
        assert(reqLength > 0, "Requested array length <= 0");
        this.strip();
        var littleEndian = endian === "le";
        var res = new ArrayType(reqLength);
        var b, i;
        var q = this.clone();
        if (!littleEndian) {
          for (i = 0; i < reqLength - byteLength; i++) {
            res[i] = 0;
          }
          for (i = 0; !q.isZero(); i++) {
            b = q.andln(255);
            q.iushrn(8);
            res[reqLength - i - 1] = b;
          }
        } else {
          for (i = 0; !q.isZero(); i++) {
            b = q.andln(255);
            q.iushrn(8);
            res[i] = b;
          }
          for (; i < reqLength; i++) {
            res[i] = 0;
          }
        }
        return res;
      };
      if (Math.clz32) {
        BN.prototype._countBits = function _countBits(w) {
          return 32 - Math.clz32(w);
        };
      } else {
        BN.prototype._countBits = function _countBits(w) {
          var t = w;
          var r = 0;
          if (t >= 4096) {
            r += 13;
            t >>>= 13;
          }
          if (t >= 64) {
            r += 7;
            t >>>= 7;
          }
          if (t >= 8) {
            r += 4;
            t >>>= 4;
          }
          if (t >= 2) {
            r += 2;
            t >>>= 2;
          }
          return r + t;
        };
      }
      BN.prototype._zeroBits = function _zeroBits(w) {
        if (w === 0) return 26;
        var t = w;
        var r = 0;
        if ((t & 8191) === 0) {
          r += 13;
          t >>>= 13;
        }
        if ((t & 127) === 0) {
          r += 7;
          t >>>= 7;
        }
        if ((t & 15) === 0) {
          r += 4;
          t >>>= 4;
        }
        if ((t & 3) === 0) {
          r += 2;
          t >>>= 2;
        }
        if ((t & 1) === 0) {
          r++;
        }
        return r;
      };
      BN.prototype.bitLength = function bitLength() {
        var w = this.words[this.length - 1];
        var hi = this._countBits(w);
        return (this.length - 1) * 26 + hi;
      };
      function toBitArray(num) {
        var w = new Array(num.bitLength());
        for (var bit = 0; bit < w.length; bit++) {
          var off = bit / 26 | 0;
          var wbit = bit % 26;
          w[bit] = (num.words[off] & 1 << wbit) >>> wbit;
        }
        return w;
      }
      BN.prototype.zeroBits = function zeroBits() {
        if (this.isZero()) return 0;
        var r = 0;
        for (var i = 0; i < this.length; i++) {
          var b = this._zeroBits(this.words[i]);
          r += b;
          if (b !== 26) break;
        }
        return r;
      };
      BN.prototype.byteLength = function byteLength() {
        return Math.ceil(this.bitLength() / 8);
      };
      BN.prototype.toTwos = function toTwos(width) {
        if (this.negative !== 0) {
          return this.abs().inotn(width).iaddn(1);
        }
        return this.clone();
      };
      BN.prototype.fromTwos = function fromTwos(width) {
        if (this.testn(width - 1)) {
          return this.notn(width).iaddn(1).ineg();
        }
        return this.clone();
      };
      BN.prototype.isNeg = function isNeg() {
        return this.negative !== 0;
      };
      BN.prototype.neg = function neg() {
        return this.clone().ineg();
      };
      BN.prototype.ineg = function ineg() {
        if (!this.isZero()) {
          this.negative ^= 1;
        }
        return this;
      };
      BN.prototype.iuor = function iuor(num) {
        while (this.length < num.length) {
          this.words[this.length++] = 0;
        }
        for (var i = 0; i < num.length; i++) {
          this.words[i] = this.words[i] | num.words[i];
        }
        return this.strip();
      };
      BN.prototype.ior = function ior(num) {
        assert((this.negative | num.negative) === 0);
        return this.iuor(num);
      };
      BN.prototype.or = function or(num) {
        if (this.length > num.length) return this.clone().ior(num);
        return num.clone().ior(this);
      };
      BN.prototype.uor = function uor(num) {
        if (this.length > num.length) return this.clone().iuor(num);
        return num.clone().iuor(this);
      };
      BN.prototype.iuand = function iuand(num) {
        var b;
        if (this.length > num.length) {
          b = num;
        } else {
          b = this;
        }
        for (var i = 0; i < b.length; i++) {
          this.words[i] = this.words[i] & num.words[i];
        }
        this.length = b.length;
        return this.strip();
      };
      BN.prototype.iand = function iand(num) {
        assert((this.negative | num.negative) === 0);
        return this.iuand(num);
      };
      BN.prototype.and = function and(num) {
        if (this.length > num.length) return this.clone().iand(num);
        return num.clone().iand(this);
      };
      BN.prototype.uand = function uand(num) {
        if (this.length > num.length) return this.clone().iuand(num);
        return num.clone().iuand(this);
      };
      BN.prototype.iuxor = function iuxor(num) {
        var a;
        var b;
        if (this.length > num.length) {
          a = this;
          b = num;
        } else {
          a = num;
          b = this;
        }
        for (var i = 0; i < b.length; i++) {
          this.words[i] = a.words[i] ^ b.words[i];
        }
        if (this !== a) {
          for (; i < a.length; i++) {
            this.words[i] = a.words[i];
          }
        }
        this.length = a.length;
        return this.strip();
      };
      BN.prototype.ixor = function ixor(num) {
        assert((this.negative | num.negative) === 0);
        return this.iuxor(num);
      };
      BN.prototype.xor = function xor(num) {
        if (this.length > num.length) return this.clone().ixor(num);
        return num.clone().ixor(this);
      };
      BN.prototype.uxor = function uxor(num) {
        if (this.length > num.length) return this.clone().iuxor(num);
        return num.clone().iuxor(this);
      };
      BN.prototype.inotn = function inotn(width) {
        assert(typeof width === "number" && width >= 0);
        var bytesNeeded = Math.ceil(width / 26) | 0;
        var bitsLeft = width % 26;
        this._expand(bytesNeeded);
        if (bitsLeft > 0) {
          bytesNeeded--;
        }
        for (var i = 0; i < bytesNeeded; i++) {
          this.words[i] = ~this.words[i] & 67108863;
        }
        if (bitsLeft > 0) {
          this.words[i] = ~this.words[i] & 67108863 >> 26 - bitsLeft;
          i++;
        }
        for (; i < this.length; i++) {
          this.words[i] = 0;
        }
        return this.strip();
      };
      BN.prototype.notn = function notn(width) {
        return this.clone().inotn(width);
      };
      BN.prototype.setn = function setn(bit, val) {
        assert(typeof bit === "number" && bit >= 0);
        var off = bit / 26 | 0;
        var wbit = bit % 26;
        this._expand(off + 1);
        if (val) {
          this.words[off] = this.words[off] | 1 << wbit;
        } else {
          this.words[off] = this.words[off] & ~(1 << wbit);
        }
        return this.strip();
      };
      BN.prototype.iadd = function iadd(num) {
        var r;
        if (this.negative !== 0 && num.negative === 0) {
          this.negative = 0;
          r = this.isub(num);
          this.negative ^= 1;
          return this._normSign();
        } else if (this.negative === 0 && num.negative !== 0) {
          num.negative = 0;
          r = this.isub(num);
          num.negative = 1;
          return r._normSign();
        }
        var a, b;
        if (this.length > num.length) {
          a = this;
          b = num;
        } else {
          a = num;
          b = this;
        }
        var carry = 0;
        for (var i = 0; i < b.length; i++) {
          r = (a.words[i] | 0) + (b.words[i] | 0) + carry;
          this.words[i] = r & 67108863;
          carry = r >>> 26;
        }
        for (; carry !== 0 && i < a.length; i++) {
          r = (a.words[i] | 0) + carry;
          this.words[i] = r & 67108863;
          carry = r >>> 26;
        }
        this.length = a.length;
        if (carry !== 0) {
          this.words[this.length] = carry;
          this.length++;
        } else if (a !== this) {
          for (; i < a.length; i++) {
            this.words[i] = a.words[i];
          }
        }
        return this;
      };
      BN.prototype.add = function add(num) {
        var res;
        if (num.negative !== 0 && this.negative === 0) {
          num.negative = 0;
          res = this.sub(num);
          num.negative ^= 1;
          return res;
        } else if (num.negative === 0 && this.negative !== 0) {
          this.negative = 0;
          res = num.sub(this);
          this.negative = 1;
          return res;
        }
        if (this.length > num.length) return this.clone().iadd(num);
        return num.clone().iadd(this);
      };
      BN.prototype.isub = function isub(num) {
        if (num.negative !== 0) {
          num.negative = 0;
          var r = this.iadd(num);
          num.negative = 1;
          return r._normSign();
        } else if (this.negative !== 0) {
          this.negative = 0;
          this.iadd(num);
          this.negative = 1;
          return this._normSign();
        }
        var cmp = this.cmp(num);
        if (cmp === 0) {
          this.negative = 0;
          this.length = 1;
          this.words[0] = 0;
          return this;
        }
        var a, b;
        if (cmp > 0) {
          a = this;
          b = num;
        } else {
          a = num;
          b = this;
        }
        var carry = 0;
        for (var i = 0; i < b.length; i++) {
          r = (a.words[i] | 0) - (b.words[i] | 0) + carry;
          carry = r >> 26;
          this.words[i] = r & 67108863;
        }
        for (; carry !== 0 && i < a.length; i++) {
          r = (a.words[i] | 0) + carry;
          carry = r >> 26;
          this.words[i] = r & 67108863;
        }
        if (carry === 0 && i < a.length && a !== this) {
          for (; i < a.length; i++) {
            this.words[i] = a.words[i];
          }
        }
        this.length = Math.max(this.length, i);
        if (a !== this) {
          this.negative = 1;
        }
        return this.strip();
      };
      BN.prototype.sub = function sub(num) {
        return this.clone().isub(num);
      };
      function smallMulTo(self2, num, out) {
        out.negative = num.negative ^ self2.negative;
        var len = self2.length + num.length | 0;
        out.length = len;
        len = len - 1 | 0;
        var a = self2.words[0] | 0;
        var b = num.words[0] | 0;
        var r = a * b;
        var lo = r & 67108863;
        var carry = r / 67108864 | 0;
        out.words[0] = lo;
        for (var k = 1; k < len; k++) {
          var ncarry = carry >>> 26;
          var rword = carry & 67108863;
          var maxJ = Math.min(k, num.length - 1);
          for (var j = Math.max(0, k - self2.length + 1); j <= maxJ; j++) {
            var i = k - j | 0;
            a = self2.words[i] | 0;
            b = num.words[j] | 0;
            r = a * b + rword;
            ncarry += r / 67108864 | 0;
            rword = r & 67108863;
          }
          out.words[k] = rword | 0;
          carry = ncarry | 0;
        }
        if (carry !== 0) {
          out.words[k] = carry | 0;
        } else {
          out.length--;
        }
        return out.strip();
      }
      var comb10MulTo = function comb10MulTo2(self2, num, out) {
        var a = self2.words;
        var b = num.words;
        var o = out.words;
        var c = 0;
        var lo;
        var mid;
        var hi;
        var a0 = a[0] | 0;
        var al0 = a0 & 8191;
        var ah0 = a0 >>> 13;
        var a1 = a[1] | 0;
        var al1 = a1 & 8191;
        var ah1 = a1 >>> 13;
        var a2 = a[2] | 0;
        var al2 = a2 & 8191;
        var ah2 = a2 >>> 13;
        var a3 = a[3] | 0;
        var al3 = a3 & 8191;
        var ah3 = a3 >>> 13;
        var a4 = a[4] | 0;
        var al4 = a4 & 8191;
        var ah4 = a4 >>> 13;
        var a5 = a[5] | 0;
        var al5 = a5 & 8191;
        var ah5 = a5 >>> 13;
        var a6 = a[6] | 0;
        var al6 = a6 & 8191;
        var ah6 = a6 >>> 13;
        var a7 = a[7] | 0;
        var al7 = a7 & 8191;
        var ah7 = a7 >>> 13;
        var a8 = a[8] | 0;
        var al8 = a8 & 8191;
        var ah8 = a8 >>> 13;
        var a9 = a[9] | 0;
        var al9 = a9 & 8191;
        var ah9 = a9 >>> 13;
        var b0 = b[0] | 0;
        var bl0 = b0 & 8191;
        var bh0 = b0 >>> 13;
        var b1 = b[1] | 0;
        var bl1 = b1 & 8191;
        var bh1 = b1 >>> 13;
        var b2 = b[2] | 0;
        var bl2 = b2 & 8191;
        var bh2 = b2 >>> 13;
        var b3 = b[3] | 0;
        var bl3 = b3 & 8191;
        var bh3 = b3 >>> 13;
        var b4 = b[4] | 0;
        var bl4 = b4 & 8191;
        var bh4 = b4 >>> 13;
        var b5 = b[5] | 0;
        var bl5 = b5 & 8191;
        var bh5 = b5 >>> 13;
        var b6 = b[6] | 0;
        var bl6 = b6 & 8191;
        var bh6 = b6 >>> 13;
        var b7 = b[7] | 0;
        var bl7 = b7 & 8191;
        var bh7 = b7 >>> 13;
        var b8 = b[8] | 0;
        var bl8 = b8 & 8191;
        var bh8 = b8 >>> 13;
        var b9 = b[9] | 0;
        var bl9 = b9 & 8191;
        var bh9 = b9 >>> 13;
        out.negative = self2.negative ^ num.negative;
        out.length = 19;
        lo = Math.imul(al0, bl0);
        mid = Math.imul(al0, bh0);
        mid = mid + Math.imul(ah0, bl0) | 0;
        hi = Math.imul(ah0, bh0);
        var w0 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w0 >>> 26) | 0;
        w0 &= 67108863;
        lo = Math.imul(al1, bl0);
        mid = Math.imul(al1, bh0);
        mid = mid + Math.imul(ah1, bl0) | 0;
        hi = Math.imul(ah1, bh0);
        lo = lo + Math.imul(al0, bl1) | 0;
        mid = mid + Math.imul(al0, bh1) | 0;
        mid = mid + Math.imul(ah0, bl1) | 0;
        hi = hi + Math.imul(ah0, bh1) | 0;
        var w1 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w1 >>> 26) | 0;
        w1 &= 67108863;
        lo = Math.imul(al2, bl0);
        mid = Math.imul(al2, bh0);
        mid = mid + Math.imul(ah2, bl0) | 0;
        hi = Math.imul(ah2, bh0);
        lo = lo + Math.imul(al1, bl1) | 0;
        mid = mid + Math.imul(al1, bh1) | 0;
        mid = mid + Math.imul(ah1, bl1) | 0;
        hi = hi + Math.imul(ah1, bh1) | 0;
        lo = lo + Math.imul(al0, bl2) | 0;
        mid = mid + Math.imul(al0, bh2) | 0;
        mid = mid + Math.imul(ah0, bl2) | 0;
        hi = hi + Math.imul(ah0, bh2) | 0;
        var w2 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w2 >>> 26) | 0;
        w2 &= 67108863;
        lo = Math.imul(al3, bl0);
        mid = Math.imul(al3, bh0);
        mid = mid + Math.imul(ah3, bl0) | 0;
        hi = Math.imul(ah3, bh0);
        lo = lo + Math.imul(al2, bl1) | 0;
        mid = mid + Math.imul(al2, bh1) | 0;
        mid = mid + Math.imul(ah2, bl1) | 0;
        hi = hi + Math.imul(ah2, bh1) | 0;
        lo = lo + Math.imul(al1, bl2) | 0;
        mid = mid + Math.imul(al1, bh2) | 0;
        mid = mid + Math.imul(ah1, bl2) | 0;
        hi = hi + Math.imul(ah1, bh2) | 0;
        lo = lo + Math.imul(al0, bl3) | 0;
        mid = mid + Math.imul(al0, bh3) | 0;
        mid = mid + Math.imul(ah0, bl3) | 0;
        hi = hi + Math.imul(ah0, bh3) | 0;
        var w3 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w3 >>> 26) | 0;
        w3 &= 67108863;
        lo = Math.imul(al4, bl0);
        mid = Math.imul(al4, bh0);
        mid = mid + Math.imul(ah4, bl0) | 0;
        hi = Math.imul(ah4, bh0);
        lo = lo + Math.imul(al3, bl1) | 0;
        mid = mid + Math.imul(al3, bh1) | 0;
        mid = mid + Math.imul(ah3, bl1) | 0;
        hi = hi + Math.imul(ah3, bh1) | 0;
        lo = lo + Math.imul(al2, bl2) | 0;
        mid = mid + Math.imul(al2, bh2) | 0;
        mid = mid + Math.imul(ah2, bl2) | 0;
        hi = hi + Math.imul(ah2, bh2) | 0;
        lo = lo + Math.imul(al1, bl3) | 0;
        mid = mid + Math.imul(al1, bh3) | 0;
        mid = mid + Math.imul(ah1, bl3) | 0;
        hi = hi + Math.imul(ah1, bh3) | 0;
        lo = lo + Math.imul(al0, bl4) | 0;
        mid = mid + Math.imul(al0, bh4) | 0;
        mid = mid + Math.imul(ah0, bl4) | 0;
        hi = hi + Math.imul(ah0, bh4) | 0;
        var w4 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w4 >>> 26) | 0;
        w4 &= 67108863;
        lo = Math.imul(al5, bl0);
        mid = Math.imul(al5, bh0);
        mid = mid + Math.imul(ah5, bl0) | 0;
        hi = Math.imul(ah5, bh0);
        lo = lo + Math.imul(al4, bl1) | 0;
        mid = mid + Math.imul(al4, bh1) | 0;
        mid = mid + Math.imul(ah4, bl1) | 0;
        hi = hi + Math.imul(ah4, bh1) | 0;
        lo = lo + Math.imul(al3, bl2) | 0;
        mid = mid + Math.imul(al3, bh2) | 0;
        mid = mid + Math.imul(ah3, bl2) | 0;
        hi = hi + Math.imul(ah3, bh2) | 0;
        lo = lo + Math.imul(al2, bl3) | 0;
        mid = mid + Math.imul(al2, bh3) | 0;
        mid = mid + Math.imul(ah2, bl3) | 0;
        hi = hi + Math.imul(ah2, bh3) | 0;
        lo = lo + Math.imul(al1, bl4) | 0;
        mid = mid + Math.imul(al1, bh4) | 0;
        mid = mid + Math.imul(ah1, bl4) | 0;
        hi = hi + Math.imul(ah1, bh4) | 0;
        lo = lo + Math.imul(al0, bl5) | 0;
        mid = mid + Math.imul(al0, bh5) | 0;
        mid = mid + Math.imul(ah0, bl5) | 0;
        hi = hi + Math.imul(ah0, bh5) | 0;
        var w5 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w5 >>> 26) | 0;
        w5 &= 67108863;
        lo = Math.imul(al6, bl0);
        mid = Math.imul(al6, bh0);
        mid = mid + Math.imul(ah6, bl0) | 0;
        hi = Math.imul(ah6, bh0);
        lo = lo + Math.imul(al5, bl1) | 0;
        mid = mid + Math.imul(al5, bh1) | 0;
        mid = mid + Math.imul(ah5, bl1) | 0;
        hi = hi + Math.imul(ah5, bh1) | 0;
        lo = lo + Math.imul(al4, bl2) | 0;
        mid = mid + Math.imul(al4, bh2) | 0;
        mid = mid + Math.imul(ah4, bl2) | 0;
        hi = hi + Math.imul(ah4, bh2) | 0;
        lo = lo + Math.imul(al3, bl3) | 0;
        mid = mid + Math.imul(al3, bh3) | 0;
        mid = mid + Math.imul(ah3, bl3) | 0;
        hi = hi + Math.imul(ah3, bh3) | 0;
        lo = lo + Math.imul(al2, bl4) | 0;
        mid = mid + Math.imul(al2, bh4) | 0;
        mid = mid + Math.imul(ah2, bl4) | 0;
        hi = hi + Math.imul(ah2, bh4) | 0;
        lo = lo + Math.imul(al1, bl5) | 0;
        mid = mid + Math.imul(al1, bh5) | 0;
        mid = mid + Math.imul(ah1, bl5) | 0;
        hi = hi + Math.imul(ah1, bh5) | 0;
        lo = lo + Math.imul(al0, bl6) | 0;
        mid = mid + Math.imul(al0, bh6) | 0;
        mid = mid + Math.imul(ah0, bl6) | 0;
        hi = hi + Math.imul(ah0, bh6) | 0;
        var w6 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w6 >>> 26) | 0;
        w6 &= 67108863;
        lo = Math.imul(al7, bl0);
        mid = Math.imul(al7, bh0);
        mid = mid + Math.imul(ah7, bl0) | 0;
        hi = Math.imul(ah7, bh0);
        lo = lo + Math.imul(al6, bl1) | 0;
        mid = mid + Math.imul(al6, bh1) | 0;
        mid = mid + Math.imul(ah6, bl1) | 0;
        hi = hi + Math.imul(ah6, bh1) | 0;
        lo = lo + Math.imul(al5, bl2) | 0;
        mid = mid + Math.imul(al5, bh2) | 0;
        mid = mid + Math.imul(ah5, bl2) | 0;
        hi = hi + Math.imul(ah5, bh2) | 0;
        lo = lo + Math.imul(al4, bl3) | 0;
        mid = mid + Math.imul(al4, bh3) | 0;
        mid = mid + Math.imul(ah4, bl3) | 0;
        hi = hi + Math.imul(ah4, bh3) | 0;
        lo = lo + Math.imul(al3, bl4) | 0;
        mid = mid + Math.imul(al3, bh4) | 0;
        mid = mid + Math.imul(ah3, bl4) | 0;
        hi = hi + Math.imul(ah3, bh4) | 0;
        lo = lo + Math.imul(al2, bl5) | 0;
        mid = mid + Math.imul(al2, bh5) | 0;
        mid = mid + Math.imul(ah2, bl5) | 0;
        hi = hi + Math.imul(ah2, bh5) | 0;
        lo = lo + Math.imul(al1, bl6) | 0;
        mid = mid + Math.imul(al1, bh6) | 0;
        mid = mid + Math.imul(ah1, bl6) | 0;
        hi = hi + Math.imul(ah1, bh6) | 0;
        lo = lo + Math.imul(al0, bl7) | 0;
        mid = mid + Math.imul(al0, bh7) | 0;
        mid = mid + Math.imul(ah0, bl7) | 0;
        hi = hi + Math.imul(ah0, bh7) | 0;
        var w7 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w7 >>> 26) | 0;
        w7 &= 67108863;
        lo = Math.imul(al8, bl0);
        mid = Math.imul(al8, bh0);
        mid = mid + Math.imul(ah8, bl0) | 0;
        hi = Math.imul(ah8, bh0);
        lo = lo + Math.imul(al7, bl1) | 0;
        mid = mid + Math.imul(al7, bh1) | 0;
        mid = mid + Math.imul(ah7, bl1) | 0;
        hi = hi + Math.imul(ah7, bh1) | 0;
        lo = lo + Math.imul(al6, bl2) | 0;
        mid = mid + Math.imul(al6, bh2) | 0;
        mid = mid + Math.imul(ah6, bl2) | 0;
        hi = hi + Math.imul(ah6, bh2) | 0;
        lo = lo + Math.imul(al5, bl3) | 0;
        mid = mid + Math.imul(al5, bh3) | 0;
        mid = mid + Math.imul(ah5, bl3) | 0;
        hi = hi + Math.imul(ah5, bh3) | 0;
        lo = lo + Math.imul(al4, bl4) | 0;
        mid = mid + Math.imul(al4, bh4) | 0;
        mid = mid + Math.imul(ah4, bl4) | 0;
        hi = hi + Math.imul(ah4, bh4) | 0;
        lo = lo + Math.imul(al3, bl5) | 0;
        mid = mid + Math.imul(al3, bh5) | 0;
        mid = mid + Math.imul(ah3, bl5) | 0;
        hi = hi + Math.imul(ah3, bh5) | 0;
        lo = lo + Math.imul(al2, bl6) | 0;
        mid = mid + Math.imul(al2, bh6) | 0;
        mid = mid + Math.imul(ah2, bl6) | 0;
        hi = hi + Math.imul(ah2, bh6) | 0;
        lo = lo + Math.imul(al1, bl7) | 0;
        mid = mid + Math.imul(al1, bh7) | 0;
        mid = mid + Math.imul(ah1, bl7) | 0;
        hi = hi + Math.imul(ah1, bh7) | 0;
        lo = lo + Math.imul(al0, bl8) | 0;
        mid = mid + Math.imul(al0, bh8) | 0;
        mid = mid + Math.imul(ah0, bl8) | 0;
        hi = hi + Math.imul(ah0, bh8) | 0;
        var w8 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w8 >>> 26) | 0;
        w8 &= 67108863;
        lo = Math.imul(al9, bl0);
        mid = Math.imul(al9, bh0);
        mid = mid + Math.imul(ah9, bl0) | 0;
        hi = Math.imul(ah9, bh0);
        lo = lo + Math.imul(al8, bl1) | 0;
        mid = mid + Math.imul(al8, bh1) | 0;
        mid = mid + Math.imul(ah8, bl1) | 0;
        hi = hi + Math.imul(ah8, bh1) | 0;
        lo = lo + Math.imul(al7, bl2) | 0;
        mid = mid + Math.imul(al7, bh2) | 0;
        mid = mid + Math.imul(ah7, bl2) | 0;
        hi = hi + Math.imul(ah7, bh2) | 0;
        lo = lo + Math.imul(al6, bl3) | 0;
        mid = mid + Math.imul(al6, bh3) | 0;
        mid = mid + Math.imul(ah6, bl3) | 0;
        hi = hi + Math.imul(ah6, bh3) | 0;
        lo = lo + Math.imul(al5, bl4) | 0;
        mid = mid + Math.imul(al5, bh4) | 0;
        mid = mid + Math.imul(ah5, bl4) | 0;
        hi = hi + Math.imul(ah5, bh4) | 0;
        lo = lo + Math.imul(al4, bl5) | 0;
        mid = mid + Math.imul(al4, bh5) | 0;
        mid = mid + Math.imul(ah4, bl5) | 0;
        hi = hi + Math.imul(ah4, bh5) | 0;
        lo = lo + Math.imul(al3, bl6) | 0;
        mid = mid + Math.imul(al3, bh6) | 0;
        mid = mid + Math.imul(ah3, bl6) | 0;
        hi = hi + Math.imul(ah3, bh6) | 0;
        lo = lo + Math.imul(al2, bl7) | 0;
        mid = mid + Math.imul(al2, bh7) | 0;
        mid = mid + Math.imul(ah2, bl7) | 0;
        hi = hi + Math.imul(ah2, bh7) | 0;
        lo = lo + Math.imul(al1, bl8) | 0;
        mid = mid + Math.imul(al1, bh8) | 0;
        mid = mid + Math.imul(ah1, bl8) | 0;
        hi = hi + Math.imul(ah1, bh8) | 0;
        lo = lo + Math.imul(al0, bl9) | 0;
        mid = mid + Math.imul(al0, bh9) | 0;
        mid = mid + Math.imul(ah0, bl9) | 0;
        hi = hi + Math.imul(ah0, bh9) | 0;
        var w9 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w9 >>> 26) | 0;
        w9 &= 67108863;
        lo = Math.imul(al9, bl1);
        mid = Math.imul(al9, bh1);
        mid = mid + Math.imul(ah9, bl1) | 0;
        hi = Math.imul(ah9, bh1);
        lo = lo + Math.imul(al8, bl2) | 0;
        mid = mid + Math.imul(al8, bh2) | 0;
        mid = mid + Math.imul(ah8, bl2) | 0;
        hi = hi + Math.imul(ah8, bh2) | 0;
        lo = lo + Math.imul(al7, bl3) | 0;
        mid = mid + Math.imul(al7, bh3) | 0;
        mid = mid + Math.imul(ah7, bl3) | 0;
        hi = hi + Math.imul(ah7, bh3) | 0;
        lo = lo + Math.imul(al6, bl4) | 0;
        mid = mid + Math.imul(al6, bh4) | 0;
        mid = mid + Math.imul(ah6, bl4) | 0;
        hi = hi + Math.imul(ah6, bh4) | 0;
        lo = lo + Math.imul(al5, bl5) | 0;
        mid = mid + Math.imul(al5, bh5) | 0;
        mid = mid + Math.imul(ah5, bl5) | 0;
        hi = hi + Math.imul(ah5, bh5) | 0;
        lo = lo + Math.imul(al4, bl6) | 0;
        mid = mid + Math.imul(al4, bh6) | 0;
        mid = mid + Math.imul(ah4, bl6) | 0;
        hi = hi + Math.imul(ah4, bh6) | 0;
        lo = lo + Math.imul(al3, bl7) | 0;
        mid = mid + Math.imul(al3, bh7) | 0;
        mid = mid + Math.imul(ah3, bl7) | 0;
        hi = hi + Math.imul(ah3, bh7) | 0;
        lo = lo + Math.imul(al2, bl8) | 0;
        mid = mid + Math.imul(al2, bh8) | 0;
        mid = mid + Math.imul(ah2, bl8) | 0;
        hi = hi + Math.imul(ah2, bh8) | 0;
        lo = lo + Math.imul(al1, bl9) | 0;
        mid = mid + Math.imul(al1, bh9) | 0;
        mid = mid + Math.imul(ah1, bl9) | 0;
        hi = hi + Math.imul(ah1, bh9) | 0;
        var w10 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w10 >>> 26) | 0;
        w10 &= 67108863;
        lo = Math.imul(al9, bl2);
        mid = Math.imul(al9, bh2);
        mid = mid + Math.imul(ah9, bl2) | 0;
        hi = Math.imul(ah9, bh2);
        lo = lo + Math.imul(al8, bl3) | 0;
        mid = mid + Math.imul(al8, bh3) | 0;
        mid = mid + Math.imul(ah8, bl3) | 0;
        hi = hi + Math.imul(ah8, bh3) | 0;
        lo = lo + Math.imul(al7, bl4) | 0;
        mid = mid + Math.imul(al7, bh4) | 0;
        mid = mid + Math.imul(ah7, bl4) | 0;
        hi = hi + Math.imul(ah7, bh4) | 0;
        lo = lo + Math.imul(al6, bl5) | 0;
        mid = mid + Math.imul(al6, bh5) | 0;
        mid = mid + Math.imul(ah6, bl5) | 0;
        hi = hi + Math.imul(ah6, bh5) | 0;
        lo = lo + Math.imul(al5, bl6) | 0;
        mid = mid + Math.imul(al5, bh6) | 0;
        mid = mid + Math.imul(ah5, bl6) | 0;
        hi = hi + Math.imul(ah5, bh6) | 0;
        lo = lo + Math.imul(al4, bl7) | 0;
        mid = mid + Math.imul(al4, bh7) | 0;
        mid = mid + Math.imul(ah4, bl7) | 0;
        hi = hi + Math.imul(ah4, bh7) | 0;
        lo = lo + Math.imul(al3, bl8) | 0;
        mid = mid + Math.imul(al3, bh8) | 0;
        mid = mid + Math.imul(ah3, bl8) | 0;
        hi = hi + Math.imul(ah3, bh8) | 0;
        lo = lo + Math.imul(al2, bl9) | 0;
        mid = mid + Math.imul(al2, bh9) | 0;
        mid = mid + Math.imul(ah2, bl9) | 0;
        hi = hi + Math.imul(ah2, bh9) | 0;
        var w11 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w11 >>> 26) | 0;
        w11 &= 67108863;
        lo = Math.imul(al9, bl3);
        mid = Math.imul(al9, bh3);
        mid = mid + Math.imul(ah9, bl3) | 0;
        hi = Math.imul(ah9, bh3);
        lo = lo + Math.imul(al8, bl4) | 0;
        mid = mid + Math.imul(al8, bh4) | 0;
        mid = mid + Math.imul(ah8, bl4) | 0;
        hi = hi + Math.imul(ah8, bh4) | 0;
        lo = lo + Math.imul(al7, bl5) | 0;
        mid = mid + Math.imul(al7, bh5) | 0;
        mid = mid + Math.imul(ah7, bl5) | 0;
        hi = hi + Math.imul(ah7, bh5) | 0;
        lo = lo + Math.imul(al6, bl6) | 0;
        mid = mid + Math.imul(al6, bh6) | 0;
        mid = mid + Math.imul(ah6, bl6) | 0;
        hi = hi + Math.imul(ah6, bh6) | 0;
        lo = lo + Math.imul(al5, bl7) | 0;
        mid = mid + Math.imul(al5, bh7) | 0;
        mid = mid + Math.imul(ah5, bl7) | 0;
        hi = hi + Math.imul(ah5, bh7) | 0;
        lo = lo + Math.imul(al4, bl8) | 0;
        mid = mid + Math.imul(al4, bh8) | 0;
        mid = mid + Math.imul(ah4, bl8) | 0;
        hi = hi + Math.imul(ah4, bh8) | 0;
        lo = lo + Math.imul(al3, bl9) | 0;
        mid = mid + Math.imul(al3, bh9) | 0;
        mid = mid + Math.imul(ah3, bl9) | 0;
        hi = hi + Math.imul(ah3, bh9) | 0;
        var w12 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w12 >>> 26) | 0;
        w12 &= 67108863;
        lo = Math.imul(al9, bl4);
        mid = Math.imul(al9, bh4);
        mid = mid + Math.imul(ah9, bl4) | 0;
        hi = Math.imul(ah9, bh4);
        lo = lo + Math.imul(al8, bl5) | 0;
        mid = mid + Math.imul(al8, bh5) | 0;
        mid = mid + Math.imul(ah8, bl5) | 0;
        hi = hi + Math.imul(ah8, bh5) | 0;
        lo = lo + Math.imul(al7, bl6) | 0;
        mid = mid + Math.imul(al7, bh6) | 0;
        mid = mid + Math.imul(ah7, bl6) | 0;
        hi = hi + Math.imul(ah7, bh6) | 0;
        lo = lo + Math.imul(al6, bl7) | 0;
        mid = mid + Math.imul(al6, bh7) | 0;
        mid = mid + Math.imul(ah6, bl7) | 0;
        hi = hi + Math.imul(ah6, bh7) | 0;
        lo = lo + Math.imul(al5, bl8) | 0;
        mid = mid + Math.imul(al5, bh8) | 0;
        mid = mid + Math.imul(ah5, bl8) | 0;
        hi = hi + Math.imul(ah5, bh8) | 0;
        lo = lo + Math.imul(al4, bl9) | 0;
        mid = mid + Math.imul(al4, bh9) | 0;
        mid = mid + Math.imul(ah4, bl9) | 0;
        hi = hi + Math.imul(ah4, bh9) | 0;
        var w13 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w13 >>> 26) | 0;
        w13 &= 67108863;
        lo = Math.imul(al9, bl5);
        mid = Math.imul(al9, bh5);
        mid = mid + Math.imul(ah9, bl5) | 0;
        hi = Math.imul(ah9, bh5);
        lo = lo + Math.imul(al8, bl6) | 0;
        mid = mid + Math.imul(al8, bh6) | 0;
        mid = mid + Math.imul(ah8, bl6) | 0;
        hi = hi + Math.imul(ah8, bh6) | 0;
        lo = lo + Math.imul(al7, bl7) | 0;
        mid = mid + Math.imul(al7, bh7) | 0;
        mid = mid + Math.imul(ah7, bl7) | 0;
        hi = hi + Math.imul(ah7, bh7) | 0;
        lo = lo + Math.imul(al6, bl8) | 0;
        mid = mid + Math.imul(al6, bh8) | 0;
        mid = mid + Math.imul(ah6, bl8) | 0;
        hi = hi + Math.imul(ah6, bh8) | 0;
        lo = lo + Math.imul(al5, bl9) | 0;
        mid = mid + Math.imul(al5, bh9) | 0;
        mid = mid + Math.imul(ah5, bl9) | 0;
        hi = hi + Math.imul(ah5, bh9) | 0;
        var w14 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w14 >>> 26) | 0;
        w14 &= 67108863;
        lo = Math.imul(al9, bl6);
        mid = Math.imul(al9, bh6);
        mid = mid + Math.imul(ah9, bl6) | 0;
        hi = Math.imul(ah9, bh6);
        lo = lo + Math.imul(al8, bl7) | 0;
        mid = mid + Math.imul(al8, bh7) | 0;
        mid = mid + Math.imul(ah8, bl7) | 0;
        hi = hi + Math.imul(ah8, bh7) | 0;
        lo = lo + Math.imul(al7, bl8) | 0;
        mid = mid + Math.imul(al7, bh8) | 0;
        mid = mid + Math.imul(ah7, bl8) | 0;
        hi = hi + Math.imul(ah7, bh8) | 0;
        lo = lo + Math.imul(al6, bl9) | 0;
        mid = mid + Math.imul(al6, bh9) | 0;
        mid = mid + Math.imul(ah6, bl9) | 0;
        hi = hi + Math.imul(ah6, bh9) | 0;
        var w15 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w15 >>> 26) | 0;
        w15 &= 67108863;
        lo = Math.imul(al9, bl7);
        mid = Math.imul(al9, bh7);
        mid = mid + Math.imul(ah9, bl7) | 0;
        hi = Math.imul(ah9, bh7);
        lo = lo + Math.imul(al8, bl8) | 0;
        mid = mid + Math.imul(al8, bh8) | 0;
        mid = mid + Math.imul(ah8, bl8) | 0;
        hi = hi + Math.imul(ah8, bh8) | 0;
        lo = lo + Math.imul(al7, bl9) | 0;
        mid = mid + Math.imul(al7, bh9) | 0;
        mid = mid + Math.imul(ah7, bl9) | 0;
        hi = hi + Math.imul(ah7, bh9) | 0;
        var w16 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w16 >>> 26) | 0;
        w16 &= 67108863;
        lo = Math.imul(al9, bl8);
        mid = Math.imul(al9, bh8);
        mid = mid + Math.imul(ah9, bl8) | 0;
        hi = Math.imul(ah9, bh8);
        lo = lo + Math.imul(al8, bl9) | 0;
        mid = mid + Math.imul(al8, bh9) | 0;
        mid = mid + Math.imul(ah8, bl9) | 0;
        hi = hi + Math.imul(ah8, bh9) | 0;
        var w17 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w17 >>> 26) | 0;
        w17 &= 67108863;
        lo = Math.imul(al9, bl9);
        mid = Math.imul(al9, bh9);
        mid = mid + Math.imul(ah9, bl9) | 0;
        hi = Math.imul(ah9, bh9);
        var w18 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
        c = (hi + (mid >>> 13) | 0) + (w18 >>> 26) | 0;
        w18 &= 67108863;
        o[0] = w0;
        o[1] = w1;
        o[2] = w2;
        o[3] = w3;
        o[4] = w4;
        o[5] = w5;
        o[6] = w6;
        o[7] = w7;
        o[8] = w8;
        o[9] = w9;
        o[10] = w10;
        o[11] = w11;
        o[12] = w12;
        o[13] = w13;
        o[14] = w14;
        o[15] = w15;
        o[16] = w16;
        o[17] = w17;
        o[18] = w18;
        if (c !== 0) {
          o[19] = c;
          out.length++;
        }
        return out;
      };
      if (!Math.imul) {
        comb10MulTo = smallMulTo;
      }
      function bigMulTo(self2, num, out) {
        out.negative = num.negative ^ self2.negative;
        out.length = self2.length + num.length;
        var carry = 0;
        var hncarry = 0;
        for (var k = 0; k < out.length - 1; k++) {
          var ncarry = hncarry;
          hncarry = 0;
          var rword = carry & 67108863;
          var maxJ = Math.min(k, num.length - 1);
          for (var j = Math.max(0, k - self2.length + 1); j <= maxJ; j++) {
            var i = k - j;
            var a = self2.words[i] | 0;
            var b = num.words[j] | 0;
            var r = a * b;
            var lo = r & 67108863;
            ncarry = ncarry + (r / 67108864 | 0) | 0;
            lo = lo + rword | 0;
            rword = lo & 67108863;
            ncarry = ncarry + (lo >>> 26) | 0;
            hncarry += ncarry >>> 26;
            ncarry &= 67108863;
          }
          out.words[k] = rword;
          carry = ncarry;
          ncarry = hncarry;
        }
        if (carry !== 0) {
          out.words[k] = carry;
        } else {
          out.length--;
        }
        return out.strip();
      }
      function jumboMulTo(self2, num, out) {
        var fftm = new FFTM();
        return fftm.mulp(self2, num, out);
      }
      BN.prototype.mulTo = function mulTo(num, out) {
        var res;
        var len = this.length + num.length;
        if (this.length === 10 && num.length === 10) {
          res = comb10MulTo(this, num, out);
        } else if (len < 63) {
          res = smallMulTo(this, num, out);
        } else if (len < 1024) {
          res = bigMulTo(this, num, out);
        } else {
          res = jumboMulTo(this, num, out);
        }
        return res;
      };
      function FFTM(x, y) {
        this.x = x;
        this.y = y;
      }
      FFTM.prototype.makeRBT = function makeRBT(N) {
        var t = new Array(N);
        var l = BN.prototype._countBits(N) - 1;
        for (var i = 0; i < N; i++) {
          t[i] = this.revBin(i, l, N);
        }
        return t;
      };
      FFTM.prototype.revBin = function revBin(x, l, N) {
        if (x === 0 || x === N - 1) return x;
        var rb = 0;
        for (var i = 0; i < l; i++) {
          rb |= (x & 1) << l - i - 1;
          x >>= 1;
        }
        return rb;
      };
      FFTM.prototype.permute = function permute(rbt, rws, iws, rtws, itws, N) {
        for (var i = 0; i < N; i++) {
          rtws[i] = rws[rbt[i]];
          itws[i] = iws[rbt[i]];
        }
      };
      FFTM.prototype.transform = function transform(rws, iws, rtws, itws, N, rbt) {
        this.permute(rbt, rws, iws, rtws, itws, N);
        for (var s = 1; s < N; s <<= 1) {
          var l = s << 1;
          var rtwdf = Math.cos(2 * Math.PI / l);
          var itwdf = Math.sin(2 * Math.PI / l);
          for (var p = 0; p < N; p += l) {
            var rtwdf_ = rtwdf;
            var itwdf_ = itwdf;
            for (var j = 0; j < s; j++) {
              var re = rtws[p + j];
              var ie = itws[p + j];
              var ro = rtws[p + j + s];
              var io = itws[p + j + s];
              var rx = rtwdf_ * ro - itwdf_ * io;
              io = rtwdf_ * io + itwdf_ * ro;
              ro = rx;
              rtws[p + j] = re + ro;
              itws[p + j] = ie + io;
              rtws[p + j + s] = re - ro;
              itws[p + j + s] = ie - io;
              if (j !== l) {
                rx = rtwdf * rtwdf_ - itwdf * itwdf_;
                itwdf_ = rtwdf * itwdf_ + itwdf * rtwdf_;
                rtwdf_ = rx;
              }
            }
          }
        }
      };
      FFTM.prototype.guessLen13b = function guessLen13b(n, m) {
        var N = Math.max(m, n) | 1;
        var odd = N & 1;
        var i = 0;
        for (N = N / 2 | 0; N; N = N >>> 1) {
          i++;
        }
        return 1 << i + 1 + odd;
      };
      FFTM.prototype.conjugate = function conjugate(rws, iws, N) {
        if (N <= 1) return;
        for (var i = 0; i < N / 2; i++) {
          var t = rws[i];
          rws[i] = rws[N - i - 1];
          rws[N - i - 1] = t;
          t = iws[i];
          iws[i] = -iws[N - i - 1];
          iws[N - i - 1] = -t;
        }
      };
      FFTM.prototype.normalize13b = function normalize13b(ws, N) {
        var carry = 0;
        for (var i = 0; i < N / 2; i++) {
          var w = Math.round(ws[2 * i + 1] / N) * 8192 + Math.round(ws[2 * i] / N) + carry;
          ws[i] = w & 67108863;
          if (w < 67108864) {
            carry = 0;
          } else {
            carry = w / 67108864 | 0;
          }
        }
        return ws;
      };
      FFTM.prototype.convert13b = function convert13b(ws, len, rws, N) {
        var carry = 0;
        for (var i = 0; i < len; i++) {
          carry = carry + (ws[i] | 0);
          rws[2 * i] = carry & 8191;
          carry = carry >>> 13;
          rws[2 * i + 1] = carry & 8191;
          carry = carry >>> 13;
        }
        for (i = 2 * len; i < N; ++i) {
          rws[i] = 0;
        }
        assert(carry === 0);
        assert((carry & ~8191) === 0);
      };
      FFTM.prototype.stub = function stub(N) {
        var ph = new Array(N);
        for (var i = 0; i < N; i++) {
          ph[i] = 0;
        }
        return ph;
      };
      FFTM.prototype.mulp = function mulp(x, y, out) {
        var N = 2 * this.guessLen13b(x.length, y.length);
        var rbt = this.makeRBT(N);
        var _ = this.stub(N);
        var rws = new Array(N);
        var rwst = new Array(N);
        var iwst = new Array(N);
        var nrws = new Array(N);
        var nrwst = new Array(N);
        var niwst = new Array(N);
        var rmws = out.words;
        rmws.length = N;
        this.convert13b(x.words, x.length, rws, N);
        this.convert13b(y.words, y.length, nrws, N);
        this.transform(rws, _, rwst, iwst, N, rbt);
        this.transform(nrws, _, nrwst, niwst, N, rbt);
        for (var i = 0; i < N; i++) {
          var rx = rwst[i] * nrwst[i] - iwst[i] * niwst[i];
          iwst[i] = rwst[i] * niwst[i] + iwst[i] * nrwst[i];
          rwst[i] = rx;
        }
        this.conjugate(rwst, iwst, N);
        this.transform(rwst, iwst, rmws, _, N, rbt);
        this.conjugate(rmws, _, N);
        this.normalize13b(rmws, N);
        out.negative = x.negative ^ y.negative;
        out.length = x.length + y.length;
        return out.strip();
      };
      BN.prototype.mul = function mul(num) {
        var out = new BN(null);
        out.words = new Array(this.length + num.length);
        return this.mulTo(num, out);
      };
      BN.prototype.mulf = function mulf(num) {
        var out = new BN(null);
        out.words = new Array(this.length + num.length);
        return jumboMulTo(this, num, out);
      };
      BN.prototype.imul = function imul(num) {
        return this.clone().mulTo(num, this);
      };
      BN.prototype.imuln = function imuln(num) {
        assert(typeof num === "number");
        assert(num < 67108864);
        var carry = 0;
        for (var i = 0; i < this.length; i++) {
          var w = (this.words[i] | 0) * num;
          var lo = (w & 67108863) + (carry & 67108863);
          carry >>= 26;
          carry += w / 67108864 | 0;
          carry += lo >>> 26;
          this.words[i] = lo & 67108863;
        }
        if (carry !== 0) {
          this.words[i] = carry;
          this.length++;
        }
        if (num === 0) {
          this.length = 1;
          this._normSign();
        }
        return this;
      };
      BN.prototype.muln = function muln(num) {
        return this.clone().imuln(num);
      };
      BN.prototype.sqr = function sqr() {
        return this.mul(this);
      };
      BN.prototype.isqr = function isqr() {
        return this.imul(this.clone());
      };
      BN.prototype.pow = function pow(num) {
        var w = toBitArray(num);
        if (w.length === 0) return new BN(1);
        var res = this;
        for (var i = 0; i < w.length; i++, res = res.sqr()) {
          if (w[i] !== 0) break;
        }
        if (++i < w.length) {
          for (var q = res.sqr(); i < w.length; i++, q = q.sqr()) {
            if (w[i] === 0) continue;
            res = res.mul(q);
          }
        }
        return res;
      };
      BN.prototype.iushln = function iushln(bits) {
        assert(typeof bits === "number" && bits >= 0);
        var r = bits % 26;
        var s = (bits - r) / 26;
        var carryMask = 67108863 >>> 26 - r << 26 - r;
        var i;
        if (r !== 0) {
          var carry = 0;
          for (i = 0; i < this.length; i++) {
            var newCarry = this.words[i] & carryMask;
            var c = (this.words[i] | 0) - newCarry << r;
            this.words[i] = c | carry;
            carry = newCarry >>> 26 - r;
          }
          if (carry) {
            this.words[i] = carry;
            this.length++;
          }
        }
        if (s !== 0) {
          for (i = this.length - 1; i >= 0; i--) {
            this.words[i + s] = this.words[i];
          }
          for (i = 0; i < s; i++) {
            this.words[i] = 0;
          }
          this.length += s;
        }
        return this.strip();
      };
      BN.prototype.ishln = function ishln(bits) {
        assert(this.negative === 0);
        return this.iushln(bits);
      };
      BN.prototype.iushrn = function iushrn(bits, hint, extended) {
        assert(typeof bits === "number" && bits >= 0);
        var h;
        if (hint) {
          h = (hint - hint % 26) / 26;
        } else {
          h = 0;
        }
        var r = bits % 26;
        var s = Math.min((bits - r) / 26, this.length);
        var mask = 67108863 ^ 67108863 >>> r << r;
        var maskedWords = extended;
        h -= s;
        h = Math.max(0, h);
        if (maskedWords) {
          for (var i = 0; i < s; i++) {
            maskedWords.words[i] = this.words[i];
          }
          maskedWords.length = s;
        }
        if (s === 0) {
        } else if (this.length > s) {
          this.length -= s;
          for (i = 0; i < this.length; i++) {
            this.words[i] = this.words[i + s];
          }
        } else {
          this.words[0] = 0;
          this.length = 1;
        }
        var carry = 0;
        for (i = this.length - 1; i >= 0 && (carry !== 0 || i >= h); i--) {
          var word = this.words[i] | 0;
          this.words[i] = carry << 26 - r | word >>> r;
          carry = word & mask;
        }
        if (maskedWords && carry !== 0) {
          maskedWords.words[maskedWords.length++] = carry;
        }
        if (this.length === 0) {
          this.words[0] = 0;
          this.length = 1;
        }
        return this.strip();
      };
      BN.prototype.ishrn = function ishrn(bits, hint, extended) {
        assert(this.negative === 0);
        return this.iushrn(bits, hint, extended);
      };
      BN.prototype.shln = function shln(bits) {
        return this.clone().ishln(bits);
      };
      BN.prototype.ushln = function ushln(bits) {
        return this.clone().iushln(bits);
      };
      BN.prototype.shrn = function shrn(bits) {
        return this.clone().ishrn(bits);
      };
      BN.prototype.ushrn = function ushrn(bits) {
        return this.clone().iushrn(bits);
      };
      BN.prototype.testn = function testn(bit) {
        assert(typeof bit === "number" && bit >= 0);
        var r = bit % 26;
        var s = (bit - r) / 26;
        var q = 1 << r;
        if (this.length <= s) return false;
        var w = this.words[s];
        return !!(w & q);
      };
      BN.prototype.imaskn = function imaskn(bits) {
        assert(typeof bits === "number" && bits >= 0);
        var r = bits % 26;
        var s = (bits - r) / 26;
        assert(this.negative === 0, "imaskn works only with positive numbers");
        if (this.length <= s) {
          return this;
        }
        if (r !== 0) {
          s++;
        }
        this.length = Math.min(s, this.length);
        if (r !== 0) {
          var mask = 67108863 ^ 67108863 >>> r << r;
          this.words[this.length - 1] &= mask;
        }
        if (this.length === 0) {
          this.words[0] = 0;
          this.length = 1;
        }
        return this.strip();
      };
      BN.prototype.maskn = function maskn(bits) {
        return this.clone().imaskn(bits);
      };
      BN.prototype.iaddn = function iaddn(num) {
        assert(typeof num === "number");
        assert(num < 67108864);
        if (num < 0) return this.isubn(-num);
        if (this.negative !== 0) {
          if (this.length === 1 && (this.words[0] | 0) < num) {
            this.words[0] = num - (this.words[0] | 0);
            this.negative = 0;
            return this;
          }
          this.negative = 0;
          this.isubn(num);
          this.negative = 1;
          return this;
        }
        return this._iaddn(num);
      };
      BN.prototype._iaddn = function _iaddn(num) {
        this.words[0] += num;
        for (var i = 0; i < this.length && this.words[i] >= 67108864; i++) {
          this.words[i] -= 67108864;
          if (i === this.length - 1) {
            this.words[i + 1] = 1;
          } else {
            this.words[i + 1]++;
          }
        }
        this.length = Math.max(this.length, i + 1);
        return this;
      };
      BN.prototype.isubn = function isubn(num) {
        assert(typeof num === "number");
        assert(num < 67108864);
        if (num < 0) return this.iaddn(-num);
        if (this.negative !== 0) {
          this.negative = 0;
          this.iaddn(num);
          this.negative = 1;
          return this;
        }
        this.words[0] -= num;
        if (this.length === 1 && this.words[0] < 0) {
          this.words[0] = -this.words[0];
          this.negative = 1;
        } else {
          for (var i = 0; i < this.length && this.words[i] < 0; i++) {
            this.words[i] += 67108864;
            this.words[i + 1] -= 1;
          }
        }
        return this.strip();
      };
      BN.prototype.addn = function addn(num) {
        return this.clone().iaddn(num);
      };
      BN.prototype.subn = function subn(num) {
        return this.clone().isubn(num);
      };
      BN.prototype.iabs = function iabs() {
        this.negative = 0;
        return this;
      };
      BN.prototype.abs = function abs() {
        return this.clone().iabs();
      };
      BN.prototype._ishlnsubmul = function _ishlnsubmul(num, mul, shift) {
        var len = num.length + shift;
        var i;
        this._expand(len);
        var w;
        var carry = 0;
        for (i = 0; i < num.length; i++) {
          w = (this.words[i + shift] | 0) + carry;
          var right = (num.words[i] | 0) * mul;
          w -= right & 67108863;
          carry = (w >> 26) - (right / 67108864 | 0);
          this.words[i + shift] = w & 67108863;
        }
        for (; i < this.length - shift; i++) {
          w = (this.words[i + shift] | 0) + carry;
          carry = w >> 26;
          this.words[i + shift] = w & 67108863;
        }
        if (carry === 0) return this.strip();
        assert(carry === -1);
        carry = 0;
        for (i = 0; i < this.length; i++) {
          w = -(this.words[i] | 0) + carry;
          carry = w >> 26;
          this.words[i] = w & 67108863;
        }
        this.negative = 1;
        return this.strip();
      };
      BN.prototype._wordDiv = function _wordDiv(num, mode) {
        var shift = this.length - num.length;
        var a = this.clone();
        var b = num;
        var bhi = b.words[b.length - 1] | 0;
        var bhiBits = this._countBits(bhi);
        shift = 26 - bhiBits;
        if (shift !== 0) {
          b = b.ushln(shift);
          a.iushln(shift);
          bhi = b.words[b.length - 1] | 0;
        }
        var m = a.length - b.length;
        var q;
        if (mode !== "mod") {
          q = new BN(null);
          q.length = m + 1;
          q.words = new Array(q.length);
          for (var i = 0; i < q.length; i++) {
            q.words[i] = 0;
          }
        }
        var diff = a.clone()._ishlnsubmul(b, 1, m);
        if (diff.negative === 0) {
          a = diff;
          if (q) {
            q.words[m] = 1;
          }
        }
        for (var j = m - 1; j >= 0; j--) {
          var qj = (a.words[b.length + j] | 0) * 67108864 + (a.words[b.length + j - 1] | 0);
          qj = Math.min(qj / bhi | 0, 67108863);
          a._ishlnsubmul(b, qj, j);
          while (a.negative !== 0) {
            qj--;
            a.negative = 0;
            a._ishlnsubmul(b, 1, j);
            if (!a.isZero()) {
              a.negative ^= 1;
            }
          }
          if (q) {
            q.words[j] = qj;
          }
        }
        if (q) {
          q.strip();
        }
        a.strip();
        if (mode !== "div" && shift !== 0) {
          a.iushrn(shift);
        }
        return {
          div: q || null,
          mod: a
        };
      };
      BN.prototype.divmod = function divmod(num, mode, positive) {
        assert(!num.isZero());
        if (this.isZero()) {
          return {
            div: new BN(0),
            mod: new BN(0)
          };
        }
        var div, mod, res;
        if (this.negative !== 0 && num.negative === 0) {
          res = this.neg().divmod(num, mode);
          if (mode !== "mod") {
            div = res.div.neg();
          }
          if (mode !== "div") {
            mod = res.mod.neg();
            if (positive && mod.negative !== 0) {
              mod.iadd(num);
            }
          }
          return {
            div,
            mod
          };
        }
        if (this.negative === 0 && num.negative !== 0) {
          res = this.divmod(num.neg(), mode);
          if (mode !== "mod") {
            div = res.div.neg();
          }
          return {
            div,
            mod: res.mod
          };
        }
        if ((this.negative & num.negative) !== 0) {
          res = this.neg().divmod(num.neg(), mode);
          if (mode !== "div") {
            mod = res.mod.neg();
            if (positive && mod.negative !== 0) {
              mod.isub(num);
            }
          }
          return {
            div: res.div,
            mod
          };
        }
        if (num.length > this.length || this.cmp(num) < 0) {
          return {
            div: new BN(0),
            mod: this
          };
        }
        if (num.length === 1) {
          if (mode === "div") {
            return {
              div: this.divn(num.words[0]),
              mod: null
            };
          }
          if (mode === "mod") {
            return {
              div: null,
              mod: new BN(this.modn(num.words[0]))
            };
          }
          return {
            div: this.divn(num.words[0]),
            mod: new BN(this.modn(num.words[0]))
          };
        }
        return this._wordDiv(num, mode);
      };
      BN.prototype.div = function div(num) {
        return this.divmod(num, "div", false).div;
      };
      BN.prototype.mod = function mod(num) {
        return this.divmod(num, "mod", false).mod;
      };
      BN.prototype.umod = function umod(num) {
        return this.divmod(num, "mod", true).mod;
      };
      BN.prototype.divRound = function divRound(num) {
        var dm = this.divmod(num);
        if (dm.mod.isZero()) return dm.div;
        var mod = dm.mod.abs();
        var half = num.abs().iushrn(1);
        var r2 = num.words[0] & 1;
        var cmp = mod.cmp(half);
        if (cmp < 0 || r2 === 1 && cmp === 0) return dm.div;
        var up = new BN(1);
        up.negative = this.negative ^ num.negative;
        return dm.div.iadd(up);
      };
      BN.prototype.modn = function modn(num) {
        assert(num <= 67108863);
        var p = (1 << 26) % num;
        var acc = 0;
        for (var i = this.length - 1; i >= 0; i--) {
          acc = (p * acc + (this.words[i] | 0)) % num;
        }
        return acc;
      };
      BN.prototype.idivn = function idivn(num) {
        assert(num <= 67108863);
        var carry = 0;
        for (var i = this.length - 1; i >= 0; i--) {
          var w = (this.words[i] | 0) + carry * 67108864;
          this.words[i] = w / num | 0;
          carry = w % num;
        }
        return this.strip();
      };
      BN.prototype.divn = function divn(num) {
        return this.clone().idivn(num);
      };
      BN.prototype.egcd = function egcd(p) {
        assert(p.negative === 0);
        assert(!p.isZero());
        var x = this;
        var y = p.clone();
        if (x.negative !== 0) {
          x = x.umod(p);
        } else {
          x = x.clone();
        }
        var A = new BN(1);
        var B = new BN(0);
        var C = new BN(0);
        var D = new BN(1);
        var g = 0;
        while (x.isEven() && y.isEven()) {
          x.iushrn(1);
          y.iushrn(1);
          ++g;
        }
        var yp = y.clone();
        var xp = x.clone();
        while (!x.isZero()) {
          for (var i = 0, im = 1; (x.words[0] & im) === 0 && i < 26; ++i, im <<= 1) ;
          if (i > 0) {
            x.iushrn(i);
            while (i-- > 0) {
              if (A.isOdd() || B.isOdd()) {
                A.iadd(yp);
                B.isub(xp);
              }
              A.iushrn(1);
              B.iushrn(1);
            }
          }
          for (var j = 0, jm = 1; (y.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1) ;
          if (j > 0) {
            y.iushrn(j);
            while (j-- > 0) {
              if (C.isOdd() || D.isOdd()) {
                C.iadd(yp);
                D.isub(xp);
              }
              C.iushrn(1);
              D.iushrn(1);
            }
          }
          if (x.cmp(y) >= 0) {
            x.isub(y);
            A.isub(C);
            B.isub(D);
          } else {
            y.isub(x);
            C.isub(A);
            D.isub(B);
          }
        }
        return {
          a: C,
          b: D,
          gcd: y.iushln(g)
        };
      };
      BN.prototype._invmp = function _invmp(p) {
        assert(p.negative === 0);
        assert(!p.isZero());
        var a = this;
        var b = p.clone();
        if (a.negative !== 0) {
          a = a.umod(p);
        } else {
          a = a.clone();
        }
        var x1 = new BN(1);
        var x2 = new BN(0);
        var delta = b.clone();
        while (a.cmpn(1) > 0 && b.cmpn(1) > 0) {
          for (var i = 0, im = 1; (a.words[0] & im) === 0 && i < 26; ++i, im <<= 1) ;
          if (i > 0) {
            a.iushrn(i);
            while (i-- > 0) {
              if (x1.isOdd()) {
                x1.iadd(delta);
              }
              x1.iushrn(1);
            }
          }
          for (var j = 0, jm = 1; (b.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1) ;
          if (j > 0) {
            b.iushrn(j);
            while (j-- > 0) {
              if (x2.isOdd()) {
                x2.iadd(delta);
              }
              x2.iushrn(1);
            }
          }
          if (a.cmp(b) >= 0) {
            a.isub(b);
            x1.isub(x2);
          } else {
            b.isub(a);
            x2.isub(x1);
          }
        }
        var res;
        if (a.cmpn(1) === 0) {
          res = x1;
        } else {
          res = x2;
        }
        if (res.cmpn(0) < 0) {
          res.iadd(p);
        }
        return res;
      };
      BN.prototype.gcd = function gcd(num) {
        if (this.isZero()) return num.abs();
        if (num.isZero()) return this.abs();
        var a = this.clone();
        var b = num.clone();
        a.negative = 0;
        b.negative = 0;
        for (var shift = 0; a.isEven() && b.isEven(); shift++) {
          a.iushrn(1);
          b.iushrn(1);
        }
        do {
          while (a.isEven()) {
            a.iushrn(1);
          }
          while (b.isEven()) {
            b.iushrn(1);
          }
          var r = a.cmp(b);
          if (r < 0) {
            var t = a;
            a = b;
            b = t;
          } else if (r === 0 || b.cmpn(1) === 0) {
            break;
          }
          a.isub(b);
        } while (true);
        return b.iushln(shift);
      };
      BN.prototype.invm = function invm(num) {
        return this.egcd(num).a.umod(num);
      };
      BN.prototype.isEven = function isEven() {
        return (this.words[0] & 1) === 0;
      };
      BN.prototype.isOdd = function isOdd() {
        return (this.words[0] & 1) === 1;
      };
      BN.prototype.andln = function andln(num) {
        return this.words[0] & num;
      };
      BN.prototype.bincn = function bincn(bit) {
        assert(typeof bit === "number");
        var r = bit % 26;
        var s = (bit - r) / 26;
        var q = 1 << r;
        if (this.length <= s) {
          this._expand(s + 1);
          this.words[s] |= q;
          return this;
        }
        var carry = q;
        for (var i = s; carry !== 0 && i < this.length; i++) {
          var w = this.words[i] | 0;
          w += carry;
          carry = w >>> 26;
          w &= 67108863;
          this.words[i] = w;
        }
        if (carry !== 0) {
          this.words[i] = carry;
          this.length++;
        }
        return this;
      };
      BN.prototype.isZero = function isZero() {
        return this.length === 1 && this.words[0] === 0;
      };
      BN.prototype.cmpn = function cmpn(num) {
        var negative = num < 0;
        if (this.negative !== 0 && !negative) return -1;
        if (this.negative === 0 && negative) return 1;
        this.strip();
        var res;
        if (this.length > 1) {
          res = 1;
        } else {
          if (negative) {
            num = -num;
          }
          assert(num <= 67108863, "Number is too big");
          var w = this.words[0] | 0;
          res = w === num ? 0 : w < num ? -1 : 1;
        }
        if (this.negative !== 0) return -res | 0;
        return res;
      };
      BN.prototype.cmp = function cmp(num) {
        if (this.negative !== 0 && num.negative === 0) return -1;
        if (this.negative === 0 && num.negative !== 0) return 1;
        var res = this.ucmp(num);
        if (this.negative !== 0) return -res | 0;
        return res;
      };
      BN.prototype.ucmp = function ucmp(num) {
        if (this.length > num.length) return 1;
        if (this.length < num.length) return -1;
        var res = 0;
        for (var i = this.length - 1; i >= 0; i--) {
          var a = this.words[i] | 0;
          var b = num.words[i] | 0;
          if (a === b) continue;
          if (a < b) {
            res = -1;
          } else if (a > b) {
            res = 1;
          }
          break;
        }
        return res;
      };
      BN.prototype.gtn = function gtn(num) {
        return this.cmpn(num) === 1;
      };
      BN.prototype.gt = function gt(num) {
        return this.cmp(num) === 1;
      };
      BN.prototype.gten = function gten(num) {
        return this.cmpn(num) >= 0;
      };
      BN.prototype.gte = function gte(num) {
        return this.cmp(num) >= 0;
      };
      BN.prototype.ltn = function ltn(num) {
        return this.cmpn(num) === -1;
      };
      BN.prototype.lt = function lt(num) {
        return this.cmp(num) === -1;
      };
      BN.prototype.lten = function lten(num) {
        return this.cmpn(num) <= 0;
      };
      BN.prototype.lte = function lte(num) {
        return this.cmp(num) <= 0;
      };
      BN.prototype.eqn = function eqn(num) {
        return this.cmpn(num) === 0;
      };
      BN.prototype.eq = function eq(num) {
        return this.cmp(num) === 0;
      };
      BN.red = function red(num) {
        return new Red(num);
      };
      BN.prototype.toRed = function toRed(ctx) {
        assert(!this.red, "Already a number in reduction context");
        assert(this.negative === 0, "red works only with positives");
        return ctx.convertTo(this)._forceRed(ctx);
      };
      BN.prototype.fromRed = function fromRed() {
        assert(this.red, "fromRed works only with numbers in reduction context");
        return this.red.convertFrom(this);
      };
      BN.prototype._forceRed = function _forceRed(ctx) {
        this.red = ctx;
        return this;
      };
      BN.prototype.forceRed = function forceRed(ctx) {
        assert(!this.red, "Already a number in reduction context");
        return this._forceRed(ctx);
      };
      BN.prototype.redAdd = function redAdd(num) {
        assert(this.red, "redAdd works only with red numbers");
        return this.red.add(this, num);
      };
      BN.prototype.redIAdd = function redIAdd(num) {
        assert(this.red, "redIAdd works only with red numbers");
        return this.red.iadd(this, num);
      };
      BN.prototype.redSub = function redSub(num) {
        assert(this.red, "redSub works only with red numbers");
        return this.red.sub(this, num);
      };
      BN.prototype.redISub = function redISub(num) {
        assert(this.red, "redISub works only with red numbers");
        return this.red.isub(this, num);
      };
      BN.prototype.redShl = function redShl(num) {
        assert(this.red, "redShl works only with red numbers");
        return this.red.shl(this, num);
      };
      BN.prototype.redMul = function redMul(num) {
        assert(this.red, "redMul works only with red numbers");
        this.red._verify2(this, num);
        return this.red.mul(this, num);
      };
      BN.prototype.redIMul = function redIMul(num) {
        assert(this.red, "redMul works only with red numbers");
        this.red._verify2(this, num);
        return this.red.imul(this, num);
      };
      BN.prototype.redSqr = function redSqr() {
        assert(this.red, "redSqr works only with red numbers");
        this.red._verify1(this);
        return this.red.sqr(this);
      };
      BN.prototype.redISqr = function redISqr() {
        assert(this.red, "redISqr works only with red numbers");
        this.red._verify1(this);
        return this.red.isqr(this);
      };
      BN.prototype.redSqrt = function redSqrt() {
        assert(this.red, "redSqrt works only with red numbers");
        this.red._verify1(this);
        return this.red.sqrt(this);
      };
      BN.prototype.redInvm = function redInvm() {
        assert(this.red, "redInvm works only with red numbers");
        this.red._verify1(this);
        return this.red.invm(this);
      };
      BN.prototype.redNeg = function redNeg() {
        assert(this.red, "redNeg works only with red numbers");
        this.red._verify1(this);
        return this.red.neg(this);
      };
      BN.prototype.redPow = function redPow(num) {
        assert(this.red && !num.red, "redPow(normalNum)");
        this.red._verify1(this);
        return this.red.pow(this, num);
      };
      var primes = {
        k256: null,
        p224: null,
        p192: null,
        p25519: null
      };
      function MPrime(name, p) {
        this.name = name;
        this.p = new BN(p, 16);
        this.n = this.p.bitLength();
        this.k = new BN(1).iushln(this.n).isub(this.p);
        this.tmp = this._tmp();
      }
      MPrime.prototype._tmp = function _tmp() {
        var tmp = new BN(null);
        tmp.words = new Array(Math.ceil(this.n / 13));
        return tmp;
      };
      MPrime.prototype.ireduce = function ireduce(num) {
        var r = num;
        var rlen;
        do {
          this.split(r, this.tmp);
          r = this.imulK(r);
          r = r.iadd(this.tmp);
          rlen = r.bitLength();
        } while (rlen > this.n);
        var cmp = rlen < this.n ? -1 : r.ucmp(this.p);
        if (cmp === 0) {
          r.words[0] = 0;
          r.length = 1;
        } else if (cmp > 0) {
          r.isub(this.p);
        } else {
          if (r.strip !== void 0) {
            r.strip();
          } else {
            r._strip();
          }
        }
        return r;
      };
      MPrime.prototype.split = function split(input, out) {
        input.iushrn(this.n, 0, out);
      };
      MPrime.prototype.imulK = function imulK(num) {
        return num.imul(this.k);
      };
      function K256() {
        MPrime.call(
          this,
          "k256",
          "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f"
        );
      }
      inherits(K256, MPrime);
      K256.prototype.split = function split(input, output) {
        var mask = 4194303;
        var outLen = Math.min(input.length, 9);
        for (var i = 0; i < outLen; i++) {
          output.words[i] = input.words[i];
        }
        output.length = outLen;
        if (input.length <= 9) {
          input.words[0] = 0;
          input.length = 1;
          return;
        }
        var prev = input.words[9];
        output.words[output.length++] = prev & mask;
        for (i = 10; i < input.length; i++) {
          var next = input.words[i] | 0;
          input.words[i - 10] = (next & mask) << 4 | prev >>> 22;
          prev = next;
        }
        prev >>>= 22;
        input.words[i - 10] = prev;
        if (prev === 0 && input.length > 10) {
          input.length -= 10;
        } else {
          input.length -= 9;
        }
      };
      K256.prototype.imulK = function imulK(num) {
        num.words[num.length] = 0;
        num.words[num.length + 1] = 0;
        num.length += 2;
        var lo = 0;
        for (var i = 0; i < num.length; i++) {
          var w = num.words[i] | 0;
          lo += w * 977;
          num.words[i] = lo & 67108863;
          lo = w * 64 + (lo / 67108864 | 0);
        }
        if (num.words[num.length - 1] === 0) {
          num.length--;
          if (num.words[num.length - 1] === 0) {
            num.length--;
          }
        }
        return num;
      };
      function P224() {
        MPrime.call(
          this,
          "p224",
          "ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001"
        );
      }
      inherits(P224, MPrime);
      function P192() {
        MPrime.call(
          this,
          "p192",
          "ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff"
        );
      }
      inherits(P192, MPrime);
      function P25519() {
        MPrime.call(
          this,
          "25519",
          "7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed"
        );
      }
      inherits(P25519, MPrime);
      P25519.prototype.imulK = function imulK(num) {
        var carry = 0;
        for (var i = 0; i < num.length; i++) {
          var hi = (num.words[i] | 0) * 19 + carry;
          var lo = hi & 67108863;
          hi >>>= 26;
          num.words[i] = lo;
          carry = hi;
        }
        if (carry !== 0) {
          num.words[num.length++] = carry;
        }
        return num;
      };
      BN._prime = function prime(name) {
        if (primes[name]) return primes[name];
        var prime2;
        if (name === "k256") {
          prime2 = new K256();
        } else if (name === "p224") {
          prime2 = new P224();
        } else if (name === "p192") {
          prime2 = new P192();
        } else if (name === "p25519") {
          prime2 = new P25519();
        } else {
          throw new Error("Unknown prime " + name);
        }
        primes[name] = prime2;
        return prime2;
      };
      function Red(m) {
        if (typeof m === "string") {
          var prime = BN._prime(m);
          this.m = prime.p;
          this.prime = prime;
        } else {
          assert(m.gtn(1), "modulus must be greater than 1");
          this.m = m;
          this.prime = null;
        }
      }
      Red.prototype._verify1 = function _verify1(a) {
        assert(a.negative === 0, "red works only with positives");
        assert(a.red, "red works only with red numbers");
      };
      Red.prototype._verify2 = function _verify2(a, b) {
        assert((a.negative | b.negative) === 0, "red works only with positives");
        assert(
          a.red && a.red === b.red,
          "red works only with red numbers"
        );
      };
      Red.prototype.imod = function imod(a) {
        if (this.prime) return this.prime.ireduce(a)._forceRed(this);
        return a.umod(this.m)._forceRed(this);
      };
      Red.prototype.neg = function neg(a) {
        if (a.isZero()) {
          return a.clone();
        }
        return this.m.sub(a)._forceRed(this);
      };
      Red.prototype.add = function add(a, b) {
        this._verify2(a, b);
        var res = a.add(b);
        if (res.cmp(this.m) >= 0) {
          res.isub(this.m);
        }
        return res._forceRed(this);
      };
      Red.prototype.iadd = function iadd(a, b) {
        this._verify2(a, b);
        var res = a.iadd(b);
        if (res.cmp(this.m) >= 0) {
          res.isub(this.m);
        }
        return res;
      };
      Red.prototype.sub = function sub(a, b) {
        this._verify2(a, b);
        var res = a.sub(b);
        if (res.cmpn(0) < 0) {
          res.iadd(this.m);
        }
        return res._forceRed(this);
      };
      Red.prototype.isub = function isub(a, b) {
        this._verify2(a, b);
        var res = a.isub(b);
        if (res.cmpn(0) < 0) {
          res.iadd(this.m);
        }
        return res;
      };
      Red.prototype.shl = function shl(a, num) {
        this._verify1(a);
        return this.imod(a.ushln(num));
      };
      Red.prototype.imul = function imul(a, b) {
        this._verify2(a, b);
        return this.imod(a.imul(b));
      };
      Red.prototype.mul = function mul(a, b) {
        this._verify2(a, b);
        return this.imod(a.mul(b));
      };
      Red.prototype.isqr = function isqr(a) {
        return this.imul(a, a.clone());
      };
      Red.prototype.sqr = function sqr(a) {
        return this.mul(a, a);
      };
      Red.prototype.sqrt = function sqrt(a) {
        if (a.isZero()) return a.clone();
        var mod3 = this.m.andln(3);
        assert(mod3 % 2 === 1);
        if (mod3 === 3) {
          var pow = this.m.add(new BN(1)).iushrn(2);
          return this.pow(a, pow);
        }
        var q = this.m.subn(1);
        var s = 0;
        while (!q.isZero() && q.andln(1) === 0) {
          s++;
          q.iushrn(1);
        }
        assert(!q.isZero());
        var one = new BN(1).toRed(this);
        var nOne = one.redNeg();
        var lpow = this.m.subn(1).iushrn(1);
        var z = this.m.bitLength();
        z = new BN(2 * z * z).toRed(this);
        while (this.pow(z, lpow).cmp(nOne) !== 0) {
          z.redIAdd(nOne);
        }
        var c = this.pow(z, q);
        var r = this.pow(a, q.addn(1).iushrn(1));
        var t = this.pow(a, q);
        var m = s;
        while (t.cmp(one) !== 0) {
          var tmp = t;
          for (var i = 0; tmp.cmp(one) !== 0; i++) {
            tmp = tmp.redSqr();
          }
          assert(i < m);
          var b = this.pow(c, new BN(1).iushln(m - i - 1));
          r = r.redMul(b);
          c = b.redSqr();
          t = t.redMul(c);
          m = i;
        }
        return r;
      };
      Red.prototype.invm = function invm(a) {
        var inv = a._invmp(this.m);
        if (inv.negative !== 0) {
          inv.negative = 0;
          return this.imod(inv).redNeg();
        } else {
          return this.imod(inv);
        }
      };
      Red.prototype.pow = function pow(a, num) {
        if (num.isZero()) return new BN(1).toRed(this);
        if (num.cmpn(1) === 0) return a.clone();
        var windowSize = 4;
        var wnd = new Array(1 << windowSize);
        wnd[0] = new BN(1).toRed(this);
        wnd[1] = a;
        for (var i = 2; i < wnd.length; i++) {
          wnd[i] = this.mul(wnd[i - 1], a);
        }
        var res = wnd[0];
        var current2 = 0;
        var currentLen = 0;
        var start = num.bitLength() % 26;
        if (start === 0) {
          start = 26;
        }
        for (i = num.length - 1; i >= 0; i--) {
          var word = num.words[i];
          for (var j = start - 1; j >= 0; j--) {
            var bit = word >> j & 1;
            if (res !== wnd[0]) {
              res = this.sqr(res);
            }
            if (bit === 0 && current2 === 0) {
              currentLen = 0;
              continue;
            }
            current2 <<= 1;
            current2 |= bit;
            currentLen++;
            if (currentLen !== windowSize && (i !== 0 || j !== 0)) continue;
            res = this.mul(res, wnd[current2]);
            currentLen = 0;
            current2 = 0;
          }
          start = 26;
        }
        return res;
      };
      Red.prototype.convertTo = function convertTo(num) {
        var r = num.umod(this.m);
        return r === num ? r.clone() : r;
      };
      Red.prototype.convertFrom = function convertFrom(num) {
        var res = num.clone();
        res.red = null;
        return res;
      };
      BN.mont = function mont(num) {
        return new Mont(num);
      };
      function Mont(m) {
        Red.call(this, m);
        this.shift = this.m.bitLength();
        if (this.shift % 26 !== 0) {
          this.shift += 26 - this.shift % 26;
        }
        this.r = new BN(1).iushln(this.shift);
        this.r2 = this.imod(this.r.sqr());
        this.rinv = this.r._invmp(this.m);
        this.minv = this.rinv.mul(this.r).isubn(1).div(this.m);
        this.minv = this.minv.umod(this.r);
        this.minv = this.r.sub(this.minv);
      }
      inherits(Mont, Red);
      Mont.prototype.convertTo = function convertTo(num) {
        return this.imod(num.ushln(this.shift));
      };
      Mont.prototype.convertFrom = function convertFrom(num) {
        var r = this.imod(num.mul(this.rinv));
        r.red = null;
        return r;
      };
      Mont.prototype.imul = function imul(a, b) {
        if (a.isZero() || b.isZero()) {
          a.words[0] = 0;
          a.length = 1;
          return a;
        }
        var t = a.imul(b);
        var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
        var u = t.isub(c).iushrn(this.shift);
        var res = u;
        if (u.cmp(this.m) >= 0) {
          res = u.isub(this.m);
        } else if (u.cmpn(0) < 0) {
          res = u.iadd(this.m);
        }
        return res._forceRed(this);
      };
      Mont.prototype.mul = function mul(a, b) {
        if (a.isZero() || b.isZero()) return new BN(0)._forceRed(this);
        var t = a.mul(b);
        var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
        var u = t.isub(c).iushrn(this.shift);
        var res = u;
        if (u.cmp(this.m) >= 0) {
          res = u.isub(this.m);
        } else if (u.cmpn(0) < 0) {
          res = u.iadd(this.m);
        }
        return res._forceRed(this);
      };
      Mont.prototype.invm = function invm(a) {
        var res = this.imod(a._invmp(this.m).mul(this.r2));
        return res._forceRed(this);
      };
    })(typeof module2 === "undefined" || module2, exports2);
  }
});

// node_modules/bittorrent-tracker/lib/client/udp-tracker.js
var require_udp_tracker = __commonJS({
  "node_modules/bittorrent-tracker/lib/client/udp-tracker.js"(exports2, module2) {
    module2.exports = UDPTracker;
    var BN = require_bn();
    var compact2string = require_compact2string();
    var debug = require_src()("bittorrent-tracker:udp-tracker");
    var dgram = require("dgram");
    var hat = require_hat();
    var inherits = require_inherits();
    var url = require("url");
    var common = require_common2();
    var Tracker = require_tracker();
    var TIMEOUT = 15e3;
    inherits(UDPTracker, Tracker);
    function UDPTracker(client, announceUrl, opts) {
      var self2 = this;
      Tracker.call(self2, client, announceUrl);
      debug("new udp tracker %s", announceUrl);
      self2.cleanupFns = [];
    }
    UDPTracker.prototype.DEFAULT_ANNOUNCE_INTERVAL = 30 * 60 * 1e3;
    UDPTracker.prototype.announce = function(opts) {
      var self2 = this;
      if (self2.destroyed) return;
      self2._request(opts);
    };
    UDPTracker.prototype.scrape = function(opts) {
      var self2 = this;
      if (self2.destroyed) return;
      opts._scrape = true;
      self2._request(opts);
    };
    UDPTracker.prototype.destroy = function(cb) {
      var self2 = this;
      if (self2.destroyed) return cb(null);
      self2.destroyed = true;
      clearInterval(self2.interval);
      self2.cleanupFns.slice(0).forEach(function(cleanup) {
        cleanup();
      });
      self2.cleanupFns = [];
      cb(null);
    };
    UDPTracker.prototype._request = function(opts) {
      var self2 = this;
      if (!opts) opts = {};
      var parsedUrl = url.parse(self2.announceUrl);
      var transactionId = genTransactionId();
      var socket = dgram.createSocket("udp4");
      var cleanup = function() {
        if (!socket) return;
        self2.cleanupFns.splice(self2.cleanupFns.indexOf(cleanup), 1);
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        socket.removeListener("error", onError);
        socket.removeListener("message", onSocketMessage);
        socket.on("error", noop);
        try {
          socket.close();
        } catch (err) {
        }
        socket = null;
      };
      self2.cleanupFns.push(cleanup);
      var ms = opts.event === "stopped" ? TIMEOUT / 10 : TIMEOUT;
      var timeout = setTimeout(function() {
        timeout = null;
        if (opts.event === "stopped") cleanup();
        else onError(new Error("tracker request timed out (" + opts.event + ")"));
      }, ms);
      if (timeout.unref) timeout.unref();
      send(Buffer.concat([
        common.CONNECTION_ID,
        common.toUInt32(common.ACTIONS.CONNECT),
        transactionId
      ]));
      socket.on("error", onError);
      socket.on("message", onSocketMessage);
      function onSocketMessage(msg) {
        if (self2.destroyed) return;
        if (msg.length < 8 || msg.readUInt32BE(4) !== transactionId.readUInt32BE(0)) {
          return onError(new Error("tracker sent invalid transaction id"));
        }
        var action = msg.readUInt32BE(0);
        debug("UDP response %s, action %s", self2.announceUrl, action);
        switch (action) {
          case 0:
            if (msg.length < 16) return onError(new Error("invalid udp handshake"));
            if (opts._scrape) scrape(msg.slice(8, 16));
            else announce(msg.slice(8, 16), opts);
            return;
          case 1:
            cleanup();
            if (msg.length < 20) return onError(new Error("invalid announce message"));
            var interval = msg.readUInt32BE(8);
            if (interval) self2.setInterval(interval * 1e3);
            self2.client.emit("update", {
              announce: self2.announceUrl,
              complete: msg.readUInt32BE(16),
              incomplete: msg.readUInt32BE(12)
            });
            var addrs;
            try {
              addrs = compact2string.multi(msg.slice(20));
            } catch (err) {
              return self2.client.emit("warning", err);
            }
            addrs.forEach(function(addr) {
              self2.client.emit("peer", addr);
            });
            break;
          case 2:
            cleanup();
            if (msg.length < 20 || (msg.length - 8) % 12 !== 0) {
              return onError(new Error("invalid scrape message"));
            }
            var infoHashes = Array.isArray(opts.infoHash) && opts.infoHash.length > 0 ? opts.infoHash.map(function(infoHash) {
              return infoHash.toString("hex");
            }) : [opts.infoHash && opts.infoHash.toString("hex") || self2.client.infoHash];
            for (var i = 0, len = (msg.length - 8) / 12; i < len; i += 1) {
              self2.client.emit("scrape", {
                announce: self2.announceUrl,
                infoHash: infoHashes[i],
                complete: msg.readUInt32BE(8 + i * 12),
                downloaded: msg.readUInt32BE(12 + i * 12),
                incomplete: msg.readUInt32BE(16 + i * 12)
              });
            }
            break;
          case 3:
            cleanup();
            if (msg.length < 8) return onError(new Error("invalid error message"));
            self2.client.emit("warning", new Error(msg.slice(8).toString()));
            break;
          default:
            onError(new Error("tracker sent invalid action"));
            break;
        }
      }
      function onError(err) {
        if (self2.destroyed) return;
        cleanup();
        if (err.message) err.message += " (" + self2.announceUrl + ")";
        self2.client.emit("warning", err);
      }
      function send(message) {
        if (!parsedUrl.port) {
          parsedUrl.port = 80;
        }
        socket.send(message, 0, message.length, parsedUrl.port, parsedUrl.hostname);
      }
      function announce(connectionId, opts2) {
        transactionId = genTransactionId();
        send(Buffer.concat([
          connectionId,
          common.toUInt32(common.ACTIONS.ANNOUNCE),
          transactionId,
          self2.client.infoHashBuffer,
          self2.client.peerIdBuffer,
          toUInt64(opts2.downloaded),
          opts2.left != null ? toUInt64(opts2.left) : new Buffer("FFFFFFFFFFFFFFFF", "hex"),
          toUInt64(opts2.uploaded),
          common.toUInt32(common.EVENTS[opts2.event] || 0),
          common.toUInt32(0),
          // ip address (optional)
          common.toUInt32(0),
          // key (optional)
          common.toUInt32(opts2.numwant),
          toUInt16(self2.client._port)
        ]));
      }
      function scrape(connectionId) {
        transactionId = genTransactionId();
        var infoHash = Array.isArray(opts.infoHash) && opts.infoHash.length > 0 ? Buffer.concat(opts.infoHash) : opts.infoHash || self2.client.infoHashBuffer;
        send(Buffer.concat([
          connectionId,
          common.toUInt32(common.ACTIONS.SCRAPE),
          transactionId,
          infoHash
        ]));
      }
    };
    function genTransactionId() {
      return new Buffer(hat(32), "hex");
    }
    function toUInt16(n) {
      var buf = new Buffer(2);
      buf.writeUInt16BE(n, 0);
      return buf;
    }
    var MAX_UINT = 4294967295;
    function toUInt64(n) {
      if (n > MAX_UINT || typeof n === "string") {
        var bytes = new BN(n).toArray();
        while (bytes.length < 8) {
          bytes.unshift(0);
        }
        return new Buffer(bytes);
      }
      return Buffer.concat([common.toUInt32(0), common.toUInt32(n)]);
    }
    function noop() {
    }
  }
});

// node_modules/get-browser-rtc/index.js
var require_get_browser_rtc = __commonJS({
  "node_modules/get-browser-rtc/index.js"(exports2, module2) {
    module2.exports = function getBrowserRTC() {
      if (typeof globalThis === "undefined") return null;
      var wrtc = {
        RTCPeerConnection: globalThis.RTCPeerConnection || globalThis.mozRTCPeerConnection || globalThis.webkitRTCPeerConnection,
        RTCSessionDescription: globalThis.RTCSessionDescription || globalThis.mozRTCSessionDescription || globalThis.webkitRTCSessionDescription,
        RTCIceCandidate: globalThis.RTCIceCandidate || globalThis.mozRTCIceCandidate || globalThis.webkitRTCIceCandidate
      };
      if (!wrtc.RTCPeerConnection) return null;
      return wrtc;
    };
  }
});

// node_modules/process-nextick-args/index.js
var require_process_nextick_args = __commonJS({
  "node_modules/process-nextick-args/index.js"(exports2, module2) {
    "use strict";
    if (typeof process === "undefined" || !process.version || process.version.indexOf("v0.") === 0 || process.version.indexOf("v1.") === 0 && process.version.indexOf("v1.8.") !== 0) {
      module2.exports = { nextTick };
    } else {
      module2.exports = process;
    }
    function nextTick(fn, arg1, arg2, arg3) {
      if (typeof fn !== "function") {
        throw new TypeError('"callback" argument must be a function');
      }
      var len = arguments.length;
      var args, i;
      switch (len) {
        case 0:
        case 1:
          return process.nextTick(fn);
        case 2:
          return process.nextTick(function afterTickOne() {
            fn.call(null, arg1);
          });
        case 3:
          return process.nextTick(function afterTickTwo() {
            fn.call(null, arg1, arg2);
          });
        case 4:
          return process.nextTick(function afterTickThree() {
            fn.call(null, arg1, arg2, arg3);
          });
        default:
          args = new Array(len - 1);
          i = 0;
          while (i < args.length) {
            args[i++] = arguments[i];
          }
          return process.nextTick(function afterTick() {
            fn.apply(null, args);
          });
      }
    }
  }
});

// node_modules/simple-peer/node_modules/isarray/index.js
var require_isarray2 = __commonJS({
  "node_modules/simple-peer/node_modules/isarray/index.js"(exports2, module2) {
    var toString = {}.toString;
    module2.exports = Array.isArray || function(arr) {
      return toString.call(arr) == "[object Array]";
    };
  }
});

// node_modules/simple-peer/node_modules/readable-stream/lib/internal/streams/stream.js
var require_stream = __commonJS({
  "node_modules/simple-peer/node_modules/readable-stream/lib/internal/streams/stream.js"(exports2, module2) {
    module2.exports = require("stream");
  }
});

// node_modules/simple-peer/node_modules/safe-buffer/index.js
var require_safe_buffer = __commonJS({
  "node_modules/simple-peer/node_modules/safe-buffer/index.js"(exports2, module2) {
    var buffer = require("buffer");
    var Buffer2 = buffer.Buffer;
    function copyProps(src, dst) {
      for (var key in src) {
        dst[key] = src[key];
      }
    }
    if (Buffer2.from && Buffer2.alloc && Buffer2.allocUnsafe && Buffer2.allocUnsafeSlow) {
      module2.exports = buffer;
    } else {
      copyProps(buffer, exports2);
      exports2.Buffer = SafeBuffer;
    }
    function SafeBuffer(arg, encodingOrOffset, length) {
      return Buffer2(arg, encodingOrOffset, length);
    }
    copyProps(Buffer2, SafeBuffer);
    SafeBuffer.from = function(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        throw new TypeError("Argument must not be a number");
      }
      return Buffer2(arg, encodingOrOffset, length);
    };
    SafeBuffer.alloc = function(size, fill, encoding) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      var buf = Buffer2(size);
      if (fill !== void 0) {
        if (typeof encoding === "string") {
          buf.fill(fill, encoding);
        } else {
          buf.fill(fill);
        }
      } else {
        buf.fill(0);
      }
      return buf;
    };
    SafeBuffer.allocUnsafe = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return Buffer2(size);
    };
    SafeBuffer.allocUnsafeSlow = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return buffer.SlowBuffer(size);
    };
  }
});

// node_modules/simple-peer/node_modules/readable-stream/lib/internal/streams/BufferList.js
var require_BufferList = __commonJS({
  "node_modules/simple-peer/node_modules/readable-stream/lib/internal/streams/BufferList.js"(exports2, module2) {
    "use strict";
    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }
    var Buffer2 = require_safe_buffer().Buffer;
    var util = require("util");
    function copyBuffer(src, target, offset) {
      src.copy(target, offset);
    }
    module2.exports = (function() {
      function BufferList() {
        _classCallCheck(this, BufferList);
        this.head = null;
        this.tail = null;
        this.length = 0;
      }
      BufferList.prototype.push = function push(v) {
        var entry = { data: v, next: null };
        if (this.length > 0) this.tail.next = entry;
        else this.head = entry;
        this.tail = entry;
        ++this.length;
      };
      BufferList.prototype.unshift = function unshift(v) {
        var entry = { data: v, next: this.head };
        if (this.length === 0) this.tail = entry;
        this.head = entry;
        ++this.length;
      };
      BufferList.prototype.shift = function shift() {
        if (this.length === 0) return;
        var ret = this.head.data;
        if (this.length === 1) this.head = this.tail = null;
        else this.head = this.head.next;
        --this.length;
        return ret;
      };
      BufferList.prototype.clear = function clear() {
        this.head = this.tail = null;
        this.length = 0;
      };
      BufferList.prototype.join = function join(s) {
        if (this.length === 0) return "";
        var p = this.head;
        var ret = "" + p.data;
        while (p = p.next) {
          ret += s + p.data;
        }
        return ret;
      };
      BufferList.prototype.concat = function concat(n) {
        if (this.length === 0) return Buffer2.alloc(0);
        var ret = Buffer2.allocUnsafe(n >>> 0);
        var p = this.head;
        var i = 0;
        while (p) {
          copyBuffer(p.data, ret, i);
          i += p.data.length;
          p = p.next;
        }
        return ret;
      };
      return BufferList;
    })();
    if (util && util.inspect && util.inspect.custom) {
      module2.exports.prototype[util.inspect.custom] = function() {
        var obj = util.inspect({ length: this.length });
        return this.constructor.name + " " + obj;
      };
    }
  }
});

// node_modules/simple-peer/node_modules/readable-stream/lib/internal/streams/destroy.js
var require_destroy = __commonJS({
  "node_modules/simple-peer/node_modules/readable-stream/lib/internal/streams/destroy.js"(exports2, module2) {
    "use strict";
    var pna = require_process_nextick_args();
    function destroy(err, cb) {
      var _this = this;
      var readableDestroyed = this._readableState && this._readableState.destroyed;
      var writableDestroyed = this._writableState && this._writableState.destroyed;
      if (readableDestroyed || writableDestroyed) {
        if (cb) {
          cb(err);
        } else if (err) {
          if (!this._writableState) {
            pna.nextTick(emitErrorNT, this, err);
          } else if (!this._writableState.errorEmitted) {
            this._writableState.errorEmitted = true;
            pna.nextTick(emitErrorNT, this, err);
          }
        }
        return this;
      }
      if (this._readableState) {
        this._readableState.destroyed = true;
      }
      if (this._writableState) {
        this._writableState.destroyed = true;
      }
      this._destroy(err || null, function(err2) {
        if (!cb && err2) {
          if (!_this._writableState) {
            pna.nextTick(emitErrorNT, _this, err2);
          } else if (!_this._writableState.errorEmitted) {
            _this._writableState.errorEmitted = true;
            pna.nextTick(emitErrorNT, _this, err2);
          }
        } else if (cb) {
          cb(err2);
        }
      });
      return this;
    }
    function undestroy() {
      if (this._readableState) {
        this._readableState.destroyed = false;
        this._readableState.reading = false;
        this._readableState.ended = false;
        this._readableState.endEmitted = false;
      }
      if (this._writableState) {
        this._writableState.destroyed = false;
        this._writableState.ended = false;
        this._writableState.ending = false;
        this._writableState.finalCalled = false;
        this._writableState.prefinished = false;
        this._writableState.finished = false;
        this._writableState.errorEmitted = false;
      }
    }
    function emitErrorNT(self2, err) {
      self2.emit("error", err);
    }
    module2.exports = {
      destroy,
      undestroy
    };
  }
});

// node_modules/util-deprecate/node.js
var require_node2 = __commonJS({
  "node_modules/util-deprecate/node.js"(exports2, module2) {
    module2.exports = require("util").deprecate;
  }
});

// node_modules/simple-peer/node_modules/readable-stream/lib/_stream_writable.js
var require_stream_writable2 = __commonJS({
  "node_modules/simple-peer/node_modules/readable-stream/lib/_stream_writable.js"(exports2, module2) {
    "use strict";
    var pna = require_process_nextick_args();
    module2.exports = Writable;
    function CorkedRequest(state) {
      var _this = this;
      this.next = null;
      this.entry = null;
      this.finish = function() {
        onCorkedFinish(_this, state);
      };
    }
    var asyncWrite = !process.browser && ["v0.10", "v0.9."].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : pna.nextTick;
    var Duplex;
    Writable.WritableState = WritableState;
    var util = Object.create(require_util());
    util.inherits = require_inherits();
    var internalUtil = {
      deprecate: require_node2()
    };
    var Stream = require_stream();
    var Buffer2 = require_safe_buffer().Buffer;
    var OurUint8Array = (typeof global !== "undefined" ? global : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {
    };
    function _uint8ArrayToBuffer(chunk) {
      return Buffer2.from(chunk);
    }
    function _isUint8Array(obj) {
      return Buffer2.isBuffer(obj) || obj instanceof OurUint8Array;
    }
    var destroyImpl = require_destroy();
    util.inherits(Writable, Stream);
    function nop() {
    }
    function WritableState(options, stream) {
      Duplex = Duplex || require_stream_duplex2();
      options = options || {};
      var isDuplex = stream instanceof Duplex;
      this.objectMode = !!options.objectMode;
      if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;
      var hwm = options.highWaterMark;
      var writableHwm = options.writableHighWaterMark;
      var defaultHwm = this.objectMode ? 16 : 16 * 1024;
      if (hwm || hwm === 0) this.highWaterMark = hwm;
      else if (isDuplex && (writableHwm || writableHwm === 0)) this.highWaterMark = writableHwm;
      else this.highWaterMark = defaultHwm;
      this.highWaterMark = Math.floor(this.highWaterMark);
      this.finalCalled = false;
      this.needDrain = false;
      this.ending = false;
      this.ended = false;
      this.finished = false;
      this.destroyed = false;
      var noDecode = options.decodeStrings === false;
      this.decodeStrings = !noDecode;
      this.defaultEncoding = options.defaultEncoding || "utf8";
      this.length = 0;
      this.writing = false;
      this.corked = 0;
      this.sync = true;
      this.bufferProcessing = false;
      this.onwrite = function(er) {
        onwrite(stream, er);
      };
      this.writecb = null;
      this.writelen = 0;
      this.bufferedRequest = null;
      this.lastBufferedRequest = null;
      this.pendingcb = 0;
      this.prefinished = false;
      this.errorEmitted = false;
      this.bufferedRequestCount = 0;
      this.corkedRequestsFree = new CorkedRequest(this);
    }
    WritableState.prototype.getBuffer = function getBuffer() {
      var current2 = this.bufferedRequest;
      var out = [];
      while (current2) {
        out.push(current2);
        current2 = current2.next;
      }
      return out;
    };
    (function() {
      try {
        Object.defineProperty(WritableState.prototype, "buffer", {
          get: internalUtil.deprecate(function() {
            return this.getBuffer();
          }, "_writableState.buffer is deprecated. Use _writableState.getBuffer instead.", "DEP0003")
        });
      } catch (_) {
      }
    })();
    var realHasInstance;
    if (typeof Symbol === "function" && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === "function") {
      realHasInstance = Function.prototype[Symbol.hasInstance];
      Object.defineProperty(Writable, Symbol.hasInstance, {
        value: function(object) {
          if (realHasInstance.call(this, object)) return true;
          if (this !== Writable) return false;
          return object && object._writableState instanceof WritableState;
        }
      });
    } else {
      realHasInstance = function(object) {
        return object instanceof this;
      };
    }
    function Writable(options) {
      Duplex = Duplex || require_stream_duplex2();
      if (!realHasInstance.call(Writable, this) && !(this instanceof Duplex)) {
        return new Writable(options);
      }
      this._writableState = new WritableState(options, this);
      this.writable = true;
      if (options) {
        if (typeof options.write === "function") this._write = options.write;
        if (typeof options.writev === "function") this._writev = options.writev;
        if (typeof options.destroy === "function") this._destroy = options.destroy;
        if (typeof options.final === "function") this._final = options.final;
      }
      Stream.call(this);
    }
    Writable.prototype.pipe = function() {
      this.emit("error", new Error("Cannot pipe, not readable"));
    };
    function writeAfterEnd(stream, cb) {
      var er = new Error("write after end");
      stream.emit("error", er);
      pna.nextTick(cb, er);
    }
    function validChunk(stream, state, chunk, cb) {
      var valid = true;
      var er = false;
      if (chunk === null) {
        er = new TypeError("May not write null values to stream");
      } else if (typeof chunk !== "string" && chunk !== void 0 && !state.objectMode) {
        er = new TypeError("Invalid non-string/buffer chunk");
      }
      if (er) {
        stream.emit("error", er);
        pna.nextTick(cb, er);
        valid = false;
      }
      return valid;
    }
    Writable.prototype.write = function(chunk, encoding, cb) {
      var state = this._writableState;
      var ret = false;
      var isBuf = !state.objectMode && _isUint8Array(chunk);
      if (isBuf && !Buffer2.isBuffer(chunk)) {
        chunk = _uint8ArrayToBuffer(chunk);
      }
      if (typeof encoding === "function") {
        cb = encoding;
        encoding = null;
      }
      if (isBuf) encoding = "buffer";
      else if (!encoding) encoding = state.defaultEncoding;
      if (typeof cb !== "function") cb = nop;
      if (state.ended) writeAfterEnd(this, cb);
      else if (isBuf || validChunk(this, state, chunk, cb)) {
        state.pendingcb++;
        ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
      }
      return ret;
    };
    Writable.prototype.cork = function() {
      var state = this._writableState;
      state.corked++;
    };
    Writable.prototype.uncork = function() {
      var state = this._writableState;
      if (state.corked) {
        state.corked--;
        if (!state.writing && !state.corked && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
      }
    };
    Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
      if (typeof encoding === "string") encoding = encoding.toLowerCase();
      if (!(["hex", "utf8", "utf-8", "ascii", "binary", "base64", "ucs2", "ucs-2", "utf16le", "utf-16le", "raw"].indexOf((encoding + "").toLowerCase()) > -1)) throw new TypeError("Unknown encoding: " + encoding);
      this._writableState.defaultEncoding = encoding;
      return this;
    };
    function decodeChunk(state, chunk, encoding) {
      if (!state.objectMode && state.decodeStrings !== false && typeof chunk === "string") {
        chunk = Buffer2.from(chunk, encoding);
      }
      return chunk;
    }
    Object.defineProperty(Writable.prototype, "writableHighWaterMark", {
      // making it explicit this property is not enumerable
      // because otherwise some prototype manipulation in
      // userland will fail
      enumerable: false,
      get: function() {
        return this._writableState.highWaterMark;
      }
    });
    function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
      if (!isBuf) {
        var newChunk = decodeChunk(state, chunk, encoding);
        if (chunk !== newChunk) {
          isBuf = true;
          encoding = "buffer";
          chunk = newChunk;
        }
      }
      var len = state.objectMode ? 1 : chunk.length;
      state.length += len;
      var ret = state.length < state.highWaterMark;
      if (!ret) state.needDrain = true;
      if (state.writing || state.corked) {
        var last = state.lastBufferedRequest;
        state.lastBufferedRequest = {
          chunk,
          encoding,
          isBuf,
          callback: cb,
          next: null
        };
        if (last) {
          last.next = state.lastBufferedRequest;
        } else {
          state.bufferedRequest = state.lastBufferedRequest;
        }
        state.bufferedRequestCount += 1;
      } else {
        doWrite(stream, state, false, len, chunk, encoding, cb);
      }
      return ret;
    }
    function doWrite(stream, state, writev, len, chunk, encoding, cb) {
      state.writelen = len;
      state.writecb = cb;
      state.writing = true;
      state.sync = true;
      if (writev) stream._writev(chunk, state.onwrite);
      else stream._write(chunk, encoding, state.onwrite);
      state.sync = false;
    }
    function onwriteError(stream, state, sync, er, cb) {
      --state.pendingcb;
      if (sync) {
        pna.nextTick(cb, er);
        pna.nextTick(finishMaybe, stream, state);
        stream._writableState.errorEmitted = true;
        stream.emit("error", er);
      } else {
        cb(er);
        stream._writableState.errorEmitted = true;
        stream.emit("error", er);
        finishMaybe(stream, state);
      }
    }
    function onwriteStateUpdate(state) {
      state.writing = false;
      state.writecb = null;
      state.length -= state.writelen;
      state.writelen = 0;
    }
    function onwrite(stream, er) {
      var state = stream._writableState;
      var sync = state.sync;
      var cb = state.writecb;
      onwriteStateUpdate(state);
      if (er) onwriteError(stream, state, sync, er, cb);
      else {
        var finished = needFinish(state);
        if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
          clearBuffer(stream, state);
        }
        if (sync) {
          asyncWrite(afterWrite, stream, state, finished, cb);
        } else {
          afterWrite(stream, state, finished, cb);
        }
      }
    }
    function afterWrite(stream, state, finished, cb) {
      if (!finished) onwriteDrain(stream, state);
      state.pendingcb--;
      cb();
      finishMaybe(stream, state);
    }
    function onwriteDrain(stream, state) {
      if (state.length === 0 && state.needDrain) {
        state.needDrain = false;
        stream.emit("drain");
      }
    }
    function clearBuffer(stream, state) {
      state.bufferProcessing = true;
      var entry = state.bufferedRequest;
      if (stream._writev && entry && entry.next) {
        var l = state.bufferedRequestCount;
        var buffer = new Array(l);
        var holder = state.corkedRequestsFree;
        holder.entry = entry;
        var count = 0;
        var allBuffers = true;
        while (entry) {
          buffer[count] = entry;
          if (!entry.isBuf) allBuffers = false;
          entry = entry.next;
          count += 1;
        }
        buffer.allBuffers = allBuffers;
        doWrite(stream, state, true, state.length, buffer, "", holder.finish);
        state.pendingcb++;
        state.lastBufferedRequest = null;
        if (holder.next) {
          state.corkedRequestsFree = holder.next;
          holder.next = null;
        } else {
          state.corkedRequestsFree = new CorkedRequest(state);
        }
        state.bufferedRequestCount = 0;
      } else {
        while (entry) {
          var chunk = entry.chunk;
          var encoding = entry.encoding;
          var cb = entry.callback;
          var len = state.objectMode ? 1 : chunk.length;
          doWrite(stream, state, false, len, chunk, encoding, cb);
          entry = entry.next;
          state.bufferedRequestCount--;
          if (state.writing) {
            break;
          }
        }
        if (entry === null) state.lastBufferedRequest = null;
      }
      state.bufferedRequest = entry;
      state.bufferProcessing = false;
    }
    Writable.prototype._write = function(chunk, encoding, cb) {
      cb(new Error("_write() is not implemented"));
    };
    Writable.prototype._writev = null;
    Writable.prototype.end = function(chunk, encoding, cb) {
      var state = this._writableState;
      if (typeof chunk === "function") {
        cb = chunk;
        chunk = null;
        encoding = null;
      } else if (typeof encoding === "function") {
        cb = encoding;
        encoding = null;
      }
      if (chunk !== null && chunk !== void 0) this.write(chunk, encoding);
      if (state.corked) {
        state.corked = 1;
        this.uncork();
      }
      if (!state.ending) endWritable(this, state, cb);
    };
    function needFinish(state) {
      return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
    }
    function callFinal(stream, state) {
      stream._final(function(err) {
        state.pendingcb--;
        if (err) {
          stream.emit("error", err);
        }
        state.prefinished = true;
        stream.emit("prefinish");
        finishMaybe(stream, state);
      });
    }
    function prefinish(stream, state) {
      if (!state.prefinished && !state.finalCalled) {
        if (typeof stream._final === "function") {
          state.pendingcb++;
          state.finalCalled = true;
          pna.nextTick(callFinal, stream, state);
        } else {
          state.prefinished = true;
          stream.emit("prefinish");
        }
      }
    }
    function finishMaybe(stream, state) {
      var need = needFinish(state);
      if (need) {
        prefinish(stream, state);
        if (state.pendingcb === 0) {
          state.finished = true;
          stream.emit("finish");
        }
      }
      return need;
    }
    function endWritable(stream, state, cb) {
      state.ending = true;
      finishMaybe(stream, state);
      if (cb) {
        if (state.finished) pna.nextTick(cb);
        else stream.once("finish", cb);
      }
      state.ended = true;
      stream.writable = false;
    }
    function onCorkedFinish(corkReq, state, err) {
      var entry = corkReq.entry;
      corkReq.entry = null;
      while (entry) {
        var cb = entry.callback;
        state.pendingcb--;
        cb(err);
        entry = entry.next;
      }
      state.corkedRequestsFree.next = corkReq;
    }
    Object.defineProperty(Writable.prototype, "destroyed", {
      get: function() {
        if (this._writableState === void 0) {
          return false;
        }
        return this._writableState.destroyed;
      },
      set: function(value) {
        if (!this._writableState) {
          return;
        }
        this._writableState.destroyed = value;
      }
    });
    Writable.prototype.destroy = destroyImpl.destroy;
    Writable.prototype._undestroy = destroyImpl.undestroy;
    Writable.prototype._destroy = function(err, cb) {
      this.end();
      cb(err);
    };
  }
});

// node_modules/simple-peer/node_modules/readable-stream/lib/_stream_duplex.js
var require_stream_duplex2 = __commonJS({
  "node_modules/simple-peer/node_modules/readable-stream/lib/_stream_duplex.js"(exports2, module2) {
    "use strict";
    var pna = require_process_nextick_args();
    var objectKeys = Object.keys || function(obj) {
      var keys2 = [];
      for (var key in obj) {
        keys2.push(key);
      }
      return keys2;
    };
    module2.exports = Duplex;
    var util = Object.create(require_util());
    util.inherits = require_inherits();
    var Readable = require_stream_readable2();
    var Writable = require_stream_writable2();
    util.inherits(Duplex, Readable);
    {
      keys = objectKeys(Writable.prototype);
      for (v = 0; v < keys.length; v++) {
        method = keys[v];
        if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
      }
    }
    var keys;
    var method;
    var v;
    function Duplex(options) {
      if (!(this instanceof Duplex)) return new Duplex(options);
      Readable.call(this, options);
      Writable.call(this, options);
      if (options && options.readable === false) this.readable = false;
      if (options && options.writable === false) this.writable = false;
      this.allowHalfOpen = true;
      if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;
      this.once("end", onend);
    }
    Object.defineProperty(Duplex.prototype, "writableHighWaterMark", {
      // making it explicit this property is not enumerable
      // because otherwise some prototype manipulation in
      // userland will fail
      enumerable: false,
      get: function() {
        return this._writableState.highWaterMark;
      }
    });
    function onend() {
      if (this.allowHalfOpen || this._writableState.ended) return;
      pna.nextTick(onEndNT, this);
    }
    function onEndNT(self2) {
      self2.end();
    }
    Object.defineProperty(Duplex.prototype, "destroyed", {
      get: function() {
        if (this._readableState === void 0 || this._writableState === void 0) {
          return false;
        }
        return this._readableState.destroyed && this._writableState.destroyed;
      },
      set: function(value) {
        if (this._readableState === void 0 || this._writableState === void 0) {
          return;
        }
        this._readableState.destroyed = value;
        this._writableState.destroyed = value;
      }
    });
    Duplex.prototype._destroy = function(err, cb) {
      this.push(null);
      this.end();
      pna.nextTick(cb, err);
    };
  }
});

// node_modules/simple-peer/node_modules/string_decoder/lib/string_decoder.js
var require_string_decoder2 = __commonJS({
  "node_modules/simple-peer/node_modules/string_decoder/lib/string_decoder.js"(exports2) {
    "use strict";
    var Buffer2 = require_safe_buffer().Buffer;
    var isEncoding = Buffer2.isEncoding || function(encoding) {
      encoding = "" + encoding;
      switch (encoding && encoding.toLowerCase()) {
        case "hex":
        case "utf8":
        case "utf-8":
        case "ascii":
        case "binary":
        case "base64":
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
        case "raw":
          return true;
        default:
          return false;
      }
    };
    function _normalizeEncoding(enc) {
      if (!enc) return "utf8";
      var retried;
      while (true) {
        switch (enc) {
          case "utf8":
          case "utf-8":
            return "utf8";
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return "utf16le";
          case "latin1":
          case "binary":
            return "latin1";
          case "base64":
          case "ascii":
          case "hex":
            return enc;
          default:
            if (retried) return;
            enc = ("" + enc).toLowerCase();
            retried = true;
        }
      }
    }
    function normalizeEncoding(enc) {
      var nenc = _normalizeEncoding(enc);
      if (typeof nenc !== "string" && (Buffer2.isEncoding === isEncoding || !isEncoding(enc))) throw new Error("Unknown encoding: " + enc);
      return nenc || enc;
    }
    exports2.StringDecoder = StringDecoder;
    function StringDecoder(encoding) {
      this.encoding = normalizeEncoding(encoding);
      var nb;
      switch (this.encoding) {
        case "utf16le":
          this.text = utf16Text;
          this.end = utf16End;
          nb = 4;
          break;
        case "utf8":
          this.fillLast = utf8FillLast;
          nb = 4;
          break;
        case "base64":
          this.text = base64Text;
          this.end = base64End;
          nb = 3;
          break;
        default:
          this.write = simpleWrite;
          this.end = simpleEnd;
          return;
      }
      this.lastNeed = 0;
      this.lastTotal = 0;
      this.lastChar = Buffer2.allocUnsafe(nb);
    }
    StringDecoder.prototype.write = function(buf) {
      if (buf.length === 0) return "";
      var r;
      var i;
      if (this.lastNeed) {
        r = this.fillLast(buf);
        if (r === void 0) return "";
        i = this.lastNeed;
        this.lastNeed = 0;
      } else {
        i = 0;
      }
      if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
      return r || "";
    };
    StringDecoder.prototype.end = utf8End;
    StringDecoder.prototype.text = utf8Text;
    StringDecoder.prototype.fillLast = function(buf) {
      if (this.lastNeed <= buf.length) {
        buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
        return this.lastChar.toString(this.encoding, 0, this.lastTotal);
      }
      buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
      this.lastNeed -= buf.length;
    };
    function utf8CheckByte(byte) {
      if (byte <= 127) return 0;
      else if (byte >> 5 === 6) return 2;
      else if (byte >> 4 === 14) return 3;
      else if (byte >> 3 === 30) return 4;
      return byte >> 6 === 2 ? -1 : -2;
    }
    function utf8CheckIncomplete(self2, buf, i) {
      var j = buf.length - 1;
      if (j < i) return 0;
      var nb = utf8CheckByte(buf[j]);
      if (nb >= 0) {
        if (nb > 0) self2.lastNeed = nb - 1;
        return nb;
      }
      if (--j < i || nb === -2) return 0;
      nb = utf8CheckByte(buf[j]);
      if (nb >= 0) {
        if (nb > 0) self2.lastNeed = nb - 2;
        return nb;
      }
      if (--j < i || nb === -2) return 0;
      nb = utf8CheckByte(buf[j]);
      if (nb >= 0) {
        if (nb > 0) {
          if (nb === 2) nb = 0;
          else self2.lastNeed = nb - 3;
        }
        return nb;
      }
      return 0;
    }
    function utf8CheckExtraBytes(self2, buf, p) {
      if ((buf[0] & 192) !== 128) {
        self2.lastNeed = 0;
        return "\uFFFD";
      }
      if (self2.lastNeed > 1 && buf.length > 1) {
        if ((buf[1] & 192) !== 128) {
          self2.lastNeed = 1;
          return "\uFFFD";
        }
        if (self2.lastNeed > 2 && buf.length > 2) {
          if ((buf[2] & 192) !== 128) {
            self2.lastNeed = 2;
            return "\uFFFD";
          }
        }
      }
    }
    function utf8FillLast(buf) {
      var p = this.lastTotal - this.lastNeed;
      var r = utf8CheckExtraBytes(this, buf, p);
      if (r !== void 0) return r;
      if (this.lastNeed <= buf.length) {
        buf.copy(this.lastChar, p, 0, this.lastNeed);
        return this.lastChar.toString(this.encoding, 0, this.lastTotal);
      }
      buf.copy(this.lastChar, p, 0, buf.length);
      this.lastNeed -= buf.length;
    }
    function utf8Text(buf, i) {
      var total = utf8CheckIncomplete(this, buf, i);
      if (!this.lastNeed) return buf.toString("utf8", i);
      this.lastTotal = total;
      var end = buf.length - (total - this.lastNeed);
      buf.copy(this.lastChar, 0, end);
      return buf.toString("utf8", i, end);
    }
    function utf8End(buf) {
      var r = buf && buf.length ? this.write(buf) : "";
      if (this.lastNeed) return r + "\uFFFD";
      return r;
    }
    function utf16Text(buf, i) {
      if ((buf.length - i) % 2 === 0) {
        var r = buf.toString("utf16le", i);
        if (r) {
          var c = r.charCodeAt(r.length - 1);
          if (c >= 55296 && c <= 56319) {
            this.lastNeed = 2;
            this.lastTotal = 4;
            this.lastChar[0] = buf[buf.length - 2];
            this.lastChar[1] = buf[buf.length - 1];
            return r.slice(0, -1);
          }
        }
        return r;
      }
      this.lastNeed = 1;
      this.lastTotal = 2;
      this.lastChar[0] = buf[buf.length - 1];
      return buf.toString("utf16le", i, buf.length - 1);
    }
    function utf16End(buf) {
      var r = buf && buf.length ? this.write(buf) : "";
      if (this.lastNeed) {
        var end = this.lastTotal - this.lastNeed;
        return r + this.lastChar.toString("utf16le", 0, end);
      }
      return r;
    }
    function base64Text(buf, i) {
      var n = (buf.length - i) % 3;
      if (n === 0) return buf.toString("base64", i);
      this.lastNeed = 3 - n;
      this.lastTotal = 3;
      if (n === 1) {
        this.lastChar[0] = buf[buf.length - 1];
      } else {
        this.lastChar[0] = buf[buf.length - 2];
        this.lastChar[1] = buf[buf.length - 1];
      }
      return buf.toString("base64", i, buf.length - n);
    }
    function base64End(buf) {
      var r = buf && buf.length ? this.write(buf) : "";
      if (this.lastNeed) return r + this.lastChar.toString("base64", 0, 3 - this.lastNeed);
      return r;
    }
    function simpleWrite(buf) {
      return buf.toString(this.encoding);
    }
    function simpleEnd(buf) {
      return buf && buf.length ? this.write(buf) : "";
    }
  }
});

// node_modules/simple-peer/node_modules/readable-stream/lib/_stream_readable.js
var require_stream_readable2 = __commonJS({
  "node_modules/simple-peer/node_modules/readable-stream/lib/_stream_readable.js"(exports2, module2) {
    "use strict";
    var pna = require_process_nextick_args();
    module2.exports = Readable;
    var isArray = require_isarray2();
    var Duplex;
    Readable.ReadableState = ReadableState;
    var EE = require("events").EventEmitter;
    var EElistenerCount = function(emitter, type) {
      return emitter.listeners(type).length;
    };
    var Stream = require_stream();
    var Buffer2 = require_safe_buffer().Buffer;
    var OurUint8Array = (typeof global !== "undefined" ? global : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {
    };
    function _uint8ArrayToBuffer(chunk) {
      return Buffer2.from(chunk);
    }
    function _isUint8Array(obj) {
      return Buffer2.isBuffer(obj) || obj instanceof OurUint8Array;
    }
    var util = Object.create(require_util());
    util.inherits = require_inherits();
    var debugUtil = require("util");
    var debug = void 0;
    if (debugUtil && debugUtil.debuglog) {
      debug = debugUtil.debuglog("stream");
    } else {
      debug = function() {
      };
    }
    var BufferList = require_BufferList();
    var destroyImpl = require_destroy();
    var StringDecoder;
    util.inherits(Readable, Stream);
    var kProxyEvents = ["error", "close", "destroy", "pause", "resume"];
    function prependListener(emitter, event, fn) {
      if (typeof emitter.prependListener === "function") return emitter.prependListener(event, fn);
      if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);
      else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);
      else emitter._events[event] = [fn, emitter._events[event]];
    }
    function ReadableState(options, stream) {
      Duplex = Duplex || require_stream_duplex2();
      options = options || {};
      var isDuplex = stream instanceof Duplex;
      this.objectMode = !!options.objectMode;
      if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;
      var hwm = options.highWaterMark;
      var readableHwm = options.readableHighWaterMark;
      var defaultHwm = this.objectMode ? 16 : 16 * 1024;
      if (hwm || hwm === 0) this.highWaterMark = hwm;
      else if (isDuplex && (readableHwm || readableHwm === 0)) this.highWaterMark = readableHwm;
      else this.highWaterMark = defaultHwm;
      this.highWaterMark = Math.floor(this.highWaterMark);
      this.buffer = new BufferList();
      this.length = 0;
      this.pipes = null;
      this.pipesCount = 0;
      this.flowing = null;
      this.ended = false;
      this.endEmitted = false;
      this.reading = false;
      this.sync = true;
      this.needReadable = false;
      this.emittedReadable = false;
      this.readableListening = false;
      this.resumeScheduled = false;
      this.destroyed = false;
      this.defaultEncoding = options.defaultEncoding || "utf8";
      this.awaitDrain = 0;
      this.readingMore = false;
      this.decoder = null;
      this.encoding = null;
      if (options.encoding) {
        if (!StringDecoder) StringDecoder = require_string_decoder2().StringDecoder;
        this.decoder = new StringDecoder(options.encoding);
        this.encoding = options.encoding;
      }
    }
    function Readable(options) {
      Duplex = Duplex || require_stream_duplex2();
      if (!(this instanceof Readable)) return new Readable(options);
      this._readableState = new ReadableState(options, this);
      this.readable = true;
      if (options) {
        if (typeof options.read === "function") this._read = options.read;
        if (typeof options.destroy === "function") this._destroy = options.destroy;
      }
      Stream.call(this);
    }
    Object.defineProperty(Readable.prototype, "destroyed", {
      get: function() {
        if (this._readableState === void 0) {
          return false;
        }
        return this._readableState.destroyed;
      },
      set: function(value) {
        if (!this._readableState) {
          return;
        }
        this._readableState.destroyed = value;
      }
    });
    Readable.prototype.destroy = destroyImpl.destroy;
    Readable.prototype._undestroy = destroyImpl.undestroy;
    Readable.prototype._destroy = function(err, cb) {
      this.push(null);
      cb(err);
    };
    Readable.prototype.push = function(chunk, encoding) {
      var state = this._readableState;
      var skipChunkCheck;
      if (!state.objectMode) {
        if (typeof chunk === "string") {
          encoding = encoding || state.defaultEncoding;
          if (encoding !== state.encoding) {
            chunk = Buffer2.from(chunk, encoding);
            encoding = "";
          }
          skipChunkCheck = true;
        }
      } else {
        skipChunkCheck = true;
      }
      return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
    };
    Readable.prototype.unshift = function(chunk) {
      return readableAddChunk(this, chunk, null, true, false);
    };
    function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
      var state = stream._readableState;
      if (chunk === null) {
        state.reading = false;
        onEofChunk(stream, state);
      } else {
        var er;
        if (!skipChunkCheck) er = chunkInvalid(state, chunk);
        if (er) {
          stream.emit("error", er);
        } else if (state.objectMode || chunk && chunk.length > 0) {
          if (typeof chunk !== "string" && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer2.prototype) {
            chunk = _uint8ArrayToBuffer(chunk);
          }
          if (addToFront) {
            if (state.endEmitted) stream.emit("error", new Error("stream.unshift() after end event"));
            else addChunk(stream, state, chunk, true);
          } else if (state.ended) {
            stream.emit("error", new Error("stream.push() after EOF"));
          } else {
            state.reading = false;
            if (state.decoder && !encoding) {
              chunk = state.decoder.write(chunk);
              if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);
              else maybeReadMore(stream, state);
            } else {
              addChunk(stream, state, chunk, false);
            }
          }
        } else if (!addToFront) {
          state.reading = false;
        }
      }
      return needMoreData(state);
    }
    function addChunk(stream, state, chunk, addToFront) {
      if (state.flowing && state.length === 0 && !state.sync) {
        stream.emit("data", chunk);
        stream.read(0);
      } else {
        state.length += state.objectMode ? 1 : chunk.length;
        if (addToFront) state.buffer.unshift(chunk);
        else state.buffer.push(chunk);
        if (state.needReadable) emitReadable(stream);
      }
      maybeReadMore(stream, state);
    }
    function chunkInvalid(state, chunk) {
      var er;
      if (!_isUint8Array(chunk) && typeof chunk !== "string" && chunk !== void 0 && !state.objectMode) {
        er = new TypeError("Invalid non-string/buffer chunk");
      }
      return er;
    }
    function needMoreData(state) {
      return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
    }
    Readable.prototype.isPaused = function() {
      return this._readableState.flowing === false;
    };
    Readable.prototype.setEncoding = function(enc) {
      if (!StringDecoder) StringDecoder = require_string_decoder2().StringDecoder;
      this._readableState.decoder = new StringDecoder(enc);
      this._readableState.encoding = enc;
      return this;
    };
    var MAX_HWM = 8388608;
    function computeNewHighWaterMark(n) {
      if (n >= MAX_HWM) {
        n = MAX_HWM;
      } else {
        n--;
        n |= n >>> 1;
        n |= n >>> 2;
        n |= n >>> 4;
        n |= n >>> 8;
        n |= n >>> 16;
        n++;
      }
      return n;
    }
    function howMuchToRead(n, state) {
      if (n <= 0 || state.length === 0 && state.ended) return 0;
      if (state.objectMode) return 1;
      if (n !== n) {
        if (state.flowing && state.length) return state.buffer.head.data.length;
        else return state.length;
      }
      if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
      if (n <= state.length) return n;
      if (!state.ended) {
        state.needReadable = true;
        return 0;
      }
      return state.length;
    }
    Readable.prototype.read = function(n) {
      debug("read", n);
      n = parseInt(n, 10);
      var state = this._readableState;
      var nOrig = n;
      if (n !== 0) state.emittedReadable = false;
      if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
        debug("read: emitReadable", state.length, state.ended);
        if (state.length === 0 && state.ended) endReadable(this);
        else emitReadable(this);
        return null;
      }
      n = howMuchToRead(n, state);
      if (n === 0 && state.ended) {
        if (state.length === 0) endReadable(this);
        return null;
      }
      var doRead = state.needReadable;
      debug("need readable", doRead);
      if (state.length === 0 || state.length - n < state.highWaterMark) {
        doRead = true;
        debug("length less than watermark", doRead);
      }
      if (state.ended || state.reading) {
        doRead = false;
        debug("reading or ended", doRead);
      } else if (doRead) {
        debug("do read");
        state.reading = true;
        state.sync = true;
        if (state.length === 0) state.needReadable = true;
        this._read(state.highWaterMark);
        state.sync = false;
        if (!state.reading) n = howMuchToRead(nOrig, state);
      }
      var ret;
      if (n > 0) ret = fromList(n, state);
      else ret = null;
      if (ret === null) {
        state.needReadable = true;
        n = 0;
      } else {
        state.length -= n;
      }
      if (state.length === 0) {
        if (!state.ended) state.needReadable = true;
        if (nOrig !== n && state.ended) endReadable(this);
      }
      if (ret !== null) this.emit("data", ret);
      return ret;
    };
    function onEofChunk(stream, state) {
      if (state.ended) return;
      if (state.decoder) {
        var chunk = state.decoder.end();
        if (chunk && chunk.length) {
          state.buffer.push(chunk);
          state.length += state.objectMode ? 1 : chunk.length;
        }
      }
      state.ended = true;
      emitReadable(stream);
    }
    function emitReadable(stream) {
      var state = stream._readableState;
      state.needReadable = false;
      if (!state.emittedReadable) {
        debug("emitReadable", state.flowing);
        state.emittedReadable = true;
        if (state.sync) pna.nextTick(emitReadable_, stream);
        else emitReadable_(stream);
      }
    }
    function emitReadable_(stream) {
      debug("emit readable");
      stream.emit("readable");
      flow(stream);
    }
    function maybeReadMore(stream, state) {
      if (!state.readingMore) {
        state.readingMore = true;
        pna.nextTick(maybeReadMore_, stream, state);
      }
    }
    function maybeReadMore_(stream, state) {
      var len = state.length;
      while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
        debug("maybeReadMore read 0");
        stream.read(0);
        if (len === state.length)
          break;
        else len = state.length;
      }
      state.readingMore = false;
    }
    Readable.prototype._read = function(n) {
      this.emit("error", new Error("_read() is not implemented"));
    };
    Readable.prototype.pipe = function(dest, pipeOpts) {
      var src = this;
      var state = this._readableState;
      switch (state.pipesCount) {
        case 0:
          state.pipes = dest;
          break;
        case 1:
          state.pipes = [state.pipes, dest];
          break;
        default:
          state.pipes.push(dest);
          break;
      }
      state.pipesCount += 1;
      debug("pipe count=%d opts=%j", state.pipesCount, pipeOpts);
      var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;
      var endFn = doEnd ? onend : unpipe;
      if (state.endEmitted) pna.nextTick(endFn);
      else src.once("end", endFn);
      dest.on("unpipe", onunpipe);
      function onunpipe(readable, unpipeInfo) {
        debug("onunpipe");
        if (readable === src) {
          if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
            unpipeInfo.hasUnpiped = true;
            cleanup();
          }
        }
      }
      function onend() {
        debug("onend");
        dest.end();
      }
      var ondrain = pipeOnDrain(src);
      dest.on("drain", ondrain);
      var cleanedUp = false;
      function cleanup() {
        debug("cleanup");
        dest.removeListener("close", onclose);
        dest.removeListener("finish", onfinish);
        dest.removeListener("drain", ondrain);
        dest.removeListener("error", onerror);
        dest.removeListener("unpipe", onunpipe);
        src.removeListener("end", onend);
        src.removeListener("end", unpipe);
        src.removeListener("data", ondata);
        cleanedUp = true;
        if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
      }
      var increasedAwaitDrain = false;
      src.on("data", ondata);
      function ondata(chunk) {
        debug("ondata");
        increasedAwaitDrain = false;
        var ret = dest.write(chunk);
        if (false === ret && !increasedAwaitDrain) {
          if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
            debug("false write response, pause", state.awaitDrain);
            state.awaitDrain++;
            increasedAwaitDrain = true;
          }
          src.pause();
        }
      }
      function onerror(er) {
        debug("onerror", er);
        unpipe();
        dest.removeListener("error", onerror);
        if (EElistenerCount(dest, "error") === 0) dest.emit("error", er);
      }
      prependListener(dest, "error", onerror);
      function onclose() {
        dest.removeListener("finish", onfinish);
        unpipe();
      }
      dest.once("close", onclose);
      function onfinish() {
        debug("onfinish");
        dest.removeListener("close", onclose);
        unpipe();
      }
      dest.once("finish", onfinish);
      function unpipe() {
        debug("unpipe");
        src.unpipe(dest);
      }
      dest.emit("pipe", src);
      if (!state.flowing) {
        debug("pipe resume");
        src.resume();
      }
      return dest;
    };
    function pipeOnDrain(src) {
      return function() {
        var state = src._readableState;
        debug("pipeOnDrain", state.awaitDrain);
        if (state.awaitDrain) state.awaitDrain--;
        if (state.awaitDrain === 0 && EElistenerCount(src, "data")) {
          state.flowing = true;
          flow(src);
        }
      };
    }
    Readable.prototype.unpipe = function(dest) {
      var state = this._readableState;
      var unpipeInfo = { hasUnpiped: false };
      if (state.pipesCount === 0) return this;
      if (state.pipesCount === 1) {
        if (dest && dest !== state.pipes) return this;
        if (!dest) dest = state.pipes;
        state.pipes = null;
        state.pipesCount = 0;
        state.flowing = false;
        if (dest) dest.emit("unpipe", this, unpipeInfo);
        return this;
      }
      if (!dest) {
        var dests = state.pipes;
        var len = state.pipesCount;
        state.pipes = null;
        state.pipesCount = 0;
        state.flowing = false;
        for (var i = 0; i < len; i++) {
          dests[i].emit("unpipe", this, { hasUnpiped: false });
        }
        return this;
      }
      var index = indexOf(state.pipes, dest);
      if (index === -1) return this;
      state.pipes.splice(index, 1);
      state.pipesCount -= 1;
      if (state.pipesCount === 1) state.pipes = state.pipes[0];
      dest.emit("unpipe", this, unpipeInfo);
      return this;
    };
    Readable.prototype.on = function(ev, fn) {
      var res = Stream.prototype.on.call(this, ev, fn);
      if (ev === "data") {
        if (this._readableState.flowing !== false) this.resume();
      } else if (ev === "readable") {
        var state = this._readableState;
        if (!state.endEmitted && !state.readableListening) {
          state.readableListening = state.needReadable = true;
          state.emittedReadable = false;
          if (!state.reading) {
            pna.nextTick(nReadingNextTick, this);
          } else if (state.length) {
            emitReadable(this);
          }
        }
      }
      return res;
    };
    Readable.prototype.addListener = Readable.prototype.on;
    function nReadingNextTick(self2) {
      debug("readable nexttick read 0");
      self2.read(0);
    }
    Readable.prototype.resume = function() {
      var state = this._readableState;
      if (!state.flowing) {
        debug("resume");
        state.flowing = true;
        resume(this, state);
      }
      return this;
    };
    function resume(stream, state) {
      if (!state.resumeScheduled) {
        state.resumeScheduled = true;
        pna.nextTick(resume_, stream, state);
      }
    }
    function resume_(stream, state) {
      if (!state.reading) {
        debug("resume read 0");
        stream.read(0);
      }
      state.resumeScheduled = false;
      state.awaitDrain = 0;
      stream.emit("resume");
      flow(stream);
      if (state.flowing && !state.reading) stream.read(0);
    }
    Readable.prototype.pause = function() {
      debug("call pause flowing=%j", this._readableState.flowing);
      if (false !== this._readableState.flowing) {
        debug("pause");
        this._readableState.flowing = false;
        this.emit("pause");
      }
      return this;
    };
    function flow(stream) {
      var state = stream._readableState;
      debug("flow", state.flowing);
      while (state.flowing && stream.read() !== null) {
      }
    }
    Readable.prototype.wrap = function(stream) {
      var _this = this;
      var state = this._readableState;
      var paused = false;
      stream.on("end", function() {
        debug("wrapped end");
        if (state.decoder && !state.ended) {
          var chunk = state.decoder.end();
          if (chunk && chunk.length) _this.push(chunk);
        }
        _this.push(null);
      });
      stream.on("data", function(chunk) {
        debug("wrapped data");
        if (state.decoder) chunk = state.decoder.write(chunk);
        if (state.objectMode && (chunk === null || chunk === void 0)) return;
        else if (!state.objectMode && (!chunk || !chunk.length)) return;
        var ret = _this.push(chunk);
        if (!ret) {
          paused = true;
          stream.pause();
        }
      });
      for (var i in stream) {
        if (this[i] === void 0 && typeof stream[i] === "function") {
          this[i] = /* @__PURE__ */ (function(method) {
            return function() {
              return stream[method].apply(stream, arguments);
            };
          })(i);
        }
      }
      for (var n = 0; n < kProxyEvents.length; n++) {
        stream.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
      }
      this._read = function(n2) {
        debug("wrapped _read", n2);
        if (paused) {
          paused = false;
          stream.resume();
        }
      };
      return this;
    };
    Object.defineProperty(Readable.prototype, "readableHighWaterMark", {
      // making it explicit this property is not enumerable
      // because otherwise some prototype manipulation in
      // userland will fail
      enumerable: false,
      get: function() {
        return this._readableState.highWaterMark;
      }
    });
    Readable._fromList = fromList;
    function fromList(n, state) {
      if (state.length === 0) return null;
      var ret;
      if (state.objectMode) ret = state.buffer.shift();
      else if (!n || n >= state.length) {
        if (state.decoder) ret = state.buffer.join("");
        else if (state.buffer.length === 1) ret = state.buffer.head.data;
        else ret = state.buffer.concat(state.length);
        state.buffer.clear();
      } else {
        ret = fromListPartial(n, state.buffer, state.decoder);
      }
      return ret;
    }
    function fromListPartial(n, list, hasStrings) {
      var ret;
      if (n < list.head.data.length) {
        ret = list.head.data.slice(0, n);
        list.head.data = list.head.data.slice(n);
      } else if (n === list.head.data.length) {
        ret = list.shift();
      } else {
        ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
      }
      return ret;
    }
    function copyFromBufferString(n, list) {
      var p = list.head;
      var c = 1;
      var ret = p.data;
      n -= ret.length;
      while (p = p.next) {
        var str = p.data;
        var nb = n > str.length ? str.length : n;
        if (nb === str.length) ret += str;
        else ret += str.slice(0, n);
        n -= nb;
        if (n === 0) {
          if (nb === str.length) {
            ++c;
            if (p.next) list.head = p.next;
            else list.head = list.tail = null;
          } else {
            list.head = p;
            p.data = str.slice(nb);
          }
          break;
        }
        ++c;
      }
      list.length -= c;
      return ret;
    }
    function copyFromBuffer(n, list) {
      var ret = Buffer2.allocUnsafe(n);
      var p = list.head;
      var c = 1;
      p.data.copy(ret);
      n -= p.data.length;
      while (p = p.next) {
        var buf = p.data;
        var nb = n > buf.length ? buf.length : n;
        buf.copy(ret, ret.length - n, 0, nb);
        n -= nb;
        if (n === 0) {
          if (nb === buf.length) {
            ++c;
            if (p.next) list.head = p.next;
            else list.head = list.tail = null;
          } else {
            list.head = p;
            p.data = buf.slice(nb);
          }
          break;
        }
        ++c;
      }
      list.length -= c;
      return ret;
    }
    function endReadable(stream) {
      var state = stream._readableState;
      if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');
      if (!state.endEmitted) {
        state.ended = true;
        pna.nextTick(endReadableNT, state, stream);
      }
    }
    function endReadableNT(state, stream) {
      if (!state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.readable = false;
        stream.emit("end");
      }
    }
    function indexOf(xs, x) {
      for (var i = 0, l = xs.length; i < l; i++) {
        if (xs[i] === x) return i;
      }
      return -1;
    }
  }
});

// node_modules/simple-peer/node_modules/readable-stream/lib/_stream_transform.js
var require_stream_transform2 = __commonJS({
  "node_modules/simple-peer/node_modules/readable-stream/lib/_stream_transform.js"(exports2, module2) {
    "use strict";
    module2.exports = Transform;
    var Duplex = require_stream_duplex2();
    var util = Object.create(require_util());
    util.inherits = require_inherits();
    util.inherits(Transform, Duplex);
    function afterTransform(er, data) {
      var ts = this._transformState;
      ts.transforming = false;
      var cb = ts.writecb;
      if (!cb) {
        return this.emit("error", new Error("write callback called multiple times"));
      }
      ts.writechunk = null;
      ts.writecb = null;
      if (data != null)
        this.push(data);
      cb(er);
      var rs = this._readableState;
      rs.reading = false;
      if (rs.needReadable || rs.length < rs.highWaterMark) {
        this._read(rs.highWaterMark);
      }
    }
    function Transform(options) {
      if (!(this instanceof Transform)) return new Transform(options);
      Duplex.call(this, options);
      this._transformState = {
        afterTransform: afterTransform.bind(this),
        needTransform: false,
        transforming: false,
        writecb: null,
        writechunk: null,
        writeencoding: null
      };
      this._readableState.needReadable = true;
      this._readableState.sync = false;
      if (options) {
        if (typeof options.transform === "function") this._transform = options.transform;
        if (typeof options.flush === "function") this._flush = options.flush;
      }
      this.on("prefinish", prefinish);
    }
    function prefinish() {
      var _this = this;
      if (typeof this._flush === "function") {
        this._flush(function(er, data) {
          done(_this, er, data);
        });
      } else {
        done(this, null, null);
      }
    }
    Transform.prototype.push = function(chunk, encoding) {
      this._transformState.needTransform = false;
      return Duplex.prototype.push.call(this, chunk, encoding);
    };
    Transform.prototype._transform = function(chunk, encoding, cb) {
      throw new Error("_transform() is not implemented");
    };
    Transform.prototype._write = function(chunk, encoding, cb) {
      var ts = this._transformState;
      ts.writecb = cb;
      ts.writechunk = chunk;
      ts.writeencoding = encoding;
      if (!ts.transforming) {
        var rs = this._readableState;
        if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
      }
    };
    Transform.prototype._read = function(n) {
      var ts = this._transformState;
      if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
        ts.transforming = true;
        this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
      } else {
        ts.needTransform = true;
      }
    };
    Transform.prototype._destroy = function(err, cb) {
      var _this2 = this;
      Duplex.prototype._destroy.call(this, err, function(err2) {
        cb(err2);
        _this2.emit("close");
      });
    };
    function done(stream, er, data) {
      if (er) return stream.emit("error", er);
      if (data != null)
        stream.push(data);
      if (stream._writableState.length) throw new Error("Calling transform done when ws.length != 0");
      if (stream._transformState.transforming) throw new Error("Calling transform done when still transforming");
      return stream.push(null);
    }
  }
});

// node_modules/simple-peer/node_modules/readable-stream/lib/_stream_passthrough.js
var require_stream_passthrough2 = __commonJS({
  "node_modules/simple-peer/node_modules/readable-stream/lib/_stream_passthrough.js"(exports2, module2) {
    "use strict";
    module2.exports = PassThrough;
    var Transform = require_stream_transform2();
    var util = Object.create(require_util());
    util.inherits = require_inherits();
    util.inherits(PassThrough, Transform);
    function PassThrough(options) {
      if (!(this instanceof PassThrough)) return new PassThrough(options);
      Transform.call(this, options);
    }
    PassThrough.prototype._transform = function(chunk, encoding, cb) {
      cb(null, chunk);
    };
  }
});

// node_modules/simple-peer/node_modules/readable-stream/readable.js
var require_readable2 = __commonJS({
  "node_modules/simple-peer/node_modules/readable-stream/readable.js"(exports2, module2) {
    var Stream = require("stream");
    if (process.env.READABLE_STREAM === "disable" && Stream) {
      module2.exports = Stream;
      exports2 = module2.exports = Stream.Readable;
      exports2.Readable = Stream.Readable;
      exports2.Writable = Stream.Writable;
      exports2.Duplex = Stream.Duplex;
      exports2.Transform = Stream.Transform;
      exports2.PassThrough = Stream.PassThrough;
      exports2.Stream = Stream;
    } else {
      exports2 = module2.exports = require_stream_readable2();
      exports2.Stream = Stream || exports2;
      exports2.Readable = exports2;
      exports2.Writable = require_stream_writable2();
      exports2.Duplex = require_stream_duplex2();
      exports2.Transform = require_stream_transform2();
      exports2.PassThrough = require_stream_passthrough2();
    }
  }
});

// node_modules/simple-peer/index.js
var require_simple_peer = __commonJS({
  "node_modules/simple-peer/index.js"(exports2, module2) {
    module2.exports = Peer;
    var debug = require_src()("simple-peer");
    var getBrowserRTC = require_get_browser_rtc();
    var inherits = require_inherits();
    var randombytes = require_randombytes();
    var stream = require_readable2();
    var MAX_BUFFERED_AMOUNT = 64 * 1024;
    inherits(Peer, stream.Duplex);
    function Peer(opts) {
      var self2 = this;
      if (!(self2 instanceof Peer)) return new Peer(opts);
      self2._id = randombytes(4).toString("hex").slice(0, 7);
      self2._debug("new peer %o", opts);
      opts = Object.assign({
        allowHalfOpen: false
      }, opts);
      stream.Duplex.call(self2, opts);
      self2.channelName = opts.initiator ? opts.channelName || randombytes(20).toString("hex") : null;
      self2._isChromium = typeof window !== "undefined" && !!window.webkitRTCPeerConnection;
      self2.initiator = opts.initiator || false;
      self2.channelConfig = opts.channelConfig || Peer.channelConfig;
      self2.config = opts.config || Peer.config;
      self2.constraints = self2._transformConstraints(opts.constraints || Peer.constraints);
      self2.offerConstraints = self2._transformConstraints(opts.offerConstraints || {});
      self2.answerConstraints = self2._transformConstraints(opts.answerConstraints || {});
      self2.reconnectTimer = opts.reconnectTimer || false;
      self2.sdpTransform = opts.sdpTransform || function(sdp) {
        return sdp;
      };
      self2.stream = opts.stream || false;
      self2.trickle = opts.trickle !== void 0 ? opts.trickle : true;
      self2.destroyed = false;
      self2.connected = false;
      self2.remoteAddress = void 0;
      self2.remoteFamily = void 0;
      self2.remotePort = void 0;
      self2.localAddress = void 0;
      self2.localPort = void 0;
      self2._wrtc = opts.wrtc && typeof opts.wrtc === "object" ? opts.wrtc : getBrowserRTC();
      if (!self2._wrtc) {
        if (typeof window === "undefined") {
          throw new Error("No WebRTC support: Specify `opts.wrtc` option in this environment");
        } else {
          throw new Error("No WebRTC support: Not a supported browser");
        }
      }
      self2._pcReady = false;
      self2._channelReady = false;
      self2._iceComplete = false;
      self2._channel = null;
      self2._pendingCandidates = [];
      self2._previousStreams = [];
      self2._chunk = null;
      self2._cb = null;
      self2._interval = null;
      self2._reconnectTimeout = null;
      self2._pc = new self2._wrtc.RTCPeerConnection(self2.config, self2.constraints);
      self2._isWrtc = Array.isArray(self2._pc.RTCIceConnectionStates);
      self2._isReactNativeWebrtc = typeof self2._pc._peerConnectionId === "number";
      self2._pc.oniceconnectionstatechange = function() {
        self2._onIceConnectionStateChange();
      };
      self2._pc.onsignalingstatechange = function() {
        self2._onSignalingStateChange();
      };
      self2._pc.onicecandidate = function(event) {
        self2._onIceCandidate(event);
      };
      if (self2.initiator) {
        var createdOffer = false;
        self2._pc.onnegotiationneeded = function() {
          if (!createdOffer) self2._createOffer();
          createdOffer = true;
        };
        self2._setupData({
          channel: self2._pc.createDataChannel(self2.channelName, self2.channelConfig)
        });
      } else {
        self2._pc.ondatachannel = function(event) {
          self2._setupData(event);
        };
      }
      if ("addTrack" in self2._pc) {
        if (self2.stream) {
          self2.stream.getTracks().forEach(function(track) {
            self2._pc.addTrack(track, self2.stream);
          });
        }
        self2._pc.ontrack = function(event) {
          self2._onTrack(event);
        };
      } else {
        if (self2.stream) self2._pc.addStream(self2.stream);
        self2._pc.onaddstream = function(event) {
          self2._onAddStream(event);
        };
      }
      if (self2.initiator && self2._isWrtc) {
        self2._pc.onnegotiationneeded();
      }
      self2._onFinishBound = function() {
        self2._onFinish();
      };
      self2.once("finish", self2._onFinishBound);
    }
    Peer.WEBRTC_SUPPORT = !!getBrowserRTC();
    Peer.config = {
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302"
        },
        {
          urls: "stun:global.stun.twilio.com:3478?transport=udp"
        }
      ]
    };
    Peer.constraints = {};
    Peer.channelConfig = {};
    Object.defineProperty(Peer.prototype, "bufferSize", {
      get: function() {
        var self2 = this;
        return self2._channel && self2._channel.bufferedAmount || 0;
      }
    });
    Peer.prototype.address = function() {
      var self2 = this;
      return { port: self2.localPort, family: "IPv4", address: self2.localAddress };
    };
    Peer.prototype.signal = function(data) {
      var self2 = this;
      if (self2.destroyed) throw new Error("cannot signal after peer is destroyed");
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch (err) {
          data = {};
        }
      }
      self2._debug("signal()");
      if (data.candidate) {
        if (self2._pc.remoteDescription) self2._addIceCandidate(data.candidate);
        else self2._pendingCandidates.push(data.candidate);
      }
      if (data.sdp) {
        self2._pc.setRemoteDescription(new self2._wrtc.RTCSessionDescription(data), function() {
          if (self2.destroyed) return;
          self2._pendingCandidates.forEach(function(candidate) {
            self2._addIceCandidate(candidate);
          });
          self2._pendingCandidates = [];
          if (self2._pc.remoteDescription.type === "offer") self2._createAnswer();
        }, function(err) {
          self2._onError(err);
        });
      }
      if (!data.sdp && !data.candidate) {
        self2._destroy(new Error("signal() called with invalid signal data"));
      }
    };
    Peer.prototype._addIceCandidate = function(candidate) {
      var self2 = this;
      try {
        self2._pc.addIceCandidate(
          new self2._wrtc.RTCIceCandidate(candidate),
          noop,
          function(err) {
            self2._onError(err);
          }
        );
      } catch (err) {
        self2._destroy(new Error("error adding candidate: " + err.message));
      }
    };
    Peer.prototype.send = function(chunk) {
      var self2 = this;
      if (self2._isWrtc && Buffer.isBuffer(chunk)) {
        chunk = new Uint8Array(chunk);
      }
      self2._channel.send(chunk);
    };
    Peer.prototype.destroy = function(onclose) {
      var self2 = this;
      self2._destroy(null, onclose);
    };
    Peer.prototype._destroy = function(err, onclose) {
      var self2 = this;
      if (self2.destroyed) return;
      if (onclose) self2.once("close", onclose);
      self2._debug("destroy (error: %s)", err && err.message);
      self2.readable = self2.writable = false;
      if (!self2._readableState.ended) self2.push(null);
      if (!self2._writableState.finished) self2.end();
      self2.destroyed = true;
      self2.connected = false;
      self2._pcReady = false;
      self2._channelReady = false;
      self2._previousStreams = null;
      clearInterval(self2._interval);
      clearTimeout(self2._reconnectTimeout);
      self2._interval = null;
      self2._reconnectTimeout = null;
      self2._chunk = null;
      self2._cb = null;
      if (self2._onFinishBound) self2.removeListener("finish", self2._onFinishBound);
      self2._onFinishBound = null;
      if (self2._pc) {
        try {
          self2._pc.close();
        } catch (err2) {
        }
        self2._pc.oniceconnectionstatechange = null;
        self2._pc.onsignalingstatechange = null;
        self2._pc.onicecandidate = null;
        if ("addTrack" in self2._pc) {
          self2._pc.ontrack = null;
        } else {
          self2._pc.onaddstream = null;
        }
        self2._pc.onnegotiationneeded = null;
        self2._pc.ondatachannel = null;
      }
      if (self2._channel) {
        try {
          self2._channel.close();
        } catch (err2) {
        }
        self2._channel.onmessage = null;
        self2._channel.onopen = null;
        self2._channel.onclose = null;
      }
      self2._pc = null;
      self2._channel = null;
      if (err) self2.emit("error", err);
      self2.emit("close");
    };
    Peer.prototype._setupData = function(event) {
      var self2 = this;
      self2._channel = event.channel;
      self2._channel.binaryType = "arraybuffer";
      if (typeof self2._channel.bufferedAmountLowThreshold === "number") {
        self2._channel.bufferedAmountLowThreshold = MAX_BUFFERED_AMOUNT;
      }
      self2.channelName = self2._channel.label;
      self2._channel.onmessage = function(event2) {
        self2._onChannelMessage(event2);
      };
      self2._channel.onbufferedamountlow = function() {
        self2._onChannelBufferedAmountLow();
      };
      self2._channel.onopen = function() {
        self2._onChannelOpen();
      };
      self2._channel.onclose = function() {
        self2._onChannelClose();
      };
    };
    Peer.prototype._read = function() {
    };
    Peer.prototype._write = function(chunk, encoding, cb) {
      var self2 = this;
      if (self2.destroyed) return cb(new Error("cannot write after peer is destroyed"));
      if (self2.connected) {
        try {
          self2.send(chunk);
        } catch (err) {
          return self2._onError(err);
        }
        if (self2._channel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
          self2._debug("start backpressure: bufferedAmount %d", self2._channel.bufferedAmount);
          self2._cb = cb;
        } else {
          cb(null);
        }
      } else {
        self2._debug("write before connect");
        self2._chunk = chunk;
        self2._cb = cb;
      }
    };
    Peer.prototype._onFinish = function() {
      var self2 = this;
      if (self2.destroyed) return;
      if (self2.connected) {
        destroySoon();
      } else {
        self2.once("connect", destroySoon);
      }
      function destroySoon() {
        setTimeout(function() {
          self2._destroy();
        }, 100);
      }
    };
    Peer.prototype._createOffer = function() {
      var self2 = this;
      if (self2.destroyed) return;
      self2._pc.createOffer(function(offer) {
        if (self2.destroyed) return;
        offer.sdp = self2.sdpTransform(offer.sdp);
        self2._pc.setLocalDescription(offer, noop, function(err) {
          self2._onError(err);
        });
        var sendOffer = function() {
          var signal = self2._pc.localDescription || offer;
          self2._debug("signal");
          self2.emit("signal", {
            type: signal.type,
            sdp: signal.sdp
          });
        };
        if (self2.trickle || self2._iceComplete) sendOffer();
        else self2.once("_iceComplete", sendOffer);
      }, function(err) {
        self2._onError(err);
      }, self2.offerConstraints);
    };
    Peer.prototype._createAnswer = function() {
      var self2 = this;
      if (self2.destroyed) return;
      self2._pc.createAnswer(function(answer) {
        if (self2.destroyed) return;
        answer.sdp = self2.sdpTransform(answer.sdp);
        self2._pc.setLocalDescription(answer, noop, function(err) {
          self2._onError(err);
        });
        if (self2.trickle || self2._iceComplete) sendAnswer();
        else self2.once("_iceComplete", sendAnswer);
        function sendAnswer() {
          var signal = self2._pc.localDescription || answer;
          self2._debug("signal");
          self2.emit("signal", {
            type: signal.type,
            sdp: signal.sdp
          });
        }
      }, function(err) {
        self2._onError(err);
      }, self2.answerConstraints);
    };
    Peer.prototype._onIceConnectionStateChange = function() {
      var self2 = this;
      if (self2.destroyed) return;
      var iceGatheringState = self2._pc.iceGatheringState;
      var iceConnectionState = self2._pc.iceConnectionState;
      self2._debug("iceConnectionStateChange %s %s", iceGatheringState, iceConnectionState);
      self2.emit("iceConnectionStateChange", iceGatheringState, iceConnectionState);
      if (iceConnectionState === "connected" || iceConnectionState === "completed") {
        clearTimeout(self2._reconnectTimeout);
        self2._pcReady = true;
        self2._maybeReady();
      }
      if (iceConnectionState === "disconnected") {
        if (self2.reconnectTimer) {
          clearTimeout(self2._reconnectTimeout);
          self2._reconnectTimeout = setTimeout(function() {
            self2._destroy();
          }, self2.reconnectTimer);
        } else {
          self2._destroy();
        }
      }
      if (iceConnectionState === "failed") {
        self2._destroy(new Error("Ice connection failed."));
      }
      if (iceConnectionState === "closed") {
        self2._destroy();
      }
    };
    Peer.prototype.getStats = function(cb) {
      var self2 = this;
      if (self2._pc.getStats.length === 0) {
        self2._pc.getStats().then(function(res) {
          var reports = [];
          res.forEach(function(report) {
            reports.push(report);
          });
          cb(reports);
        }, function(err) {
          self2._onError(err);
        });
      } else if (self2._isReactNativeWebrtc) {
        self2._pc.getStats(null, function(res) {
          var reports = [];
          res.forEach(function(report) {
            reports.push(report);
          });
          cb(reports);
        }, function(err) {
          self2._onError(err);
        });
      } else if (self2._pc.getStats.length > 0) {
        self2._pc.getStats(function(res) {
          var reports = [];
          res.result().forEach(function(result) {
            var report = {};
            result.names().forEach(function(name) {
              report[name] = result.stat(name);
            });
            report.id = result.id;
            report.type = result.type;
            report.timestamp = result.timestamp;
            reports.push(report);
          });
          cb(reports);
        }, function(err) {
          self2._onError(err);
        });
      } else {
        cb([]);
      }
    };
    Peer.prototype._maybeReady = function() {
      var self2 = this;
      self2._debug("maybeReady pc %s channel %s", self2._pcReady, self2._channelReady);
      if (self2.connected || self2._connecting || !self2._pcReady || !self2._channelReady) return;
      self2._connecting = true;
      self2.getStats(function(items) {
        self2._connecting = false;
        self2.connected = true;
        var remoteCandidates = {};
        var localCandidates = {};
        var candidatePairs = {};
        items.forEach(function(item) {
          if (item.type === "remotecandidate" || item.type === "remote-candidate") {
            remoteCandidates[item.id] = item;
          }
          if (item.type === "localcandidate" || item.type === "local-candidate") {
            localCandidates[item.id] = item;
          }
          if (item.type === "candidatepair" || item.type === "candidate-pair") {
            candidatePairs[item.id] = item;
          }
        });
        items.forEach(function(item) {
          if (item.type === "transport") {
            setSelectedCandidatePair(candidatePairs[item.selectedCandidatePairId]);
          }
          if (item.type === "googCandidatePair" && item.googActiveConnection === "true" || (item.type === "candidatepair" || item.type === "candidate-pair") && item.selected) {
            setSelectedCandidatePair(item);
          }
        });
        function setSelectedCandidatePair(selectedCandidatePair) {
          var local = localCandidates[selectedCandidatePair.localCandidateId];
          if (local && local.ip) {
            self2.localAddress = local.ip;
            self2.localPort = Number(local.port);
          } else if (local && local.ipAddress) {
            self2.localAddress = local.ipAddress;
            self2.localPort = Number(local.portNumber);
          } else if (typeof selectedCandidatePair.googLocalAddress === "string") {
            local = selectedCandidatePair.googLocalAddress.split(":");
            self2.localAddress = local[0];
            self2.localPort = Number(local[1]);
          }
          var remote = remoteCandidates[selectedCandidatePair.remoteCandidateId];
          if (remote && remote.ip) {
            self2.remoteAddress = remote.ip;
            self2.remotePort = Number(remote.port);
          } else if (remote && remote.ipAddress) {
            self2.remoteAddress = remote.ipAddress;
            self2.remotePort = Number(remote.portNumber);
          } else if (typeof selectedCandidatePair.googRemoteAddress === "string") {
            remote = selectedCandidatePair.googRemoteAddress.split(":");
            self2.remoteAddress = remote[0];
            self2.remotePort = Number(remote[1]);
          }
          self2.remoteFamily = "IPv4";
          self2._debug(
            "connect local: %s:%s remote: %s:%s",
            self2.localAddress,
            self2.localPort,
            self2.remoteAddress,
            self2.remotePort
          );
        }
        if (self2._chunk) {
          try {
            self2.send(self2._chunk);
          } catch (err) {
            return self2._onError(err);
          }
          self2._chunk = null;
          self2._debug('sent chunk from "write before connect"');
          var cb = self2._cb;
          self2._cb = null;
          cb(null);
        }
        if (typeof self2._channel.bufferedAmountLowThreshold !== "number") {
          self2._interval = setInterval(function() {
            self2._onInterval();
          }, 150);
          if (self2._interval.unref) self2._interval.unref();
        }
        self2._debug("connect");
        self2.emit("connect");
      });
    };
    Peer.prototype._onInterval = function() {
      if (!this._cb || !this._channel || this._channel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
        return;
      }
      this._onChannelBufferedAmountLow();
    };
    Peer.prototype._onSignalingStateChange = function() {
      var self2 = this;
      if (self2.destroyed) return;
      self2._debug("signalingStateChange %s", self2._pc.signalingState);
      self2.emit("signalingStateChange", self2._pc.signalingState);
    };
    Peer.prototype._onIceCandidate = function(event) {
      var self2 = this;
      if (self2.destroyed) return;
      if (event.candidate && self2.trickle) {
        self2.emit("signal", {
          candidate: {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid
          }
        });
      } else if (!event.candidate) {
        self2._iceComplete = true;
        self2.emit("_iceComplete");
      }
    };
    Peer.prototype._onChannelMessage = function(event) {
      var self2 = this;
      if (self2.destroyed) return;
      var data = event.data;
      if (data instanceof ArrayBuffer) data = new Buffer(data);
      self2.push(data);
    };
    Peer.prototype._onChannelBufferedAmountLow = function() {
      var self2 = this;
      if (self2.destroyed || !self2._cb) return;
      self2._debug("ending backpressure: bufferedAmount %d", self2._channel.bufferedAmount);
      var cb = self2._cb;
      self2._cb = null;
      cb(null);
    };
    Peer.prototype._onChannelOpen = function() {
      var self2 = this;
      if (self2.connected || self2.destroyed) return;
      self2._debug("on channel open");
      self2._channelReady = true;
      self2._maybeReady();
    };
    Peer.prototype._onChannelClose = function() {
      var self2 = this;
      if (self2.destroyed) return;
      self2._debug("on channel close");
      self2._destroy();
    };
    Peer.prototype._onAddStream = function(event) {
      var self2 = this;
      if (self2.destroyed) return;
      self2._debug("on add stream");
      self2.emit("stream", event.stream);
    };
    Peer.prototype._onTrack = function(event) {
      var self2 = this;
      if (self2.destroyed) return;
      self2._debug("on track");
      var id = event.streams[0].id;
      if (self2._previousStreams.indexOf(id) !== -1) return;
      self2._previousStreams.push(id);
      self2.emit("stream", event.streams[0]);
    };
    Peer.prototype._onError = function(err) {
      var self2 = this;
      if (self2.destroyed) return;
      self2._debug("error %s", err.message || err);
      self2._destroy(err);
    };
    Peer.prototype._debug = function() {
      var self2 = this;
      var args = [].slice.call(arguments);
      args[0] = "[" + self2._id + "] " + args[0];
      debug.apply(null, args);
    };
    Peer.prototype._transformConstraints = function(constraints) {
      var self2 = this;
      if (Object.keys(constraints).length === 0) {
        return constraints;
      }
      if ((constraints.mandatory || constraints.optional) && !self2._isChromium) {
        var newConstraints = Object.assign({}, constraints.optional, constraints.mandatory);
        if (newConstraints.OfferToReceiveVideo !== void 0) {
          newConstraints.offerToReceiveVideo = newConstraints.OfferToReceiveVideo;
          delete newConstraints["OfferToReceiveVideo"];
        }
        if (newConstraints.OfferToReceiveAudio !== void 0) {
          newConstraints.offerToReceiveAudio = newConstraints.OfferToReceiveAudio;
          delete newConstraints["OfferToReceiveAudio"];
        }
        return newConstraints;
      } else if (!constraints.mandatory && !constraints.optional && self2._isChromium) {
        if (constraints.offerToReceiveVideo !== void 0) {
          constraints.OfferToReceiveVideo = constraints.offerToReceiveVideo;
          delete constraints["offerToReceiveVideo"];
        }
        if (constraints.offerToReceiveAudio !== void 0) {
          constraints.OfferToReceiveAudio = constraints.offerToReceiveAudio;
          delete constraints["offerToReceiveAudio"];
        }
        return {
          mandatory: constraints
          // NOTE: All constraints are upgraded to mandatory
        };
      }
      return constraints;
    };
    function noop() {
    }
  }
});

// node_modules/simple-websocket/node_modules/isarray/index.js
var require_isarray3 = __commonJS({
  "node_modules/simple-websocket/node_modules/isarray/index.js"(exports2, module2) {
    var toString = {}.toString;
    module2.exports = Array.isArray || function(arr) {
      return toString.call(arr) == "[object Array]";
    };
  }
});

// node_modules/simple-websocket/node_modules/readable-stream/lib/internal/streams/stream.js
var require_stream2 = __commonJS({
  "node_modules/simple-websocket/node_modules/readable-stream/lib/internal/streams/stream.js"(exports2, module2) {
    module2.exports = require("stream");
  }
});

// node_modules/simple-websocket/node_modules/safe-buffer/index.js
var require_safe_buffer2 = __commonJS({
  "node_modules/simple-websocket/node_modules/safe-buffer/index.js"(exports2, module2) {
    var buffer = require("buffer");
    var Buffer2 = buffer.Buffer;
    function copyProps(src, dst) {
      for (var key in src) {
        dst[key] = src[key];
      }
    }
    if (Buffer2.from && Buffer2.alloc && Buffer2.allocUnsafe && Buffer2.allocUnsafeSlow) {
      module2.exports = buffer;
    } else {
      copyProps(buffer, exports2);
      exports2.Buffer = SafeBuffer;
    }
    function SafeBuffer(arg, encodingOrOffset, length) {
      return Buffer2(arg, encodingOrOffset, length);
    }
    copyProps(Buffer2, SafeBuffer);
    SafeBuffer.from = function(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        throw new TypeError("Argument must not be a number");
      }
      return Buffer2(arg, encodingOrOffset, length);
    };
    SafeBuffer.alloc = function(size, fill, encoding) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      var buf = Buffer2(size);
      if (fill !== void 0) {
        if (typeof encoding === "string") {
          buf.fill(fill, encoding);
        } else {
          buf.fill(fill);
        }
      } else {
        buf.fill(0);
      }
      return buf;
    };
    SafeBuffer.allocUnsafe = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return Buffer2(size);
    };
    SafeBuffer.allocUnsafeSlow = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return buffer.SlowBuffer(size);
    };
  }
});

// node_modules/simple-websocket/node_modules/readable-stream/lib/internal/streams/BufferList.js
var require_BufferList2 = __commonJS({
  "node_modules/simple-websocket/node_modules/readable-stream/lib/internal/streams/BufferList.js"(exports2, module2) {
    "use strict";
    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }
    var Buffer2 = require_safe_buffer2().Buffer;
    var util = require("util");
    function copyBuffer(src, target, offset) {
      src.copy(target, offset);
    }
    module2.exports = (function() {
      function BufferList() {
        _classCallCheck(this, BufferList);
        this.head = null;
        this.tail = null;
        this.length = 0;
      }
      BufferList.prototype.push = function push(v) {
        var entry = { data: v, next: null };
        if (this.length > 0) this.tail.next = entry;
        else this.head = entry;
        this.tail = entry;
        ++this.length;
      };
      BufferList.prototype.unshift = function unshift(v) {
        var entry = { data: v, next: this.head };
        if (this.length === 0) this.tail = entry;
        this.head = entry;
        ++this.length;
      };
      BufferList.prototype.shift = function shift() {
        if (this.length === 0) return;
        var ret = this.head.data;
        if (this.length === 1) this.head = this.tail = null;
        else this.head = this.head.next;
        --this.length;
        return ret;
      };
      BufferList.prototype.clear = function clear() {
        this.head = this.tail = null;
        this.length = 0;
      };
      BufferList.prototype.join = function join(s) {
        if (this.length === 0) return "";
        var p = this.head;
        var ret = "" + p.data;
        while (p = p.next) {
          ret += s + p.data;
        }
        return ret;
      };
      BufferList.prototype.concat = function concat(n) {
        if (this.length === 0) return Buffer2.alloc(0);
        var ret = Buffer2.allocUnsafe(n >>> 0);
        var p = this.head;
        var i = 0;
        while (p) {
          copyBuffer(p.data, ret, i);
          i += p.data.length;
          p = p.next;
        }
        return ret;
      };
      return BufferList;
    })();
    if (util && util.inspect && util.inspect.custom) {
      module2.exports.prototype[util.inspect.custom] = function() {
        var obj = util.inspect({ length: this.length });
        return this.constructor.name + " " + obj;
      };
    }
  }
});

// node_modules/simple-websocket/node_modules/readable-stream/lib/internal/streams/destroy.js
var require_destroy2 = __commonJS({
  "node_modules/simple-websocket/node_modules/readable-stream/lib/internal/streams/destroy.js"(exports2, module2) {
    "use strict";
    var pna = require_process_nextick_args();
    function destroy(err, cb) {
      var _this = this;
      var readableDestroyed = this._readableState && this._readableState.destroyed;
      var writableDestroyed = this._writableState && this._writableState.destroyed;
      if (readableDestroyed || writableDestroyed) {
        if (cb) {
          cb(err);
        } else if (err) {
          if (!this._writableState) {
            pna.nextTick(emitErrorNT, this, err);
          } else if (!this._writableState.errorEmitted) {
            this._writableState.errorEmitted = true;
            pna.nextTick(emitErrorNT, this, err);
          }
        }
        return this;
      }
      if (this._readableState) {
        this._readableState.destroyed = true;
      }
      if (this._writableState) {
        this._writableState.destroyed = true;
      }
      this._destroy(err || null, function(err2) {
        if (!cb && err2) {
          if (!_this._writableState) {
            pna.nextTick(emitErrorNT, _this, err2);
          } else if (!_this._writableState.errorEmitted) {
            _this._writableState.errorEmitted = true;
            pna.nextTick(emitErrorNT, _this, err2);
          }
        } else if (cb) {
          cb(err2);
        }
      });
      return this;
    }
    function undestroy() {
      if (this._readableState) {
        this._readableState.destroyed = false;
        this._readableState.reading = false;
        this._readableState.ended = false;
        this._readableState.endEmitted = false;
      }
      if (this._writableState) {
        this._writableState.destroyed = false;
        this._writableState.ended = false;
        this._writableState.ending = false;
        this._writableState.finalCalled = false;
        this._writableState.prefinished = false;
        this._writableState.finished = false;
        this._writableState.errorEmitted = false;
      }
    }
    function emitErrorNT(self2, err) {
      self2.emit("error", err);
    }
    module2.exports = {
      destroy,
      undestroy
    };
  }
});

// node_modules/simple-websocket/node_modules/readable-stream/lib/_stream_writable.js
var require_stream_writable3 = __commonJS({
  "node_modules/simple-websocket/node_modules/readable-stream/lib/_stream_writable.js"(exports2, module2) {
    "use strict";
    var pna = require_process_nextick_args();
    module2.exports = Writable;
    function CorkedRequest(state) {
      var _this = this;
      this.next = null;
      this.entry = null;
      this.finish = function() {
        onCorkedFinish(_this, state);
      };
    }
    var asyncWrite = !process.browser && ["v0.10", "v0.9."].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : pna.nextTick;
    var Duplex;
    Writable.WritableState = WritableState;
    var util = Object.create(require_util());
    util.inherits = require_inherits();
    var internalUtil = {
      deprecate: require_node2()
    };
    var Stream = require_stream2();
    var Buffer2 = require_safe_buffer2().Buffer;
    var OurUint8Array = (typeof global !== "undefined" ? global : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {
    };
    function _uint8ArrayToBuffer(chunk) {
      return Buffer2.from(chunk);
    }
    function _isUint8Array(obj) {
      return Buffer2.isBuffer(obj) || obj instanceof OurUint8Array;
    }
    var destroyImpl = require_destroy2();
    util.inherits(Writable, Stream);
    function nop() {
    }
    function WritableState(options, stream) {
      Duplex = Duplex || require_stream_duplex3();
      options = options || {};
      var isDuplex = stream instanceof Duplex;
      this.objectMode = !!options.objectMode;
      if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;
      var hwm = options.highWaterMark;
      var writableHwm = options.writableHighWaterMark;
      var defaultHwm = this.objectMode ? 16 : 16 * 1024;
      if (hwm || hwm === 0) this.highWaterMark = hwm;
      else if (isDuplex && (writableHwm || writableHwm === 0)) this.highWaterMark = writableHwm;
      else this.highWaterMark = defaultHwm;
      this.highWaterMark = Math.floor(this.highWaterMark);
      this.finalCalled = false;
      this.needDrain = false;
      this.ending = false;
      this.ended = false;
      this.finished = false;
      this.destroyed = false;
      var noDecode = options.decodeStrings === false;
      this.decodeStrings = !noDecode;
      this.defaultEncoding = options.defaultEncoding || "utf8";
      this.length = 0;
      this.writing = false;
      this.corked = 0;
      this.sync = true;
      this.bufferProcessing = false;
      this.onwrite = function(er) {
        onwrite(stream, er);
      };
      this.writecb = null;
      this.writelen = 0;
      this.bufferedRequest = null;
      this.lastBufferedRequest = null;
      this.pendingcb = 0;
      this.prefinished = false;
      this.errorEmitted = false;
      this.bufferedRequestCount = 0;
      this.corkedRequestsFree = new CorkedRequest(this);
    }
    WritableState.prototype.getBuffer = function getBuffer() {
      var current2 = this.bufferedRequest;
      var out = [];
      while (current2) {
        out.push(current2);
        current2 = current2.next;
      }
      return out;
    };
    (function() {
      try {
        Object.defineProperty(WritableState.prototype, "buffer", {
          get: internalUtil.deprecate(function() {
            return this.getBuffer();
          }, "_writableState.buffer is deprecated. Use _writableState.getBuffer instead.", "DEP0003")
        });
      } catch (_) {
      }
    })();
    var realHasInstance;
    if (typeof Symbol === "function" && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === "function") {
      realHasInstance = Function.prototype[Symbol.hasInstance];
      Object.defineProperty(Writable, Symbol.hasInstance, {
        value: function(object) {
          if (realHasInstance.call(this, object)) return true;
          if (this !== Writable) return false;
          return object && object._writableState instanceof WritableState;
        }
      });
    } else {
      realHasInstance = function(object) {
        return object instanceof this;
      };
    }
    function Writable(options) {
      Duplex = Duplex || require_stream_duplex3();
      if (!realHasInstance.call(Writable, this) && !(this instanceof Duplex)) {
        return new Writable(options);
      }
      this._writableState = new WritableState(options, this);
      this.writable = true;
      if (options) {
        if (typeof options.write === "function") this._write = options.write;
        if (typeof options.writev === "function") this._writev = options.writev;
        if (typeof options.destroy === "function") this._destroy = options.destroy;
        if (typeof options.final === "function") this._final = options.final;
      }
      Stream.call(this);
    }
    Writable.prototype.pipe = function() {
      this.emit("error", new Error("Cannot pipe, not readable"));
    };
    function writeAfterEnd(stream, cb) {
      var er = new Error("write after end");
      stream.emit("error", er);
      pna.nextTick(cb, er);
    }
    function validChunk(stream, state, chunk, cb) {
      var valid = true;
      var er = false;
      if (chunk === null) {
        er = new TypeError("May not write null values to stream");
      } else if (typeof chunk !== "string" && chunk !== void 0 && !state.objectMode) {
        er = new TypeError("Invalid non-string/buffer chunk");
      }
      if (er) {
        stream.emit("error", er);
        pna.nextTick(cb, er);
        valid = false;
      }
      return valid;
    }
    Writable.prototype.write = function(chunk, encoding, cb) {
      var state = this._writableState;
      var ret = false;
      var isBuf = !state.objectMode && _isUint8Array(chunk);
      if (isBuf && !Buffer2.isBuffer(chunk)) {
        chunk = _uint8ArrayToBuffer(chunk);
      }
      if (typeof encoding === "function") {
        cb = encoding;
        encoding = null;
      }
      if (isBuf) encoding = "buffer";
      else if (!encoding) encoding = state.defaultEncoding;
      if (typeof cb !== "function") cb = nop;
      if (state.ended) writeAfterEnd(this, cb);
      else if (isBuf || validChunk(this, state, chunk, cb)) {
        state.pendingcb++;
        ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
      }
      return ret;
    };
    Writable.prototype.cork = function() {
      var state = this._writableState;
      state.corked++;
    };
    Writable.prototype.uncork = function() {
      var state = this._writableState;
      if (state.corked) {
        state.corked--;
        if (!state.writing && !state.corked && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
      }
    };
    Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
      if (typeof encoding === "string") encoding = encoding.toLowerCase();
      if (!(["hex", "utf8", "utf-8", "ascii", "binary", "base64", "ucs2", "ucs-2", "utf16le", "utf-16le", "raw"].indexOf((encoding + "").toLowerCase()) > -1)) throw new TypeError("Unknown encoding: " + encoding);
      this._writableState.defaultEncoding = encoding;
      return this;
    };
    function decodeChunk(state, chunk, encoding) {
      if (!state.objectMode && state.decodeStrings !== false && typeof chunk === "string") {
        chunk = Buffer2.from(chunk, encoding);
      }
      return chunk;
    }
    Object.defineProperty(Writable.prototype, "writableHighWaterMark", {
      // making it explicit this property is not enumerable
      // because otherwise some prototype manipulation in
      // userland will fail
      enumerable: false,
      get: function() {
        return this._writableState.highWaterMark;
      }
    });
    function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
      if (!isBuf) {
        var newChunk = decodeChunk(state, chunk, encoding);
        if (chunk !== newChunk) {
          isBuf = true;
          encoding = "buffer";
          chunk = newChunk;
        }
      }
      var len = state.objectMode ? 1 : chunk.length;
      state.length += len;
      var ret = state.length < state.highWaterMark;
      if (!ret) state.needDrain = true;
      if (state.writing || state.corked) {
        var last = state.lastBufferedRequest;
        state.lastBufferedRequest = {
          chunk,
          encoding,
          isBuf,
          callback: cb,
          next: null
        };
        if (last) {
          last.next = state.lastBufferedRequest;
        } else {
          state.bufferedRequest = state.lastBufferedRequest;
        }
        state.bufferedRequestCount += 1;
      } else {
        doWrite(stream, state, false, len, chunk, encoding, cb);
      }
      return ret;
    }
    function doWrite(stream, state, writev, len, chunk, encoding, cb) {
      state.writelen = len;
      state.writecb = cb;
      state.writing = true;
      state.sync = true;
      if (writev) stream._writev(chunk, state.onwrite);
      else stream._write(chunk, encoding, state.onwrite);
      state.sync = false;
    }
    function onwriteError(stream, state, sync, er, cb) {
      --state.pendingcb;
      if (sync) {
        pna.nextTick(cb, er);
        pna.nextTick(finishMaybe, stream, state);
        stream._writableState.errorEmitted = true;
        stream.emit("error", er);
      } else {
        cb(er);
        stream._writableState.errorEmitted = true;
        stream.emit("error", er);
        finishMaybe(stream, state);
      }
    }
    function onwriteStateUpdate(state) {
      state.writing = false;
      state.writecb = null;
      state.length -= state.writelen;
      state.writelen = 0;
    }
    function onwrite(stream, er) {
      var state = stream._writableState;
      var sync = state.sync;
      var cb = state.writecb;
      onwriteStateUpdate(state);
      if (er) onwriteError(stream, state, sync, er, cb);
      else {
        var finished = needFinish(state);
        if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
          clearBuffer(stream, state);
        }
        if (sync) {
          asyncWrite(afterWrite, stream, state, finished, cb);
        } else {
          afterWrite(stream, state, finished, cb);
        }
      }
    }
    function afterWrite(stream, state, finished, cb) {
      if (!finished) onwriteDrain(stream, state);
      state.pendingcb--;
      cb();
      finishMaybe(stream, state);
    }
    function onwriteDrain(stream, state) {
      if (state.length === 0 && state.needDrain) {
        state.needDrain = false;
        stream.emit("drain");
      }
    }
    function clearBuffer(stream, state) {
      state.bufferProcessing = true;
      var entry = state.bufferedRequest;
      if (stream._writev && entry && entry.next) {
        var l = state.bufferedRequestCount;
        var buffer = new Array(l);
        var holder = state.corkedRequestsFree;
        holder.entry = entry;
        var count = 0;
        var allBuffers = true;
        while (entry) {
          buffer[count] = entry;
          if (!entry.isBuf) allBuffers = false;
          entry = entry.next;
          count += 1;
        }
        buffer.allBuffers = allBuffers;
        doWrite(stream, state, true, state.length, buffer, "", holder.finish);
        state.pendingcb++;
        state.lastBufferedRequest = null;
        if (holder.next) {
          state.corkedRequestsFree = holder.next;
          holder.next = null;
        } else {
          state.corkedRequestsFree = new CorkedRequest(state);
        }
        state.bufferedRequestCount = 0;
      } else {
        while (entry) {
          var chunk = entry.chunk;
          var encoding = entry.encoding;
          var cb = entry.callback;
          var len = state.objectMode ? 1 : chunk.length;
          doWrite(stream, state, false, len, chunk, encoding, cb);
          entry = entry.next;
          state.bufferedRequestCount--;
          if (state.writing) {
            break;
          }
        }
        if (entry === null) state.lastBufferedRequest = null;
      }
      state.bufferedRequest = entry;
      state.bufferProcessing = false;
    }
    Writable.prototype._write = function(chunk, encoding, cb) {
      cb(new Error("_write() is not implemented"));
    };
    Writable.prototype._writev = null;
    Writable.prototype.end = function(chunk, encoding, cb) {
      var state = this._writableState;
      if (typeof chunk === "function") {
        cb = chunk;
        chunk = null;
        encoding = null;
      } else if (typeof encoding === "function") {
        cb = encoding;
        encoding = null;
      }
      if (chunk !== null && chunk !== void 0) this.write(chunk, encoding);
      if (state.corked) {
        state.corked = 1;
        this.uncork();
      }
      if (!state.ending) endWritable(this, state, cb);
    };
    function needFinish(state) {
      return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
    }
    function callFinal(stream, state) {
      stream._final(function(err) {
        state.pendingcb--;
        if (err) {
          stream.emit("error", err);
        }
        state.prefinished = true;
        stream.emit("prefinish");
        finishMaybe(stream, state);
      });
    }
    function prefinish(stream, state) {
      if (!state.prefinished && !state.finalCalled) {
        if (typeof stream._final === "function") {
          state.pendingcb++;
          state.finalCalled = true;
          pna.nextTick(callFinal, stream, state);
        } else {
          state.prefinished = true;
          stream.emit("prefinish");
        }
      }
    }
    function finishMaybe(stream, state) {
      var need = needFinish(state);
      if (need) {
        prefinish(stream, state);
        if (state.pendingcb === 0) {
          state.finished = true;
          stream.emit("finish");
        }
      }
      return need;
    }
    function endWritable(stream, state, cb) {
      state.ending = true;
      finishMaybe(stream, state);
      if (cb) {
        if (state.finished) pna.nextTick(cb);
        else stream.once("finish", cb);
      }
      state.ended = true;
      stream.writable = false;
    }
    function onCorkedFinish(corkReq, state, err) {
      var entry = corkReq.entry;
      corkReq.entry = null;
      while (entry) {
        var cb = entry.callback;
        state.pendingcb--;
        cb(err);
        entry = entry.next;
      }
      state.corkedRequestsFree.next = corkReq;
    }
    Object.defineProperty(Writable.prototype, "destroyed", {
      get: function() {
        if (this._writableState === void 0) {
          return false;
        }
        return this._writableState.destroyed;
      },
      set: function(value) {
        if (!this._writableState) {
          return;
        }
        this._writableState.destroyed = value;
      }
    });
    Writable.prototype.destroy = destroyImpl.destroy;
    Writable.prototype._undestroy = destroyImpl.undestroy;
    Writable.prototype._destroy = function(err, cb) {
      this.end();
      cb(err);
    };
  }
});

// node_modules/simple-websocket/node_modules/readable-stream/lib/_stream_duplex.js
var require_stream_duplex3 = __commonJS({
  "node_modules/simple-websocket/node_modules/readable-stream/lib/_stream_duplex.js"(exports2, module2) {
    "use strict";
    var pna = require_process_nextick_args();
    var objectKeys = Object.keys || function(obj) {
      var keys2 = [];
      for (var key in obj) {
        keys2.push(key);
      }
      return keys2;
    };
    module2.exports = Duplex;
    var util = Object.create(require_util());
    util.inherits = require_inherits();
    var Readable = require_stream_readable3();
    var Writable = require_stream_writable3();
    util.inherits(Duplex, Readable);
    {
      keys = objectKeys(Writable.prototype);
      for (v = 0; v < keys.length; v++) {
        method = keys[v];
        if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
      }
    }
    var keys;
    var method;
    var v;
    function Duplex(options) {
      if (!(this instanceof Duplex)) return new Duplex(options);
      Readable.call(this, options);
      Writable.call(this, options);
      if (options && options.readable === false) this.readable = false;
      if (options && options.writable === false) this.writable = false;
      this.allowHalfOpen = true;
      if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;
      this.once("end", onend);
    }
    Object.defineProperty(Duplex.prototype, "writableHighWaterMark", {
      // making it explicit this property is not enumerable
      // because otherwise some prototype manipulation in
      // userland will fail
      enumerable: false,
      get: function() {
        return this._writableState.highWaterMark;
      }
    });
    function onend() {
      if (this.allowHalfOpen || this._writableState.ended) return;
      pna.nextTick(onEndNT, this);
    }
    function onEndNT(self2) {
      self2.end();
    }
    Object.defineProperty(Duplex.prototype, "destroyed", {
      get: function() {
        if (this._readableState === void 0 || this._writableState === void 0) {
          return false;
        }
        return this._readableState.destroyed && this._writableState.destroyed;
      },
      set: function(value) {
        if (this._readableState === void 0 || this._writableState === void 0) {
          return;
        }
        this._readableState.destroyed = value;
        this._writableState.destroyed = value;
      }
    });
    Duplex.prototype._destroy = function(err, cb) {
      this.push(null);
      this.end();
      pna.nextTick(cb, err);
    };
  }
});

// node_modules/simple-websocket/node_modules/string_decoder/lib/string_decoder.js
var require_string_decoder3 = __commonJS({
  "node_modules/simple-websocket/node_modules/string_decoder/lib/string_decoder.js"(exports2) {
    "use strict";
    var Buffer2 = require_safe_buffer2().Buffer;
    var isEncoding = Buffer2.isEncoding || function(encoding) {
      encoding = "" + encoding;
      switch (encoding && encoding.toLowerCase()) {
        case "hex":
        case "utf8":
        case "utf-8":
        case "ascii":
        case "binary":
        case "base64":
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
        case "raw":
          return true;
        default:
          return false;
      }
    };
    function _normalizeEncoding(enc) {
      if (!enc) return "utf8";
      var retried;
      while (true) {
        switch (enc) {
          case "utf8":
          case "utf-8":
            return "utf8";
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return "utf16le";
          case "latin1":
          case "binary":
            return "latin1";
          case "base64":
          case "ascii":
          case "hex":
            return enc;
          default:
            if (retried) return;
            enc = ("" + enc).toLowerCase();
            retried = true;
        }
      }
    }
    function normalizeEncoding(enc) {
      var nenc = _normalizeEncoding(enc);
      if (typeof nenc !== "string" && (Buffer2.isEncoding === isEncoding || !isEncoding(enc))) throw new Error("Unknown encoding: " + enc);
      return nenc || enc;
    }
    exports2.StringDecoder = StringDecoder;
    function StringDecoder(encoding) {
      this.encoding = normalizeEncoding(encoding);
      var nb;
      switch (this.encoding) {
        case "utf16le":
          this.text = utf16Text;
          this.end = utf16End;
          nb = 4;
          break;
        case "utf8":
          this.fillLast = utf8FillLast;
          nb = 4;
          break;
        case "base64":
          this.text = base64Text;
          this.end = base64End;
          nb = 3;
          break;
        default:
          this.write = simpleWrite;
          this.end = simpleEnd;
          return;
      }
      this.lastNeed = 0;
      this.lastTotal = 0;
      this.lastChar = Buffer2.allocUnsafe(nb);
    }
    StringDecoder.prototype.write = function(buf) {
      if (buf.length === 0) return "";
      var r;
      var i;
      if (this.lastNeed) {
        r = this.fillLast(buf);
        if (r === void 0) return "";
        i = this.lastNeed;
        this.lastNeed = 0;
      } else {
        i = 0;
      }
      if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
      return r || "";
    };
    StringDecoder.prototype.end = utf8End;
    StringDecoder.prototype.text = utf8Text;
    StringDecoder.prototype.fillLast = function(buf) {
      if (this.lastNeed <= buf.length) {
        buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
        return this.lastChar.toString(this.encoding, 0, this.lastTotal);
      }
      buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
      this.lastNeed -= buf.length;
    };
    function utf8CheckByte(byte) {
      if (byte <= 127) return 0;
      else if (byte >> 5 === 6) return 2;
      else if (byte >> 4 === 14) return 3;
      else if (byte >> 3 === 30) return 4;
      return byte >> 6 === 2 ? -1 : -2;
    }
    function utf8CheckIncomplete(self2, buf, i) {
      var j = buf.length - 1;
      if (j < i) return 0;
      var nb = utf8CheckByte(buf[j]);
      if (nb >= 0) {
        if (nb > 0) self2.lastNeed = nb - 1;
        return nb;
      }
      if (--j < i || nb === -2) return 0;
      nb = utf8CheckByte(buf[j]);
      if (nb >= 0) {
        if (nb > 0) self2.lastNeed = nb - 2;
        return nb;
      }
      if (--j < i || nb === -2) return 0;
      nb = utf8CheckByte(buf[j]);
      if (nb >= 0) {
        if (nb > 0) {
          if (nb === 2) nb = 0;
          else self2.lastNeed = nb - 3;
        }
        return nb;
      }
      return 0;
    }
    function utf8CheckExtraBytes(self2, buf, p) {
      if ((buf[0] & 192) !== 128) {
        self2.lastNeed = 0;
        return "\uFFFD";
      }
      if (self2.lastNeed > 1 && buf.length > 1) {
        if ((buf[1] & 192) !== 128) {
          self2.lastNeed = 1;
          return "\uFFFD";
        }
        if (self2.lastNeed > 2 && buf.length > 2) {
          if ((buf[2] & 192) !== 128) {
            self2.lastNeed = 2;
            return "\uFFFD";
          }
        }
      }
    }
    function utf8FillLast(buf) {
      var p = this.lastTotal - this.lastNeed;
      var r = utf8CheckExtraBytes(this, buf, p);
      if (r !== void 0) return r;
      if (this.lastNeed <= buf.length) {
        buf.copy(this.lastChar, p, 0, this.lastNeed);
        return this.lastChar.toString(this.encoding, 0, this.lastTotal);
      }
      buf.copy(this.lastChar, p, 0, buf.length);
      this.lastNeed -= buf.length;
    }
    function utf8Text(buf, i) {
      var total = utf8CheckIncomplete(this, buf, i);
      if (!this.lastNeed) return buf.toString("utf8", i);
      this.lastTotal = total;
      var end = buf.length - (total - this.lastNeed);
      buf.copy(this.lastChar, 0, end);
      return buf.toString("utf8", i, end);
    }
    function utf8End(buf) {
      var r = buf && buf.length ? this.write(buf) : "";
      if (this.lastNeed) return r + "\uFFFD";
      return r;
    }
    function utf16Text(buf, i) {
      if ((buf.length - i) % 2 === 0) {
        var r = buf.toString("utf16le", i);
        if (r) {
          var c = r.charCodeAt(r.length - 1);
          if (c >= 55296 && c <= 56319) {
            this.lastNeed = 2;
            this.lastTotal = 4;
            this.lastChar[0] = buf[buf.length - 2];
            this.lastChar[1] = buf[buf.length - 1];
            return r.slice(0, -1);
          }
        }
        return r;
      }
      this.lastNeed = 1;
      this.lastTotal = 2;
      this.lastChar[0] = buf[buf.length - 1];
      return buf.toString("utf16le", i, buf.length - 1);
    }
    function utf16End(buf) {
      var r = buf && buf.length ? this.write(buf) : "";
      if (this.lastNeed) {
        var end = this.lastTotal - this.lastNeed;
        return r + this.lastChar.toString("utf16le", 0, end);
      }
      return r;
    }
    function base64Text(buf, i) {
      var n = (buf.length - i) % 3;
      if (n === 0) return buf.toString("base64", i);
      this.lastNeed = 3 - n;
      this.lastTotal = 3;
      if (n === 1) {
        this.lastChar[0] = buf[buf.length - 1];
      } else {
        this.lastChar[0] = buf[buf.length - 2];
        this.lastChar[1] = buf[buf.length - 1];
      }
      return buf.toString("base64", i, buf.length - n);
    }
    function base64End(buf) {
      var r = buf && buf.length ? this.write(buf) : "";
      if (this.lastNeed) return r + this.lastChar.toString("base64", 0, 3 - this.lastNeed);
      return r;
    }
    function simpleWrite(buf) {
      return buf.toString(this.encoding);
    }
    function simpleEnd(buf) {
      return buf && buf.length ? this.write(buf) : "";
    }
  }
});

// node_modules/simple-websocket/node_modules/readable-stream/lib/_stream_readable.js
var require_stream_readable3 = __commonJS({
  "node_modules/simple-websocket/node_modules/readable-stream/lib/_stream_readable.js"(exports2, module2) {
    "use strict";
    var pna = require_process_nextick_args();
    module2.exports = Readable;
    var isArray = require_isarray3();
    var Duplex;
    Readable.ReadableState = ReadableState;
    var EE = require("events").EventEmitter;
    var EElistenerCount = function(emitter, type) {
      return emitter.listeners(type).length;
    };
    var Stream = require_stream2();
    var Buffer2 = require_safe_buffer2().Buffer;
    var OurUint8Array = (typeof global !== "undefined" ? global : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {
    };
    function _uint8ArrayToBuffer(chunk) {
      return Buffer2.from(chunk);
    }
    function _isUint8Array(obj) {
      return Buffer2.isBuffer(obj) || obj instanceof OurUint8Array;
    }
    var util = Object.create(require_util());
    util.inherits = require_inherits();
    var debugUtil = require("util");
    var debug = void 0;
    if (debugUtil && debugUtil.debuglog) {
      debug = debugUtil.debuglog("stream");
    } else {
      debug = function() {
      };
    }
    var BufferList = require_BufferList2();
    var destroyImpl = require_destroy2();
    var StringDecoder;
    util.inherits(Readable, Stream);
    var kProxyEvents = ["error", "close", "destroy", "pause", "resume"];
    function prependListener(emitter, event, fn) {
      if (typeof emitter.prependListener === "function") return emitter.prependListener(event, fn);
      if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);
      else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);
      else emitter._events[event] = [fn, emitter._events[event]];
    }
    function ReadableState(options, stream) {
      Duplex = Duplex || require_stream_duplex3();
      options = options || {};
      var isDuplex = stream instanceof Duplex;
      this.objectMode = !!options.objectMode;
      if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;
      var hwm = options.highWaterMark;
      var readableHwm = options.readableHighWaterMark;
      var defaultHwm = this.objectMode ? 16 : 16 * 1024;
      if (hwm || hwm === 0) this.highWaterMark = hwm;
      else if (isDuplex && (readableHwm || readableHwm === 0)) this.highWaterMark = readableHwm;
      else this.highWaterMark = defaultHwm;
      this.highWaterMark = Math.floor(this.highWaterMark);
      this.buffer = new BufferList();
      this.length = 0;
      this.pipes = null;
      this.pipesCount = 0;
      this.flowing = null;
      this.ended = false;
      this.endEmitted = false;
      this.reading = false;
      this.sync = true;
      this.needReadable = false;
      this.emittedReadable = false;
      this.readableListening = false;
      this.resumeScheduled = false;
      this.destroyed = false;
      this.defaultEncoding = options.defaultEncoding || "utf8";
      this.awaitDrain = 0;
      this.readingMore = false;
      this.decoder = null;
      this.encoding = null;
      if (options.encoding) {
        if (!StringDecoder) StringDecoder = require_string_decoder3().StringDecoder;
        this.decoder = new StringDecoder(options.encoding);
        this.encoding = options.encoding;
      }
    }
    function Readable(options) {
      Duplex = Duplex || require_stream_duplex3();
      if (!(this instanceof Readable)) return new Readable(options);
      this._readableState = new ReadableState(options, this);
      this.readable = true;
      if (options) {
        if (typeof options.read === "function") this._read = options.read;
        if (typeof options.destroy === "function") this._destroy = options.destroy;
      }
      Stream.call(this);
    }
    Object.defineProperty(Readable.prototype, "destroyed", {
      get: function() {
        if (this._readableState === void 0) {
          return false;
        }
        return this._readableState.destroyed;
      },
      set: function(value) {
        if (!this._readableState) {
          return;
        }
        this._readableState.destroyed = value;
      }
    });
    Readable.prototype.destroy = destroyImpl.destroy;
    Readable.prototype._undestroy = destroyImpl.undestroy;
    Readable.prototype._destroy = function(err, cb) {
      this.push(null);
      cb(err);
    };
    Readable.prototype.push = function(chunk, encoding) {
      var state = this._readableState;
      var skipChunkCheck;
      if (!state.objectMode) {
        if (typeof chunk === "string") {
          encoding = encoding || state.defaultEncoding;
          if (encoding !== state.encoding) {
            chunk = Buffer2.from(chunk, encoding);
            encoding = "";
          }
          skipChunkCheck = true;
        }
      } else {
        skipChunkCheck = true;
      }
      return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
    };
    Readable.prototype.unshift = function(chunk) {
      return readableAddChunk(this, chunk, null, true, false);
    };
    function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
      var state = stream._readableState;
      if (chunk === null) {
        state.reading = false;
        onEofChunk(stream, state);
      } else {
        var er;
        if (!skipChunkCheck) er = chunkInvalid(state, chunk);
        if (er) {
          stream.emit("error", er);
        } else if (state.objectMode || chunk && chunk.length > 0) {
          if (typeof chunk !== "string" && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer2.prototype) {
            chunk = _uint8ArrayToBuffer(chunk);
          }
          if (addToFront) {
            if (state.endEmitted) stream.emit("error", new Error("stream.unshift() after end event"));
            else addChunk(stream, state, chunk, true);
          } else if (state.ended) {
            stream.emit("error", new Error("stream.push() after EOF"));
          } else {
            state.reading = false;
            if (state.decoder && !encoding) {
              chunk = state.decoder.write(chunk);
              if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);
              else maybeReadMore(stream, state);
            } else {
              addChunk(stream, state, chunk, false);
            }
          }
        } else if (!addToFront) {
          state.reading = false;
        }
      }
      return needMoreData(state);
    }
    function addChunk(stream, state, chunk, addToFront) {
      if (state.flowing && state.length === 0 && !state.sync) {
        stream.emit("data", chunk);
        stream.read(0);
      } else {
        state.length += state.objectMode ? 1 : chunk.length;
        if (addToFront) state.buffer.unshift(chunk);
        else state.buffer.push(chunk);
        if (state.needReadable) emitReadable(stream);
      }
      maybeReadMore(stream, state);
    }
    function chunkInvalid(state, chunk) {
      var er;
      if (!_isUint8Array(chunk) && typeof chunk !== "string" && chunk !== void 0 && !state.objectMode) {
        er = new TypeError("Invalid non-string/buffer chunk");
      }
      return er;
    }
    function needMoreData(state) {
      return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
    }
    Readable.prototype.isPaused = function() {
      return this._readableState.flowing === false;
    };
    Readable.prototype.setEncoding = function(enc) {
      if (!StringDecoder) StringDecoder = require_string_decoder3().StringDecoder;
      this._readableState.decoder = new StringDecoder(enc);
      this._readableState.encoding = enc;
      return this;
    };
    var MAX_HWM = 8388608;
    function computeNewHighWaterMark(n) {
      if (n >= MAX_HWM) {
        n = MAX_HWM;
      } else {
        n--;
        n |= n >>> 1;
        n |= n >>> 2;
        n |= n >>> 4;
        n |= n >>> 8;
        n |= n >>> 16;
        n++;
      }
      return n;
    }
    function howMuchToRead(n, state) {
      if (n <= 0 || state.length === 0 && state.ended) return 0;
      if (state.objectMode) return 1;
      if (n !== n) {
        if (state.flowing && state.length) return state.buffer.head.data.length;
        else return state.length;
      }
      if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
      if (n <= state.length) return n;
      if (!state.ended) {
        state.needReadable = true;
        return 0;
      }
      return state.length;
    }
    Readable.prototype.read = function(n) {
      debug("read", n);
      n = parseInt(n, 10);
      var state = this._readableState;
      var nOrig = n;
      if (n !== 0) state.emittedReadable = false;
      if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
        debug("read: emitReadable", state.length, state.ended);
        if (state.length === 0 && state.ended) endReadable(this);
        else emitReadable(this);
        return null;
      }
      n = howMuchToRead(n, state);
      if (n === 0 && state.ended) {
        if (state.length === 0) endReadable(this);
        return null;
      }
      var doRead = state.needReadable;
      debug("need readable", doRead);
      if (state.length === 0 || state.length - n < state.highWaterMark) {
        doRead = true;
        debug("length less than watermark", doRead);
      }
      if (state.ended || state.reading) {
        doRead = false;
        debug("reading or ended", doRead);
      } else if (doRead) {
        debug("do read");
        state.reading = true;
        state.sync = true;
        if (state.length === 0) state.needReadable = true;
        this._read(state.highWaterMark);
        state.sync = false;
        if (!state.reading) n = howMuchToRead(nOrig, state);
      }
      var ret;
      if (n > 0) ret = fromList(n, state);
      else ret = null;
      if (ret === null) {
        state.needReadable = true;
        n = 0;
      } else {
        state.length -= n;
      }
      if (state.length === 0) {
        if (!state.ended) state.needReadable = true;
        if (nOrig !== n && state.ended) endReadable(this);
      }
      if (ret !== null) this.emit("data", ret);
      return ret;
    };
    function onEofChunk(stream, state) {
      if (state.ended) return;
      if (state.decoder) {
        var chunk = state.decoder.end();
        if (chunk && chunk.length) {
          state.buffer.push(chunk);
          state.length += state.objectMode ? 1 : chunk.length;
        }
      }
      state.ended = true;
      emitReadable(stream);
    }
    function emitReadable(stream) {
      var state = stream._readableState;
      state.needReadable = false;
      if (!state.emittedReadable) {
        debug("emitReadable", state.flowing);
        state.emittedReadable = true;
        if (state.sync) pna.nextTick(emitReadable_, stream);
        else emitReadable_(stream);
      }
    }
    function emitReadable_(stream) {
      debug("emit readable");
      stream.emit("readable");
      flow(stream);
    }
    function maybeReadMore(stream, state) {
      if (!state.readingMore) {
        state.readingMore = true;
        pna.nextTick(maybeReadMore_, stream, state);
      }
    }
    function maybeReadMore_(stream, state) {
      var len = state.length;
      while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
        debug("maybeReadMore read 0");
        stream.read(0);
        if (len === state.length)
          break;
        else len = state.length;
      }
      state.readingMore = false;
    }
    Readable.prototype._read = function(n) {
      this.emit("error", new Error("_read() is not implemented"));
    };
    Readable.prototype.pipe = function(dest, pipeOpts) {
      var src = this;
      var state = this._readableState;
      switch (state.pipesCount) {
        case 0:
          state.pipes = dest;
          break;
        case 1:
          state.pipes = [state.pipes, dest];
          break;
        default:
          state.pipes.push(dest);
          break;
      }
      state.pipesCount += 1;
      debug("pipe count=%d opts=%j", state.pipesCount, pipeOpts);
      var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;
      var endFn = doEnd ? onend : unpipe;
      if (state.endEmitted) pna.nextTick(endFn);
      else src.once("end", endFn);
      dest.on("unpipe", onunpipe);
      function onunpipe(readable, unpipeInfo) {
        debug("onunpipe");
        if (readable === src) {
          if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
            unpipeInfo.hasUnpiped = true;
            cleanup();
          }
        }
      }
      function onend() {
        debug("onend");
        dest.end();
      }
      var ondrain = pipeOnDrain(src);
      dest.on("drain", ondrain);
      var cleanedUp = false;
      function cleanup() {
        debug("cleanup");
        dest.removeListener("close", onclose);
        dest.removeListener("finish", onfinish);
        dest.removeListener("drain", ondrain);
        dest.removeListener("error", onerror);
        dest.removeListener("unpipe", onunpipe);
        src.removeListener("end", onend);
        src.removeListener("end", unpipe);
        src.removeListener("data", ondata);
        cleanedUp = true;
        if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
      }
      var increasedAwaitDrain = false;
      src.on("data", ondata);
      function ondata(chunk) {
        debug("ondata");
        increasedAwaitDrain = false;
        var ret = dest.write(chunk);
        if (false === ret && !increasedAwaitDrain) {
          if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
            debug("false write response, pause", state.awaitDrain);
            state.awaitDrain++;
            increasedAwaitDrain = true;
          }
          src.pause();
        }
      }
      function onerror(er) {
        debug("onerror", er);
        unpipe();
        dest.removeListener("error", onerror);
        if (EElistenerCount(dest, "error") === 0) dest.emit("error", er);
      }
      prependListener(dest, "error", onerror);
      function onclose() {
        dest.removeListener("finish", onfinish);
        unpipe();
      }
      dest.once("close", onclose);
      function onfinish() {
        debug("onfinish");
        dest.removeListener("close", onclose);
        unpipe();
      }
      dest.once("finish", onfinish);
      function unpipe() {
        debug("unpipe");
        src.unpipe(dest);
      }
      dest.emit("pipe", src);
      if (!state.flowing) {
        debug("pipe resume");
        src.resume();
      }
      return dest;
    };
    function pipeOnDrain(src) {
      return function() {
        var state = src._readableState;
        debug("pipeOnDrain", state.awaitDrain);
        if (state.awaitDrain) state.awaitDrain--;
        if (state.awaitDrain === 0 && EElistenerCount(src, "data")) {
          state.flowing = true;
          flow(src);
        }
      };
    }
    Readable.prototype.unpipe = function(dest) {
      var state = this._readableState;
      var unpipeInfo = { hasUnpiped: false };
      if (state.pipesCount === 0) return this;
      if (state.pipesCount === 1) {
        if (dest && dest !== state.pipes) return this;
        if (!dest) dest = state.pipes;
        state.pipes = null;
        state.pipesCount = 0;
        state.flowing = false;
        if (dest) dest.emit("unpipe", this, unpipeInfo);
        return this;
      }
      if (!dest) {
        var dests = state.pipes;
        var len = state.pipesCount;
        state.pipes = null;
        state.pipesCount = 0;
        state.flowing = false;
        for (var i = 0; i < len; i++) {
          dests[i].emit("unpipe", this, { hasUnpiped: false });
        }
        return this;
      }
      var index = indexOf(state.pipes, dest);
      if (index === -1) return this;
      state.pipes.splice(index, 1);
      state.pipesCount -= 1;
      if (state.pipesCount === 1) state.pipes = state.pipes[0];
      dest.emit("unpipe", this, unpipeInfo);
      return this;
    };
    Readable.prototype.on = function(ev, fn) {
      var res = Stream.prototype.on.call(this, ev, fn);
      if (ev === "data") {
        if (this._readableState.flowing !== false) this.resume();
      } else if (ev === "readable") {
        var state = this._readableState;
        if (!state.endEmitted && !state.readableListening) {
          state.readableListening = state.needReadable = true;
          state.emittedReadable = false;
          if (!state.reading) {
            pna.nextTick(nReadingNextTick, this);
          } else if (state.length) {
            emitReadable(this);
          }
        }
      }
      return res;
    };
    Readable.prototype.addListener = Readable.prototype.on;
    function nReadingNextTick(self2) {
      debug("readable nexttick read 0");
      self2.read(0);
    }
    Readable.prototype.resume = function() {
      var state = this._readableState;
      if (!state.flowing) {
        debug("resume");
        state.flowing = true;
        resume(this, state);
      }
      return this;
    };
    function resume(stream, state) {
      if (!state.resumeScheduled) {
        state.resumeScheduled = true;
        pna.nextTick(resume_, stream, state);
      }
    }
    function resume_(stream, state) {
      if (!state.reading) {
        debug("resume read 0");
        stream.read(0);
      }
      state.resumeScheduled = false;
      state.awaitDrain = 0;
      stream.emit("resume");
      flow(stream);
      if (state.flowing && !state.reading) stream.read(0);
    }
    Readable.prototype.pause = function() {
      debug("call pause flowing=%j", this._readableState.flowing);
      if (false !== this._readableState.flowing) {
        debug("pause");
        this._readableState.flowing = false;
        this.emit("pause");
      }
      return this;
    };
    function flow(stream) {
      var state = stream._readableState;
      debug("flow", state.flowing);
      while (state.flowing && stream.read() !== null) {
      }
    }
    Readable.prototype.wrap = function(stream) {
      var _this = this;
      var state = this._readableState;
      var paused = false;
      stream.on("end", function() {
        debug("wrapped end");
        if (state.decoder && !state.ended) {
          var chunk = state.decoder.end();
          if (chunk && chunk.length) _this.push(chunk);
        }
        _this.push(null);
      });
      stream.on("data", function(chunk) {
        debug("wrapped data");
        if (state.decoder) chunk = state.decoder.write(chunk);
        if (state.objectMode && (chunk === null || chunk === void 0)) return;
        else if (!state.objectMode && (!chunk || !chunk.length)) return;
        var ret = _this.push(chunk);
        if (!ret) {
          paused = true;
          stream.pause();
        }
      });
      for (var i in stream) {
        if (this[i] === void 0 && typeof stream[i] === "function") {
          this[i] = /* @__PURE__ */ (function(method) {
            return function() {
              return stream[method].apply(stream, arguments);
            };
          })(i);
        }
      }
      for (var n = 0; n < kProxyEvents.length; n++) {
        stream.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
      }
      this._read = function(n2) {
        debug("wrapped _read", n2);
        if (paused) {
          paused = false;
          stream.resume();
        }
      };
      return this;
    };
    Object.defineProperty(Readable.prototype, "readableHighWaterMark", {
      // making it explicit this property is not enumerable
      // because otherwise some prototype manipulation in
      // userland will fail
      enumerable: false,
      get: function() {
        return this._readableState.highWaterMark;
      }
    });
    Readable._fromList = fromList;
    function fromList(n, state) {
      if (state.length === 0) return null;
      var ret;
      if (state.objectMode) ret = state.buffer.shift();
      else if (!n || n >= state.length) {
        if (state.decoder) ret = state.buffer.join("");
        else if (state.buffer.length === 1) ret = state.buffer.head.data;
        else ret = state.buffer.concat(state.length);
        state.buffer.clear();
      } else {
        ret = fromListPartial(n, state.buffer, state.decoder);
      }
      return ret;
    }
    function fromListPartial(n, list, hasStrings) {
      var ret;
      if (n < list.head.data.length) {
        ret = list.head.data.slice(0, n);
        list.head.data = list.head.data.slice(n);
      } else if (n === list.head.data.length) {
        ret = list.shift();
      } else {
        ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
      }
      return ret;
    }
    function copyFromBufferString(n, list) {
      var p = list.head;
      var c = 1;
      var ret = p.data;
      n -= ret.length;
      while (p = p.next) {
        var str = p.data;
        var nb = n > str.length ? str.length : n;
        if (nb === str.length) ret += str;
        else ret += str.slice(0, n);
        n -= nb;
        if (n === 0) {
          if (nb === str.length) {
            ++c;
            if (p.next) list.head = p.next;
            else list.head = list.tail = null;
          } else {
            list.head = p;
            p.data = str.slice(nb);
          }
          break;
        }
        ++c;
      }
      list.length -= c;
      return ret;
    }
    function copyFromBuffer(n, list) {
      var ret = Buffer2.allocUnsafe(n);
      var p = list.head;
      var c = 1;
      p.data.copy(ret);
      n -= p.data.length;
      while (p = p.next) {
        var buf = p.data;
        var nb = n > buf.length ? buf.length : n;
        buf.copy(ret, ret.length - n, 0, nb);
        n -= nb;
        if (n === 0) {
          if (nb === buf.length) {
            ++c;
            if (p.next) list.head = p.next;
            else list.head = list.tail = null;
          } else {
            list.head = p;
            p.data = buf.slice(nb);
          }
          break;
        }
        ++c;
      }
      list.length -= c;
      return ret;
    }
    function endReadable(stream) {
      var state = stream._readableState;
      if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');
      if (!state.endEmitted) {
        state.ended = true;
        pna.nextTick(endReadableNT, state, stream);
      }
    }
    function endReadableNT(state, stream) {
      if (!state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.readable = false;
        stream.emit("end");
      }
    }
    function indexOf(xs, x) {
      for (var i = 0, l = xs.length; i < l; i++) {
        if (xs[i] === x) return i;
      }
      return -1;
    }
  }
});

// node_modules/simple-websocket/node_modules/readable-stream/lib/_stream_transform.js
var require_stream_transform3 = __commonJS({
  "node_modules/simple-websocket/node_modules/readable-stream/lib/_stream_transform.js"(exports2, module2) {
    "use strict";
    module2.exports = Transform;
    var Duplex = require_stream_duplex3();
    var util = Object.create(require_util());
    util.inherits = require_inherits();
    util.inherits(Transform, Duplex);
    function afterTransform(er, data) {
      var ts = this._transformState;
      ts.transforming = false;
      var cb = ts.writecb;
      if (!cb) {
        return this.emit("error", new Error("write callback called multiple times"));
      }
      ts.writechunk = null;
      ts.writecb = null;
      if (data != null)
        this.push(data);
      cb(er);
      var rs = this._readableState;
      rs.reading = false;
      if (rs.needReadable || rs.length < rs.highWaterMark) {
        this._read(rs.highWaterMark);
      }
    }
    function Transform(options) {
      if (!(this instanceof Transform)) return new Transform(options);
      Duplex.call(this, options);
      this._transformState = {
        afterTransform: afterTransform.bind(this),
        needTransform: false,
        transforming: false,
        writecb: null,
        writechunk: null,
        writeencoding: null
      };
      this._readableState.needReadable = true;
      this._readableState.sync = false;
      if (options) {
        if (typeof options.transform === "function") this._transform = options.transform;
        if (typeof options.flush === "function") this._flush = options.flush;
      }
      this.on("prefinish", prefinish);
    }
    function prefinish() {
      var _this = this;
      if (typeof this._flush === "function") {
        this._flush(function(er, data) {
          done(_this, er, data);
        });
      } else {
        done(this, null, null);
      }
    }
    Transform.prototype.push = function(chunk, encoding) {
      this._transformState.needTransform = false;
      return Duplex.prototype.push.call(this, chunk, encoding);
    };
    Transform.prototype._transform = function(chunk, encoding, cb) {
      throw new Error("_transform() is not implemented");
    };
    Transform.prototype._write = function(chunk, encoding, cb) {
      var ts = this._transformState;
      ts.writecb = cb;
      ts.writechunk = chunk;
      ts.writeencoding = encoding;
      if (!ts.transforming) {
        var rs = this._readableState;
        if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
      }
    };
    Transform.prototype._read = function(n) {
      var ts = this._transformState;
      if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
        ts.transforming = true;
        this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
      } else {
        ts.needTransform = true;
      }
    };
    Transform.prototype._destroy = function(err, cb) {
      var _this2 = this;
      Duplex.prototype._destroy.call(this, err, function(err2) {
        cb(err2);
        _this2.emit("close");
      });
    };
    function done(stream, er, data) {
      if (er) return stream.emit("error", er);
      if (data != null)
        stream.push(data);
      if (stream._writableState.length) throw new Error("Calling transform done when ws.length != 0");
      if (stream._transformState.transforming) throw new Error("Calling transform done when still transforming");
      return stream.push(null);
    }
  }
});

// node_modules/simple-websocket/node_modules/readable-stream/lib/_stream_passthrough.js
var require_stream_passthrough3 = __commonJS({
  "node_modules/simple-websocket/node_modules/readable-stream/lib/_stream_passthrough.js"(exports2, module2) {
    "use strict";
    module2.exports = PassThrough;
    var Transform = require_stream_transform3();
    var util = Object.create(require_util());
    util.inherits = require_inherits();
    util.inherits(PassThrough, Transform);
    function PassThrough(options) {
      if (!(this instanceof PassThrough)) return new PassThrough(options);
      Transform.call(this, options);
    }
    PassThrough.prototype._transform = function(chunk, encoding, cb) {
      cb(null, chunk);
    };
  }
});

// node_modules/simple-websocket/node_modules/readable-stream/readable.js
var require_readable3 = __commonJS({
  "node_modules/simple-websocket/node_modules/readable-stream/readable.js"(exports2, module2) {
    var Stream = require("stream");
    if (process.env.READABLE_STREAM === "disable" && Stream) {
      module2.exports = Stream;
      exports2 = module2.exports = Stream.Readable;
      exports2.Readable = Stream.Readable;
      exports2.Writable = Stream.Writable;
      exports2.Duplex = Stream.Duplex;
      exports2.Transform = Stream.Transform;
      exports2.PassThrough = Stream.PassThrough;
      exports2.Stream = Stream;
    } else {
      exports2 = module2.exports = require_stream_readable3();
      exports2.Stream = Stream || exports2;
      exports2.Readable = exports2;
      exports2.Writable = require_stream_writable3();
      exports2.Duplex = require_stream_duplex3();
      exports2.Transform = require_stream_transform3();
      exports2.PassThrough = require_stream_passthrough3();
    }
  }
});

// node_modules/simple-websocket/node_modules/ultron/index.js
var require_ultron = __commonJS({
  "node_modules/simple-websocket/node_modules/ultron/index.js"(exports2, module2) {
    "use strict";
    var has = Object.prototype.hasOwnProperty;
    var id = 0;
    function Ultron(ee) {
      if (!(this instanceof Ultron)) return new Ultron(ee);
      this.id = id++;
      this.ee = ee;
    }
    Ultron.prototype.on = function on(event, fn, context) {
      fn.__ultron = this.id;
      this.ee.on(event, fn, context);
      return this;
    };
    Ultron.prototype.once = function once(event, fn, context) {
      fn.__ultron = this.id;
      this.ee.once(event, fn, context);
      return this;
    };
    Ultron.prototype.remove = function remove() {
      var args = arguments, ee = this.ee, event;
      if (args.length === 1 && "string" === typeof args[0]) {
        args = args[0].split(/[, ]+/);
      } else if (!args.length) {
        if (ee.eventNames) {
          args = ee.eventNames();
        } else if (ee._events) {
          args = [];
          for (event in ee._events) {
            if (has.call(ee._events, event)) args.push(event);
          }
          if (Object.getOwnPropertySymbols) {
            args = args.concat(Object.getOwnPropertySymbols(ee._events));
          }
        }
      }
      for (var i = 0; i < args.length; i++) {
        var listeners = ee.listeners(args[i]);
        for (var j = 0; j < listeners.length; j++) {
          event = listeners[j];
          if (event.listener) {
            if (event.listener.__ultron !== this.id) continue;
          } else if (event.__ultron !== this.id) {
            continue;
          }
          ee.removeListener(args[i], event);
        }
      }
      return this;
    };
    Ultron.prototype.destroy = function destroy() {
      if (!this.ee) return false;
      this.remove();
      this.ee = null;
      return true;
    };
    module2.exports = Ultron;
  }
});

// node_modules/simple-websocket/node_modules/ws/node_modules/safe-buffer/index.js
var require_safe_buffer3 = __commonJS({
  "node_modules/simple-websocket/node_modules/ws/node_modules/safe-buffer/index.js"(exports2, module2) {
    var buffer = require("buffer");
    if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
      module2.exports = buffer;
    } else {
      Object.keys(buffer).forEach(function(prop) {
        exports2[prop] = buffer[prop];
      });
      exports2.Buffer = SafeBuffer;
    }
    function SafeBuffer(arg, encodingOrOffset, length) {
      return Buffer(arg, encodingOrOffset, length);
    }
    Object.keys(Buffer).forEach(function(prop) {
      SafeBuffer[prop] = Buffer[prop];
    });
    SafeBuffer.from = function(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        throw new TypeError("Argument must not be a number");
      }
      return Buffer(arg, encodingOrOffset, length);
    };
    SafeBuffer.alloc = function(size, fill, encoding) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      var buf = Buffer(size);
      if (fill !== void 0) {
        if (typeof encoding === "string") {
          buf.fill(fill, encoding);
        } else {
          buf.fill(fill);
        }
      } else {
        buf.fill(0);
      }
      return buf;
    };
    SafeBuffer.allocUnsafe = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return Buffer(size);
    };
    SafeBuffer.allocUnsafeSlow = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return buffer.SlowBuffer(size);
    };
  }
});

// node_modules/simple-websocket/node_modules/ws/lib/BufferUtil.js
var require_BufferUtil = __commonJS({
  "node_modules/simple-websocket/node_modules/ws/lib/BufferUtil.js"(exports2, module2) {
    "use strict";
    var safeBuffer = require_safe_buffer3();
    var Buffer2 = safeBuffer.Buffer;
    var concat = (list, totalLength) => {
      const target = Buffer2.allocUnsafe(totalLength);
      var offset = 0;
      for (var i = 0; i < list.length; i++) {
        const buf = list[i];
        buf.copy(target, offset);
        offset += buf.length;
      }
      return target;
    };
    try {
      const bufferUtil = require("bufferutil");
      module2.exports = Object.assign({ concat }, bufferUtil.BufferUtil || bufferUtil);
    } catch (e) {
      const mask = (source, mask2, output, offset, length) => {
        for (var i = 0; i < length; i++) {
          output[offset + i] = source[i] ^ mask2[i & 3];
        }
      };
      const unmask = (buffer, mask2) => {
        const length = buffer.length;
        for (var i = 0; i < length; i++) {
          buffer[i] ^= mask2[i & 3];
        }
      };
      module2.exports = { concat, mask, unmask };
    }
  }
});

// node_modules/simple-websocket/node_modules/ws/lib/PerMessageDeflate.js
var require_PerMessageDeflate = __commonJS({
  "node_modules/simple-websocket/node_modules/ws/lib/PerMessageDeflate.js"(exports2, module2) {
    "use strict";
    var safeBuffer = require_safe_buffer3();
    var zlib = require("zlib");
    var bufferUtil = require_BufferUtil();
    var Buffer2 = safeBuffer.Buffer;
    var AVAILABLE_WINDOW_BITS = [8, 9, 10, 11, 12, 13, 14, 15];
    var TRAILER = Buffer2.from([0, 0, 255, 255]);
    var EMPTY_BLOCK = Buffer2.from([0]);
    var DEFAULT_WINDOW_BITS = 15;
    var DEFAULT_MEM_LEVEL = 8;
    var PerMessageDeflate = class {
      constructor(options, isServer, maxPayload) {
        this._options = options || {};
        this._isServer = !!isServer;
        this._inflate = null;
        this._deflate = null;
        this.params = null;
        this._maxPayload = maxPayload || 0;
        this.threshold = this._options.threshold === void 0 ? 1024 : this._options.threshold;
      }
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create extension parameters offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept extension offer.
       *
       * @param {Array} paramsList Extension parameters
       * @return {Object} Accepted configuration
       * @public
       */
      accept(paramsList) {
        paramsList = this.normalizeParams(paramsList);
        var params;
        if (this._isServer) {
          params = this.acceptAsServer(paramsList);
        } else {
          params = this.acceptAsClient(paramsList);
        }
        this.params = params;
        return params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          if (this._inflate.writeInProgress) {
            this._inflate.pendingClose = true;
          } else {
            this._inflate.close();
            this._inflate = null;
          }
        }
        if (this._deflate) {
          if (this._deflate.writeInProgress) {
            this._deflate.pendingClose = true;
          } else {
            this._deflate.close();
            this._deflate = null;
          }
        }
      }
      /**
       * Accept extension offer from client.
       *
       * @param {Array} paramsList Extension parameters
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(paramsList) {
        const accepted = {};
        const result = paramsList.some((params) => {
          if (this._options.serverNoContextTakeover === false && params.server_no_context_takeover || this._options.serverMaxWindowBits === false && params.server_max_window_bits || typeof this._options.serverMaxWindowBits === "number" && typeof params.server_max_window_bits === "number" && this._options.serverMaxWindowBits > params.server_max_window_bits || typeof this._options.clientMaxWindowBits === "number" && !params.client_max_window_bits) {
            return;
          }
          if (this._options.serverNoContextTakeover || params.server_no_context_takeover) {
            accepted.server_no_context_takeover = true;
          }
          if (this._options.clientNoContextTakeover) {
            accepted.client_no_context_takeover = true;
          }
          if (this._options.clientNoContextTakeover !== false && params.client_no_context_takeover) {
            accepted.client_no_context_takeover = true;
          }
          if (typeof this._options.serverMaxWindowBits === "number") {
            accepted.server_max_window_bits = this._options.serverMaxWindowBits;
          } else if (typeof params.server_max_window_bits === "number") {
            accepted.server_max_window_bits = params.server_max_window_bits;
          }
          if (typeof this._options.clientMaxWindowBits === "number") {
            accepted.client_max_window_bits = this._options.clientMaxWindowBits;
          } else if (this._options.clientMaxWindowBits !== false && typeof params.client_max_window_bits === "number") {
            accepted.client_max_window_bits = params.client_max_window_bits;
          }
          return true;
        });
        if (!result) throw new Error(`Doesn't support the offered configuration`);
        return accepted;
      }
      /**
       * Accept extension response from server.
       *
       * @param {Array} paramsList Extension parameters
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(paramsList) {
        const params = paramsList[0];
        if (this._options.clientNoContextTakeover != null) {
          if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
            throw new Error('Invalid value for "client_no_context_takeover"');
          }
        }
        if (this._options.clientMaxWindowBits != null) {
          if (this._options.clientMaxWindowBits === false && params.client_max_window_bits) {
            throw new Error('Invalid value for "client_max_window_bits"');
          }
          if (typeof this._options.clientMaxWindowBits === "number" && (!params.client_max_window_bits || params.client_max_window_bits > this._options.clientMaxWindowBits)) {
            throw new Error('Invalid value for "client_max_window_bits"');
          }
        }
        return params;
      }
      /**
       * Normalize extensions parameters.
       *
       * @param {Array} paramsList Extension parameters
       * @return {Array} Normalized extensions parameters
       * @private
       */
      normalizeParams(paramsList) {
        return paramsList.map((params) => {
          Object.keys(params).forEach((key) => {
            var value = params[key];
            if (value.length > 1) {
              throw new Error(`Multiple extension parameters for ${key}`);
            }
            value = value[0];
            switch (key) {
              case "server_no_context_takeover":
              case "client_no_context_takeover":
                if (value !== true) {
                  throw new Error(`invalid extension parameter value for ${key} (${value})`);
                }
                params[key] = true;
                break;
              case "server_max_window_bits":
              case "client_max_window_bits":
                if (typeof value === "string") {
                  value = parseInt(value, 10);
                  if (!~AVAILABLE_WINDOW_BITS.indexOf(value)) {
                    throw new Error(`invalid extension parameter value for ${key} (${value})`);
                  }
                }
                if (!this._isServer && value === true) {
                  throw new Error(`Missing extension parameter value for ${key}`);
                }
                params[key] = value;
                break;
              default:
                throw new Error(`Not defined extension parameter (${key})`);
            }
          });
          return params;
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const maxWindowBits = this.params[`${endpoint}_max_window_bits`];
          this._inflate = zlib.createInflateRaw({
            windowBits: typeof maxWindowBits === "number" ? maxWindowBits : DEFAULT_WINDOW_BITS
          });
        }
        this._inflate.writeInProgress = true;
        var totalLength = 0;
        const buffers = [];
        var err;
        const onData = (data2) => {
          totalLength += data2.length;
          if (this._maxPayload < 1 || totalLength <= this._maxPayload) {
            return buffers.push(data2);
          }
          err = new Error("max payload size exceeded");
          err.closeCode = 1009;
          this._inflate.reset();
        };
        const onError = (err2) => {
          cleanup();
          callback(err2);
        };
        const cleanup = () => {
          if (!this._inflate) return;
          this._inflate.removeListener("error", onError);
          this._inflate.removeListener("data", onData);
          this._inflate.writeInProgress = false;
          if (fin && this.params[`${endpoint}_no_context_takeover`] || this._inflate.pendingClose) {
            this._inflate.close();
            this._inflate = null;
          }
        };
        this._inflate.on("error", onError).on("data", onData);
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          cleanup();
          if (err) callback(err);
          else callback(null, bufferUtil.concat(buffers, totalLength));
        });
      }
      /**
       * Compress data.
       *
       * @param {Buffer} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        if (!data || data.length === 0) {
          process.nextTick(callback, null, EMPTY_BLOCK);
          return;
        }
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const maxWindowBits = this.params[`${endpoint}_max_window_bits`];
          this._deflate = zlib.createDeflateRaw({
            flush: zlib.Z_SYNC_FLUSH,
            windowBits: typeof maxWindowBits === "number" ? maxWindowBits : DEFAULT_WINDOW_BITS,
            memLevel: this._options.memLevel || DEFAULT_MEM_LEVEL
          });
        }
        this._deflate.writeInProgress = true;
        var totalLength = 0;
        const buffers = [];
        const onData = (data2) => {
          totalLength += data2.length;
          buffers.push(data2);
        };
        const onError = (err) => {
          cleanup();
          callback(err);
        };
        const cleanup = () => {
          if (!this._deflate) return;
          this._deflate.removeListener("error", onError);
          this._deflate.removeListener("data", onData);
          this._deflate.writeInProgress = false;
          if (fin && this.params[`${endpoint}_no_context_takeover`] || this._deflate.pendingClose) {
            this._deflate.close();
            this._deflate = null;
          }
        };
        this._deflate.on("error", onError).on("data", onData);
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          cleanup();
          var data2 = bufferUtil.concat(buffers, totalLength);
          if (fin) data2 = data2.slice(0, data2.length - 4);
          callback(null, data2);
        });
      }
    };
    module2.exports = PerMessageDeflate;
  }
});

// node_modules/simple-websocket/node_modules/ws/lib/EventTarget.js
var require_EventTarget = __commonJS({
  "node_modules/simple-websocket/node_modules/ws/lib/EventTarget.js"(exports2, module2) {
    "use strict";
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @param {Object} target A reference to the target to which the event was dispatched
       */
      constructor(type, target) {
        this.target = target;
        this.type = type;
      }
    };
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {(String|Buffer|ArrayBuffer|Buffer[])} data The received data
       * @param {Boolean} isBinary Specifies if `data` is binary
       * @param {WebSocket} target A reference to the target to which the event was dispatched
       */
      constructor(data, isBinary, target) {
        super("message", target);
        this.binary = isBinary;
        this.data = data;
      }
    };
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {Number} code The status code explaining why the connection is being closed
       * @param {String} reason A human-readable string explaining why the connection is closing
       * @param {WebSocket} target A reference to the target to which the event was dispatched
       */
      constructor(code, reason, target) {
        super("close", target);
        this.wasClean = code === void 0 || code === 1e3;
        this.reason = reason;
        this.target = target;
        this.type = "close";
        this.code = code;
      }
    };
    var OpenEvent = class extends Event {
      /**
       * Create a new `OpenEvent`.
       *
       * @param {WebSocket} target A reference to the target to which the event was dispatched
       */
      constructor(target) {
        super("open", target);
      }
    };
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} method A string representing the event type to listen for
       * @param {Function} listener The listener to add
       * @public
       */
      addEventListener(method, listener) {
        if (typeof listener !== "function") return;
        function onMessage(data, flags) {
          listener.call(this, new MessageEvent(data, !!flags.binary, this));
        }
        function onClose(code, message) {
          listener.call(this, new CloseEvent(code, message, this));
        }
        function onError(event) {
          event.type = "error";
          event.target = this;
          listener.call(this, event);
        }
        function onOpen() {
          listener.call(this, new OpenEvent(this));
        }
        if (method === "message") {
          onMessage._listener = listener;
          this.on(method, onMessage);
        } else if (method === "close") {
          onClose._listener = listener;
          this.on(method, onClose);
        } else if (method === "error") {
          onError._listener = listener;
          this.on(method, onError);
        } else if (method === "open") {
          onOpen._listener = listener;
          this.on(method, onOpen);
        } else {
          this.on(method, listener);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} method A string representing the event type to remove
       * @param {Function} listener The listener to remove
       * @public
       */
      removeEventListener(method, listener) {
        const listeners = this.listeners(method);
        for (var i = 0; i < listeners.length; i++) {
          if (listeners[i] === listener || listeners[i]._listener === listener) {
            this.removeListener(method, listeners[i]);
          }
        }
      }
    };
    module2.exports = EventTarget;
  }
});

// node_modules/simple-websocket/node_modules/ws/lib/Extensions.js
var require_Extensions = __commonJS({
  "node_modules/simple-websocket/node_modules/ws/lib/Extensions.js"(exports2, module2) {
    "use strict";
    var parse = (value) => {
      value = value || "";
      const extensions = {};
      value.split(",").forEach((v) => {
        const params = v.split(";");
        const token = params.shift().trim();
        const paramsList = extensions[token] = extensions[token] || [];
        const parsedParams = {};
        params.forEach((param) => {
          const parts = param.trim().split("=");
          const key = parts[0];
          var value2 = parts[1];
          if (value2 === void 0) {
            value2 = true;
          } else {
            if (value2[0] === '"') {
              value2 = value2.slice(1);
            }
            if (value2[value2.length - 1] === '"') {
              value2 = value2.slice(0, value2.length - 1);
            }
          }
          (parsedParams[key] = parsedParams[key] || []).push(value2);
        });
        paramsList.push(parsedParams);
      });
      return extensions;
    };
    var format = (value) => {
      return Object.keys(value).map((token) => {
        var paramsList = value[token];
        if (!Array.isArray(paramsList)) paramsList = [paramsList];
        return paramsList.map((params) => {
          return [token].concat(Object.keys(params).map((k) => {
            var p = params[k];
            if (!Array.isArray(p)) p = [p];
            return p.map((v) => v === true ? k : `${k}=${v}`).join("; ");
          })).join("; ");
        }).join(", ");
      }).join(", ");
    };
    module2.exports = { format, parse };
  }
});

// node_modules/simple-websocket/node_modules/ws/lib/Constants.js
var require_Constants = __commonJS({
  "node_modules/simple-websocket/node_modules/ws/lib/Constants.js"(exports2) {
    "use strict";
    var safeBuffer = require_safe_buffer3();
    var Buffer2 = safeBuffer.Buffer;
    exports2.BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    exports2.GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    exports2.EMPTY_BUFFER = Buffer2.alloc(0);
    exports2.NOOP = () => {
    };
  }
});

// node_modules/simple-websocket/node_modules/ws/lib/Validation.js
var require_Validation = __commonJS({
  "node_modules/simple-websocket/node_modules/ws/lib/Validation.js"(exports2, module2) {
    "use strict";
    try {
      const isValidUTF8 = require("utf-8-validate");
      module2.exports = typeof isValidUTF8 === "object" ? isValidUTF8.Validation.isValidUTF8 : isValidUTF8;
    } catch (e) {
      module2.exports = () => true;
    }
  }
});

// node_modules/simple-websocket/node_modules/ws/lib/ErrorCodes.js
var require_ErrorCodes = __commonJS({
  "node_modules/simple-websocket/node_modules/ws/lib/ErrorCodes.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      isValidErrorCode: function(code) {
        return code >= 1e3 && code <= 1013 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
      },
      1e3: "normal",
      1001: "going away",
      1002: "protocol error",
      1003: "unsupported data",
      1004: "reserved",
      1005: "reserved for extensions",
      1006: "reserved for extensions",
      1007: "inconsistent or invalid data",
      1008: "policy violation",
      1009: "message too big",
      1010: "extension handshake missing",
      1011: "an unexpected condition prevented the request from being fulfilled",
      1012: "service restart",
      1013: "try again later"
    };
  }
});

// node_modules/simple-websocket/node_modules/ws/lib/Receiver.js
var require_Receiver = __commonJS({
  "node_modules/simple-websocket/node_modules/ws/lib/Receiver.js"(exports2, module2) {
    "use strict";
    var safeBuffer = require_safe_buffer3();
    var PerMessageDeflate = require_PerMessageDeflate();
    var isValidUTF8 = require_Validation();
    var bufferUtil = require_BufferUtil();
    var ErrorCodes = require_ErrorCodes();
    var constants = require_Constants();
    var Buffer2 = safeBuffer.Buffer;
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var Receiver = class {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} extensions An object containing the negotiated extensions
       * @param {Number} maxPayload The maximum allowed message length
       * @param {String} binaryType The type for binary data
       */
      constructor(extensions, maxPayload, binaryType) {
        this.binaryType = binaryType || constants.BINARY_TYPES[0];
        this.extensions = extensions || {};
        this.maxPayload = maxPayload | 0;
        this.bufferedBytes = 0;
        this.buffers = [];
        this.compressed = false;
        this.payloadLength = 0;
        this.fragmented = 0;
        this.masked = false;
        this.fin = false;
        this.mask = null;
        this.opcode = 0;
        this.totalPayloadLength = 0;
        this.messageLength = 0;
        this.fragments = [];
        this.cleanupCallback = null;
        this.hadError = false;
        this.dead = false;
        this.loop = false;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;
        this.onping = null;
        this.onpong = null;
        this.state = GET_INFO;
      }
      /**
       * Consumes bytes from the available buffered data.
       *
       * @param {Number} bytes The number of bytes to consume
       * @return {Buffer} Consumed bytes
       * @private
       */
      readBuffer(bytes) {
        var offset = 0;
        var dst;
        var l;
        this.bufferedBytes -= bytes;
        if (bytes === this.buffers[0].length) return this.buffers.shift();
        if (bytes < this.buffers[0].length) {
          dst = this.buffers[0].slice(0, bytes);
          this.buffers[0] = this.buffers[0].slice(bytes);
          return dst;
        }
        dst = Buffer2.allocUnsafe(bytes);
        while (bytes > 0) {
          l = this.buffers[0].length;
          if (bytes >= l) {
            this.buffers[0].copy(dst, offset);
            offset += l;
            this.buffers.shift();
          } else {
            this.buffers[0].copy(dst, offset, 0, bytes);
            this.buffers[0] = this.buffers[0].slice(bytes);
          }
          bytes -= l;
        }
        return dst;
      }
      /**
       * Checks if the number of buffered bytes is bigger or equal than `n` and
       * calls `cleanup` if necessary.
       *
       * @param {Number} n The number of bytes to check against
       * @return {Boolean} `true` if `bufferedBytes >= n`, else `false`
       * @private
       */
      hasBufferedBytes(n) {
        if (this.bufferedBytes >= n) return true;
        this.loop = false;
        if (this.dead) this.cleanup(this.cleanupCallback);
        return false;
      }
      /**
       * Adds new data to the parser.
       *
       * @public
       */
      add(data) {
        if (this.dead) return;
        this.bufferedBytes += data.length;
        this.buffers.push(data);
        this.startLoop();
      }
      /**
       * Starts the parsing loop.
       *
       * @private
       */
      startLoop() {
        this.loop = true;
        while (this.loop) {
          switch (this.state) {
            case GET_INFO:
              this.getInfo();
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16();
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64();
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData();
              break;
            default:
              this.loop = false;
          }
        }
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @private
       */
      getInfo() {
        if (!this.hasBufferedBytes(2)) return;
        const buf = this.readBuffer(2);
        if ((buf[0] & 48) !== 0) {
          this.error(new Error("RSV2 and RSV3 must be clear"), 1002);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this.extensions[PerMessageDeflate.extensionName]) {
          this.error(new Error("RSV1 must be clear"), 1002);
          return;
        }
        this.fin = (buf[0] & 128) === 128;
        this.opcode = buf[0] & 15;
        this.payloadLength = buf[1] & 127;
        if (this.opcode === 0) {
          if (compressed) {
            this.error(new Error("RSV1 must be clear"), 1002);
            return;
          }
          if (!this.fragmented) {
            this.error(new Error(`invalid opcode: ${this.opcode}`), 1002);
            return;
          } else {
            this.opcode = this.fragmented;
          }
        } else if (this.opcode === 1 || this.opcode === 2) {
          if (this.fragmented) {
            this.error(new Error(`invalid opcode: ${this.opcode}`), 1002);
            return;
          }
          this.compressed = compressed;
        } else if (this.opcode > 7 && this.opcode < 11) {
          if (!this.fin) {
            this.error(new Error("FIN must be set"), 1002);
            return;
          }
          if (compressed) {
            this.error(new Error("RSV1 must be clear"), 1002);
            return;
          }
          if (this.payloadLength > 125) {
            this.error(new Error("invalid payload length"), 1002);
            return;
          }
        } else {
          this.error(new Error(`invalid opcode: ${this.opcode}`), 1002);
          return;
        }
        if (!this.fin && !this.fragmented) this.fragmented = this.opcode;
        this.masked = (buf[1] & 128) === 128;
        if (this.payloadLength === 126) this.state = GET_PAYLOAD_LENGTH_16;
        else if (this.payloadLength === 127) this.state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength();
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @private
       */
      getPayloadLength16() {
        if (!this.hasBufferedBytes(2)) return;
        this.payloadLength = this.readBuffer(2).readUInt16BE(0, true);
        this.haveLength();
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @private
       */
      getPayloadLength64() {
        if (!this.hasBufferedBytes(8)) return;
        const buf = this.readBuffer(8);
        const num = buf.readUInt32BE(0, true);
        if (num > Math.pow(2, 53 - 32) - 1) {
          this.error(new Error("max payload size exceeded"), 1009);
          return;
        }
        this.payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4, true);
        this.haveLength();
      }
      /**
       * Payload length has been read.
       *
       * @private
       */
      haveLength() {
        if (this.opcode < 8 && this.maxPayloadExceeded(this.payloadLength)) {
          return;
        }
        if (this.masked) this.state = GET_MASK;
        else this.state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (!this.hasBufferedBytes(4)) return;
        this.mask = this.readBuffer(4);
        this.state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @private
       */
      getData() {
        var data = constants.EMPTY_BUFFER;
        if (this.payloadLength) {
          if (!this.hasBufferedBytes(this.payloadLength)) return;
          data = this.readBuffer(this.payloadLength);
          if (this.masked) bufferUtil.unmask(data, this.mask);
        }
        if (this.opcode > 7) {
          this.controlMessage(data);
        } else if (this.compressed) {
          this.state = INFLATING;
          this.decompress(data);
        } else if (this.pushFragment(data)) {
          this.dataMessage();
        }
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @private
       */
      decompress(data) {
        const extension = this.extensions[PerMessageDeflate.extensionName];
        extension.decompress(data, this.fin, (err, buf) => {
          if (err) {
            this.error(err, err.closeCode === 1009 ? 1009 : 1007);
            return;
          }
          if (this.pushFragment(buf)) this.dataMessage();
          this.startLoop();
        });
      }
      /**
       * Handles a data message.
       *
       * @private
       */
      dataMessage() {
        if (this.fin) {
          const messageLength = this.messageLength;
          const fragments = this.fragments;
          this.totalPayloadLength = 0;
          this.messageLength = 0;
          this.fragmented = 0;
          this.fragments = [];
          if (this.opcode === 2) {
            var data;
            if (this.binaryType === "nodebuffer") {
              data = toBuffer(fragments, messageLength);
            } else if (this.binaryType === "arraybuffer") {
              data = toArrayBuffer(toBuffer(fragments, messageLength));
            } else {
              data = fragments;
            }
            this.onmessage(data, { masked: this.masked, binary: true });
          } else {
            const buf = toBuffer(fragments, messageLength);
            if (!isValidUTF8(buf)) {
              this.error(new Error("invalid utf8 sequence"), 1007);
              return;
            }
            this.onmessage(buf.toString(), { masked: this.masked });
          }
        }
        this.state = GET_INFO;
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @private
       */
      controlMessage(data) {
        if (this.opcode === 8) {
          if (data.length === 0) {
            this.onclose(1e3, "", { masked: this.masked });
            this.loop = false;
            this.cleanup(this.cleanupCallback);
          } else if (data.length === 1) {
            this.error(new Error("invalid payload length"), 1002);
          } else {
            const code = data.readUInt16BE(0, true);
            if (!ErrorCodes.isValidErrorCode(code)) {
              this.error(new Error(`invalid status code: ${code}`), 1002);
              return;
            }
            const buf = data.slice(2);
            if (!isValidUTF8(buf)) {
              this.error(new Error("invalid utf8 sequence"), 1007);
              return;
            }
            this.onclose(code, buf.toString(), { masked: this.masked });
            this.loop = false;
            this.cleanup(this.cleanupCallback);
          }
          return;
        }
        const flags = { masked: this.masked, binary: true };
        if (this.opcode === 9) this.onping(data, flags);
        else this.onpong(data, flags);
        this.state = GET_INFO;
      }
      /**
       * Handles an error.
       *
       * @param {Error} err The error
       * @param {Number} code Close code
       * @private
       */
      error(err, code) {
        this.onerror(err, code);
        this.hadError = true;
        this.loop = false;
        this.cleanup(this.cleanupCallback);
      }
      /**
       * Checks payload size, disconnects socket when it exceeds `maxPayload`.
       *
       * @param {Number} length Payload length
       * @private
       */
      maxPayloadExceeded(length) {
        if (length === 0 || this.maxPayload < 1) return false;
        const fullLength = this.totalPayloadLength + length;
        if (fullLength <= this.maxPayload) {
          this.totalPayloadLength = fullLength;
          return false;
        }
        this.error(new Error("max payload size exceeded"), 1009);
        return true;
      }
      /**
       * Appends a fragment in the fragments array after checking that the sum of
       * fragment lengths does not exceed `maxPayload`.
       *
       * @param {Buffer} fragment The fragment to add
       * @return {Boolean} `true` if `maxPayload` is not exceeded, else `false`
       * @private
       */
      pushFragment(fragment) {
        if (fragment.length === 0) return true;
        const totalLength = this.messageLength + fragment.length;
        if (this.maxPayload < 1 || totalLength <= this.maxPayload) {
          this.messageLength = totalLength;
          this.fragments.push(fragment);
          return true;
        }
        this.error(new Error("max payload size exceeded"), 1009);
        return false;
      }
      /**
       * Releases resources used by the receiver.
       *
       * @param {Function} cb Callback
       * @public
       */
      cleanup(cb) {
        this.dead = true;
        if (!this.hadError && (this.loop || this.state === INFLATING)) {
          this.cleanupCallback = cb;
        } else {
          this.extensions = null;
          this.fragments = null;
          this.buffers = null;
          this.mask = null;
          this.cleanupCallback = null;
          this.onmessage = null;
          this.onclose = null;
          this.onerror = null;
          this.onping = null;
          this.onpong = null;
          if (cb) cb();
        }
      }
    };
    module2.exports = Receiver;
    function toBuffer(fragments, messageLength) {
      if (fragments.length === 1) return fragments[0];
      if (fragments.length > 1) return bufferUtil.concat(fragments, messageLength);
      return constants.EMPTY_BUFFER;
    }
    function toArrayBuffer(buf) {
      if (buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
  }
});

// node_modules/simple-websocket/node_modules/ws/lib/Sender.js
var require_Sender = __commonJS({
  "node_modules/simple-websocket/node_modules/ws/lib/Sender.js"(exports2, module2) {
    "use strict";
    var safeBuffer = require_safe_buffer3();
    var crypto = require("crypto");
    var PerMessageDeflate = require_PerMessageDeflate();
    var bufferUtil = require_BufferUtil();
    var ErrorCodes = require_ErrorCodes();
    var Buffer2 = safeBuffer.Buffer;
    var Sender = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {net.Socket} socket The connection socket
       * @param {Object} extensions An object containing the negotiated extensions
       */
      constructor(socket, extensions) {
        this.perMessageDeflate = (extensions || {})[PerMessageDeflate.extensionName];
        this._socket = socket;
        this.firstFragment = true;
        this.compress = false;
        this.bufferedBytes = 0;
        this.deflating = false;
        this.queue = [];
        this.onerror = null;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {Buffer} data The data to frame
       * @param {Object} options Options object
       * @param {Number} options.opcode The opcode
       * @param {Boolean} options.readOnly Specifies whether `data` can be modified
       * @param {Boolean} options.fin Specifies whether or not to set the FIN bit
       * @param {Boolean} options.mask Specifies whether or not to mask `data`
       * @param {Boolean} options.rsv1 Specifies whether or not to set the RSV1 bit
       * @return {Buffer[]} The framed data as a list of `Buffer` instances
       * @public
       */
      static frame(data, options) {
        const merge = data.length < 1024 || options.mask && options.readOnly;
        var offset = options.mask ? 6 : 2;
        var payloadLength = data.length;
        if (data.length >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (data.length > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer2.allocUnsafe(merge ? data.length + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        if (payloadLength === 126) {
          target.writeUInt16BE(data.length, 2, true);
        } else if (payloadLength === 127) {
          target.writeUInt32BE(0, 2, true);
          target.writeUInt32BE(data.length, 6, true);
        }
        if (!options.mask) {
          target[1] = payloadLength;
          if (merge) {
            data.copy(target, offset);
            return [target];
          }
          return [target, data];
        }
        const mask = crypto.randomBytes(4);
        target[1] = payloadLength | 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (merge) {
          bufferUtil.mask(data, mask, target, offset, data.length);
          return [target];
        }
        bufferUtil.mask(data, mask, data, 0, data.length);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {(Number|undefined)} code The status code component of the body
       * @param {String} data The message component of the body
       * @param {Boolean} mask Specifies whether or not to mask the message
       * @param {Function} cb Callback
       * @public
       */
      close(code, data, mask, cb) {
        if (code !== void 0 && (typeof code !== "number" || !ErrorCodes.isValidErrorCode(code))) {
          throw new Error("first argument must be a valid error code number");
        }
        const buf = Buffer2.allocUnsafe(2 + (data ? Buffer2.byteLength(data) : 0));
        buf.writeUInt16BE(code || 1e3, 0, true);
        if (buf.length > 2) buf.write(data, 2);
        if (this.deflating) {
          this.enqueue([this.doClose, buf, mask, cb]);
        } else {
          this.doClose(buf, mask, cb);
        }
      }
      /**
       * Frames and sends a close message.
       *
       * @param {Buffer} data The message to send
       * @param {Boolean} mask Specifies whether or not to mask `data`
       * @param {Function} cb Callback
       * @private
       */
      doClose(data, mask, cb) {
        this.sendFrame(_Sender.frame(data, {
          fin: true,
          rsv1: false,
          opcode: 8,
          mask,
          readOnly: false
        }), cb);
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} mask Specifies whether or not to mask `data`
       * @public
       */
      ping(data, mask) {
        var readOnly = true;
        if (!Buffer2.isBuffer(data)) {
          if (data instanceof ArrayBuffer) {
            data = Buffer2.from(data);
          } else if (ArrayBuffer.isView(data)) {
            data = viewToBuffer(data);
          } else {
            data = Buffer2.from(data);
            readOnly = false;
          }
        }
        if (this.deflating) {
          this.enqueue([this.doPing, data, mask, readOnly]);
        } else {
          this.doPing(data, mask, readOnly);
        }
      }
      /**
       * Frames and sends a ping message.
       *
       * @param {*} data The message to send
       * @param {Boolean} mask Specifies whether or not to mask `data`
       * @param {Boolean} readOnly Specifies whether `data` can be modified
       * @private
       */
      doPing(data, mask, readOnly) {
        this.sendFrame(_Sender.frame(data, {
          fin: true,
          rsv1: false,
          opcode: 9,
          mask,
          readOnly
        }));
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} mask Specifies whether or not to mask `data`
       * @public
       */
      pong(data, mask) {
        var readOnly = true;
        if (!Buffer2.isBuffer(data)) {
          if (data instanceof ArrayBuffer) {
            data = Buffer2.from(data);
          } else if (ArrayBuffer.isView(data)) {
            data = viewToBuffer(data);
          } else {
            data = Buffer2.from(data);
            readOnly = false;
          }
        }
        if (this.deflating) {
          this.enqueue([this.doPong, data, mask, readOnly]);
        } else {
          this.doPong(data, mask, readOnly);
        }
      }
      /**
       * Frames and sends a pong message.
       *
       * @param {*} data The message to send
       * @param {Boolean} mask Specifies whether or not to mask `data`
       * @param {Boolean} readOnly Specifies whether `data` can be modified
       * @private
       */
      doPong(data, mask, readOnly) {
        this.sendFrame(_Sender.frame(data, {
          fin: true,
          rsv1: false,
          opcode: 10,
          mask,
          readOnly
        }));
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} options.compress Specifies whether or not to compress `data`
       * @param {Boolean} options.binary Specifies whether `data` is binary or text
       * @param {Boolean} options.fin Specifies whether the fragment is the last one
       * @param {Boolean} options.mask Specifies whether or not to mask `data`
       * @param {Function} cb Callback
       * @public
       */
      send(data, options, cb) {
        var opcode = options.binary ? 2 : 1;
        var rsv1 = options.compress;
        var readOnly = true;
        if (!Buffer2.isBuffer(data)) {
          if (data instanceof ArrayBuffer) {
            data = Buffer2.from(data);
          } else if (ArrayBuffer.isView(data)) {
            data = viewToBuffer(data);
          } else {
            data = Buffer2.from(data);
            readOnly = false;
          }
        }
        if (this.firstFragment) {
          this.firstFragment = false;
          if (rsv1 && this.perMessageDeflate) {
            rsv1 = data.length >= this.perMessageDeflate.threshold;
          }
          this.compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this.firstFragment = true;
        if (this.perMessageDeflate) {
          const opts = {
            fin: options.fin,
            rsv1,
            opcode,
            mask: options.mask,
            readOnly
          };
          if (this.deflating) {
            this.enqueue([this.dispatch, data, this.compress, opts, cb]);
          } else {
            this.dispatch(data, this.compress, opts, cb);
          }
        } else {
          this.sendFrame(_Sender.frame(data, {
            fin: options.fin,
            rsv1: false,
            opcode,
            mask: options.mask,
            readOnly
          }), cb);
        }
      }
      /**
       * Dispatches a data message.
       *
       * @param {Buffer} data The message to send
       * @param {Boolean} compress Specifies whether or not to compress `data`
       * @param {Object} options Options object
       * @param {Number} options.opcode The opcode
       * @param {Boolean} options.readOnly Specifies whether `data` can be modified
       * @param {Boolean} options.fin Specifies whether or not to set the FIN bit
       * @param {Boolean} options.mask Specifies whether or not to mask `data`
       * @param {Boolean} options.rsv1 Specifies whether or not to set the RSV1 bit
       * @param {Function} cb Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        this.deflating = true;
        this.perMessageDeflate.compress(data, options.fin, (err, buf) => {
          if (err) {
            if (cb) cb(err);
            else this.onerror(err);
            return;
          }
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.deflating = false;
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (!this.deflating && this.queue.length) {
          const params = this.queue.shift();
          this.bufferedBytes -= params[1].length;
          params[0].apply(this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this.bufferedBytes += params[1].length;
        this.queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {Buffer[]} list The frame to send
       * @param {Function} cb Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module2.exports = Sender;
    function viewToBuffer(view) {
      const buf = Buffer2.from(view.buffer);
      if (view.byteLength !== view.buffer.byteLength) {
        return buf.slice(view.byteOffset, view.byteOffset + view.byteLength);
      }
      return buf;
    }
  }
});

// node_modules/simple-websocket/node_modules/ws/lib/WebSocket.js
var require_WebSocket = __commonJS({
  "node_modules/simple-websocket/node_modules/ws/lib/WebSocket.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var crypto = require("crypto");
    var Ultron = require_ultron();
    var https = require("https");
    var http2 = require("http");
    var url = require("url");
    var PerMessageDeflate = require_PerMessageDeflate();
    var EventTarget = require_EventTarget();
    var Extensions = require_Extensions();
    var constants = require_Constants();
    var Receiver = require_Receiver();
    var Sender = require_Sender();
    var protocolVersions = [8, 13];
    var closeTimeout = 30 * 1e3;
    var WebSocket2 = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {String} address The URL to which to connect
       * @param {(String|String[])} protocols The subprotocols
       * @param {Object} options Connection options
       */
      constructor(address, protocols, options) {
        super();
        if (!protocols) {
          protocols = [];
        } else if (typeof protocols === "string") {
          protocols = [protocols];
        } else if (!Array.isArray(protocols)) {
          options = protocols;
          protocols = [];
        }
        this.readyState = _WebSocket.CONNECTING;
        this.bytesReceived = 0;
        this.extensions = {};
        this.protocol = "";
        this._binaryType = constants.BINARY_TYPES[0];
        this._finalize = this.finalize.bind(this);
        this._finalizeCalled = false;
        this._closeMessage = null;
        this._closeTimer = null;
        this._closeCode = null;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        this._ultron = null;
        if (Array.isArray(address)) {
          initAsServerClient.call(this, address[0], address[1], address[2], options);
        } else {
          initAsClient.call(this, address, protocols, options);
        }
      }
      get CONNECTING() {
        return _WebSocket.CONNECTING;
      }
      get CLOSING() {
        return _WebSocket.CLOSING;
      }
      get CLOSED() {
        return _WebSocket.CLOSED;
      }
      get OPEN() {
        return _WebSocket.OPEN;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        var amount = 0;
        if (this._socket) {
          amount = this._socket.bufferSize + this._sender.bufferedBytes;
        }
        return amount;
      }
      /**
       * This deviates from the WHATWG interface since ws doesn't support the required
       * default "blob" type (instead we define a custom "nodebuffer" type).
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (constants.BINARY_TYPES.indexOf(type) < 0) return;
        this._binaryType = type;
        if (this._receiver) this._receiver.binaryType = type;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {net.Socket} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @private
       */
      setSocket(socket, head) {
        socket.setTimeout(0);
        socket.setNoDelay();
        this._receiver = new Receiver(this.extensions, this.maxPayload, this.binaryType);
        this._sender = new Sender(socket, this.extensions);
        this._ultron = new Ultron(socket);
        this._socket = socket;
        this._ultron.on("close", this._finalize);
        this._ultron.on("error", this._finalize);
        this._ultron.on("end", this._finalize);
        if (head && head.length > 0) {
          socket.unshift(head);
          head = null;
        }
        this._ultron.on("data", (data) => {
          this.bytesReceived += data.length;
          this._receiver.add(data);
        });
        this._receiver.onmessage = (data, flags) => this.emit("message", data, flags);
        this._receiver.onping = (data, flags) => {
          this.pong(data, !this._isServer, true);
          this.emit("ping", data, flags);
        };
        this._receiver.onpong = (data, flags) => this.emit("pong", data, flags);
        this._receiver.onclose = (code, reason) => {
          this._closeMessage = reason;
          this._closeCode = code;
          this.close(code, reason);
        };
        this._receiver.onerror = (error, code) => {
          this.close(code, "");
          this.emit("error", error);
        };
        this._sender.onerror = (error) => {
          this.close(1002, "");
          this.emit("error", error);
        };
        this.readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Clean up and release internal resources.
       *
       * @param {(Boolean|Error)} Indicates whether or not an error occurred
       * @private
       */
      finalize(error) {
        if (this._finalizeCalled) return;
        this.readyState = _WebSocket.CLOSING;
        this._finalizeCalled = true;
        clearTimeout(this._closeTimer);
        this._closeTimer = null;
        if (error) this._closeCode = 1006;
        if (this._socket) {
          this._ultron.destroy();
          this._socket.on("error", function onerror() {
            this.destroy();
          });
          if (!error) this._socket.end();
          else this._socket.destroy();
          this._socket = null;
          this._ultron = null;
        }
        if (this._sender) {
          this._sender = this._sender.onerror = null;
        }
        if (this._receiver) {
          this._receiver.cleanup(() => this.emitClose());
          this._receiver = null;
        } else {
          this.emitClose();
        }
      }
      /**
       * Emit the `close` event.
       *
       * @private
       */
      emitClose() {
        this.readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode || 1006, this._closeMessage || "");
        if (this.extensions[PerMessageDeflate.extensionName]) {
          this.extensions[PerMessageDeflate.extensionName].cleanup();
        }
        this.extensions = null;
        this.removeAllListeners();
        this.on("error", constants.NOOP);
      }
      /**
       * Pause the socket stream.
       *
       * @public
       */
      pause() {
        if (this.readyState !== _WebSocket.OPEN) throw new Error("not opened");
        this._socket.pause();
      }
      /**
       * Resume the socket stream
       *
       * @public
       */
      resume() {
        if (this.readyState !== _WebSocket.OPEN) throw new Error("not opened");
        this._socket.resume();
      }
      /**
       * Start a closing handshake.
       *
       * @param {Number} code Status code explaining why the connection is closing
       * @param {String} data A string explaining why the connection is closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          if (this._req && !this._req.aborted) {
            this._req.abort();
            this.emit("error", new Error("closed before the connection is established"));
            this.finalize(true);
          }
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeCode && this._socket) this._socket.end();
          return;
        }
        this.readyState = _WebSocket.CLOSING;
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) this.emit("error", err);
          if (this._socket) {
            if (this._closeCode) this._socket.end();
            clearTimeout(this._closeTimer);
            this._closeTimer = setTimeout(this._finalize, closeTimeout, true);
          }
        });
      }
      /**
       * Send a ping message.
       *
       * @param {*} data The message to send
       * @param {Boolean} mask Indicates whether or not to mask `data`
       * @param {Boolean} failSilently Indicates whether or not to throw if `readyState` isn't `OPEN`
       * @public
       */
      ping(data, mask, failSilently) {
        if (this.readyState !== _WebSocket.OPEN) {
          if (failSilently) return;
          throw new Error("not opened");
        }
        if (typeof data === "number") data = data.toString();
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || constants.EMPTY_BUFFER, mask);
      }
      /**
       * Send a pong message.
       *
       * @param {*} data The message to send
       * @param {Boolean} mask Indicates whether or not to mask `data`
       * @param {Boolean} failSilently Indicates whether or not to throw if `readyState` isn't `OPEN`
       * @public
       */
      pong(data, mask, failSilently) {
        if (this.readyState !== _WebSocket.OPEN) {
          if (failSilently) return;
          throw new Error("not opened");
        }
        if (typeof data === "number") data = data.toString();
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || constants.EMPTY_BUFFER, mask);
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} options.compress Specifies whether or not to compress `data`
       * @param {Boolean} options.binary Specifies whether `data` is binary or text
       * @param {Boolean} options.fin Specifies whether the fragment is the last one
       * @param {Boolean} options.mask Specifies whether or not to mask `data`
       * @param {Function} cb Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (this.readyState !== _WebSocket.OPEN) {
          if (cb) cb(new Error("not opened"));
          else throw new Error("not opened");
          return;
        }
        if (typeof data === "number") data = data.toString();
        const opts = Object.assign({
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true
        }, options);
        if (!this.extensions[PerMessageDeflate.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || constants.EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          if (this._req && !this._req.aborted) {
            this._req.abort();
            this.emit("error", new Error("closed before the connection is established"));
            this.finalize(true);
          }
          return;
        }
        this.finalize(true);
      }
    };
    WebSocket2.CONNECTING = 0;
    WebSocket2.OPEN = 1;
    WebSocket2.CLOSING = 2;
    WebSocket2.CLOSED = 3;
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        /**
         * Return the listener of the event.
         *
         * @return {(Function|undefined)} The event listener or `undefined`
         * @public
         */
        get() {
          const listeners = this.listeners(method);
          for (var i = 0; i < listeners.length; i++) {
            if (listeners[i]._listener) return listeners[i]._listener;
          }
        },
        /**
         * Add a listener for the event.
         *
         * @param {Function} listener The listener to add
         * @public
         */
        set(listener) {
          const listeners = this.listeners(method);
          for (var i = 0; i < listeners.length; i++) {
            if (listeners[i]._listener) this.removeListener(method, listeners[i]);
          }
          this.addEventListener(method, listener);
        }
      });
    });
    WebSocket2.prototype.addEventListener = EventTarget.addEventListener;
    WebSocket2.prototype.removeEventListener = EventTarget.removeEventListener;
    module2.exports = WebSocket2;
    function initAsServerClient(req, socket, head, options) {
      this.protocolVersion = options.protocolVersion;
      this.extensions = options.extensions;
      this.maxPayload = options.maxPayload;
      this.protocol = options.protocol;
      this.upgradeReq = req;
      this._isServer = true;
      this.setSocket(socket, head);
    }
    function initAsClient(address, protocols, options) {
      options = Object.assign({
        protocolVersion: protocolVersions[1],
        protocol: protocols.join(","),
        perMessageDeflate: true,
        localAddress: null,
        headers: null,
        family: null,
        origin: null,
        agent: null,
        host: null,
        //
        // SSL options.
        //
        checkServerIdentity: null,
        rejectUnauthorized: null,
        passphrase: null,
        ciphers: null,
        cert: null,
        key: null,
        pfx: null,
        ca: null
      }, options);
      if (protocolVersions.indexOf(options.protocolVersion) === -1) {
        throw new Error(
          `unsupported protocol version: ${options.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      this.protocolVersion = options.protocolVersion;
      this._isServer = false;
      this.url = address;
      const serverUrl = url.parse(address);
      const isUnixSocket = serverUrl.protocol === "ws+unix:";
      if (!serverUrl.host && (!isUnixSocket || !serverUrl.path)) {
        throw new Error("invalid url");
      }
      const isSecure = serverUrl.protocol === "wss:" || serverUrl.protocol === "https:";
      const key = crypto.randomBytes(16).toString("base64");
      const httpObj = isSecure ? https : http2;
      const extensionsOffer = {};
      var perMessageDeflate;
      if (options.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate(
          options.perMessageDeflate !== true ? options.perMessageDeflate : {},
          false
        );
        extensionsOffer[PerMessageDeflate.extensionName] = perMessageDeflate.offer();
      }
      const requestOptions = {
        port: serverUrl.port || (isSecure ? 443 : 80),
        host: serverUrl.hostname,
        path: "/",
        headers: {
          "Sec-WebSocket-Version": options.protocolVersion,
          "Sec-WebSocket-Key": key,
          "Connection": "Upgrade",
          "Upgrade": "websocket"
        }
      };
      if (options.headers) Object.assign(requestOptions.headers, options.headers);
      if (Object.keys(extensionsOffer).length) {
        requestOptions.headers["Sec-WebSocket-Extensions"] = Extensions.format(extensionsOffer);
      }
      if (options.protocol) {
        requestOptions.headers["Sec-WebSocket-Protocol"] = options.protocol;
      }
      if (options.origin) {
        if (options.protocolVersion < 13) {
          requestOptions.headers["Sec-WebSocket-Origin"] = options.origin;
        } else {
          requestOptions.headers.Origin = options.origin;
        }
      }
      if (options.host) requestOptions.headers.Host = options.host;
      if (serverUrl.auth) requestOptions.auth = serverUrl.auth;
      if (options.localAddress) requestOptions.localAddress = options.localAddress;
      if (options.family) requestOptions.family = options.family;
      if (isUnixSocket) {
        const parts = serverUrl.path.split(":");
        requestOptions.socketPath = parts[0];
        requestOptions.path = parts[1];
      } else if (serverUrl.path) {
        if (serverUrl.path.charAt(0) !== "/") {
          requestOptions.path = `/${serverUrl.path}`;
        } else {
          requestOptions.path = serverUrl.path;
        }
      }
      var agent = options.agent;
      if (options.rejectUnauthorized != null || options.checkServerIdentity || options.passphrase || options.ciphers || options.cert || options.key || options.pfx || options.ca) {
        if (options.passphrase) requestOptions.passphrase = options.passphrase;
        if (options.ciphers) requestOptions.ciphers = options.ciphers;
        if (options.cert) requestOptions.cert = options.cert;
        if (options.key) requestOptions.key = options.key;
        if (options.pfx) requestOptions.pfx = options.pfx;
        if (options.ca) requestOptions.ca = options.ca;
        if (options.checkServerIdentity) {
          requestOptions.checkServerIdentity = options.checkServerIdentity;
        }
        if (options.rejectUnauthorized != null) {
          requestOptions.rejectUnauthorized = options.rejectUnauthorized;
        }
        if (!agent) agent = new httpObj.Agent(requestOptions);
      }
      if (agent) requestOptions.agent = agent;
      this._req = httpObj.get(requestOptions);
      this._req.on("error", (error) => {
        if (this._req.aborted) return;
        this._req = null;
        this.emit("error", error);
        this.finalize(true);
      });
      this._req.on("response", (res) => {
        if (!this.emit("unexpected-response", this._req, res)) {
          this._req.abort();
          this.emit("error", new Error(`unexpected server response (${res.statusCode})`));
          this.finalize(true);
        }
      });
      this._req.on("upgrade", (res, socket, head) => {
        this.emit("headers", res.headers, res);
        if (this.readyState !== WebSocket2.CONNECTING) return;
        this._req = null;
        const digest = crypto.createHash("sha1").update(key + constants.GUID, "binary").digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          socket.destroy();
          this.emit("error", new Error("invalid server key"));
          return this.finalize(true);
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        const protList = (options.protocol || "").split(/, */);
        var protError;
        if (!options.protocol && serverProt) {
          protError = "server sent a subprotocol even though none requested";
        } else if (options.protocol && !serverProt) {
          protError = "server sent no subprotocol even though requested";
        } else if (serverProt && protList.indexOf(serverProt) === -1) {
          protError = "server responded with an invalid protocol";
        }
        if (protError) {
          socket.destroy();
          this.emit("error", new Error(protError));
          return this.finalize(true);
        }
        if (serverProt) this.protocol = serverProt;
        const serverExtensions = Extensions.parse(res.headers["sec-websocket-extensions"]);
        if (perMessageDeflate && serverExtensions[PerMessageDeflate.extensionName]) {
          try {
            perMessageDeflate.accept(serverExtensions[PerMessageDeflate.extensionName]);
          } catch (err) {
            socket.destroy();
            this.emit("error", new Error("invalid extension parameter"));
            return this.finalize(true);
          }
          this.extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
        }
        this.setSocket(socket, head);
      });
    }
  }
});

// node_modules/simple-websocket/node_modules/ws/lib/WebSocketServer.js
var require_WebSocketServer = __commonJS({
  "node_modules/simple-websocket/node_modules/ws/lib/WebSocketServer.js"(exports2, module2) {
    "use strict";
    var safeBuffer = require_safe_buffer3();
    var EventEmitter = require("events");
    var crypto = require("crypto");
    var Ultron = require_ultron();
    var http2 = require("http");
    var url = require("url");
    var PerMessageDeflate = require_PerMessageDeflate();
    var Extensions = require_Extensions();
    var constants = require_Constants();
    var WebSocket2 = require_WebSocket();
    var Buffer2 = safeBuffer.Buffer;
    var WebSocketServer = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {String} options.host The hostname where to bind the server
       * @param {Number} options.port The port where to bind the server
       * @param {http.Server} options.server A pre-created HTTP/S server to use
       * @param {Function} options.verifyClient An hook to reject connections
       * @param {Function} options.handleProtocols An hook to handle protocols
       * @param {String} options.path Accept only connections matching this path
       * @param {Boolean} options.noServer Enable no server mode
       * @param {Boolean} options.clientTracking Specifies whether or not to track clients
       * @param {(Boolean|Object)} options.perMessageDeflate Enable/disable permessage-deflate
       * @param {Number} options.maxPayload The maximum allowed message size
       * @param {Function} callback A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = Object.assign({
          maxPayload: 100 * 1024 * 1024,
          perMessageDeflate: true,
          handleProtocols: null,
          clientTracking: true,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null
        }, options);
        if (options.port == null && !options.server && !options.noServer) {
          throw new TypeError("missing or invalid options");
        }
        if (options.port != null) {
          this._server = http2.createServer((req, res) => {
            const body = http2.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.allowHalfOpen = false;
          this._server.listen(options.port, options.host, options.backlog, callback);
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          this._ultron = new Ultron(this._server);
          this._ultron.on("listening", () => this.emit("listening"));
          this._ultron.on("error", (err) => this.emit("error", err));
          this._ultron.on("upgrade", (req, socket, head) => {
            this.handleUpgrade(req, socket, head, (client) => {
              this.emit(`connection${req.url}`, client);
              this.emit("connection", client);
            });
          });
        }
        if (options.clientTracking) this.clients = /* @__PURE__ */ new Set();
        this.options = options;
        this.path = options.path;
      }
      /**
       * Close the server.
       *
       * @param {Function} cb Callback
       * @public
       */
      close(cb) {
        if (this.clients) {
          for (const client of this.clients) client.terminate();
        }
        const server2 = this._server;
        if (server2) {
          this._ultron.destroy();
          this._ultron = this._server = null;
          if (this.options.port != null) return server2.close(cb);
        }
        if (cb) cb();
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path && url.parse(req.url).pathname !== this.options.path) {
          return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {net.Socket} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketError);
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET" || req.headers.upgrade.toLowerCase() !== "websocket" || !req.headers["sec-websocket-key"] || version !== 8 && version !== 13 || !this.shouldHandle(req)) {
          return abortConnection(socket, 400);
        }
        var protocol = (req.headers["sec-websocket-protocol"] || "").split(/, */);
        if (this.options.handleProtocols) {
          protocol = this.options.handleProtocols(protocol, req);
          if (protocol === false) return abortConnection(socket, 401);
        } else {
          protocol = protocol[0];
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.connection.authorized || req.connection.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message) => {
              if (!verified) return abortConnection(socket, code || 401, message);
              this.completeUpgrade(protocol, version, req, socket, head, cb);
            });
            return;
          } else if (!this.options.verifyClient(info)) {
            return abortConnection(socket, 401);
          }
        }
        this.completeUpgrade(protocol, version, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {String} protocol The chosen subprotocol
       * @param {Number} version The WebSocket protocol version
       * @param {http.IncomingMessage} req The request object
       * @param {net.Socket} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @private
       */
      completeUpgrade(protocol, version, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        const key = crypto.createHash("sha1").update(req.headers["sec-websocket-key"] + constants.GUID, "binary").digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${key}`
        ];
        if (protocol) headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
        const offer = Extensions.parse(req.headers["sec-websocket-extensions"]);
        var extensions;
        try {
          extensions = acceptExtensions(this.options, offer);
        } catch (err) {
          return abortConnection(socket, 400);
        }
        const props = Object.keys(extensions);
        if (props.length) {
          const serverExtensions = props.reduce((obj, key2) => {
            obj[key2] = [extensions[key2].params];
            return obj;
          }, {});
          headers.push(`Sec-WebSocket-Extensions: ${Extensions.format(serverExtensions)}`);
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("", "").join("\r\n"));
        const client = new WebSocket2([req, socket, head], null, {
          maxPayload: this.options.maxPayload,
          protocolVersion: version,
          extensions,
          protocol
        });
        if (this.clients) {
          this.clients.add(client);
          client.on("close", () => this.clients.delete(client));
        }
        socket.removeListener("error", socketError);
        cb(client);
      }
    };
    module2.exports = WebSocketServer;
    function socketError() {
      this.destroy();
    }
    function acceptExtensions(options, offer) {
      const pmd = options.perMessageDeflate;
      const extensions = {};
      if (pmd && offer[PerMessageDeflate.extensionName]) {
        const perMessageDeflate = new PerMessageDeflate(
          pmd !== true ? pmd : {},
          true,
          options.maxPayload
        );
        perMessageDeflate.accept(offer[PerMessageDeflate.extensionName]);
        extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
      }
      return extensions;
    }
    function abortConnection(socket, code, message) {
      if (socket.writable) {
        message = message || http2.STATUS_CODES[code];
        socket.write(
          `HTTP/1.1 ${code} ${http2.STATUS_CODES[code]}\r
Connection: close\r
Content-type: text/html\r
Content-Length: ${Buffer2.byteLength(message)}\r
\r
` + message
        );
      }
      socket.removeListener("error", socketError);
      socket.destroy();
    }
  }
});

// node_modules/simple-websocket/node_modules/ws/index.js
var require_ws = __commonJS({
  "node_modules/simple-websocket/node_modules/ws/index.js"(exports2, module2) {
    "use strict";
    var WebSocket2 = require_WebSocket();
    WebSocket2.Server = require_WebSocketServer();
    WebSocket2.Receiver = require_Receiver();
    WebSocket2.Sender = require_Sender();
    module2.exports = WebSocket2;
  }
});

// node_modules/simple-websocket/index.js
var require_simple_websocket = __commonJS({
  "node_modules/simple-websocket/index.js"(exports2, module2) {
    module2.exports = Socket;
    var debug = require_src()("simple-websocket");
    var extend = require_immutable();
    var inherits = require_inherits();
    var randombytes = require_randombytes();
    var stream = require_readable3();
    var ws = require_ws();
    var _WebSocket = typeof ws !== "function" ? WebSocket : ws;
    inherits(Socket, stream.Duplex);
    function Socket(url, opts) {
      var self2 = this;
      if (!(self2 instanceof Socket)) return new Socket(url, opts);
      if (!opts) opts = {};
      self2._id = randombytes(4).toString("hex").slice(0, 7);
      self2._debug("new websocket: %s %o", url, opts);
      opts = extend({}, {
        allowHalfOpen: false,
        highWaterMark: 1024 * 1024
      }, opts);
      stream.Duplex.call(self2, opts);
      self2.url = url;
      self2.connected = false;
      self2.destroyed = false;
      self2._maxBufferedAmount = opts.highWaterMark;
      self2._chunk = null;
      self2._cb = null;
      self2._interval = null;
      try {
        if (typeof ws === "function") {
          self2._ws = new _WebSocket(self2.url, opts);
        } else {
          self2._ws = new _WebSocket(self2.url);
        }
      } catch (err) {
        process.nextTick(function() {
          self2._onError(err);
        });
        return;
      }
      self2._ws.binaryType = "arraybuffer";
      self2._ws.onopen = function() {
        self2._onOpen();
      };
      self2._ws.onmessage = function(event) {
        self2._onMessage(event);
      };
      self2._ws.onclose = function() {
        self2._onClose();
      };
      self2._ws.onerror = function() {
        self2._onError(new Error("connection error to " + self2.url));
      };
      self2.on("finish", function() {
        if (self2.connected) {
          setTimeout(function() {
            self2._destroy();
          }, 100);
        } else {
          self2.once("connect", function() {
            setTimeout(function() {
              self2._destroy();
            }, 100);
          });
        }
      });
    }
    Socket.WEBSOCKET_SUPPORT = !!_WebSocket;
    Socket.prototype.send = function(chunk) {
      var self2 = this;
      self2._ws.send(chunk);
    };
    Socket.prototype.destroy = function(onclose) {
      var self2 = this;
      self2._destroy(null, onclose);
    };
    Socket.prototype._destroy = function(err, onclose) {
      var self2 = this;
      if (self2.destroyed) return;
      if (onclose) self2.once("close", onclose);
      self2._debug("destroy (error: %s)", err && err.message);
      self2.readable = self2.writable = false;
      if (!self2._readableState.ended) self2.push(null);
      if (!self2._writableState.finished) self2.end();
      self2.connected = false;
      self2.destroyed = true;
      clearInterval(self2._interval);
      self2._interval = null;
      self2._chunk = null;
      self2._cb = null;
      if (self2._ws) {
        var ws2 = self2._ws;
        var onClose = function() {
          ws2.onclose = null;
        };
        if (ws2.readyState === _WebSocket.CLOSED) {
          onClose();
        } else {
          try {
            ws2.onclose = onClose;
            ws2.close();
          } catch (err2) {
            onClose();
          }
        }
        ws2.onopen = null;
        ws2.onmessage = null;
        ws2.onerror = null;
      }
      self2._ws = null;
      if (err) self2.emit("error", err);
      self2.emit("close");
    };
    Socket.prototype._read = function() {
    };
    Socket.prototype._write = function(chunk, encoding, cb) {
      var self2 = this;
      if (self2.destroyed) return cb(new Error("cannot write after socket is destroyed"));
      if (self2.connected) {
        try {
          self2.send(chunk);
        } catch (err) {
          return self2._onError(err);
        }
        if (typeof ws !== "function" && self2._ws.bufferedAmount > self2._maxBufferedAmount) {
          self2._debug("start backpressure: bufferedAmount %d", self2._ws.bufferedAmount);
          self2._cb = cb;
        } else {
          cb(null);
        }
      } else {
        self2._debug("write before connect");
        self2._chunk = chunk;
        self2._cb = cb;
      }
    };
    Socket.prototype._onMessage = function(event) {
      var self2 = this;
      if (self2.destroyed) return;
      var data = event.data;
      if (data instanceof ArrayBuffer) data = new Buffer(data);
      self2.push(data);
    };
    Socket.prototype._onOpen = function() {
      var self2 = this;
      if (self2.connected || self2.destroyed) return;
      self2.connected = true;
      if (self2._chunk) {
        try {
          self2.send(self2._chunk);
        } catch (err) {
          return self2._onError(err);
        }
        self2._chunk = null;
        self2._debug('sent chunk from "write before connect"');
        var cb = self2._cb;
        self2._cb = null;
        cb(null);
      }
      if (typeof ws !== "function") {
        self2._interval = setInterval(function() {
          if (!self2._cb || !self2._ws || self2._ws.bufferedAmount > self2._maxBufferedAmount) {
            return;
          }
          self2._debug("ending backpressure: bufferedAmount %d", self2._ws.bufferedAmount);
          var cb2 = self2._cb;
          self2._cb = null;
          cb2(null);
        }, 150);
        if (self2._interval.unref) self2._interval.unref();
      }
      self2._debug("connect");
      self2.emit("connect");
    };
    Socket.prototype._onClose = function() {
      var self2 = this;
      if (self2.destroyed) return;
      self2._debug("on close");
      self2._destroy();
    };
    Socket.prototype._onError = function(err) {
      var self2 = this;
      if (self2.destroyed) return;
      self2._debug("error: %s", err.message || err);
      self2._destroy(err);
    };
    Socket.prototype._debug = function() {
      var self2 = this;
      var args = [].slice.call(arguments);
      args[0] = "[" + self2._id + "] " + args[0];
      debug.apply(null, args);
    };
  }
});

// node_modules/bittorrent-tracker/lib/client/websocket-tracker.js
var require_websocket_tracker = __commonJS({
  "node_modules/bittorrent-tracker/lib/client/websocket-tracker.js"(exports2, module2) {
    module2.exports = WebSocketTracker;
    var debug = require_src()("bittorrent-tracker:websocket-tracker");
    var extend = require_immutable();
    var hat = require_hat();
    var inherits = require_inherits();
    var Peer = require_simple_peer();
    var Socket = require_simple_websocket();
    var common = require_common2();
    var Tracker = require_tracker();
    var socketPool = {};
    var RECONNECT_MINIMUM = 15 * 1e3;
    var RECONNECT_MAXIMUM = 30 * 60 * 1e3;
    var RECONNECT_VARIANCE = 30 * 1e3;
    var OFFER_TIMEOUT = 50 * 1e3;
    inherits(WebSocketTracker, Tracker);
    function WebSocketTracker(client, announceUrl, opts) {
      var self2 = this;
      Tracker.call(self2, client, announceUrl);
      debug("new websocket tracker %s", announceUrl);
      self2.peers = {};
      self2.socket = null;
      self2.reconnecting = false;
      self2.retries = 0;
      self2.reconnectTimer = null;
      self2._openSocket();
    }
    WebSocketTracker.prototype.DEFAULT_ANNOUNCE_INTERVAL = 30 * 1e3;
    WebSocketTracker.prototype.announce = function(opts) {
      var self2 = this;
      if (self2.destroyed || self2.reconnecting) return;
      if (!self2.socket.connected) {
        self2.socket.once("connect", function() {
          self2.announce(opts);
        });
        return;
      }
      var params = extend(opts, {
        action: "announce",
        info_hash: self2.client._infoHashBinary,
        peer_id: self2.client._peerIdBinary
      });
      if (self2._trackerId) params.trackerid = self2._trackerId;
      if (opts.event === "stopped") {
        self2._send(params);
      } else {
        var numwant = Math.min(opts.numwant, 5);
        self2._generateOffers(numwant, function(offers) {
          params.numwant = numwant;
          params.offers = offers;
          self2._send(params);
        });
      }
    };
    WebSocketTracker.prototype.scrape = function(opts) {
      var self2 = this;
      if (self2.destroyed || self2.reconnecting) return;
      if (!self2.socket.connected) {
        self2.socket.once("connect", function() {
          self2.scrape(opts);
        });
        return;
      }
      var infoHashes = Array.isArray(opts.infoHash) && opts.infoHash.length > 0 ? opts.infoHash.map(function(infoHash) {
        return infoHash.toString("binary");
      }) : opts.infoHash && opts.infoHash.toString("binary") || self2.client._infoHashBinary;
      var params = {
        action: "scrape",
        info_hash: infoHashes
      };
      self2._send(params);
    };
    WebSocketTracker.prototype.destroy = function(cb) {
      var self2 = this;
      if (!cb) cb = noop;
      if (self2.destroyed) return cb(null);
      self2.destroyed = true;
      clearInterval(self2.interval);
      clearTimeout(self2.reconnectTimer);
      if (self2.socket) {
        self2.socket.removeListener("connect", self2._onSocketConnectBound);
        self2.socket.removeListener("data", self2._onSocketDataBound);
        self2.socket.removeListener("close", self2._onSocketCloseBound);
        self2.socket.removeListener("error", self2._onSocketErrorBound);
      }
      self2._onSocketConnectBound = null;
      self2._onSocketErrorBound = null;
      self2._onSocketDataBound = null;
      self2._onSocketCloseBound = null;
      for (var peerId in self2.peers) {
        var peer = self2.peers[peerId];
        clearTimeout(peer.trackerTimeout);
        peer.destroy();
      }
      self2.peers = null;
      if (socketPool[self2.announceUrl]) {
        socketPool[self2.announceUrl].consumers -= 1;
      }
      if (socketPool[self2.announceUrl].consumers === 0) {
        delete socketPool[self2.announceUrl];
        try {
          self2.socket.on("error", noop);
          self2.socket.destroy(cb);
        } catch (err) {
          cb(null);
        }
      }
      self2.socket = null;
    };
    WebSocketTracker.prototype._openSocket = function() {
      var self2 = this;
      self2.destroyed = false;
      if (!self2.peers) self2.peers = {};
      self2._onSocketConnectBound = function() {
        self2._onSocketConnect();
      };
      self2._onSocketErrorBound = function(err) {
        self2._onSocketError(err);
      };
      self2._onSocketDataBound = function(data) {
        self2._onSocketData(data);
      };
      self2._onSocketCloseBound = function() {
        self2._onSocketClose();
      };
      self2.socket = socketPool[self2.announceUrl];
      if (self2.socket) {
        socketPool[self2.announceUrl].consumers += 1;
      } else {
        self2.socket = socketPool[self2.announceUrl] = new Socket(self2.announceUrl);
        self2.socket.consumers = 1;
        self2.socket.on("connect", self2._onSocketConnectBound);
      }
      self2.socket.on("data", self2._onSocketDataBound);
      self2.socket.on("close", self2._onSocketCloseBound);
      self2.socket.on("error", self2._onSocketErrorBound);
    };
    WebSocketTracker.prototype._onSocketConnect = function() {
      var self2 = this;
      if (self2.destroyed) return;
      if (self2.reconnecting) {
        self2.reconnecting = false;
        self2.retries = 0;
        self2.announce(self2.client._defaultAnnounceOpts());
      }
    };
    WebSocketTracker.prototype._onSocketData = function(data) {
      var self2 = this;
      if (self2.destroyed) return;
      try {
        data = JSON.parse(data);
      } catch (err) {
        self2.client.emit("warning", new Error("Invalid tracker response"));
        return;
      }
      if (data.action === "announce") {
        self2._onAnnounceResponse(data);
      } else if (data.action === "scrape") {
        self2._onScrapeResponse(data);
      } else {
        self2._onSocketError(new Error("invalid action in WS response: " + data.action));
      }
    };
    WebSocketTracker.prototype._onAnnounceResponse = function(data) {
      var self2 = this;
      if (data.info_hash !== self2.client._infoHashBinary) {
        debug(
          "ignoring websocket data from %s for %s (looking for %s: reused socket)",
          self2.announceUrl,
          common.binaryToHex(data.info_hash),
          self2.client.infoHash
        );
        return;
      }
      if (data.peer_id && data.peer_id === self2.client._peerIdBinary) {
        return;
      }
      debug(
        "received %s from %s for %s",
        JSON.stringify(data),
        self2.announceUrl,
        self2.client.infoHash
      );
      var failure = data["failure reason"];
      if (failure) return self2.client.emit("warning", new Error(failure));
      var warning = data["warning message"];
      if (warning) self2.client.emit("warning", new Error(warning));
      var interval = data.interval || data["min interval"];
      if (interval) self2.setInterval(interval * 1e3);
      var trackerId = data["tracker id"];
      if (trackerId) {
        self2._trackerId = trackerId;
      }
      if (data.complete != null) {
        self2.client.emit("update", {
          announce: self2.announceUrl,
          complete: data.complete,
          incomplete: data.incomplete
        });
      }
      var peer;
      if (data.offer && data.peer_id) {
        debug("creating peer (from remote offer)");
        peer = new Peer({
          trickle: false,
          config: self2.client._rtcConfig,
          wrtc: self2.client._wrtc
        });
        peer.id = common.binaryToHex(data.peer_id);
        peer.once("signal", function(answer) {
          var params = {
            action: "announce",
            info_hash: self2.client._infoHashBinary,
            peer_id: self2.client._peerIdBinary,
            to_peer_id: data.peer_id,
            answer,
            offer_id: data.offer_id
          };
          if (self2._trackerId) params.trackerid = self2._trackerId;
          self2._send(params);
        });
        peer.signal(data.offer);
        self2.client.emit("peer", peer);
      }
      if (data.answer && data.peer_id) {
        var offerId = common.binaryToHex(data.offer_id);
        peer = self2.peers[offerId];
        if (peer) {
          peer.id = common.binaryToHex(data.peer_id);
          peer.signal(data.answer);
          self2.client.emit("peer", peer);
          clearTimeout(peer.trackerTimeout);
          peer.trackerTimeout = null;
          delete self2.peers[offerId];
        } else {
          debug("got unexpected answer: " + JSON.stringify(data.answer));
        }
      }
    };
    WebSocketTracker.prototype._onScrapeResponse = function(data) {
      var self2 = this;
      data = data.files || {};
      var keys = Object.keys(data);
      if (keys.length === 0) {
        self2.client.emit("warning", new Error("invalid scrape response"));
        return;
      }
      keys.forEach(function(infoHash) {
        var response = data[infoHash];
        self2.client.emit("scrape", {
          announce: self2.announceUrl,
          infoHash: common.binaryToHex(infoHash),
          complete: response.complete,
          incomplete: response.incomplete,
          downloaded: response.downloaded
        });
      });
    };
    WebSocketTracker.prototype._onSocketClose = function() {
      var self2 = this;
      if (self2.destroyed) return;
      self2.destroy();
      self2._startReconnectTimer();
    };
    WebSocketTracker.prototype._onSocketError = function(err) {
      var self2 = this;
      if (self2.destroyed) return;
      self2.destroy();
      self2.client.emit("warning", err);
      self2._startReconnectTimer();
    };
    WebSocketTracker.prototype._startReconnectTimer = function() {
      var self2 = this;
      var ms = Math.floor(Math.random() * RECONNECT_VARIANCE) + Math.min(Math.pow(2, self2.retries) * RECONNECT_MINIMUM, RECONNECT_MAXIMUM);
      self2.reconnecting = true;
      clearTimeout(self2.reconnectTimer);
      self2.reconnectTimer = setTimeout(function() {
        self2.retries++;
        self2._openSocket();
      }, ms);
      if (self2.reconnectTimer.unref) self2.reconnectTimer.unref();
      debug("reconnecting socket in %s ms", ms);
    };
    WebSocketTracker.prototype._send = function(params) {
      var self2 = this;
      if (self2.destroyed) return;
      var message = JSON.stringify(params);
      debug("send %s", message);
      self2.socket.send(message);
    };
    WebSocketTracker.prototype._generateOffers = function(numwant, cb) {
      var self2 = this;
      var offers = [];
      debug("generating %s offers", numwant);
      for (var i = 0; i < numwant; ++i) {
        generateOffer();
      }
      checkDone();
      function generateOffer() {
        var offerId = hat(160);
        debug("creating peer (from _generateOffers)");
        var peer = self2.peers[offerId] = new Peer({
          initiator: true,
          trickle: false,
          config: self2.client._rtcConfig,
          wrtc: self2.client._wrtc
        });
        peer.once("signal", function(offer) {
          offers.push({
            offer,
            offer_id: common.hexToBinary(offerId)
          });
          checkDone();
        });
        peer.trackerTimeout = setTimeout(function() {
          debug("tracker timeout: destroying peer");
          peer.trackerTimeout = null;
          delete self2.peers[offerId];
          peer.destroy();
        }, OFFER_TIMEOUT);
        if (peer.trackerTimeout.unref) peer.trackerTimeout.unref();
      }
      function checkDone() {
        if (offers.length === numwant) {
          debug("generated %s offers", numwant);
          cb(offers);
        }
      }
    };
    function noop() {
    }
  }
});

// node_modules/bittorrent-tracker/client.js
var require_client2 = __commonJS({
  "node_modules/bittorrent-tracker/client.js"(exports2, module2) {
    module2.exports = Client;
    var debug = require_src()("bittorrent-tracker");
    var EventEmitter = require("events").EventEmitter;
    var extend = require_immutable();
    var inherits = require_inherits();
    var once = require_once();
    var parallel = require_run_parallel();
    var uniq = require_uniq();
    var url = require("url");
    var common = require_common2();
    var HTTPTracker = require_http_tracker();
    var UDPTracker = require_udp_tracker();
    var WebSocketTracker = require_websocket_tracker();
    inherits(Client, EventEmitter);
    function Client(peerId, port, torrent, opts) {
      var self2 = this;
      if (!(self2 instanceof Client)) return new Client(peerId, port, torrent, opts);
      EventEmitter.call(self2);
      if (!opts) opts = {};
      self2.peerId = typeof peerId === "string" ? peerId : peerId.toString("hex");
      self2.peerIdBuffer = new Buffer(self2.peerId, "hex");
      self2._peerIdBinary = self2.peerIdBuffer.toString("binary");
      self2.infoHash = typeof torrent.infoHash === "string" ? torrent.infoHash : torrent.infoHash.toString("hex");
      self2.infoHashBuffer = new Buffer(self2.infoHash, "hex");
      self2._infoHashBinary = self2.infoHashBuffer.toString("binary");
      self2.torrentLength = torrent.length;
      self2.destroyed = false;
      self2._port = port;
      self2._rtcConfig = opts.rtcConfig;
      self2._wrtc = opts.wrtc;
      self2._getAnnounceOpts = opts.getAnnounceOpts;
      debug("new client %s", self2.infoHash);
      var webrtcSupport = !!self2._wrtc || typeof window !== "undefined";
      var announce = typeof torrent.announce === "string" ? [torrent.announce] : torrent.announce == null ? [] : torrent.announce;
      announce = announce.map(function(announceUrl) {
        announceUrl = announceUrl.toString();
        if (announceUrl[announceUrl.length - 1] === "/") {
          announceUrl = announceUrl.substring(0, announceUrl.length - 1);
        }
        return announceUrl;
      });
      announce = uniq(announce);
      self2._trackers = announce.map(function(announceUrl) {
        var protocol = url.parse(announceUrl).protocol;
        if ((protocol === "http:" || protocol === "https:") && typeof HTTPTracker === "function") {
          return new HTTPTracker(self2, announceUrl);
        } else if (protocol === "udp:" && typeof UDPTracker === "function") {
          return new UDPTracker(self2, announceUrl);
        } else if ((protocol === "ws:" || protocol === "wss:") && webrtcSupport) {
          if (protocol === "ws:" && typeof window !== "undefined" && window.location.protocol === "https:") {
            nextTickWarn(new Error("Unsupported tracker protocol: " + announceUrl));
            return null;
          }
          return new WebSocketTracker(self2, announceUrl);
        } else {
          nextTickWarn(new Error("Unsupported tracker protocol: " + announceUrl));
          return null;
        }
      }).filter(Boolean);
      function nextTickWarn(err) {
        process.nextTick(function() {
          self2.emit("warning", err);
        });
      }
    }
    Client.scrape = function(announceUrl, infoHash, cb) {
      cb = once(cb);
      var peerId = new Buffer("01234567890123456789");
      var port = 6881;
      var torrent = {
        infoHash: Array.isArray(infoHash) ? infoHash[0] : infoHash,
        announce: [announceUrl]
      };
      var client = new Client(peerId, port, torrent);
      client.once("error", cb);
      var len = Array.isArray(infoHash) ? infoHash.length : 1;
      var results = {};
      client.on("scrape", function(data) {
        len -= 1;
        results[data.infoHash] = data;
        if (len === 0) {
          client.destroy();
          var keys = Object.keys(results);
          if (keys.length === 1) {
            cb(null, results[keys[0]]);
          } else {
            cb(null, results);
          }
        }
      });
      infoHash = Array.isArray(infoHash) ? infoHash.map(function(infoHash2) {
        return new Buffer(infoHash2, "hex");
      }) : new Buffer(infoHash, "hex");
      client.scrape({ infoHash });
    };
    Client.prototype.start = function(opts) {
      var self2 = this;
      debug("send `start`");
      opts = self2._defaultAnnounceOpts(opts);
      opts.event = "started";
      self2._announce(opts);
      self2._trackers.forEach(function(tracker) {
        tracker.setInterval();
      });
    };
    Client.prototype.stop = function(opts) {
      var self2 = this;
      debug("send `stop`");
      opts = self2._defaultAnnounceOpts(opts);
      opts.event = "stopped";
      self2._announce(opts);
    };
    Client.prototype.complete = function(opts) {
      var self2 = this;
      debug("send `complete`");
      if (!opts) opts = {};
      if (opts.downloaded == null && self2.torrentLength != null) {
        opts.downloaded = self2.torrentLength;
      }
      opts = self2._defaultAnnounceOpts(opts);
      opts.event = "completed";
      self2._announce(opts);
    };
    Client.prototype.update = function(opts) {
      var self2 = this;
      debug("send `update`");
      opts = self2._defaultAnnounceOpts(opts);
      if (opts.event) delete opts.event;
      self2._announce(opts);
    };
    Client.prototype._announce = function(opts) {
      var self2 = this;
      self2._trackers.forEach(function(tracker) {
        tracker.announce(opts);
      });
    };
    Client.prototype.scrape = function(opts) {
      var self2 = this;
      debug("send `scrape`");
      if (!opts) opts = {};
      self2._trackers.forEach(function(tracker) {
        tracker.scrape(opts);
      });
    };
    Client.prototype.setInterval = function(intervalMs) {
      var self2 = this;
      debug("setInterval %d", intervalMs);
      self2._trackers.forEach(function(tracker) {
        tracker.setInterval(intervalMs);
      });
    };
    Client.prototype.destroy = function(cb) {
      var self2 = this;
      if (self2.destroyed) return;
      self2.destroyed = true;
      debug("destroy");
      var tasks = self2._trackers.map(function(tracker) {
        return function(cb2) {
          tracker.destroy(cb2);
        };
      });
      parallel(tasks, cb);
      self2._trackers = [];
    };
    Client.prototype._defaultAnnounceOpts = function(opts) {
      var self2 = this;
      if (!opts) opts = {};
      if (opts.numwant == null) opts.numwant = common.DEFAULT_ANNOUNCE_PEERS;
      if (opts.uploaded == null) opts.uploaded = 0;
      if (opts.downloaded == null) opts.downloaded = 0;
      if (opts.left == null && self2.torrentLength != null) {
        opts.left = self2.torrentLength - opts.downloaded;
      }
      if (self2._getAnnounceOpts) opts = extend(opts, self2._getAnnounceOpts());
      return opts;
    };
  }
});

// node_modules/torrent-discovery/index.js
var require_torrent_discovery = __commonJS({
  "node_modules/torrent-discovery/index.js"(exports2, module2) {
    module2.exports = Discovery;
    var debug = require_src()("torrent-discovery");
    var DHT = require_client();
    var EventEmitter = require("events").EventEmitter;
    var extend = require_immutable();
    var inherits = require_inherits();
    var parallel = require_run_parallel();
    var reemit = require_re_emitter();
    var Tracker = require_client2();
    inherits(Discovery, EventEmitter);
    function Discovery(opts) {
      var self2 = this;
      if (!(self2 instanceof Discovery)) return new Discovery(opts);
      EventEmitter.call(self2);
      self2.announce = opts.announce || [];
      self2.rtcConfig = opts.rtcConfig;
      self2.peerId = opts.peerId;
      self2.port = opts.port || 0;
      self2.wrtc = opts.wrtc;
      self2.intervalMs = opts.intervalMs || 15 * 60 * 1e3;
      self2.destroyed = false;
      if (!self2.peerId) throw new Error("peerId required");
      if (!process.browser && !self2.port) throw new Error("port required");
      self2.infoHash = null;
      self2.infoHashBuffer = null;
      self2.torrent = null;
      self2._dhtAnnouncing = false;
      self2._dhtTimeout = false;
      self2._internalDHT = false;
      if (opts.tracker === false) {
        self2.tracker = false;
      } else {
        self2.tracker = true;
      }
      if (opts.dht === false) {
        self2.dht = false;
      } else if (typeof opts.dht === "object") {
        self2.dht = opts.dht;
      } else {
        self2.dht = createDHT();
      }
      if (self2.dht) {
        self2.dht.on("peer", onPeer);
      }
      function createDHT() {
        if (typeof DHT !== "function") return false;
        self2._internalDHT = true;
        var dht = new DHT();
        reemit(dht, self2, ["error", "warning"]);
        dht.listen(opts.dhtPort);
        return dht;
      }
      function onPeer(peer, infoHash) {
        if (infoHash.toString("hex") !== self2.infoHash) return;
        self2.emit("peer", peer.host + ":" + peer.port);
      }
    }
    Discovery.prototype.setTorrent = function(torrent) {
      var self2 = this;
      if (!self2.infoHash && (typeof torrent === "string" || Buffer.isBuffer(torrent))) {
        self2.infoHash = typeof torrent === "string" ? torrent : torrent.toString("hex");
      } else if (!self2.torrent && torrent && torrent.infoHash) {
        self2.torrent = torrent;
        self2.infoHash = typeof torrent.infoHash === "string" ? torrent.infoHash : torrent.infoHash.toString("hex");
      } else {
        return;
      }
      self2.infoHashBuffer = new Buffer(self2.infoHash, "hex");
      debug("setTorrent %s", self2.infoHash);
      if (self2.tracker && self2.tracker !== true) {
        self2.tracker.torrentLength = torrent.length;
      } else {
        self2._createTracker();
      }
      self2._dhtAnnounce();
    };
    Discovery.prototype.updatePort = function(port) {
      var self2 = this;
      if (port === self2.port) return;
      self2.port = port;
      self2._dhtAnnounce();
      if (self2.tracker && self2.tracker !== true) {
        self2.tracker.stop();
        self2.tracker.destroy(function() {
          self2._createTracker();
        });
      }
    };
    Discovery.prototype.stop = function(cb) {
      var self2 = this;
      self2.destroyed = true;
      clearTimeout(self2._dhtTimeout);
      var tasks = [];
      if (self2.tracker && self2.tracker !== true) {
        self2.tracker.stop();
        tasks.push(function(cb2) {
          self2.tracker.destroy(cb2);
        });
      }
      if (self2._internalDHT) {
        tasks.push(function(cb2) {
          self2.dht.destroy(cb2);
        });
      }
      parallel(tasks, cb);
    };
    Discovery.prototype._createTracker = function() {
      var self2 = this;
      if (!self2.tracker) return;
      var torrent = self2.torrent ? extend({ announce: [] }, self2.torrent) : { infoHash: self2.infoHash, announce: [] };
      if (self2.announce) torrent.announce = torrent.announce.concat(self2.announce);
      var trackerOpts = {
        rtcConfig: self2.rtcConfig,
        wrtc: self2.wrtc
      };
      self2.tracker = new Tracker(self2.peerId, self2.port, torrent, trackerOpts);
      reemit(self2.tracker, self2, ["peer", "warning", "error"]);
      self2.tracker.setInterval(self2.intervalMs);
      self2.tracker.on("update", onUpdate);
      self2.tracker.start();
      function onUpdate(data) {
        self2.emit("trackerAnnounce", data);
      }
    };
    Discovery.prototype._dhtAnnounce = function() {
      var self2 = this;
      if (!self2.port || !self2.infoHash || !self2.dht || self2._dhtAnnouncing) return;
      debug("dht announce");
      self2._dhtAnnouncing = true;
      clearTimeout(self2._dhtTimeout);
      self2.dht.announce(self2.infoHash, self2.port, function(err) {
        self2._dhtAnnouncing = false;
        debug("dht announce complete");
        if (err) self2.emit("warning", err);
        self2.emit("dhtAnnounce");
        if (!self2.destroyed) {
          self2._dhtTimeout = setTimeout(function() {
            self2._dhtAnnounce();
          }, getRandomTimeout());
        }
      });
      function getRandomTimeout() {
        return self2.intervalMs + Math.floor(Math.random() * self2.intervalMs / 5);
      }
    };
  }
});

// node_modules/ip/lib/ip.js
var require_ip = __commonJS({
  "node_modules/ip/lib/ip.js"(exports2) {
    var ip = exports2;
    var { Buffer: Buffer2 } = require("buffer");
    var os2 = require("os");
    ip.toBuffer = function(ip2, buff, offset) {
      offset = ~~offset;
      var result;
      if (this.isV4Format(ip2)) {
        result = buff || new Buffer2(offset + 4);
        ip2.split(/\./g).map((byte) => {
          result[offset++] = parseInt(byte, 10) & 255;
        });
      } else if (this.isV6Format(ip2)) {
        var sections = ip2.split(":", 8);
        var i;
        for (i = 0; i < sections.length; i++) {
          var isv4 = this.isV4Format(sections[i]);
          var v4Buffer;
          if (isv4) {
            v4Buffer = this.toBuffer(sections[i]);
            sections[i] = v4Buffer.slice(0, 2).toString("hex");
          }
          if (v4Buffer && ++i < 8) {
            sections.splice(i, 0, v4Buffer.slice(2, 4).toString("hex"));
          }
        }
        if (sections[0] === "") {
          while (sections.length < 8) sections.unshift("0");
        } else if (sections[sections.length - 1] === "") {
          while (sections.length < 8) sections.push("0");
        } else if (sections.length < 8) {
          for (i = 0; i < sections.length && sections[i] !== ""; i++) ;
          var argv = [i, 1];
          for (i = 9 - sections.length; i > 0; i--) {
            argv.push("0");
          }
          sections.splice.apply(sections, argv);
        }
        result = buff || new Buffer2(offset + 16);
        for (i = 0; i < sections.length; i++) {
          var word = parseInt(sections[i], 16);
          result[offset++] = word >> 8 & 255;
          result[offset++] = word & 255;
        }
      }
      if (!result) {
        throw Error(`Invalid ip address: ${ip2}`);
      }
      return result;
    };
    ip.toString = function(buff, offset, length) {
      offset = ~~offset;
      length = length || buff.length - offset;
      var result = [];
      var i;
      if (length === 4) {
        for (i = 0; i < length; i++) {
          result.push(buff[offset + i]);
        }
        result = result.join(".");
      } else if (length === 16) {
        for (i = 0; i < length; i += 2) {
          result.push(buff.readUInt16BE(offset + i).toString(16));
        }
        result = result.join(":");
        result = result.replace(/(^|:)0(:0)*:0(:|$)/, "$1::$3");
        result = result.replace(/:{3,4}/, "::");
      }
      return result;
    };
    var ipv4Regex = /^(\d{1,3}\.){3,3}\d{1,3}$/;
    var ipv6Regex = /^(::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-f]){0,4}:{0,2}){1,8}(::)?$/i;
    ip.isV4Format = function(ip2) {
      return ipv4Regex.test(ip2);
    };
    ip.isV6Format = function(ip2) {
      return ipv6Regex.test(ip2);
    };
    function _normalizeFamily(family) {
      if (family === 4) {
        return "ipv4";
      }
      if (family === 6) {
        return "ipv6";
      }
      return family ? family.toLowerCase() : "ipv4";
    }
    ip.fromPrefixLen = function(prefixlen, family) {
      if (prefixlen > 32) {
        family = "ipv6";
      } else {
        family = _normalizeFamily(family);
      }
      var len = 4;
      if (family === "ipv6") {
        len = 16;
      }
      var buff = new Buffer2(len);
      for (var i = 0, n = buff.length; i < n; ++i) {
        var bits = 8;
        if (prefixlen < 8) {
          bits = prefixlen;
        }
        prefixlen -= bits;
        buff[i] = ~(255 >> bits) & 255;
      }
      return ip.toString(buff);
    };
    ip.mask = function(addr, mask) {
      addr = ip.toBuffer(addr);
      mask = ip.toBuffer(mask);
      var result = new Buffer2(Math.max(addr.length, mask.length));
      var i;
      if (addr.length === mask.length) {
        for (i = 0; i < addr.length; i++) {
          result[i] = addr[i] & mask[i];
        }
      } else if (mask.length === 4) {
        for (i = 0; i < mask.length; i++) {
          result[i] = addr[addr.length - 4 + i] & mask[i];
        }
      } else {
        for (i = 0; i < result.length - 6; i++) {
          result[i] = 0;
        }
        result[10] = 255;
        result[11] = 255;
        for (i = 0; i < addr.length; i++) {
          result[i + 12] = addr[i] & mask[i + 12];
        }
        i += 12;
      }
      for (; i < result.length; i++) {
        result[i] = 0;
      }
      return ip.toString(result);
    };
    ip.cidr = function(cidrString) {
      var cidrParts = cidrString.split("/");
      var addr = cidrParts[0];
      if (cidrParts.length !== 2) {
        throw new Error(`invalid CIDR subnet: ${addr}`);
      }
      var mask = ip.fromPrefixLen(parseInt(cidrParts[1], 10));
      return ip.mask(addr, mask);
    };
    ip.subnet = function(addr, mask) {
      var networkAddress = ip.toLong(ip.mask(addr, mask));
      var maskBuffer = ip.toBuffer(mask);
      var maskLength = 0;
      for (var i = 0; i < maskBuffer.length; i++) {
        if (maskBuffer[i] === 255) {
          maskLength += 8;
        } else {
          var octet = maskBuffer[i] & 255;
          while (octet) {
            octet = octet << 1 & 255;
            maskLength++;
          }
        }
      }
      var numberOfAddresses = Math.pow(2, 32 - maskLength);
      return {
        networkAddress: ip.fromLong(networkAddress),
        firstAddress: numberOfAddresses <= 2 ? ip.fromLong(networkAddress) : ip.fromLong(networkAddress + 1),
        lastAddress: numberOfAddresses <= 2 ? ip.fromLong(networkAddress + numberOfAddresses - 1) : ip.fromLong(networkAddress + numberOfAddresses - 2),
        broadcastAddress: ip.fromLong(networkAddress + numberOfAddresses - 1),
        subnetMask: mask,
        subnetMaskLength: maskLength,
        numHosts: numberOfAddresses <= 2 ? numberOfAddresses : numberOfAddresses - 2,
        length: numberOfAddresses,
        contains(other) {
          return networkAddress === ip.toLong(ip.mask(other, mask));
        }
      };
    };
    ip.cidrSubnet = function(cidrString) {
      var cidrParts = cidrString.split("/");
      var addr = cidrParts[0];
      if (cidrParts.length !== 2) {
        throw new Error(`invalid CIDR subnet: ${addr}`);
      }
      var mask = ip.fromPrefixLen(parseInt(cidrParts[1], 10));
      return ip.subnet(addr, mask);
    };
    ip.not = function(addr) {
      var buff = ip.toBuffer(addr);
      for (var i = 0; i < buff.length; i++) {
        buff[i] = 255 ^ buff[i];
      }
      return ip.toString(buff);
    };
    ip.or = function(a, b) {
      var i;
      a = ip.toBuffer(a);
      b = ip.toBuffer(b);
      if (a.length === b.length) {
        for (i = 0; i < a.length; ++i) {
          a[i] |= b[i];
        }
        return ip.toString(a);
      }
      var buff = a;
      var other = b;
      if (b.length > a.length) {
        buff = b;
        other = a;
      }
      var offset = buff.length - other.length;
      for (i = offset; i < buff.length; ++i) {
        buff[i] |= other[i - offset];
      }
      return ip.toString(buff);
    };
    ip.isEqual = function(a, b) {
      var i;
      a = ip.toBuffer(a);
      b = ip.toBuffer(b);
      if (a.length === b.length) {
        for (i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) return false;
        }
        return true;
      }
      if (b.length === 4) {
        var t = b;
        b = a;
        a = t;
      }
      for (i = 0; i < 10; i++) {
        if (b[i] !== 0) return false;
      }
      var word = b.readUInt16BE(10);
      if (word !== 0 && word !== 65535) return false;
      for (i = 0; i < 4; i++) {
        if (a[i] !== b[i + 12]) return false;
      }
      return true;
    };
    ip.isPrivate = function(addr) {
      if (ip.isLoopback(addr)) {
        return true;
      }
      if (!ip.isV6Format(addr)) {
        const ipl = ip.normalizeToLong(addr);
        if (ipl < 0) {
          throw new Error("invalid ipv4 address");
        }
        addr = ip.fromLong(ipl);
      }
      return /^(::f{4}:)?10\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(addr) || /^(::f{4}:)?192\.168\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(addr) || /^(::f{4}:)?172\.(1[6-9]|2\d|30|31)\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(addr) || /^(::f{4}:)?169\.254\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(addr) || /^f[cd][0-9a-f]{2}:/i.test(addr) || /^fe80:/i.test(addr) || /^::1$/.test(addr) || /^::$/.test(addr);
    };
    ip.isPublic = function(addr) {
      return !ip.isPrivate(addr);
    };
    ip.isLoopback = function(addr) {
      if (!/\./.test(addr) && !/:/.test(addr)) {
        addr = ip.fromLong(Number(addr));
      }
      return /^(::f{4}:)?127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/.test(addr) || /^0177\./.test(addr) || /^0x7f\./i.test(addr) || /^fe80::1$/i.test(addr) || /^::1$/.test(addr) || /^::$/.test(addr);
    };
    ip.loopback = function(family) {
      family = _normalizeFamily(family);
      if (family !== "ipv4" && family !== "ipv6") {
        throw new Error("family must be ipv4 or ipv6");
      }
      return family === "ipv4" ? "127.0.0.1" : "fe80::1";
    };
    ip.address = function(name, family) {
      var interfaces = os2.networkInterfaces();
      family = _normalizeFamily(family);
      if (name && name !== "private" && name !== "public") {
        var res = interfaces[name].filter((details) => {
          var itemFamily = _normalizeFamily(details.family);
          return itemFamily === family;
        });
        if (res.length === 0) {
          return void 0;
        }
        return res[0].address;
      }
      var all = Object.keys(interfaces).map((nic) => {
        var addresses = interfaces[nic].filter((details) => {
          details.family = _normalizeFamily(details.family);
          if (details.family !== family || ip.isLoopback(details.address)) {
            return false;
          }
          if (!name) {
            return true;
          }
          return name === "public" ? ip.isPrivate(details.address) : ip.isPublic(details.address);
        });
        return addresses.length ? addresses[0].address : void 0;
      }).filter(Boolean);
      return !all.length ? ip.loopback(family) : all[0];
    };
    ip.toLong = function(ip2) {
      var ipl = 0;
      ip2.split(".").forEach((octet) => {
        ipl <<= 8;
        ipl += parseInt(octet);
      });
      return ipl >>> 0;
    };
    ip.fromLong = function(ipl) {
      return `${ipl >>> 24}.${ipl >> 16 & 255}.${ipl >> 8 & 255}.${ipl & 255}`;
    };
    ip.normalizeToLong = function(addr) {
      const parts = addr.split(".").map((part) => {
        if (part.startsWith("0x") || part.startsWith("0X")) {
          return parseInt(part, 16);
        } else if (part.startsWith("0") && part !== "0" && /^[0-7]+$/.test(part)) {
          return parseInt(part, 8);
        } else if (/^[1-9]\d*$/.test(part) || part === "0") {
          return parseInt(part, 10);
        } else {
          return NaN;
        }
      });
      if (parts.some(isNaN)) return -1;
      let val = 0;
      const n = parts.length;
      switch (n) {
        case 1:
          val = parts[0];
          break;
        case 2:
          if (parts[0] > 255 || parts[1] > 16777215) return -1;
          val = parts[0] << 24 | parts[1] & 16777215;
          break;
        case 3:
          if (parts[0] > 255 || parts[1] > 255 || parts[2] > 65535) return -1;
          val = parts[0] << 24 | parts[1] << 16 | parts[2] & 65535;
          break;
        case 4:
          if (parts.some((part) => part > 255)) return -1;
          val = parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3];
          break;
        default:
          return -1;
      }
      return val >>> 0;
    };
  }
});

// node_modules/ip-set/index.js
var require_ip_set = __commonJS({
  "node_modules/ip-set/index.js"(exports2, module2) {
    var ip = require_ip();
    function IPSet(start, end) {
      this.start = start;
      this.end = end;
      this.max = end;
      this.depth = 1;
      this.left = null;
      this.right = null;
    }
    IPSet.prototype.add = function(start, end) {
      var d = start - this.start;
      var update = false;
      if (d === 0 && this.end < end) {
        this.end = end;
        update = true;
      } else if (d < 0) {
        if (this.left) {
          update = this.left.add(start, end);
          if (update) this._balance();
        } else {
          this.left = new IPSet(start, end);
          update = true;
        }
      } else if (d > 0) {
        if (this.right) {
          update = this.right.add(start, end);
          if (update) this._balance();
        } else {
          this.right = new IPSet(start, end);
          update = true;
        }
      }
      if (update) this._update();
      return update;
    };
    IPSet.prototype.contains = function(addr) {
      var node = this;
      while (node && !(addr >= node.start && addr <= node.end)) {
        if (node.left && node.left.max >= addr) node = node.left;
        else node = node.right;
      }
      return !!node;
    };
    IPSet.prototype._balance = function() {
      var ldepth = this.left ? this.left.depth : 0;
      var rdepth = this.right ? this.right.depth : 0;
      if (ldepth > rdepth + 1) {
        var lldepth = this.left.left ? this.left.left.depth : 0;
        var lrdepth = this.left.right ? this.left.right.depth : 0;
        if (lldepth < lrdepth) this.left._rotateRR();
        this._rotateLL();
      } else if (ldepth + 1 < rdepth) {
        var rrdepth = this.right.right ? this.right.right.depth : 0;
        var rldepth = this.right.left ? this.right.left.depth : 0;
        if (rldepth > rrdepth) this.right._rotateLL();
        this._rotateRR();
      }
    };
    IPSet.prototype._rotateLL = function() {
      var _start = this.start;
      var _end = this.end;
      var _right = this.right;
      this.start = this.left.start;
      this.end = this.left.end;
      this.right = this.left;
      this.left = this.left.left;
      this.right.left = this.right.right;
      this.right.right = _right;
      this.right.start = _start;
      this.right.end = _end;
      this.right._update();
      this._update();
    };
    IPSet.prototype._rotateRR = function() {
      var _start = this.start;
      var _end = this.end;
      var _left = this.left;
      this.start = this.right.start;
      this.end = this.right.end;
      this.end = this.right.end;
      this.left = this.right;
      this.right = this.right.right;
      this.left.right = this.left.left;
      this.left.left = _left;
      this.left.start = _start;
      this.left.end = _end;
      this.left._update();
      this._update();
    };
    IPSet.prototype._update = function() {
      this.depth = 1;
      if (this.left) this.depth = this.left.depth + 1;
      if (this.right && this.depth <= this.right.depth) this.depth = this.right.depth + 1;
      this.max = Math.max(this.end, this.left ? this.left.max : 0, this.right ? this.right.max : 0);
    };
    module2.exports = function(blocklist) {
      var tree = null;
      var self2 = {};
      self2.add = function(start, end) {
        if (!start) return;
        if (typeof start === "object") {
          end = start.end;
          start = start.start;
        }
        var cidrStr = /\/\d{1,2}/;
        if (typeof start === "string" && cidrStr.test(start)) {
          var ipSubnet = ip.cidrSubnet(start);
          start = ipSubnet.networkAddress;
          end = ipSubnet.broadcastAddress;
        }
        if (typeof start !== "number") start = ip.toLong(start);
        if (!end) end = start;
        if (typeof end !== "number") end = ip.toLong(end);
        if (start < 0 || end > 4294967295 || end < start) throw new Error("Invalid block range");
        if (tree) tree.add(start, end);
        else tree = new IPSet(start, end);
      };
      self2.contains = function(addr) {
        if (!tree) return false;
        if (typeof addr !== "number") addr = ip.toLong(addr);
        return tree.contains(addr);
      };
      if (Array.isArray(blocklist)) {
        blocklist.forEach(function(block) {
          self2.add(block);
        });
      }
      return self2;
    };
  }
});

// node_modules/torrent-stream/lib/exchange-metadata.js
var require_exchange_metadata = __commonJS({
  "node_modules/torrent-stream/lib/exchange-metadata.js"(exports2, module2) {
    var bncode = require_bncode();
    var crypto = require("crypto");
    var METADATA_BLOCK_SIZE = 1 << 14;
    var METADATA_MAX_SIZE = 1 << 22;
    var EXTENSIONS = {
      m: {
        ut_metadata: 1
      }
    };
    var sha1 = function(data) {
      return crypto.createHash("sha1").update(data).digest("hex");
    };
    module2.exports = function(engine, callback) {
      var metadataPieces = [];
      return function(wire) {
        var metadata = engine.metadata;
        wire.once("extended", function(id, handshake) {
          try {
            handshake = bncode.decode(handshake);
          } catch (err) {
            return;
          }
          if (id || !handshake.m || handshake.m.ut_metadata === void 0) return;
          var channel = handshake.m.ut_metadata;
          var size = handshake.metadata_size;
          wire.on("extended", function(id2, ext) {
            if (id2 !== EXTENSIONS.m.ut_metadata) return;
            var metadata2 = engine.metadata;
            var delimiter, message, piece;
            try {
              delimiter = ext.toString("ascii").indexOf("ee");
              message = bncode.decode(ext.slice(0, delimiter === -1 ? ext.length : delimiter + 2));
              piece = message.piece;
            } catch (err) {
              return;
            }
            if (piece < 0) return;
            if (message.msg_type === 2) return;
            if (message.msg_type === 0) {
              if (!metadata2) return wire.extended(channel, { msg_type: 2, piece });
              var offset = piece * METADATA_BLOCK_SIZE;
              var buf = metadata2.slice(offset, offset + METADATA_BLOCK_SIZE);
              wire.extended(channel, Buffer.concat([bncode.encode({ msg_type: 1, piece }), buf]));
              return;
            }
            if (message.msg_type === 1 && !metadata2) {
              metadataPieces[piece] = ext.slice(delimiter + 2);
              for (var i2 = 0; i2 * METADATA_BLOCK_SIZE < size; i2++) {
                if (!metadataPieces[i2]) return;
              }
              metadata2 = Buffer.concat(metadataPieces);
              if (engine.infoHash !== sha1(metadata2)) {
                metadataPieces = [];
                metadata2 = null;
                return;
              }
              callback(engine.metadata = metadata2);
            }
          });
          if (size > METADATA_MAX_SIZE) return;
          if (!size || metadata) return;
          for (var i = 0; i * METADATA_BLOCK_SIZE < size; i++) {
            if (metadataPieces[i]) continue;
            wire.extended(channel, { msg_type: 0, piece: i });
          }
        });
        if (!wire.peerExtensions.extended) return;
        wire.extended(0, metadata ? { m: { ut_metadata: 1 }, metadata_size: metadata.length } : { m: { ut_metadata: 1 } });
      };
    };
  }
});

// node_modules/torrent-stream/lib/file-stream.js
var require_file_stream = __commonJS({
  "node_modules/torrent-stream/lib/file-stream.js"(exports2, module2) {
    var stream = require("stream");
    var util = require("util");
    var FileStream = function(engine, file, opts) {
      if (!(this instanceof FileStream)) return new FileStream(engine, file, opts);
      stream.Readable.call(this);
      if (!opts) opts = {};
      if (!opts.start) opts.start = 0;
      if (!opts.end && typeof opts.end !== "number") opts.end = file.length - 1;
      var offset = opts.start + file.offset;
      var pieceLength = engine.torrent.pieceLength;
      this.length = opts.end - opts.start + 1;
      this.startPiece = offset / pieceLength | 0;
      this.endPiece = (opts.end + file.offset) / pieceLength | 0;
      this._destroyed = false;
      this._engine = engine;
      this._piece = this.startPiece;
      this._missing = this.length;
      this._reading = false;
      this._notifying = false;
      this._critical = Math.min(1024 * 1024 / pieceLength, 2) | 0;
      this._offset = offset - this.startPiece * pieceLength;
    };
    util.inherits(FileStream, stream.Readable);
    FileStream.prototype._read = function() {
      if (this._reading) return;
      this._reading = true;
      this.notify();
    };
    FileStream.prototype.notify = function() {
      if (!this._reading || !this._missing) return;
      if (!this._engine.bitfield.get(this._piece)) return this._engine.critical(this._piece, this._critical);
      var self2 = this;
      if (this._notifying) return;
      this._notifying = true;
      this._engine.store.get(this._piece++, function(err, buffer) {
        self2._notifying = false;
        if (self2._destroyed || !self2._reading) return;
        if (err) return self2.destroy(err);
        if (self2._offset) {
          buffer = buffer.slice(self2._offset);
          self2._offset = 0;
        }
        if (self2._missing < buffer.length) buffer = buffer.slice(0, self2._missing);
        self2._missing -= buffer.length;
        if (!self2._missing) {
          self2.push(buffer);
          self2.push(null);
          return;
        }
        self2._reading = false;
        self2.push(buffer);
      });
    };
    FileStream.prototype.destroy = function() {
      if (this._destroyed) return;
      this._destroyed = true;
      this.emit("close");
    };
    module2.exports = FileStream;
  }
});

// node_modules/torrent-stream/index.js
var require_torrent_stream = __commonJS({
  "node_modules/torrent-stream/index.js"(exports2, module2) {
    var hat = require_hat();
    var pws = require_peer_wire_swarm();
    var bncode = require_bncode();
    var crypto = require("crypto");
    var bitfield = require_bitfield();
    var parseTorrent = require_parse_torrent();
    var mkdirp = require_mkdirp();
    var events = require("events");
    var path2 = require("path");
    var fs2 = require("fs");
    var os2 = require("os");
    var eos = require_end_of_stream();
    var piece = require_torrent_piece();
    var rimraf = require_rimraf();
    var FSChunkStore = require_fs_chunk_store();
    var ImmediateChunkStore = require_immediate_chunk_store();
    var peerDiscovery = require_torrent_discovery();
    var bufferFrom = require_buffer_from();
    var blocklist = require_ip_set();
    var exchangeMetadata = require_exchange_metadata();
    var fileStream = require_file_stream();
    var MAX_REQUESTS = 5;
    var CHOKE_TIMEOUT = 5e3;
    var REQUEST_TIMEOUT = 3e4;
    var SPEED_THRESHOLD = 3 * piece.BLOCK_LENGTH;
    var DEFAULT_PORT = 6881;
    var BAD_PIECE_STRIKES_MAX = 3;
    var BAD_PIECE_STRIKES_DURATION = 12e4;
    var RECHOKE_INTERVAL = 1e4;
    var RECHOKE_OPTIMISTIC_DURATION = 2;
    var TMP = fs2.existsSync("/tmp") ? "/tmp" : os2.tmpdir ? os2.tmpdir() : os2.tmpDir();
    var noop = function() {
    };
    var sha1 = function(data) {
      return crypto.createHash("sha1").update(data).digest("hex");
    };
    var thruthy = function() {
      return true;
    };
    var falsy = function() {
      return false;
    };
    var toNumber = function(val) {
      return val === true ? 1 : val || 0;
    };
    var torrentStream2 = function(link, opts, cb) {
      if (typeof opts === "function") return torrentStream2(link, null, opts);
      link = parseTorrent(link);
      var metadata = link.infoBuffer || null;
      var infoHash = link.infoHash;
      if (!opts) opts = {};
      if (!opts.id) opts.id = "-TS0008-" + hat(48);
      if (!opts.tmp) opts.tmp = TMP;
      if (!opts.name) opts.name = "torrent-stream";
      if (!opts.flood) opts.flood = 0;
      if (!opts.pulse) opts.pulse = Number.MAX_SAFE_INTEGER;
      var usingTmp = false;
      var destroyed = false;
      if (!opts.path) {
        usingTmp = true;
        opts.path = path2.join(opts.tmp, opts.name, infoHash);
      }
      var engine = new events.EventEmitter();
      var swarm = pws(infoHash, opts.id, { size: opts.connections || opts.size, speed: 10 });
      var torrentPath = path2.join(opts.tmp, opts.name, infoHash + ".torrent");
      if (cb) engine.on("ready", cb.bind(null, engine));
      engine.ready = function(cb2) {
        if (engine.torrent) cb2();
        else engine.once("ready", cb2);
      };
      var wires = swarm.wires;
      var critical = [];
      var refresh = noop;
      var rechokeSlots = opts.uploads === false || opts.uploads === 0 ? 0 : +opts.uploads || 10;
      var rechokeOptimistic = null;
      var rechokeOptimisticTime = 0;
      var rechokeIntervalId;
      engine.infoHash = infoHash;
      engine.metadata = metadata;
      engine.path = opts.path;
      engine.files = [];
      engine.selection = [];
      engine.torrent = null;
      engine.bitfield = null;
      engine.amInterested = false;
      engine.store = null;
      engine.swarm = swarm;
      engine._flood = opts.flood;
      engine._pulse = opts.pulse;
      var discovery = peerDiscovery({
        peerId: bufferFrom(opts.id),
        dht: opts.dht !== void 0 ? opts.dht : true,
        tracker: opts.tracker !== void 0 ? opts.tracker : true,
        port: DEFAULT_PORT,
        announce: opts.trackers
      });
      var blocked = blocklist(opts.blocklist);
      discovery.on("peer", function(addr) {
        if (blocked.contains(addr.split(":")[0])) {
          engine.emit("blocked-peer", addr);
        } else {
          engine.emit("peer", addr);
          engine.connect(addr);
        }
      });
      var ontorrent = function(torrent) {
        var storage = opts.storage || FSChunkStore;
        engine.store = ImmediateChunkStore(storage(torrent.pieceLength, {
          files: torrent.files.map(function(file) {
            return {
              path: path2.join(opts.path, file.path),
              length: file.length,
              offset: file.offset
            };
          })
        }));
        engine.torrent = torrent;
        engine.bitfield = bitfield(torrent.pieces.length);
        var pieceLength = torrent.pieceLength;
        var pieceRemainder = torrent.length % pieceLength || pieceLength;
        var pieces = torrent.pieces.map(function(hash, i) {
          return piece(i === torrent.pieces.length - 1 ? pieceRemainder : pieceLength);
        });
        var reservations = torrent.pieces.map(function() {
          return [];
        });
        process.nextTick(function() {
          discovery.setTorrent(torrent);
        });
        engine.files = torrent.files.map(function(file) {
          file = Object.create(file);
          var offsetPiece = file.offset / torrent.pieceLength | 0;
          var endPiece = (file.offset + file.length - 1) / torrent.pieceLength | 0;
          file.deselect = function() {
            engine.deselect(offsetPiece, endPiece, false);
          };
          file.select = function() {
            engine.select(offsetPiece, endPiece, false);
          };
          file.createReadStream = function(opts2) {
            var stream = fileStream(engine, file, opts2);
            var notify = stream.notify.bind(stream);
            engine.select(stream.startPiece, stream.endPiece, true, notify);
            eos(stream, function() {
              engine.deselect(stream.startPiece, stream.endPiece, true, notify);
            });
            return stream;
          };
          return file;
        });
        var oninterestchange = function() {
          var prev = engine.amInterested;
          engine.amInterested = !!engine.selection.length;
          wires.forEach(function(wire) {
            if (engine.amInterested) wire.interested();
            else wire.uninterested();
          });
          if (prev === engine.amInterested) return;
          if (engine.amInterested) engine.emit("interested");
          else engine.emit("uninterested");
        };
        var gc = function() {
          for (var i = 0; i < engine.selection.length; i++) {
            var s = engine.selection[i];
            var oldOffset = s.offset;
            while (!pieces[s.from + s.offset] && s.from + s.offset < s.to) s.offset++;
            if (oldOffset !== s.offset) s.notify();
            if (s.to !== s.from + s.offset) continue;
            if (pieces[s.from + s.offset]) continue;
            engine.selection.splice(i, 1);
            i--;
            s.notify();
            oninterestchange();
          }
          if (!engine.selection.length) engine.emit("idle");
        };
        var onpiececomplete = function(index, buffer) {
          if (!pieces[index]) return;
          pieces[index] = null;
          reservations[index] = null;
          engine.bitfield.set(index, true);
          for (var i = 0; i < wires.length; i++) wires[i].have(index);
          engine.emit("verify", index);
          engine.emit("download", index, buffer);
          engine.store.put(index, buffer);
          gc();
        };
        var onhotswap = opts.hotswap === false ? falsy : function(wire, index) {
          var speed = wire.downloadSpeed();
          if (speed < piece.BLOCK_LENGTH) return;
          if (!reservations[index] || !pieces[index]) return;
          var r = reservations[index];
          var minSpeed = Infinity;
          var min;
          for (var i = 0; i < r.length; i++) {
            var other = r[i];
            if (!other || other === wire) continue;
            var otherSpeed = other.downloadSpeed();
            if (otherSpeed >= SPEED_THRESHOLD) continue;
            if (2 * otherSpeed > speed || otherSpeed > minSpeed) continue;
            min = other;
            minSpeed = otherSpeed;
          }
          if (!min) return false;
          for (i = 0; i < r.length; i++) {
            if (r[i] === min) r[i] = null;
          }
          for (i = 0; i < min.requests.length; i++) {
            var req = min.requests[i];
            if (req.piece !== index) continue;
            pieces[index].cancel(req.offset / piece.BLOCK_SIZE | 0);
          }
          engine.emit("hotswap", min, wire, index);
          return true;
        };
        var onupdatetick = function() {
          process.nextTick(onupdate);
        };
        var onrequest = function(wire, index, hotswap) {
          if (!pieces[index]) return false;
          var p = pieces[index];
          var reservation = p.reserve();
          if (reservation === -1 && hotswap && onhotswap(wire, index)) reservation = p.reserve();
          if (reservation === -1) return false;
          var r = reservations[index] || [];
          var offset = p.chunkOffset(reservation);
          var size = p.chunkLength(reservation);
          var i = r.indexOf(null);
          if (i === -1) i = r.length;
          r[i] = wire;
          wire.request(index, offset, size, function(err, block) {
            if (r[i] === wire) r[i] = null;
            if (p !== pieces[index]) return onupdatetick();
            if (err) {
              p.cancel(reservation);
              onupdatetick();
              return;
            }
            if (!p.set(reservation, block, wire)) return onupdatetick();
            var sources = p.sources;
            var buffer = p.flush();
            if (sha1(buffer) !== torrent.pieces[index]) {
              pieces[index] = piece(p.length);
              engine.emit("invalid-piece", index, buffer);
              onupdatetick();
              sources.forEach(function(wire2) {
                var now = Date.now();
                wire2.badPieceStrikes = wire2.badPieceStrikes.filter(function(strike) {
                  return now - strike < BAD_PIECE_STRIKES_DURATION;
                });
                wire2.badPieceStrikes.push(now);
                if (wire2.badPieceStrikes.length > BAD_PIECE_STRIKES_MAX) {
                  engine.block(wire2.peerAddress);
                }
              });
              return;
            }
            onpiececomplete(index, buffer);
            onupdatetick();
          });
          return true;
        };
        var onvalidatewire = function(wire) {
          if (wire.requests.length) return;
          for (var i = engine.selection.length - 1; i >= 0; i--) {
            var next = engine.selection[i];
            for (var j = next.to; j >= next.from + next.offset; j--) {
              if (!wire.peerPieces[j]) continue;
              if (onrequest(wire, j, false)) return;
            }
          }
        };
        var speedRanker = function(wire) {
          var speed = wire.downloadSpeed() || 1;
          if (speed > SPEED_THRESHOLD) return thruthy;
          var secs = MAX_REQUESTS * piece.BLOCK_LENGTH / speed;
          var tries = 10;
          var ptr = 0;
          return function(index) {
            if (!tries || !pieces[index]) return true;
            var missing = pieces[index].missing;
            for (; ptr < wires.length; ptr++) {
              var other = wires[ptr];
              var otherSpeed = other.downloadSpeed();
              if (otherSpeed < SPEED_THRESHOLD) continue;
              if (otherSpeed <= speed || !other.peerPieces[index]) continue;
              if ((missing -= otherSpeed * secs) > 0) continue;
              tries--;
              return false;
            }
            return true;
          };
        };
        var shufflePriority = function(i) {
          var last = i;
          for (var j = i; j < engine.selection.length && engine.selection[j].priority; j++) {
            last = j;
          }
          var tmp = engine.selection[i];
          engine.selection[i] = engine.selection[last];
          engine.selection[last] = tmp;
        };
        var select = function(wire, hotswap) {
          if (wire.requests.length >= MAX_REQUESTS) return true;
          if (swarm.downloaded > engine._flood && swarm.downloadSpeed() > engine._pulse) {
            return true;
          }
          var rank = speedRanker(wire);
          for (var i = 0; i < engine.selection.length; i++) {
            var next = engine.selection[i];
            for (var j = next.from + next.offset; j <= next.to; j++) {
              if (!wire.peerPieces[j] || !rank(j)) continue;
              while (wire.requests.length < MAX_REQUESTS && onrequest(wire, j, critical[j] || hotswap)) {
              }
              if (wire.requests.length < MAX_REQUESTS) continue;
              if (next.priority) shufflePriority(i);
              return true;
            }
          }
          return false;
        };
        var onupdatewire = function(wire) {
          if (wire.peerChoking) return;
          if (!wire.downloaded) return onvalidatewire(wire);
          select(wire, false) || select(wire, true);
        };
        var onupdate = function() {
          wires.forEach(onupdatewire);
        };
        var onwire = function(wire) {
          wire.setTimeout(opts.timeout || REQUEST_TIMEOUT, function() {
            engine.emit("timeout", wire);
            wire.destroy();
          });
          if (engine.selection.length) wire.interested();
          var timeout = CHOKE_TIMEOUT;
          var id;
          var onchoketimeout = function() {
            if (swarm.queued > 2 * (swarm.size - swarm.wires.length) && wire.amInterested) return wire.destroy();
            id = setTimeout(onchoketimeout, timeout);
          };
          wire.on("close", function() {
            clearTimeout(id);
          });
          wire.on("choke", function() {
            clearTimeout(id);
            id = setTimeout(onchoketimeout, timeout);
          });
          wire.on("unchoke", function() {
            clearTimeout(id);
          });
          wire.on("request", function(index, offset, length, cb2) {
            if (pieces[index]) return;
            engine.store.get(index, { offset, length }, function(err, buffer) {
              if (err) return cb2(err);
              engine.emit("upload", index, offset, length);
              cb2(null, buffer);
            });
          });
          wire.on("unchoke", onupdate);
          wire.on("bitfield", onupdate);
          wire.on("have", onupdate);
          wire.isSeeder = false;
          var i = 0;
          var checkseeder = function() {
            if (wire.peerPieces.length !== torrent.pieces.length) return;
            for (; i < torrent.pieces.length; ++i) {
              if (!wire.peerPieces[i]) return;
            }
            wire.isSeeder = true;
          };
          wire.on("bitfield", checkseeder);
          wire.on("have", checkseeder);
          checkseeder();
          wire.badPieceStrikes = [];
          id = setTimeout(onchoketimeout, timeout);
        };
        var rechokeSort = function(a, b) {
          if (a.downSpeed !== b.downSpeed) return a.downSpeed > b.downSpeed ? -1 : 1;
          if (a.upSpeed !== b.upSpeed) return a.upSpeed > b.upSpeed ? -1 : 1;
          if (a.wasChoked !== b.wasChoked) return a.wasChoked ? 1 : -1;
          return a.salt - b.salt;
        };
        var onrechoke = function() {
          if (rechokeOptimisticTime > 0) --rechokeOptimisticTime;
          else rechokeOptimistic = null;
          var peers = [];
          wires.forEach(function(wire) {
            if (wire.isSeeder) {
              if (!wire.amChoking) wire.choke();
            } else if (wire !== rechokeOptimistic) {
              peers.push({
                wire,
                downSpeed: wire.downloadSpeed(),
                upSpeed: wire.uploadSpeed(),
                salt: Math.random(),
                interested: wire.peerInterested,
                wasChoked: wire.amChoking,
                isChoked: true
              });
            }
          });
          peers.sort(rechokeSort);
          var i = 0;
          var unchokeInterested = 0;
          for (; i < peers.length && unchokeInterested < rechokeSlots; ++i) {
            peers[i].isChoked = false;
            if (peers[i].interested) ++unchokeInterested;
          }
          if (!rechokeOptimistic && i < peers.length && rechokeSlots) {
            var candidates = peers.slice(i).filter(function(peer) {
              return peer.interested;
            });
            var optimistic = candidates[Math.random() * candidates.length | 0];
            if (optimistic) {
              optimistic.isChoked = false;
              rechokeOptimistic = optimistic.wire;
              rechokeOptimisticTime = RECHOKE_OPTIMISTIC_DURATION;
            }
          }
          peers.forEach(function(peer) {
            if (peer.wasChoked !== peer.isChoked) {
              if (peer.isChoked) peer.wire.choke();
              else peer.wire.unchoke();
            }
          });
        };
        var onready = function() {
          if (destroyed) return;
          swarm.on("wire", onwire);
          swarm.wires.forEach(onwire);
          refresh = function() {
            process.nextTick(gc);
            oninterestchange();
            onupdate();
          };
          rechokeIntervalId = setInterval(onrechoke, RECHOKE_INTERVAL);
          process.nextTick(function() {
            engine.emit("torrent", torrent);
            engine.emit("ready");
            refresh();
          });
        };
        if (opts.verify === false) return onready();
        engine.emit("verifying");
        var loop = function(i) {
          if (i >= torrent.pieces.length) return onready();
          engine.store.get(i, function(_, buf) {
            if (!buf || sha1(buf) !== torrent.pieces[i] || !pieces[i]) return loop(i + 1);
            pieces[i] = null;
            engine.bitfield.set(i, true);
            engine.emit("verify", i);
            loop(i + 1);
          });
        };
        loop(0);
      };
      var exchange = exchangeMetadata(engine, function(metadata2) {
        var buf = bncode.encode({
          info: bncode.decode(metadata2),
          "announce-list": []
        });
        ontorrent(parseTorrent(buf));
        mkdirp(path2.dirname(torrentPath), function(err) {
          if (err) return engine.emit("error", err);
          fs2.writeFile(torrentPath, buf, function(err2) {
            if (err2) engine.emit("error", err2);
          });
        });
      });
      swarm.on("wire", function(wire) {
        engine.emit("wire", wire);
        exchange(wire);
        if (engine.bitfield) wire.bitfield(engine.bitfield);
      });
      swarm.pause();
      if (link.files && engine.metadata) {
        swarm.resume();
        ontorrent(link);
      } else {
        fs2.readFile(torrentPath, function(_, buf) {
          if (destroyed) return;
          swarm.resume();
          if (!buf) return discovery.setTorrent(link);
          var torrent = parseTorrent(buf);
          if (torrent.infoHash !== infoHash) return discovery.setTorrent(link);
          if (!torrent.announce || !torrent.announce.length) {
            opts.trackers = [].concat(opts.trackers || []).concat(link.announce || []);
          }
          engine.metadata = torrent.infoBuffer;
          ontorrent(torrent);
        });
      }
      engine.critical = function(piece2, width) {
        for (var i = 0; i < (width || 1); i++) critical[piece2 + i] = true;
      };
      engine.select = function(from, to, priority, notify) {
        engine.selection.push({
          from,
          to,
          offset: 0,
          priority: toNumber(priority),
          notify: notify || noop
        });
        engine.selection.sort(function(a, b) {
          return b.priority - a.priority;
        });
        refresh();
      };
      engine.deselect = function(from, to, priority, notify) {
        notify = notify || noop;
        for (var i = 0; i < engine.selection.length; i++) {
          var s = engine.selection[i];
          if (s.from !== from || s.to !== to) continue;
          if (s.priority !== toNumber(priority)) continue;
          if (s.notify !== notify) continue;
          engine.selection.splice(i, 1);
          i--;
          break;
        }
        refresh();
      };
      engine.setPulse = function(bps) {
        engine._pulse = bps;
      };
      engine.setFlood = function(b) {
        engine._flood = b + swarm.downloaded;
      };
      engine.setFloodedPulse = function(b, bps) {
        engine.setFlood(b);
        engine.setPulse(bps);
      };
      engine.flood = function() {
        engine._flood = 0;
        engine._pulse = Number.MAX_SAFE_INTEGER;
      };
      engine.connect = function(addr) {
        swarm.add(addr);
      };
      engine.disconnect = function(addr) {
        swarm.remove(addr);
      };
      engine.block = function(addr) {
        blocked.add(addr.split(":")[0]);
        engine.disconnect(addr);
        engine.emit("blocking", addr);
      };
      var removeTorrent = function(cb2) {
        fs2.unlink(torrentPath, function(err) {
          if (err) return cb2(err);
          fs2.rmdir(path2.dirname(torrentPath), function(err2) {
            if (err2 && err2.code !== "ENOTEMPTY") return cb2(err2);
            cb2();
          });
        });
      };
      var removeTmp = function(cb2) {
        if (!usingTmp) return removeTorrent(cb2);
        rimraf(opts.path, function(err) {
          if (err) return cb2(err);
          removeTorrent(cb2);
        });
      };
      engine.remove = function(keepPieces, cb2) {
        if (typeof keepPieces === "function") {
          cb2 = keepPieces;
          keepPieces = false;
        }
        if (keepPieces || !engine.store || !engine.store.destroy) return removeTmp(cb2);
        engine.store.destroy(function(err) {
          if (err) return cb2(err);
          removeTmp(cb2);
        });
      };
      engine.destroy = function(cb2) {
        destroyed = true;
        swarm.destroy();
        clearInterval(rechokeIntervalId);
        discovery.stop();
        if (engine.store && engine.store.close) {
          engine.store.close(cb2);
        } else if (cb2) {
          process.nextTick(cb2);
        }
      };
      var findPort = function(def, cb2) {
        var net = require("net");
        var s = net.createServer();
        s.on("error", function() {
          findPort(0, cb2);
        });
        s.listen(def, function() {
          var port = s.address().port;
          s.close(function() {
            engine.listen(port, cb2);
          });
        });
      };
      engine.listen = function(port, cb2) {
        if (typeof port === "function") return engine.listen(0, port);
        if (!port) return findPort(opts.port || DEFAULT_PORT, cb2);
        engine.port = port;
        swarm.listen(engine.port, cb2);
        discovery.updatePort(engine.port);
      };
      return engine;
    };
    module2.exports = torrentStream2;
  }
});

// src/service.js
var http = require("http");
var fs = require("fs");
var os = require("os");
var path = require("path");
var torrentStream = require_torrent_stream();
var PORT = Number(process.env.FREETV_TORRENT_PORT) || 11470;
var HOST = process.env.FREETV_TORRENT_HOST || "127.0.0.1";
var VERSION = "1.0.0";
var METADATA_MS = Number(process.env.FREETV_TORRENT_METADATA_MS) || 9e4;
var IDLE_MS = 20 * 60 * 1e3;
var VIDEO = /\.(mkv|mp4|m4v|avi|mov|webm|ts|m2ts|wmv|flv|mpg|mpeg)$/i;
var TYPES = {
  mkv: "video/x-matroska",
  mp4: "video/mp4",
  m4v: "video/mp4",
  avi: "video/x-msvideo",
  mov: "video/quicktime",
  webm: "video/webm",
  ts: "video/mp2t",
  m2ts: "video/mp2t",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  mpg: "video/mpeg",
  mpeg: "video/mpeg"
};
function log() {
  try {
    console.log.apply(console, ["[freetv-torrents]"].concat([].slice.call(arguments)));
  } catch (e) {
  }
}
function writable(dir) {
  try {
    mkdirs(dir);
    var probe = path.join(dir, ".probe");
    fs.writeFileSync(probe, "x");
    fs.unlinkSync(probe);
    return true;
  } catch (e) {
    return false;
  }
}
function mkdirs(dir) {
  if (fs.existsSync(dir)) return;
  mkdirs(path.dirname(dir));
  try {
    fs.mkdirSync(dir);
  } catch (e) {
    if (!fs.existsSync(dir)) throw e;
  }
}
function rmrf(p) {
  try {
    var st = fs.lstatSync(p);
    if (st.isDirectory()) {
      fs.readdirSync(p).forEach(function(n) {
        rmrf(path.join(p, n));
      });
      fs.rmdirSync(p);
    } else fs.unlinkSync(p);
  } catch (e) {
  }
}
var DIR = (function() {
  var wanted = [process.env.FREETV_TORRENT_DIR, "/home/owner/share/freetv-torrents", path.join(os.tmpdir(), "freetv-torrents")], i;
  for (i = 0; i < wanted.length; i++) if (wanted[i] && writable(wanted[i])) return wanted[i];
  return null;
})();
function freeBytes(dir, cb) {
  try {
    if (typeof fs.statfs === "function") {
      fs.statfs(dir, function(err, s) {
        cb(err ? -1 : s.bavail * s.bsize);
      });
      return;
    }
    require("child_process").exec('df -Pk "' + dir + '"', { timeout: 4e3 }, function(err, out) {
      var m = !err && /\n\S+\s+\d+\s+\d+\s+(\d+)\s/.exec(String(out));
      cb(m ? Number(m[1]) * 1024 : -1);
    });
  } catch (e) {
    cb(-1);
  }
}
var current = null;
function stop(t) {
  if (!t) return;
  clearTimeout(t.timer);
  try {
    t.engine.destroy(function() {
      rmrf(t.dir);
    });
  } catch (e) {
    rmrf(t.dir);
  }
  if (current === t) current = null;
}
function fileList(engine) {
  return engine.files.map(function(f, i) {
    return { index: i, name: f.name, path: f.path, length: f.length };
  });
}
function guess(files) {
  var best = -1, size = -1, i;
  for (i = 0; i < files.length; i++) if (VIDEO.test(files[i].name) && files[i].length > size) {
    size = files[i].length;
    best = i;
  }
  return best >= 0 ? best : files.length ? 0 : -1;
}
function trackersOf(sources) {
  var out = [];
  (sources || []).forEach(function(s) {
    s = String(s);
    if (/^tracker:/i.test(s)) out.push(s.slice(8));
    else if (/^(udp|http|https|wss?):\/\//i.test(s)) out.push(s);
  });
  return out.slice(0, 30);
}
function open(hash, body, cb) {
  if (current && current.hash === hash && !current.error) {
    current.last = Date.now();
    if (current.ready) {
      cb(null, current);
      return;
    }
    current.waiting.push(cb);
    return;
  }
  stop(current);
  if (!DIR) {
    cb({ code: 500, message: "no folder to keep the torrent in" });
    return;
  }
  var dir = path.join(DIR, hash);
  rmrf(dir);
  var trackers = trackersOf(body && body.peerSearch && body.peerSearch.sources);
  var magnet = "magnet:?xt=urn:btih:" + hash + trackers.map(function(t2) {
    return "&tr=" + encodeURIComponent(t2);
  }).join("");
  var t = { hash, dir, ready: false, error: null, files: [], waiting: [cb], last: Date.now(), timer: null, engine: null };
  current = t;
  function finish(err) {
    var w = t.waiting;
    t.waiting = [];
    if (err) {
      t.error = err;
    }
    w.forEach(function(f) {
      f(err || null, t);
    });
  }
  try {
    t.engine = torrentStream(magnet, { path: dir, tmp: DIR, connections: 80, uploads: 4, dht: true, tracker: true, verify: true, trackers });
  } catch (e) {
    current = null;
    cb({ code: 500, message: String(e && e.message || e) });
    return;
  }
  t.timer = setTimeout(function() {
    if (!t.ready) {
      finish({ code: 504, message: "no peers sent the torrent's file list in time" });
      stop(t);
    }
  }, METADATA_MS);
  t.engine.on("ready", function() {
    clearTimeout(t.timer);
    t.files = fileList(t.engine);
    t.ready = true;
    log("ready", hash, t.files.length + " files");
    finish(null);
  });
  t.engine.on("error", function(e) {
    log("engine error", e && e.message);
    if (!t.ready) {
      finish({ code: 500, message: String(e && e.message || e) });
      stop(t);
    }
  });
  (body && body.peers || []).forEach(function(p) {
    try {
      t.engine.connect(String(p));
    } catch (e) {
    }
  });
}
setInterval(function() {
  if (current && Date.now() - current.last > IDLE_MS) {
    log("idle: removing", current.hash);
    stop(current);
  }
}, 6e4);
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
}
function json(res, code, obj) {
  var s = JSON.stringify(obj);
  cors(res);
  res.writeHead(code, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(s) });
  res.end(s);
}
function readBody(req, cb) {
  var chunks = [], size = 0;
  req.on("data", function(c) {
    size += c.length;
    if (size < 1e6) chunks.push(c);
  });
  req.on("end", function() {
    var o = null;
    try {
      o = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch (e) {
    }
    cb(o || {});
  });
}
function status() {
  var t = current, e = t && t.engine, sw = e && e.swarm;
  return {
    ok: true,
    name: "freetv-torrents",
    version: VERSION,
    node: process.version,
    dir: DIR,
    torrent: t ? { infoHash: t.hash, ready: t.ready, files: t.files.length, peers: sw ? sw.wires.length : 0, downloaded: sw ? sw.downloaded : 0, speed: sw && sw.downloadSpeed ? sw.downloadSpeed() : 0 } : null
  };
}
function serve(req, res, t, idx) {
  var f = t.engine.files[idx];
  if (!f) {
    json(res, 404, { error: "no such file" });
    return;
  }
  t.last = Date.now();
  var range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || ""), start = 0, end = f.length - 1, code = 200;
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), f.length - 1);
    } else {
      start = Math.max(0, f.length - Number(range[2]));
    }
    if (start > end || start >= f.length) {
      cors(res);
      res.writeHead(416, { "Content-Range": "bytes */" + f.length });
      res.end();
      return;
    }
    code = 206;
  }
  var ext = (/\.([A-Za-z0-9]+)$/.exec(f.name) || [])[1];
  var head = { "Content-Type": TYPES[String(ext).toLowerCase()] || "application/octet-stream", "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Cache-Control": "no-store" };
  if (code === 206) head["Content-Range"] = "bytes " + start + "-" + end + "/" + f.length;
  cors(res);
  res.writeHead(code, head);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  var stream = f.createReadStream({ start, end });
  stream.on("error", function() {
    try {
      res.end();
    } catch (e) {
    }
  });
  stream.pipe(res);
  res.on("close", function() {
    try {
      stream.destroy();
    } catch (e) {
    }
  });
}
var server = http.createServer(function(req, res) {
  var pathname = String(req.url || "").split("?")[0], m;
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }
  if (pathname === "/status" || pathname === "/") {
    json(res, 200, status());
    return;
  }
  m = /^\/([0-9a-fA-F]{40})\/create$/.exec(pathname);
  if (m && req.method === "POST") {
    var hash = m[1].toLowerCase();
    readBody(req, function(body) {
      open(hash, body, function(err, t) {
        if (err) {
          json(res, err.code || 500, { error: err.message });
          return;
        }
        var files = t.files, wantIdx = body && body.fileIdx;
        var idx = typeof wantIdx === "number" ? wantIdx : guess(files);
        var f = files[idx];
        if (!f) {
          json(res, 404, { error: "the torrent has no such file" });
          return;
        }
        freeBytes(DIR, function(free) {
          if (free >= 0 && free < f.length * 1.02 + 50 * 1048576) {
            json(res, 507, { error: "not enough free space on the TV (" + Math.round(free / 1048576) + " MB free, " + Math.round(f.length / 1048576) + " MB needed)", free, needed: f.length });
            return;
          }
          json(res, 200, { infoHash: hash, files, guessedFileIdx: idx });
        });
      });
    });
    return;
  }
  m = /^\/([0-9a-fA-F]{40})\/(\d+)$/.exec(pathname);
  if (m && (req.method === "GET" || req.method === "HEAD")) {
    var h = m[1].toLowerCase();
    if (!current || current.hash !== h || !current.ready) {
      json(res, 404, { error: "torrent not created: POST /" + h + "/create first" });
      return;
    }
    serve(req, res, current, Number(m[2]));
    return;
  }
  json(res, 404, { error: "not found" });
});
server.on("error", function(e) {
  log("server error", e && e.code || e);
});
server.listen(PORT, HOST, function() {
  log("listening on " + HOST + ":" + PORT + ", data in " + DIR + ", node " + process.version);
});
if (DIR) {
  try {
    fs.readdirSync(DIR).forEach(function(n) {
      rmrf(path.join(DIR, n));
    });
  } catch (e) {
  }
}
module.exports = { server, status };
