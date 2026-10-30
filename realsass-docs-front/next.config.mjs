/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Las páginas se leen de `content/*.md` con fs: hay que llevarlas a la imagen standalone.
  outputFileTracingIncludes: { '/**': ['./content/**/*.md'] },
}
export default nextConfig
