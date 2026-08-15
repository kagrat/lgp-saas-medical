import jsPDF from 'jspdf'

/**
 * Genere un PDF simple cote client (aucun appel serveur) pour une
 * ordonnance, un resultat de labo, ou tout document texte du dossier
 * de sante. Mise en page volontairement sobre - lisible et imprimable.
 */
export function downloadDocumentAsPdf({ title, subtitle, meta, content, filename }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const marginX = 20
  let y = 25

  doc.setFontSize(10)
  doc.setTextColor(120, 120, 120)
  doc.text('LGP Sante', marginX, y)
  y += 12

  doc.setFontSize(16)
  doc.setTextColor(20, 40, 30)
  doc.text(title, marginX, y)
  y += 8

  if (subtitle) {
    doc.setFontSize(11)
    doc.setTextColor(90, 90, 90)
    doc.text(subtitle, marginX, y)
    y += 8
  }

  if (meta && meta.length > 0) {
    doc.setFontSize(9)
    doc.setTextColor(110, 110, 110)
    meta.forEach((line) => {
      doc.text(line, marginX, y)
      y += 5
    })
    y += 4
  }

  doc.setDrawColor(220, 220, 220)
  doc.line(marginX, y, 210 - marginX, y)
  y += 10

  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  const lines = doc.splitTextToSize(content || '', 210 - marginX * 2)
  doc.text(lines, marginX, y)

  doc.save(filename || 'document.pdf')
}
