'use client'

/**
 * Selector de variante + cantidad + "Agregar a la bolsa" de la página de producto.
 * Si el cliente no ingresó, abre el diálogo de ingreso y completa la acción apenas termina.
 */
import { useEffect, useState } from 'react'
import { useCommerce } from '@/components/commerce/commerce-provider'
import { useBag } from '@/components/commerce/use-bag'
import { formatPrice } from '@/lib/catalog/product-view'

interface VariantOption {
  id:         string
  title:      string
  priceCents: number
  available:  boolean
}

const MAX_QTY = 10

export function AddToCart({ variants, currency }: { variants: readonly VariantOption[]; currency: string | null }) {
  const { dict, intlTag, customer, openAuth, setPanel } = useCommerce()
  const bag = useBag()
  const c = dict.commerce

  const onlyOne = variants.length === 1 ? variants[0]! : null
  const [variantId, setVariantId] = useState<string | null>(onlyOne?.available ? onlyOne.id : null)
  const [quantity, setQuantity] = useState(1)
  const [pending, setPending] = useState(false)   // quiso agregar sin haber ingresado
  const [added, setAdded] = useState(false)
  const [failed, setFailed] = useState(false)

  const selected = variants.find((v) => v.id === variantId) ?? null
  const anyAvailable = variants.some((v) => v.available)

  async function add() {
    if (!selected) return
    setFailed(false)
    setAdded(false)
    try {
      await bag.addItem(selected.id, quantity)
      setAdded(true)
    } catch {
      setFailed(true)
    }
  }

  function onClick() {
    if (!selected) return
    if (!customer) { setPending(true); openAuth(); return }
    void add()
  }

  // Terminó de ingresar: completar lo que quería hacer.
  useEffect(() => {
    if (customer && pending) { setPending(false); void add() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, pending])

  if (variants.length === 0 || !anyAvailable) {
    return <p className="text-sm text-muted-foreground">{c.outOfStock}</p>
  }

  return (
    <div className="space-y-4">
      {variants.length > 1 && (
        <div>
          <p className="text-sm font-medium mb-2">{dict.product.variants}</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={dict.product.variants}>
            {variants.map((v) => (
              <button
                key={v.id} type="button" role="radio" aria-checked={v.id === variantId}
                disabled={!v.available}
                onClick={() => { setVariantId(v.id); setAdded(false) }}
                className={`px-3 py-1 border rounded-lg text-sm transition-colors ${
                  v.id === variantId ? 'border-foreground bg-accent'
                  : v.available ? 'border-border hover:bg-accent'
                  : 'border-muted text-muted-foreground line-through cursor-not-allowed'
                }`}
              >
                {v.title}{!v.available && ` ${dict.product.outOfStock}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-lg border border-border" aria-label={c.quantity}>
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}
                  className="h-9 w-9 text-lg hover:bg-accent disabled:opacity-40" aria-label="-">−</button>
          <span className="w-8 text-center text-sm" aria-live="polite">{quantity}</span>
          <button type="button" onClick={() => setQuantity((q) => Math.min(MAX_QTY, q + 1))} disabled={quantity >= MAX_QTY}
                  className="h-9 w-9 text-lg hover:bg-accent disabled:opacity-40" aria-label="+">+</button>
        </div>

        <button
          type="button" onClick={onClick}
          disabled={!selected || bag.isAdding}
          className="flex-1 rounded-full bg-blue-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {bag.isAdding ? c.adding : !selected ? c.chooseVariant : c.addToCart}
          {selected && currency && !bag.isAdding ? ` · ${formatPrice(selected.priceCents * quantity, currency, intlTag)}` : ''}
        </button>
      </div>

      {added && (
        <p role="status" className="text-sm text-green-600">
          {c.added}{' '}
          <button type="button" onClick={() => setPanel(true)} className="underline hover:no-underline">{c.viewBag}</button>
        </p>
      )}
      {failed && <p role="alert" className="text-sm text-destructive">{c.genericError}</p>}
    </div>
  )
}
