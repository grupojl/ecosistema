import { serializeJsonLd, type JsonLdObject } from '@/lib/seo/json-ld';

/** Server Component. El escape anti-XSS vive en serializeJsonLd (testeado). */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- contenido escapado por serializeJsonLd
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
