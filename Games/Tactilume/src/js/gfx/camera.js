// The camera: looks at the touch plane (z = 0) from distance DIST, framed so the
// plane spans exactly y -1..1 on screen. "Camera drift" sways it gently; touches
// are cast onto the plane through the same camera, so they land where the finger is.

export const DIST = 3;
const TAN_HALF = 1 / DIST;
const NEAR = 0.08;
const FAR = 24;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export function createCamera() {
  const viewProj = new Float32Array(16);
  const cam = {
    eye: [0, 0, DIST], right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, -1],
    aspect: 1, dist: DIST, viewProj,

    // `orbit` 0..1 from the scene; `t` a clock in seconds
    update(aspect, orbit, t) {
      cam.aspect = aspect;
      const yaw = orbit * (0.24 * Math.sin(t * 0.047) + 0.09 * Math.sin(t * 0.113 + 2.1));
      const pitch = orbit * (0.13 * Math.sin(t * 0.031 + 1.0) + 0.04 * Math.sin(t * 0.09));
      const d = DIST * (1 + 0.035 * orbit * Math.sin(t * 0.071));
      cam.dist = d;
      cam.eye = [d * Math.sin(yaw) * Math.cos(pitch), d * Math.sin(pitch), d * Math.cos(yaw) * Math.cos(pitch)];
      cam.fwd = norm(sub([0, 0, 0], cam.eye));
      cam.right = norm(cross(cam.fwd, [0, 1, 0]));
      cam.up = cross(cam.right, cam.fwd);
      // the plane stays framed at the same size while the camera breathes in and out,
      // so only the depth in front of and behind it shifts (parallax)
      const th = 1 / d;
      const f = 1 / th;
      // view matrix rows (column-major storage below)
      const r = cam.right, u = cam.up, b = [-cam.fwd[0], -cam.fwd[1], -cam.fwd[2]];
      const e = cam.eye;
      const view = [
        r[0], u[0], b[0], 0,
        r[1], u[1], b[1], 0,
        r[2], u[2], b[2], 0,
        -dot(r, e), -dot(u, e), -dot(b, e), 1,
      ];
      const nf = 1 / (NEAR - FAR);
      const proj = [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (FAR + NEAR) * nf, -1,
        0, 0, 2 * FAR * NEAR * nf, 0,
      ];
      // viewProj = proj * view (column-major)
      for (let c = 0; c < 4; c++) {
        for (let rr = 0; rr < 4; rr++) {
          let s = 0;
          for (let k = 0; k < 4; k++) s += proj[k * 4 + rr] * view[c * 4 + k];
          viewProj[c * 4 + rr] = s;
        }
      }
      cam.tanHalf = th;
    },

    // normalised device coordinates (-1..1, y up) -> the point on the plane z = 0
    ndcToPlane(nx, ny) {
      const th = cam.tanHalf || TAN_HALF;
      const dir = norm([
        cam.fwd[0] + (nx * th * cam.aspect) * cam.right[0] + (ny * th) * cam.up[0],
        cam.fwd[1] + (nx * th * cam.aspect) * cam.right[1] + (ny * th) * cam.up[1],
        cam.fwd[2] + (nx * th * cam.aspect) * cam.right[2] + (ny * th) * cam.up[2],
      ]);
      if (Math.abs(dir[2]) < 1e-4) return { x: nx * cam.aspect, y: ny };
      const t = -cam.eye[2] / dir[2];
      return { x: cam.eye[0] + dir[0] * t, y: cam.eye[1] + dir[1] * t };
    },

    planeToNdc(x, y) {
      const m = viewProj;
      const cx = m[0] * x + m[4] * y + m[12];
      const cy = m[1] * x + m[5] * y + m[13];
      const cw = m[3] * x + m[7] * y + m[15];
      return { nx: cx / cw, ny: cy / cw };
    },
  };
  cam.update(1, 0, 0);
  return cam;
}
