import { PreservationBlogPost, getPreservationBlogMetadata } from '../_preservationBlogPosts'

export const metadata = getPreservationBlogMetadata('chip-dedicado-bot-whatsapp')

export default function Page() {
  return <PreservationBlogPost postKey="chip-dedicado-bot-whatsapp" />
}
