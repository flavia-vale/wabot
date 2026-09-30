import { PreservationBlogPost, getPreservationBlogMetadata } from '../_preservationBlogPosts'

export const metadata = getPreservationBlogMetadata('shopee-suspendeu-afiliado-o-que-fazer')

export default function Page() {
  return <PreservationBlogPost postKey="shopee-suspendeu-afiliado-o-que-fazer" />
}
