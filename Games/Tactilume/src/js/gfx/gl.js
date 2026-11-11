// Thin WebGL2 helpers: shaders with readable errors, render targets, uniform lookup.

// Shader sources may contain "#include common"; the shared chunk is pasted there.
export function preprocess(src, chunks) {
  return src.replace(/^#include (\w+)\s*$/gm, (_, name) => {
    if (!(name in chunks)) throw new Error(`unknown shader include "${name}"`);
    return chunks[name];
  });
}

function compile(gl, type, src, name) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(sh) || '';
    // show the offending lines, so a driver's terse "ERROR: 0:123" is useful
    const lines = src.split('\n');
    const near = [...log.matchAll(/ERROR: \d+:(\d+)/g)].slice(0, 3).map((m) => {
      const n = +m[1];
      return lines.slice(Math.max(0, n - 3), n + 1).map((l, i) => `${n - 2 + i}: ${l}`).join('\n');
    }).join('\n---\n');
    gl.deleteShader(sh);
    throw new Error(`${name} (${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'}) failed to compile:\n${log}\n${near}`);
  }
  return sh;
}

// Returns { prog, u } where u maps uniform names (without "[0]") to locations.
export function createProgram(gl, vsSrc, fsSrc, { name = 'program', varyings = null } = {}) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc, name);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc, name);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  if (varyings) gl.transformFeedbackVaryings(prog, varyings, gl.INTERLEAVED_ATTRIBS);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`${name} failed to link: ${log}`);
  }
  const u = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) || 0;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    const key = info.name.replace(/\[0\]$/, '');
    u[key] = gl.getUniformLocation(prog, info.name);
  }
  return { prog, u };
}

// A texture with a framebuffer around it. `fmt` is { internal, format, type }.
export function createTarget(gl, w, h, fmt, filter = gl.LINEAR) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internal, w, h, 0, fmt.format, fmt.type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return { tex, fbo, w, h, ok };
}

export function destroyTarget(gl, t) {
  if (!t) return;
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.tex);
}

// Can this context render (and blend) into `fmt`? Tried once with a tiny target.
export function canRender(gl, fmt) {
  const t = createTarget(gl, 4, 4, fmt);
  destroyTarget(gl, t);
  return t.ok;
}
