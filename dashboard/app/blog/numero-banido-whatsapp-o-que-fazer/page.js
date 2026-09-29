import { PreservationBlogPost, getPreservationBlogMetadata } from '../_preservationBlogPosts'

export const metadata = getPreservationBlogMetadata('numero-banido-whatsapp-o-que-fazer')

export default function Page() {
  return <PreservationBlogPost postKey="numero-banido-whatsapp-o-que-fazer" />
}
