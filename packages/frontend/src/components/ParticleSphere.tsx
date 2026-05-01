import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { SphereState, ParticleShape } from "@/lib/types";
import { generateShape } from "@/lib/shapes";

// Monochrome design — all states share the same color, only motion changes.
const STATE_PARAMS: Record<
  SphereState,
  {
    speed: number;
    scale: number;
    jitter: number;
    ringIntensity: number;
    opacity: number;
    density: number; // visual size of each dot
    pulseRate: number; // breathing speed
  }
> = {
  // Idle = pause mode: slow drift, dim rings, almost no jitter.
  idle:       { speed: 0.0010, scale: 0.98, jitter: 0.002, ringIntensity: 0.08, opacity: 0.55, density: 0.030, pulseRate: 0.6 },
  listening:  { speed: 0.006,  scale: 1.04, jitter: 0.020, ringIntensity: 0.85, opacity: 0.95, density: 0.038, pulseRate: 1.6 },
  thinking:   { speed: 0.015,  scale: 1.08, jitter: 0.035, ringIntensity: 0.45, opacity: 0.85, density: 0.034, pulseRate: 2.4 },
  responding: { speed: 0.010,  scale: 1.06, jitter: 0.024, ringIntensity: 1.00, opacity: 1.00, density: 0.040, pulseRate: 2.0 },
};

export function ParticleSphere({
  state,
  shape = "sphere",
  volume = 0,
}: {
  state: SphereState;
  shape?: ParticleShape;
  /** External audio volume 0..1 — boosts vibration & ring intensity in real time */
  volume?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SphereState>(state);
  const shapeRef = useRef<ParticleShape>(shape);
  const volumeRef = useRef<number>(volume);
  const morphRef = useRef<{
    from: Float32Array;
    to: Float32Array;
    t: number; // 0..1
    active: boolean;
  } | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Trigger morph when shape changes
  useEffect(() => {
    shapeRef.current = shape;
  }, [shape]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = 3.2;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";

    // Far fewer, evenly-spaced particles — like the reference GIF.
    const COUNT = 420;
    const positions = new Float32Array(COUNT * 3);
    const basePositions = new Float32Array(COUNT * 3);
    const initial = generateShape(shapeRef.current, COUNT);
    positions.set(initial);
    basePositions.set(initial);
    let currentShape: ParticleShape = shapeRef.current;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 0.038,
      sizeAttenuation: true,
      color: new THREE.Color(0xffffff),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Orbital rings (equator + two polar caps), like the reference GIF.
    const buildRing = (radius: number, particles: number, yOffset = 0, tilt = 0) => {
      const arr = new Float32Array(particles * 3);
      for (let i = 0; i < particles; i++) {
        const a = (i / particles) * Math.PI * 2;
        const x = Math.cos(a) * radius;
        const z = Math.sin(a) * radius;
        const y = yOffset + Math.sin(a + tilt) * 0.0;
        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = z;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      const m = new THREE.PointsMaterial({
        size: 0.028,
        color: 0xffffff,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      return new THREE.Points(g, m);
    };
    // Sparser rings, evenly spaced.
    const ringEquator = buildRing(1.0, 90, 0);
    const ringTop = buildRing(0.55, 60, 0.82);
    const ringTop2 = buildRing(0.30, 40, 0.95);
    const ringBottom = buildRing(0.55, 60, -0.82);
    const ringBottom2 = buildRing(0.30, 40, -0.95);
    const rings = [ringEquator, ringTop, ringTop2, ringBottom, ringBottom2];
    rings.forEach((r) => scene.add(r));

    // Resize
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Pointer drag for rotation (touch + mouse)
    let isDown = false;
    let lastX = 0,
      lastY = 0;
    let velX = 0,
      velY = 0;
    const onDown = (e: PointerEvent) => {
      isDown = true;
      lastX = e.clientX;
      lastY = e.clientY;
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!isDown) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      velX = dy * 0.005;
      velY = dx * 0.005;
      points.rotation.x += velX;
      points.rotation.y += velY;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => {
      isDown = false;
    };
    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointercancel", onUp);

    // Animation
    let currentScale = 1;
    let ringOpacity = 0;
    let currentDensity = 0.038;
    let currentOpacity = 0.55;
    let t = 0;
    let raf = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const s = stateRef.current;
      const params = STATE_PARAMS[s];
      const vol = volumeRef.current; // 0..1
      const volBoost = Math.min(1, vol * 4); // amplify low input

      // Smooth transitions in/out of pause (idle).
      const targetScale = params.scale + volBoost * 0.06;
      currentScale += (targetScale - currentScale) * 0.05;
      points.scale.setScalar(currentScale);

      const targetOpacity = params.opacity + volBoost * 0.1;
      currentOpacity += (targetOpacity - currentOpacity) * 0.05;
      material.opacity = currentOpacity;

      // Pulse particle size (density) per state — GIF-like breathing.
      const breath = 1 + Math.sin(t * params.pulseRate) * 0.12;
      const targetDensity = params.density * breath + volBoost * 0.012;
      currentDensity += (targetDensity - currentDensity) * 0.08;
      material.size = currentDensity;

      // Ring fade in/out per state — smoothly fade to near-zero in pause.
      const targetRing = params.ringIntensity + volBoost * 0.4;
      ringOpacity += (targetRing - ringOpacity) * 0.04;
      rings.forEach((r, i) => {
        const mat = r.material as THREE.PointsMaterial;
        const pulse = 0.7 + Math.sin(t * params.pulseRate + i * 0.8) * 0.3;
        mat.opacity = ringOpacity * pulse;
        mat.size = 0.026 + currentDensity * 0.2;
        r.scale.setScalar(currentScale);
      });
      // Counter-rotate rings for an orbital feel
      const ringSpeedScale = 0.3 + ringOpacity; // slow when paused
      ringEquator.rotation.y += (0.010 + params.speed) * ringSpeedScale;
      ringTop.rotation.y -= 0.018 * ringSpeedScale;
      ringTop2.rotation.y -= 0.030 * ringSpeedScale;
      ringBottom.rotation.y -= 0.018 * ringSpeedScale;
      ringBottom2.rotation.y -= 0.030 * ringSpeedScale;

      // Detect shape change and start morph
      if (shapeRef.current !== currentShape) {
        currentShape = shapeRef.current;
        morphRef.current = {
          from: new Float32Array(basePositions),
          to: generateShape(currentShape, COUNT),
          t: 0,
          active: true,
        };
      }

      // Advance morph
      if (morphRef.current?.active) {
        const m = morphRef.current;
        m.t = Math.min(1, m.t + 0.018);
        const e = m.t < 0.5 ? 2 * m.t * m.t : 1 - Math.pow(-2 * m.t + 2, 2) / 2;
        for (let i = 0; i < COUNT * 3; i++) {
          basePositions[i] = m.from[i] + (m.to[i] - m.from[i]) * e;
        }
        if (m.t >= 1) m.active = false;
      }

      // Inertia
      if (!isDown) {
        velX *= 0.95;
        velY *= 0.95;
        points.rotation.x += velX;
        points.rotation.y += velY + params.speed;
      } else {
        points.rotation.y += params.speed;
      }

      // Particle jitter for active states — boosted by live volume.
      t += 0.016;
      const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
      const j = params.jitter + volBoost * 0.05;
      for (let i = 0; i < COUNT; i++) {
        const ix = i * 3;
        const wave = Math.sin(t * (1.5 + params.pulseRate) + i * 0.35) * j;
        pos.array[ix] = basePositions[ix] * (1 + wave);
        pos.array[ix + 1] = basePositions[ix + 1] * (1 + wave);
        pos.array[ix + 2] = basePositions[ix + 2] * (1 + wave);
      }
      pos.needsUpdate = true;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointercancel", onUp);
      geometry.dispose();
      material.dispose();
      rings.forEach((r) => {
        r.geometry.dispose();
        (r.material as THREE.PointsMaterial).dispose();
      });
      renderer.dispose();
      if (dom.parentNode) dom.parentNode.removeChild(dom);
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" aria-hidden="true" />;
}