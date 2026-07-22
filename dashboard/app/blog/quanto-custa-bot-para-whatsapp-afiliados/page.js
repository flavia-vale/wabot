import { PreservationBlogPost, getPreservationBlogMetadata } from '../_preservationBlogPosts'

export const metadata = getPreservationBlogMetadata('quanto-custa-bot-para-whatsapp-afiliados')

export default function Page() {
  return <PreservationBlogPost postKey="quanto-custa-bot-para-whatsapp-afiliados" />
}
