"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ShieldCheck, Fingerprint, Smartphone, Key, CheckCircle2, ArrowLeft, AlertCircle } from "lucide-react"
import Link from "next/link"

const mockCart = {
  items: [
    { id: 1, name: "Laptop HP ProBook", qty: 1, price: 750 },
    { id: 2, name: "Mouse Inalámbrico", qty: 2, price: 50 },
  ],
  subtotal: 850,
  shipping: 120,
  total: 970,
}

type AuthStep = "pending" | "authenticating" | "success" | "error"

export function CheckoutFlow() {
  const [authStep, setAuthStep] = useState<AuthStep>("pending")
  const [selectedMethod, setSelectedMethod] = useState<"fingerprint" | "face" | "security-key" | null>(null)
  const [progress, setProgress] = useState(0)

  const handleAuthenticate = async (method: "fingerprint" | "face" | "security-key") => {
    setSelectedMethod(method)
    setAuthStep("authenticating")
    setProgress(0)

    // Simulate WebAuthn authentication process
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return prev + 20
      })
    }, 200)

    // Simulate API call
    setTimeout(() => {
      clearInterval(progressInterval)
      setProgress(100)
      setAuthStep("success")
    }, 1500)
  }

  const authMethods = [
    { id: "fingerprint", name: "Huella Digital", icon: Fingerprint, description: "Touch ID / Huella dactilar" },
    { id: "face", name: "Reconocimiento Facial", icon: Smartphone, description: "Face ID / Reconocimiento facial" },
    { id: "security-key", name: "Llave de Seguridad", icon: Key, description: "YubiKey / FIDO2" },
  ] as const

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

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Verificación de Seguridad</CardTitle>
                    <CardDescription>Confirma tu identidad antes de completar la compra</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {authStep === "pending" && (
                  <div className="space-y-4">
                    <Alert>
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>
                        Por seguridad, necesitamos verificar tu identidad. Elige un método de autenticación.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                      {authMethods.map((method) => (
                        <button
                          key={method.id}
                          onClick={() => handleAuthenticate(method.id)}
                          className="w-full p-4 border rounded-lg hover:bg-accent transition-colors text-left group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                              <method.icon className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium mb-1">{method.name}</h3>
                              <p className="text-sm text-muted-foreground">{method.description}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {authStep === "authenticating" && (
                  <div className="space-y-6 py-8">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
                        {selectedMethod === "fingerprint" && <Fingerprint className="w-10 h-10 text-primary" />}
                        {selectedMethod === "face" && <Smartphone className="w-10 h-10 text-primary" />}
                        {selectedMethod === "security-key" && <Key className="w-10 h-10 text-primary" />}
                      </div>
                      <h3 className="text-lg font-medium mb-2">Verificando identidad...</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        {selectedMethod === "fingerprint" && "Coloca tu dedo en el sensor"}
                        {selectedMethod === "face" && "Mira a la cámara frontal"}
                        {selectedMethod === "security-key" && "Inserta y toca tu llave de seguridad"}
                      </p>
                      <div className="w-full max-w-xs">
                        <Progress value={progress} className="h-2" />
                      </div>
                    </div>
                  </div>
                )}

                {authStep === "success" && (
                  <div className="space-y-6 py-8">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">Verificación exitosa</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        Tu identidad ha sido confirmada de manera segura
                      </p>
                      <Button size="lg" className="w-full max-w-xs">
                        <Link href="/tracking">
                          Confirmar Compra - ${mockCart.total.toFixed(2)}
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}

                {authStep === "error" && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>
                      No se pudo verificar tu identidad. Intenta nuevamente o usa otro método.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">¿Por qué verificar mi identidad?</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>WebAuthn es un estándar de seguridad que protege tus compras mediante:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Autenticación sin contraseñas</li>
                  <li>Protección contra phishing y fraude</li>
                  <li>Verificación biométrica local (no se envían datos biométricos)</li>
                  <li>Compatible con dispositivos móviles y llaves de seguridad</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumen de Compra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {mockCart.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.name} x{item.qty}
                      </span>
                      <span className="font-medium">${item.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${mockCart.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Envío</span>
                    <span>${mockCart.shipping.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>${mockCart.total.toFixed(2)}</span>
                  </div>
                </div>
                {authStep === "success" && (
                  <Badge className="w-full justify-center bg-green-500 hover:bg-green-600 text-white">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Verificado
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
