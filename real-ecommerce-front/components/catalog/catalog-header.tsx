"use client"

import Link from "next/link";
import { useState } from "react"

interface CatalogHeaderProps {
  title: string
  models: Array<{ name: string; shortName: string }>
}

export function CatalogHeader({ title, models }: CatalogHeaderProps) {
  const [activeModel, setActiveModel] = useState(0)

  return (
    <header className="border-b border-gray-200 bg-white py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8">
          <h1 className="text-balance text-5xl font-bold tracking-tight">{title}</h1>
        </div>

        <Link href="/product/iphone-17-pro" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
          Comprar
        </Link>

        <div className="flex items-center gap-3 overflow-x-auto pb-4">
          {models.map((model, idx) => (
            <button
              key={model.shortName}
              onClick={() => setActiveModel(idx)}
              className={`flex flex-col items-center gap-2 px-4 py-2 transition-opacity ${
                activeModel === idx ? "opacity-100" : "opacity-60 hover:opacity-80"
              }`}
            >
              <div className="h-12 w-10 rounded bg-gray-200 flex items-center justify-center text-xs font-medium">
                {model.shortName}
              </div>
              <span className="text-xs text-gray-600">{model.shortName}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
