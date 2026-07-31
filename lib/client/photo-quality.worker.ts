import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

interface WorkerRequest { id: number; bitmap: ImageBitmap }

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};

const landmarker = (async () => {
  const files = await FilesetResolver.forVisionTasks(WASM_ROOT);
  return FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
    runningMode: "IMAGE",
    numFaces: 3,
    minFaceDetectionConfidence: 0.55,
    minFacePresenceConfidence: 0.55,
  });
})();

scope.onmessage = (event) => {
  const { id, bitmap } = event.data;
  void (async () => {
    try {
      const result = (await landmarker).detect(bitmap);
      scope.postMessage({ id, landmarks: result.faceLandmarks.map((face) => face.map(({ x, y, z }) => ({ x, y, z }))) });
    } catch (error) {
      scope.postMessage({ id, error: error instanceof Error ? error.message : "mediapipe_failed" });
    } finally { bitmap.close(); }
  })();
};
