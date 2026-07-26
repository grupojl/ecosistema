"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Package, Truck, CheckCircle2, MapPin, Clock, ArrowLeft } from "lucide-react"
import Link from "next/link"

const mockOrder = {
  id: "ORD-2025-A4B8C",
  createdAt: "2025-01-15T10:30:00Z",
  status: "in_transit",
  carrier: "welivery",
  trackingNumber: "WLV789456123",
  estimatedDelivery: "2025-01-18T18:00:00Z",
  weight: 12.5,
  value: 850,
  items: [
    { name: "Laptop HP ProBook", qty: 1, price: 750 },
    { name: "Mouse Inalámbrico", qty: 2, price: 50 },
  ],
  tracking: [
    { status: "created", timestamp: "2025-01-15T10:30:00Z", location: "Almacén Central", completed: true },
    { status: "picked", timestamp: "2025-01-15T14:20:00Z", location: "Centro de Distribución CDMX", completed: true },
    { status: "in_transit", timestamp: "2025-01-16T08:45:00Z", location: "En ruta a Guadalajara", completed: true },
    { status: "out_for_delivery", timestamp: null, location: "Centro Guadalajara", completed: false },
    { status: "delivered", timestamp: null, location: "Domicilio destino", completed: false },
  ],
}

const carrierInfo = {
  envia: { name: "Envia", color: "bg-orange-500", description: "Paquetería ligera < 5kg" },
  welivery: { name: "Welivery", color: "bg-blue-500", description: "Paquetería media 5-20kg" },
  correo: { name: "Correo", color: "bg-green-500", description: "Paquetería pesada > 20kg" },
}

export function TrackingView() {
  const [order] = useState(mockOrder)
  const carrier = carrierInfo[order.carrier as keyof typeof carrierInfo]
  const completedSteps = order.tracking.filter((t) => t.completed).length
  const progressPercent = (completedSteps / order.tracking.length) * 100

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </Link>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">Orden {order.id}</CardTitle>
                <CardDescription>Tracking: {order.trackingNumber}</CardDescription>
              </div>
              <Badge className={`${carrier.color} text-white`}>{carrier.name}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>
                    Entrega estimada:{" "}
                    {new Date(order.estimatedDelivery).toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <span className="text-muted-foreground">{carrier.description}</span>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Progreso de envío</span>
                  <span className="text-muted-foreground">
                    {completedSteps} de {order.tracking.length} pasos
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              <Separator />

              <div className="space-y-4">
                {order.tracking.map((step, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          step.completed ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {step.completed ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : step.status === "in_transit" ? (
                          <Truck className="w-5 h-5" />
                        ) : (
                          <Package className="w-5 h-5" />
                        )}
                      </div>
                      {index < order.tracking.length - 1 && (
                        <div className={`w-0.5 h-12 ${step.completed ? "bg-primary" : "bg-border"}`} />
                      )}
                    </div>
                    <div className="flex-1 pb-8">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-medium ${step.completed ? "text-foreground" : "text-muted-foreground"}`}>
                          {step.status === "created" && "Orden Creada"}
                          {step.status === "picked" && "Recolectado"}
                          {step.status === "in_transit" && "En Tránsito"}
                          {step.status === "out_for_delivery" && "En Reparto"}
                          {step.status === "delivered" && "Entregado"}
                        </h3>
                        {step.timestamp && (
                          <span className="text-sm text-muted-foreground">
                            {new Date(step.timestamp).toLocaleString("es-MX", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{step.location}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalles de la orden</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Peso total</span>
                <span className="font-medium">{order.weight} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor declarado</span>
                <span className="font-medium">${order.value.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>
                      {item.name} x{item.qty}
                    </span>
                    <span className="font-medium">${item.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
