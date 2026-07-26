import { Button } from "@/components/ui/button"

interface ProductHeroProps {
  title: string
  subtitle: string
  description?: string
  image: string
  darkBg: boolean
  buttons: string[]
}

export default function ProductHero({ title, subtitle, description, image, darkBg, buttons }: ProductHeroProps) {
  return (
    <section className={`w-full py-20 md:py-32 ${darkBg ? "bg-black text-white" : "bg-white text-black"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Content Section */}
        <div className="flex flex-col items-center text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-2">{title}</h1>
          <p className={`text-lg md:text-xl font-semibold ${darkBg ? "text-gray-400" : "text-gray-600"} mb-2`}>
            {subtitle}
          </p>
          {description && <p className={`text-base ${darkBg ? "text-gray-400" : "text-gray-600"}`}>{description}</p>}

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Button
              variant="default"
              className={`px-8 py-2 rounded-full font-semibold ${
                darkBg ? "bg-blue-500 hover:bg-blue-600 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
            >
              {buttons[0]}
            </Button>
            <Button
              variant="outline"
              className={`px-8 py-2 rounded-full font-semibold ${
                darkBg ? "border-white text-white hover:bg-white/10" : "border-black text-black hover:bg-black/5"
              }`}
            >
              {buttons[1]}
            </Button>
          </div>
        </div>

        {/* Image Section */}
        <div className={`flex justify-center ${darkBg ? "" : ""}`}>
          <div className="relative w-full max-w-2xl aspect-square">
            <img src={image || "/placeholder.svg"} alt={title} className="w-full h-full object-contain" />
          </div>
        </div>
      </div>
    </section>
  )
}
