import Image from "next/image"
import type { BoxItem } from "@/types/product"
import { Card, CardContent } from "@/components/ui/card"

interface WhatsInBoxProps {
  items: BoxItem[]
}

export function WhatsInBox({ items }: WhatsInBoxProps) {
  return (
    <section className="py-12 md:py-16">
      <h2 className="text-3xl md:text-4xl font-semibold text-center mb-8 text-balance">What's in the Box</h2>

      <Card className="overflow-hidden">
        <CardContent className="p-8 md:p-12">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {items.map((item, index) => (
              <div key={index} className="flex flex-col items-center text-center space-y-4">
                <div className="relative w-24 h-24 md:w-32 md:h-32">
                  <Image src={item.image || "/placeholder.svg"} alt={item.name} fill className="object-contain" />
                </div>
                <p className="text-sm font-medium">{item.name}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
