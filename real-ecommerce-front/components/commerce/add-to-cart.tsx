'use client'

/**
 * Selector de variante + cantidad + "Agregar a la bolsa" de la página de producto.
 * Si el cliente no ingresó, abre el diálogo de ingreso y completa la acción apenas termina.
 */
import { useEffect, useState } from 'react'
import { Button, QuantityStepper } from '@real/ui'
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
              <Button
                key={v.id} type="button" role="radio" aria-checked={v.id === variantId}
                size="sm" variant={v.id === variantId ? 'default' : 'outline'}
                disabled={!v.available}
                onClick={() => { setVariantId(v.id); setAdded(false) }}
                className={v.available ? undefined : 'line-through'}
              >
                {v.title}{!v.available && ` ${dict.product.outOfStock}`}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <QuantityStepper value={quantity} onValueChange={setQuantity} min={1} max={MAX_QTY} label={c.quantity} />

        <Button type="button" onClick={onClick} disabled={!selected || bag.isAdding} className="flex-1">
          {bag.isAdding ? c.adding : !selected ? c.chooseVariant : c.addToCart}
          {selected && currency && !bag.isAdding ? ` · ${formatPrice(selected.priceCents * quantity, currency, intlTag)}` : ''}
        </Button>
      </div>

      {added && (
        <p role="status" className="text-sm text-success-ink">
          {c.added}{' '}
          <Button type="button" variant="link" onClick={() => setPanel(true)} className="h-auto p-0">{c.viewBag}</Button>
        </p>
      )}
      {failed && <p role="alert" className="text-sm text-destructive">{c.genericError}</p>}
    </div>
  )
}
