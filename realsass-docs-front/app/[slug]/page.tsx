import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDoc, listDocs } from '@/lib/docs'
import { Prose } from '@real/ui'
import { Markdown } from '@/lib/markdown'

type Params = { slug: string }

export async function generateStaticParams(): Promise<Params[]> {
  return (await listDocs()).map((d) => ({ slug: d.slug }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const doc = await getDoc((await params).slug)
  return { title: doc?.title ?? 'No encontrado' }
}

export default async function DocPage({ params }: { params: Promise<Params> }) {
  const doc = await getDoc((await params).slug)
  if (!doc) notFound()
  return <Prose><Markdown source={doc.body} /></Prose>
}
