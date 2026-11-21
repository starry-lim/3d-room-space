import * as THREE from "three";
import { DEFAULT_AVATAR } from "../game/data";
import { buildAvatar } from "./avatars";
import { buildCat, buildCatToys } from "./room/catAndToys";
import { buildExerciseCorner } from "./room/exerciseCorner";
import { buildBed, buildConsoleTable, buildFloorLounge, buildPlant } from "./room/restArea";
import { buildShell, buildWindowAndCurtains } from "./room/shell";
import { buildBookshelf, buildChair, buildDesk } from "./room/studyArea";
import type { RoomRefs } from "./room/types";
import { buildTodoBoard, buildWallDecor } from "./room/wallDecor";

export type { AvatarRig } from "./avatars";
export { ROOM, WINDOW, WALL_H } from "./layout";
export type { CatRig, InteractId, RoomRefs } from "./room/types";

export function buildRoom(): { room: THREE.Group; refs: RoomRefs } {
  const room = new THREE.Group();
  const refs = { items: {}, curtains: [], glowStarPoints: [], toys: {} } as unknown as RoomRefs;

  buildShell(room);
  buildWindowAndCurtains(room, refs);
  buildDesk(room, refs);
  buildChair(room, refs);
  buildBed(room, refs);
  buildBookshelf(room, refs);
  buildConsoleTable(room, refs);
  buildWallDecor(room, refs);
  buildTodoBoard(room, refs);
  buildCat(room, refs);

  const av = buildAvatar(DEFAULT_AVATAR);
  room.add(av.root);
  refs.avatar = av;

  buildPlant(room, refs);
  buildFloorLounge(room, refs);
  buildExerciseCorner(room, refs);
  buildCatToys(room, refs);

  return { room, refs };
}
