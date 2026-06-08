import { PreservationBlogPost, getPreservationBlogMetadata } from '../_preservationBlogPosts'

export const metadata = getPreservationBlogMetadata('comecar-afiliado-whatsapp-sem-grupo-grande')

export default function Page() {
  return <PreservationBlogPost postKey="comecar-afiliado-whatsapp-sem-grupo-grande" />
}
