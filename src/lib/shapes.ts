import type { ParticleShape } from "./types";

// Generate a target position array for `count` particles for a given shape.
// All shapes are normalized to roughly fit within radius ~1.2.
export function generateShape(shape: ParticleShape, count: number): Float32Array {
  const out = new Float32Array(count * 3);
  switch (shape) {
    case "sphere": {
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        out[i * 3] = Math.sin(phi) * Math.cos(theta);
        out[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
        out[i * 3 + 2] = Math.cos(phi);
      }
      return out;
    }
    case "torus": {
      const R = 0.85,
        r = 0.32;
      for (let i = 0; i < count; i++) {
        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * Math.PI * 2;
        out[i * 3] = (R + r * Math.cos(v)) * Math.cos(u);
        out[i * 3 + 1] = (R + r * Math.cos(v)) * Math.sin(u);
        out[i * 3 + 2] = r * Math.sin(v);
      }
      return out;
    }
    case "wave": {
      // flat wavy plane
      for (let i = 0; i < count; i++) {
        const x = (Math.random() * 2 - 1) * 1.4;
        const z = (Math.random() * 2 - 1) * 1.4;
        const y = Math.sin(x * 3) * 0.25 + Math.cos(z * 3) * 0.25;
        out[i * 3] = x;
        out[i * 3 + 1] = y;
        out[i * 3 + 2] = z;
      }
      return out;
    }
    case "heart": {
      for (let i = 0; i < count; i++) {
        const t = Math.random() * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y =
          13 * Math.cos(t) -
          5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) -
          Math.cos(4 * t);
        // jitter inward for volume
        const k = 0.04 + Math.random() * 0.06;
        out[i * 3] = (x / 17) * (1 - k) + (Math.random() - 0.5) * 0.08;
        out[i * 3 + 1] = (y / 17) * (1 - k) + (Math.random() - 0.5) * 0.08;
        out[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
      }
      return out;
    }
    case "cube": {
      for (let i = 0; i < count; i++) {
        // pick a face
        const face = Math.floor(Math.random() * 6);
        const a = Math.random() * 2 - 1;
        const b = Math.random() * 2 - 1;
        const s = 1;
        let x = 0,
          y = 0,
          z = 0;
        if (face === 0) [x, y, z] = [s, a, b];
        if (face === 1) [x, y, z] = [-s, a, b];
        if (face === 2) [x, y, z] = [a, s, b];
        if (face === 3) [x, y, z] = [a, -s, b];
        if (face === 4) [x, y, z] = [a, b, s];
        if (face === 5) [x, y, z] = [a, b, -s];
        out[i * 3] = x * 0.95;
        out[i * 3 + 1] = y * 0.95;
        out[i * 3 + 2] = z * 0.95;
      }
      return out;
    }
    case "galaxy": {
      const arms = 4;
      for (let i = 0; i < count; i++) {
        const arm = i % arms;
        const t = Math.random();
        const radius = t * 1.3;
        const angle = arm * ((Math.PI * 2) / arms) + t * 6 + (Math.random() - 0.5) * 0.4;
        out[i * 3] = Math.cos(angle) * radius;
        out[i * 3 + 1] = (Math.random() - 0.5) * 0.15 * (1 - t);
        out[i * 3 + 2] = Math.sin(angle) * radius;
      }
      return out;
    }
    case "question": {
      // 2D question-mark curve thickened
      // hook: arc; stem: vertical line; dot: small cluster
      for (let i = 0; i < count; i++) {
        const r = Math.random();
        let x = 0,
          y = 0;
        if (r < 0.55) {
          // top arc (open hook)
          const a = Math.PI * 1.2 - Math.random() * Math.PI * 1.5;
          const rad = 0.55 + (Math.random() - 0.5) * 0.08;
          x = Math.cos(a) * rad;
          y = Math.sin(a) * rad + 0.45;
        } else if (r < 0.85) {
          // stem curving down
          const t = Math.random();
          x = 0.55 - t * 0.55 + (Math.random() - 0.5) * 0.06;
          y = 0.45 - Math.pow(t, 1.2) * 0.55 - t * 0.15;
        } else {
          // dot
          const a = Math.random() * Math.PI * 2;
          const rr = Math.random() * 0.12;
          x = Math.cos(a) * rr;
          y = -0.85 + Math.sin(a) * rr;
        }
        out[i * 3] = x;
        out[i * 3 + 1] = y;
        out[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
      }
      return out;
    }
  }
}

// Infer a shape from a piece of text (multilingual: PT/EN keywords).
export function inferShape(text: string): ParticleShape {
  const t = (text || "").toLowerCase();
  if (/[?¿]|\bpor que\b|\bporque\b|\bporquê\b|\bcomo\b|\bquando\b|\bonde\b|\bo que\b|\bquem\b|\bwhy\b|\bhow\b|\bwhat\b|\bwhen\b|\bwhere\b|\bwho\b/.test(t))
    return "question";
  if (/\b(amor|amo|coração|paix(ã|a)o|love|heart|❤|♥)\b/.test(t)) return "heart";
  if (/\b(música|musica|cantar|som|onda|wave|music|song|sound|relax|calm|calma)\b/.test(t))
    return "wave";
  if (/\b(galá|galaxia|galaxy|estrela|star|universo|universe|cosmos|space|espaço)\b/.test(t))
    return "galaxy";
  if (/\b(anel|ring|donut|rosquinha|torus|órbita|orbit)\b/.test(t)) return "torus";
  if (/\b(cubo|cube|caixa|box|bloco|block|estrutura|structure|código|code)\b/.test(t))
    return "cube";
  return "sphere";
}