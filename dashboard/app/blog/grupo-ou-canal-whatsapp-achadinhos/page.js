import { PreservationBlogPost, getPreservationBlogMetadata } from '../_preservationBlogPosts'

export const metadata = getPreservationBlogMetadata('grupo-ou-canal-whatsapp-achadinhos')

export default function Page() {
  return <PreservationBlogPost postKey="grupo-ou-canal-whatsapp-achadinhos" />
}
