import Link from "next/link"

export default function Footer() {
  return (
    <footer className="bg-gray-100 text-gray-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-semibold text-sm mb-4">Shop</h3>
            <ul className="space-y-2 text-xs text-gray-600">
              <li>
                <Link href="/categoria/computacion" className="hover:text-black">
                  Computación
                </Link>
              </li>
              <li>
                <Link href="/categoria/audio" className="hover:text-black">
                  Audio
                </Link>
              </li>
              <li>
                <Link href="/categoria/tablets" className="hover:text-black">
                  Tablets
                </Link>
              </li>
              <li>
                <Link href="/categoria/wearables" className="hover:text-black">
                  Wearables
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-4">Account</h3>
            <ul className="space-y-2 text-xs text-gray-600">
              <li>
                <Link href="#" className="hover:text-black">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/tracking" className="hover:text-black">
                  Orders
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-black">
                  Returns
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-4">Support</h3>
            <ul className="space-y-2 text-xs text-gray-600">
              <li>
                <Link href="#" className="hover:text-black">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-black">
                  Help
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-black">
                  Accessibility
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-4">Company</h3>
            <ul className="space-y-2 text-xs text-gray-600">
              <li>
                <Link href="#" className="hover:text-black">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-black">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-black">
                  Careers
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-300 pt-8">
          <p className="text-xs text-gray-600 text-center">© 2025 Nimbus Store. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
