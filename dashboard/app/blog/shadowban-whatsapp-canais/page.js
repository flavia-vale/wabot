import { PreservationBlogPost, getPreservationBlogMetadata } from '../_preservationBlogPosts'

export const metadata = getPreservationBlogMetadata('shadowban-whatsapp-canais')

export default function Page() {
  return <PreservationBlogPost postKey="shadowban-whatsapp-canais" />
}
