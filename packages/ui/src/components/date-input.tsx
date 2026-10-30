import * as React from "react"

import { Input } from "./input"

/**
 * DateInput — selector de fecha NATIVO (welver.html → «Combobox · Date»): teclado, lector de pantalla y móvil
 * resueltos por el navegador. Valor en formato `AAAA-MM-DD`. Usa `min`/`max` para acotar el rango.
 */
const DateInput = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<typeof Input>, "type">>(
  (props, ref) => <Input ref={ref} type="date" {...props} />
)
DateInput.displayName = "DateInput"

export { DateInput }
