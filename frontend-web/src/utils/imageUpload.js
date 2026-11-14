/**
 * Prepare une photo choisie par l'utilisateur avant envoi au serveur.
 * Une photo de telephone pese souvent 4 a 12 Mo: le serveur refuse au-dela de
 * 3 Mo. On la redimensionne (cote max 1600 px, ordonnance toujours lisible) et
 * on la recompresse en JPEG. Rejette les fichiers qui ne sont pas des images.
 */
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']

export function prepareImage(file, { maxSide = 1600, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !ALLOWED.includes(file.type)) {
      reject(new Error('Choisis une image au format PNG, JPEG ou WebP.'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff' // le JPEG n'a pas de transparence
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Cette image est illisible. Essaie une autre photo."))
    }
    img.src = url
  })
}
