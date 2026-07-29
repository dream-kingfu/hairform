export interface PhotoIssue {
  code: string;
  message: string;
  blocking: boolean;
}

export interface PhotoInspection {
  width: number;
  height: number;
  luminance: number;
  issues: PhotoIssue[];
  mask?: Blob;
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

function canvasToBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("canvas_export_failed")), type));
}

export async function preparePhotoUpload(file: File, maxLongEdge = 1280, quality = 0.85) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("photo_decode_failed"));
      element.src = url;
    });
    const scale = Math.min(1, maxLongEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas_unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("canvas_export_failed")), "image/jpeg", quality));
    return new File([blob], "hairform-portrait.jpg", { type: "image/jpeg", lastModified: Date.now() });
  } finally { URL.revokeObjectURL(url); }
}

function buildHairMask(image: HTMLImageElement, face: DetectedFace) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const box = face.boundingBox;
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

export async function inspectPhoto(file: File): Promise<PhotoInspection> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("photo_decode_failed"));
      element.src = url;
    });
    const issues: PhotoIssue[] = [];
    if (Math.min(image.naturalWidth, image.naturalHeight) < 720) {
      issues.push({ code: "too_small", message: "图片分辨率偏低，请使用至少 720px 的清晰照片。", blocking: true });
    }

    const sample = document.createElement("canvas");
    sample.width = 96;
    sample.height = 96;
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    let luminance = 128;
    if (sampleContext) {
      sampleContext.drawImage(image, 0, 0, 96, 96);
      const pixels = sampleContext.getImageData(0, 0, 96, 96).data;
      let total = 0;
      for (let index = 0; index < pixels.length; index += 4) total += 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
      luminance = total / (pixels.length / 4);
      if (luminance < 48) issues.push({ code: "too_dark", message: "照片偏暗，请在光线均匀的位置重新拍摄。", blocking: true });
    }

    let mask: Blob | undefined;
    const Detector = (window as unknown as { FaceDetector?: FaceDetectorConstructor }).FaceDetector;
    if (Detector) {
      const faces = await new Detector({ fastMode: true, maxDetectedFaces: 3 }).detect(image);
      if (faces.length === 0) issues.push({ code: "no_face", message: "没有检测到清晰人脸，请换一张正面照片。", blocking: true });
      else if (faces.length > 1) issues.push({ code: "multiple_faces", message: "照片中有多张人脸，请只保留本人。", blocking: true });
      else {
        const face = faces[0];
        if (face.boundingBox.width / image.naturalWidth < 0.25) {
          issues.push({ code: "face_too_small", message: "人脸在画面中偏小，请靠近镜头重新拍摄。", blocking: true });
        }
        mask = await buildHairMask(image, face);
      }
    } else {
      issues.push({ code: "detector_unavailable", message: "当前浏览器将由服务端继续检查正面角度与人脸数量。", blocking: false });
    }

    return { width: image.naturalWidth, height: image.naturalHeight, luminance, issues, mask };
  } finally {
    URL.revokeObjectURL(url);
  }
}
