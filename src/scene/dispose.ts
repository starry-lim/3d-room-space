import * as THREE from "three";

const TEXTURE_SLOTS = [
  "map",
  "emissiveMap",
  "alphaMap",
  "roughnessMap",
  "metalnessMap",
  "normalMap",
  "bumpMap",
  "aoMap",
] as const;

/**
 * Safely dispose all Three.js geometries, instanced meshes, materials, and textures
 * under `root` plus any externally tracked textures/materials.
 *
 * Skips geometry disposal on `THREE.Sprite` so Three.js's internal shared sprite
 * quad geometry stays intact across StrictMode remounts.
 */
export function disposeObjectTree(
  root: THREE.Object3D,
  extraTextures?: Iterable<THREE.Texture | null | undefined>,
  extraMaterials?: Iterable<THREE.Material | null | undefined>,
): void {
  const seenGeo = new Set<THREE.BufferGeometry>();
  const seenMat = new Set<THREE.Material>();
  const seenTex = new Set<THREE.Texture>();

  const disposeTex = (tex: unknown) => {
    if (tex && typeof (tex as THREE.Texture).dispose === "function" && (tex as THREE.Texture).isTexture) {
      const t = tex as THREE.Texture;
      if (!seenTex.has(t)) {
        seenTex.add(t);
        t.dispose();
      }
    }
  };

  const disposeMat = (m: THREE.Material) => {
    if (seenMat.has(m)) return;
    seenMat.add(m);
    const rec = m as unknown as Record<string, unknown>;
    for (const slot of TEXTURE_SLOTS) {
      disposeTex(rec[slot]);
    }
    if (m instanceof THREE.ShaderMaterial && m.uniforms) {
      for (const u of Object.values(m.uniforms)) {
        if (u && typeof u === "object" && "value" in u) {
          disposeTex((u as { value: unknown }).value);
        }
      }
    }
    m.dispose();
  };

  root.traverse((o) => {
    if (o instanceof THREE.InstancedMesh) {
      o.dispose();
    }
    if ((o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line) && o.geometry) {
      if (!seenGeo.has(o.geometry)) {
        seenGeo.add(o.geometry);
        o.geometry.dispose();
      }
    }
    const rawMat = (o as THREE.Mesh).material;
    if (rawMat) {
      const mats = Array.isArray(rawMat) ? rawMat : [rawMat];
      for (const m of mats) {
        if (m) disposeMat(m);
      }
    }
  });

  if (extraMaterials) {
    for (const m of extraMaterials) {
      if (m) disposeMat(m);
    }
  }
  if (extraTextures) {
    for (const t of extraTextures) {
      disposeTex(t);
    }
  }
}
