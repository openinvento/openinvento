const MAX_IMAGE_DIMENSION = 1600
const JPEG_QUALITY = 0.82

export async function compressArticleImage(file: File) {
  if (!file.type.startsWith("image/") || !["image/jpeg", "image/png"].includes(file.type)) {
    throw new Error("Please choose a JPG or PNG image.")
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY))
  if (!blob) {
    throw new Error("Could not process the selected image.")
  }

  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" })
}