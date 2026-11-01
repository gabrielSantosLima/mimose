export const VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aQuad;
layout(location = 1) in vec2 aSrcCenter;
layout(location = 2) in vec2 aDstCenter;
layout(location = 3) in vec4 aSrcRect;
layout(location = 4) in vec2 aSrcSize;
layout(location = 5) in vec3 aColor;
layout(location = 6) in float aSeed;

uniform vec4 uSrcRect;
uniform vec4 uDstRect;
uniform vec2 uDstSize;
uniform vec2 uViewport;
uniform float uProgress;
uniform float uTime;
uniform float uMotion;

out vec2 vUv;
out vec3 vColor;

void main() {
  vec2 viewport = max(uViewport, vec2(1.0));
  float aspect = viewport.x / viewport.y;
  float delay = aSeed * 0.24;
  float local = clamp(
    (uProgress - delay) / max(1.0 - delay, 0.001),
    0.0,
    1.0
  );
  float eased = local * local * (3.0 - 2.0 * local);
  float transit = sin(3.14159265 * eased);

  vec2 srcPos = uSrcRect.xy + aSrcCenter * uSrcRect.zw;
  vec2 dstPos = uDstRect.xy + aDstCenter * uDstRect.zw;
  vec2 position = mix(srcPos, dstPos, eased);

  float seedAngle = aSeed * 6.2831853;
  vec2 direction = vec2(cos(seedAngle), sin(seedAngle));
  float phase = uTime * 0.55 + seedAngle;
  vec2 swirl = vec2(
    sin(srcPos.y * 4.5 * aspect + phase),
    cos(srcPos.x * 4.0 / max(aspect, 0.001) + phase * 1.13)
  );
  float unit = min(viewport.x, viewport.y);
  vec2 drift =
    (direction * (0.075 + aSeed * 0.035) + swirl * 0.022) * unit;
  position += (drift / viewport) * transit * uMotion;

  float angle = (aSeed - 0.5) * 2.2 * transit * uMotion;
  float pulse = 1.0 + 0.24 * transit * (0.35 + aSeed) * uMotion;
  vec2 sourceSize = aSrcSize * uSrcRect.zw;
  vec2 sizePx =
    mix(sourceSize, uDstSize, eased) * viewport * pulse + vec2(0.5);

  float cosine = cos(angle);
  float sine = sin(angle);
  vec2 rotated = vec2(
    aQuad.x * cosine - aQuad.y * sine,
    aQuad.x * sine + aQuad.y * cosine
  );
  vec2 offsetPx = rotated * sizePx;
  vec2 clip = vec2(position.x * 2.0 - 1.0, 1.0 - position.y * 2.0);

  gl_Position = vec4(clip + offsetPx / viewport * 2.0, 0.0, 1.0);

  vUv = vec2(
    mix(aSrcRect.x, aSrcRect.z, aQuad.x + 0.5),
    mix(1.0 - aSrcRect.w, 1.0 - aSrcRect.y, aQuad.y + 0.5)
  );
  vColor = aColor;
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uTexture;
uniform float uProgress;

in vec2 vUv;
in vec3 vColor;

out vec4 outColor;

void main() {
  vec4 texel = texture(uTexture, vUv);
  float flatten = smoothstep(0.8, 1.0, uProgress);
  vec3 color = mix(texel.rgb, vColor, flatten);
  outColor = vec4(color, texel.a);
}
`;
