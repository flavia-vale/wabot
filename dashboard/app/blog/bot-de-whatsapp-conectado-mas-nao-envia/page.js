import { PreservationBlogPost, getPreservationBlogMetadata } from '../_preservationBlogPosts'

export const metadata = getPreservationBlogMetadata('bot-de-whatsapp-conectado-mas-nao-envia')

export default function Page() {
  return <PreservationBlogPost postKey="bot-de-whatsapp-conectado-mas-nao-envia" />
}
