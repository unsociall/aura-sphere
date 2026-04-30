import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { SphereState, ParticleShape } from "@/lib/types";
import { generateShape } from "@/lib/shapes";

// Monochrome design — all states share the same color, only motion changes.
const STATE_PARAMS: Record<
  SphereState,
  { speed: number; scale: number; jitter: number; ringIntensity: number; opacity: number }
> = {
  idle:       { speed: 0.0015, scale: 1.00, jitter: 0.003, ringIntensity: 0.15, opacity: 0.85 },
  listening:  { speed: 0.008,  scale: 1.05, jitter: 0.018, ringIntensity: 0.9,  opacity: 1.0  },
  thinking:   { speed: 0.02,   scale: 1.10, jitter: 0.04,  ringIntensity: 0.5,  opacity: 0.95 },
  responding: { speed: 0.012,  scale: 1.08, jitter: 0.022, ringIntensity: 1.0,  opacity: 1.0  },
};

export function ParticleSphere({
  state,
  shape = "sphere",
}: {
  state: SphereState;
  shape?: ParticleShape;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SphereState>(state);
  const shapeRef = useRef<ParticleShape>(shape);
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

    // Particles on a sphere
    const COUNT = 2500;
    const positions = new Float32Array(COUNT * 3);
    const basePositions = new Float32Array(COUNT * 3);
    const initial = generateShape(shapeRef.current, COUNT);
    positions.set(initial);
    basePositions.set(initial);
    let currentShape: ParticleShape = shapeRef.current;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 0.022,
      color: new THREE.Color(0xffffff),
      transparent: true,
      opacity: 0.9,
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
    const ringEquator = buildRing(1.0, 260, 0);
    const ringTop = buildRing(0.45, 140, 0.88);
    const ringTop2 = buildRing(0.28, 100, 0.95);
    const ringBottom = buildRing(0.45, 140, -0.88);
    const ringBottom2 = buildRing(0.28, 100, -0.95);
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
    let t = 0;
    let raf = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const s = stateRef.current;
      const params = STATE_PARAMS[s];

      currentScale += (params.scale - currentScale) * 0.06;
      points.scale.setScalar(currentScale);
      material.opacity += (params.opacity - material.opacity) * 0.06;

      // Ring fade in/out per state
      ringOpacity += (params.ringIntensity - ringOpacity) * 0.05;
      rings.forEach((r, i) => {
        const mat = r.material as THREE.PointsMaterial;
        const pulse = 0.85 + Math.sin(t * 3 + i) * 0.15;
        mat.opacity = ringOpacity * pulse;
        r.scale.setScalar(currentScale);
      });
      // Counter-rotate rings for an orbital feel
      ringEquator.rotation.y += 0.012 + params.speed;
      ringTop.rotation.y -= 0.02;
      ringTop2.rotation.y -= 0.035;
      ringBottom.rotation.y -= 0.02;
      ringBottom2.rotation.y -= 0.035;

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

      // Particle jitter for active states
      t += 0.016;
      const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
      const j = params.jitter;
      for (let i = 0; i < COUNT; i++) {
        const ix = i * 3;
        const wave = Math.sin(t * 2 + i * 0.3) * j;
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