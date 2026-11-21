# Cozy Study Workspace Rules

## 1. UI Language
- Existing Cozy Study UI copy is in English.
- When the user communicates in another language (e.g., Chinese) and asks for new UI features or copy without specifying the UI language, ask the user which language they want for the UI before mixing languages or localizing.

## 2. Three.js & WebGL Performance
- **Reuse existing `PointLight`s across regions**: Do not add extra dynamic `PointLight`s to `scene` for secondary areas. Three.js compiles `MeshStandardMaterial` shaders to loop over all scene `PointLight`s even when `intensity = 0`. Reuse existing lights (such as `fairy` and `candle`) when switching regions, paired with emissive materials or additive halos.
- **Avoid `backdrop-blur-*` over the 3D canvas**: Never apply CSS `backdrop-filter: blur(...)` (`backdrop-blur-*`) over a live 60fps WebGL `<canvas>`, as it triggers expensive GPU compositor readbacks on Windows.
- **Lightweight 2D standees & transparent meshes**: Never set `castShadow = true` on `alphaTest` transparent 2D standee planes. Prefer `MeshLambertMaterial` and compact `128x128` textures.

## 3. HUD Layout & Camera Focus
- **Non-disruptive HUD overlays**: Pinned or collapsible HUD widgets (such as `<PinnedTodo>`) must be `absolute`-positioned so they never inflate flex headers or crush `min-h-0 flex-1` panels.
- **Guard `focusView` camera poses**: In `PlayerController.update()`, skip `applyCameraPose()` while a `focusView` (`stargazing`, `gacha`, `memory`) is active so the camera does not snap back to `playerPos` after `camTween` finishes. Explicitly lock or clamp camera drag per focus mode.
- **World-anchored minigames**: Anchor spatial minigames (sky constellations, tabletop card games) directly to the 3D world rather than opaque, screen-stuck modals where practical.

## 4. 3D Props & Companion Ergonomics
- **Position-based companion follow**: Companion followers (`Follow Me`) must track player position via a distance threshold rather than camera `yaw` (so turning to look at them does not spin them away), and sync height with `crouchK` so they stay visible while crouching.
- **Coordinate collision checks**: Always verify 3D prop coordinates against existing furniture and accessories (such as the desk Star Jar or scratching post pom-pom) before placing new props or animations to prevent clipping or occlusion.
- **Clean chibi/figure proportions**: Keep figure and mascot designs clean and geometric (~1:1.2 torso-to-head ratio, simple glossy eyes, no realistic noses or lips) to avoid uncanny valley artifacts.
