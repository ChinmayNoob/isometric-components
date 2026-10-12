/*
 * The combustor flame, seen through the silo's cutaway window. The window is cut through the outer wall and the flame
 * tube inside it; the flame burns down the tube from the burner at the top. Everything is in world space in the
 * figure's own camera: each pixel's ray is intersected with the two walls' cylinders, masked by the window on both
 * (an opening seen through an opening is masked twice), and the flame is marched along the chord inside the tube.
 *
 * uFire (0..1) is the fuel: it sets the flame's size and heat, and rides a critically damped envelope in the live
 * component, so ignition and flame-out never pop. Dark ink is light added (screen-blended); light ink is solved for
 * paper: a saturated orange body, a pale core at the hottest, an alpha floor so the core covers what is behind it.
 */

export type FlameData = { x: number; y: number; liner: number; r: number; a0: number; a1: number; z0: number; z1: number };

export const FLAME = /* glsl */ `
uniform float uFire;
uniform float uLight;
uniform vec4 uSilo;
uniform vec4 uWin;

const float BURNER_Z = 186.;
const float FLAME_LEN = 82.;

/* Far and near ray parameters where the pixel's ray meets a vertical cylinder; larger t is nearer the viewer. */
vec2 cylinderHits(vec3 p0, vec3 V, vec2 c, float r) {
  vec2 d = p0.xy - c;
  vec2 v = V.xy;
  float a = dot(v, v);
  float b = 2. * dot(d, v);
  float k = dot(d, d) - r * r;
  float disc = b * b - 4. * a * k;
  if (disc <= 0.) return vec2(0., -1.);
  float s = sqrt(disc);
  return vec2((-b - s) / (2. * a), (-b + s) / (2. * a));
}

/* Soft window on a wall at radius r: in arc length round the axis and in height, one pixel soft. */
float onWindow(vec3 p, float r, float px) {
  float angle = atan(p.y - uSilo.y, p.x - uSilo.x);
  float around = window(angle * r, uWin.x * r, uWin.y * r, .7 * px);
  float up = window(p.z, uWin.z, uWin.w, .7 * px / uCam.w);
  return around * up;
}

vec3 rampDark(float m) {
  vec3 ember = vec3(1., .28, .04);
  vec3 body = vec3(1., .58, .12);
  vec3 core = vec3(1., .92, .74);
  return mix(mix(ember, body, smoothstep(.2, .6, m)), core, smoothstep(.76, .98, m));
}

vec4 inkFor(vec3 seen, float cover) {
  vec3 absorbed = 1. - seen;
  float a = max(max(absorbed.r, max(absorbed.g, absorbed.b)), cover);
  return vec4(vec3(a) - absorbed, a);
}

vec3 paperOf(float m) {
  vec3 tint = vec3(1., .86, .62);
  vec3 body = vec3(.97, .5, .1);
  vec3 core = vec3(1., .92, .7);
  vec3 seen = mix(vec3(1.), tint, smoothstep(0., .14, m));
  seen = mix(seen, body, smoothstep(.12, .5, m));
  return mix(seen, core, smoothstep(.66, .95, m));
}

void main() {
  if (uFire < .0005) { gl_FragColor = vec4(0.); return; }
  vec2 vb = viewOf(gl_FragCoord.xy);
  vec3 V = towardViewer();
  vec3 p0 = rayOf(vb);
  float px = pixelOf();

  vec2 tube = cylinderHits(p0, V, uSilo.xy, uSilo.z);
  vec2 wall = cylinderHits(p0, V, uSilo.xy, uSilo.w);
  if (wall.y < wall.x) { gl_FragColor = vec4(0.); return; }
  float outer = onWindow(p0 + wall.y * V, uSilo.w, px);
  if (outer < .001) { gl_FragColor = vec4(0.); return; }
  float inner = tube.y > tube.x ? onWindow(p0 + tube.y * V, uSilo.z, px) : 0.;
  float seen = outer * inner;

  /* The flame: a column round the axis, widening and thinning as it burns down from the burner, with turbulence
   * carried downward by the flow. Marched along the chord inside the tube, dithered. */
  float e = 0.;
  if (seen > .001) {
    const int N = 18;
    float dt = (tube.y - tube.x) / float(N);
    float jitter = hash12(gl_FragCoord.xy + fract(uTime * .37) * 31.);
    for (int i = 0; i < N; i++) {
      vec3 p = p0 + (tube.x + (float(i) + jitter) * dt) * V;
      vec2 q = p.xy - uSilo.xy;
      float h = clamp((BURNER_Z - p.z) / FLAME_LEN, 0., 1.);
      float reach = .35 + .65 * uFire;
      float along = smoothstep(0., .06, h) * (1. - smoothstep(.45 * reach, reach, h));
      /* Tongues: the turbulence carried down by the flow changes the flame's width as well as its brightness. */
      float lick = fbm3(vec3(q * .05, p.z * .045 + uTime * 1.3));
      float radius = (3.2 + 6.5 * h * (.6 + .4 * uFire)) * (.7 + .6 * lick);
      float body = exp(-dot(q, q) / (radius * radius));
      float flow = fbm3(vec3(q * .22, p.z * .07 + uTime * 2.2));
      e += body * along * (.3 + 1.4 * flow * flow);
    }
    e *= dt * .085 * (.55 + .45 * uFire);
  }
  e *= seen;
  /* Light from the flame on the cut faces of the walls, between the two openings. */
  float cut = outer * (1. - inner) * .22 * uFire;

  float m = 1. - exp(-1.7 * e);
  if (uLight < .5) {
    /* In dark the flame is light added over the sooted cavity: more energy, the same ramp. */
    float ed = e * 1.8;
    float md = 1. - exp(-1.7 * ed);
    vec3 col = rampDark(md) * ed + vec3(1., .42, .12) * cut;
    col = tonemap(col, .95);
    float a = max(col.r, max(col.g, col.b));
    float n = (hash12(gl_FragCoord.xy + fract(uTime * .61) * 91.) + hash12(gl_FragCoord.yx * 1.37 + fract(uTime * .37) * 57.) - 1.) / 255.;
    col = max(col + n * smoothstep(0., 1.5 / 255., a), 0.);
    gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));
  } else {
    vec4 flame = inkFor(paperOf(m), .9 * smoothstep(.55, .9, m));
    vec4 tint = inkFor(mix(vec3(1.), vec3(1., .78, .52), min(cut * 2.2, .5)), 0.);
    vec4 ink = flame + tint * (1. - flame.a);
    ink.rgb = min(ink.rgb, vec3(ink.a));
    float n = (hash12(gl_FragCoord.xy + fract(uTime * .61) * 91.) - .5) / 255.;
    ink = max(ink + n * smoothstep(0., 1.5 / 255., ink.a), 0.);
    gl_FragColor = ink;
  }
}
`;
