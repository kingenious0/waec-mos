"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface GradientMeshProps {
  colors?: string[];
  distortion?: number;
  swirl?: number;
  speed?: number;
  rotation?: number;
  waveAmp?: number;
  waveFreq?: number;
  waveSpeed?: number;
  grain?: number;
  className?: string;
}

// Convert hex string to RGB [0-1]
function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace("#", "");
  const num = parseInt(
    cleanHex.length === 3
      ? cleanHex
          .split("")
          .map((c) => c + c)
          .join("")
      : cleanHex,
    16
  );
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

export function GradientMesh({
  colors = ["#bcecf6", "#00aaff", "#ffd447"],
  distortion = 8,
  swirl = 0.2,
  speed = 1,
  rotation = 90,
  waveAmp = 0.2,
  waveFreq = 20,
  waveSpeed = 0.2,
  grain = 0.06,
  className,
}: GradientMeshProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl") || (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    // Fallback to 2D Canvas if WebGL is unavailable
    if (!gl) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      let animId: number;
      let t = 0;
      const render2D = () => {
        t += 0.01 * speed;
        const w = (canvas.width = canvas.clientWidth);
        const h = (canvas.height = canvas.clientHeight);
        const grad = ctx.createLinearGradient(0, 0, w, h);
        colors.forEach((c, idx) => {
          grad.addColorStop(idx / Math.max(colors.length - 1, 1), c);
        });
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        animId = requestAnimationFrame(render2D);
      };
      render2D();
      return () => cancelAnimationFrame(animId);
    }

    // Vertex Shader
    const vsSource = `
      attribute vec2 position;
      varying vec2 vUv;
      void main() {
        vUv = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Fragment Shader: Fluid Multi-Color Distorted Mesh with Grain
    const fsSource = `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uDistortion;
      uniform float uSwirl;
      uniform float uRotation;
      uniform float uWaveAmp;
      uniform float uWaveFreq;
      uniform float uGrain;

      // Pseudo-random noise
      float random(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      // Smooth 2D noise
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(random(i + vec2(0.0, 0.0)),
                       random(i + vec2(1.0, 0.0)), u.x),
                   mix(random(i + vec2(0.0, 1.0)),
                       random(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      // Fractal Brownian Motion
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        for (int i = 0; i < 4; ++i) {
          v += a * noise(p);
          p = rot * p * 2.0 + shift;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = vUv;
        float aspect = uResolution.x / max(uResolution.y, 1.0);
        vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

        // Rotation
        float rad = radians(uRotation);
        mat2 rotM = mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
        p = rotM * p;

        // Swirl around center
        float dist = length(p);
        float angle = dist * uSwirl * 5.0;
        mat2 swirlM = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        p = swirlM * p;

        // Wave Distortion
        float wave = sin(p.y * uWaveFreq + uTime * 0.8) * uWaveAmp;
        float wave2 = cos(p.x * uWaveFreq * 0.8 + uTime * 0.6) * uWaveAmp;
        vec2 q = p + vec2(wave, wave2);

        // Domain warping via FBM
        vec2 warp;
        warp.x = fbm(q * (uDistortion * 0.3) + vec2(uTime * 0.2, 0.0));
        warp.y = fbm(q * (uDistortion * 0.3) + vec2(0.0, uTime * 0.25));

        vec2 r = q + warp * 0.8;
        float f = fbm(r * 2.0 + vec2(uTime * 0.15, -uTime * 0.1));

        // Color blending across 3 primary colors + soft white highlight
        vec3 col = mix(uColor1, uColor2, clamp(f * 1.5, 0.0, 1.0));
        col = mix(col, uColor3, clamp(length(warp) * 1.2 - 0.2, 0.0, 1.0));

        // Soft organic light caustic highlights
        float highlight = smoothstep(0.65, 0.9, f + length(warp) * 0.3);
        col = mix(col, vec3(1.0, 1.0, 0.98), highlight * 0.45);

        // Film grain texture
        float n = (random(uv * uResolution.xy + fract(uTime) * 100.0) - 0.5) * uGrain;
        col += vec3(n);

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    function createShader(gl: WebGLRenderingContext, type: number, source: string) {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Fullscreen Quad Buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Uniform locations
    const uTimeLoc = gl.getUniformLocation(program, "uTime");
    const uResLoc = gl.getUniformLocation(program, "uResolution");
    const uCol1Loc = gl.getUniformLocation(program, "uColor1");
    const uCol2Loc = gl.getUniformLocation(program, "uColor2");
    const uCol3Loc = gl.getUniformLocation(program, "uColor3");
    const uDistLoc = gl.getUniformLocation(program, "uDistortion");
    const uSwirlLoc = gl.getUniformLocation(program, "uSwirl");
    const uRotLoc = gl.getUniformLocation(program, "uRotation");
    const uWaveAmpLoc = gl.getUniformLocation(program, "uWaveAmp");
    const uWaveFreqLoc = gl.getUniformLocation(program, "uWaveFreq");
    const uGrainLoc = gl.getUniformLocation(program, "uGrain");

    const c1 = hexToRgb(colors[0] || "#bcecf6");
    const c2 = hexToRgb(colors[1] || "#00aaff");
    const c3 = hexToRgb(colors[2] || "#ffd447");

    gl.uniform3f(uCol1Loc, c1[0], c1[1], c1[2]);
    gl.uniform3f(uCol2Loc, c2[0], c2[1], c2[2]);
    gl.uniform3f(uCol3Loc, c3[0], c3[1], c3[2]);
    gl.uniform1f(uDistLoc, distortion);
    gl.uniform1f(uSwirlLoc, swirl);
    gl.uniform1f(uRotLoc, rotation);
    gl.uniform1f(uWaveAmpLoc, waveAmp);
    gl.uniform1f(uWaveFreqLoc, waveFreq);
    gl.uniform1f(uGrainLoc, grain);

    let animationFrameId: number;
    let startTime = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor((canvas.clientWidth || 300) * dpr);
      const height = Math.floor((canvas.clientHeight || 300) * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        gl.uniform2f(uResLoc, width, height);
      }
    };

    const render = () => {
      resize();
      const elapsed = ((performance.now() - startTime) / 1000) * speed * waveSpeed * 2.5;
      gl.uniform1f(uTimeLoc, elapsed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (positionBuffer) gl.deleteBuffer(positionBuffer);
      if (program) gl.deleteProgram(program);
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
    };
  }, [
    colors,
    distortion,
    swirl,
    speed,
    rotation,
    waveAmp,
    waveFreq,
    waveSpeed,
    grain,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("absolute inset-0 size-full object-cover", className)}
    />
  );
}
export default GradientMesh;
