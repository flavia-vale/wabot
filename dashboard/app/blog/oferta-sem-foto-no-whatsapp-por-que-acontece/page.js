import { PreservationBlogPost, getPreservationBlogMetadata } from '../_preservationBlogPosts'

export const metadata = getPreservationBlogMetadata('oferta-sem-foto-no-whatsapp-por-que-acontece')

export default function Page() {
  return <PreservationBlogPost postKey="oferta-sem-foto-no-whatsapp-por-que-acontece" />
}
