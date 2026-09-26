import { useEffect, useRef } from 'react'
import { Renderer, Program, Mesh, Triangle } from 'ogl'

const VERT = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

// グラデーションの上に重ねる白いスピードライン
const FRAG = `#version 300 es
precision highp float;

uniform float uTime;

in vec2 vUv;
out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ),
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  mat2 m = mat2(1.7, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    v += a * snoise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

float fibers(vec2 p) {
  float n = fbm(p) * 0.5 + 0.5;
  float crushed = clamp((n - 0.46) * 9.0 + 0.08, 0.0, 1.0);
  return pow(crushed, 3.4);
}

void main() {
  vec2 uv = vUv;

  float evo = uTime * 2.4;
  float core = fibers(vec2(uv.x * 0.42 + uTime * 3.1, uv.y * 52.0 + evo));
  float glow = fibers(vec2(uv.x * 0.28 + uTime * 4.6, uv.y * 74.0 - evo * 1.3 + 13.0));

  float alpha = clamp(core * 0.55 + glow + pow(glow, 0.45) * 0.4, 0.0, 1.0);
  fragColor = vec4(vec3(alpha), alpha);
}
`

export const SpeedLines = () => {
    const ctnDom = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const ctn = ctnDom.current
        if (!ctn) return

        const renderer = new Renderer({
            alpha: true,
            premultipliedAlpha: true,
            antialias: true,
            dpr: Math.min(2, window.devicePixelRatio || 1)
        })
        const gl = renderer.gl
        gl.clearColor(0, 0, 0, 0)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        gl.canvas.style.backgroundColor = 'transparent'
        gl.canvas.style.display = 'block'
        gl.canvas.style.pointerEvents = 'none'

        const width = ctn.parentElement?.clientWidth || window.innerWidth
        const height = ctn.parentElement?.clientHeight || window.innerHeight

        const geometry = new Triangle(gl)
        if (geometry.attributes.uv) {
            delete geometry.attributes.uv
        }

        const program = new Program(gl, {
            vertex: VERT,
            fragment: FRAG,
            uniforms: {
                uTime: { value: 0 }
            }
        })

        const mesh = new Mesh(gl, { geometry, program })
        ctn.appendChild(gl.canvas)
        renderer.setSize(width, height)

        let animateId = 0
        const update = (t: number) => {
            animateId = requestAnimationFrame(update)
            program.uniforms.uTime.value = t * 0.001
            renderer.render({ scene: mesh })
        }
        animateId = requestAnimationFrame(update)

        return () => {
            cancelAnimationFrame(animateId)
            if (ctn && gl.canvas.parentNode === ctn) {
                ctn.removeChild(gl.canvas)
            }
            gl.getExtension('WEBGL_lose_context')?.loseContext()
        }
    }, [])

    return (
        <div
            ref={ctnDom}
            style={{
                position: 'absolute',
                inset: 0
            }}
        />
    )
}
