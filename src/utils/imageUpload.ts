const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

export async function processSignatureOrStampFile(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Format non supporté. Utilisez un fichier PNG, JPG, WebP ou SVG.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Le fichier image dépasse la limite de 5 Mo.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error("Impossible de lire le fichier image."));
    reader.readAsDataURL(file);
  });

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return rawDataUrl;
  }

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxWidth = 420;
        const maxHeight = 220;
        let width = img.naturalWidth || 300;
        let height = img.naturalHeight || 150;
        const scale = Math.min(1, maxWidth / width, maxHeight / height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let result = canvas.toDataURL('image/png');
        if (result.length > 200_000) {
          // Re-scale further if PNG base64 exceeds 200 KB
          const smallScale = 0.65;
          canvas.width = Math.max(1, Math.round(width * smallScale));
          canvas.height = Math.max(1, Math.round(height * smallScale));
          const ctx2 = canvas.getContext('2d');
          if (ctx2) {
            ctx2.clearRect(0, 0, canvas.width, canvas.height);
            ctx2.drawImage(img, 0, 0, canvas.width, canvas.height);
            result = canvas.toDataURL('image/png');
          }
        }
        if (result.length > 220_000) {
          result = canvas.toDataURL('image/webp', 0.85);
        }
        if (result.length > 240_000) {
          reject(new Error('Image trop lourde même après compression. Choisissez un visuel plus simple.'));
          return;
        }
        resolve(result);
      } catch {
        reject(new Error("Erreur lors du traitement de l'image."));
      }
    };
    img.onerror = () => reject(new Error("Le fichier sélectionné n'est pas une image valide."));
    img.src = rawDataUrl;
  });
}
