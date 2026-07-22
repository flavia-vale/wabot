import { PreservationBlogPost, getPreservationBlogMetadata } from '../_preservationBlogPosts'

export const metadata = getPreservationBlogMetadata('melhores-horarios-para-postar-ofertas-no-whatsapp')

export default function Page() {
  return <PreservationBlogPost postKey="melhores-horarios-para-postar-ofertas-no-whatsapp" />
}
