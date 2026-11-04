/*
 * A small QR code maker for FreeTV's Companion (byte mode, error correction L, versions 1 to 5, one block, mask 0): enough for an address.
 * window.QR.draw(canvas, text, pixelsPerModule) returns false when the text is too long. Plain ES5.
 */
(function () {
  'use strict';
  var DATA = [0, 19, 34, 55, 80, 108], ECC = [0, 7, 10, 15, 20, 26];

  function mul(x, y) {
    var z = 0, i;
    for (i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z;
  }

  function rs(data, degree) {
    var div = [], i, j, root = 1, res = [];
    for (i = 0; i < degree; i++) { div.push(0); res.push(0); }
    div[degree - 1] = 1;
    for (i = 0; i < degree; i++) {
      for (j = 0; j < degree; j++) { div[j] = mul(div[j], root); if (j + 1 < degree) div[j] ^= div[j + 1]; }
      root = mul(root, 2);
    }
    data.forEach(function (b) {
      var f = b ^ res.shift();
      res.push(0);
      for (i = 0; i < degree; i++) res[i] ^= mul(div[i], f);
    });
    return res;
  }

  function utf8(s) {
    var out = [], i, c;
    s = unescape(encodeURIComponent(s));
    for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); out.push(c); }
    return out;
  }

  /** The matrix (array of rows of booleans), or null when the text does not fit in version 5. */
  function make(text) {
    var bytes = utf8(text), v, i, j, bits = [];
    for (v = 1; v <= 5; v++) if (bytes.length <= DATA[v] - 2) break;
    if (v > 5) return null;
    function put(val, n) { for (var k = n - 1; k >= 0; k--) bits.push((val >>> k) & 1); }
    put(4, 4);
    put(bytes.length, 8);
    bytes.forEach(function (b) { put(b, 8); });
    var cap = DATA[v] * 8;
    for (i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var words = [];
    for (i = 0; i < bits.length; i += 8) {
      var w = 0;
      for (j = 0; j < 8; j++) w = (w << 1) | bits[i + j];
      words.push(w);
    }
    for (i = 0; words.length < DATA[v]; i++) words.push(i % 2 ? 0x11 : 0xEC);
    words = words.concat(rs(words, ECC[v]));

    var size = 17 + 4 * v, m = [], fn = [], x, y;
    for (y = 0; y < size; y++) { m.push([]); fn.push([]); for (x = 0; x < size; x++) { m[y].push(false); fn[y].push(false); } }
    function set(px, py, dark) { if (px >= 0 && py >= 0 && px < size && py < size) { m[py][px] = dark; fn[py][px] = true; } }
    for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    if (v >= 2) { var a = size - 7; for (var ay = -2; ay <= 2; ay++) for (var ax = -2; ax <= 2; ax++) set(a + ax, a + ay, Math.max(Math.abs(ax), Math.abs(ay)) !== 1); }
    // format bits: level L (01), mask 0 (000)
    var data = 8, rem = data;
    for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var fmt = ((data << 10) | rem) ^ 0x5412;
    function bit(k) { return ((fmt >>> k) & 1) !== 0; }
    for (i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
    // codewords, zig-zag from the bottom right
    var k = 0, total = words.length * 8, right, vert, up;
    for (right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (vert = 0; vert < size; vert++) {
        for (j = 0; j < 2; j++) {
          x = right - j;
          up = ((right + 1) & 2) === 0;
          y = up ? size - 1 - vert : vert;
          if (!fn[y][x] && k < total) { m[y][x] = ((words[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0; k++; }
        }
      }
    }
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (!fn[y][x] && (x + y) % 2 === 0) m[y][x] = !m[y][x];
    return m;
  }

  window.QR = {
    make: make,
    draw: function (canvas, text, scale) {
      var m = make(text);
      if (!m) return false;
      var n = m.length, quiet = 4, px = scale || 8, total = (n + quiet * 2) * px, ctx = canvas.getContext('2d'), x, y;
      canvas.width = canvas.height = total;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, total, total);
      ctx.fillStyle = '#000';
      for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (m[y][x]) ctx.fillRect((x + quiet) * px, (y + quiet) * px, px, px);
      return true;
    }
  };
}());
