export interface PhotoIssue {
  code: string;
  message: string;
  blocking: boolean;
}

export type PhotoCheckStatus = "pass" | "warn" | "fail";

export interface PhotoCheck {
  id: "resolution" | "light" | "sharpness" | "face" | "pose" | "framing";
  label: string;
  detail: string;
  status: PhotoCheckStatus;
}

export interface PhotoInspection {
  width: number;
  height: number;
  luminance: number;
  sharpness: number;
  detector: "mediapipe" | "native" | "server";
  faceCount?: number;
  faceCoverage?: number;
  rollDegrees?: number;
  yawRatio?: number;
  checks: PhotoCheck[];
  issues: PhotoIssue[];
  mask?: Blob;
}

export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
}

interface DetectedFace {
  boundingBox: { x: number; y: number; width: number; height: number };
}

interface FaceDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedFace[]>;
}

interface FaceDetectorConstructor {
  new(options?: { fastMode?: boolean; maxDetectedFaces?: number }): FaceDetectorInstance;
}

interface FaceGeometry {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  coverage: number;
  centerX: number;
  rollDegrees: number;
  yawRatio: number;
}

interface WorkerResponse {
  id: number;
  landmarks?: NormalizedLandmark[][];
  error?: string;
}

let worker: Worker | undefined;
let requestId = 0;
const workerRequests = new Map<number, { resolve: (value: NormalizedLandmark[][]) => void; reject: (error: Error) => void; timeout: number }>();

function canvasToBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("canvas_export_failed")), type));
}

function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  return new Promise<{ image: HTMLImageElement; revoke: () => void }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, revoke: () => URL.revokeObjectURL(url) });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("photo_decode_failed")); };
    image.src = url;
  });
}

export async function preparePhotoUpload(file: File, maxLongEdge = 1280, quality = 0.85) {
  const { image, revoke } = await loadImage(file);
  try {
    const scale = Math.min(1, maxLongEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas_unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("canvas_export_failed")), "image/jpeg", quality));
    return new File([blob], "hairform-portrait.jpg", { type: "image/jpeg", lastModified: Date.now() });
  } finally { revoke(); }
}

export function estimateSharpness(grayscale: ArrayLike<number>, width: number, height: number) {
  if (width < 3 || height < 3 || grayscale.length < width * height) return 0;
  let count = 0;
  let sum = 0;
  let squareSum = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const laplacian = grayscale[index - width] + grayscale[index - 1] - 4 * grayscale[index] + grayscale[index + 1] + grayscale[index + width];
      sum += laplacian;
      squareSum += laplacian * laplacian;
      count += 1;
    }
  }
  const mean = sum / Math.max(1, count);
  return Math.max(0, squareSum / Math.max(1, count) - mean * mean);
}

export function assessFaceLandmarks(landmarks: NormalizedLandmark[]): FaceGeometry | undefined {
  if (landmarks.length < 455) return undefined;
  let minX = 1; let minY = 1; let maxX = 0; let maxY = 0;
  for (const point of landmarks) {
    minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
  }
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const nose = landmarks[1];
  if (!leftEye || !rightEye || !nose) return undefined;
  const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const width = maxX - minX;
  const height = maxY - minY;
  return {
    minX, minY, maxX, maxY, width, height,
    coverage: width * height,
    centerX: (minX + maxX) / 2,
    rollDegrees: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180 / Math.PI,
    yawRatio: eyeDistance ? Math.abs(nose.x - eyeMidX) / eyeDistance : 1,
  };
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./photo-quality.worker.ts", import.meta.url), { type: "module", name: "hairform-photo-check" });
  worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    const pending = workerRequests.get(event.data.id);
    if (!pending) return;
    window.clearTimeout(pending.timeout);
    workerRequests.delete(event.data.id);
    if (event.data.error) pending.reject(new Error(event.data.error));
    else pending.resolve(event.data.landmarks ?? []);
  });
  worker.addEventListener("error", () => {
    for (const [id, pending] of workerRequests) {
      window.clearTimeout(pending.timeout); pending.reject(new Error("mediapipe_worker_failed")); workerRequests.delete(id);
    }
    worker?.terminate(); worker = undefined;
  });
  return worker;
}

async function detectWithMediaPipe(file: File) {
  if (!("Worker" in window) || !("createImageBitmap" in window)) throw new Error("mediapipe_unsupported");
  const bitmap = await createImageBitmap(file);
  const id = ++requestId;
  return new Promise<NormalizedLandmark[][]>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      workerRequests.delete(id); reject(new Error("mediapipe_timeout"));
    }, 15_000);
    workerRequests.set(id, { resolve, reject, timeout });
    getWorker().postMessage({ id, bitmap }, [bitmap]);
  });
}

function buildHairMask(image: HTMLImageElement, box: { x: number; y: number; width: number; height: number }) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.fillStyle = "rgba(255,255,255,1)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "destination-out";
  context.beginPath();
  context.ellipse(box.x + box.width / 2, box.y + box.height * 0.43, box.width * 0.88, box.height * 1.04, 0, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = "source-over";
  context.fillStyle = "rgba(255,255,255,1)";
  context.beginPath();
  context.ellipse(box.x + box.width / 2, box.y + box.height * 0.56, box.width * 0.48, box.height * 0.49, 0, 0, Math.PI * 2);
  context.fill();
  return canvasToBlob(canvas, "image/png");
}

function addGeometryIssues(issues: PhotoIssue[], geometry: FaceGeometry) {
  if (geometry.width < 0.23 || geometry.height < 0.28) issues.push({ code: "face_too_small", message: "人脸在画面中偏小，请靠近镜头，让头发细节更清楚。", blocking: true });
  if (geometry.minX < 0.015 || geometry.maxX > 0.985 || geometry.minY < 0.015 || geometry.maxY > 0.995) issues.push({ code: "face_cropped", message: "脸部贴近画面边缘，请后退一点并保留完整头顶和耳侧。", blocking: true });
  else if (geometry.minY < 0.07) issues.push({ code: "limited_headroom", message: "头顶空间有点少，建议多保留一点头发上方区域。", blocking: false });
  if (Math.abs(geometry.rollDegrees) > 12) issues.push({ code: "head_tilted", message: "头部倾斜较明显，请尽量摆正后重新拍摄。", blocking: true });
  else if (Math.abs(geometry.rollDegrees) > 7) issues.push({ code: "head_tilted_slightly", message: "头部有轻微倾斜，摆正后分析会更稳定。", blocking: false });
  if (geometry.yawRatio > 0.2) issues.push({ code: "side_angle", message: "脸部转向侧面较多，请正对镜头重新拍摄。", blocking: true });
  if (geometry.centerX < 0.32 || geometry.centerX > 0.68) issues.push({ code: "off_center", message: "人物有些偏离画面中央，居中拍摄效果会更稳定。", blocking: false });
}

function statusFor(issues: PhotoIssue[], codes: string[]): PhotoCheckStatus {
  const matched = issues.filter((issue) => codes.includes(issue.code));
  return matched.some((issue) => issue.blocking) ? "fail" : matched.length ? "warn" : "pass";
}

export async function inspectPhoto(file: File): Promise<PhotoInspection> {
  const { image, revoke } = await loadImage(file);
  try {
    const issues: PhotoIssue[] = [];
    if (Math.min(image.naturalWidth, image.naturalHeight) < 720) issues.push({ code: "too_small", message: "图片分辨率偏低，请使用短边至少 720px 的清晰照片。", blocking: true });

    const sample = document.createElement("canvas");
    const sampleSize = 128;
    sample.width = sampleSize; sample.height = sampleSize;
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    let luminance = 128; let sharpness = 0;
    if (sampleContext) {
      sampleContext.drawImage(image, 0, 0, sampleSize, sampleSize);
      const pixels = sampleContext.getImageData(0, 0, sampleSize, sampleSize).data;
      const grayscale = new Float32Array(sampleSize * sampleSize);
      let total = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const value = 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
        grayscale[index / 4] = value; total += value;
      }
      luminance = total / grayscale.length;
      sharpness = estimateSharpness(grayscale, sampleSize, sampleSize);
      if (luminance < 48) issues.push({ code: "too_dark", message: "照片偏暗，请在光线均匀的位置重新拍摄。", blocking: true });
      else if (luminance > 222) issues.push({ code: "too_bright", message: "照片高光偏亮，发际线细节可能看不清，请避开强逆光。", blocking: true });
      if (sharpness < 35) issues.push({ code: "too_blurry", message: "照片有些模糊，请擦净镜头并保持手机稳定后重拍。", blocking: true });
      else if (sharpness < 60) issues.push({ code: "slightly_blurry", message: "清晰度一般，换一张更锐利的照片会更稳。", blocking: false });
    }

    let detector: PhotoInspection["detector"] = "server";
    let faceCount: number | undefined;
    let geometry: FaceGeometry | undefined;
    let mask: Blob | undefined;
    try {
      const faces = await detectWithMediaPipe(file);
      detector = "mediapipe"; faceCount = faces.length;
      if (faces.length === 0) issues.push({ code: "no_face", message: "没有检测到清晰人脸，请换一张正面照片。", blocking: true });
      else if (faces.length > 1) issues.push({ code: "multiple_faces", message: "照片中有多张人脸，请只保留本人。", blocking: true });
      else {
        geometry = assessFaceLandmarks(faces[0]);
        if (geometry) {
          addGeometryIssues(issues, geometry);
          mask = await buildHairMask(image, { x: geometry.minX * image.naturalWidth, y: geometry.minY * image.naturalHeight, width: geometry.width * image.naturalWidth, height: geometry.height * image.naturalHeight });
        }
      }
    } catch {
      const Detector = (window as unknown as { FaceDetector?: FaceDetectorConstructor }).FaceDetector;
      if (Detector) {
        detector = "native";
        const faces = await new Detector({ fastMode: true, maxDetectedFaces: 3 }).detect(image);
        faceCount = faces.length;
        if (faces.length === 0) issues.push({ code: "no_face", message: "没有检测到清晰人脸，请换一张正面照片。", blocking: true });
        else if (faces.length > 1) issues.push({ code: "multiple_faces", message: "照片中有多张人脸，请只保留本人。", blocking: true });
        else {
          const box = faces[0].boundingBox;
          const width = box.width / image.naturalWidth; const height = box.height / image.naturalHeight;
          if (width < 0.23 || height < 0.28) issues.push({ code: "face_too_small", message: "人脸在画面中偏小，请靠近镜头，让头发细节更清楚。", blocking: true });
          mask = await buildHairMask(image, box);
          geometry = { minX: box.x / image.naturalWidth, minY: box.y / image.naturalHeight, maxX: (box.x + box.width) / image.naturalWidth, maxY: (box.y + box.height) / image.naturalHeight, width, height, coverage: width * height, centerX: (box.x + box.width / 2) / image.naturalWidth, rollDegrees: 0, yawRatio: 0 };
        }
      } else {
        issues.push({ code: "detector_unavailable", message: "本地人脸模型暂未加载，服务端会在上传后继续核验正面角度与人脸数量。", blocking: false });
      }
    }

    const checks: PhotoCheck[] = [
      { id: "resolution", label: "分辨率", detail: `${image.naturalWidth} × ${image.naturalHeight}`, status: statusFor(issues, ["too_small"]) },
      { id: "light", label: "光线", detail: luminance < 48 ? "偏暗" : luminance > 222 ? "过亮" : "均匀可用", status: statusFor(issues, ["too_dark", "too_bright"]) },
      { id: "sharpness", label: "清晰度", detail: sharpness < 35 ? "建议重拍" : sharpness < 60 ? "一般" : "清晰", status: statusFor(issues, ["too_blurry", "slightly_blurry"]) },
      { id: "face", label: "人脸", detail: faceCount === undefined ? "上传后复核" : faceCount === 1 ? "单人" : `${faceCount} 张`, status: statusFor(issues, ["no_face", "multiple_faces", "detector_unavailable"]) },
      { id: "pose", label: "正面角度", detail: detector === "mediapipe" ? (geometry && Math.abs(geometry.rollDegrees) <= 7 && geometry.yawRatio <= 0.2 ? "角度合适" : "需要调整") : "上传后复核", status: detector === "mediapipe" ? statusFor(issues, ["head_tilted", "head_tilted_slightly", "side_angle"]) : "warn" },
      { id: "framing", label: "构图", detail: geometry ? `${Math.round(geometry.coverage * 100)}% 人脸占比` : "上传后复核", status: geometry ? statusFor(issues, ["face_too_small", "face_cropped", "limited_headroom", "off_center"]) : "warn" },
    ];

    return { width: image.naturalWidth, height: image.naturalHeight, luminance, sharpness, detector, faceCount, faceCoverage: geometry?.coverage, rollDegrees: geometry?.rollDegrees, yawRatio: geometry?.yawRatio, checks, issues, mask };
  } finally { revoke(); }
}
