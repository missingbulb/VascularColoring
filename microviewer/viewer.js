// The 3D stack viewer: a WebGL2 ray-caster over the stack's volumes, the flattened picture beside any
// single slice, and the per-slice brightness curve. The renderer and controls are the ones of
// analysis/stack_view/index.html, fed from a stack opened in the browser instead of exported files.

const $ = (id) => document.getElementById(id);

// ---------- small matrix kit (column-major, as WebGL expects) ----------
export const M = {
  persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2), r = 1 / (n - f);
    return [t / asp,0,0,0, 0,t,0,0, 0,0,(n + f) * r,-1, 0,0,2 * n * f * r,0]; },
  look(e, c, u) {
    const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
    const nrm = (a) => { const l = Math.hypot(...a); return a.map(x => x / l); };
    const cr = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    const z = nrm(sub(e, c)), x = nrm(cr(u, z)), y = cr(z, x);
    const d = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -d(x,e),-d(y,e),-d(z,e),1]; },
  mul(a, b) { const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c*4+r] += a[k*4+r] * b[c*4+k];
    return o; },
  inv(m) { const i = new Array(16);
    i[0]=m[5]*m[10]*m[15]-m[5]*m[11]*m[14]-m[9]*m[6]*m[15]+m[9]*m[7]*m[14]+m[13]*m[6]*m[11]-m[13]*m[7]*m[10];
    i[4]=-m[4]*m[10]*m[15]+m[4]*m[11]*m[14]+m[8]*m[6]*m[15]-m[8]*m[7]*m[14]-m[12]*m[6]*m[11]+m[12]*m[7]*m[10];
    i[8]=m[4]*m[9]*m[15]-m[4]*m[11]*m[13]-m[8]*m[5]*m[15]+m[8]*m[7]*m[13]+m[12]*m[5]*m[11]-m[12]*m[7]*m[9];
    i[12]=-m[4]*m[9]*m[14]+m[4]*m[10]*m[13]+m[8]*m[5]*m[14]-m[8]*m[6]*m[13]-m[12]*m[5]*m[10]+m[12]*m[6]*m[9];
    i[1]=-m[1]*m[10]*m[15]+m[1]*m[11]*m[14]+m[9]*m[2]*m[15]-m[9]*m[3]*m[14]-m[13]*m[2]*m[11]+m[13]*m[3]*m[10];
    i[5]=m[0]*m[10]*m[15]-m[0]*m[11]*m[14]-m[8]*m[2]*m[15]+m[8]*m[3]*m[14]+m[12]*m[2]*m[11]-m[12]*m[3]*m[10];
    i[9]=-m[0]*m[9]*m[15]+m[0]*m[11]*m[13]+m[8]*m[1]*m[15]-m[8]*m[3]*m[13]-m[12]*m[1]*m[11]+m[12]*m[3]*m[9];
    i[13]=m[0]*m[9]*m[14]-m[0]*m[10]*m[13]-m[8]*m[1]*m[14]+m[8]*m[2]*m[13]+m[12]*m[1]*m[10]-m[12]*m[2]*m[9];
    i[2]=m[1]*m[6]*m[15]-m[1]*m[7]*m[14]-m[5]*m[2]*m[15]+m[5]*m[3]*m[14]+m[13]*m[2]*m[7]-m[13]*m[3]*m[6];
    i[6]=-m[0]*m[6]*m[15]+m[0]*m[7]*m[14]+m[4]*m[2]*m[15]-m[4]*m[3]*m[14]-m[12]*m[2]*m[7]+m[12]*m[3]*m[6];
    i[10]=m[0]*m[5]*m[15]-m[0]*m[7]*m[13]-m[4]*m[1]*m[15]+m[4]*m[3]*m[13]+m[12]*m[1]*m[7]-m[12]*m[3]*m[5];
    i[14]=-m[0]*m[5]*m[14]+m[0]*m[6]*m[13]+m[4]*m[1]*m[14]-m[4]*m[2]*m[13]-m[12]*m[1]*m[6]+m[12]*m[2]*m[5];
    i[3]=-m[1]*m[6]*m[11]+m[1]*m[7]*m[10]+m[5]*m[2]*m[11]-m[5]*m[3]*m[10]-m[9]*m[2]*m[7]+m[9]*m[3]*m[6];
    i[7]=m[0]*m[6]*m[11]-m[0]*m[7]*m[10]-m[4]*m[2]*m[11]+m[4]*m[3]*m[10]+m[8]*m[2]*m[7]-m[8]*m[3]*m[6];
    i[11]=-m[0]*m[5]*m[11]+m[0]*m[7]*m[9]+m[4]*m[1]*m[11]-m[4]*m[3]*m[9]-m[8]*m[1]*m[7]+m[8]*m[3]*m[5];
    i[15]=m[0]*m[5]*m[10]-m[0]*m[6]*m[9]-m[4]*m[1]*m[10]+m[4]*m[2]*m[9]+m[8]*m[1]*m[6]-m[8]*m[2]*m[5];
    const det = m[0]*i[0] + m[1]*i[4] + m[2]*i[8] + m[3]*i[12];
    return i.map(x => x / det); },
  xf(m, p) { const v = [0,0,0,0];
    for (let r = 0; r < 4; r++) v[r] = m[r]*p[0] + m[4+r]*p[1] + m[8+r]*p[2] + m[12+r];
    return v; },
};

// ---------- shaders ----------
const VS = `#version 300 es
in vec2 aPos; out vec2 vNdc;
void main(){ vNdc = aPos; gl_Position = vec4(aPos, 0., 1.); }`;
const FS = `#version 300 es
precision highp float; precision highp sampler3D;
uniform sampler3D uA; uniform sampler3D uB;
uniform mat4 uInvVP; uniform vec3 uHalf; uniform vec2 uZc; uniform vec3 uTexel;
uniform int uMode; uniform int uChan; uniform int uDepth;
uniform float uLo; uniform float uHi; uniform float uIso; uniform float uStep;
in vec2 vNdc; out vec4 o;
const vec3 BG = vec3(0.);
vec3 toTc(vec3 p){ return vec3((p.x/uHalf.x+1.)*.5, (1.-p.y/uHalf.y)*.5, (1.-p.z/uHalf.z)*.5); }
vec3 turbo(float x){
  const vec4 kR=vec4(0.13572138,4.61539260,-42.66032258,132.13108234); const vec2 kR2=vec2(-152.94239396,59.28637943);
  const vec4 kG=vec4(0.09140261,2.19418839,4.84296658,-14.18503333); const vec2 kG2=vec2(4.27729857,2.82956604);
  const vec4 kB=vec4(0.10667330,12.64194608,-60.58204836,110.36276771); const vec2 kB2=vec2(-89.90310912,27.34824973);
  x = mix(.12, .92, clamp(x,0.,1.)); vec4 v4=vec4(1.,x,x*x,x*x*x); vec2 v2=v4.zw*v4.z;
  return clamp(vec3(dot(v4,kR)+dot(v2,kR2), dot(v4,kG)+dot(v2,kG2), dot(v4,kB)+dot(v2,kB2)),0.,1.); }
vec3 hot(float v){ return clamp(vec3(v*2.2, v*2.2-.9, v*3.2-2.2), 0., 1.); }
vec3 blue(float v){ return clamp(vec3(v*.35, v*.6, v*1.4), 0., 1.); }
float win(float v){ return clamp((v-uLo)/max(uHi-uLo,1e-4), 0., 1.); }
float val(vec3 tc){ return texture(uA,tc).r; }
void main(){
  vec4 a = uInvVP*vec4(vNdc,-1.,1.), b = uInvVP*vec4(vNdc,1.,1.);
  vec3 ro = a.xyz/a.w, rd = normalize(b.xyz/b.w - ro);
  rd = mix(rd, vec3(1e-6), vec3(equal(rd, vec3(0.))));
  vec3 bmin = vec3(-uHalf.xy, uHalf.z*(1.-2.*uZc.y)), bmax = vec3(uHalf.xy, uHalf.z*(1.-2.*uZc.x));
  vec3 inv = 1./rd, t0 = (bmin-ro)*inv, t1 = (bmax-ro)*inv, tn = min(t0,t1), tf = max(t0,t1);
  float tN = max(max(tn.x,tn.y), max(tn.z,0.)), tF = min(min(tf.x,tf.y), tf.z);
  if (tF <= tN) { o = vec4(BG,1.); return; }
  float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)))*43758.5453);
  if (uMode == 0) {
    float mA = 0., zA = 0., mB = 0.;
    for (int i = 0; i < 4096; i++) {
      float t = tN + (float(i)+jit)*uStep; if (t > tF) break;
      vec3 tc = toTc(ro + rd*t);
      float va = texture(uA,tc).r;
      if (va > mA) { mA = va; zA = tc.z; }
      if (uChan == 2) mB = max(mB, texture(uB,tc).r);
    }
    float zn = (zA - uZc.x) / max(uZc.y - uZc.x, 1e-4);
    vec3 c = uDepth==1 ? turbo(zn)*win(mA) : hot(win(mA));
    if (uChan == 2) c += blue(win(mB));
    o = vec4(min(c, 1.), 1.);
    return;
  }
  float prev = tN;
  for (int i = 0; i < 4096; i++) {
    float t = tN + (float(i)+jit)*uStep; if (t > tF) break;
    if (val(toTc(ro + rd*t)) >= uIso) {
      float lo = prev, hi = t;
      for (int k = 0; k < 6; k++) { float m = .5*(lo+hi); if (val(toTc(ro+rd*m)) >= uIso) hi = m; else lo = m; }
      vec3 p = ro + rd*hi, tc = toTc(p);
      vec3 g = vec3(val(tc+vec3(uTexel.x,0,0)) - val(tc-vec3(uTexel.x,0,0)),
                    val(tc+vec3(0,uTexel.y,0)) - val(tc-vec3(0,uTexel.y,0)),
                    val(tc+vec3(0,0,uTexel.z)) - val(tc-vec3(0,0,uTexel.z)));
      g = g / (2.*uTexel) * vec3(.5/uHalf.x, -.5/uHalf.y, -.5/uHalf.z);
      vec3 n = length(g) > 1e-6 ? -normalize(g) : -rd;
      float d = abs(dot(n, -rd)), s = pow(max(dot(reflect(rd, n), -rd), 0.), 24.);
      float zn = (tc.z - uZc.x) / max(uZc.y - uZc.x, 1e-4);
      vec3 base = uDepth==1 ? turbo(zn) : vec3(.95,.52,.32);
      o = vec4(base*(.22+.78*d) + .25*s, 1.);
      return;
    }
    prev = t;
  }
  o = vec4(BG,1.);
}`;

// The owner's approved view of their stacks (frontal r1, 2026-09-29): black point, white point,
// surface level. Every other default is read from the stack itself.
const LOOK = { lo: .63, hi: 1, iso: .35 };
const CHANNEL_KEY = 'mv-channel';

export const S = { mode: 0, chan: 0, overlay: 0, depth: 1, ...LOOK, z0: 0, z1: 0, zs: 1, slice: 0,
            yaw: 0, pitch: 0, dist: 4.4, pan: [0, 0], dragging: false };
export let meta = null, half = [1, 1, .1];
let vols = [], gl, U = {}, tex = [], dirty = true, bound = false;
const drawers = [];

// Other layers drawn in the same camera (the vessel model) register here and redraw with every frame.
export const onDraw = (fn) => drawers.push(fn);
export const redraw = () => { dirty = true; };

const other = () => (S.chan === 0 ? 1 : 0);
const showsOverlay = () => S.overlay && vols.length === 2;

function texture(unit, data) {
  const [Z, Y, X] = meta.shape;
  if (tex[unit]) gl.deleteTexture(tex[unit]);
  const t = (tex[unit] = gl.createTexture());
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_3D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, X, Y, Z, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE]])
    gl.texParameteri(gl.TEXTURE_3D, k, v);
}
function uploadChannels() {
  texture(0, vols[S.chan]);
  texture(1, vols.length > 1 ? vols[other()] : vols[S.chan]);
}

// The 3D view needs WebGL2; the caller learns before reading a file whether it has it.
export function initGL() {
  if (gl) return gl;
  gl = $('gl').getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('This browser has no WebGL2, which the 3D view needs.');
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  for (const n of ['uA','uB','uInvVP','uHalf','uZc','uTexel','uMode','uChan','uDepth','uLo','uHi','uIso','uStep'])
    U[n] = gl.getUniformLocation(prog, n);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos'); gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(U.uA, 0); gl.uniform1i(U.uB, 1);
  return gl;
}
export const maxTextureSide = () => initGL().getParameter(gl.MAX_3D_TEXTURE_SIZE);

function geometry() {
  const [Z, Y, X] = meta.shape, um = meta.um_per_px || 1;
  const ext = [X * um, Y * um, Z * S.zs], m = Math.max(...ext);
  half = ext.map(e => e / m);
}

export function camera(asp) {
  const cp = Math.cos(S.pitch), e = [S.dist * cp * Math.sin(S.yaw), S.dist * Math.sin(S.pitch), S.dist * cp * Math.cos(S.yaw)];
  const right = [Math.cos(S.yaw), 0, -Math.sin(S.yaw)];
  const up = [-Math.sin(S.pitch) * Math.sin(S.yaw), Math.cos(S.pitch), -Math.sin(S.pitch) * Math.cos(S.yaw)];
  const tgt = [S.pan[0] * right[0] + S.pan[1] * up[0], S.pan[0] * right[1] + S.pan[1] * up[1], S.pan[0] * right[2] + S.pan[1] * up[2]];
  const eye = e.map((v, i) => v + tgt[i]);
  return M.mul(M.persp(30 * Math.PI / 180, asp, 0.05, 50), M.look(eye, tgt, up));
}

function render() {
  dirty = false;
  if (!meta) return;
  const cv = $('gl'), dpr = Math.min(window.devicePixelRatio || 1, 1.5) * (S.dragging ? .6 : 1);
  const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
  if (!w || !h) return;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  gl.viewport(0, 0, w, h);
  const [Z, Y, X] = meta.shape, vp = camera(w / h);
  gl.uniformMatrix4fv(U.uInvVP, false, new Float32Array(M.inv(vp)));
  gl.uniform3f(U.uHalf, ...half);
  gl.uniform2f(U.uZc, S.z0 / Z, (S.z1 + 1) / Z);
  gl.uniform3f(U.uTexel, 1 / X, 1 / Y, 1 / Z);
  gl.uniform1i(U.uMode, S.mode); gl.uniform1i(U.uChan, showsOverlay() ? 2 : 0); gl.uniform1i(U.uDepth, S.depth);
  gl.uniform1f(U.uLo, S.lo); gl.uniform1f(U.uHi, S.hi); gl.uniform1f(U.uIso, S.iso);
  gl.uniform1f(U.uStep, (2 * half[0] / X) * (S.dragging ? 1.6 : .7));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  hud(vp);
  for (const fn of drawers) fn();
}

function hud(vp) {
  const cv = $('hud'), dpr = window.devicePixelRatio || 1;
  cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr;
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const W = cv.clientWidth, H = cv.clientHeight;
  const P = (p) => { const v = M.xf(vp, p); return [(v[0] / v[3] + 1) / 2 * W, (1 - v[1] / v[3]) / 2 * H, v[3]]; };
  const [hx, hy, hz] = half, Z = meta.shape[0];
  const za = hz * (1 - 2 * S.z0 / Z), zb = hz * (1 - 2 * (S.z1 + 1) / Z);
  const corners = []; for (const x of [-hx, hx]) for (const y of [-hy, hy]) for (const z of [za, zb]) corners.push([x, y, z]);
  const edges = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  c.strokeStyle = 'rgba(79,209,217,.45)'; c.lineWidth = 1;
  const pc = corners.map(P);
  if (pc.some(p => p[2] <= 0)) return;
  c.beginPath(); for (const [a, b] of edges) { c.moveTo(pc[a][0], pc[a][1]); c.lineTo(pc[b][0], pc[b][1]); } c.stroke();
  c.font = '11px "IBM Plex Mono", monospace'; c.fillStyle = 'rgba(216,225,231,.85)';
  const um = meta.um_per_px, X = meta.shape[2];
  const mid = (a, b) => [(pc[a][0] + pc[b][0]) / 2, (pc[a][1] + pc[b][1]) / 2];
  const [xm, ym] = mid(1, 5);
  c.fillText(um ? `${Math.round(X * um)} µm` : `${X} px`, xm + 4, ym + 14);
  const [zx, zy] = mid(4, 5);
  const n = S.z1 - S.z0 + 1;
  const zt = `${n} slices · ${(n * S.zs).toFixed(0)} µm${meta.z_step_um ? '' : ' (spacing guessed)'}`;
  c.fillText(zt, Math.min(Math.max(zx + 6, 4), W - c.measureText(zt).width - 4), Math.min(Math.max(zy, 14), H - 24));
}

function lut2d(v, z, v2) {
  const w = (x) => Math.min(Math.max((x / 255 - S.lo) / Math.max(S.hi - S.lo, 1e-4), 0), 1);
  const a = w(v);
  let r, g, b;
  if (S.depth && z >= 0) { const t = turbo(z); r = t[0] * a; g = t[1] * a; b = t[2] * a; }
  else { r = Math.min(a * 2.2, 1); g = Math.min(Math.max(a * 2.2 - .9, 0), 1); b = Math.min(Math.max(a * 3.2 - 2.2, 0), 1); }
  if (v2 != null) { const bb = w(v2); r += bb * .35; g += bb * .6; b += bb * 1.4; }
  return [Math.min(r, 1) * 255, Math.min(g, 1) * 255, Math.min(b, 1) * 255];
}
export function turbo(x) {
  x = .12 + .8 * Math.min(Math.max(x, 0), 1);
  const p = (k, k2) => k[0] + k[1]*x + k[2]*x*x + k[3]*x*x*x + k2[0]*x**4 + k2[1]*x**5;
  return [p([0.13572138,4.61539260,-42.66032258,132.13108234], [-152.94239396,59.28637943]),
          p([0.09140261,2.19418839,4.84296658,-14.18503333], [4.27729857,2.82956604]),
          p([0.10667330,12.64194608,-60.58204836,110.36276771], [-89.90310912,27.34824973])].map(v => Math.min(Math.max(v, 0), 1));
}

function flat() {
  const [Z, Y, X] = meta.shape, A = vols[S.chan], B = showsOverlay() ? vols[other()] : null;
  for (const [id, z0, z1] of [['flat-all', S.z0, S.z1], ['flat-one', S.slice, S.slice]]) {
    const cv = $(id); cv.width = X; cv.height = Y;
    const c = cv.getContext('2d'), img = c.createImageData(X, Y), d = img.data, n = X * Y;
    for (let i = 0; i < n; i++) {
      let m = -1, mz = 0, m2 = 0;
      for (let z = z0; z <= z1; z++) { const v = A[z * n + i]; if (v > m) { m = v; mz = z; } if (B) m2 = Math.max(m2, B[z * n + i]); }
      const zn = z1 > z0 ? (mz - S.z0) / Math.max(S.z1 - S.z0, 1) : (S.slice - S.z0) / Math.max(S.z1 - S.z0, 1);
      const [r, g, b] = lut2d(m, zn, B ? m2 : null);
      d[4*i] = r; d[4*i+1] = g; d[4*i+2] = b; d[4*i+3] = 255;
    }
    c.putImageData(img, 0, 0);
  }
  $('cap-all').textContent = `Slices ${S.z0 + 1}–${S.z1 + 1} flattened: brightest value per pixel`;
  $('sl-o').value = `${S.slice + 1} of ${Z}`;
  spark();
}

function spark() {
  const svg = $('spark'), Z = meta.shape[0], W = 1100, H = 170, L = 34, R = 10, T = 12, Bm = 26;
  const ch = meta.channels[S.chan];
  const x = (i) => L + (W - L - R) * i / Math.max(Z - 1, 1), y = (v) => T + (H - T - Bm) * (1 - v / 255);
  const line = (a) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  let s = '';
  for (const v of [0, 128, 255]) s += `<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#25313a"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end" font-size="10" fill="#82929d" font-family="IBM Plex Mono, monospace">${v}</text>`;
  s += `<rect x="${x(S.z0)}" y="${T}" width="${Math.max(x(S.z1) - x(S.z0), 1)}" height="${H-T-Bm}" fill="rgba(79,209,217,.07)"/>`;
  s += `<path d="${line(ch.slice_p99)}" fill="none" stroke="#e8b04a" stroke-width="1.5"/>`;
  s += `<path d="${line(ch.slice_p50)}" fill="none" stroke="#82929d" stroke-width="1.5"/>`;
  s += `<line x1="${x(S.slice)}" x2="${x(S.slice)}" y1="${T}" y2="${H-Bm}" stroke="#4fd1d9" stroke-dasharray="3 3"/>`;
  for (const i of [...new Set([0, Math.floor((Z-1)/2), Z-1])]) s += `<text x="${x(i)}" y="${H-8}" text-anchor="${i === 0 ? 'start' : i === Z-1 ? 'end' : 'middle'}" font-size="10" fill="#82929d" font-family="IBM Plex Mono, monospace">slice ${i+1}</text>`;
  svg.innerHTML = s;
  $('depth-legend').hidden = !S.depth;
}

function sync() {
  const f2 = (v) => v.toFixed(2);
  $('lo-o').value = f2(S.lo); $('hi-o').value = f2(S.hi); $('iso-o').value = f2(S.iso);
  $('z0-o').value = S.z0 + 1; $('z1-o').value = S.z1 + 1;
  $('zs-o').value = `${S.zs.toFixed(2)} µm`;
  $('iso-row').hidden = S.mode !== 1;
  $('mode-note').textContent = S.mode === 0
    ? 'Each ray shows the brightest point it passes through.'
    : 'A solid surface wherever the signal crosses the surface level. Slide the level to see where a vessel breaks up.';
  for (const b of $('mode').querySelectorAll('button')) b.setAttribute('aria-pressed', String(+b.dataset.v === S.mode));
  for (const b of $('chan').querySelectorAll('button')) b.setAttribute('aria-pressed', String(+b.dataset.v === S.chan));
  $('overlay-row').hidden = vols.length !== 2;
  $('overlay-name').textContent = vols.length === 2 ? meta.channels[other()].name : '';
  geometry(); dirty = true;
}

function bind() {
  const onFlat = () => { sync(); flat(); };
  $('mode').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.mode = +b.dataset.v; sync(); });
  $('chan').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.chan = +b.dataset.v; uploadChannels();
    try { localStorage.setItem(CHANNEL_KEY, String(S.chan)); } catch { /* no storage: the choice lasts this visit */ }
    onFlat(); });
  $('overlay').addEventListener('change', (e) => { S.overlay = e.target.checked ? 1 : 0; onFlat(); });
  $('depth').addEventListener('change', (e) => { S.depth = e.target.checked ? 1 : 0; onFlat(); });
  for (const k of ['lo', 'hi']) $(k).addEventListener('input', (e) => { S[k] = +e.target.value; onFlat(); });
  $('iso').addEventListener('input', (e) => { S.iso = +e.target.value; sync(); });
  $('z0').addEventListener('input', (e) => { S.z0 = Math.min(+e.target.value, S.z1); e.target.value = S.z0; onFlat(); });
  $('z1').addEventListener('input', (e) => { S.z1 = Math.max(+e.target.value, S.z0); e.target.value = S.z1; onFlat(); });
  $('zs').addEventListener('input', (e) => { S.zs = +e.target.value; sync(); });
  $('sl').addEventListener('input', (e) => { S.slice = +e.target.value; flat(); });
  const view = (yaw, pitch) => () => { S.yaw = yaw; S.pitch = pitch; S.pan = [0, 0]; dirty = true; };
  $('v-top').onclick = view(0, 0); $('v-tilt').onclick = view(-.5, -.6);
  $('v-side').onclick = view(Math.PI / 2, 0); $('v-front').onclick = view(0, Math.PI / 2 - .001);

  controls($('gl'));
  const loop = () => { if (dirty) render(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}

// Drag to rotate, shift-drag or right-drag to pan, wheel or pinch to zoom, on any canvas that shows
// the stack's camera. grab(e), when given, sees each press first and may take that pointer over by
// returning {move(e), up(e), cancel()}.
export function controls(cv, grab) {
  const pts = new Map(), own = new Map();
  let last = null;
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    const g = grab && !pts.size ? grab(e) : null;
    if (g) { own.set(e.pointerId, g); return; }
    pts.set(e.pointerId, [e.clientX, e.clientY]); S.dragging = true; last = null;
  });
  const end = (e) => {
    const g = own.get(e.pointerId);
    if (g) { own.delete(e.pointerId); if (e.type === 'pointerup') g.up(e); else g.cancel?.(); return; }
    pts.delete(e.pointerId); if (!pts.size) { S.dragging = false; dirty = true; } last = null;
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointermove', (e) => {
    const g = own.get(e.pointerId);
    if (g) return g.move(e);
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    const dx = e.clientX - prev[0], dy = e.clientY - prev[1], k = 2.2 / cv.clientHeight;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (last) S.dist = Math.min(Math.max(S.dist * last / d, .6), 12);
      last = d; S.pan[0] -= dx * k * S.dist / 6; S.pan[1] += dy * k * S.dist / 6;
    } else if (e.shiftKey || e.buttons === 2) { S.pan[0] -= dx * k * S.dist / 3; S.pan[1] += dy * k * S.dist / 3; }
    else { S.yaw -= dx * .008; S.pitch = Math.min(Math.max(S.pitch + dy * .008, -Math.PI / 2 + .001), Math.PI / 2 - .001); }
    dirty = true;
  });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => { e.preventDefault(); S.dist = Math.min(Math.max(S.dist * Math.exp(e.deltaY * .001), .6), 12); dirty = true; }, { passive: false });
  new ResizeObserver(() => { dirty = true; }).observe(cv);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Shows a freshly opened stack: {meta, vols} from buildVolumes, and the file's name.
export function show(name, m, v) {
  initGL();
  meta = m; vols = v;
  const [Z, Y, X] = meta.shape;
  Object.assign(S, { z0: 0, z1: Z - 1, yaw: 0, pitch: 0, dist: 4.4, pan: [0, 0] });
  let saved = null;
  try { saved = localStorage.getItem(CHANNEL_KEY); } catch { /* no storage */ }
  S.chan = saved != null && +saved < vols.length ? +saved : 0;
  for (const id of ['z0', 'z1', 'sl']) $(id).max = Z - 1;
  $('z0').value = 0; $('z1').value = S.z1;
  S.zs = meta.z_step_um || 1;
  $('zs').max = Math.max(10, 2 * S.zs); $('zs').value = S.zs;
  $('zs-note').textContent = meta.z_step_um ? '' :
    'The file does not record the spacing between slices, so depth is drawn at a guessed spacing: slide it and judge the shapes, not the depth in µm.';
  // the single-slice picture opens on the slice with the most contrast in the shown channel
  const c = meta.channels[S.chan], con = c.slice_p99.map((p, i) => p - c.slice_p50[i]);
  S.slice = con.indexOf(Math.max(...con)); $('sl').value = S.slice;
  $('chan').innerHTML = meta.channels.map((ch, i) => `<button type="button" data-v="${i}">${esc(ch.name)}</button>`).join('');
  $('chan-set').hidden = vols.length < 2;
  const um = meta.um_per_px;
  $('facts').innerHTML = `<span><b>${esc(name)}</b></span><span>${X} × ${Y} px × ${Z} slices` +
    `${meta.bin > 1 ? ` (shown binned ${meta.bin}×)` : ''}</span>` +
    `<span>${um ? um.toFixed(2) + ' µm/px (from the file)' : 'pixel size unknown'}</span>` +
    `<span class="${meta.z_step_um ? '' : 'guess'}">${meta.z_step_um ? 'slice spacing ' + meta.z_step_um + ' µm' : 'slice spacing unknown'}</span>` +
    (meta.frames > 1 ? `<span class="guess">time point 1 of ${meta.frames}</span>` : '');
  uploadChannels();
  if (!bound) { bind(); bound = true; }
  sync(); flat();
}
