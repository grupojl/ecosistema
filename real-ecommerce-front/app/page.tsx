import ProductHero from "@/components/product-hero"

export default function Home() {
  const products = [
    {
      title: "Aurora Buds Pro",
      subtitle: "Silencio total, sonido total.",
      description: "",
      image: "/placeholder.svg",
      darkBg: true,
      buttons: ["Conocer más", "Comprar"],
    },
    {
      title: "Halo Watch SE",
      subtitle: "Tu salud, en tu muñeca.",
      description: "Monitoreo continuo, batería de hasta 5 días.",
      image: "/placeholder.svg",
      darkBg: false,
      buttons: ["Conocer más", "Comprar"],
    },
    {
      title: "Drift 14 Slim",
      subtitle: "Potencia que no pesa.",
      description: "",
      image: "/placeholder.svg",
      darkBg: true,
      buttons: ["Conocer más", "Comprar"],
    },
    {
      title: "Lumen Tab 11",
      subtitle: "Crea sin límites.",
      description: "",
      image: "/placeholder.svg",
      darkBg: false,
      buttons: ["Conocer más", "Comprar"],
    },
  ]

  return (
    <main className="w-full">
      {products.map((product, index) => (
        <ProductHero key={index} {...product} />
      ))}
    </main>
  )
}
