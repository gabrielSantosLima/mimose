import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders.js";

const FLOATS_PER_INSTANCE = 14;
const BYTES_PER_INSTANCE = FLOATS_PER_INSTANCE * 4;
const MAX_INSTANCES = 250000;

export function createRenderer(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });

  if (!gl) return null;

  const program = createProgram(gl);
  const quadBuffer = gl.createBuffer();
  const instanceBuffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  const texture = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);

  for (const attribute of [
    { location: 1, size: 2, offset: 0 },
    { location: 2, size: 2, offset: 8 },
    { location: 3, size: 4, offset: 16 },
    { location: 4, size: 2, offset: 32 },
    { location: 5, size: 3, offset: 40 },
    { location: 6, size: 1, offset: 52 },
  ]) {
    gl.enableVertexAttribArray(attribute.location);
    gl.vertexAttribPointer(
      attribute.location,
      attribute.size,
      gl.FLOAT,
      false,
      BYTES_PER_INSTANCE,
      attribute.offset
    );
    gl.vertexAttribDivisor(attribute.location, 1);
  }

  gl.bindVertexArray(null);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const uniforms = {
    uSrcRect: gl.getUniformLocation(program, "uSrcRect"),
    uDstRect: gl.getUniformLocation(program, "uDstRect"),
    uDstSize: gl.getUniformLocation(program, "uDstSize"),
    uViewport: gl.getUniformLocation(program, "uViewport"),
    uProgress: gl.getUniformLocation(program, "uProgress"),
    uTime: gl.getUniformLocation(program, "uTime"),
    uMotion: gl.getUniformLocation(program, "uMotion"),
    uTexture: gl.getUniformLocation(program, "uTexture"),
  };

  let instanceCount = 0;
  let motion = 1;

  function resize(width, height, devicePixelRatio) {
    const pixelWidth = Math.max(1, Math.round(width * devicePixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * devicePixelRatio));

    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

    gl.viewport(0, 0, pixelWidth, pixelHeight);
    gl.useProgram(program);
    gl.uniform2f(
      uniforms.uViewport,
      Math.max(1, width),
      Math.max(1, height)
    );
  }

  function setSourceTexture(source) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source
    );
    gl.useProgram(program);
    gl.uniform1i(uniforms.uTexture, 0);
  }

  function setParticles(particles) {
    if (particles.length > MAX_INSTANCES) {
      throw new Error("Too many particles for this renderer.");
    }

    const data = new Float32Array(particles.length * FLOATS_PER_INSTANCE);

    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      const offset = index * FLOATS_PER_INSTANCE;

      data[offset] = particle.srcX;
      data[offset + 1] = particle.srcY;
      data[offset + 2] = particle.target.x;
      data[offset + 3] = particle.target.y;
      data[offset + 4] = particle.rect[0];
      data[offset + 5] = particle.rect[1];
      data[offset + 6] = particle.rect[2];
      data[offset + 7] = particle.rect[3];
      data[offset + 8] = particle.srcSize[0];
      data[offset + 9] = particle.srcSize[1];
      data[offset + 10] = particle.color[0];
      data[offset + 11] = particle.color[1];
      data[offset + 12] = particle.color[2];
      data[offset + 13] = particle.seed;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    instanceCount = particles.length;
  }

  function setLayout({ sourceRect, targetRect, targetSize }) {
    gl.useProgram(program);
    gl.uniform4f(
      uniforms.uSrcRect,
      sourceRect.x,
      sourceRect.y,
      sourceRect.w,
      sourceRect.h
    );
    gl.uniform4f(
      uniforms.uDstRect,
      targetRect.x,
      targetRect.y,
      targetRect.w,
      targetRect.h
    );
    gl.uniform2f(uniforms.uDstSize, targetSize[0], targetSize[1]);
  }

  function setMotion(nextMotion) {
    motion = nextMotion;
  }

  function render(progress, time) {
    gl.clearColor(0.039, 0.039, 0.047, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (!instanceCount) return;

    gl.useProgram(program);
    gl.uniform1f(uniforms.uProgress, Math.min(1, Math.max(0, progress)));
    gl.uniform1f(uniforms.uTime, time);
    gl.uniform1f(uniforms.uMotion, motion);
    gl.uniform1i(uniforms.uTexture, 0);
    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instanceCount);
    gl.bindVertexArray(null);
  }

  function dispose() {
    gl.deleteTexture(texture);
    gl.deleteBuffer(quadBuffer);
    gl.deleteBuffer(instanceBuffer);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
  }

  return {
    resize,
    setSourceTexture,
    setParticles,
    setLayout,
    setMotion,
    render,
    dispose,
  };
}

function createProgram(gl) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || "Unknown link error";
    gl.deleteProgram(program);
    throw new Error(`Could not link the WebGL program: ${info}`);
  }

  return program;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || "Unknown compile error";
    gl.deleteShader(shader);
    throw new Error(`Could not compile the WebGL shader: ${info}`);
  }

  return shader;
}
