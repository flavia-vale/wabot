import { PreservationBlogPost, getPreservationBlogMetadata } from '../_preservationBlogPosts'

export const metadata = getPreservationBlogMetadata('migrar-grupo-achadinhos-para-canal')

export default function Page() {
  return <PreservationBlogPost postKey="migrar-grupo-achadinhos-para-canal" />
}
