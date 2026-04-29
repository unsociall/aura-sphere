import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { SphereState } from "@/lib/types";

const STATE_HSL: Record<SphereState, [number, number, number]> = {
  idle: [200 / 360, 1, 0.55],
  listening: [165 / 360, 1, 0.55],
  thinking: [50 / 360, 1, 0.6],
  responding: [290 / 360, 1, 0.65],
};

const STATE_PARAMS: Record<SphereState, { speed: number; scale: number; jitter: number }> = {
  idle: { speed: 0.0015, scale: 1, jitter: 0.003 },
  listening: { speed: 0.008, scale: 1.08, jitter: 0.02 },
  thinking: { speed: 0.02, scale: 1.18, jitter: 0.05 },
  responding: { speed: 0.012, scale: 1.25, jitter: 0.035 },
};

export function ParticleSphere({ state }: { state: SphereState }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SphereState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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
    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 1;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      basePositions[i * 3] = x;
      basePositions[i * 3 + 1] = y;
      basePositions[i * 3 + 2] = z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 0.025,
      color: new THREE.Color().setHSL(...STATE_HSL.idle),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Glowing core
    const coreGeo = new THREE.SphereGeometry(0.45, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(...STATE_HSL.idle),
      transparent: true,
      opacity: 0.18,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

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
    const targetColor = new THREE.Color().setHSL(...STATE_HSL.idle);
    let currentScale = 1;
    let t = 0;
    let raf = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const s = stateRef.current;
      const params = STATE_PARAMS[s];
      targetColor.setHSL(...STATE_HSL[s]);
      material.color.lerp(targetColor, 0.06);
      coreMat.color.lerp(targetColor, 0.06);

      currentScale += (params.scale - currentScale) * 0.06;
      points.scale.setScalar(currentScale);
      core.scale.setScalar(currentScale);

      // Inertia
      if (!isDown) {
        velX *= 0.95;
        velY *= 0.95;
        points.rotation.x += velX;
        points.rotation.y += velY + params.speed;
      } else {
        points.rotation.y += params.speed;
      }
      core.rotation.y = points.rotation.y;

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

      coreMat.opacity = 0.15 + Math.sin(t * 2) * 0.05 + (s === "idle" ? 0 : 0.08);

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
      coreGeo.dispose();
      coreMat.dispose();
      renderer.dispose();
      if (dom.parentNode) dom.parentNode.removeChild(dom);
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" aria-hidden="true" />;
}