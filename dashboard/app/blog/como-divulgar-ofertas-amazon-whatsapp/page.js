import { PreservationBlogPost, getPreservationBlogMetadata } from '../_preservationBlogPosts'

export const metadata = getPreservationBlogMetadata('como-divulgar-ofertas-amazon-whatsapp')

export default function Page() {
  return <PreservationBlogPost postKey="como-divulgar-ofertas-amazon-whatsapp" />
}
