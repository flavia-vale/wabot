import { PreservationBlogPost, getPreservationBlogMetadata } from '../_preservationBlogPosts'

export const metadata = getPreservationBlogMetadata('bot-whatsapp-antiban-existe')

export default function Page() {
  return <PreservationBlogPost postKey="bot-whatsapp-antiban-existe" />
}
