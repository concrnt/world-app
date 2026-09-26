import { useEffect, useRef } from 'react'
import { Renderer, Program, Mesh, Color, Triangle } from 'ogl'

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;
uniform float uLightMode;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
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
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \
  int index = 0;                                            \
  for (int i = 0; i < 2; i++) {                               \
     ColorStop currentColor = colors[i];                    \
     bool isInBetween = currentColor.position <= factor;    \
     index = int(mix(float(index), float(i), float(isInBetween))); \
  }                                                         \
  ColorStop currentColor = colors[index];                   \
  ColorStop nextColor = colors[index + 1];                  \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  
  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);
  
  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);
  
  float height = snoise(vec2(uv.x * 0.5 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;
  
  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
  
  vec3 auroraColor = intensity * rampColor;
  
  if (uLightMode > 0.5) {
    float energy = clamp(max(intensity, 0.0), 0.0, 1.0);
    float coverage = clamp(auroraAlpha * (0.55 + 0.45 * energy), 0.0, 1.0);
    vec3 chroma = clamp(rampColor, 0.0, 1.0);
    fragColor = vec4(mix(chroma * 0.72, chroma, coverage), 1.0);
  } else {
    fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
  }
}
`

interface AuroraProps {
    colorStops?: string[]
    amplitude?: number
    blend?: number
    time?: number
    speed?: number
    lightMode?: boolean
}

const readChannels = (cssValue: string): [number, number, number] => {
    const probe = document.createElement('div')
    probe.style.backgroundColor = cssValue
    document.body.appendChild(probe)
    const matched = getComputedStyle(probe).backgroundColor.match(/[\d.]+/g)
    probe.remove()
    if (!matched) return [0.016, 0.463, 0.851]
    return [Number(matched[0]) / 255, Number(matched[1]) / 255, Number(matched[2]) / 255]
}

const hex = (channels: [number, number, number]): string => {
    const part = (channel: number): string =>
        Math.round(Math.min(1, Math.max(0, channel)) * 255)
            .toString(16)
            .padStart(2, '0')
    return `#${part(channels[0])}${part(channels[1])}${part(channels[2])}`
}

const scale = (channels: [number, number, number], factor: number): [number, number, number] => [
    Math.min(1, channels[0] * factor),
    Math.min(1, channels[1] * factor),
    Math.min(1, channels[2] * factor)
]

// ボタンのハイライト色だけを使い、少し暗い色と少し明るい色で波を出す
const readAuroraFromTheme = (): { stops: string[]; light: boolean } => {
    const ui = readChannels('var(--ui-background)')
    const content = readChannels('var(--content-background)')
    const luminance = 0.2126 * content[0] + 0.7152 * content[1] + 0.0722 * content[2]
    const light = luminance > 0.62
    return {
        light,
        stops: [hex(scale(ui, 0.78)), hex(ui), hex(scale(ui, 1.18))]
    }
}

const toVec3 = (stops: string[]): number[][] =>
    stops.map((value) => {
        const color = new Color(value)
        return [color.r, color.g, color.b]
    })

export const Aurora = (props: AuroraProps) => {
    const { amplitude = 1.0, blend = 0.5 } = props
    const propsRef = useRef<AuroraProps>(props)
    propsRef.current = props

    const ctnDom = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const ctn = ctnDom.current
        if (!ctn) return

        const theme = readAuroraFromTheme()
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

        let program: Program | undefined

        const safeProbe = document.createElement('div')
        safeProbe.style.paddingTop = 'env(safe-area-inset-top)'
        document.body.appendChild(safeProbe)
        const safeTop = parseFloat(getComputedStyle(safeProbe).paddingTop) || 0
        safeProbe.remove()
        const width = ctn.parentElement?.clientWidth || window.innerWidth
        const height = window.innerHeight - safeTop
        ctn.style.width = `${width}px`
        ctn.style.height = `${height}px`

        const geometry = new Triangle(gl)
        if (geometry.attributes.uv) {
            delete geometry.attributes.uv
        }

        const initialStops = propsRef.current.colorStops ?? theme.stops
        const initialLight = propsRef.current.lightMode ?? theme.light

        program = new Program(gl, {
            vertex: VERT,
            fragment: FRAG,
            uniforms: {
                uTime: { value: 0 },
                uAmplitude: { value: propsRef.current.amplitude ?? amplitude },
                uColorStops: { value: toVec3(initialStops) },
                uResolution: { value: [width, height] },
                uBlend: { value: propsRef.current.blend ?? blend },
                uLightMode: { value: initialLight ? 1 : 0 }
            }
        })

        const mesh = new Mesh(gl, { geometry, program })
        ctn.appendChild(gl.canvas)
        renderer.setSize(width, height)

        let animateId = 0
        const update = (t: number) => {
            animateId = requestAnimationFrame(update)
            const { time = t * 0.01, speed = 1.0 } = propsRef.current
            if (!program) return
            program.uniforms.uTime.value = time * speed * 0.1
            program.uniforms.uAmplitude.value = propsRef.current.amplitude ?? 1.0
            program.uniforms.uBlend.value = propsRef.current.blend ?? blend
            program.uniforms.uLightMode.value = (propsRef.current.lightMode ?? theme.light) ? 1 : 0
            program.uniforms.uColorStops.value = toVec3(propsRef.current.colorStops ?? theme.stops)
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
    }, [amplitude, blend])

    return (
        <div
            ref={ctnDom}
            style={{
                position: 'absolute',
                left: 0,
                bottom: 0
            }}
        />
    )
}
