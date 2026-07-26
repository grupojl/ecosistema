export function Footer() {
  return (
    <footer id="contact" className="border-t border-border bg-secondary/50 pb-24 md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <span className="font-serif text-xl text-foreground">Propiedad</span>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The all-in-one platform for modern real estate agencies. Manage, automate, and grow.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Product</h4>
            <ul className="mt-3 flex flex-col gap-2">
              {["Features", "Pricing", "Integrations", "API Docs", "Changelog"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Company</h4>
            <ul className="mt-3 flex flex-col gap-2">
              {["About Us", "Careers", "Press", "Blog", "Contact"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Legal</h4>
            <ul className="mt-3 flex flex-col gap-2">
              {["Privacy Policy", "Terms of Service", "Cookie Policy", "GDPR"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-border pt-6">
          <p className="text-center text-xs text-muted-foreground">
            {"2026 Propiedad. All rights reserved."}
          </p>
        </div>
      </div>
    </footer>
  )
}
