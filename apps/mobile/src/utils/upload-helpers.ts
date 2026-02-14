import { Image } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import type { UploadAssetInput } from "../types";
import { IMAGE_UPLOAD_MAX_DIMENSION, IMAGE_UPLOAD_QUALITY } from "../constants";

export function isImageFileUpload(file: UploadAssetInput): boolean {
  if (typeof file.mimeType === "string" && file.mimeType.toLowerCase().startsWith("image/")) {
    return true;
  }
  return /\.(png|jpe?g|webp|heic|heif)$/i.test(file.name);
}

export function replaceFileExtension(fileName: string, nextExtWithDot: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0) return `${fileName}${nextExtWithDot}`;
  return `${fileName.slice(0, idx)}${nextExtWithDot}`;
}

export async function getImageDimensions(uri: string): Promise<{ width: number; height: number } | null> {
  return await new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null)
    );
  });
}

export async function compressUploadImage(file: UploadAssetInput): Promise<UploadAssetInput> {
  if (!isImageFileUpload(file)) return file;

  const dims = await getImageDimensions(file.uri);
  const actions: ImageManipulator.Action[] = [];
  if (dims) {
    const maxSide = Math.max(dims.width, dims.height);
    if (maxSide > IMAGE_UPLOAD_MAX_DIMENSION) {
      if (dims.width >= dims.height) {
        actions.push({ resize: { width: IMAGE_UPLOAD_MAX_DIMENSION } });
      } else {
        actions.push({ resize: { height: IMAGE_UPLOAD_MAX_DIMENSION } });
      }
    }
  }

  const result = await ImageManipulator.manipulateAsync(file.uri, actions, {
    compress: IMAGE_UPLOAD_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG
  });

  return {
    uri: result.uri,
    name: replaceFileExtension(file.name, ".jpg"),
    mimeType: "image/jpeg",
    size: ((result as { fileSize?: number }).fileSize ?? file.size ?? null) as number | null
  };
}
