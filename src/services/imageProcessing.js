import heic2any from "heic2any";
import { supabase } from '../supabaseClient';

/**
 * HEIC/HEIF-Konvertierung (nur wenn nötig)
 */
export async function convertHeicIfNeeded(file) {
  const extension = file.name.split('.').pop().toLowerCase();

  if (extension === "heic" || extension === "heif") {
    try {
      const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9
      });
      return new File([convertedBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
        type: "image/jpeg"
      });
    } catch (err) {
      console.error("❌ HEIC-Konvertierung fehlgeschlagen:", err);
      throw new Error("HEIC konnte nicht konvertiert werden.");
    }
  }

  return file;
}

/**
 * Fallback: dataURL → Blob
 */
function dataURLToBlob(dataURL) {
  const byteString = atob(dataURL.split(",")[1]);
  const mimeString = dataURL.split(",")[0].split(":")[1].split(";")[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

/**
 * Optimiert ein Bild via canvas: Größe verkleinern, in JPEG umwandeln
 */
export async function optimizeImage(file, maxSize = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        } else if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        if (canvas.toBlob) {
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(
                new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                  type: "image/jpeg"
                })
              );
            } else {
              const fallbackBlob = dataURLToBlob(canvas.toDataURL("image/jpeg", quality));
              resolve(
                new File([fallbackBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                  type: "image/jpeg"
                })
              );
            }
          }, "image/jpeg", quality);
        } else {
          const fallbackBlob = dataURLToBlob(canvas.toDataURL("image/jpeg", quality));
          resolve(
            new File([fallbackBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
              type: "image/jpeg"
            })
          );
        }
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Entfernt Sonderzeichen aus Dateinamen
 */
export function sanitizeFilename(name) {
  return name.normalize("NFD").replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Kombiniert Bildverarbeitung und Upload zu Supabase
 */
export async function processAndUploadImage(file, anglerName) {
  let processedFile = await convertHeicIfNeeded(file);
  processedFile = await optimizeImage(processedFile);

  const safeName = sanitizeFilename(anglerName);
  const fileName = `${Date.now()}_${safeName}.jpg`;

  const { error: uploadError } = await supabase
    .storage
    .from('fischfotos')
    .upload(fileName, processedFile);

  if (uploadError) {
    throw new Error('Fehler beim Hochladen des Fotos.');
  }

  const { data: publicUrl } = supabase
    .storage
    .from('fischfotos')
    .getPublicUrl(fileName);

  return publicUrl?.publicUrl || '';
}
