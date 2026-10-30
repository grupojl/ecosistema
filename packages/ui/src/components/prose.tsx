import * as React from "react"

import { cn } from "@real/ui/utils"

/**
 * Prose — tipografía para texto largo ya renderizado (Markdown de ayuda, términos, notas): títulos serif con filete
 * dorado, listas, citas, código y enlaces, todo desde los tokens de Welver.
 *
 *   <Prose><Markdown source={doc.body} /></Prose>
 */
function Prose({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <article
      className={cn(
        "text-base leading-relaxed text-foreground",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a:focus-visible]:rounded-sm [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-ring",
        "[&_h1]:mb-4 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:before:mb-4 [&_h1]:before:block [&_h1]:before:h-[3px] [&_h1]:before:w-12 [&_h1]:before:rounded-sm [&_h1]:before:bg-warning [&_h1]:before:content-['']",
        "[&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold",
        "[&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold",
        "[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1",
        "[&_blockquote]:my-4 [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-[3px] [&_blockquote]:border-warning [&_blockquote]:bg-muted [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:text-muted-foreground",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
        "[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:px-4 [&_pre]:py-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        className,
      )}
      {...props}
    />
  )
}

export { Prose }
