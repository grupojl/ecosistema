import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-bold">404</h1>
        <h2 className="text-2xl font-semibold">Product Not Found</h2>
        <p className="text-muted-foreground max-w-md">
          Sorry, we couldn't find the product you're looking for. It may have been removed or the link might be
          incorrect.
        </p>
        <Button asChild size="lg">
          <Link href="/">Go to Home</Link>
        </Button>
      </div>
    </div>
  )
}
