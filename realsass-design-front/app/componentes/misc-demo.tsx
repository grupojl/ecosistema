'use client'

import { Plus, Search } from 'lucide-react'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger, Avatar, AvatarFallback, Badge, Button, Card, CardContent,
  CardDescription, CardFooter, CardHeader, CardTitle, EmptyState, Progress, SectionHeader, Skeleton, Tabs, TabsContent, TabsList,
  TabsTrigger, Textarea, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Input, Field, RadioGroup, RadioGroupItem, Label,
} from '@/components/ui'

const FAQ = [
  ['¿Cuánto tarda el envío?', 'Entre 24 y 48 horas en capitales; hasta 5 días en el resto del país. Verás el plazo exacto antes de pagar.'],
  ['¿Puedo devolver un producto?', 'Sí, durante 30 días desde la entrega, con el producto sin usar y su empaque original.'],
  ['¿Qué medios de pago aceptan?', 'Tarjetas de crédito y débito, transferencia bancaria y billeteras digitales.'],
] as const

export function MiscDemo() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeader title="Campos de texto" description="Siempre una label visible: el placeholder no es etiqueta. Ayuda debajo; error debajo con icono y texto." />
        <div className="grid gap-4 medium:grid-cols-2">
          <Field id="m-mail" label="Correo electrónico" hint="Te enviaremos el recibo.">{(a) => <Input id="m-mail" type="email" placeholder="nombre@dominio.com" {...a} />}</Field>
          <Field id="m-search" label="Buscar">{() => <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="m-search" type="search" className="pl-9" placeholder="Pedidos, productos…" /></div>}</Field>
          <Field id="m-sku" label="SKU" error="Este SKU ya existe. Prueba con SKU-0043.">{(a) => <Input id="m-sku" defaultValue="SKU-0042" {...a} />}</Field>
          <Field id="m-off" label="Deshabilitado">{() => <Input id="m-off" disabled value="No editable" readOnly />}</Field>
          <Field id="m-desc" label="Descripción" className="medium:col-span-2">{() => <Textarea id="m-desc" rows={3} />}</Field>
          <RadioGroup defaultValue="envio" aria-label="Entrega" className="flex gap-4">
            <div className="flex min-h-11 items-center gap-2"><RadioGroupItem value="envio" id="r-envio" /><Label htmlFor="r-envio">Envío</Label></div>
            <div className="flex min-h-11 items-center gap-2"><RadioGroupItem value="retiro" id="r-retiro" /><Label htmlFor="r-retiro">Retiro</Label></div>
          </RadioGroup>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Card" description="Agrupa información relacionada. Si toda la card es clicable, que haya un único enlace/botón principal dentro." />
        <div className="grid gap-4 medium:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardDescription>Ventas del mes</CardDescription><CardTitle className="font-display text-3xl tabular-nums">$ 48.920</CardTitle></CardHeader><CardContent><Badge variant="success">+12,4 % vs. mes anterior</Badge></CardContent></Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle>Plan Pro</CardTitle><CardDescription>Para tiendas en crecimiento</CardDescription></CardHeader>
            <CardContent><p className="font-display text-2xl font-bold">$29 <span className="text-sm font-normal text-muted-foreground">/mes</span></p></CardContent>
            <CardFooter><Button className="w-full">Elegir plan</Button></CardFooter>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-base">Camiseta Essential <Badge variant="warning" dot>Poco stock</Badge></CardTitle><CardDescription className="font-mono">SKU-00421</CardDescription></CardHeader>
            <CardFooter className="justify-between"><span className="font-semibold tabular-nums">$ 24,90</span><Button size="sm"><Plus /> Agregar</Button></CardFooter>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Tabs" description="Alternan vistas del mismo contenido. Si es navegación entre páginas, usa enlaces. Flechas ← → y Inicio/Fin para moverte." />
        <Tabs defaultValue="resumen">
          <TabsList><TabsTrigger value="resumen">Resumen</TabsTrigger><TabsTrigger value="envios">Envíos</TabsTrigger><TabsTrigger value="resenas">Reseñas</TabsTrigger></TabsList>
          <TabsContent value="resumen" className="text-sm text-muted-foreground">Resumen del producto: descripción, variantes y precios.</TabsContent>
          <TabsContent value="envios" className="text-sm text-muted-foreground">Plazos y costos por zona de entrega.</TabsContent>
          <TabsContent value="resenas" className="text-sm text-muted-foreground">Opiniones verificadas de clientes.</TabsContent>
        </Tabs>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Accordion" description="Contenido largo y opcional (FAQ). No ocultes información que la persona necesita para decidir." />
        <Accordion type="single" collapsible>
          {FAQ.map(([q, a]) => <AccordionItem key={q} value={q}><AccordionTrigger>{q}</AccordionTrigger><AccordionContent>{a}</AccordionContent></AccordionItem>)}
        </Accordion>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Avatar · Progress · Skeleton · Tooltip" description="Skeleton mientras carga contenido con forma conocida · Progress cuando se conoce el avance · Tooltip solo para aclarar un icono, nunca información esencial." />
        <div className="flex flex-wrap items-center gap-4">
          <Avatar><AvatarFallback>AL</AvatarFallback></Avatar><Avatar><AvatarFallback>MR</AvatarFallback></Avatar>
          <div className="w-48 space-y-1"><p className="flex justify-between text-xs"><span>Almacenamiento</span><span>68 %</span></p><Progress value={68} aria-label="Almacenamiento" /></div>
          <div className="flex items-center gap-2"><Skeleton className="size-10 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-20" /></div></div>
          <TooltipProvider>
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" aria-label="Agregar producto"><Plus /></Button></TooltipTrigger><TooltipContent>Agregar producto</TooltipContent></Tooltip>
          </TooltipProvider>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Empty state" description="Explica por qué no hay nada y ofrece la siguiente acción. Distingue «aún no hay datos», «tu búsqueda no devolvió nada», «algo falló» y «no tienes permiso»." />
        <div className="grid gap-4 medium:grid-cols-2">
          <EmptyState title="Aún no tienes pedidos" description="Cuando recibas el primero aparecerá aquí." action={<Button size="sm" className="mt-1">Crear pedido</Button>} />
          <EmptyState title="Sin resultados para «zapatos»" description="Revisa la ortografía o prueba con otra palabra." action={<Button size="sm" variant="outline" className="mt-1">Limpiar búsqueda</Button>} />
          <EmptyState kind="error" onRetry={() => {}} />
          <EmptyState kind="forbidden" action={<Button size="sm" variant="outline" className="mt-1">Solicitar acceso</Button>} />
        </div>
      </section>
    </div>
  )
}
