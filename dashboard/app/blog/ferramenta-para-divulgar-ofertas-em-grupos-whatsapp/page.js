import { PreservationBlogPost, getPreservationBlogMetadata } from '../_preservationBlogPosts'

export const metadata = getPreservationBlogMetadata('ferramenta-para-divulgar-ofertas-em-grupos-whatsapp')

export default function Page() {
  return <PreservationBlogPost postKey="ferramenta-para-divulgar-ofertas-em-grupos-whatsapp" />
}
