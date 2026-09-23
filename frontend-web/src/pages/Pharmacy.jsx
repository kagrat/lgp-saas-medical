import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import api, { getRole, getErrorMessage } from '../api/client'
import StepIndicator from '../components/StepIndicator'

/**
 * RESTRUCTURE (pharmacie-first + panier multi-articles, demande M.
 * Faustin): avant, le patient cherchait directement un medicament (toutes
 * pharmacies confondues) et ne pouvait commander qu'un seul article a la
 * fois. Desormais: 1) le patient choisit d'abord une PHARMACIE (triee par
 * proximite), 2) il parcourt/recherche les medicaments DE CETTE PHARMACIE
 * et en ajoute plusieurs a un panier, 3) il valide le panier entier en une
 * seule commande.
 */
export default function Pharmacy() {
  const location = useLocation()
  const incomingPrescription = location.state || {}

  const [step, setStep] = useState(1) // 1: choix pharmacie, 2: produits + panier, 3: confirmation
  const [city, setCity] = useState('')
  const [pharmacyName, setPharmacyName] = useState('')
  const [pharmacies, setPharmacies] = useState([])
  const [selectedPharmacy, setSelectedPharmacy] = useState(null)
  const [productQuery, setProductQuery] = useState('')
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([]) // [{ medication_id, medication_name, reference, unit_price, quantity, available }]
  const [deliveryMode, setDeliveryMode] = useState('pickup')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const role = getRole()

  // NOUVEAU (demande explicite de M. Faustin: "un patient qui n'a pas
  // pris la plateforme mais veut payer les medicaments avec ordonnance
  // - juste upload image de l'ordonnance").
  const [guestMode, setGuestMode] = useState(false)
  const [guestForm, setGuestForm] = useState({ full_name: '', phone: '', prescription_image: '' })
  const [guestSubmitting, setGuestSubmitting] = useState(false)
  const [guestConfirmation, setGuestConfirmation] = useState(null)

  // NOUVEAU (lien ordonnance -> pharmacie): si le patient arrive depuis le
  // bouton "Commander en pharmacie" de son dossier de sante.
  const [prescriptionDocumentId] = useState(incomingPrescription.prescriptionDocumentId || null)
  const [prescriptionMatches, setPrescriptionMatches] = useState(null)
  const [loadingMatches, setLoadingMatches] = useState(false)

  async function searchPharmacies(e) {
    if (e) e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.get('/pharmacy/pharmacies/search', {
        params: { city: city || undefined, name: pharmacyName || undefined },
      })
      setPharmacies(data)
    } catch (err) {
      setError(getErrorMessage(err, 'La recherche a echoue.'))
    } finally {
      setLoading(false)
    }
  }

  async function choosePharmacy(pharmacy) {
    setSelectedPharmacy(pharmacy)
    setError('')
    if (guestMode) {
      setStep('guest-form')
      return
    }
    setCart([])
    setProductQuery('')
    setStep(2)
    await browseStock(pharmacy.id, '')
    if (prescriptionDocumentId) {
      await loadPrescriptionMatches(pharmacy.id)
    }
  }

  function handleGuestImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setGuestForm((f) => ({ ...f, prescription_image: reader.result }))
    reader.readAsDataURL(file)
  }

  async function submitGuestOrder(e) {
    e.preventDefault()
    if (!guestForm.prescription_image) {
      setError("Ajoute une photo de l'ordonnance avant d'envoyer.")
      return
    }
    setGuestSubmitting(true)
    setError('')
    try {
      const { data } = await api.post('/pharmacy/reservations/guest', {
        establishment_id: selectedPharmacy.id,
        full_name: guestForm.full_name,
        phone: guestForm.phone,
        delivery_mode: deliveryMode,
        prescription_image: guestForm.prescription_image,
      })
      setGuestConfirmation(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'envoyer cette commande."))
    } finally {
      setGuestSubmitting(false)
    }
  }

  async function loadPrescriptionMatches(establishmentId) {
    setLoadingMatches(true)
    try {
      const { data } = await api.get('/pharmacy/match-prescription', {
        params: { document_id: prescriptionDocumentId, establishment_id: establishmentId },
      })
      setPrescriptionMatches(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de rapprocher l'ordonnance avec le stock de cette pharmacie."))
    } finally {
      setLoadingMatches(false)
    }
  }

  async function browseStock(establishmentId, name) {
    setLoading(true)
    try {
      const { data } = await api.get('/pharmacy/stock/public', {
        params: { establishment_id: establishmentId, name: name || undefined },
      })
      setProducts(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les medicaments de cette pharmacie.'))
    } finally {
      setLoading(false)
    }
  }

  function searchProducts(e) {
    if (e) e.preventDefault()
    browseStock(selectedPharmacy.id, productQuery)
  }

  function addToCart(item) {
    setCart((c) => {
      const existing = c.find((l) => l.medication_id === item.id)
      if (existing) {
        if (existing.quantity >= item.quantity) return c // deja au max du stock disponible
        return c.map((l) => (l.medication_id === item.id ? { ...l, quantity: l.quantity + 1 } : l))
      }
      return [...c, {
        medication_id: item.id, medication_name: item.medication_name, reference: item.reference,
        unit_price: item.unit_price, quantity: 1, available: item.quantity,
      }]
    })
  }

  function changeCartQuantity(medicationId, quantity) {
    setCart((c) => c.map((l) => (l.medication_id === medicationId ? { ...l, quantity } : l)).filter((l) => l.quantity > 0))
  }

  function removeFromCart(medicationId) {
    setCart((c) => c.filter((l) => l.medication_id !== medicationId))
  }

  const cartTotal = cart.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)

  async function submitOrder() {
    if (role !== 'patient') {
      setError('Connecte-toi avec un compte patient pour commander.')
      return
    }
    if (cart.length === 0) {
      setError('Ton panier est vide.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const { data } = await api.post('/pharmacy/reservations', {
        items: cart.map((l) => ({ medication_id: l.medication_id, quantity: l.quantity })),
        delivery_mode: deliveryMode,
        prescription_document_id: prescriptionDocumentId || undefined,
      })
      setConfirmation(data)
      setStep(3)
    } catch (err) {
      setError(getErrorMessage(err, 'La commande a echoue.'))
    } finally {
      setSubmitting(false)
    }
  }

  function backToPharmacies() {
    setSelectedPharmacy(null)
    setCart([])
    setPrescriptionMatches(null)
    setStep(1)
  }

  function startOver() {
    setConfirmation(null)
    setSelectedPharmacy(null)
    setCart([])
    setPharmacies([])
    setStep(1)
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-3">Pharmacie en ligne</p>
      <h1 className="font-display text-4xl font-semibold text-forest-900 mb-6">
        Choisis ta pharmacie, compose ton panier.
      </h1>

      {step !== 'guest-form' && step < 3 && (
        <StepIndicator current={step} total={2} label={step === 1 ? 'Choisis une pharmacie' : 'Ajoute des medicaments a ton panier'} />
      )}

      {confirmation ? (
        <div className="rounded-2xl border border-forest-300 bg-forest-50 p-6">
          <p className="font-display text-xl text-forest-900 font-semibold mb-1">Commande envoyée</p>
          <p className="text-forest-700 mb-4">
            La pharmacie va vérifier la disponibilité et te transmettra une proposition a confirmer.
            Retrouve le suivi dans "Mon espace" - Mes commandes pharmacie.
          </p>
          <button onClick={startOver} className="rounded-full bg-primary-700 text-white px-6 py-2.5 font-medium hover:bg-primary-900 transition">
            Passer une autre commande
          </button>
        </div>
      ) : step === 1 ? (
        <>
          {/* NOUVEAU (demande explicite de M. Faustin: commander avec
              une ordonnance sans avoir de compte sur la plateforme). */}
          <div className="mb-6">
            <button
              onClick={() => setGuestMode((v) => !v)}
              className={`text-sm rounded-full border px-4 py-2 font-medium transition ${guestMode ? 'bg-[var(--portal-accent)] text-white border-transparent' : 'border-forest-300 text-forest-700 hover:bg-forest-50'}`}
            >
              {guestMode ? '✓ Commande avec ordonnance, sans compte' : "Je n'ai pas de compte - commander avec une ordonnance"}
            </button>
          </div>

          <form onSubmit={searchPharmacies} className="grid sm:grid-cols-2 gap-4 bg-white rounded-2xl p-6 border border-forest-100 shadow-sm mb-6">
            <div>
              <label className="block text-sm font-medium text-forest-900 mb-1">Ta ville (pour trier par proximité)</label>
              <input value={city} onChange={(e) => setCity(e.target.value)}
                placeholder="Cotonou, Parakou, Porto-Novo..."
                className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-forest-900 mb-1">Nom de la pharmacie (optionnel)</label>
              <input value={pharmacyName} onChange={(e) => setPharmacyName(e.target.value)}
                placeholder="Pharmacie du Plateau..."
                className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={loading}
                className="w-full sm:w-auto rounded-full bg-primary-700 text-white px-8 py-3 font-medium hover:bg-primary-900 transition disabled:opacity-50">
                {loading ? 'Recherche...' : 'Rechercher des pharmacies'}
              </button>
            </div>
          </form>

          <div className="grid sm:grid-cols-2 gap-4">
            {pharmacies.map((pharmacy) => (
              <button
                key={pharmacy.id}
                onClick={() => choosePharmacy(pharmacy)}
                className="text-left rounded-xl border border-forest-100 bg-white p-5 flex flex-col gap-1 hover:border-forest-500 transition"
              >
                <p className="font-display text-lg text-forest-900 font-semibold">{pharmacy.name}</p>
                <p className="text-sm text-forest-700">{pharmacy.city}{pharmacy.address ? ` - ${pharmacy.address}` : ''}</p>
                {/* NOUVEAU (demande explicite de M. Faustin: "la ou la
                    pharmacie est ouverte, le patient le sait deja pendant
                    la recherche"). */}
                {pharmacy.is_open_now === true && (
                  <p className="text-sm text-primary-700 font-medium">● Ouvert{pharmacy.today_hours ? ` - ${pharmacy.today_hours}` : ''}</p>
                )}
                {pharmacy.is_open_now === false && (
                  <p className="text-sm text-clay-600 font-medium">● Fermé{pharmacy.today_hours ? ` - rouvre selon horaires (${pharmacy.today_hours})` : ''}</p>
                )}
                {pharmacy.distance_km !== null && pharmacy.distance_km !== undefined && (
                  <p className="text-sm text-amber-600 font-medium">{pharmacy.distance_km} km</p>
                )}
              </button>
            ))}
            {pharmacies.length === 0 && !loading && (
              <p className="text-forest-700 sm:col-span-2">Lance une recherche pour voir les pharmacies adhérentes.</p>
            )}
          </div>
        </>
      ) : step === 2 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-forest-900 font-medium">{selectedPharmacy.name}</p>
            <button onClick={backToPharmacies} className="text-sm text-forest-700 hover:text-forest-900 hover:underline">
              ← Changer de pharmacie
            </button>
          </div>

          {prescriptionDocumentId && (
            <div className="rounded-2xl border border-amber-300 bg-amber-500/5 p-5 mb-6">
              <p className="text-sm font-medium text-forest-900 mb-3">Ton ordonnance dans cette pharmacie</p>
              {loadingMatches && <p className="text-sm text-forest-700">Recherche des correspondances...</p>}
              {prescriptionMatches && prescriptionMatches.map((match) => (
                <div key={match.prescribed_name} className="mb-3 last:mb-0">
                  <p className="text-sm text-forest-900 font-medium">
                    {match.prescribed_name} (prescrit: {match.prescribed_quantity}{match.dosage_instructions ? ` - ${match.dosage_instructions}` : ''})
                  </p>
                  {match.matches.length === 0 ? (
                    <p className="text-xs text-clay-600 mt-1">Non disponible dans cette pharmacie.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {match.matches.map((stockItem) => {
                        const inCart = cart.find((l) => l.medication_id === stockItem.id)
                        return (
                          <button
                            key={stockItem.id}
                            onClick={() => addToCart(stockItem)}
                            disabled={inCart && inCart.quantity >= stockItem.quantity}
                            className="text-xs rounded-full border border-amber-400 bg-white px-3 py-1.5 hover:bg-amber-50 transition disabled:opacity-50"
                          >
                            {inCart ? `${stockItem.medication_name} - au panier (${inCart.quantity})` : `+ ${stockItem.medication_name} (${stockItem.unit_price.toLocaleString('fr-FR')} FCFA)`}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={searchProducts} className="flex gap-3 mb-6">
            <input
              value={productQuery} onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Nom du médicament ou référence..."
              className="flex-1 rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500"
            />
            <button type="submit" disabled={loading} className="rounded-full bg-primary-700 text-white px-6 py-2.5 font-medium hover:bg-primary-900 transition disabled:opacity-50">
              {loading ? '...' : 'Rechercher'}
            </button>
          </form>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {products.map((item) => {
              const inCart = cart.find((l) => l.medication_id === item.id)
              return (
                <div key={item.id} className="rounded-xl border border-forest-100 bg-white p-5">
                  <p className="font-display text-lg text-forest-900 font-semibold">{item.medication_name}</p>
                  <p className="text-xs text-forest-700">Ref. {item.reference}</p>
                  {item.category && <p className="text-sm text-forest-700">{item.category}</p>}
                  <p className="text-sm text-amber-600 font-medium mt-1">{item.unit_price.toLocaleString('fr-FR')} FCFA</p>
                  <p className={`text-xs mt-1 ${item.is_low_stock ? 'text-clay-600' : 'text-forest-500'}`}>
                    {item.is_low_stock ? 'Stock limite' : 'En stock'}
                  </p>
                  <button
                    onClick={() => addToCart(item)}
                    disabled={inCart && inCart.quantity >= item.quantity}
                    className="mt-3 w-full rounded-full bg-amber-500 text-forest-900 py-2 font-semibold hover:bg-amber-400 transition disabled:opacity-50"
                  >
                    {inCart ? `Dans le panier (${inCart.quantity})` : 'Ajouter au panier'}
                  </button>
                </div>
              )
            })}
            {products.length === 0 && !loading && (
              <p className="text-forest-700 sm:col-span-2">Aucun médicament trouvé dans cette pharmacie.</p>
            )}
          </div>

          <div className="rounded-2xl border border-forest-100 bg-white p-6">
            <p className="font-display text-lg text-forest-900 font-semibold mb-4">Ton panier</p>
            {cart.length === 0 ? (
              <p className="text-forest-700 mb-4">Ton panier est vide - ajoute des médicaments ci-dessus.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {cart.map((line) => (
                  <div key={line.medication_id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-forest-900 text-sm font-medium">{line.medication_name}</p>
                      <p className="text-xs text-forest-700">{line.unit_price.toLocaleString('fr-FR')} FCFA / unite</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" min="1" max={line.available} value={line.quantity}
                        onChange={(e) => changeCartQuantity(line.medication_id, Math.min(Number(e.target.value), line.available))}
                        className="w-16 rounded-lg border border-forest-100 px-2 py-1 text-sm text-center" />
                      <button onClick={() => removeFromCart(line.medication_id)} className="text-xs text-clay-600 hover:underline">
                        Retirer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <>
                <p className="text-forest-900 font-semibold mb-4">Total: {cartTotal.toLocaleString('fr-FR')} FCFA</p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-forest-900 mb-1">Mode de réception</label>
                  <select value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value)}
                    className="w-full sm:w-auto rounded-lg border border-forest-100 px-4 py-2.5 bg-white">
                    <option value="pickup">Retrait sur place</option>
                    <option value="delivery">Livraison</option>
                  </select>
                </div>
                <button
                  onClick={submitOrder}
                  disabled={submitting}
                  className="w-full sm:w-auto rounded-full bg-primary-700 text-white px-8 py-3 font-medium hover:bg-primary-900 transition disabled:opacity-50"
                >
                  {submitting ? 'Envoi...' : 'Envoyer la commande'}
                </button>
              </>
            )}

            {role !== 'patient' && cart.length > 0 && (
              <p className="text-sm text-forest-700 mt-4">
                Connecte-toi avec un compte patient pour commander.
              </p>
            )}
          </div>
        </div>
      ) : step === 'guest-form' ? (
        <div className="max-w-lg">
          {guestConfirmation ? (
            <div className="bg-white rounded-2xl border border-forest-100 p-6 text-center">
              <p className="font-display text-xl text-forest-900 font-semibold mb-2">Commande envoyée !</p>
              <p className="text-forest-700 text-sm mb-1">Numéro : {guestConfirmation.order_number}</p>
              <p className="text-forest-700 text-sm">
                La pharmacie va lire ton ordonnance et te contactera au {guestForm.phone} pour confirmer les médicaments et le prix.
              </p>
            </div>
          ) : (
            <form onSubmit={submitGuestOrder} className="bg-white rounded-2xl p-6 border border-forest-100 shadow-sm space-y-4">
              <p className="text-sm text-forest-700">
                Commande chez <span className="font-medium text-forest-900">{selectedPharmacy?.name}</span> avec une ordonnance - aucun compte requis.
              </p>
              <div>
                <label className="block text-sm font-medium text-forest-900 mb-1">Ton nom complet</label>
                <input required value={guestForm.full_name}
                  onChange={(e) => setGuestForm({ ...guestForm, full_name: e.target.value })}
                  className="w-full rounded-lg border border-forest-100 px-4 py-2.5" />
              </div>
              <div>
                <label className="block text-sm font-medium text-forest-900 mb-1">Ton numéro de téléphone</label>
                <input required value={guestForm.phone}
                  onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                  placeholder="+229..."
                  className="w-full rounded-lg border border-forest-100 px-4 py-2.5" />
              </div>
              <div>
                <label className="block text-sm font-medium text-forest-900 mb-1">Mode de réception</label>
                <select value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value)}
                  className="w-full rounded-lg border border-forest-100 px-4 py-2.5 bg-white">
                  <option value="pickup">Retrait sur place</option>
                  <option value="delivery">Livraison</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-forest-900 mb-1">Photo de l'ordonnance</label>
                <input required type="file" accept="image/png,image/jpeg" onChange={handleGuestImageChange}
                  className="w-full text-sm" />
                {guestForm.prescription_image && <p className="text-xs text-primary-700 mt-1">✓ Photo ajoutée</p>}
              </div>
              <button type="submit" disabled={guestSubmitting}
                className="w-full rounded-full bg-primary-700 text-white px-8 py-3 font-medium hover:bg-primary-900 transition disabled:opacity-50">
                {guestSubmitting ? 'Envoi...' : 'Envoyer ma commande'}
              </button>
            </form>
          )}
        </div>
      ) : null}

      {error && <p className="text-clay-600 mt-6">{error}</p>}
    </div>
  )
}
