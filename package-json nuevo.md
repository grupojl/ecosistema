{
  "dependencies": {   // 99 paquetes · ×N = workspaces que lo usan
    "@nestjs/common":                            "^11.2.5",   // ×9
    "zod":                                       "^4.6.5",    // ×9  ↑ major (antes 3.x)
    "@nestjs/config":                            "^4.0.4",    // ×8
    "@nestjs/core":                              "^11.2.5",   // ×8
    "@nestjs/platform-express":                  "^11.2.5",   // ×8
    "@prisma/adapter-pg":                        "^7.10.0",   // ×8  superadmin lo suma (Prisma 6→7)
    "@prisma/client":                            "^7.10.0",   // ×8  ↑ major en superadmin
    "@willsoto/nestjs-prometheus":               "^6.1.1",    // ×8
    "helmet":                                    "^8.3.0",    // ×8  superadmin lo suma (OWASP)
    "ioredis":                                   "^6.0.0",    // ×8  ↑ major; bullmq 6 lo exige como peer
    "nestjs-pino":                               "^4.6.1",    // ×8  (la 5 tiene 21 días)
    "pg":                                        "^8.23.0",   // ×8
    "pino":                                      "^10.3.1",   // ×8  ↑ major
    "prom-client":                               "^15.1.3",   // ×8  deprecado, pero peer obligatorio de @willsoto
    "reflect-metadata":                          "^0.2.2",    // ×8
    "rxjs":                                      "^7.8.2",    // ×8
    "@nestjs/swagger":                           "^11.4.7",   // ×7
    "dotenv":                                    "^17.4.2",   // ×7  lo usa prisma.config.ts (Prisma 7)
    "pino-http":                                 "^11.0.0",   // ×7  ↑ major; faltaba en los 2 backs de welver
    "@grpc/grpc-js":                             "^1.14.5",   // ×6  @nestjs/microservices lo carga en runtime
    "@grpc/proto-loader":                        "^0.8.1",    // ×6
    "@nestjs/bullmq":                            "^11.0.5",   // ×6
    "@nestjs/microservices":                     "^11.2.5",   // ×6
    "@trpc/server":                              "^11.19.0",  // ×6  (+1 dev) — @trpc/client exige versión exacta
    "bullmq":                                    "^6.3.8",    // ×6  ↑ major
    "firebase-admin":                            "^14.4.0",   // ×6  ↑ major (Node ≥22)
    "@nestjs/schedule":                          "^5.0.1",    // ×5
    "@nestjs/throttler":                         "^6.7.0",    // ×5  superadmin lo suma (rate limiting)
    "@tanstack/react-query":                     "^5.103.1",  // ×4
    "lucide-react":                              "^1.47.0",   // ×4  ↑ major
    "next":                                      "^16.3.5",   // ×4  ↑ major
    "next-themes":                               "^0.4.6",    // ×4
    "react":                                     "^19.3.0",   // ×4
    "react-dom":                                 "^19.3.0",   // ×4
    "zustand":                                   "^5.0.15",   // ×4
    "@opentelemetry/api":                        "^1.9.1",    // ×3  ★ se importaba sin declarar
    "@trpc/client":                              "^11.19.0",  // ×3
    "@trpc/react-query":                         "^11.19.0",  // ×3
    "opossum":                                   "^10.0.0",   // ×3  ↑ major; ★ en chatia y notificaciones
    "pino-pretty":                               "^13.1.3",   // ×3
    "prisma":                                    "^7.10.0",   // ×3  runtime en ms (start:migrate)
    "@nestjs/cache-manager":                     "^3.1.3",    // ×2
    "@nestjs/event-emitter":                     "^3.1.0",    // ×2
    "@opentelemetry/auto-instrumentations-node": "^0.80.0",   // ×2  OTel SDK 2.x
    "@opentelemetry/resources":                  "^2.11.0",   // ×2  ↑ major
    "@opentelemetry/sdk-node":                   "^0.222.0",  // ×2
    "@opentelemetry/semantic-conventions":       "^1.43.0",   // ×2
    "cache-manager":                             "^7.2.9",    // ×2  ↑ major
    "firebase":                                  "^12.19.0",  // ×2  ↑ major
    "keyv":                                      "^5.6.0",    // ×2  ★ peer obligatorio de @nestjs/cache-manager
    "sonner":                                    "^2.0.8",    // ×2
    "@hookform/resolvers":                       "^5.9.1",    // ×1
    "@nestjs/platform-socket.io":                "^11.2.5",   // ×1  ★ chatia (gateway)
    "@nestjs/websockets":                        "^11.2.5",   // ×1  ★ chatia (gateway)
    "@opentelemetry/exporter-metrics-otlp-http": "^0.222.0",  // ×1  ★ pasarelapagos
    "@opentelemetry/exporter-prometheus":        "^0.222.0",  // ×1  solo sass-back
    "@opentelemetry/exporter-trace-otlp-grpc":   "^0.222.0",  // ×1
    "@opentelemetry/exporter-trace-otlp-http":   "^0.222.0",  // ×1  ★ pasarelapagos
    "@opentelemetry/sdk-metrics":                "^2.11.0",   // ×1  ★ pasarelapagos
    "@radix-ui/react-accordion":                 "^1.2.20",   // ×1  ← los 23 radix quedan SOLO en @real/ui
    "@radix-ui/react-alert-dialog":              "^1.1.23",   // ×1
    "@radix-ui/react-avatar":                    "^1.2.6",    // ×1
    "@radix-ui/react-checkbox":                  "^1.3.11",   // ×1
    "@radix-ui/react-collapsible":               "^1.1.20",   // ×1
    "@radix-ui/react-dialog":                    "^1.1.23",   // ×1
    "@radix-ui/react-dropdown-menu":             "^2.1.24",   // ×1
    "@radix-ui/react-hover-card":                "^1.1.23",   // ×1
    "@radix-ui/react-label":                     "^2.1.15",   // ×1
    "@radix-ui/react-navigation-menu":           "^1.2.22",   // ×1
    "@radix-ui/react-popover":                   "^1.1.23",   // ×1
    "@radix-ui/react-progress":                  "^1.1.16",   // ×1
    "@radix-ui/react-radio-group":               "^1.4.7",    // ×1
    "@radix-ui/react-scroll-area":               "^1.2.18",   // ×1
    "@radix-ui/react-select":                    "^2.3.7",    // ×1
    "@radix-ui/react-separator":                 "^1.1.15",   // ×1
    "@radix-ui/react-slider":                    "^1.4.7",    // ×1
    "@radix-ui/react-slot":                      "^1.3.3",    // ×1
    "@radix-ui/react-switch":                    "^1.3.7",    // ×1
    "@radix-ui/react-tabs":                      "^1.1.21",   // ×1
    "@radix-ui/react-toggle":                    "^1.1.18",   // ×1
    "@radix-ui/react-toggle-group":              "^1.1.19",   // ×1
    "@radix-ui/react-tooltip":                   "^1.2.16",   // ×1
    "@vercel/analytics":                         "^2.0.1",    // ×1  solo ecommerce-front
    "axios":                                     "^1.20.0",   // ×1
    "bcryptjs":                                  "^3.0.3",    // ×1  solo pasarelapagos
    "class-variance-authority":                  "^0.7.1",    // ×1  @real/ui
    "clsx":                                      "^2.1.1",    // ×1  @real/ui
    "cookie-parser":                             "^1.4.7",    // ×1  solo sass-back
    "framer-motion":                             "^13.4.0",   // ×1  ↑ major
    "mammoth":                                   "^1.12.3",   // ×1  ★ workers (import dinámico)
    "mercadopago":                               "^3.6.1",    // ×1  ↑ major
    "nanoid":                                    "^6.0.1",    // ×1  ↑ major
    "pdf-parse":                                 "^2.4.5",    // ×1  ★ workers — API v2 distinta a la del stub
    "react-hook-form":                           "^7.88.0",   // ×1  solo dashboard
    "socket.io":                                 "^4.8.3",    // ×1
    "stripe":                                    "^22.6.2",   // ×1  ↑ major
    "superjson":                                 "^2.2.6",    // ×1
    "tailwind-merge":                            "^3.7.0",    // ×1  @real/ui
    "vaul":                                      "^1.1.2"     // ×1  @real/ui (drawer)
  },
  "devDependencies": {   // 41 paquetes
    "typescript":                                "^6.0.3",    // ×21 ↑ major (la 7 rompe typescript-eslint y ts-jest)
    "@types/node":                               "^24.13.5",  // ×18 sigue al runtime Node 24
    "@types/express":                            "^5.0.6",    // ×10 ★ en 6 workspaces que lo usaban sin declarar
    "@nestjs/cli":                               "^11.0.24",  // ×8
    "@nestjs/testing":                           "^11.2.5",   // ×8
    "jest":                                      "^30.5.2",   // ×8  ↑ major
    "ts-jest":                                   "^29.4.12",  // ×8  soporta jest 30
    "@nestjs/schematics":                        "^11.1.0",   // ×7
    "supertest":                                 "^7.2.2",    // ×7
    "ts-node":                                   "^10.9.2",   // ×7  carga jest.config.ts
    "tsconfig-paths":                            "^4.2.0",    // ×7
    "@types/react":                              "^19.3.0",   // ×6
    "@eslint/js":                                "^10.0.1",   // ×5
    "@types/react-dom":                          "^19.3.0",   // ×5
    "eslint":                                    "^10.11.0",  // ×5  ↑ major (la 9 ya no tiene soporte)
    "prisma":                                    "^7.10.0",   // ×5
    "typescript-eslint":                         "^8.70.0",   // ×5
    "@types/jest":                               "^30.0.0",   // ×4  ahora sí coincide con jest 30
    "@types/supertest":                          "^7.2.1",    // ×4
    "eslint-config-prettier":                    "^10.1.8",   // ×4
    "eslint-plugin-prettier":                    "^5.5.6",    // ×4
    "globals":                                   "^17.12.0",  // ×4
    "prettier":                                  "^3.9.8",    // ×4
    "tailwindcss":                               "^4.3.3",    // ×4
    "@tailwindcss/postcss":                      "^4.3.3",    // ×3
    "postcss":                                   "^8.5.28",   // ×3
    "tw-animate-css":                            "^1.4.0",    // ×3
    "@nestjs/common":                            "^11.2.5",   // ×2  packages/*/auth-server (R3: dev + peer)
    "ts-loader":                                 "^9.6.2",    // ×2  solo welver (builder webpack)
    "zod":                                       "^4.6.5",    // ×2  packages/*/auth-server (R3)
    "@nestjs/config":                            "^4.0.4",    // ×1  grpc-client (R3)
    "@nestjs/core":                              "^11.2.5",   // ×1  @real/auth-server (R3)
    "@next/eslint-plugin-next":                  "^16.3.5",   // ×1  ★ superadmin, reemplaza a eslint-config-next
    "@trpc/server":                              "^11.19.0",  // ×1  @real/auth-server (R3)
    "@types/cookie-parser":                      "^1.4.10",   // ×1
    "eslint-plugin-react-hooks":                 "^7.1.1",    // ×1  ★ superadmin
    "firebase-admin":                            "^14.4.0",   // ×1  @real/auth-server (R3)
    "react":                                     "^19.3.0",   // ×1  @real/ui (R3)
    "react-dom":                                 "^19.3.0",   // ×1  @real/ui (R3)
    "reflect-metadata":                          "^0.2.2",    // ×1  @real/auth-server (R3)
    "vitest":                                    "^4.1.11"    // ×1  ↑ major (la 5 tiene 18 días)
  },
  "peerDependencies": {   // solo packages/* — regla R3
    "@nestjs/common": ">=11.0.0", "react": ">=19.0.0", "zod": ">=4.0.0", "@nestjs/config": ">=4.0.0",
    "@trpc/server": ">=11.0.0", "firebase-admin": ">=13.0.0", "react-dom": ">=19.0.0"
  },
  "pnpm": {
    "overrides": {   // R6 — cada uno verificado con audit + prueba funcional
      "multer":                 "^2.4.0",   // 4 CVEs vía @nestjs/platform-express (fija 2.2.0)
      "mysql2":                 "^3.24.4",  // 2 CVEs vía CLI de prisma
      "deepmerge-ts":           "^8.0.2",   // 1 CVE high vía @prisma/config — probado: carga prisma.config.ts
      "uuid@<11.1.1":           "^11.1.1",  // 1 CVE vía firebase-admin > gaxios — probado: gaxios funciona
      "@nestjs/cli>typescript": "^6.0.3",   // One Version — probado: nest build con tsc y con webpack
      "rxjs":                   "^7.8.2"    // One Version — @angular-devkit fijaba 7.8.1
    },
    "peerDependencyRules": { "ignoreMissing": ["react", "react-dom"] }  // SOLO ecosistema-ms: @prisma/studio-core
  }
}