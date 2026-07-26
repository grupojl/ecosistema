"use client"

export default function ShoppingBagModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute right-0 mt-2 w-96 bg-black/95 backdrop-blur-sm border border-gray-800 rounded-lg shadow-2xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Modal Content */}
      <div className="p-6 border-b border-gray-800">
        <h2 className="text-xl font-semibold text-white">Your Bag is empty.</h2>
      </div>

      {/* Sign in message */}
      <div className="p-6 border-b border-gray-800">
        <p className="text-sm text-gray-400">
          <Link href="#" className="text-blue-500 hover:text-blue-400">
            Sign in
          </Link>{" "}
          to see if you have any saved items
        </p>
      </div>

      {/* My Profile Section */}
      <div className="p-6">
        <h3 className="text-sm font-semibold text-white mb-4">My Profile</h3>
        <ul className="space-y-3">
          <li>
            <a href="#" className="text-sm text-gray-300 hover:text-white transition flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <span>Orders</span>
            </a>
          </li>
          <li>
            <a href="#" className="text-sm text-gray-300 hover:text-white transition flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h6a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V5z"
                />
              </svg>
              <span>Your Saves</span>
            </a>
          </li>
          <li>
            <a href="#" className="text-sm text-gray-300 hover:text-white transition flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Account</span>
            </a>
          </li>
          <li>
            <a href="#" className="text-sm text-gray-300 hover:text-white transition flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
              <span>Sign in</span>
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}

import Link from "next/link"
