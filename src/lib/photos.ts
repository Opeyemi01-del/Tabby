// Runs in the BROWSER: shrinks a phone photo before upload.
// A 5 MB camera photo becomes ~300 KB (1600 px on the long side), which is
// faster on a weak network and keeps the AI request under its size limit.
// The phone's capture time (lastModified) is kept, to flag old photos.

export async function shrinkPhoto(file: File, maxSide = 1600): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file); // also applies the photo's rotation
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) return file;
    const name = `${file.name.replace(/\.\w*$/, "") || "photo"}.jpg`;
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file; // the browser couldn't read it; the server will check the type
  }
}
