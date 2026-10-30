import { openDB } from "idb";
import type { SavedArea } from "./types";
const database = () => openDB("signal-offline-v1", 1, {
  upgrade(db) { if (!db.objectStoreNames.contains("areas")) db.createObjectStore("areas", { keyPath: "id" }); }
});
export async function listAreas(): Promise<SavedArea[]> {
  return (await (await database()).getAll("areas") as SavedArea[]).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
export async function saveArea(area: SavedArea): Promise<void> {
  await (await database()).put("areas", area);
}
export async function removeArea(id: string): Promise<void> {
  await (await database()).delete("areas", id);
}
