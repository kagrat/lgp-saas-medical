import { useState } from 'react'
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
    setCart([])
    setProductQuery('')
    setError('')
    setStep(2)
    await browseStock(pharmacy.id, '')
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

      {step < 3 && (
        <StepIndicator current={step} total={2} label={step === 1 ? 'Choisis une pharmacie' : 'Ajoute des medicaments a ton panier'} />
      )}

      {confirmation ? (
        <div className="rounded-2xl border border-forest-300 bg-forest-50 p-6">
          <p className="font-display text-xl text-forest-900 font-semibold mb-1">Commande envoyée</p>
          <p className="text-forest-700 mb-4">
            La pharmacie va vérifier la disponibilité et te transmettra une proposition a confirmer.
            Retrouve le suivi dans "Mon espace" - Mes commandes pharmacie.
          </p>
          <button onClick={startOver} className="rounded-full bg-forest-700 text-white px-6 py-2.5 font-medium hover:bg-forest-900 transition">
            Passer une autre commande
          </button>
        </div>
      ) : step === 1 ? (
        <>
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
                className="w-full sm:w-auto rounded-full bg-forest-700 text-white px-8 py-3 font-medium hover:bg-forest-900 transition disabled:opacity-50">
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

          <form onSubmit={searchProducts} className="flex gap-3 mb-6">
            <input
              value={productQuery} onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Nom du médicament ou référence..."
              className="flex-1 rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500"
            />
            <button type="submit" disabled={loading} className="rounded-full bg-forest-700 text-white px-6 py-2.5 font-medium hover:bg-forest-900 transition disabled:opacity-50">
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
                  className="w-full sm:w-auto rounded-full bg-forest-700 text-white px-8 py-3 font-medium hover:bg-forest-900 transition disabled:opacity-50"
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
      ) : null}

      {error && <p className="text-clay-600 mt-6">{error}</p>}
    </div>
  )
}
